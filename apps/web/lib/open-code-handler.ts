import { OpenCodeService } from '@/lib/open-code-service'
import { db } from '@/lib/db'
import { projects } from '@react-native-vibe-code/database'
import { UsageTracker } from '@/lib/usage-tracking'
import { Sandbox } from '@e2b/code-interpreter'
import { connectSandbox } from '@/lib/sandbox-connect'
import { eq, and } from 'drizzle-orm'
import type { ClaudeCodeHandlerRequest, ClaudeCodeStreamCallbacks } from './claude-code-handler'

/**
 * Handles OpenCode generation — mirrors handleClaudeCodeGeneration()
 * but delegates to OpenCodeService (HTTP/SSE) instead of ClaudeCodeService (SDK/stdout).
 */
export async function handleOpenCodeGeneration(
  request: ClaudeCodeHandlerRequest,
  callbacks: ClaudeCodeStreamCallbacks,
): Promise<void> {
  console.log('[OpenCode Handler] Called with:', {
    projectId: request.projectId,
    userID: request.userID,
    isFirstMessage: request.isFirstMessage,
    messageLength: request.userMessage.length,
    sandboxId: request.sandboxId,
    messageId: request.messageId || 'no messageId',
  })

  if (!request.userID) {
    await callbacks.onError('User ID is required')
    return
  }

  if (!request.projectId) {
    await callbacks.onError('Project ID is required')
    return
  }

  let project: any = null
  let sandbox: Sandbox | null = null

  const fetchProject = async () => {
    const existingProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, request.projectId),
          eq(projects.userId, request.userID),
          eq(projects.status, 'active'),
        ),
      )
      .limit(1)
    return existingProjects[0] || null
  }

  try {
    project = await fetchProject()

    if (!project) {
      console.log('[OpenCode Handler] Project not found, waiting for creation...')
      const maxWaitTime = 30000
      const pollInterval = 1000
      const startTime = Date.now()

      while (!project && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        project = await fetchProject()
        if (project) {
          console.log(`[OpenCode Handler] Project found after ${Date.now() - startTime}ms`)
        }
      }

      if (!project) {
        await callbacks.onError('Project not found after waiting. Please try again.')
        return
      }
    }

    let targetSandboxId = request.sandboxId || project.sandboxId

    if (!targetSandboxId) {
      console.log('[OpenCode Handler] Sandbox not ready, waiting...')
      const maxWaitTime = 60000
      const pollInterval = 1500
      const startTime = Date.now()

      while (!targetSandboxId && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        project = await fetchProject()
        targetSandboxId = project?.sandboxId
        if (targetSandboxId) {
          console.log(`[OpenCode Handler] Sandbox ready after ${Date.now() - startTime}ms: ${targetSandboxId}`)
        }
      }

      if (!targetSandboxId) {
        await callbacks.onError('Container is still being created. Please wait a moment and try again.')
        return
      }
    }

    sandbox = await connectSandbox(targetSandboxId)
    console.log(`[OpenCode Handler] Connected to sandbox: ${sandbox.sandboxId}`)
  } catch (error) {
    console.error('[OpenCode Handler] Error finding project/sandbox:', error)
    await callbacks.onError('Failed to find project or sandbox')
    return
  }

  try {
    const openCodeService = new OpenCodeService()

    // No skills support for OpenCode (yet) — skip skill file writing

    console.log('[OpenCode Handler] Starting OpenCode generation')

    await openCodeService.generateAppStreaming(
      {
        userMessage: request.userMessage,
        messageId: request.messageId,
        projectId: request.projectId,
        userId: request.userID,
        isFirstMessage: request.isFirstMessage,
        images: request.images,
        imageAttachments: request.imageAttachments,
        fileEdition: request.fileEdition,
        selectionData: request.selectionData,
        sessionId: project.conversationId || undefined,
        claudeModel: request.claudeModel,
      },
      sandbox,
      {
        onMessage: callbacks.onMessage,
        onComplete: async (result: any) => {
          // Track usage
          const estimatedTokens = Math.ceil(request.userMessage.length / 4) + 1000
          try {
            await UsageTracker.trackTokenUsage(
              request.userID,
              estimatedTokens,
              'opencode',
              request.projectId,
            )
            await UsageTracker.trackCodeGeneration(
              request.userID,
              request.projectId,
              result.filesModified?.length || 0,
              estimatedTokens,
            )
          } catch (error) {
            console.error('[OpenCode Handler] Failed to track usage:', error)
          }

          // Save session ID for resumption
          if (result.conversationId && project) {
            try {
              console.log('[OpenCode Handler] Saving session ID:', result.conversationId)
              await db.update(projects)
                .set({
                  conversationId: result.conversationId,
                  updatedAt: new Date(),
                })
                .where(eq(projects.id, request.projectId))
            } catch (error) {
              console.error('[OpenCode Handler] Failed to save session ID:', error)
            }
          }

          // Trigger static bundle build (async)
          if (sandbox && project) {
            try {
              const { buildStaticBundle, getLatestCommitSHA } = await import('@/lib/bundle-builder')
              const commitId = await getLatestCommitSHA(sandbox)
              buildStaticBundle(
                sandbox.sandboxId,
                request.projectId,
                commitId,
                request.userMessage,
              ).then((buildResult) => {
                if (buildResult.success) {
                  console.log('[OpenCode Handler] Static bundle built:', buildResult.manifestUrl)
                } else {
                  console.error('[OpenCode Handler] Bundle build failed:', buildResult.error)
                }
              }).catch((error) => {
                console.error('[OpenCode Handler] Bundle build error:', error)
              })
            } catch (error) {
              console.error('[OpenCode Handler] Failed to trigger bundle build:', error)
            }
          }

          const finalResult = {
            success: true,
            type: 'completion',
            sbxId: sandbox!.sandboxId,
            projectId: project!.id,
            projectTitle: project!.title,
            template: project!.template || 'react-native-expo',
            url: `https://${sandbox!.getHost(8081)}`,
            summary: result.summary,
            filesModified: result.filesModified,
            conversationId: result.conversationId,
          }

          await callbacks.onComplete(finalResult)
        },
        onError: async (error: string) => {
          console.error('[OpenCode Handler] Stream error:', error)
          await callbacks.onError(error)
        },
      },
    )
  } catch (error) {
    console.error('[OpenCode Handler] Error:', error)
    await callbacks.onError(error instanceof Error ? error.message : 'Internal server error')
  }
}
