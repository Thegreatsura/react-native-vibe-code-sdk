'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getClaudeModelById,
  getModelsForAgent,
  type AgentType,
} from '@/lib/claude-models'
import { Cpu, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClaudeModelSelectorProps {
  value: string
  onChange: (modelId: string) => void
  disabled?: boolean
  compact?: boolean
  agentType?: AgentType
  onAgentTypeChange?: (agentType: AgentType) => void
}

export function ClaudeModelSelector({
  value,
  onChange,
  disabled = false,
  compact = false,
  agentType = 'claude-code',
  onAgentTypeChange,
}: ClaudeModelSelectorProps) {
  const models = getModelsForAgent(agentType)
  const currentModel = getClaudeModelById(value)

  return (
    <div className="flex items-center gap-1.5">
      {/* Agent type toggle */}
      {onAgentTypeChange && (
        <Select
          value={agentType}
          onValueChange={(v) => onAgentTypeChange(v as AgentType)}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn(
              compact
                ? 'h-10 border border-input text-xs border-gray-200 bg-background shadow-sm hover:bg-accent hover:text-accent-foreground w-auto'
                : 'h-12 w-[160px]'
            )}
          >
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Agent">
                {agentType === 'opencode' ? 'OpenCode' : 'Claude Code'}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claude-code">
              <div className="flex flex-col">
                <span className="font-medium">Claude Code</span>
                <span className="text-xs text-muted-foreground">
                  Anthropic&apos;s agent SDK
                </span>
              </div>
            </SelectItem>
            <SelectItem value="opencode">
              <div className="flex flex-col">
                <span className="font-medium">OpenCode</span>
                <span className="text-xs text-muted-foreground">
                  Open-source coding agent
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Model selector */}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          className={cn(
            compact
              ? 'h-10 border border-input text-xs border-gray-200 bg-background shadow-sm hover:bg-accent hover:text-accent-foreground'
              : 'h-12 w-[200px]'
          )}
        >
          <div className="flex items-center gap-2 ">
            <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Select model">
              {currentModel?.name || 'Select model'}
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex flex-col">
                <span className="font-medium">{model.name}</span>
                <span className="text-xs text-muted-foreground">
                  {model.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
