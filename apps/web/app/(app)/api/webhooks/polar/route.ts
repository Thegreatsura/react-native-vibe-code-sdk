import { NextRequest, NextResponse } from 'next/server'
import { db, subscriptions, user } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks'
import { CONFIG } from '@/lib/config'

// Calculate reset date (1st of next month)
function getNextResetDate(): Date {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth
}

// Normalize Polar product names to our plan slugs
// e.g. "Inti Computer - Starter" -> "start", "Pro Plan" -> "pro"
function normalizePlanName(productName: string): string {
  const name = productName?.toLowerCase() || ''
  if (name.includes('senior')) return 'senior'
  if (name.includes('pro')) return 'pro'
  if (name.includes('start') || name.includes('starter')) return 'start'
  return 'free'
}

// Map plan names to message limits
function getMessageLimitForPlan(planName: string): string {
  const normalized = normalizePlanName(planName)
  if (normalized === 'senior') return CONFIG.PAID_PLAN_LIMITS.senior.toString()
  if (normalized === 'pro') return CONFIG.PAID_PLAN_LIMITS.pro.toString()
  if (normalized === 'start') return CONFIG.PAID_PLAN_LIMITS.start.toString()
  return CONFIG.FREE_PLAN_MESSAGE_LIMIT.toString()
}

// Export the route as a raw body handler to preserve the exact request body for signature verification
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Handle GET requests (for webhook verification/testing)
export async function GET(request: NextRequest) {
  console.log('[Polar Webhook] GET request received - webhook endpoint is active')
  console.log('[Polar Webhook] URL:', request.url)
  console.log('[Polar Webhook] Method:', request.method)
  return NextResponse.json({
    status: 'ok',
    message: 'Polar webhook endpoint is active',
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method
  })
}

// Handle POST requests (actual webhooks)
export async function POST(request: NextRequest) {
  console.log('[Polar Webhook] ===== POST REQUEST RECEIVED =====')
  console.log('[Polar Webhook] Timestamp:', new Date().toISOString())
  console.log('[Polar Webhook] URL:', request.url)
  console.log('[Polar Webhook] Method:', request.method)

  try {
    // Get the raw body as text for signature verification
    const body = await request.text()

    console.log('[Polar Webhook] Received webhook request')
    console.log('[Polar Webhook] Environment:', process.env.NODE_ENV)
    console.log('[Polar Webhook] All headers:', Object.fromEntries(request.headers.entries()))
    console.log('[Polar Webhook] Specific webhook headers:', {
      'webhook-id': request.headers.get('webhook-id'),
      'webhook-timestamp': request.headers.get('webhook-timestamp'),
      'webhook-signature': request.headers.get('webhook-signature'),
      'x-webhook-id': request.headers.get('x-webhook-id'),
      'x-webhook-timestamp': request.headers.get('x-webhook-timestamp'),
      'x-webhook-signature': request.headers.get('x-webhook-signature'),
    })
    console.log('[Polar Webhook] Body length:', body.length)
    console.log('[Polar Webhook] Body preview:', body.substring(0, 200))

    // Check if webhook secret is configured
    const webhookSecret = process.env.NODE_ENV === 'production'
      ? process.env.POLAR_WEBHOOK_SECRET
      : (process.env.POLAR_WEBHOOK_SECRET_DEV || process.env.POLAR_WEBHOOK_SECRET)

    console.log('[Polar Webhook] Secret configured:', !!webhookSecret)
    console.log('[Polar Webhook] Secret length:', webhookSecret?.length)

    if (!webhookSecret) {
      console.error('[Polar Webhook] Webhook secret is not configured')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    // Convert NextRequest headers to a format validateEvent expects
    // Note: Headers in Next.js are case-insensitive, but we need to preserve exact names
    const headers: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })

    // Also try to get webhook-specific headers with different cases
    const webhookId = request.headers.get('webhook-id') ||
                      request.headers.get('Webhook-Id') ||
                      request.headers.get('WEBHOOK-ID')
    const webhookTimestamp = request.headers.get('webhook-timestamp') ||
                             request.headers.get('Webhook-Timestamp') ||
                             request.headers.get('WEBHOOK-TIMESTAMP')
    const webhookSignature = request.headers.get('webhook-signature') ||
                             request.headers.get('Webhook-Signature') ||
                             request.headers.get('WEBHOOK-SIGNATURE')

    console.log('[Polar Webhook] Extracted webhook headers:', {
      webhookId,
      webhookTimestamp,
      webhookSignature
    })

    // Add them explicitly if found
    if (webhookId) headers['webhook-id'] = webhookId
    if (webhookTimestamp) headers['webhook-timestamp'] = webhookTimestamp
    if (webhookSignature) headers['webhook-signature'] = webhookSignature

    // Validate webhook using Polar SDK
    let event

    // TEMPORARY: Skip validation to see if webhooks are arriving
    const SKIP_VALIDATION = process.env.POLAR_SKIP_VALIDATION === 'true'

    if (SKIP_VALIDATION) {
      console.warn('[Polar Webhook] ⚠️ SKIPPING SIGNATURE VALIDATION - FOR DEBUGGING ONLY')
      try {
        event = JSON.parse(body)
        console.log('[Polar Webhook] Parsed event without validation:', event.type)
      } catch (e) {
        console.error('[Polar Webhook] Failed to parse body:', e)
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
    } else {
      try {
        // The Polar SDK expects the secret to be base64 encoded
        console.log('[Polar Webhook] Attempting signature validation...')

        event = validateEvent(
          body,
          headers,
          webhookSecret
        )
        console.log('[Polar Webhook] Signature validated successfully')
      } catch (error) {
        if (error instanceof WebhookVerificationError) {
          console.error('[Polar Webhook] Verification failed:', error.message)
          console.error('[Polar Webhook] Error details:', error)
          console.error('[Polar Webhook] Make sure POLAR_WEBHOOK_SECRET matches the one in Polar dashboard')
          console.error('[Polar Webhook] Headers received:', JSON.stringify(headers, null, 2))

          // Return detailed error for debugging
          return NextResponse.json(
            {
              error: 'Invalid webhook signature',
              message: error.message,
              hint: 'Check that POLAR_WEBHOOK_SECRET environment variable matches the secret in Polar dashboard'
            },
            { status: 403 }
          )
        }
        console.error('[Polar Webhook] Unexpected error during verification:', error)
        throw error
      }
    }
    
    const { type, data } = event

    console.log(`[Polar Webhook] Processing event: ${type}`)
    console.log(`[Polar Webhook] Event data:`, JSON.stringify(data, null, 2))

    switch (type) {
      case 'checkout.created':
      case 'checkout.updated': {
        const checkoutData = data as any
        console.log('[Polar Webhook] Processing checkout event:', checkoutData.status)
        
        if (checkoutData.status === 'succeeded' && checkoutData.customer_id) {
          // Find user by email
          const userEmail = checkoutData.customer_email || checkoutData.customer?.email
          
          if (!userEmail) {
            console.log('[Polar Webhook] No customer email in checkout data')
            break
          }
          
          const userData = await db
            .select()
            .from(user)
            .where(eq(user.email, userEmail))
            .limit(1)

          if (userData.length > 0) {
            const userId = userData[0].id
            const rawPlanName = checkoutData.product?.name || 'free'
            const planName = normalizePlanName(rawPlanName)

            console.log(`[Polar Webhook] Updating subscription for user ${userId} to plan ${planName} (raw: ${rawPlanName})`)

            // Check if subscription exists
            const existingSub = await db
              .select()
              .from(subscriptions)
              .where(eq(subscriptions.userId, userId))
              .limit(1)

            const subscriptionData = {
              customerId: checkoutData.customer_id,
              currentPlan: planName,
              checkoutId: checkoutData.id,
              productId: checkoutData.product_id,
              status: 'active',
              subscribedAt: new Date(),
              messageLimit: getMessageLimitForPlan(planName),
              resetDate: getNextResetDate(),
              metadata: { checkout: checkoutData },
              updatedAt: new Date(),
            }

            if (existingSub.length > 0) {
              // Update existing subscription
              await db
                .update(subscriptions)
                .set(subscriptionData)
                .where(eq(subscriptions.userId, userId))
              console.log(`[Polar Webhook] Updated subscription for user ${userId}`)
            } else {
              // Create new subscription
              await db.insert(subscriptions).values({
                ...subscriptionData,
                userId,
              })
              console.log(`[Polar Webhook] Created new subscription for user ${userId}`)
            }
          } else {
            console.log(`[Polar Webhook] User not found with email ${userEmail}`)
          }
        }
        break
      }

      case 'subscription.created':
      case 'subscription.updated': {
        const subscriptionData = data as any
        console.log('[Polar Webhook] Processing subscription event')
        
        // Find user by customer external_id or email
        let userData
        
        // First try to find by external_id (user ID)
        if (subscriptionData.customer?.external_id) {
          userData = await db
            .select()
            .from(user)
            .where(eq(user.id, subscriptionData.customer.external_id))
            .limit(1)
        }
        
        // Fallback to email if external_id not found
        if ((!userData || userData.length === 0) && subscriptionData.customer?.email) {
          userData = await db
            .select()
            .from(user)
            .where(eq(user.email, subscriptionData.customer.email))
            .limit(1)
        }

        if (userData && userData.length > 0) {
          const userId = userData[0].id
          const rawPlanName = subscriptionData.product?.name || 'free'
          const planName = normalizePlanName(rawPlanName)

          console.log(`[Polar Webhook] Updating subscription for user ${userId} to plan ${planName} (raw: ${rawPlanName})`)

          // Check if subscription exists
          const existingSub = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, userId))
            .limit(1)

          const subData = {
            customerId: subscriptionData.customer_id,
            currentPlan: planName,
            subscriptionId: subscriptionData.id,
            productId: subscriptionData.product_id,
            status: subscriptionData.status,
            subscribedAt: subscriptionData.started_at ? new Date(subscriptionData.started_at) : new Date(),
            expiresAt: subscriptionData.ends_at ? new Date(subscriptionData.ends_at) : null,
            messageLimit: getMessageLimitForPlan(planName),
            resetDate: getNextResetDate(),
            metadata: { subscription: subscriptionData },
            updatedAt: new Date(),
          }

          if (existingSub.length > 0) {
            // Update existing subscription
            await db
              .update(subscriptions)
              .set(subData)
              .where(eq(subscriptions.userId, userId))
            console.log(`[Polar Webhook] Updated subscription for user ${userId}`)
          } else {
            // Create new subscription
            await db.insert(subscriptions).values({
              ...subData,
              userId,
            })
            console.log(`[Polar Webhook] Created new subscription for user ${userId}`)
          }
        } else {
          console.log('[Polar Webhook] User not found for subscription')
        }
        break
      }

      case 'subscription.active': {
        const subscriptionData = data as any
        console.log('[Polar Webhook] Processing subscription.active event')
        
        // Find user and update subscription status
        let userData
        
        if (subscriptionData.customer?.external_id) {
          userData = await db
            .select()
            .from(user)
            .where(eq(user.id, subscriptionData.customer.external_id))
            .limit(1)
        } else if (subscriptionData.customer?.email) {
          userData = await db
            .select()
            .from(user)
            .where(eq(user.email, subscriptionData.customer.email))
            .limit(1)
        }

        if (userData && userData.length > 0) {
          await db
            .update(subscriptions)
            .set({
              status: 'active',
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.userId, userData[0].id))
          console.log(`[Polar Webhook] Activated subscription for user ${userData[0].id}`)
        }
        break
      }

      case 'subscription.canceled': {
        const subscriptionData = data as any
        console.log('[Polar Webhook] Processing subscription.canceled event')
        
        // Find user and update subscription status
        let userData
        
        if (subscriptionData.customer?.external_id) {
          userData = await db
            .select()
            .from(user)
            .where(eq(user.id, subscriptionData.customer.external_id))
            .limit(1)
        } else if (subscriptionData.customer?.email) {
          userData = await db
            .select()
            .from(user)
            .where(eq(user.email, subscriptionData.customer.email))
            .limit(1)
        }

        if (userData && userData.length > 0) {
          await db
            .update(subscriptions)
            .set({
              status: 'cancelled',
              cancelledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.userId, userData[0].id))
          console.log(`[Polar Webhook] Cancelled subscription for user ${userData[0].id}`)
        }
        break
      }

      case 'subscription.revoked': {
        const subscriptionData = data as any
        console.log('[Polar Webhook] Processing subscription.revoked event')
        
        // Find user and update subscription status
        let userData
        
        if (subscriptionData.customer?.external_id) {
          userData = await db
            .select()
            .from(user)
            .where(eq(user.id, subscriptionData.customer.external_id))
            .limit(1)
        } else if (subscriptionData.customer?.email) {
          userData = await db
            .select()
            .from(user)
            .where(eq(user.email, subscriptionData.customer.email))
            .limit(1)
        }

        if (userData && userData.length > 0) {
          await db
            .update(subscriptions)
            .set({
              status: 'inactive',
              currentPlan: 'free',
              messageLimit: CONFIG.FREE_PLAN_MESSAGE_LIMIT.toString(),
              cancelledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.userId, userData[0].id))
          console.log(`[Polar Webhook] Revoked subscription for user ${userData[0].id}`)
        }
        break
      }

      case 'customer.created':
      case 'customer.updated': {
        const customerData = data as any
        console.log('[Polar Webhook] Processing customer event')

        // If customer has external_id (userId), ensure subscription record exists
        if (customerData.external_id) {
          const existingSub = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, customerData.external_id))
            .limit(1)

          if (existingSub.length === 0) {
            // Create default subscription record for new customer
            await db.insert(subscriptions).values({
              userId: customerData.external_id,
              customerId: customerData.id,
              currentPlan: 'free',
              status: 'inactive',
              messageLimit: CONFIG.FREE_PLAN_MESSAGE_LIMIT.toString(),
              resetDate: getNextResetDate(),
              metadata: { customer: customerData },
            })
            console.log(`[Polar Webhook] Created default subscription for customer ${customerData.external_id}`)
          } else {
            // Update customer ID if needed
            await db
              .update(subscriptions)
              .set({
                customerId: customerData.id,
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.userId, customerData.external_id))
            console.log(`[Polar Webhook] Updated customer ID for user ${customerData.external_id}`)
          }
        }
        break
      }

      case 'customer.deleted': {
        const customerData = data as any
        console.log('[Polar Webhook] Processing customer.deleted event')

        // Find user by customer ID and clear the customer reference
        if (customerData.id) {
          const userSubscription = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.customerId, customerData.id))
            .limit(1)

          if (userSubscription.length > 0) {
            // Clear customer ID and reset to free plan
            await db
              .update(subscriptions)
              .set({
                customerId: null,
                currentPlan: 'free',
                status: 'inactive',
                messageLimit: CONFIG.FREE_PLAN_MESSAGE_LIMIT.toString(),
                cancelledAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.customerId, customerData.id))
            console.log(`[Polar Webhook] Cleared Polar customer reference for deleted customer ${customerData.id}`)
          } else {
            console.log(`[Polar Webhook] No subscription found for deleted customer ${customerData.id}`)
          }
        }
        break
      }

      default:
        console.log(`[Polar Webhook] Unhandled event type: ${type}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Polar Webhook] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}