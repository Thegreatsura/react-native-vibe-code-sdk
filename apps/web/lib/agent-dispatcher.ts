import { handleClaudeCodeGeneration } from './claude-code-handler'
import { handleOpenCodeGeneration } from './open-code-handler'
import type { ClaudeCodeHandlerRequest, ClaudeCodeStreamCallbacks } from './claude-code-handler'

export type AgentType = 'claude-code' | 'opencode' | 'kimi-k2'

export interface AgentHandlerRequest extends ClaudeCodeHandlerRequest {
  agentType?: AgentType
}

/**
 * Routes generation requests to the correct agent handler
 * based on the agentType field.
 */
export async function dispatchToAgent(
  request: AgentHandlerRequest,
  callbacks: ClaudeCodeStreamCallbacks,
): Promise<void> {
  const agentType = request.agentType || 'claude-code'
  console.log(`[Agent Dispatcher] Dispatching to agent: ${agentType}`)

  if (agentType === 'opencode') {
    return handleOpenCodeGeneration(request, callbacks)
  }

  return handleClaudeCodeGeneration(request, callbacks)
}
