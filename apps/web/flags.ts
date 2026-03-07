import { flag } from 'flags/next'
import { vercelAdapter } from '@flags-sdk/vercel'

export const opencodeEnabled = flag<boolean>({
  key: 'opencode',
  defaultValue: false,
  ...(process.env.FLAGS
    ? { adapter: vercelAdapter() }
    : { decide: () => false }),
})

export const tunnelMode = flag<string>({
  key: 'tunnelMode',
  defaultValue: 'ngrok-patch',
  ...(process.env.FLAGS
    ? { adapter: vercelAdapter() }
    : { decide: () => 'ngrok-patch' }),
})
