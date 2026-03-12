/**
 * Payments configuration constants
 */

import type { Plan, PlanName } from '../types'

export const PAYMENTS_CONFIG = {
  /**
   * Free plan message limit per month
   */
  FREE_PLAN_MESSAGE_LIMIT: 0,

  /**
   * Paid plan limits by plan name
   */
  PAID_PLAN_LIMITS: {
    start: 100,
    pro: 250,
    senior: 500,
  } as Record<string, number>,

  /**
   * Plan reset day (1st of each month)
   */
  RESET_DAY: 1,
} as const

/**
 * Get message limit for a given plan
 */
export function getMessageLimitForPlan(planName: PlanName | string): number {
  if (planName === 'free' || !planName) {
    return PAYMENTS_CONFIG.FREE_PLAN_MESSAGE_LIMIT
  }
  return PAYMENTS_CONFIG.PAID_PLAN_LIMITS[planName] || PAYMENTS_CONFIG.FREE_PLAN_MESSAGE_LIMIT
}

/**
 * Get next reset date (1st of next month)
 */
export function getNextResetDate(): Date {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, PAYMENTS_CONFIG.RESET_DAY)
  return nextMonth
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Available subscription plans
 */
export const PLANS: Plan[] = [
  {
    name: 'Start',
    slug: 'start',
    price: 9.99,
    originalPrice: 20,
    period: 'mo',
    messageLimit: 100,
    features: [
      '100 messages monthly',
      'Private projects',
      'Code editor',
      'History restore',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    slug: 'pro',
    price: 19.99,
    originalPrice: 45,
    period: 'mo',
    messageLimit: 250,
    features: [
      '250 messages monthly',
      'Private projects',
      'Code editor',
      'History restore',
      'Chat support',
    ],
    popular: true,
  },
  {
    name: 'Senior',
    slug: 'senior',
    price: 49.99,
    originalPrice: 90,
    period: 'mo',
    messageLimit: 500,
    features: [
      '500 messages monthly',
      'Private projects',
      'Code editor',
      'History restore',
      'Chat support',
    ],
  },
]

export default PAYMENTS_CONFIG
