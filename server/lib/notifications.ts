/**
 * Notification handlers: Slack, Email, SMS
 * All methods are fail-safe — errors are logged but never crash the request.
 */

import nodemailer from 'nodemailer'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SubmissionData {
  firstName: string
  lastName: string
  name: string
  phone: string
  email: string
  address: string
  services: string
  windowService: string
  notes: string
  photoUrls: string[]
  photoCount: number
  submittedAt: string
}

// ─── Slack ────────────────────────────────────────────────────────────────────

/**
 * Posts a rich notification to #new-estimates via Slack webhook.
 * Falls back silently if SLACK_WEBHOOK_URL is not configured.
 */
export async function notifySlack(data: SubmissionData): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.log('[Slack] SLACK_WEBHOOK_URL not set — skipping Slack notification')
    return
  }

  const photoLines = data.photoUrls.slice(0, 10).map((url, i) => `<${url}|Photo ${i + 1}>`).join('  ·  ')
  const serviceEmoji = data.services.toLowerCase().includes('pressure') ? '🪣' : '🪟'

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${serviceEmoji} New Estimate Request — ${data.name}`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Name:*\n${data.name}` },
          { type: 'mrkdwn', text: `*Phone:*\n${data.phone}` },
          { type: 'mrkdwn', text: `*Email:*\n${data.email}` },
          { type: 'mrkdwn', text: `*Address:*\n${data.address || '_Not provided_'}` },
          { type: 'mrkdwn', text: `*Services:*\n${data.services}` },
          { type: 'mrkdwn', text: `*Photos:*\n${data.photoCount} submitted` }
        ]
      },
      ...(data.windowService ? [{
        type: 'section' as const,
        text: { type: 'mrkdwn' as const, text: `*Window Preference:* ${data.windowService}` }
      }] : []),
      ...(data.notes ? [{
        type: 'section' as const,
        text: { type: 'mrkdwn' as const, text: `*Notes:*\n${data.notes}` }
      }] : []),
      ...(data.photoUrls.length > 0 ? [{
        type: 'section' as const,
        text: { type: 'mrkdwn' as const, text: `*📸 Photos:*\n${photoLines}` }
      }] : []),
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `Submitted via landing page · ${new Date(data.submittedAt).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' })} HST`
        }]
      }
    ]
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      console.error('[Slack] Webhook failed:', res.status, await res.text())
    } else {
      console.log('[Slack] Notification sent for:', data.name)
    }
  } catch (err) {
    console.error('[Slack] Error sending notification:', err)
  }
}

// ─── Email to Blue Pacific ────────────────────────────────────────────────────

/**
 * Sends an internal notification email to the Blue Pacific team.
 * Requires SMTP_* env vars (or GMAIL_USER + GMAIL_PASS for Gmail).
 */
export async function notifyTeamEmail(data: SubmissionData): Promise<void> {
  const transporter = getTransporter()
  if (!transporter) {
    console.log('[Email] SMTP not configured — skipping team email')
    return
  }

  const photoLinks = data.photoUrls.map((url, i) =>
    `<li><a href="${url}" style="color:#0369a1">Photo ${i + 1}</a></li>`
  ).join('\n')

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0369a1;padding:24px;border-radius:8px 8px 0 0">
    <h1 style="color:white;margin:0;font-size:20px">🪟 New Estimate Request</h1>
  </div>
  <div style="background:#f0f9ff;padding:24px;border:1px solid #bae6fd;border-top:none;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;width:120px">Name</td><td style="padding:8px 0;font-weight:600">${data.name}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Phone</td><td style="padding:8px 0">${data.phone}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0">${data.email}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Address</td><td style="padding:8px 0">${data.address || 'Not provided'}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Services</td><td style="padding:8px 0">${data.services}</td></tr>
      ${data.windowService ? `<tr><td style="padding:8px 0;color:#64748b">Window Pref</td><td style="padding:8px 0">${data.windowService}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#64748b">Photos</td><td style="padding:8px 0">${data.photoCount} submitted</td></tr>
      ${data.notes ? `<tr><td style="padding:8px 0;color:#64748b;vertical-align:top">Notes</td><td style="padding:8px 0">${data.notes}</td></tr>` : ''}
    </table>
    ${data.photoUrls.length > 0 ? `
    <div style="margin-top:20px">
      <p style="font-weight:600;margin-bottom:8px">📸 Photo Links:</p>
      <ul style="margin:0;padding-left:20px">${photoLinks}</ul>
    </div>` : ''}
    <p style="color:#64748b;font-size:13px;margin-top:24px">Submitted ${new Date(data.submittedAt).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' })} HST via landing page</p>
  </div>
</div>`

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@bluepacificwindowcleaning.com',
      to: process.env.TEAM_EMAIL || 'sales@bpwchi.com',
      subject: `New Estimate Request — ${data.name} (${data.services})`,
      html
    })
    console.log('[Email] Team notification sent for:', data.name)
  } catch (err) {
    console.error('[Email] Failed to send team email:', err)
  }
}

// ─── Confirmation Email to Customer ──────────────────────────────────────────

/**
 * Sends a "we got your photos" confirmation email to the customer.
 */
export async function sendCustomerConfirmation(data: SubmissionData): Promise<void> {
  if (!data.email) {
    console.log('[Email] No customer email provided — skipping confirmation')
    return
  }

  const transporter = getTransporter()
  if (!transporter) {
    console.log('[Email] SMTP not configured — skipping customer confirmation')
    return
  }

  const firstName = data.firstName || data.name.split(' ')[0] || 'there'

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0369a1;padding:32px 24px;border-radius:8px 8px 0 0;text-align:center">
    <h1 style="color:white;margin:0;font-size:22px">Blue Pacific Window Cleaning</h1>
    <p style="color:#bae6fd;margin:8px 0 0">Serving Oʻahu</p>
  </div>
  <div style="background:white;padding:32px 24px;border:1px solid #e0f2fe;border-top:none;border-radius:0 0 8px 8px">
    <h2 style="color:#0c4a6e;margin-top:0">Thanks, ${firstName} — we've got your photos! 👍</h2>
    <p style="color:#334155;line-height:1.6">
      Our team here on Oʻahu will take a look at your photos and send your estimate shortly.
      Most estimates go out within 24 hours.
    </p>
    <div style="background:#f0f9ff;border-left:4px solid #0369a1;padding:16px;border-radius:0 8px 8px 0;margin:24px 0">
      <p style="margin:0;color:#0c4a6e;font-weight:600">What happens next:</p>
      <p style="margin:8px 0 0;color:#334155">We'll review your photos, prepare your pricing, and reach out by text or email — usually within 24 hours.</p>
    </div>
    <p style="color:#334155;line-height:1.6">
      If you have any questions or want to add anything, just reply to this email or give us a call:
    </p>
    <p style="margin:0">
      <a href="tel:+18084577600" style="color:#0369a1;font-weight:600;font-size:18px">(808) 457-7600</a>
    </p>
    <hr style="border:none;border-top:1px solid #e0f2fe;margin:32px 0">
    <p style="color:#64748b;font-size:13px;margin:0;text-align:center">
      Blue Pacific Window Cleaning · Detail-focused window cleaning for Oʻahu homes<br>
      <a href="https://bluepacificwindowcleaning.com" style="color:#0369a1">bluepacificwindowcleaning.com</a>
    </p>
  </div>
</div>`

  try {
    await transporter.sendMail({
      from: `Blue Pacific Window Cleaning <${process.env.SMTP_FROM || process.env.GMAIL_USER || 'sales@bpwchi.com'}>`,
      to: data.email,
      subject: `We received your estimate request, ${firstName} 👍`,
      html
    })
    console.log('[Email] Customer confirmation sent to:', data.email)
  } catch (err) {
    console.error('[Email] Failed to send customer confirmation:', err)
  }
}

// ─── SMS via ClickSend (fallback) ────────────────────────────────────────────

/**
 * Sends an SMS via ClickSend REST API.
 * Used as fallback if the primary Zapier/Quo webhook fails.
 * Auth: Basic (username + API key) — https://developers.clicksend.com/docs/messaging/sms
 */
export async function sendSmsViaClickSend(phone: string, message: string): Promise<boolean> {
  const username = process.env.CLICKSEND_USERNAME
  const apiKey = process.env.CLICKSEND_API_KEY
  const fromName = process.env.CLICKSEND_FROM || 'BluePacific'

  if (!username || !apiKey) {
    console.log('[ClickSend] Not configured — CLICKSEND_USERNAME / CLICKSEND_API_KEY not set')
    return false
  }

  const cleanPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`
  const credentials = Buffer.from(`${username}:${apiKey}`).toString('base64')

  try {
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{
          source: 'blue-pacific-estimate',
          body: message,
          to: cleanPhone,
          from: fromName
        }]
      })
    })

    const result = await response.json() as {
      response_code?: string
      response_msg?: string
      data?: { messages?: Array<{ status: string; message_id: string }> }
    }

    if (!response.ok || result.response_code !== 'SUCCESS') {
      console.error('[ClickSend] SMS failed:', result.response_msg)
      return false
    }

    const msgStatus = result.data?.messages?.[0]?.status
    console.log('[ClickSend] SMS sent, status:', msgStatus)
    return true
  } catch (err) {
    console.error('[ClickSend] Error sending SMS:', err)
    return false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTransporter() {
  // Gmail shortcut
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS // Use an App Password, not your Gmail password
      }
    })
  }

  // Generic SMTP — supports Outlook/M365 (smtp.office365.com:587), SendGrid, etc.
  if (process.env.SMTP_HOST && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: true, // enforce STARTTLS — required by Outlook/M365
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }

  return null
}
