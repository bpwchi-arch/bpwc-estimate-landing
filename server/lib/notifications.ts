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
  /**
   * What the customer asked for. 'range_accepted' = they are happy with the
   * price range the calculator showed and want to be scheduled without sending
   * photos. 'exact_price' (the default, and what every submission before
   * 2026-10-04 was) = they want photos turned into an exact price.
   */
  intent: 'exact_price' | 'range_accepted'
  /** Free text: preferred days or dates (range_accepted only). */
  preferredDays: string
  /** The range the customer saw and accepted, e.g. "$340 – $460". */
  rangeText: string
  rangeLow: number | null
  rangeHigh: number | null
  /** Pane / panel counts the range was built from (range_accepted only). */
  counts: Record<string, number>
}

export const RANGE_ACCEPTED_HEADLINE = 'RANGE ACCEPTED — ready to schedule'

export const isRangeAccepted = (d: Pick<SubmissionData, 'intent'>): boolean =>
  d.intent === 'range_accepted'

/** Human labels for the counts object, in the order the office reads them. */
const COUNT_LABELS: [string, string][] = [
  ['groundPanes', 'Ground-floor panes'],
  ['secondFloorPanes', '2nd-floor panes'],
  ['thirdFloorPanes', '3rd-floor panes'],
  ['slidingDoorPanels', 'Sliding door panels'],
  ['louverSets', 'Louver sets'],
  ['highInteriorPanes', 'High interior panes'],
  ['glassRailings', 'Glass railings'],
  ['solarPanels', 'Solar panels'],
]

/** "Ground-floor panes: 12 · 2nd-floor panes: 8 …" — only non-zero counts. */
export function formatCounts(counts: Record<string, number>): string {
  return COUNT_LABELS.filter(([k]) => (counts?.[k] ?? 0) > 0)
    .map(([k, label]) => `${label}: ${counts[k]}`)
    .join(' · ')
}

/** Escape user-supplied text before it goes into an HTML email / Zapier HTML. */
export const escapeHtml = (s: string): string =>
  String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  )

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
          text: isRangeAccepted(data)
            ? `${RANGE_ACCEPTED_HEADLINE} — ${data.name}`
            : `${serviceEmoji} New Estimate Request — ${data.name}`,
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
          { type: 'mrkdwn', text: isRangeAccepted(data) ? `*Photos:*\nNone (booking at the range)` : `*Photos:*\n${data.photoCount} submitted` }
        ]
      },
      ...(isRangeAccepted(data) ? [{
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text:
            `*Accepted range:* ${data.rangeText}\n` +
            `*Counts:* ${formatCounts(data.counts) || '_see notes_'}\n` +
            `*Preferred days:* ${data.preferredDays || '_none given_'}`
        }
      }] : []),
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

  /**
   * ⚠️  THROWS ON FAILURE — DO NOT WRAP THIS IN A SWALLOWING try/catch.
   *
   * Slack is the channel Austin actually watches, so a silent failure here is
   * the worst case in the whole notification path: the office believes it is
   * being alerted while nothing arrives.
   *
   * This previously caught the error, logged it, and returned normally — and a
   * non-2xx response only got a console.error. Either way the promise resolved,
   * the caller counted it as delivered, and the owner-SMS backstop stayed
   * asleep. A dead webhook URL would have failed exactly this quietly.
   */
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Slack webhook returned ${res.status}: ${body.slice(0, 200)}`)
  }

  console.log('[Slack] Notification sent for:', data.name)
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
    <h1 style="color:white;margin:0;font-size:20px">${isRangeAccepted(data) ? RANGE_ACCEPTED_HEADLINE : '🪟 New Estimate Request'}</h1>
  </div>
  <div style="background:#f0f9ff;padding:24px;border:1px solid #bae6fd;border-top:none;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;width:120px">Name</td><td style="padding:8px 0;font-weight:600">${escapeHtml(data.name)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Phone</td><td style="padding:8px 0">${escapeHtml(data.phone)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0">${escapeHtml(data.email)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Address</td><td style="padding:8px 0">${escapeHtml(data.address) || 'Not provided'}</td></tr>
      ${isRangeAccepted(data) ? `<tr><td style="padding:8px 0;color:#64748b">Accepted range</td><td style="padding:8px 0;font-weight:600">${escapeHtml(data.rangeText)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Counts</td><td style="padding:8px 0">${escapeHtml(formatCounts(data.counts)) || 'See notes'}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Preferred days</td><td style="padding:8px 0">${escapeHtml(data.preferredDays) || 'None given'}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#64748b">Services</td><td style="padding:8px 0">${data.services}</td></tr>
      ${data.windowService ? `<tr><td style="padding:8px 0;color:#64748b">Window Pref</td><td style="padding:8px 0">${data.windowService}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#64748b">Photos</td><td style="padding:8px 0">${isRangeAccepted(data) ? 'None (booking at the range)' : `${data.photoCount} submitted`}</td></tr>
      ${data.notes ? `<tr><td style="padding:8px 0;color:#64748b;vertical-align:top">Notes</td><td style="padding:8px 0;white-space:pre-line">${escapeHtml(data.notes)}</td></tr>` : ''}
    </table>
    ${data.photoUrls.length > 0 ? `
    <div style="margin-top:20px">
      <p style="font-weight:600;margin-bottom:8px">📸 Photo Links:</p>
      <ul style="margin:0;padding-left:20px">${photoLinks}</ul>
    </div>` : ''}
    <p style="color:#64748b;font-size:13px;margin-top:24px">Submitted ${new Date(data.submittedAt).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' })} HST via landing page</p>
  </div>
</div>`

  /**
   * ⚠️  NO HARDCODED FALLBACK RECIPIENT, AND NO SWALLOWED ERRORS.
   *
   * Both of those bit us on 2026-08-26 and they compounded each other:
   *
   *  1. This used to fall back to a hardcoded `sales@bpwchi.com` when TEAM_EMAIL
   *     was unset. TEAM_EMAIL happens to be set (to that same address), so this
   *     particular fallback never fired in production — but a silent default
   *     recipient is a loaded gun: unset the var and mail quietly reroutes to an
   *     address the code author chose, still reporting success.
   *
   *  2. The catch block logged and then returned normally, so even a hard SMTP
   *     failure resolved as fulfilled. The caller counts a resolved promise as
   *     delivered, so a bounced email still read as "the office was told".
   *
   * Together they meant the submit endpoint could report a lead delivered when
   * literally nobody had received anything. Throwing is the honest behaviour:
   * the caller records the failure and escalates to the owner-SMS backstop.
   */
  const to = process.env.TEAM_EMAIL
  if (!to) {
    throw new Error(
      'TEAM_EMAIL is not set — refusing to send to a hardcoded address. ' +
      'Set TEAM_EMAIL so team notifications reach a real inbox.'
    )
  }

  await transporter.sendMail({
    from:
      process.env.SMTP_FROM ||
      process.env.GMAIL_USER ||
      'noreply@bluepacificwindowcleaning.com',
    to,
    subject: isRangeAccepted(data)
      ? `${RANGE_ACCEPTED_HEADLINE} — ${data.name} (${data.rangeText})`
      : `New Estimate Request — ${data.name} (${data.services})`,
    html
  })
  console.log('[Email] Team notification sent to', to, 'for:', data.name)
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
  const range = isRangeAccepted(data)

  const html = range ? `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#0369a1;padding:32px 24px;border-radius:8px 8px 0 0;text-align:center">
    <h1 style="color:white;margin:0;font-size:22px">Blue Pacific Window Cleaning</h1>
    <p style="color:#bae6fd;margin:8px 0 0">Serving Oʻahu</p>
  </div>
  <div style="background:white;padding:32px 24px;border:1px solid #e0f2fe;border-top:none;border-radius:0 0 8px 8px">
    <h2 style="color:#0c4a6e;margin-top:0">Thanks, ${escapeHtml(firstName)}! We've got your request.</h2>
    <p style="color:#334155;line-height:1.6">
      Our office will reach out shortly with your estimate and available dates.
      Your price will fall within the range shown (${escapeHtml(data.rangeText)}), confirmed against your window count.
    </p>
    <p style="color:#334155;line-height:1.6">
      Questions? Reply to this email or text us at (808) 207-2939.
    </p>
    <hr style="border:none;border-top:1px solid #e0f2fe;margin:32px 0">
    <p style="color:#64748b;font-size:13px;margin:0;text-align:center">
      Blue Pacific Window Cleaning · Detail-focused window cleaning for Oʻahu homes
    </p>
  </div>
</div>` : `
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
      subject: range
        ? `We received your scheduling request, ${firstName}`
        : `We received your estimate request, ${firstName} 👍`,
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
