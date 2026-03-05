/**
 * OpenCode Service — mirrors ClaudeCodeService but communicates with
 * OpenCode's HTTP server + SSE event stream running inside the E2B sandbox.
 *
 * OpenCode runs as `opencode serve --port 4096` and exposes:
 *   POST /session          — create session
 *   POST /session/:id/message — send message
 *   GET  /session/:id/events  — SSE event stream
 *   GET  /health           — health check
 */

import { Sandbox } from '@e2b/code-interpreter'
import { getPromptWithCloudStatus } from '@react-native-vibe-code/prompt-engine'
import { db } from '@/lib/db'
import { projects } from '@react-native-vibe-code/database'
import { eq } from 'drizzle-orm'
import { translateOpenCodeEvent, parseSSELine } from './open-code-events'
import type { AppGenerationRequest, AppGenerationResponse, StreamingCallbacks } from './claude-code-service'

const OPENCODE_PORT = 4096
const HEALTH_POLL_INTERVAL = 1000
const HEALTH_TIMEOUT = 20_000
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

export class OpenCodeService {
  /**
   * Writes the opencode.json config to the sandbox and starts
   * `opencode serve` if it isn't already running.
   */
  async ensureServerRunning(sandbox: Sandbox, model?: string): Promise<string> {
    // Get the host URL for port forwarding
    const host = sandbox.getHost(OPENCODE_PORT)
    const baseUrl = `https://${host}`

    // Check if server is already running
    const isRunning = await this.checkHealth(baseUrl)
    if (isRunning) {
      console.log('[OpenCode Service] Server already running at', baseUrl)
      return baseUrl
    }

    console.log('[OpenCode Service] Starting OpenCode server...')

    // Write opencode config
    const config = {
      $schema: 'https://opencode.ai/config.json',
      provider: {
        anthropic: {
          api_key: process.env.ANTHROPIC_API_KEY || '',
        },
      },
      model: model || 'anthropic/claude-sonnet-4-5',
      permission: { '*': 'allow' },
      server: { port: OPENCODE_PORT, hostname: '0.0.0.0' },
    }

    await sandbox.files.write('/home/user/opencode.json', JSON.stringify(config, null, 2))
    console.log('[OpenCode Service] Config written to /home/user/opencode.json')

    // Start opencode serve in background
    await sandbox.commands.run(
      `cd /home/user && OPENCODE_CONFIG=/home/user/opencode.json ANTHROPIC_API_KEY="${process.env.ANTHROPIC_API_KEY || ''}" opencode serve --port ${OPENCODE_PORT} &`,
      {
        background: true as const,
        timeoutMs: 10_000,
        envs: {
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
          OPENCODE_CONFIG: '/home/user/opencode.json',
        },
      },
    )

    // Poll health endpoint until ready
    const startTime = Date.now()
    while (Date.now() - startTime < HEALTH_TIMEOUT) {
      await new Promise(resolve => setTimeout(resolve, HEALTH_POLL_INTERVAL))
      const ready = await this.checkHealth(baseUrl)
      if (ready) {
        console.log(`[OpenCode Service] Server ready after ${Date.now() - startTime}ms`)
        return baseUrl
      }
    }

    throw new Error(`OpenCode server failed to start within ${HEALTH_TIMEOUT / 1000}s`)
  }

  private async checkHealth(baseUrl: string): Promise<boolean> {
    try {
      const resp = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      return resp.ok
    } catch {
      return false
    }
  }

  /**
   * Main streaming method — mirrors ClaudeCodeService.generateAppStreaming()
   */
  async generateAppStreaming(
    request: AppGenerationRequest,
    sandbox: Sandbox,
    callbacks: StreamingCallbacks,
  ): Promise<void> {
    try {
      const baseUrl = await this.ensureServerRunning(sandbox, request.claudeModel)
      console.log('[OpenCode Service] Server URL:', baseUrl)

      // Build the user message with context (same as ClaudeCodeService)
      let fullMessage = request.userMessage
      fullMessage += '\n\nCurrent working directory: /home/user'

      // Include visual edit selection context
      if (request.selectionData) {
        const sel = request.selectionData
        fullMessage += '\n\n--- VISUAL EDIT SELECTION ---'
        if (sel.elementId && sel.elementId !== 'No ID') {
          fullMessage += `\nElement ID (file reference): ${sel.elementId}`
        }
        if (request.fileEdition) {
          fullMessage += `\nFile to edit: ${request.fileEdition}`
        }
        if (sel.tagName) fullMessage += `\nElement type: <${sel.tagName}>`
        if (sel.content && sel.content !== 'No content') fullMessage += `\nElement content: "${sel.content}"`
        if (sel.className && sel.className !== 'No class') fullMessage += `\nCSS classes: ${sel.className}`
        if (sel.dataAt) fullMessage += `\nSource location (data-at): ${sel.dataAt}`
        if (sel.dataIn) fullMessage += `\nComponent (data-in): ${sel.dataIn}`
        if (sel.path) fullMessage += `\nDOM path: ${sel.path}`
        fullMessage += '\n\nThe user selected this element visually. Make changes to this specific element in the referenced file and location above.'
        fullMessage += '\n--- END VISUAL EDIT SELECTION ---'
      }

      // Inject system prompt on first message
      const isFirstMessage = !request.sessionId
      let sessionId = request.sessionId

      // Create or resume session
      if (!sessionId) {
        console.log('[OpenCode Service] Creating new session...')
        const createResp = await fetch(`${baseUrl}/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(10_000),
        })

        if (!createResp.ok) {
          throw new Error(`Failed to create OpenCode session: ${createResp.status} ${await createResp.text()}`)
        }

        const sessionData = await createResp.json()
        sessionId = sessionData.id || sessionData.sessionId
        console.log('[OpenCode Service] Session created:', sessionId)

        // Send system prompt as first message (no reply expected)
        let cloudEnabled = false
        try {
          const [project] = await db
            .select({ convexProject: projects.convexProject })
            .from(projects)
            .where(eq(projects.id, request.projectId))
            .limit(1)
          cloudEnabled = (project?.convexProject as any)?.kind === 'connected'
        } catch (e) {
          console.error('[OpenCode Service] Failed to check cloud status:', e)
        }

        const systemPrompt = getPromptWithCloudStatus(cloudEnabled)
        try {
          await fetch(`${baseUrl}/session/${sessionId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `[SYSTEM INSTRUCTIONS - DO NOT REPEAT]\n${systemPrompt}`,
              role: 'system',
            }),
            signal: AbortSignal.timeout(10_000),
          })
          console.log('[OpenCode Service] System prompt injected')
        } catch (e) {
          console.warn('[OpenCode Service] Failed to inject system prompt:', e)
          // Not fatal — continue
        }
      }

      // Emit init message
      callbacks.onMessage(JSON.stringify({
        type: 'system',
        subtype: 'init',
        model: request.claudeModel || 'anthropic/claude-sonnet-4-5',
        cwd: '/home/user',
        tools: [],
        session_id: sessionId,
      }))

      // Subscribe to SSE events
      const abortController = new AbortController()
      const timeout = setTimeout(() => abortController.abort(), SESSION_TIMEOUT)

      let completionDetected = false
      let capturedSessionId = sessionId

      // Start SSE listener before sending the message
      const ssePromise = this.consumeSSEStream(
        `${baseUrl}/session/${sessionId}/events`,
        abortController.signal,
        (event) => {
          const slimMessages = translateOpenCodeEvent(event)
          for (const msg of slimMessages) {
            if (msg.type === 'result') {
              completionDetected = true
              capturedSessionId = (msg as any).session_id || capturedSessionId
            }
            callbacks.onMessage(`Streaming: ${JSON.stringify(msg)}`)
          }
        },
        () => {
          // SSE stream ended — treat as completion
          if (!completionDetected) {
            completionDetected = true
          }
        },
      )

      // Send the actual user message
      console.log('[OpenCode Service] Sending user message...')
      const messageResp = await fetch(`${baseUrl}/session/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: fullMessage,
          role: 'user',
        }),
        signal: AbortSignal.timeout(SESSION_TIMEOUT),
      })

      if (!messageResp.ok) {
        throw new Error(`Failed to send message: ${messageResp.status} ${await messageResp.text()}`)
      }

      // Wait for SSE to finish (agent done processing)
      await ssePromise
      clearTimeout(timeout)

      console.log('[OpenCode Service] Generation complete', {
        completionDetected,
        sessionId: capturedSessionId,
      })

      const response: AppGenerationResponse = {
        filesModified: [],
        success: true,
        summary: 'Task completed successfully',
        conversationId: capturedSessionId || undefined,
      }

      await callbacks.onComplete(response)

      // Trigger GitHub commit (fire and forget)
      this.triggerGitHubCommit(
        sandbox.sandboxId,
        request.projectId,
        request.userMessage,
        request.messageId,
        false,
      )
    } catch (error) {
      console.error('[OpenCode Service] Error:', error)
      await callbacks.onError(
        error instanceof Error ? error.message : 'OpenCode execution failed',
      )
    }
  }

  /**
   * Consumes an SSE stream, calling onEvent for each parsed event.
   */
  private async consumeSSEStream(
    url: string,
    signal: AbortSignal,
    onEvent: (event: any) => void,
    onEnd: () => void,
  ): Promise<void> {
    try {
      const resp = await fetch(url, {
        headers: { Accept: 'text/event-stream' },
        signal,
      })

      if (!resp.ok || !resp.body) {
        console.error('[OpenCode Service] SSE connection failed:', resp.status)
        onEnd()
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const event = parseSSELine(line)
          if (event) {
            onEvent(event)
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const event = parseSSELine(buffer)
        if (event) onEvent(event)
      }
    } catch (error) {
      if (signal.aborted) {
        console.log('[OpenCode Service] SSE stream aborted (expected)')
      } else {
        console.error('[OpenCode Service] SSE stream error:', error)
      }
    } finally {
      onEnd()
    }
  }

  private triggerGitHubCommit(
    sandboxId: string,
    projectId: string,
    userMessage: string,
    messageId?: string,
    executionFailed: boolean = false,
  ): void {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3210'

    fetch(`${baseUrl}/api/github-commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sandboxId,
        projectId,
        userMessage,
        messageId,
        executionFailed,
      }),
    })
      .then(() => console.log('[OpenCode Service] GitHub commit triggered'))
      .catch((error) => console.error('[OpenCode Service] GitHub commit failed:', error))
  }
}
