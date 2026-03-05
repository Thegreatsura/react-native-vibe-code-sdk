/**
 * Translates OpenCode SSE events into SlimMessage JSON strings
 * that the existing chat UI already understands.
 *
 * OpenCode exposes an HTTP server with SSE event streaming.
 * Events arrive as `data: {...}` lines on the /event endpoint.
 */

import type {
  SlimSystemInit,
  SlimAssistantText,
  SlimToolUse,
  SlimToolResult,
  SlimResult,
  SlimMessage,
} from '@react-native-vibe-code/agent'

/** Raw SSE event payload from OpenCode */
export interface OpenCodeEvent {
  type: string
  properties?: Record<string, any>
  [key: string]: any
}

/**
 * Converts one OpenCode SSE event into zero or more SlimMessages.
 * Returns an array because some events don't map (empty array = skip).
 */
export function translateOpenCodeEvent(event: OpenCodeEvent): SlimMessage[] {
  switch (event.type) {
    case 'session.created':
    case 'session.updated': {
      const props = event.properties ?? event
      const init: SlimSystemInit = {
        type: 'system',
        subtype: 'init',
        model: props.model ?? '',
        cwd: props.cwd ?? '/home/user',
        tools: props.tools ?? [],
        session_id: props.id ?? props.sessionId ?? '',
      }
      return [init]
    }

    case 'message.created':
    case 'message.updated': {
      const props = event.properties ?? event
      const role = props.role ?? ''

      // Only translate assistant text messages
      if (role !== 'assistant') return []

      // Extract text content from parts array or direct content
      const parts: any[] = props.parts ?? []
      const results: SlimMessage[] = []

      for (const part of parts) {
        if (part.type === 'text' && part.content) {
          const text: SlimAssistantText = {
            type: 'assistant',
            subtype: 'text',
            text: part.content,
          }
          results.push(text)
        } else if (part.type === 'tool-invocation' || part.type === 'tool_use') {
          const toolUse: SlimToolUse = {
            type: 'assistant',
            subtype: 'tool_use',
            tool_name: part.toolName ?? part.name ?? 'unknown',
            file_path: part.args?.file_path ?? part.args?.path ?? undefined,
            command_preview: part.args?.command
              ? String(part.args.command).slice(0, 100)
              : undefined,
          }
          results.push(toolUse)
        }
      }

      // Fallback: if no parts but there's content string
      if (results.length === 0 && props.content && typeof props.content === 'string') {
        results.push({
          type: 'assistant',
          subtype: 'text',
          text: props.content,
        })
      }

      return results
    }

    case 'tool.started':
    case 'tool.invocation': {
      const props = event.properties ?? event
      const toolUse: SlimToolUse = {
        type: 'assistant',
        subtype: 'tool_use',
        tool_name: props.toolName ?? props.name ?? 'unknown',
        file_path: props.args?.file_path ?? props.args?.path ?? undefined,
        command_preview: props.args?.command
          ? String(props.args.command).slice(0, 100)
          : undefined,
      }
      return [toolUse]
    }

    case 'tool.completed':
    case 'tool.result': {
      const props = event.properties ?? event
      const toolResult: SlimToolResult = {
        type: 'user',
        subtype: 'tool_result',
        success: !props.isError && !props.is_error,
      }
      return [toolResult]
    }

    case 'session.completed':
    case 'session.finished': {
      const props = event.properties ?? event
      const result: SlimResult = {
        type: 'result',
        subtype: props.isError || props.is_error ? 'error' : 'success',
        is_error: props.isError ?? props.is_error ?? false,
        duration_ms: props.durationMs ?? props.duration_ms,
        total_cost_usd: props.totalCostUsd ?? props.total_cost_usd,
        session_id: props.id ?? props.sessionId,
        result: props.result ?? props.summary,
      }
      return [result]
    }

    // Events we don't need to translate
    case 'event.ping':
    case 'session.ping':
      return []

    default:
      // Unknown event — skip silently
      return []
  }
}

/**
 * Parses a raw SSE `data:` line into an OpenCodeEvent.
 * Returns null if the line is not a valid event.
 */
export function parseSSELine(line: string): OpenCodeEvent | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null

  const jsonStr = trimmed.slice(5).trim()
  if (!jsonStr) return null

  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}
