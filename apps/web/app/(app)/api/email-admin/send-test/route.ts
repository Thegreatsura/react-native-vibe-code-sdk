import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/index'
import { getTemplate } from '@/lib/email/templates/registry'
import { getUnsubscribeUrl } from '@/lib/email/unsubscribe'
import { getResend, NEWSLETTER_FROM } from '@/lib/email'

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  const adminEmail = process.env.ADMIN_EMAIL

  if (!session?.user?.email || !adminEmail || session.user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { templateName, testEmail } = body

  if (!templateName) {
    return NextResponse.json({ error: 'templateName is required' }, { status: 400 })
  }

  if (!testEmail) {
    return NextResponse.json({ error: 'testEmail is required' }, { status: 400 })
  }

  const template = getTemplate(templateName)
  if (!template) {
    return NextResponse.json({ error: `Template "${templateName}" not found` }, { status: 404 })
  }

  try {
    const Component = template.component
    console.log('[Email Admin] Sending test email to:', testEmail, 'template:', templateName)

    const resend = getResend()
    console.log('[Email Admin] Resend initialized')

    const element = Component({
      issueNumber: template.issueNumber,
      issueDate: template.issueDate,
      unsubscribeUrl: getUnsubscribeUrl(testEmail),
    })
    console.log('[Email Admin] Template rendered')

    const { data, error } = await resend.emails.send({
      from: NEWSLETTER_FROM,
      to: testEmail,
      subject: `[TEST] ${template.subject}`,
      react: element,
    })

    if (error) {
      console.error('[Email Admin] Test send Resend error:', JSON.stringify(error))
      return NextResponse.json({ error: error.message || 'Failed to send test email' }, { status: 500 })
    }

    console.log('[Email Admin] Test email sent successfully:', data)
    return NextResponse.json({
      success: true,
      testEmail,
      templateName: template.name,
    })
  } catch (error: any) {
    console.error('[Email Admin] Test send catch error:', error?.message, error?.stack)
    return NextResponse.json({ error: error?.message || 'Failed to send test email' }, { status: 500 })
  }
}
