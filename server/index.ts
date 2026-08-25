import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { isStorageConfigured, uploadPhoto, uploadPhotoMemory, getPhotoFromMemory, applyLifecycleRule, persistLeadRecord } from './lib/storage.js'
import { notifySlack, notifyTeamEmail, sendCustomerConfirmation, sendSmsViaClickSend, type SubmissionData } from './lib/notifications.js'

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '50mb' }))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per file
})

// ─── Photo Upload ─────────────────────────────────────────────────────────────

app.post('/api/upload-photos', upload.array('photos', 20), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files)) {
      return res.status(400).json({ error: 'No files provided' })
    }

    const photoUrls: string[] = []
    const useCloudStorage = isStorageConfigured()
    const baseUrl = process.env.BASE_URL || 'https://49e5604b-3f33-4f47-a7d9-94a9d875e7dc.preview-dev.idealane.dev'

    if (useCloudStorage) {
      console.log('[Upload] Using Cloudflare R2 / cloud storage')
      for (const file of req.files) {
        try {
          const url = await uploadPhoto(file.buffer, file.mimetype, file.originalname)
          photoUrls.push(url)
        } catch (err) {
          console.error('[Upload] Cloud upload failed, falling back to memory:', err)
          const memoryUrl = uploadPhotoMemory(file.buffer, file.mimetype, file.originalname, baseUrl)
          photoUrls.push(memoryUrl)
        }
      }
    } else {
      console.log('[Upload] Cloud storage not configured — using in-memory fallback')
      for (const file of req.files) {
        const url = uploadPhotoMemory(file.buffer, file.mimetype, file.originalname, baseUrl)
        photoUrls.push(url)
      }
    }

    console.log('[Upload] Successfully stored', photoUrls.length, 'photos')
    res.json({ photoUrls })
  } catch (err) {
    console.error('[Upload] Error:', err)
    res.status(500).json({
      error: 'Failed to upload photos',
      details: err instanceof Error ? err.message : String(err)
    })
  }
})

// Serve photos from memory (only when cloud storage is not configured)
app.get('/api/photos/:photoId', (req, res) => {
  const photo = getPhotoFromMemory(req.params.photoId)
  if (!photo) return res.status(404).json({ error: 'Photo not found' })
  res.set('Content-Type', photo.mimetype)
  res.set('Cache-Control', 'public, max-age=31536000')
  res.send(photo.buffer)
})

// ─── Send Estimate Link via SMS ───────────────────────────────────────────────

app.post('/api/send-estimate-link', async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.status(400).json({ error: 'Phone number is required' })

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')

    // Capture this desktop->mobile handoff as a lead immediately (non-blocking) so we
    // don't lose the person if they never return to complete the full estimate flow.
    captureSendToPhoneLead(cleanPhone).catch(err =>
      console.warn('[Lead] send_to_phone capture failed (non-fatal):', err)
    )

    const estimateUrl = process.env.ESTIMATE_URL || 'https://bpwc-estimate-landing.vercel.app'
    const message = `Hey this is Blue Pacific 🤙 Here's your estimate link:\n\n${estimateUrl}\n\nEasiest way to get an estimate is just send a few photos — you can either open the link above OR just reply to this text with your photos directly:\n\n• Walk around the outside and snap a photo of each section of the home\n• Any windows you can't see from outside, just grab from inside\n\nMost customers finish this in under 2 minutes 👍\n\nDoesn't have to be perfect — just enough for us to see\n\nIMPORTANT: Send photos one at a time so they come through properly\n\nPhotos are the fastest way to get you an accurate quote and get you on the schedule right away\n\nWalkthroughs are only used when photos aren't possible and may delay scheduling — if you need one, just reply "walkthrough" or "call" 👍`

    // Send via Zapier → Quo webhook
    const zapierUrl = process.env.ZAPIER_SMS_WEBHOOK || 'https://hooks.zapier.com/hooks/catch/14536948/u7t39w7/'
    const payload = {
      phone: cleanPhone.startsWith('+') ? cleanPhone : `+1${cleanPhone}`,
      message,
      timestamp: new Date().toISOString()
    }

    let zapierResponseBody = ''
    try {
      const response = await fetch(zapierUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      zapierResponseBody = await response.text().catch(() => '')
      if (!response.ok) {
        console.error('[SMS] Zapier webhook returned', response.status, zapierResponseBody)
        return res.status(502).json({ error: `Zapier webhook error: ${response.status}`, details: zapierResponseBody })
      }
      console.log('[SMS] Dispatched via Zapier/Quo for:', cleanPhone, '| response:', zapierResponseBody)
    } catch (err) {
      console.error('[SMS] Zapier webhook threw:', err)
      return res.status(502).json({ error: 'Failed to reach Zapier webhook', details: err instanceof Error ? err.message : String(err) })
    }

    res.json({ success: true, message: 'Text sent successfully' })
  } catch (err) {
    console.error('[send-estimate-link] Error:', err)
    res.status(500).json({
      error: 'Failed to send text message',
      details: err instanceof Error ? err.message : String(err)
    })
  }
})

// ─── Submit Estimate ──────────────────────────────────────────────────────────

app.post('/api/submit-estimate', async (req, res) => {
  try {
    const {
      phone,
      firstName,
      lastName,
      name,
      address,
      email,
      services,
      windowService,
      notes,
      photoUrls
    } = req.body

    if (!phone) return res.status(400).json({ error: 'Phone number is required' })

    /**
     * Photos are NO LONGER a hard requirement.
     *
     * The old six-step flow forced a photo upload before the contact step, so
     * requiring one here was safe. The landing page deliberately offers "text
     * photos instead" — the same path the LSA auto-reply and IVR option 1 push
     * people down — and roughly matches how most BPWC customers already send
     * photos. Rejecting those submissions would drop real leads on the floor:
     * a name, a phone number and a self-counted quote is a lead worth having,
     * photos or not.
     *
     * When photos are absent the client flags it prominently in `notes` so the
     * office knows to watch for an incoming MMS.
     */
    const hasPhotos = Array.isArray(photoUrls) && photoUrls.length > 0

    const submissionData: SubmissionData = {
      phone: phone.replace(/[\s\-\(\)]/g, ''),
      firstName: firstName || '',
      lastName: lastName || '',
      name: name || `${firstName} ${lastName}`,
      address: address || '',
      email: email || '',
      services: Array.isArray(services) ? services.join(', ') : (services || ''),
      windowService: windowService || '',
      notes: notes || '',
      photoUrls: photoUrls || [],
      photoCount: photoUrls?.length || 0,
      submittedAt: new Date().toISOString()
    }

    const leadId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    console.log(
      `[Submission] ${leadId} — ${submissionData.name}`,
      hasPhotos
        ? `— ${submissionData.photoCount} photo(s)`
        : '— NO photos (customer texting them instead)'
    )

    /* ── STEP 1: PERSIST BEFORE ANYTHING ELSE ──────────────────────────────
     *
     * The lead is written to durable storage before a single notification is
     * attempted. This is the whole point of the rewrite: notifications are a
     * convenience, storage is the system of record. If every channel is down,
     * the lead still exists and is recoverable from the bucket.
     */
    let persistedKey: string | null = null
    try {
      persistedKey = await persistLeadRecord(leadId, { leadId, ...submissionData })
      if (persistedKey) console.log(`[Lead] ${leadId} persisted → ${persistedKey}`)
    } catch (err) {
      console.error(`[Lead] ${leadId} PERSIST FAILED:`, err)
    }

    /* ── STEP 2: ATTEMPT DELIVERY, AND COUNT WHAT ACTUALLY LANDED ──────────
     *
     * `attempted` matters as much as the promise resolving. Every notifier in
     * lib/notifications.ts returns early and resolves successfully when its env
     * var is missing — so a resolved promise does NOT mean a human was told.
     * A channel only counts as delivered when it was configured AND resolved.
     */
    const channels = [
      { name: 'Zapier', attempted: true, run: () => sendToZapier(submissionData) },
      {
        name: 'Slack',
        attempted: !!process.env.SLACK_WEBHOOK_URL,
        run: () => notifySlack(submissionData)
      },
      {
        name: 'Team email',
        attempted: !!(process.env.SMTP_HOST || process.env.GMAIL_USER),
        run: () => notifyTeamEmail(submissionData)
      },
      {
        name: 'Customer email',
        attempted: !!(
          submissionData.email && (process.env.SMTP_HOST || process.env.GMAIL_USER)
        ),
        run: () => sendCustomerConfirmation(submissionData)
      }
    ]

    const results = await Promise.allSettled(channels.map(c => c.run()))

    const delivered: string[] = []
    const failed: string[] = []
    const skipped: string[] = []

    results.forEach((r, i) => {
      const c = channels[i]
      if (!c.attempted) {
        skipped.push(c.name)
      } else if (r.status === 'fulfilled') {
        delivered.push(c.name)
      } else {
        failed.push(c.name)
        console.error(`[Submission] ${leadId} ${c.name} FAILED:`, r.reason)
      }
    })

    // "Customer email" tells the customer, not us — it doesn't count as the
    // office having been notified.
    const notifiedUs = delivered.filter(n => n !== 'Customer email')

    console.log(
      `[Submission] ${leadId} delivered=[${notifiedUs.join(', ') || 'NONE'}] ` +
      `failed=[${failed.join(', ') || 'none'}] skipped=[${skipped.join(', ') || 'none'}] ` +
      `persisted=${persistedKey ? 'yes' : 'NO'}`
    )

    /* ── STEP 3: LAST-RESORT SMS ───────────────────────────────────────────
     * Nobody was told. ClickSend is already wired for the estimate-link flow,
     * so use it to page the owner directly rather than let this go quiet.
     */
    if (notifiedUs.length === 0) {
      const owner = process.env.OWNER_ALERT_PHONE
      if (owner) {
        try {
          await sendSmsViaClickSend(
            owner,
            `BPWC ALERT: new lead ${submissionData.name} ${submissionData.phone} ` +
            `but ALL notification channels failed. Lead saved as ${leadId}.`
          )
          notifiedUs.push('Owner SMS')
          console.log(`[Submission] ${leadId} owner SMS fallback sent`)
        } catch (err) {
          console.error(`[Submission] ${leadId} owner SMS fallback FAILED:`, err)
        }
      }
    }

    /* ── STEP 4: TELL THE TRUTH ────────────────────────────────────────────
     *
     * Only claim success if the lead is genuinely safe — either it's in durable
     * storage, or a human was actually notified. If neither is true, return an
     * error so the customer sees "call or text us" instead of a confirmation
     * screen for a lead that no longer exists anywhere.
     */
    const leadIsSafe = !!persistedKey || notifiedUs.length > 0

    if (!leadIsSafe) {
      console.error(
        `[Submission] ${leadId} LEAD LOST — nothing persisted, nobody notified. ` +
        `Payload: ${JSON.stringify(submissionData)}`
      )
      return res.status(502).json({
        error: 'lead_not_delivered',
        message:
          'We could not record your request. Please call or text us at (808) 207-2939.'
      })
    }

    res.json({
      success: true,
      message: 'Estimate request submitted successfully',
      leadId,
      persisted: !!persistedKey,
      notified: notifiedUs
    })
  } catch (err) {
    console.error('[submit-estimate] Error:', err)
    res.status(500).json({
      error: 'Failed to submit estimate request',
      details: err instanceof Error ? err.message : String(err)
    })
  }
})

/**
 * Configuration health check.
 *
 * Reports whether each integration is wired, never the values. Added because
 * diagnosing the 2026-08-25 silent-lead-loss meant guessing at which env vars
 * Vercel actually had — there was no way to look without shipping a build.
 */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    storage: isStorageConfigured(),          // durable lead records + photos
    slack: !!process.env.SLACK_WEBHOOK_URL,
    zapier: true,                            // hardcoded fallback URL, always on
    email: !!(process.env.SMTP_HOST || process.env.GMAIL_USER),
    clickSendSms: !!(process.env.CLICKSEND_USERNAME && process.env.CLICKSEND_API_KEY),
    ownerAlertPhone: !!process.env.OWNER_ALERT_PHONE
  })
})

// ─── Zapier Submission Webhook ────────────────────────────────────────────────

async function sendToZapier(data: SubmissionData): Promise<void> {
  const webhookUrl = process.env.ZAPIER_SUBMIT_WEBHOOK || 'https://hooks.zapier.com/hooks/catch/14536948/uerttj9/'

  // Build a human-readable photo list (numbered, one per line)
  const photoListText = data.photoUrls
    .map((url, i) => `Photo ${i + 1}: ${url}`)
    .join('\n')

  // Individual photo URL fields for easy Zapier field mapping
  const photoFields: Record<string, string> = {}
  data.photoUrls.forEach((url, i) => {
    photoFields[`photo_${i + 1}`] = url
  })

  // Plain-text formatted summary for email body / Zapier steps
  const serviceLabel = data.services === 'windows' ? 'Window Cleaning' : data.services
  const windowPref = data.windowService === 'interior-exterior' ? 'Interior + Exterior'
    : data.windowService === 'exterior-only' ? 'Exterior Only'
    : data.windowService || ''

  const submittedHST = new Date(data.submittedAt).toLocaleString('en-US', {
    timeZone: 'Pacific/Honolulu',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })

  const summaryText = [
    `New Estimate Request — ${data.name}`,
    ``,
    `Name:     ${data.name}`,
    `Phone:    ${data.phone}`,
    `Email:    ${data.email || 'Not provided'}`,
    `Address:  ${data.address || 'Not provided'}`,
    `Service:  ${serviceLabel}`,
    windowPref ? `Windows:  ${windowPref}` : '',
    data.notes ? `Notes:    ${data.notes}` : '',
    ``,
    `Photos (${data.photoCount}):`,
    photoListText,
    ``,
    `Submitted: ${submittedHST} HST`
  ].filter(line => line !== undefined && !(line === '' && false)).join('\n')

  const payload = {
    // Clean individual fields — easy to map in Zapier
    first_name: data.firstName,
    last_name: data.lastName,
    name: data.name,
    phone: data.phone,
    email: data.email,
    customer_email: data.email,   // alias — some Zap steps look for this
    address: data.address || '',
    service: serviceLabel,
    window_preference: windowPref,
    notes: data.notes || '',
    photo_count: data.photoCount,
    submitted_at: submittedHST + ' HST',

    // Individual photo URLs (photo_1, photo_2, …)
    ...photoFields,

    // Full formatted text — paste directly into email body in Zapier
    summary: summaryText,

    // HTML version for Zapier email steps
    summary_html: `
<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:600px">
  <tr><td style="padding:6px 12px 6px 0;color:#555;width:120px"><b>Name</b></td><td style="padding:6px 0">${data.name}</td></tr>
  <tr><td style="padding:6px 12px 6px 0;color:#555"><b>Phone</b></td><td style="padding:6px 0">${data.phone}</td></tr>
  <tr><td style="padding:6px 12px 6px 0;color:#555"><b>Email</b></td><td style="padding:6px 0">${data.email || '—'}</td></tr>
  <tr><td style="padding:6px 12px 6px 0;color:#555"><b>Address</b></td><td style="padding:6px 0">${data.address || '—'}</td></tr>
  <tr><td style="padding:6px 12px 6px 0;color:#555"><b>Service</b></td><td style="padding:6px 0">${serviceLabel}</td></tr>
  ${windowPref ? `<tr><td style="padding:6px 12px 6px 0;color:#555"><b>Windows</b></td><td style="padding:6px 0">${windowPref}</td></tr>` : ''}
  ${data.notes ? `<tr><td style="padding:6px 12px 6px 0;color:#555;vertical-align:top"><b>Notes</b></td><td style="padding:6px 0">${data.notes}</td></tr>` : ''}
  <tr><td style="padding:6px 12px 6px 0;color:#555"><b>Photos</b></td><td style="padding:6px 0">${data.photoUrls.map((u, i) => `<a href="${u}">Photo ${i + 1}</a>`).join(' &nbsp;·&nbsp; ')}</td></tr>
  <tr><td style="padding:6px 12px 6px 0;color:#555"><b>Submitted</b></td><td style="padding:6px 0">${submittedHST} HST</td></tr>
</table>`
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error')
    throw new Error(`Zapier webhook failed: ${response.status} — ${text}`)
  }
  console.log('[Zapier] Submission webhook sent for:', data.name)
}

// ─── Send-to-Phone Lead Capture ───────────────────────────────────────────────
// When a visitor taps "Send This To My Phone" they've shown real intent but have
// not completed the full estimate. Fire a lightweight lead to Quo (via Zapier)
// tagged source: 'send_to_phone' so these handoffs are not lost. Uses
// ZAPIER_LEAD_WEBHOOK if set, otherwise falls back to the submit webhook — in
// which case the receiving Zap should branch on `source` / `lead_type` so partial
// leads are not treated as completed estimates.
async function captureSendToPhoneLead(cleanPhone: string): Promise<void> {
  const webhookUrl =
    process.env.ZAPIER_LEAD_WEBHOOK ||
    process.env.ZAPIER_SUBMIT_WEBHOOK ||
    'https://hooks.zapier.com/hooks/catch/14536948/uerttj9/'

  const phone = cleanPhone.startsWith('+') ? cleanPhone : `+1${cleanPhone}`
  const submittedHST = new Date().toLocaleString('en-US', {
    timeZone: 'Pacific/Honolulu',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  })

  const payload = {
    source: 'send_to_phone',
    lead_type: 'partial',
    name: '',
    first_name: '',
    last_name: '',
    phone,
    email: '',
    address: '',
    service: '',
    window_preference: '',
    notes: 'Lead from "Send This To My Phone" - estimate link texted; full form not yet completed.',
    photo_count: 0,
    submitted_at: submittedHST + ' HST',
    summary: `Send-to-Phone lead (no photos yet)\n\nPhone: ${phone}\nSubmitted: ${submittedHST} HST`
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error')
    throw new Error(`Lead webhook failed: ${response.status} - ${text}`)
  }
  console.log('[Lead] send_to_phone lead captured for:', phone)
}

// ─── Export for Vercel serverless ────────────────────────────────────────────
export default app

// ─── Server Start (local dev only) ───────────────────────────────────────────

const PORT = process.env.PORT || 3001
if (!process.env.VERCEL) app.listen(PORT, async () => {
  console.log(`\n🌊 Blue Pacific Window Cleaning — Estimate Server`)
  console.log(`   Port: ${PORT}`)
  console.log(`   Cloud storage (R2/S3): ${isStorageConfigured() ? '✅ ENABLED' : '⚠️  DISABLED (using in-memory fallback)'}`)
  console.log(`   Slack notifications: ${process.env.SLACK_WEBHOOK_URL ? '✅ ENABLED' : '⚠️  DISABLED (set SLACK_WEBHOOK_URL)'}`)
  console.log(`   Email notifications: ${(process.env.GMAIL_USER || process.env.SMTP_HOST) ? '✅ ENABLED' : '⚠️  DISABLED (set GMAIL_USER/PASS or SMTP_* vars)'}`)
  console.log(`   ClickSend SMS fallback: ${process.env.CLICKSEND_USERNAME ? '✅ ENABLED' : '⚠️  DISABLED (set CLICKSEND_USERNAME + CLICKSEND_API_KEY)'}`)

  // Auto-apply R2 lifecycle rule (30-day auto-delete for uploads/) on startup
  if (isStorageConfigured()) {
    applyLifecycleRule().catch(err =>
      console.warn('[Storage] Could not apply lifecycle rule (non-fatal):', err?.message)
    )
  }
  console.log()
})
