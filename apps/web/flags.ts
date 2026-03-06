import { flag } from 'flags/next'
import { vercelAdapter } from '@flags-sdk/vercel'

export const opencodeEnabled = flag({
  key: 'opencode',
  adapter: vercelAdapter(),
  defaultValue: false,
})
