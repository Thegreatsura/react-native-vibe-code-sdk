'use client'

import type { Message } from 'ai'
import type React from 'react'
import { type ReactNode, useCallback, useState } from 'react'

export interface ImageAttachment {
  url: string
  contentType: string
  name: string
  size: number
}

export interface HoverSelectionData {
  elementId: string
  content: string
  className: string
  tagName: string
  timestamp: number
  path?: string
  dataAt?: string | null
  dataIn?: string | null
  dataIs?: string | null
}

export interface ChatPanelProps {
  messages: Message[]
  input: string
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void
  handleSubmit: (e: React.FormEvent) => void
  isLoading: boolean
  projectTitle?: string
  currentTemplate?: string
  status: 'streaming' | 'error' | 'submitted' | 'ready'
  sandboxId?: string | null
  pendingEditData?: { fileEdition: string; selectionData: any } | null
  projectId?: string
  userId?: string
  isRetrying?: boolean
  retryCount?: number
  isWaitingForFirstMessage?: boolean
  selectedModel: string
  onModelChange: (modelId: string) => void
  agentType?: 'claude-code' | 'opencode' | 'kimi-k2'
  onAgentTypeChange?: (agentType: 'claude-code' | 'opencode' | 'kimi-k2') => void
  imageAttachments?: ImageAttachment[]
  onImageAttachmentsChange?: (attachments: ImageAttachment[]) => void
  selectedSkills?: string[]
  onSelectedSkillsChange?: (skills: string[]) => void
  cloudEnabled?: boolean
  isCloudPanelOpen?: boolean
  onCloudPanelOpen?: () => void
  onCloudPanelClose?: () => void
  /** Whether remote control (mobile) is currently editing */
  isRemoteControlActive?: boolean
  /** Render function for messages container */
  renderMessages: (props: {
    messages: Message[]
    status: 'streaming' | 'error' | 'submitted' | 'ready'
    isLoading: boolean
    projectId?: string
    sandboxId?: string | null
    userId?: string
    onRestore?: (messageId: string) => Promise<void>
    restoringMessageId?: string | null
    isWaitingForFirstMessage?: boolean
  }) => ReactNode
  /** Render function for input */
  renderInput: (props: {
    input: string
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
    handleSubmit: (e: React.FormEvent) => void
    isLoading: boolean
    sandboxId?: string | null
    isHoverModeEnabled: boolean
    onToggleHoverMode: (enabled: boolean) => void
    onDisableHoverMode: () => void
    latestSelection?: HoverSelectionData | null
    selectedModel: string
    onModelChange: (modelId: string) => void
    agentType?: 'claude-code' | 'opencode' | 'kimi-k2'
    onAgentTypeChange?: (agentType: 'claude-code' | 'opencode' | 'kimi-k2') => void
    imageAttachments?: ImageAttachment[]
    onImageAttachmentsChange?: (attachments: ImageAttachment[]) => void
    selectedSkills?: string[]
    onSelectedSkillsChange?: (skills: string[]) => void
    cloudEnabled?: boolean
    isCloudPanelOpen?: boolean
    onCloudPanelOpen?: () => void
    onCloudPanelClose?: () => void
  }) => ReactNode
  /** Hook to get hover selection data */
  useHoverSelection?: (options: { sandboxId: string | null; enabled: boolean }) => {
    latestSelection: HoverSelectionData | null
    clearSelection: () => void
  }
}

export function ChatPanel({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  status,
  sandboxId,
  projectId,
  userId,
  isWaitingForFirstMessage,
  selectedModel,
  onModelChange,
  agentType,
  onAgentTypeChange,
  imageAttachments = [],
  onImageAttachmentsChange,
  selectedSkills = [],
  onSelectedSkillsChange,
  cloudEnabled = false,
  isCloudPanelOpen = false,
  onCloudPanelOpen,
  onCloudPanelClose,
  isRemoteControlActive = false,
  renderMessages,
  renderInput,
  useHoverSelection,
}: ChatPanelProps) {
  const [isHoverModeEnabled, setIsHoverModeEnabled] = useState(false)
  const [restoringMessageId, setRestoringMessageId] = useState<string | null>(null)

  // Use the hover selection hook if provided
  const hoverSelectionResult = useHoverSelection?.({
    sandboxId: sandboxId || null,
    enabled: isHoverModeEnabled,
  })
  const latestSelection = hoverSelectionResult?.latestSelection ?? null
  const clearSelection = hoverSelectionResult?.clearSelection ?? (() => {})

  // Combined function to disable hover mode and clear selection
  const handleDisableHoverMode = useCallback(async () => {
    setIsHoverModeEnabled(false)
    clearSelection()

    // Make API call to disable hover mode in sandbox
    if (sandboxId) {
      try {
        await fetch('/api/hover-mode-toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sandboxId,
            enabled: false,
          }),
        })
      } catch (error) {
        console.error('[ChatPanel] Failed to disable hover mode:', error)
      }
    }
  }, [clearSelection, sandboxId])

  // Handle restore button click
  const handleRestoreMessage = useCallback(async (messageId: string) => {
    if (!projectId || !sandboxId || !userId) {
      return
    }

    setRestoringMessageId(messageId)

    try {
      const response = await fetch('/api/git-restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          userID: userId,
          messageId,
          sandboxId,
        }),
      })

      await response.json()
    } catch (error) {
      console.error('[ChatPanel] Error during restore:', error)
    } finally {
      setRestoringMessageId(null)
    }
  }, [projectId, sandboxId, userId])

  return (
    <div className="flex flex-col border-r relative overflow-hidden h-full flex-1 min-h-0">

      {/* Remote Control overlay */}
      {isRemoteControlActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent mb-4" />
          <p className="text-sm font-medium text-foreground">Remote Control is editing the app</p>
        </div>
      )}

      {/* Messages Container with Conversation (use-stick-to-bottom) */}
      {renderMessages({
        messages,
        status,
        isLoading,
        projectId,
        sandboxId,
        userId,
        onRestore: handleRestoreMessage,
        restoringMessageId,
        isWaitingForFirstMessage,
      })}

      {/* Input Panel */}
      {renderInput({
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        sandboxId,
        isHoverModeEnabled,
        onToggleHoverMode: setIsHoverModeEnabled,
        onDisableHoverMode: handleDisableHoverMode,
        latestSelection,
        selectedModel,
        onModelChange,
        agentType,
        onAgentTypeChange,
        imageAttachments,
        onImageAttachmentsChange,
        selectedSkills,
        onSelectedSkillsChange,
        cloudEnabled,
        isCloudPanelOpen,
        onCloudPanelOpen,
        onCloudPanelClose,
      })}
    </div>
  )
}
