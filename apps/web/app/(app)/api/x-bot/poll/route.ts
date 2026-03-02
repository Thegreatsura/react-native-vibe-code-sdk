import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { xBotState } from '@react-native-vibe-code/database'
import { eq } from 'drizzle-orm'
import { getAuthClient, processMention } from '@/lib/x-bot/process-mention'

const YOUR_USER_ID = '1832518730582020097'

async function getLastTweetId(): Promise<string | null> {
  const rows = await db
    .select()
    .from(xBotState)
    .where(eq(xBotState.id, 'default'))
    .limit(1)
  return rows[0]?.lastTweetId || null
}

async function setLastTweetId(tweetId: string): Promise<void> {
  const existing = await db
    .select()
    .from(xBotState)
    .where(eq(xBotState.id, 'default'))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(xBotState).values({
      id: 'default',
      lastTweetId: tweetId,
      updatedAt: new Date(),
    })
  } else {
    await db
      .update(xBotState)
      .set({ lastTweetId: tweetId, updatedAt: new Date() })
      .where(eq(xBotState.id, 'default'))
  }
}

export async function GET(request: NextRequest) {
  // TODO: Re-enable cron secret auth after confirming CRON_SECRET env var is deployed
  // const authHeader = request.headers.get('authorization')
  // const cronSecret = process.env.CRON_SECRET
  // if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  try {
    const client = await getAuthClient()
    const sinceId = await getLastTweetId()

    console.log(`[X-Bot Poll] Polling mentions since_id=${sinceId || 'none'}`)

    // Fetch mentions using X API v2
    const params: Record<string, any> = {
      'tweet.fields': ['author_id', 'created_at', 'text', 'attachments', 'referenced_tweets'],
      'media.fields': ['url', 'type', 'media_key', 'preview_image_url'],
      expansions: ['attachments.media_keys', 'author_id', 'referenced_tweets.id'],
      'user.fields': ['id', 'username'],
      max_results: 20,
    }
    if (sinceId) {
      params.since_id = sinceId
    }

    const mentionsResponse = await client.tweets.usersIdMentions(YOUR_USER_ID, params)

    const mentions = mentionsResponse.data || []

    if (mentions.length === 0) {
      console.log('[X-Bot Poll] No new mentions')
      return NextResponse.json({ ok: true, processed: 0 })
    }

    console.log(`[X-Bot Poll] Found ${mentions.length} new mentions`)

    const mediaIncludes = mentionsResponse.includes?.media || []
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://reactnativevibecode.com'

    const results: Array<{ tweetId: string; action: string }> = []

    // Process mentions oldest-first so we update sinceId progressively
    const sortedMentions = [...mentions].reverse()

    for (const tweet of sortedMentions) {
      const tweetId = tweet.id
      const text = tweet.text || ''
      const authorId = tweet.author_id || ''

      if (!tweetId || !authorId) continue

      // Extract media URLs from v2 format
      const mediaKeys = tweet.attachments?.media_keys || []
      const mediaUrls: string[] = []
      for (const key of mediaKeys) {
        const media = mediaIncludes.find((m: any) => m.media_key === key)
        if (media && media.type === 'photo' && media.url) {
          mediaUrls.push(media.url)
        }
      }

      // Check if this mention is a reply to another tweet
      let parentTweetText: string | undefined
      let parentMediaUrls: string[] | undefined
      let parentAuthorId: string | undefined

      const repliedToRef = (tweet as any).referenced_tweets?.find(
        (ref: any) => ref.type === 'replied_to'
      )

      if (repliedToRef) {
        console.log(`[X-Bot Poll] Mention ${tweetId} is a reply to ${repliedToRef.id}, fetching parent tweet...`)
        try {
          const parentTweet = await client.tweets.findTweetById(repliedToRef.id, {
            'tweet.fields': ['author_id', 'text', 'attachments'],
            'media.fields': ['url', 'type', 'media_key', 'preview_image_url'],
            expansions: ['attachments.media_keys'],
          })

          if (parentTweet.data) {
            parentTweetText = parentTweet.data.text || undefined
            parentAuthorId = parentTweet.data.author_id || undefined

            // Extract parent tweet media
            const parentMediaKeys = parentTweet.data.attachments?.media_keys || []
            const parentMediaIncludes = parentTweet.includes?.media || []
            if (parentMediaKeys.length > 0) {
              parentMediaUrls = []
              for (const key of parentMediaKeys) {
                const media = parentMediaIncludes.find((m: any) => m.media_key === key)
                if (media && media.type === 'photo' && media.url) {
                  parentMediaUrls.push(media.url)
                }
              }
            }

            console.log(`[X-Bot Poll] Parent tweet text: "${parentTweetText?.substring(0, 50)}..."`)
            console.log(`[X-Bot Poll] Parent tweet images: ${parentMediaUrls?.length || 0}`)
          }
        } catch (error) {
          console.error(`[X-Bot Poll] Failed to fetch parent tweet ${repliedToRef.id}:`, error)
          // Continue without parent context — non-blocking
        }
      }

      console.log(`[X-Bot Poll] Processing mention ${tweetId}: "${text.substring(0, 50)}..."`)

      const result = await processMention(
        { tweetId, text, authorId, mediaUrls, parentTweetText, parentMediaUrls, parentAuthorId },
        client,
        baseUrl
      )

      results.push({ tweetId, action: result.action })

      // Update sinceId after each successful processing
      await setLastTweetId(tweetId)
    }

    return NextResponse.json({ ok: true, processed: results.length, results })
  } catch (error: any) {
    console.error('[X-Bot Poll] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Poll failed' },
      { status: 500 }
    )
  }
}
