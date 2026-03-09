import { getServerSession } from '@/lib/auth/index'
import { SubscriptionPageClient } from './subscription-page-client'

export default async function SubscriptionPage() {
  const session = await getServerSession()

  return <SubscriptionPageClient session={session} />
}
