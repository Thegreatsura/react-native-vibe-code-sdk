/**
 * Application configuration constants
 */

export const CONFIG = {
  /**
   * Free plan message limit per month
   * This is the default number of messages a user can send without a subscription
   */
  FREE_PLAN_MESSAGE_LIMIT: 10,

  /**
   * Default paid plan limits (can be overridden by subscription data)
   */
  PAID_PLAN_LIMITS: {
    start: 100,
    pro: 250,
    senior: 500,
  },

  /**
   * Chat history settings
   */
  CHAT_HISTORY_LIMIT: parseInt(process.env.CHAT_HISTORY_LIMIT || '10', 10),

  /**
   * Sandbox settings
   */
  SANDBOX: {
    TIMEOUT_MS: parseInt(process.env.E2B_SANDBOX_TIMEOUT_MS || '3600000', 10),
    REQUEST_TIMEOUT_MS: parseInt(
      process.env.E2B_SANDBOX_REQUEST_TIMEOUT_MS || '900000',
      10
    ),
    WORKING_DIR: '/home/user/app',
    CLAUDE_SDK_DIR: '/claude-sdk',
  },
} as const

export default CONFIG

// Re-export templates
export * from './templates'
