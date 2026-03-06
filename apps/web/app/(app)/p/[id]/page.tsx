import { opencodeEnabled } from '@/flags'
import { ProjectPageWrapper } from './project-page-wrapper'

export default async function Page() {
  const showOpencode = await opencodeEnabled()

  return <ProjectPageWrapper opencodeEnabled={!!showOpencode} />
}
