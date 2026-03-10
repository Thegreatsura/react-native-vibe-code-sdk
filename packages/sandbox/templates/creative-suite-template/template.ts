import { Template } from 'e2b'
import { readFileSync } from 'fs'
import { join } from 'path'

const dockerfile = readFileSync(
  join(__dirname, 'e2b.Dockerfile'),
  'utf-8'
)

export const template = Template().fromDockerfile(dockerfile)
