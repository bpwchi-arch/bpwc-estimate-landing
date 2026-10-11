/**
 * Community group-rate sign-ups (GET /api/community/:slug, POST /api/community/:slug/signup).
 *
 * Config (floor plans, days, tiers) lives in src/lib/communities.ts and is
 * shared with the client. Sign-ups are stored one JSON object each under
 * community/<slug>/signups/<id>.json; the roster summary is recomputed from
 * storage on every request so the page always shows the live tier.
 *
 * Storage missing → summary is empty and sign-ups still notify. Never 500 a
 * sign-up page because a bucket is unconfigured.
 */

import { persistJson, listJson, isStorageConfigured } from './storage.js'
import { notifySlack, notifyTeamEmail, type SubmissionData } from './notifications.js'
import {
  getCommunity,
  planManHours,
  computeTier,
  dayFillPercent,
  COMMUNITY_SERVICES,
  type Community,
  type CommunityService,
  type TierStatus
} from '../../src/lib/communities.js'
import { postToZapier, submittedHST, summaryTable, splitName, type ZapierLeadPayload } from './pm.js'

export interface CommunitySignup {
  id: string
  type: 'community_signup'
  slug: string
  unit: string
  floorPlanId: string
  floorPlanName: string
  service: CommunityService
  manHours: number
  dayId: string
  dayLabel: string
  name: string
  phone: string
  email: string
  notes: string
  submittedAt: string
}

export interface CommunitySummary {
  slug: string
  count: number
  totalManHours: number
  tier: TierStatus
  dayFill: number
  byDay: Record<string, number>
  minManHoursToHoldDay: number
  dayHeld: boolean
  storage: boolean
}

export const signupPrefix = (slug: string) => `community/${slug}/signups/`

export async function loadSignups(slug: string): Promise<CommunitySignup[]> {
  try {
    return await listJson<CommunitySignup>(signupPrefix(slug))
  } catch (err) {
    console.error(`[Community] ${slug} could not list sign-ups:`, err)
    return []
  }
}

export function summarize(community: Community, signups: CommunitySignup[]): CommunitySummary {
  const totalManHours = Math.round(signups.reduce((s, x) => s + (Number(x.manHours) || 0), 0) * 100) / 100
  const byDay: Record<string, number> = {}
  for (const s of signups) {
    const k = s.dayId || 'flexible'
    byDay[k] = (byDay[k] ?? 0) + 1
  }
  return {
    slug: community.slug,
    count: signups.length,
    totalManHours,
    tier: computeTier(totalManHours, community.tiers),
    dayFill: dayFillPercent(totalManHours),
    byDay,
    minManHoursToHoldDay: community.minManHoursToHoldDay,
    dayHeld: totalManHours >= community.minManHoursToHoldDay,
    storage: isStorageConfigured()
  }
}

export async function communitySummary(slug: string): Promise<CommunitySummary | null> {
  const community = getCommunity(slug)
  if (!community) return null
  return summarize(community, await loadSignups(slug))
}

// ─── Validation ───────────────────────────────────────────────────────────────

const str = (v: unknown, max = 500): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export type SignupValidation =
  | { ok: true; signup: CommunitySignup; community: Community }
  | { ok: false; status: number; error: string; message: string }

export function validateSignup(slug: string, body: Record<string, unknown>): SignupValidation {
  const community = getCommunity(slug)
  if (!community) return { ok: false, status: 404, error: 'unknown_community', message: 'That community page does not exist.' }

  const unit = str(body.unit, 40)
  if (!unit) return { ok: false, status: 400, error: 'unit_required', message: 'Please enter your unit number.' }

  const plan = community.floorPlans.find(p => p.id === str(body.floorPlan, 60))
  if (!plan) return { ok: false, status: 400, error: 'floor_plan_invalid', message: 'Please pick your floor plan.' }

  const service = str(body.service, 30) as CommunityService
  if (!COMMUNITY_SERVICES.some(s => s.id === service)) {
    return { ok: false, status: 400, error: 'service_invalid', message: 'Please pick outside only or inside + outside.' }
  }

  const phone = str(body.phone, 40).replace(/[\s\-().]/g, '')
  if (!phone || phone.replace(/\D/g, '').length < 7) {
    return { ok: false, status: 400, error: 'phone_required', message: 'A mobile number is required so we can text your arrival window.' }
  }

  const email = str(body.email, 200)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: 'email_invalid', message: 'That email address does not look right.' }
  }

  const dayIdRaw = str(body.day, 60)
  const day = community.days.find(d => d.id === dayIdRaw)
  const dayId = day ? day.id : ''
  const dayLabel = day ? day.label : "Flexible — tell me when the day is set"

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return {
    ok: true,
    community,
    signup: {
      id,
      type: 'community_signup',
      slug,
      unit,
      floorPlanId: plan.id,
      floorPlanName: plan.name,
      service,
      manHours: planManHours(plan, service),
      dayId,
      dayLabel,
      name: str(body.name, 120),
      phone,
      email,
      notes: str(body.notes, 2000),
      submittedAt: new Date().toISOString()
    }
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

const serviceLabel = (s: CommunityService) => COMMUNITY_SERVICES.find(x => x.id === s)?.label ?? s

export function signupHeadline(community: Community, s: CommunitySignup, summary: CommunitySummary): string {
  return `COMMUNITY SIGN-UP — ${community.name} · Unit ${s.unit} · ${serviceLabel(s.service)} · ` +
    `${summary.count} signed up · ${summary.dayFill}% of a crew day · tier ${summary.tier.pct}%`
}

export function buildSignupZapierPayload(community: Community, s: CommunitySignup, summary: CommunitySummary): ZapierLeadPayload {
  const headline = signupHeadline(community, s, summary)
  const { firstName, lastName } = splitName(s.name)
  const submitted = submittedHST(s.submittedAt)
  const countsText = `${summary.count} signed up · ${summary.totalManHours} man-hours booked · ${summary.dayFill}% of a crew day · tier ${summary.tier.pct}% (${summary.tier.label})`

  const rows: [string, string][] = [
    ['Community', `${community.name} (${community.area})`],
    ['Unit', s.unit],
    ['Floor plan', s.floorPlanName],
    ['Service', serviceLabel(s.service)],
    ['Community day', s.dayLabel],
    ['Name', s.name],
    ['Phone', s.phone],
    ['Email', s.email],
    ['Notes', s.notes],
    ['Roster', countsText],
    ['Day held', summary.dayHeld ? 'Yes' : `Not yet (needs ${summary.minManHoursToHoldDay} man-hours)`],
    ['Submitted', submitted]
  ]

  const summaryText = [
    headline,
    '',
    ...rows.map(([k, v]) => `${(k + ':').padEnd(15)}${v || '—'}`),
    '',
    'Office confirms by text. No auto-text was sent.'
  ].join('\n')

  return {
    first_name: firstName,
    last_name: lastName,
    name: s.name,
    phone: s.phone,
    email: s.email,
    customer_email: s.email,
    address: `${community.name}, Unit ${s.unit} (${community.area})`,
    service: `Community group rate — ${community.name}`,
    window_preference: serviceLabel(s.service),
    notes: s.notes,
    photo_count: 0,
    submitted_at: submitted,
    intent: 'community_signup',
    lead_type: 'community_signup',
    lead_type_key: 'community_signup', // never 'website_own_count' — that key triggers the Quo auto-text
    headline,
    auto_text_line: 'Auto-text: NOT SENT (community sign-up — office confirms by text)',
    preferred_days: s.dayLabel,
    range_text: '',
    range_low: '',
    range_high: '',
    counts_text: countsText,
    counts_json: JSON.stringify({ count: summary.count, totalManHours: summary.totalManHours, byDay: summary.byDay }),
    summary: summaryText,
    summary_html: summaryTable(headline, rows)
  }
}

function signupAsSubmission(community: Community, s: CommunitySignup, summary: CommunitySummary): SubmissionData {
  const { firstName, lastName } = splitName(s.name)
  return {
    firstName,
    lastName,
    name: s.name || `Unit ${s.unit}`,
    phone: s.phone,
    email: s.email,
    address: `${community.name}, Unit ${s.unit} (${community.area})`,
    services: `Community group rate — ${community.name}`,
    windowService: serviceLabel(s.service),
    notes: [`Floor plan: ${s.floorPlanName}`, `Day: ${s.dayLabel}`, `Roster: ${summary.count} signed up · ${summary.dayFill}% of a crew day · tier ${summary.tier.pct}%`, s.notes].filter(Boolean).join('\n'),
    photoUrls: [],
    photoCount: 0,
    submittedAt: s.submittedAt,
    intent: 'exact_price',
    preferredDays: s.dayLabel,
    rangeText: '',
    rangeLow: null,
    rangeHigh: null,
    counts: {},
    headline: signupHeadline(community, s, summary)
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleSignup(community: Community, signup: CommunitySignup): Promise<{ summary: CommunitySummary; persisted: boolean }> {
  const tag = `[Community] ${community.slug}/${signup.id}`
  console.log(`${tag} — Unit ${signup.unit} · ${signup.floorPlanName} · ${signup.service}`)

  // STEP 1: persist. When storage is missing this returns null; the sign-up
  // still notifies (warning logged) and the summary simply excludes it.
  let persistedKey: string | null = null
  try {
    persistedKey = await persistJson(`${signupPrefix(community.slug)}${signup.id}.json`, signup)
    if (persistedKey) console.log(`${tag} persisted → ${persistedKey}`)
    else console.warn(`${tag} NOT persisted — storage unconfigured; roster will not include this sign-up`)
  } catch (err) {
    console.error(`${tag} PERSIST FAILED:`, err)
  }

  // STEP 2: recompute the roster from storage (includes this sign-up if stored).
  let signups = await loadSignups(community.slug)
  if (!persistedKey) signups = [...signups, signup] // count it for the notification at least
  const summary = summarize(community, signups)

  // STEP 3: notify. Zapier is a router, not a destination.
  const asSubmission = signupAsSubmission(community, signup, summary)
  const channels = [
    { name: 'Zapier', attempted: true, reachesAHuman: false, run: () => postToZapier(buildSignupZapierPayload(community, signup, summary), 'Community sign-up') },
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
      console.error(`${tag} ${c.name} FAILED:`, r.reason)
    }
  })
  const notified = delivered.filter(n => channels.find(c => c.name === n)?.reachesAHuman)
  console.log(
    `${tag} humanNotified=[${notified.join(', ') || 'NONE'}] ` +
    `alsoDelivered=[${delivered.filter(n => !notified.includes(n)).join(', ') || 'none'}] ` +
    `failed=[${failed.join(', ') || 'none'}] skipped=[${skipped.join(', ') || 'none'}] ` +
    `persisted=${persistedKey ? 'yes' : 'NO'}`
  )

  return { summary, persisted: !!persistedKey }
}
