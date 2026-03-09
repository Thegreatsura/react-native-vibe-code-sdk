'use client'

import { Button } from '@react-native-vibe-code/ui/components/button'
import { cn } from '@react-native-vibe-code/ui/lib/utils'
import { ArrowUp, X, FileText, Mic, MicOff, Image as ImageIcon, Cloud } from 'lucide-react'
import type React from 'react'
import { useState, useEffect, useRef, memo, useCallback, type ReactNode } from 'react'
import { useAudioRecorder } from '../hooks/use-audio-recorder'

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

export interface ImageAttachment {
  url: string
  contentType: string
  name: string
  size: number
}

interface ChatRequestOptions {
  body?: Record<string, unknown>
  data?: Record<string, unknown>
  experimental_attachments?: ImageAttachment[]
}

export interface AISkill {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
}

export interface ChatPanelInputProps {
  input: string
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void
  handleSubmit: (e: React.FormEvent, options?: ChatRequestOptions) => void
  isLoading: boolean
  sandboxId?: string | null
  isHoverModeEnabled: boolean
  onToggleHoverMode: (enabled: boolean) => void
  onDisableHoverMode: () => void
  latestSelection?: HoverSelectionData | null
  onScrollToBottom?: () => void
  selectedModel: string
  onModelChange: (modelId: string) => void
  imageAttachments?: ImageAttachment[]
  onImageAttachmentsChange?: (attachments: ImageAttachment[]) => void
  selectedSkills?: string[]
  onSelectedSkillsChange?: (skills: string[]) => void
  cloudEnabled?: boolean
  isCloudPanelOpen?: boolean
  onCloudPanelOpen?: () => void
  onCloudPanelClose?: () => void
  /** Render function for the editor */
  renderEditor: (props: {
    placeholder: string
    disabled: boolean
    onContentChange: (text: string, skills: AISkill[]) => void
    onSubmit: () => void
    className?: string
    ref?: React.RefObject<any>
  }) => ReactNode
  /** Render function for the model selector */
  renderModelSelector: (props: {
    value: string
    onChange: (modelId: string) => void
    disabled: boolean
    compact?: boolean
  }) => ReactNode
  /** Render function for edit button */
  renderEditButton?: (props: {
    isLoading: boolean
    sandboxId?: string | null
    isHoverModeEnabled: boolean
    onToggleHoverMode: (enabled: boolean) => void
  }) => ReactNode
  /** Custom transcription function - if not provided, uses /api/transcribe */
  transcribeAudio?: (audioBlob: Blob) => Promise<string>
  /** Custom image upload function - if not provided, uses /api/upload-image */
  uploadImage?: (file: File) => Promise<ImageAttachment>
  /** Use realtime voice (Deepgram) vs Whisper transcription */
  useRealtimeVoice?: boolean
  /** Recording sound URL */
  recordingSoundUrl?: string
  /** Device detection function */
  isMobileDevice?: () => boolean
}

export const ChatPanelInput = memo(function ChatPanelInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  sandboxId,
  isHoverModeEnabled,
  onToggleHoverMode,
  onDisableHoverMode,
  latestSelection,
  onScrollToBottom,
  selectedModel,
  onModelChange,
  imageAttachments = [],
  onImageAttachmentsChange,
  selectedSkills = [],
  onSelectedSkillsChange,
  cloudEnabled = false,
  isCloudPanelOpen = false,
  onCloudPanelOpen,
  onCloudPanelClose,
  renderEditor,
  renderModelSelector,
  renderEditButton,
  transcribeAudio: customTranscribe,
  uploadImage: customUploadImage,
  useRealtimeVoice = false,
  recordingSoundUrl = 'https://etq42zw2k4.ufs.sh/f/Ygf2KSyPE9xcc8MKS2xOv0clTFLAMPxRXIetKY3VjanB6wEr',
  isMobileDevice,
}: ChatPanelInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<any>(null)

  const baseInputRef = useRef<string>('')
  const recordSoundRef = useRef<HTMLAudioElement | null>(null)

  // Audio recorder for Whisper transcription
  const audioRecorder = useAudioRecorder()

  // Transcribe audio using provided function or default API
  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    if (customTranscribe) {
      return customTranscribe(audioBlob)
    }

    try {
      setIsTranscribing(true)

      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || 'Failed to transcribe audio'
        throw new Error(errorMessage)
      }

      const { text } = await response.json()
      return text
    } catch (error) {
      console.error('Transcription error:', error)
      throw error
    } finally {
      setIsTranscribing(false)
    }
  }

  // Handle file input change - upload to blob storage
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))

    if (imageFiles.length === 0) return

    setIsUploadingImages(true)

    try {
      const uploadPromises = imageFiles.map(async (file) => {
        if (customUploadImage) {
          return customUploadImage(file)
        }

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        return await response.json() as ImageAttachment
      })

      const newAttachments = await Promise.all(uploadPromises)

      if (onImageAttachmentsChange) {
        onImageAttachmentsChange([...imageAttachments, ...newAttachments])
      }
    } catch (error) {
      console.error('Error uploading images:', error)
      alert('Failed to upload one or more images. Please try again.')
    } finally {
      setIsUploadingImages(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Remove an image attachment
  const handleRemoveImage = (index: number) => {
    if (onImageAttachmentsChange) {
      onImageAttachmentsChange(imageAttachments.filter((_, i) => i !== index))
    }
  }

  useEffect(() => {
    // Detect if we're on mobile
    setIsMobile(isMobileDevice?.() ?? false)

    // Preload the recording sound
    const audio = new Audio(recordingSoundUrl)
    audio.volume = 0.5
    audio.preload = 'auto'
    recordSoundRef.current = audio
    audio.load()
  }, [isMobileDevice, recordingSoundUrl])

  const toggleRecording = useCallback(async () => {
    if (!isRecording) {
      try {
        // Store the current input when starting recording
        baseInputRef.current = input

        // Play preloaded sound when starting to record
        if (recordSoundRef.current) {
          recordSoundRef.current.currentTime = 0
          recordSoundRef.current.play().catch(err => console.error('Audio play failed:', err))
        }

        await audioRecorder.startRecording()
        setIsRecording(true)
      } catch (err) {
        console.error('Failed to start audio recording:', err)
      }
    } else {
      try {
        const audioBlob = await audioRecorder.stopRecording()
        setIsRecording(false)

        if (audioBlob) {
          try {
            const transcription = await transcribeAudio(audioBlob)
            if (transcription) {
              const fullText = baseInputRef.current + (baseInputRef.current ? ' ' : '') + transcription
              if (editorRef.current?.setContent) {
                editorRef.current.setContent(fullText)
              } else {
                const event = {
                  target: { value: fullText },
                } as React.ChangeEvent<HTMLTextAreaElement>
                handleInputChange(event)
              }
            }
          } catch (transcriptionError: any) {
            const errorMessage = transcriptionError.message || 'Failed to transcribe audio'
            alert(`Transcription failed: ${errorMessage}\n\nPlease try recording a shorter message.`)
          }
        }

        audioRecorder.resetRecording()
      } catch (err) {
        console.error('Failed to stop recording:', err)
        setIsRecording(false)
        audioRecorder.resetRecording()
      }
    }
  }, [isRecording, input, handleInputChange, audioRecorder])

  // Create file edition reference from selection data
  const getFileEditionRef = () => {
    if (!latestSelection) return null

    if (latestSelection.dataAt) {
      return latestSelection.dataAt
    }

    const filename = latestSelection.path || `${latestSelection.tagName}.tsx`
    return `${filename}:${latestSelection.elementId}`
  }

  // Enhanced submit handler that includes file edition metadata
  const enhancedHandleSubmit = (e: React.FormEvent) => {
    // Stop recording if currently recording
    if (isRecording) {
      setIsRecording(false)
    }

    const options: ChatRequestOptions = {}

    // Pass file edition and selection data via body
    if (latestSelection) {
      const fileEditionRef = getFileEditionRef()
      options.body = {
        fileEdition: fileEditionRef,
        selectionData: latestSelection,
      }
    }

    // Pass selected skills via body
    if (selectedSkills.length > 0) {
      options.body = {
        ...options.body,
        skills: selectedSkills,
      }
    }

    const attachmentsToSend = imageAttachments.length > 0 ? [...imageAttachments] : []

    if (attachmentsToSend.length > 0) {
      options.experimental_attachments = attachmentsToSend
      options.data = {
        imageAttachments: attachmentsToSend,
      }
    }

    handleSubmit(e, Object.keys(options).length > 0 ? options : undefined)

    // Clear the editor content
    editorRef.current?.clearContent?.()

    // Clear image attachments immediately on submit
    if (attachmentsToSend.length > 0 && onImageAttachmentsChange) {
      onImageAttachmentsChange([])
    }

    // Clear skills after submit
    if (selectedSkills.length > 0 && onSelectedSkillsChange) {
      onSelectedSkillsChange([])
    }

    onScrollToBottom?.()

    // Toggle hover mode off after submitting an edit message
    if (latestSelection) {
      onDisableHoverMode()
    }
  }

  return (
    <div className="p-4 border-t bg-background flex-shrink-0 md:relative md:pb-4 min-h-[214px] md:min-h-0 absolute">
      {/* Show selection indicator when element is selected */}
      {latestSelection && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div className="text-sm">
                <div className="font-medium text-blue-800 dark:text-blue-200">
                  Selected: {latestSelection.tagName}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDisableHoverMode}
              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          {latestSelection.className && (
            <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
              Classes: {latestSelection.className}
            </div>
          )}
        </div>
      )}

      <form onSubmit={enhancedHandleSubmit} className="flex flex-col space-y-2">
        {/* Hidden file input for image uploads */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          accept="image/*"
          multiple
          className="hidden"
        />

        {/* Image attachments preview */}
        {imageAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {imageAttachments.map((attachment, index) => (
              <div
                key={`${attachment.url}-${index}`}
                className="relative group"
              >
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="h-16 w-16 object-cover rounded-md border border-border"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {isUploadingImages && (
              <div className="h-16 w-16 rounded-md border border-border flex items-center justify-center bg-muted">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        )}

        {/* Textarea wrapper */}
        <div className="relative">
          <div
            className="w-full min-h-[4.5rem] max-h-[80px] overflow-y-auto border border-input bg-background rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background"
            onClick={() => editorRef.current?.focus?.()}
          >
            <div className="flex flex-wrap items-start gap-1.5 p-3">
              <div className="flex-1 min-w-[200px]">
                {renderEditor({
                  ref: editorRef,
                  placeholder:
                    latestSelection
                      ? 'Describe changes for the selected element...'
                      : isRecording
                      ? useRealtimeVoice
                        ? 'Live transcription active...'
                        : 'Recording...'
                      : isTranscribing
                      ? 'Transcribing...'
                      : selectedSkills.length > 0
                      ? 'Describe what you want to build...'
                      : 'Make changes, add new features, type / for integrations...',
                  disabled: isLoading,
                  onContentChange: (text, skills) => {
                    const event = {
                      target: { value: text },
                    } as React.ChangeEvent<HTMLTextAreaElement>
                    handleInputChange(event)

                    if (onSelectedSkillsChange) {
                      const skillIds = skills.map(s => s.id)
                      if (JSON.stringify(skillIds) !== JSON.stringify(selectedSkills)) {
                        onSelectedSkillsChange(skillIds)
                      }
                    }
                  },
                  onSubmit: () => {
                    if (!isLoading && (input?.trim() || imageAttachments.length > 0 || selectedSkills.length > 0)) {
                      const syntheticEvent = new Event('submit', {
                        bubbles: true,
                        cancelable: true,
                      }) as any
                      syntheticEvent.preventDefault = () => {}
                      enhancedHandleSubmit(syntheticEvent)
                    }
                  },
                  className: 'min-h-[3rem]',
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between gap-x-2">
          <div className="flex items-center gap-x-2">
            {renderEditButton?.({
              isLoading,
              sandboxId,
              isHoverModeEnabled,
              onToggleHoverMode,
            })}
            {renderModelSelector({
              value: selectedModel,
              onChange: onModelChange,
              disabled: isLoading || isTranscribing,
              compact: true,
            })}
          </div>
          <div className="flex space-x-2">
            {/* Image attachment button */}
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploadingImages}
              size="icon"
              variant="outline"
              className="rounded-xl h-10 w-10"
              title="Attach images"
            >
              {isUploadingImages ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <ImageIcon className="h-5 w-5" />
              )}
            </Button>
            {/* Voice recording button */}
            <Button
              type="button"
              onClick={toggleRecording}
              disabled={isTranscribing || (isLoading && useRealtimeVoice)}
              size="icon"
              variant={isRecording ? "destructive" : "outline"}
              className="rounded-xl h-10 w-10"
              title={
                isTranscribing
                  ? "Transcribing audio..."
                  : isRecording
                  ? "Stop recording"
                  : useRealtimeVoice
                  ? "Start live transcription (Deepgram)"
                  : "Record audio"
              }
            >
              {isTranscribing ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : isRecording ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || (!input?.trim() && imageAttachments.length === 0 && selectedSkills.length === 0)}
              size="icon"
              className="rounded-xl h-10 w-10"
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          </div>
        </div>
        {/* Cloud row - new bottom row */}
        <div className="relative flex items-center gap-x-2 pt-2 border-t border-border/50">
          {/* Invisible overlay when panel is open - clicking it dismisses the panel */}
          {isCloudPanelOpen && (
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={onCloudPanelClose}
            />
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCloudPanelOpen}
            className={cn(
              "flex-col items-center justify-center w-[65px] h-[60px]",
              cloudEnabled
                ? "bg-green-500/20 text-green-500 hover:bg-green-500/30 hover:text-green-400 border border-green-500/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Cloud className="h-5 w-5" />
            <span>Cloud</span>
          </Button>
        </div>
      </form>
    </div>
  )
})
