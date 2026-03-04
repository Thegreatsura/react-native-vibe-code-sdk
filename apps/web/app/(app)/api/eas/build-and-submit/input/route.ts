import { NextRequest, NextResponse } from 'next/server'
import { connectSandbox } from '@/lib/sandbox-connect'
import { runningProcesses } from '../route'

export async function POST(request: NextRequest) {
  try {
    const { sandboxId, input } = await request.json()

    if (!sandboxId || input === undefined) {
      return NextResponse.json(
        { error: 'sandboxId and input are required' },
        { status: 400 }
      )
    }

    const processInfo = runningProcesses.get(sandboxId)
    if (!processInfo) {
      return NextResponse.json(
        { error: 'No running process found for this sandbox' },
        { status: 404 }
      )
    }

    // Connect to the sandbox and send stdin
    const sbx = await connectSandbox(sandboxId)
    if (!sbx) {
      return NextResponse.json(
        { error: 'Failed to connect to sandbox' },
        { status: 500 }
      )
    }

    // Send input via PTY (interactive terminal)
    await sbx.pty.sendInput(
      processInfo.pid,
      new TextEncoder().encode(input + '\n')
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Build-and-submit input error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send input' },
      { status: 500 }
    )
  }
}
