'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { Database, Zap, Cloud, HardDrive, CheckCircle2, Loader2, ExternalLink, LayoutDashboard, Send } from 'lucide-react'
import { toast } from 'sonner'
import { ConvexDashboardModal } from '@/components/convex-dashboard-modal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const CONVEX_SETUP_PROMPT = 'We have added Convex functionality to the app. Review the codebase and update the current functionality to make use of the database and any needed queries, mutations, and Convex features you see fit.'

interface CloudSidebarPanelProps {
  projectId?: string
  cloudEnabled: boolean
  deploymentUrl?: string
  onCloudEnabled?: () => void
  onRequestChange?: (prompt: string) => void
  onClose: () => void
}

export function CloudSidebarPanel({
  projectId,
  cloudEnabled,
  deploymentUrl,
  onCloudEnabled,
  onRequestChange,
  onClose,
}: CloudSidebarPanelProps) {
  const [isEnabling, setIsEnabling] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showSetupComplete, setShowSetupComplete] = useState(false)

  const handleEnableCloud = async () => {
    if (!projectId) {
      toast.error('Project ID is required')
      return
    }

    setIsEnabling(true)

    try {
      const response = await fetch('/api/cloud/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable cloud')
      }

      posthog.capture('cloud_enabled', { project_id: projectId })
      onCloudEnabled?.()
      // Delay to let any portal DOM cleanup finish before opening the new dialog
      setTimeout(() => setShowSetupComplete(true), 300)
    } catch (error) {
      console.error('Failed to enable cloud:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to enable cloud')
    } finally {
      setIsEnabling(false)
    }
  }

  return (
    <>
      <div className="h-full flex flex-col ">
        {/* Header */}
        <div className="flex items-center justify-between h-[50px] border-b pr-12 pl-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Cloud Backend
          </h2>
        </div>

        {/* Centered content container with max-width */}
        <div className="flex-1 flex flex-col items-center overflow-hidden">
          <div className="w-full max-w-[800px] flex flex-col h-full p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Add a real-time database to your app
            </p>

            {cloudEnabled ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Cloud is enabled
                  </span>
                </div>

                {deploymentUrl && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Deployment URL</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-background px-2 py-1 rounded border flex-1 truncate">
                        {deploymentUrl}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => window.open(deploymentUrl.replace('.convex.cloud', '.convex.site'), '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowDashboard(true)}
                >
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Open Convex Dashboard
                </Button>

                <p className="text-sm text-muted-foreground">
                  Your app now has access to a real-time database. The AI will use Convex for all data persistence and backend logic.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enable cloud to add powerful backend capabilities to your app:
                </p>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Database className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium text-sm">Real-time Database</div>
                      <div className="text-xs text-muted-foreground">
                        Automatic sync across all devices. Data updates instantly everywhere.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium text-sm">Backend Functions</div>
                      <div className="text-xs text-muted-foreground">
                        Queries, mutations, and actions. The AI can create server-side logic.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <HardDrive className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium text-sm">File Storage</div>
                      <div className="text-xs text-muted-foreground">
                        Store and serve files directly from your backend.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Once enabled, the AI will automatically use the database for any features that need data persistence.
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleEnableCloud}
                  disabled={isEnabling || !projectId}
                >
                  {isEnabling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enabling Cloud...
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4 mr-2" />
                      Enable Cloud
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConvexDashboardModal
        open={showDashboard}
        onOpenChange={setShowDashboard}
        projectId={projectId}
      />

      <Dialog open={showSetupComplete} onOpenChange={setShowSetupComplete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Convex is Setup and Ready
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you want to add backend functionalities on top of the app, you need to make an extra prompt request to ask the agent to add the functionality to your current working app.
            </p>
            <div className="p-3 bg-muted/50 rounded-lg border">
              <p className="text-sm italic text-foreground">
                &ldquo;{CONVEX_SETUP_PROMPT}&rdquo;
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                onRequestChange?.(CONVEX_SETUP_PROMPT)
                setShowSetupComplete(false)
                onClose()
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              Request Change
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
