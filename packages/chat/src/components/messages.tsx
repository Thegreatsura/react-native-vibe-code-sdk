"use client";

import equal from "fast-deep-equal";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import type { Message } from "ai";
import { Conversation, ConversationContent, ConversationScrollButton } from "./conversation";
import { Skeleton } from "@react-native-vibe-code/ui/components/skeleton";
import { useStickToBottomContext } from "use-stick-to-bottom";

// Component that auto-scrolls during streaming (must be inside StickToBottom context)
const AutoScroller = ({
  status,
  messagesLength,
  lastMessageContent
}: {
  status: string;
  messagesLength: number;
  lastMessageContent: string;
}) => {
  const { scrollToBottom, isAtBottom } = useStickToBottomContext();
  const wasAtBottomRef = useRef(true);
  const prevContentLengthRef = useRef(0);

  useEffect(() => {
    // Track if user was at bottom before content changed
    wasAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  useEffect(() => {
    // During streaming, scroll to bottom if user was at bottom
    if (status === "streaming" || status === "submitted") {
      const contentLength = lastMessageContent?.length || 0;
      // Only scroll if content is growing (streaming) and user was at/near bottom
      if (contentLength > prevContentLengthRef.current && wasAtBottomRef.current) {
        scrollToBottom();
      }
      prevContentLengthRef.current = contentLength;
    }
  }, [status, lastMessageContent, scrollToBottom]);

  // Also scroll when new messages are added
  useEffect(() => {
    if (wasAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messagesLength, scrollToBottom]);

  return null;
};

export interface MessagesProps {
  messages: Message[];
  status: "streaming" | "error" | "submitted" | "ready";
  isLoading: boolean;
  projectId?: string;
  sandboxId?: string | null;
  userId?: string;
  onRestore?: (messageId: string) => Promise<void>;
  restoringMessageId?: string | null;
  isWaitingForFirstMessage?: boolean;
  /** Render function for each message */
  renderMessage: (props: {
    message: Message;
    isLoading: boolean;
    isLastMessage: boolean;
    status: "streaming" | "error" | "submitted" | "ready";
    projectId?: string;
    sandboxId?: string | null;
    userId?: string;
    onRestore?: (messageId: string) => Promise<void>;
    restoringMessageId?: string | null;
    hasAssistantResponse: boolean;
  }) => ReactNode;
  /** Optional loading skeleton component */
  loadingSkeleton?: ReactNode;
  /** Optional className for the content container */
  contentClassName?: string;
}

const PureMessages = ({
  messages,
  status,
  isLoading,
  projectId,
  sandboxId,
  userId,
  onRestore,
  restoringMessageId,
  isWaitingForFirstMessage,
  renderMessage,
  loadingSkeleton,
  contentClassName = "mx-auto flex min-w-0 max-w-4xl flex-col gap-3 md:gap-3 px-2 py-4 md:px-4",
}: MessagesProps) => {
  const [maxHeight, setMaxHeight] = useState<number>(0);

  useEffect(() => {
    const updateHeight = () => {
      setMaxHeight(window.innerHeight - 300);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const hasAssistantResponse = messages.some(m => m.role === "assistant");

  return (
    <div className="flex-1 flex flex-col min-h-0 ">
      <Conversation className="flex-1 overflow-y-auto min-h-0">
        <ConversationContent
          className={contentClassName}
          style={{ maxHeight: maxHeight > 0 ? `${maxHeight}px` : undefined }}
        >
          {/* Skeleton shown while waiting for first message to load */}
          {isWaitingForFirstMessage && messages.length === 0 && (
            loadingSkeleton || (
              <div className="flex justify-end">
                <Skeleton className="h-12 w-3/4 rounded-lg" />
              </div>
            )
          )}
          {messages.map((message, index) =>
            renderMessage({
              message,
              isLoading: isLoading && index === messages.length - 1,
              isLastMessage: index === messages.length - 1,
              status,
              projectId,
              sandboxId,
              userId,
              onRestore,
              restoringMessageId,
              hasAssistantResponse,
            })
          )}
        </ConversationContent>

        {/* Auto-scroll helper for streaming - must be inside Conversation context */}
        <AutoScroller
          status={status}
          messagesLength={messages.length}
          lastMessageContent={messages[messages.length - 1]?.content || ""}
        />
        {/* Scroll button must be inside Conversation to access context */}
        <ConversationScrollButton />
      </Conversation>
    </div>
  );
};

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  // Always re-render if status changes
  if (prevProps.status !== nextProps.status) {
    return false;
  }

  // Always re-render if loading state changes
  if (prevProps.isLoading !== nextProps.isLoading) {
    return false;
  }

  // Always re-render if message count changes
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }

  // Always re-render if restoring state changes
  if (prevProps.restoringMessageId !== nextProps.restoringMessageId) {
    return false;
  }

  // Always re-render if waiting for first message state changes
  if (prevProps.isWaitingForFirstMessage !== nextProps.isWaitingForFirstMessage) {
    return false;
  }

  // Deep equality check on messages
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }

  // If all checks pass, don't re-render
  return true;
});

Messages.displayName = "Messages";
