/**
 * Property-manager / AOAO inquiry (POST /api/pm-inquiry).
 *
 * A qualification form on /property-managers for low-rise condos, townhomes
 * and managed portfolios. These are NOT homeowner estimates: there is no price
 * range, no photos, and no auto-text. Austin calls the manager back himself
 * within one business day.
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
 * The zap's Quo auto-text step is filtered to lead_type_key === 'website_own_count'.
 * Nothing in this file may ever send that key — these leads must not trigger a
 * customer text.
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

export type PmTrack = 'contract' | 'group' | 'unknown'

export interface PmInquiryRecord {
  leadId: string
  type: 'pm_inquiry'
  track: PmTrack
  role: string
  propertyType: string
  stories: number
  buildings: number | null
  units: number | null
  area: string
  whoPays: string
  propertyName: string
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

export function trackFromWhoPays(whoPays: string): PmTrack {
  const w = whoPays.toLowerCase()
  if (w.startsWith('the association') || w === 'association') return 'contract'
  if (w.startsWith('individual') || w === 'owners') return 'group'
  return 'unknown'
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validatePmInquiry(body: Record<string, unknown>): PmValidation {
  const phoneRaw = str(body.phone, 40)
  const phone = phoneRaw.replace(/[\s\-().]/g, '')
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    return { ok: false, status: 400, error: 'phone_required', message: 'A phone number is required.' }
  }

  const stories = int(body.stories)
  if (stories === null || stories < 1) {
    return { ok: false, status: 400, error: 'stories_required', message: 'Please tell us how many stories the buildings are.' }
  }
  // Backstop for the client-side rule: towers never become leads.
  if (stories >= 5) {
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

  const whoPays = str(body.whoPays, 60)
  const leadId = `pm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  return {
    ok: true,
    record: {
      leadId,
      type: 'pm_inquiry',
      track: trackFromWhoPays(whoPays),
      role: str(body.role, 60),
      propertyType: str(body.propertyType, 80),
      stories,
      buildings: int(body.buildings),
      units: int(body.units),
      area: str(body.area, 80),
      whoPays,
      propertyName: str(body.propertyName, 200),
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
  const trackLabel =
    r.track === 'contract' ? 'ASSOCIATION CONTRACT'
    : r.track === 'group' ? 'GROUP RATE'
    : 'WHO-PAYS UNKNOWN'
  return `PM / AOAO INQUIRY — NEEDS AUSTIN · ${trackLabel} · ${r.propertyName || '(property not named)'}`
}

export function pmCountsText(r: PmInquiryRecord): string {
  return `${r.buildings ?? '?'} building(s) · ${r.units ?? '?'} unit(s) · ${r.stories} stories · ${r.propertyType || 'type not given'} · ${r.area || 'area not given'}`
}

export function buildPmZapierPayload(r: PmInquiryRecord): ZapierLeadPayload {
  const headline = pmHeadline(r)
  const countsText = pmCountsText(r)
  const { firstName, lastName } = splitName(r.name)
  const submitted = submittedHST(r.submittedAt)
  const windowPref =
    r.track === 'contract' ? 'Exterior schedule (contract)'
    : r.track === 'group' ? 'Group day (owners sign up one by one)'
    : 'Exterior schedule (contract) or group day'

  const rows: [string, string][] = [
    ['Track', r.track === 'contract' ? 'Association contract' : r.track === 'group' ? 'Group rate program' : 'Unknown — ask who pays'],
    ['Role', r.role],
    ['Property', r.propertyName],
    ['Address', r.address],
    ['Property type', r.propertyType],
    ['Stories', String(r.stories)],
    ['Buildings', r.buildings === null ? '' : String(r.buildings)],
    ['Units', r.units === null ? '' : String(r.units)],
    ['Area', r.area],
    ['Who pays', r.whoPays],
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
    'Next step: Austin calls within 1 business day. No auto-text was sent.'
  ].join('\n')

  return {
    first_name: firstName,
    last_name: lastName,
    name: r.name,
    phone: r.phone,
    email: r.email,
    customer_email: r.email,
    address: r.address,
    service: 'Property manager / AOAO inquiry',
    window_preference: windowPref,
    notes: r.notes,
    photo_count: 0,
    submitted_at: submitted,
    intent: 'pm_inquiry',
    lead_type: 'pm_inquiry',
    lead_type_key: 'pm_inquiry', // never 'website_own_count' — that key triggers the Quo auto-text
    headline,
    auto_text_line: 'Auto-text: NOT SENT (property-manager inquiry — Austin calls within 1 business day)',
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
    address: [r.propertyName, r.address].filter(Boolean).join(' — '),
    services: 'Property manager / AOAO inquiry',
    windowService: r.track === 'contract' ? 'Association contract' : r.track === 'group' ? 'Group rate program' : 'Who pays: not sure',
    notes: [pmCountsText(r), `Role: ${r.role || '—'}`, `Who pays: ${r.whoPays || '—'}`, r.notes].filter(Boolean).join('\n'),
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
  console.log(`[PM] ${leadId} — ${record.name || '(no name)'} [${record.track}] ${record.propertyName || ''}`)

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
