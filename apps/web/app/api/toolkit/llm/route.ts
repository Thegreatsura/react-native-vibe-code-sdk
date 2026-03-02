import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { CoreMessage } from 'ai'
import { getCorsHeaders, handleCorsOptions } from '@/lib/cors'

export const maxDuration = 60

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400, headers: getCorsHeaders(request) }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500, headers: getCorsHeaders(request) }
      )
    }

    const anthropic = createAnthropic({ apiKey })

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      messages: body.messages as CoreMessage[],
    })

    return NextResponse.json(
      { completion: text },
      { headers: getCorsHeaders(request) }
    )
  } catch (error: any) {
    console.error('[Toolkit LLM] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500, headers: getCorsHeaders(request) }
    )
  }
}
