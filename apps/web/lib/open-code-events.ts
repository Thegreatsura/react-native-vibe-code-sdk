/**
 * Translates OpenCode SSE events into SlimMessage JSON strings
 * that the existing chat UI already understands.
 *
 * OpenCode exposes SSE streams at GET /global/event and GET /event.
 * Events arrive as `data: {...}` lines with `type` and `properties` fields.
 *
 * Actual SSE event types from the OpenCode OpenAPI spec:
 *   message.updated    — message content changed (text, tool invocations)
 *   session.status     — session state change
 *   session.idle       — session done processing (completion signal)
 *   file.edited        — a file was modified
 *   permission.asked   — AI needs tool permission
 *   permission.replied — permission granted/denied
 *   todo.updated       — todo list changed
 *   server.connected   — SSE connection established
 */

import type {
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
  const props = event.properties ?? event

  switch (event.type) {
    case 'message.updated': {
      return translateMessageUpdated(props)
    }

    case 'session.idle': {
      const result: SlimResult = {
        type: 'result',
        subtype: 'success',
        is_error: false,
        session_id: props.sessionID ?? props.id,
      }
      return [result]
    }

    case 'session.status': {
      // session.status fires when session state changes
      // Properties may include status like "error", "idle", "busy"
      const status = props.status ?? props.state ?? ''
      if (status === 'error') {
        const result: SlimResult = {
          type: 'result',
          subtype: 'error',
          is_error: true,
          session_id: props.sessionID ?? props.id,
          result: props.error ?? props.message ?? 'Session error',
        }
        return [result]
      }
      return []
    }

    case 'file.edited': {
      // File was modified by OpenCode — show as tool use
      const filePath = props.path ?? props.file ?? ''
      if (!filePath) return []
      const toolUse: SlimToolUse = {
        type: 'assistant',
        subtype: 'tool_use',
        tool_name: 'Write',
        file_path: filePath,
      }
      return [toolUse]
    }

    case 'permission.asked': {
      // Permission request — log for debugging but don't show in UI
      console.log('[OpenCode Events] Permission requested:', props.tool ?? props.name, '— should be auto-approved by config')
      return []
    }

    // Events we silently skip
    case 'server.connected':
    case 'server.heartbeat':
    case 'server.instance.disposed':
    case 'global.disposed':
    case 'installation.updated':
    case 'installation.update-available':
    case 'project.updated':
    case 'workspace.ready':
    case 'workspace.failed':
    case 'worktree.ready':
    case 'worktree.failed':
    case 'file.watcher.updated':
    case 'permission.replied':
    case 'question.asked':
    case 'question.replied':
    case 'question.rejected':
    case 'message.removed':
    case 'todo.updated':
    case 'pty.created':
    case 'pty.updated':
    case 'pty.exited':
    case 'pty.deleted':
    case 'mcp.tools.changed':
    case 'mcp.browser.open.failed':
    case 'lsp.updated':
    case 'lsp.client.diagnostics':
    case 'vcs.branch.updated':
    case 'command.executed':
    case 'tui.prompt.append':
    case 'tui.command.execute':
    case 'tui.toast.show':
    case 'tui.session.select':
    case 'session.deleted':
      return []

    default:
      console.log('[OpenCode Events] Unknown event type:', event.type)
      return []
  }
}

/**
 * Translates a message.updated event into SlimMessages.
 * The properties may contain the message directly or nested under info/parts.
 */
function translateMessageUpdated(props: Record<string, any>): SlimMessage[] {
  const results: SlimMessage[] = []

  // The message role — only translate assistant messages
  const role = props.role ?? props.info?.role ?? ''
  if (role !== 'assistant') return []

  // Parts can be at props.parts or props.info.parts
  const parts: any[] = props.parts ?? props.info?.parts ?? []

  for (const part of parts) {
    const partType = part.type ?? ''

    if (partType === 'text') {
      const textContent = part.text ?? part.content ?? part.delta ?? ''
      if (textContent) {
        const text: SlimAssistantText = {
          type: 'assistant',
          subtype: 'text',
          text: textContent,
        }
        results.push(text)
      }
    } else if (partType === 'tool-invocation' || partType === 'tool_use') {
      results.push(translateToolInvocationPart(part))
    } else if (partType === 'tool-result' || partType === 'tool_result') {
      const toolResult: SlimToolResult = {
        type: 'user',
        subtype: 'tool_result',
        success: part.state?.status === 'completed' || (!part.isError && !part.is_error),
      }
      results.push(toolResult)
    }
  }

  // Fallback: if no parts, check for direct text/content
  if (results.length === 0) {
    const textContent = props.text ?? props.content
    if (textContent && typeof textContent === 'string') {
      results.push({
        type: 'assistant',
        subtype: 'text',
        text: textContent,
      })
    }
  }

  return results
}

/** Helper to translate a tool invocation part into a SlimToolUse */
function translateToolInvocationPart(part: any): SlimToolUse {
  const toolName = part.toolName ?? part.tool ?? part.name ?? 'unknown'
  const args = part.args ?? part.input ?? {}

  const toolUse: SlimToolUse = {
    type: 'assistant',
    subtype: 'tool_use',
    tool_name: toolName,
  }

  const filePath = args.file_path ?? args.path ?? args.filePath
  if (filePath) toolUse.file_path = filePath

  const command = args.command ?? args.cmd
  if (command) {
    toolUse.command_preview = String(command).slice(0, 100)
  }

  return toolUse
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
