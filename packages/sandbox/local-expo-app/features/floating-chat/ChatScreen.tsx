import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  InteractionManager,
} from 'react-native'
import { generateAPIUrl, projectFetch } from '@/features/floating-chat/lib/api'
import { ClaudeCodeMessage } from './components/ClaudeCodeMessage'
import { useChat } from '@ai-sdk/react'
import { RefreshCw, X } from 'lucide-react-native'

interface ChatScreenProps {
  projectId: string
  onClose: () => void
}

// Helper function to check if an error is retryable (network issues)
function isRetryableError(error: any): boolean {
  if (!error) return false

  const errorMessage = error.message?.toLowerCase() || ''
  const retryableErrors = [
    'network connection was lost',
    'network request failed',
    'connection lost',
    'timeout',
    'fetch failed',
    'network error',
    'connection refused',
    'socket hang up',
    'response body is empty',
  ]

  return retryableErrors.some(msg => errorMessage.includes(msg))
}

// Helper function to detect if message content is from Claude Code
function isClaudeCodeMessage(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false
  }

  return (
    content.includes('📝 Message') ||
    content.includes('Streaming:') ||
    content.includes('claude-sdk@') ||
    content.includes('Starting test script') ||
    content.includes('Claude Code query') ||
    content.includes('session_id') ||
    (content.includes('{') && content.includes('"type"')) ||
    content.includes('Query completed successfully')
  )
}

// Helper function to split Claude Code message content into individual parts
function splitClaudeCodeContent(content: string): string[] {
  if (!content || typeof content !== 'string') {
    return []
  }

  const parts = content
    .split(/(?=📝 Message \d+:)|(?=Streaming:)/)
    .filter((part) => part.trim())

  if (parts.length <= 1) {
    const lines = content.split('\n').filter((line) => line.trim())
    const messageParts: string[] = []
    let currentPart = ''

    for (const line of lines) {
      if (line.includes('{') && line.includes('"type"') && currentPart) {
        messageParts.push(currentPart.trim())
        currentPart = line
      } else {
        currentPart += (currentPart ? '\n' : '') + line
      }
    }

    if (currentPart) {
      messageParts.push(currentPart.trim())
    }

    return messageParts.length > 1 ? messageParts : [content]
  }

  return parts
}

export function ChatScreen({ projectId, onClose }: ChatScreenProps) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [displayError, setDisplayError] = useState<Error | null>(null)
  const hasFetchedForProjectRef = useRef<string | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const isNearBottomRef = useRef(true)
  const shouldAutoScrollRef = useRef(true)
  const pendingScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPendingScroll = useCallback(() => {
    if (pendingScrollTimeoutRef.current) {
      clearTimeout(pendingScrollTimeoutRef.current)
      pendingScrollTimeoutRef.current = null
    }
  }, [])

  const scrollToBottom = useCallback(
    ({ animated = false, delay = 0 }: { animated?: boolean; delay?: number } = {}) => {
      if (!flatListRef.current) return

      clearPendingScroll()

      const runScroll = () => {
        InteractionManager.runAfterInteractions(() => {
          flatListRef.current?.scrollToEnd({ animated })
        })
      }

      if (delay > 0) {
        pendingScrollTimeoutRef.current = setTimeout(runScroll, delay)
      } else {
        runScroll()
      }
    },
    [clearPendingScroll],
  )

  const {
    messages,
    error,
    isLoading,
    input,
    handleInputChange,
    handleSubmit,
    setMessages,
  } = useChat({
    id: projectId,
    experimental_throttle: 10,
    api: generateAPIUrl('/api/chat'),
    body: {
      projectId,
    },
    fetch: (input, init) => projectFetch(input, projectId, init),
    sendExtraMessageFields: true,
    keepLastMessageOnError: true,
    experimental_prepareRequestBody: ({ messages, requestData, requestBody }: any) => {
      const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()

      return {
        projectId: requestData?.body?.projectId || projectId,
        messages: lastUserMessage ? [lastUserMessage] : [],
      }
    },
    onError: error => {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current)
        sendTimeoutRef.current = null
      }

      if (!isRetryableError(error)) {
        console.error('[ChatScreen] Non-retryable error:', error?.message)
        setDisplayError(error)
      } else {
        console.log('[ChatScreen] Retryable error suppressed:', error?.message)
        setDisplayError(null)
      }
    },
    onResponse: () => {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current)
        sendTimeoutRef.current = null
      }
      setDisplayError(null)
    },
    onFinish: () => {
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current)
        sendTimeoutRef.current = null
      }
    },
  })

  // Load chat history once per project ID
  useEffect(() => {
    if (hasFetchedForProjectRef.current === projectId) return

    const loadChatHistory = async () => {
      // Mark as fetched immediately to prevent duplicate fetches
      hasFetchedForProjectRef.current = projectId
      setIsLoadingHistory(true)

      try {
        const url = generateAPIUrl('/api/chat/history')
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const response = await projectFetch(url, projectId, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            limit: 30,
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`Failed to load history: ${response.status}`)
        }

        const data = await response.json()

        if (data.messages && data.messages.length > 0) {
          console.log('[ChatScreen] Loaded', data.messages.length, 'messages')
          setMessages(data.messages)
        }
      } catch (error) {
        console.log('[ChatScreen] Error loading chat history:', error instanceof Error ? error.message : String(error))
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadChatHistory()
  }, [projectId, setMessages])

  // Scroll to bottom when messages update during streaming or if near bottom
  useEffect(() => {
    if (messages.length > 0 && (isLoading || shouldAutoScrollRef.current)) {
      scrollToBottom({ animated: false, delay: 100 })
    }
  }, [messages, isLoading, scrollToBottom])

  // Scroll to bottom after chat history loads
  useEffect(() => {
    if (!isLoadingHistory && messages.length > 0) {
      shouldAutoScrollRef.current = true
      isNearBottomRef.current = true
      scrollToBottom({ animated: false, delay: 400 })
    }
  }, [isLoadingHistory, messages.length, scrollToBottom])

  useEffect(() => {
    return () => {
      clearPendingScroll()
      if (sendTimeoutRef.current) {
        clearTimeout(sendTimeoutRef.current)
      }
    }
  }, [clearPendingScroll])

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
    const paddingToBottom = 100
    const isNearBottom = layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom

    isNearBottomRef.current = isNearBottom
    shouldAutoScrollRef.current = isNearBottom
  }

  const handleSend = () => {
    if (!input.trim() || isLoading) return

    shouldAutoScrollRef.current = true
    isNearBottomRef.current = true

    if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current)
    }

    const syntheticEvent = {
      preventDefault: () => {},
    } as React.FormEvent

    handleSubmit(syntheticEvent)

    // Safeguard: reset if stream doesn't complete within 60 seconds
    sendTimeoutRef.current = setTimeout(() => {
      console.log('[ChatScreen] Send timeout reached')
    }, 60000)
  }

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isUser = item.role === 'user'
    const content = item.content || ''
    const isClaudeCode = isClaudeCodeMessage(content)

    if (isClaudeCode && !isUser) {
      const messageParts = splitClaudeCodeContent(content)
      const isLastMessage = index === messages.length - 1

      return (
        <View style={styles.messageContainer}>
          {messageParts.map((part, partIndex) => {
            const isLastPart = partIndex === messageParts.length - 1
            const isLastCard = isLastMessage && isLastPart

            return (
              <ClaudeCodeMessage
                key={`${item.id}-part-${partIndex}`}
                content={part}
                isStreaming={isLoading}
                isLastCard={isLastCard}
              />
            )
          })}
        </View>
      )
    }

    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.assistantMessageText,
          ]}
        >
          {content}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Chat
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <X size={22} color="black" />
        </TouchableOpacity>
      </View>

      {/* Error display */}
      {displayError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{displayError.message}</Text>
        </View>
      )}

      {/* Loading history indicator */}
      {isLoadingHistory ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="black" />
          <Text style={styles.loadingText}>Loading chat history...</Text>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={400}
            onContentSizeChange={() => {
              if (isLoading || shouldAutoScrollRef.current) {
                scrollToBottom({ animated: false })
              }
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Start a conversation about your project
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Ask questions or request code changes
                </Text>
              </View>
            }
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={(text) => {
                  const event = {
                    target: { value: text },
                  } as React.ChangeEvent<HTMLInputElement>
                  handleInputChange(event)
                }}
                placeholder="Type a message to agent..."
                placeholderTextColor="#999"
                multiline
                maxLength={2000}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={handleSend}
                style={[
                  styles.sendButton,
                  (!input.trim() || isLoading) && styles.sendButtonDisabled,
                ]}
                disabled={!input.trim() || isLoading}
                activeOpacity={0.7}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#000',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    fontSize: 15,
    color: '#000',
  },
  sendButton: {
    backgroundColor: 'black',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 70,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
  },
})
