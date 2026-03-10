/**
 * Integrations Configuration
 *
 * This file serves as the single source of truth for all integrations.
 * It ensures that integration definitions (frontend) and templates (backend) stay in sync.
 *
 * IMPORTANT: When adding a new integration:
 * 1. Add the integration definition to INTEGRATIONS below
 * 2. Create the corresponding template in templates/{integration-id}.ts
 * 3. Import and register the template in templates/index.ts
 */

import {
  MessageSquare,
  Image,
  Mic,
  Brain,
  Search,
  Users
} from 'lucide-react'
import type { IntegrationConfig } from './types'

/**
 * All available integrations with their metadata
 * This is the canonical list - both frontend and backend derive from this
 */
export const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'anthropic-chat',
    name: 'AI APP (Claude)',
    description: 'Create AI apps that uses Claude text generation',
    icon: MessageSquare,
    iconName: 'MessageSquare',
    category: 'ai',
    endpoint: '/api/toolkit/llm',
    requiredEnvVar: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'openai-dalle-3',
    name: 'Image Generation (DALL-E 3)',
    description: 'Add AI image generation with DALL-E 3',
    icon: Image,
    iconName: 'Image',
    category: 'media',
    endpoint: '/api/toolkit/images',
    requiredEnvVar: 'OPENAI_API_KEY',
  },
  {
    id: 'openai-whisper',
    name: 'Speech to Text (Whisper)',
    description: 'Add voice transcription with Whisper',
    icon: Mic,
    iconName: 'Mic',
    category: 'media',
    endpoint: '/api/toolkit/stt',
    requiredEnvVar: 'OPENAI_API_KEY',
  },
  {
    id: 'openai-o3',
    name: 'Advanced Reasoning (O3)',
    description: 'Add OpenAI O3 reasoning model',
    icon: Brain,
    iconName: 'Brain',
    category: 'ai',
    endpoint: '/api/toolkit/llm',
    requiredEnvVar: 'OPENAI_API_KEY',
  },
  {
    id: 'google-search',
    name: 'Google Search',
    description: 'Add web search capabilities',
    icon: Search,
    iconName: 'Search',
    category: 'search',
    endpoint: '/api/toolkit/search',
    requiredEnvVar: 'SERP_API_KEY',
  },
  {
    id: 'exa-people-search',
    name: 'Exa People Search',
    description: 'Search for people profiles using Exa',
    icon: Users,
    iconName: 'Users',
    category: 'search',
    endpoint: '/api/toolkit/exa-search',
    requiredEnvVar: 'EXA_API_KEY',
  },
]

/**
 * Map of integration IDs for quick lookup
 * Use this to validate integration IDs at runtime
 */
export const INTEGRATION_ID_MAP = new Set(INTEGRATIONS.map(i => i.id))

/**
 * Validate that an integration ID exists in the configuration
 */
export function isValidIntegrationId(id: string): boolean {
  return INTEGRATION_ID_MAP.has(id)
}

/**
 * Get integration config by ID
 */
export function getIntegration(id: string): IntegrationConfig | undefined {
  return INTEGRATIONS.find(i => i.id === id)
}

/**
 * Get multiple integration configs by IDs
 */
export function getIntegrations(ids: string[]): IntegrationConfig[] {
  return ids
    .map(id => getIntegration(id))
    .filter((i): i is IntegrationConfig => i !== undefined)
}

/**
 * Get integrations by category
 */
export function getIntegrationsByCategory(category: IntegrationConfig['category']): IntegrationConfig[] {
  return INTEGRATIONS.filter(i => i.category === category)
}

/**
 * Validate that all integration IDs are valid
 * Returns an array of invalid IDs
 */
export function validateIntegrationIds(ids: string[]): string[] {
  return ids.filter(id => !isValidIntegrationId(id))
}

// Legacy exports for backwards compatibility
export const SKILL_CONFIGS = INTEGRATIONS
export const SKILL_ID_MAP = INTEGRATION_ID_MAP
export const isValidSkillId = isValidIntegrationId
export const getSkillConfig = getIntegration
export const getSkillConfigs = getIntegrations
export const validateSkillIds = validateIntegrationIds
