/**
 * One-time setup script to register the X webhook URL and subscription using API v2.
 *
 * Usage: pnpm run x-bot:register-webhook
 *
 * Required environment variables:
 * - TWITTER_BEARER_TOKEN: App-level bearer token for X API v2
 * - TWITTER_CONSUMER_KEY: OAuth 1.0a Consumer Key (API Key)
 * - TWITTER_CONSUMER_SECRET: OAuth 1.0a Consumer Secret (API Secret)
 * - TWITTER_ACCESS_TOKEN: OAuth 1.0a Access Token for @rnvibecode
 * - TWITTER_ACCESS_TOKEN_SECRET: OAuth 1.0a Access Token Secret for @rnvibecode
 *
 * Important: TWITTER_WEBHOOK_SECRET in .env must be set to your app's
 * Consumer Secret (API Secret Key from OAuth 1.0 Keys in X console).
 * X uses this to validate CRC challenges and sign webhook payloads.
 *
 * The webhook URL is registered as: https://reactnativevibecode.com/api/x-bot
 */

import crypto from 'crypto'

const WEBHOOK_URL = 'https://reactnativevibecode.com/api/x-bot'

/**
 * Generate OAuth 1.0a Authorization header
 */
function generateOAuth1Header(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('hex')

  const params: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  }

  // Create signature base string
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')

  const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`

  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64')

  params['oauth_signature'] = signature

  const authHeader = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
    .join(', ')

  return `OAuth ${authHeader}`
}

async function ensureSubscription(webhookId: string, bearerHeaders: Record<string, string>) {
  const consumerKey = process.env.TWITTER_CONSUMER_KEY
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    console.error('ERROR: OAuth 1.0a credentials required for subscription:')
    console.error('  TWITTER_CONSUMER_KEY, TWITTER_CONSUMER_SECRET,')
    console.error('  TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET')
    return
  }

  // Check existing subscriptions
  console.log(`\nChecking subscriptions for webhook ${webhookId}...`)
  const listSubRes = await fetch(
    `https://api.x.com/2/account_activity/webhooks/${webhookId}/subscriptions/all/list`,
    { headers: bearerHeaders }
  )

  if (listSubRes.ok) {
    const subData = await listSubRes.json()
    const subs = subData.data || []
    if (subs.length > 0) {
      console.log(`Found ${subs.length} existing subscription(s)`)
      for (const sub of subs) {
        console.log(`  - User ID: ${sub.user_id}`)
      }
      return
    }
  } else {
    const err = await listSubRes.text()
    console.log(`Could not list subscriptions (${listSubRes.status}): ${err}`)
  }

  // Create subscription using OAuth 1.0a
  console.log('Adding subscription to webhook (using OAuth 1.0a)...')

  const subUrl = `https://api.x.com/2/account_activity/webhooks/${webhookId}/subscriptions/all`
  const authHeader = generateOAuth1Header(
    'POST',
    subUrl,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret,
  )

  const subRes = await fetch(subUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
  })

  if (subRes.ok || subRes.status === 204) {
    console.log('Subscription added successfully!')
  } else {
    const err = await subRes.text()
    console.error(`Failed to add subscription (${subRes.status}): ${err}`)
  }
}

async function main() {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN
  if (!bearerToken) {
    console.error('ERROR: TWITTER_BEARER_TOKEN environment variable is required')
    console.error('Get it from: X Developer Console → App → Keys and Tokens → Bearer Token')
    process.exit(1)
  }

  const headers = {
    Authorization: `Bearer ${bearerToken}`,
    'Content-Type': 'application/json',
  }

  // Step 1: Check existing webhooks
  console.log('Checking existing webhooks...')
  const listRes = await fetch('https://api.x.com/2/webhooks', { headers })

  if (listRes.ok) {
    const data = await listRes.json()
    const existing = data.data || []

    if (existing.length > 0) {
      console.log(`Found ${existing.length} existing webhook(s):`)
      for (const wh of existing) {
        console.log(`  - ID: ${wh.id}, URL: ${wh.url}, Valid: ${wh.valid}`)
      }

      // Check if our URL is already registered
      const alreadyRegistered = existing.find(
        (wh: any) => wh.url === WEBHOOK_URL
      )
      if (alreadyRegistered) {
        console.log(`\nWebhook already registered with ID: ${alreadyRegistered.id}`)
        if (!alreadyRegistered.valid) {
          console.log('Webhook is not valid. Triggering CRC re-validation...')
          const crcRes = await fetch(
            `https://api.x.com/2/webhooks/${alreadyRegistered.id}`,
            { method: 'PUT', headers }
          )
          if (crcRes.ok) {
            console.log('CRC re-validation triggered successfully')
          } else {
            const err = await crcRes.text()
            console.error(`CRC re-validation failed: ${err}`)
          }
        }
        // Ensure subscription exists
        await ensureSubscription(alreadyRegistered.id, headers)
        console.log('\nDone! Webhook is active with subscription.')
        return
      }
    }
  } else {
    const err = await listRes.text()
    console.log(`Could not list existing webhooks (${listRes.status}): ${err}`)
  }

  // Step 2: Register new webhook
  console.log(`\nRegistering webhook URL: ${WEBHOOK_URL}`)
  console.log('(X will send a CRC challenge to your endpoint — make sure it is deployed)')

  const registerRes = await fetch('https://api.x.com/2/webhooks', {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: WEBHOOK_URL }),
  })

  if (!registerRes.ok) {
    const err = await registerRes.text()
    console.error(`\nFailed to register webhook: ${registerRes.status}`)
    console.error(err)
    console.error('\nCommon issues:')
    console.error('  - Endpoint not deployed or not publicly accessible')
    console.error('  - CRC challenge failed (check TWITTER_WEBHOOK_SECRET matches your Consumer Secret)')
    console.error('  - Bearer token invalid or missing permissions')
    console.error('  - URL includes a port (not allowed)')
    process.exit(1)
  }

  const webhook = await registerRes.json()
  const wh = webhook.data
  console.log(`\nWebhook registered successfully!`)
  console.log(`  ID: ${wh.id}`)
  console.log(`  URL: ${wh.url}`)
  console.log(`  Valid: ${wh.valid}`)
  console.log(`  Created: ${wh.created_at}`)

  // Add subscription
  await ensureSubscription(wh.id, headers)
  console.log('\nDone! The webhook is now active and will receive mention events.')
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
