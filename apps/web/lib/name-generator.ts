// Title generator for app naming based on user's first message

import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

/**
 * Generate a short title from the first user message
 * The title will be used as the app name and slug
 */
export async function generateTitleFromUserMessage({
  message,
}: {
  message: { role: string; content: string }
}): Promise<string> {
  const userContent = typeof message.content === 'string' ? message.content : ''

  if (!userContent.trim()) {
    console.warn('[Name Generator] Empty message content, using fallback')
    return 'my-app'
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[Name Generator] ANTHROPIC_API_KEY is not set')
    return 'my-app'
  }

  try {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const { text: title } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: `Generate a short app name based on the user's message.
Rules:
- Maximum 3 words, max 40 characters
- Lowercase with hyphens instead of spaces (e.g., "weather-app")
- No quotes, colons, or special characters
- Be concise and descriptive
- Output ONLY the app name, nothing else`,
      prompt: userContent,
      maxTokens: 50,
      temperature: 0.7,
    })

    console.log('[Name Generator] Raw title from AI:', JSON.stringify(title))

    // Clean the title: lowercase, replace spaces with hyphens, remove special chars
    const cleanTitle = title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .substring(0, 50) // Limit length

    console.log('[Name Generator] Clean title:', cleanTitle)

    return cleanTitle || 'my-app'
  } catch (error) {
    console.error('[Name Generator] Error generating title:', error instanceof Error ? error.message : error)
    // Fallback title
    return 'my-app'
  }
}
