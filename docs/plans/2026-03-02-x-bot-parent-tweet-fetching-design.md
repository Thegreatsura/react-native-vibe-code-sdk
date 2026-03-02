# X Bot: Parent Tweet Fetching for Reply Mentions

## Problem

When a user replies to someone else's tweet with `@rnvibecode create this app`, the bot only sees the reply text and images — not the parent tweet's content. This means design screenshots or app descriptions in the parent tweet are lost.

## Solution

Fetch the immediate parent tweet when a mention is a reply, and include its text and images in the classification and generation pipeline.

## Design Decisions

- **Depth**: Immediate parent only (no thread walking)
- **Image merging**: Parent images first, then reply images (only if reply author === parent tweet author)
- **Classification**: Pass parent text + image presence to the AI classifier for better context
- **Generation**: Include parent text in the generation prompt

## Changes

### 1. Poll route (`apps/web/app/(app)/api/x-bot/poll/route.ts`)
- Add `referenced_tweets` to `tweet.fields`
- Add `referenced_tweets.id` to `expansions`
- When a mention has `referenced_tweets` with type `replied_to`, fetch the parent tweet via `client.tweets.findTweetById()`
- Extract parent text and media URLs
- Pass `parentTweetText` and `parentMediaUrls` to `processMention`

### 2. Process mention (`apps/web/lib/x-bot/process-mention.ts`)
- Extend mention interface with `parentTweetText?: string` and `parentMediaUrls?: string[]`
- Merge parent + mention media URLs (parent first, reply only if same author)
- Pass parent text to classifier and generation

### 3. Classify tweet (`apps/web/lib/x-bot/classify-tweet.ts`)
- Add `parentTweetText?: string` parameter
- Include parent text in classification prompt so "create this" + parent context = valid app request

### 4. Quick pre-filter
- When parent text exists, also check it for app request keywords
