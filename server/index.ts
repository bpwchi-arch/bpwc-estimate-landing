import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { isStorageConfigured, uploadPhoto, uploadPhotoMemory, getPhotoFromMemory, applyLifecycleRule } from './lib/storage.js'
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
    const estimateUrl = process.env.ESTIMATE_URL || 'https://bpwc-estimate-landing.vercel.app'
    const message = `Hey this is Blue Pacific 🤙 Here's your estimate link:\n\n${estimateUrl}\n\nEasiest way to get an estimate is just send a few photos — you can either open the link above OR just reply to this text with your photos directly:\n\n• Walk around the outside and snap a photo of each section of the home\n• Any windows you can't see from outside, just grab from inside\n\nMost customers finish this in under 2 minutes 👍\n\nDoesn't have to be perfect — just enough for us to see\n\nIMPORTANT: Send photos one at a time so they come through properly\n\nPhotos are the fastest way to get you an accurate quote and get you on the schedule right away\n\nWalkthroughs are only used when photos aren't possible and may delay scheduling — if you need one, just reply "walkthrough" or "call" 👍`

    // Send via Zapier → Quo webhook
    const zapierUrl = process.env.ZAPIER_SMS_WEBHOOK || 'https://hooks.zapier.com/hooks/catch/14536948/uer2igu/'
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
    if (!photoUrls || photoUrls.length === 0) return res.status(400).json({ error: 'At least one photo is required' })

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

    console.log('[Submission] Processing for:', submissionData.name, '— photos:', submissionData.photoCount)

    // Fire all notifications in parallel — none block the response
    const notifications = await Promise.allSettled([
      // 1. Zapier webhook (existing — routes to whatever you have wired there)
      sendToZapier(submissionData),
      // 2. Direct Slack notification to #new-estimates
      notifySlack(submissionData),
      // 3. Internal team email
      notifyTeamEmail(submissionData),
      // 4. Customer confirmation email
      sendCustomerConfirmation(submissionData)
    ])

    notifications.forEach((result, i) => {
      const labels = ['Zapier', 'Slack', 'Team Email', 'Customer Email']
      if (result.status === 'rejected') {
        console.error(`[Submission] ${labels[i]} failed:`, result.reason)
      }
    })

    console.log('[Submission] All notifications fired for:', submissionData.name)
    res.json({ success: true, message: 'Estimate request submitted successfully' })
  } catch (err) {
    console.error('[submit-estimate] Error:', err)
    res.status(500).json({
      error: 'Failed to submit estimate request',
      details: err instanceof Error ? err.message : String(err)
    })
  }
})

// ─── Zapier Submission Webhook ────────────────────────────────────────────────

async function sendToZapier(data: SubmissionData): Promise<void> {
  const webhookUrl = process.env.ZAPIER_SUBMIT_WEBHOOK || 'https://hooks.zapier.com/hooks/catch/14536948/uerttj9/'
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      storageType: isStorageConfigured() ? 'cloud' : 'memory'
    })
  })
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error')
    throw new Error(`Zapier webhook failed: ${response.status} — ${text}`)
  }
  console.log('[Zapier] Submission webhook sent for:', data.name)
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
