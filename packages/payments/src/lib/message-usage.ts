import { db, subscriptions, promptMessages, eq, and } from '@react-native-vibe-code/database'
import { PAYMENTS_CONFIG, getCurrentMonth } from './config'
import type { MessageUsage, CanSendMessageResult, IncrementUsageResult } from '../types'

/**
 * Get user's subscription and current usage
 */
export async function getUserMessageUsage(userId: string): Promise<MessageUsage> {
  try {
    // Get user's subscription details
    const subscription = await db
      .select({
        messageLimit: subscriptions.messageLimit,
        currentPlan: subscriptions.currentPlan,
        status: subscriptions.status,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)

    // Get current month usage
    const currentMonth = getCurrentMonth()
    const usage = await db
      .select({
        usageCount: promptMessages.usageCount,
      })
      .from(promptMessages)
      .where(
        and(
          eq(promptMessages.userId, userId),
          eq(promptMessages.month, currentMonth)
        )
      )
      .limit(1)

    const currentPlan = subscription.length > 0 ? (subscription[0].currentPlan || 'free') : 'free'
    const isFreePlan = currentPlan === 'free' || !subscription.length || subscription[0].status !== 'active'
    const messageLimit = isFreePlan
      ? PAYMENTS_CONFIG.FREE_PLAN_MESSAGE_LIMIT
      : parseInt(subscription[0].messageLimit || PAYMENTS_CONFIG.FREE_PLAN_MESSAGE_LIMIT.toString())
    const usageCount = usage.length > 0 ? parseInt(usage[0].usageCount || '0') : 0
    const hasActiveSubscription = subscription.length > 0 && subscription[0].status === 'active'

    return {
      messageLimit,
      usageCount,
      remainingMessages: Math.max(0, messageLimit - usageCount),
      hasActiveSubscription,
      currentPlan,
      currentMonth,
    }
  } catch (error) {
    console.error('[Payments] Error getting user message usage:', error)
    // On DB error, allow the message through rather than blocking the user.
    // A missing table or transient DB issue should not prevent paid users from chatting.
    return {
      messageLimit: 1,
      usageCount: 0,
      remainingMessages: 1,
      hasActiveSubscription: false,
      currentPlan: 'free',
      currentMonth: getCurrentMonth(),
    }
  }
}

/**
 * Check if user can send a message (has remaining quota)
 */
export async function canUserSendMessage(userId: string): Promise<CanSendMessageResult> {
  const usage = await getUserMessageUsage(userId)

  if (usage.remainingMessages <= 0) {
    return {
      canSend: false,
      reason: usage.hasActiveSubscription
        ? `You've reached your monthly message limit of ${usage.messageLimit} messages. Your quota will reset on the 1st of next month.`
        : "You've used your free generation. Please upgrade your plan to continue building.",
      usage,
    }
  }

  return {
    canSend: true,
    usage,
  }
}

/**
 * Increment user's message usage count
 */
export async function incrementMessageUsage(userId: string): Promise<IncrementUsageResult> {
  try {
    const currentMonth = getCurrentMonth()

    // Try to get existing usage record
    const existingUsage = await db
      .select({
        usageCount: promptMessages.usageCount,
      })
      .from(promptMessages)
      .where(
        and(
          eq(promptMessages.userId, userId),
          eq(promptMessages.month, currentMonth)
        )
      )
      .limit(1)

    let newUsageCount: number

    if (existingUsage.length > 0) {
      // Update existing record
      const currentCount = parseInt(existingUsage[0].usageCount || '0')
      newUsageCount = currentCount + 1

      await db
        .update(promptMessages)
        .set({
          usageCount: newUsageCount.toString(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(promptMessages.userId, userId),
            eq(promptMessages.month, currentMonth)
          )
        )
    } else {
      // Create new record for this month
      newUsageCount = 1

      await db.insert(promptMessages).values({
        userId,
        month: currentMonth,
        usageCount: newUsageCount.toString(),
      })
    }

    // Get user's message limit to calculate remaining
    const usage = await getUserMessageUsage(userId)

    return {
      success: true,
      newUsageCount,
      remainingMessages: Math.max(0, usage.messageLimit - newUsageCount),
    }
  } catch (error) {
    console.error('[Payments] Error incrementing message usage:', error)
    return {
      success: false,
      newUsageCount: 0,
      remainingMessages: 0,
    }
  }
}

/**
 * Get usage statistics for a user across multiple months
 */
export async function getUserUsageHistory(userId: string, months: number = 6) {
  try {
    const usageHistory = await db
      .select({
        month: promptMessages.month,
        usageCount: promptMessages.usageCount,
        createdAt: promptMessages.createdAt,
        updatedAt: promptMessages.updatedAt,
      })
      .from(promptMessages)
      .where(eq(promptMessages.userId, userId))
      .orderBy(promptMessages.month)
      .limit(months)

    return usageHistory.map(record => ({
      month: record.month,
      usageCount: parseInt(record.usageCount || '0'),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }))
  } catch (error) {
    console.error('[Payments] Error getting usage history:', error)
    return []
  }
}

// Re-export getCurrentMonth for convenience
export { getCurrentMonth }
