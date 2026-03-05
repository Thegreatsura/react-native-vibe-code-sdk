import { useLocalStorage } from './use-local-storage'
import {
  AGENT_TYPE_STORAGE_KEY,
  getDefaultModelForAgent,
  type AgentType,
} from '@/lib/claude-models'

/**
 * Hook to manage agent type selection with localStorage persistence.
 * When agent type changes, returns the default model for that agent.
 */
export function useAgentType() {
  const [agentType, setAgentType] = useLocalStorage<AgentType>(
    AGENT_TYPE_STORAGE_KEY,
    'claude-code',
  )

  return {
    agentType,
    setAgentType,
    getDefaultModelForAgent,
  }
}
