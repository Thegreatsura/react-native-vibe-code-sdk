import { db } from '@/lib/db'
import { projects } from '@react-native-vibe-code/database'
import { eq, and } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'
import { put } from '@vercel/blob'

export const maxDuration = 300 // 5 minutes for screenshot capture

// Hosted chromium binary URL for serverless environments
const CHROMIUM_REMOTE_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v141.0.0/chromium-v141.0.0-pack.tar'

// Helper function to wait for URL to be accessible
async function waitForUrlReady(
  url: string,
  maxAttempts: number = 10,
  delayMs: number = 3000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Screenshot] Checking URL readiness (attempt ${attempt}/${maxAttempts}): ${url}`)
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000), // 10 second timeout per attempt
      })
      if (response.ok) {
        console.log(`[Screenshot] URL is ready after ${attempt} attempt(s)`)
        return true
      }
      console.log(`[Screenshot] URL returned status ${response.status}, retrying...`)
    } catch (error) {
      console.log(`[Screenshot] URL not ready yet (attempt ${attempt}): ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    if (attempt < maxAttempts) {
      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  return false
}

// Helper function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * POST /api/projects/[id]/screenshots
 * Capture mobile and desktop screenshots of the project
 * Requires authentication and project ownership
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let browser = null

  try {
    const body = await req.json()
    const { userID } = body

    if (!userID) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
      })
    }

    // Check if project exists and belongs to user
    const existingProject = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, params.id), eq(projects.userId, userID)))
      .limit(1)

    if (existingProject.length === 0) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
      })
    }

    const project = existingProject[0]

    // Get the URL to screenshot - prioritize sandboxUrl (E2B URL) over ngrok
    const url = project.sandboxUrl || project.deployedUrl || project.ngrokUrl
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'No URL available for screenshots' }),
        { status: 400 }
      )
    }

    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`

    // Initial delay to give the app/tunnel time to start
    console.log(`[Screenshot] Starting screenshot capture for project ${params.id}`)
    console.log(`[Screenshot] Waiting 5 seconds before checking URL readiness...`)
    await delay(5000)

    // Wait for the URL to be accessible with retry logic
    const isUrlReady = await waitForUrlReady(fullUrl, 10, 3000) // 10 attempts, 3 seconds apart = up to 30+ seconds total
    if (!isUrlReady) {
      console.log(`[Screenshot] URL never became ready: ${fullUrl}`)
      return new Response(
        JSON.stringify({ error: 'URL is not accessible after multiple attempts' }),
        { status: 503 }
      )
    }

    // Additional delay after URL is accessible to let the app fully render
    console.log(`[Screenshot] URL is accessible, waiting 3 more seconds for app to fully load...`)
    await delay(3000)

    // Launch browser
    const isDevelopment = process.env.NODE_ENV === 'development'

    // In production, chromium-min downloads the binary from a remote URL
    const executablePath = isDevelopment
      ? process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : await chromium.executablePath(CHROMIUM_REMOTE_URL)

    browser = await puppeteer.launch({
      args: isDevelopment
        ? puppeteer.defaultArgs()
        : [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath,
      headless: true,
    })

    const page = await browser.newPage()

    // Take mobile screenshot
    await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 }) // iPhone SE dimensions with 2x retina scaling
    console.log(`[Screenshot] Navigating to ${fullUrl} for mobile screenshot...`)
    await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 60000 }) // Increased timeout for tunnel URLs
    // Extra wait for React/app hydration
    await delay(2000)
    const mobileScreenshot = await page.screenshot({ type: 'png' })
    console.log(`[Screenshot] Mobile screenshot captured`)

    // Upload mobile screenshot to Vercel Blob
    const mobileBlob = await put(
      `screenshots/${params.id}-mobile.png`,
      mobileScreenshot,
      {
        access: 'public',
        contentType: 'image/png',
      }
    )

    // Take desktop screenshot
    await page.setViewport({ width: 1920, height: 1080 }) // Desktop dimensions
    console.log(`[Screenshot] Navigating to ${fullUrl} for desktop screenshot...`)
    await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 60000 }) // Increased timeout for tunnel URLs
    // Extra wait for React/app hydration
    await delay(2000)
    const desktopScreenshot = await page.screenshot({ type: 'png' })
    console.log(`[Screenshot] Desktop screenshot captured`)

    // Upload desktop screenshot to Vercel Blob
    const desktopBlob = await put(
      `screenshots/${params.id}-desktop.png`,
      desktopScreenshot,
      {
        access: 'public',
        contentType: 'image/png',
      }
    )

    await browser.close()
    browser = null

    // Update project with screenshot URLs from Vercel Blob
    const updatedProject = await db
      .update(projects)
      .set({
        screenshotMobile: mobileBlob.url,
        screenshotDesktop: desktopBlob.url,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.id, params.id), eq(projects.userId, userID)))
      .returning()

    console.log(`[Screenshot] Successfully captured and saved screenshots for project ${params.id}`)
    console.log(`[Screenshot] Mobile: ${mobileBlob.url}`)
    console.log(`[Screenshot] Desktop: ${desktopBlob.url}`)

    return new Response(
      JSON.stringify({
        success: true,
        screenshots: {
          mobile: mobileBlob.url,
          desktop: desktopBlob.url,
        },
        project: updatedProject[0],
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error(`[Screenshot] Error capturing screenshots for project ${params.id}:`, error)

    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.error('Error closing browser:', closeError)
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to capture screenshots',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    )
  }
}
