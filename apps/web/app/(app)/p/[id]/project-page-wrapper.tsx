'use client'

import dynamic from 'next/dynamic'
import Loading from './loading'

const ProjectPage = dynamic(
  () => import('./project-page').then((mod) => mod.ProjectPageInternal),
  { ssr: false, loading: () => <Loading /> },
)

export function ProjectPageWrapper({ opencodeEnabled }: { opencodeEnabled: boolean }) {
  return <ProjectPage opencodeEnabled={opencodeEnabled} />
}
