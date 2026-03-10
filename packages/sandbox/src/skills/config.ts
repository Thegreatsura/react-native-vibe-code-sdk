/**
 * Shared Skill Configuration
 *
 * This file serves as the single source of truth for all skills.
 * It ensures that skill definitions (frontend) and templates (backend) stay in sync.
 *
 * IMPORTANT: When adding a new skill:
 * 1. Add the skill definition to SKILL_CONFIGS below
 * 2. Create the corresponding template in lib/skills/templates/{skillId}.ts
 * 3. Import and register the template in lib/skills/templates/index.ts
 */

import type { LucideIcon } from 'lucide-react'
import {
  MessageSquare,
  Image,
  Mic,
  Brain,
  Search,
  Users
} from 'lucide-react'

export interface SkillConfig {
  /** Unique identifier used in code and file paths (kebab-case) */
  id: string
  /** Display name shown in UI */
  name: string
  /** Description shown in skill picker */
  description: string
  /** Lucide icon component */
  icon: LucideIcon
  /** Icon name for serialization */
  iconName: string
}

/**
 * All available skills with their metadata
 * This is the canonical list - both frontend and backend derive from this
 */
export const SKILL_CONFIGS: SkillConfig[] = [
  {
    id: 'anthropic-chat',
    name: 'AI APP (Claude)',
    description: 'Create AI apps that uses Claude text generation',
    icon: MessageSquare,
    iconName: 'MessageSquare',
  },
  {
    id: 'openai-dalle-3',
    name: 'Image Generation (DALL-E 3)',
    description: 'Add AI image generation with DALL-E 3',
    icon: Image,
    iconName: 'Image',
  },
  {
    id: 'openai-whisper',
    name: 'Speech to Text (Whisper)',
    description: 'Add voice transcription with Whisper',
    icon: Mic,
    iconName: 'Mic',
  },
  {
    id: 'openai-o3',
    name: 'Advanced Reasoning (O3)',
    description: 'Add OpenAI O3 reasoning model',
    icon: Brain,
    iconName: 'Brain',
  },
  {
    id: 'google-search',
    name: 'Google Search',
    description: 'Add web search capabilities',
    icon: Search,
    iconName: 'Search',
  },
  {
    id: 'exa-people-search',
    name: 'Exa People Search',
    description: 'Search for people profiles using Exa',
    icon: Users,
    iconName: 'Users',
  },
]

/**
 * Map of skill IDs for quick lookup
 * Use this to validate skill IDs at runtime
 */
export const SKILL_ID_MAP = new Set(SKILL_CONFIGS.map(s => s.id))

/**
 * Validate that a skill ID exists in the configuration
 */
export function isValidSkillId(id: string): boolean {
  return SKILL_ID_MAP.has(id)
}

/**
 * Get skill config by ID
 */
export function getSkillConfig(id: string): SkillConfig | undefined {
  return SKILL_CONFIGS.find(s => s.id === id)
}

/**
 * Get multiple skill configs by IDs
 */
export function getSkillConfigs(ids: string[]): SkillConfig[] {
  return ids
    .map(id => getSkillConfig(id))
    .filter((s): s is SkillConfig => s !== undefined)
}

/**
 * Validate that all skill IDs are valid
 * Returns an array of invalid IDs
 */
export function validateSkillIds(ids: string[]): string[] {
  return ids.filter(id => !isValidSkillId(id))
}
