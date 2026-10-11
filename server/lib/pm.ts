/**
 * Property-manager / realtor inquiry (POST /api/pm-inquiry).
 *
 * The form on /property-managers for managers, realtors and owner-landlords
 * with rental homes, condos and small portfolios. These are NOT homeowner
 * estimates: there is no price range and no photos yet. The zap's photo-request
 * text IS wanted for these leads (it asks for photos of the first property),
 * and Austin calls within one business day.
 *
 * Flow mirrors /api/submit-estimate: persist first (pm-leads/), then notify.
 * Zapier is a router, not a destination — a 200 from the catch hook proves
 * nothing reached a person, so Slack / team email are attempted alongside it
 * and the record is already in storage before any of that starts.
 */

import { persistLeadRecord } from './storage.js'
import { escapeHtml, notifySlack, notifyTeamEmail, type SubmissionData } from './notifications.js'

export const ZAPIER_SUBMIT_WEBHOOK_DEFAULT = 'https://hooks.zapier.com/hooks/catch/14536948/uerttj9/'

export const zapierSubmitWebhookUrl = (): string =>
  process.env.ZAPIER_SUBMIT_WEBHOOK || ZAPIER_SUBMIT_WEBHOOK_DEFAULT

/** "Oct 10, 2026, 2:15 PM HST" — same format the estimate flow sends. */
export const submittedHST = (iso: string = new Date().toISOString()): string =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'Pacific/Honolulu',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  }) + ' HST'

/**
 * Every field the #new-estimates zap (377898169) reads. Send ALL of them on
 * every post so no line of its Slack template comes out blank.
 *
 * lead_type_key stays 'pm_inquiry' so the zap can route these on their own
 * branch (photo-request text for the first property, no homeowner estimate flow).
 */
export interface ZapierLeadPayload {
  first_name: string
  last_name: string
  name: string
  phone: string
  email: string
  customer_email: string
  address: string
  service: string
  window_preference: string
  notes: string
  photo_count: number
  submitted_at: string
  intent: string
  lead_type: string
  lead_type_key: string
  headline: string
  auto_text_line: string
  preferred_days: string
  range_text: string
  range_low: string
  range_high: string
  counts_text: string
  counts_json: string
  summary: string
  summary_html: string
}

export async function postToZapier(payload: ZapierLeadPayload, label: string): Promise<void> {
  const response = await fetch(zapierSubmitWebhookUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error')
    throw new Error(`Zapier webhook failed: ${response.status} — ${text}`)
  }
  console.log(`[Zapier] ${label} webhook sent:`, payload.headline)
}

/** Render a label/value table in the same style the estimate zap uses. */
export function summaryTable(headline: string, rows: [string, string][]): string {
  const body = rows
    .map(([k, v]) =>
      `  <tr><td style="padding:6px 12px 6px 0;color:#555;width:140px;vertical-align:top"><b>${escapeHtml(k)}</b></td>` +
      `<td style="padding:6px 0;white-space:pre-line">${escapeHtml(v) || '—'}</td></tr>`
    )
    .join('\n')
  return `<p style="font-family:sans-serif;font-size:16px;font-weight:700;color:#0369a1;margin:0 0 8px">${escapeHtml(headline)}</p>
<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%;max-width:600px">
${body}
</table>`
}

export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

const str = (v: unknown, max = 500): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

const int = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type PmTrack = 'turnover' | 'recurring' | 'unknown'

export interface PmInquiryRecord {
  leadId: string
  type: 'pm_inquiry'
  track: PmTrack
  role: string
  manages: string
  doors: number | null
  area: string
  need: string
  /** Optional backstop only; the form no longer asks. */
  stories: number | null
  address: string
  name: string
  phone: string
  email: string
  notes: string
  submittedAt: string
}

export type PmValidation =
  | { ok: true; record: PmInquiryRecord }
  | { ok: false; status: number; error: string; message: string }

export function trackFromNeed(need: string): PmTrack {
  if (need === 'Recurring schedule') return 'recurring'
  if (need === 'Move-out or move-in turn' || need === 'Listing prep' || need === 'One-time clean') return 'turnover'
  return 'unknown'
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validatePmInquiry(body: Record<string, unknown>): PmValidation {
  const phoneRaw = str(body.phone, 40)
  const phone = phoneRaw.replace(/[\s\-().]/g, '')
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    return { ok: false, status: 400, error: 'phone_required', message: 'A phone number is required.' }
  }

  // `stories` is optional now (the form no longer asks). If a value is sent
  // and it is 5+, reject as a backstop: high-rises never become leads.
  const stories = int(body.stories)
  if (stories !== null && stories >= 5) {
    return {
      ok: false,
      status: 400,
      error: 'out_of_scope',
      message: 'Buildings of five stories and up need rope access or a lift, which we do not do.'
    }
  }

  const email = str(body.email, 200)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: 'email_invalid', message: 'That email address does not look right.' }
  }

  const need = str(body.need, 60)
  const leadId = `pm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  return {
    ok: true,
    record: {
      leadId,
      type: 'pm_inquiry',
      track: trackFromNeed(need),
      role: str(body.role, 60),
      manages: str(body.manages, 80),
      doors: int(body.doors),
      area: str(body.area, 80),
      need,
      stories,
      address: str(body.address, 300),
      name: str(body.name, 120),
      phone,
      email,
      notes: str(body.notes, 2000),
      submittedAt: new Date().toISOString()
    }
  }
}

// ─── Zapier payload ───────────────────────────────────────────────────────────

export function pmHeadline(r: PmInquiryRecord): string {
  const need = (r.need || 'need not given').toUpperCase()
  const role = r.role || 'role not given'
  const doors = r.doors !== null ? `${r.doors} doors` : 'doors not given'
  return `PM / REALTOR INQUIRY — NEEDS AUSTIN · ${need} · ${role} · ${doors}`
}

export function pmCountsText(r: PmInquiryRecord): string {
  return `${r.manages || 'type not given'} · ${r.doors ?? '?'} doors · ${r.area || 'area not given'} · first: ${r.address || 'no address yet'}`
}

const trackLabel = (t: PmTrack): string =>
  t === 'recurring' ? 'Recurring schedule' : t === 'turnover' ? 'Turnover / one-time' : 'Unknown — ask on the call'

export function buildPmZapierPayload(r: PmInquiryRecord): ZapierLeadPayload {
  const headline = pmHeadline(r)
  const countsText = pmCountsText(r)
  const { firstName, lastName } = splitName(r.name)
  const submitted = submittedHST(r.submittedAt)
  const windowPref = r.need || 'Not sure'

  const rows: [string, string][] = [
    ['Track', trackLabel(r.track)],
    ['Need', r.need],
    ['Role', r.role],
    ['Manages', r.manages],
    ['Doors', r.doors === null ? '' : String(r.doors)],
    ['Area', r.area],
    ['First property', r.address],
    ['Name', r.name],
    ['Phone', r.phone],
    ['Email', r.email],
    ['Notes', r.notes],
    ['Submitted', submitted]
  ]

  const summary = [
    headline,
    '',
    ...rows.map(([k, v]) => `${(k + ':').padEnd(15)}${v || '—'}`),
    '',
    'Next step: photo-request text for the first property, then Austin calls within 1 business day.'
  ].join('\n')

  return {
    first_name: firstName,
    last_name: lastName,
    name: r.name,
    phone: r.phone,
    email: r.email,
    customer_email: r.email,
    address: r.address,
    service: 'Property manager / realtor inquiry',
    window_preference: windowPref,
    notes: r.notes,
    photo_count: 0,
    submitted_at: submitted,
    intent: 'pm_inquiry',
    lead_type: 'pm_inquiry',
    lead_type_key: 'pm_inquiry',
    headline,
    auto_text_line: 'Auto-text: status unknown, check Quo',
    preferred_days: '',
    range_text: '',
    range_low: '',
    range_high: '',
    counts_text: countsText,
    counts_json: '{}',
    summary,
    summary_html: summaryTable(headline, rows)
  }
}

/** Shape the record like an estimate so the existing Slack / email notifiers can post it. */
export function pmAsSubmission(r: PmInquiryRecord): SubmissionData {
  const { firstName, lastName } = splitName(r.name)
  return {
    firstName,
    lastName,
    name: r.name || '(no name)',
    phone: r.phone,
    email: r.email,
    address: r.address,
    services: 'Property manager / realtor inquiry',
    windowService: r.need || 'Not sure',
    notes: [pmCountsText(r), `Role: ${r.role || '—'}`, `Track: ${trackLabel(r.track)}`, r.notes].filter(Boolean).join('\n'),
    photoUrls: [],
    photoCount: 0,
    submittedAt: r.submittedAt,
    intent: 'exact_price',
    preferredDays: '',
    rangeText: '',
    rangeLow: null,
    rangeHigh: null,
    counts: {},
    headline: pmHeadline(r)
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export interface PmResult {
  leadId: string
  track: PmTrack
  persisted: boolean
  notified: string[]
}

export async function handlePmInquiry(record: PmInquiryRecord): Promise<PmResult> {
  const { leadId } = record
  console.log(`[PM] ${leadId} — ${record.name || '(no name)'} [${record.track}] ${record.need || ''}`)

  // STEP 1: persist before anything else. Storage is the system of record.
  let persistedKey: string | null = null
  try {
    persistedKey = await persistLeadRecord(leadId, record, 'pm-leads')
    if (persistedKey) console.log(`[PM] ${leadId} persisted → ${persistedKey}`)
  } catch (err) {
    console.error(`[PM] ${leadId} PERSIST FAILED:`, err)
  }

  // STEP 2: notify. Zapier is a router, not a destination — it never counts
  // as "a human was told". Slack / team email no-op when unconfigured.
  const asSubmission = pmAsSubmission(record)
  const channels = [
    { name: 'Zapier', attempted: true, reachesAHuman: false, run: () => postToZapier(buildPmZapierPayload(record), 'PM inquiry') },
    { name: 'Slack', attempted: !!process.env.SLACK_WEBHOOK_URL, reachesAHuman: true, run: () => notifySlack(asSubmission) },
    {
      name: 'Team email',
      attempted: !!(process.env.TEAM_EMAIL && (process.env.SMTP_HOST || process.env.GMAIL_USER)),
      reachesAHuman: true,
      run: () => notifyTeamEmail(asSubmission)
    }
  ]

  const results = await Promise.allSettled(channels.map(c => c.run()))
  const delivered: string[] = []
  const failed: string[] = []
  const skipped: string[] = []
  results.forEach((r, i) => {
    const c = channels[i]
    if (!c.attempted) skipped.push(c.name)
    else if (r.status === 'fulfilled') delivered.push(c.name)
    else {
      failed.push(c.name)
      console.error(`[PM] ${leadId} ${c.name} FAILED:`, r.reason)
    }
  })
  const notified = delivered.filter(n => channels.find(c => c.name === n)?.reachesAHuman)

  console.log(
    `[PM] ${leadId} humanNotified=[${notified.join(', ') || 'NONE'}] ` +
    `alsoDelivered=[${delivered.filter(n => !notified.includes(n)).join(', ') || 'none'}] ` +
    `failed=[${failed.join(', ') || 'none'}] skipped=[${skipped.join(', ') || 'none'}] ` +
    `persisted=${persistedKey ? 'yes' : 'NO'}`
  )

  return { leadId, track: record.track, persisted: !!persistedKey, notified }
}
