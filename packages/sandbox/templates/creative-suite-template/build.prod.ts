import dotenv from 'dotenv'
dotenv.config({ path: '../../.env.local' })
import { Template, defaultBuildLogger } from 'e2b'
import { template } from './template'
import { execSync } from 'child_process'
import { lstatSync, renameSync } from 'fs'
import { join } from 'path'

const LOCAL_APP_DIR = join(__dirname, '../../local-creative-suite-app')

// E2B SDK hashes symlinks by their metadata (not contents), so the upload cache
// always reports "already cached" even when the real files change. Fix: before
// building, replace the symlink with a real copy of the target files so the SDK
// computes proper content hashes and uploads the actual source.
async function resolveSymlinkBeforeBuild(): Promise<string | null> {
  try {
    const stat = lstatSync(LOCAL_APP_DIR)
    if (!stat.isSymbolicLink()) return null

    const backupPath = LOCAL_APP_DIR + '.symlink-backup'
    renameSync(LOCAL_APP_DIR, backupPath)

    // Read target from the renamed symlink
    const target = execSync(`readlink "${backupPath}"`).toString().trim()
    console.log(`[Build] Resolving symlink: local-creative-suite-app -> ${target}`)

    execSync(
      `rsync -a --exclude=node_modules --exclude=.git --exclude=ios --exclude=android --exclude=.expo "${target}/" "${LOCAL_APP_DIR}/"`,
      { stdio: 'inherit' },
    )
    console.log('[Build] Synced real files to local-creative-suite-app/')
    return backupPath
  } catch (e) {
    console.log('[Build] local-creative-suite-app is not a symlink or sync failed, proceeding normally:', e)
    return null
  }
}

async function restoreSymlink(backupPath: string) {
  try {
    execSync(`rm -rf "${LOCAL_APP_DIR}"`, { stdio: 'inherit' })
    renameSync(backupPath, LOCAL_APP_DIR)
    console.log('[Build] Restored symlink')
  } catch (e) {
    console.log('[Build] Failed to restore symlink:', e)
  }
}

async function main() {
  const backupPath = await resolveSymlinkBeforeBuild()

  try {
    await Template.build(template, {
      alias: 'creative-suite',
      cpuCount: 4,
      memoryMB: 4096,
      onBuildLogs: defaultBuildLogger(),
    })
  } finally {
    if (backupPath) {
      await restoreSymlink(backupPath)
    }
  }
}

main().catch(console.error)
