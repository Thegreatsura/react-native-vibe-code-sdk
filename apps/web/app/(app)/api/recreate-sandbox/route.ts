import { db } from '@/lib/db'
import { projects } from '@react-native-vibe-code/database'
import { startExpoServer } from '@/lib/server-utils'
import { Sandbox } from '@e2b/code-interpreter'
import { eq, and } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { tunnelMode as tunnelModeFlag } from '@/flags'

export const maxDuration = 300 // 5 minutes for full recreation

interface RecreateRequest {
  projectId: string
  userID: string
  teamID?: string
  repositoryName: string
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, userID, teamID, repositoryName }: RecreateRequest = await req.json()

    console.log('[Recreate Sandbox] API called with:', {
      projectId,
      userID,
      repositoryName,
    })

    if (!userID) {
      return Response.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (!projectId) {
      return Response.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!repositoryName) {
      return Response.json({ error: 'Repository name is required' }, { status: 400 })
    }

    // Get existing project
    const existingProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, userID),
          eq(projects.status, 'active'),
        ),
      )
      .limit(1)

    if (existingProjects.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 })
    }

    const project = existingProjects[0]
    console.log(`[Recreate Sandbox] Found project: ${project.id}`)

    // Create new sandbox from github template (shell for loading existing repos)
    let sandbox: Sandbox
    try {
      console.log('[Recreate Sandbox] Creating new sandbox from github template...')
      sandbox = await Sandbox.create('xzfs8fvtvpe3tcqgyyrp', {
        timeoutMs: parseInt(process.env.E2B_SANDBOX_TIMEOUT_MS || '3600000'), // Use env var, default to 1 hour
      })
      console.log(`[Recreate Sandbox] Created new sandbox: ${sandbox.sandboxId}`)
    } catch (error) {
      console.error('[Recreate Sandbox] Failed to create sandbox:', error)
      return Response.json(
        { error: 'Failed to create new sandbox' },
        { status: 500 },
      )
    }

    // Update project with new sandbox ID
    try {
      await db
        .update(projects)
        .set({
          sandboxId: sandbox.sandboxId,
          serverStatus: 'initializing',
          serverReady: false,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId))
      
      console.log(`[Recreate Sandbox] Updated project with new sandbox ID: ${sandbox.sandboxId}`)
    } catch (error) {
      console.error('[Recreate Sandbox] Failed to update project:', error)
      // Continue with the process even if DB update fails
    }

    // Clone GitHub repository using the github template's setup script
    try {
      console.log('[Recreate Sandbox] Cloning GitHub repository...')
      
      const githubToken = process.env.GITHUB_TOKEN
      if (!githubToken) {
        throw new Error('GitHub token not configured')
      }

      // Use the github template's setup script approach
      const cloneScript = `#!/bin/bash
set -e

export GITHUB_TOKEN="${githubToken}"
export GITHUB_OWNER="capsule-this"

cd /home/user
rm -rf app

# Clone the specific repository into app directory
git clone https://${githubToken}@github.com/capsule-this/${repositoryName}.git app

cd app

echo "Repository cloned successfully"
`

      const cloneResult = await sandbox.commands.run(cloneScript, {
        timeoutMs: 60000, // 1 minute
      })

      if (cloneResult.exitCode !== 0) {
        console.error('[Recreate Sandbox] Git clone failed:', cloneResult.stderr)
        throw new Error(`Git clone failed: ${cloneResult.stderr}`)
      }

      console.log('[Recreate Sandbox] Repository cloned successfully')
    } catch (error) {
      console.error('[Recreate Sandbox] Failed to clone repository:', error)
      return Response.json(
        { 
          error: 'Failed to clone repository',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 },
      )
    }

    // Install dependencies
    try {
      console.log('[Recreate Sandbox] Installing dependencies...')

      // First, check if node_modules already exists (from a previous attempt)
      const checkNodeModules = await sandbox.commands.run(
        'cd /home/user/app && [ -d "node_modules" ] && [ "$(ls -A node_modules)" ] && echo "EXISTS" || echo "NOT_EXISTS"',
        { timeoutMs: 5000 }
      )

      if (checkNodeModules.stdout.includes('EXISTS')) {
        console.log('[Recreate Sandbox] node_modules already exists, skipping install')
      } else {
        // Start bun install in background
        console.log('[Recreate Sandbox] Starting bun install in background...')

        const installScript = `cd /home/user/app && rm -f bun.lock && nohup bun install > /tmp/bun-install.log 2>&1 &`

        await sandbox.commands.run(installScript, { timeoutMs: 10000 })

        // Poll for completion by checking if node_modules is populated
        console.log('[Recreate Sandbox] Waiting for bun install to complete...')
        let installComplete = false
        let attempts = 0
        const maxAttempts = 70 // 70 * 5 seconds = 5.8 minutes

        while (!installComplete && attempts < maxAttempts) {
          attempts++
          await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5 seconds

          try {
            // Check if node_modules has content and bun install process is done
            const checkResult = await sandbox.commands.run(
              'cd /home/user/app && [ -d "node_modules" ] && [ "$(ls -A node_modules | wc -l)" -gt "10" ] && ! pgrep -f "bun install" && echo "COMPLETE" || echo "INSTALLING"',
              { timeoutMs: 10000 }
            )

            if (checkResult.stdout.includes('COMPLETE')) {
              installComplete = true
              console.log('[Recreate Sandbox] bun install completed successfully')
            } else {
              console.log(`[Recreate Sandbox] bun install still running... (attempt ${attempts}/${maxAttempts})`)

              // Every 10 attempts, show a progress log
              if (attempts % 10 === 0) {
                try {
                  const logTail = await sandbox.commands.run(
                    'tail -n 3 /tmp/bun-install.log 2>/dev/null || echo "No log yet"',
                    { timeoutMs: 5000 }
                  )
                  console.log('[Recreate Sandbox] bun install progress:', logTail.stdout.trim())
                } catch (e) {
                  // Ignore log reading errors
                }
              }
            }
          } catch (error) {
            console.log(`[Recreate Sandbox] Check failed at attempt ${attempts}:`, error)
          }
        }

        if (!installComplete) {
          // Check if there were errors
          try {
            const logContent = await sandbox.commands.run(
              'tail -n 50 /tmp/bun-install.log 2>/dev/null || echo "No log available"',
              { timeoutMs: 10000 }
            )
            console.error('[Recreate Sandbox] bun install timed out. Last log lines:', logContent.stdout)
          } catch (e) {
            console.error('[Recreate Sandbox] bun install timed out and could not read logs')
          }

          // Mark project as failed
          await db
            .update(projects)
            .set({
              serverStatus: 'failed',
              serverReady: false,
              updatedAt: new Date(),
            })
            .where(eq(projects.id, projectId))

          throw new Error('bun install timed out after 5 minutes')
        }
      }

      console.log('[Recreate Sandbox] Dependencies are ready')
    } catch (error) {
      console.error('[Recreate Sandbox] Failed to install dependencies:', error)

      // Mark project as failed in database
      try {
        await db
          .update(projects)
          .set({
            serverStatus: 'failed',
            serverReady: false,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, projectId))
      } catch (dbError) {
        console.error('[Recreate Sandbox] Failed to update project status:', dbError)
      }

      return Response.json(
        {
          error: 'Failed to install dependencies',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 },
      )
    }

    // Restore Convex environment variables from database
    try {
      console.log('[Recreate Sandbox] Restoring Convex environment variables...')
      const { restoreConvexEnvToSandbox } = await import('@/lib/convex/sandbox-utils')
      await restoreConvexEnvToSandbox(sandbox, projectId)
    } catch (error) {
      console.error('[Recreate Sandbox] Failed to restore Convex env:', error)
      // Don't fail the entire recreation if Convex restore fails
    }

    // Start server based on project type
    try {
      console.log('[Recreate Sandbox] Starting server...')
      
      // Check if this is an Expo/React Native project
      const checkProjectType = await sandbox.commands.run('cd /home/user/app && [ -f "package.json" ] && cat package.json | grep -E "(expo|react-native)" || echo "not_expo"', {
        timeoutMs: 10000,
      })

      if (checkProjectType.stdout.includes('expo') || checkProjectType.stdout.includes('react-native')) {
        // Start Expo server
        console.log('[Recreate Sandbox] Starting Expo server...')
        const currentTunnelMode = await tunnelModeFlag()
        const serverResult = await startExpoServer(sandbox, project.id, undefined, currentTunnelMode as any)

        // Update project with server status
        await db
          .update(projects)
          .set({
            serverStatus: 'running',
            sandboxUrl: serverResult.url,
            ngrokUrl: serverResult.ngrokUrl,
            serverReady: true,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, projectId))

        console.log('[Recreate Sandbox] Expo server started successfully:', serverResult.url)

        return Response.json({
          success: true,
          projectId: project.id,
          projectTitle: project.title,
          sandboxId: sandbox.sandboxId,
          url: serverResult.url,
          ngrokUrl: serverResult.ngrokUrl,
          serverReady: serverResult.serverReady,
          recreated: true,
          tunnelMode: currentTunnelMode,
        })
      } else {
        // For non-Expo projects, just return the sandbox URL
        console.log('[Recreate Sandbox] Non-Expo project, returning sandbox URL')
        const sandboxUrl = `https://${sandbox.getHost(3000)}`
        
        // Update project with server status
        await db
          .update(projects)
          .set({
            serverStatus: 'running',
            sandboxUrl: sandboxUrl,
            serverReady: true,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, projectId))

        return Response.json({
          success: true,
          projectId: project.id,
          projectTitle: project.title,
          sandboxId: sandbox.sandboxId,
          url: sandboxUrl,
          serverReady: true,
          recreated: true,
        })
      }
    } catch (error) {
      console.error('[Recreate Sandbox] Failed to start server:', error)
      return Response.json(
        {
          success: false,
          error: 'Failed to start server',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error('[Recreate Sandbox] Error in API:', error)

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    )
  }
}