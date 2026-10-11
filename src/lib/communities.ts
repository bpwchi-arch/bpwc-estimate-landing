/**
 * Community group-rate program — ONE config shared by client and server.
 *
 * Each community gets an unlisted sign-up page at /community/<slug>. Owners
 * pick a floor plan and a service, and the group discount grows as neighbors
 * join. This file is the single source of truth for every community's floor
 * plans, prices, days and discount tiers.
 *
 * The server imports this file too (server/lib/community.ts → ../../src/lib/
 * communities.js). Keep it free of DOM / React / browser imports so it stays
 * importable from Node.
 *
 * WHY TIERS ARE KEYED ON MAN-HOURS, NOT UNIT COUNT
 * A full-service (inside + outside) unit takes two to three times longer than
 * an exterior-only one. "10 units joined" could be half a crew day or two
 * crew days. The discount exists to reward filling a crew's day, so the thing
 * that earns it is booked crew time.
 */

export interface FloorPlan {
  id: string
  name: string
  description: string
  /** false until the sample walkthrough sets a real price. */
  priced: boolean
  exteriorPrice?: number
  insideOutsidePrice?: number
  /** Crew man-hours this plan books (one tech, one hour = 1). */
  exteriorManHours: number
  insideOutsideManHours: number
}

export interface CommunityDay {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** e.g. 'Fri Nov 14' */
  label: string
}

export interface DiscountTier {
  minManHours: number
  pct: number
  label: string
}

export interface Community {
  slug: string
  name: string
  area: string
  intro: string
  days: CommunityDay[]
  floorPlans: FloorPlan[]
  tiers: DiscountTier[]
  /** Below this the day is not held; the office follows up instead. */
  minManHoursToHoldDay: number
  /** false while any floor plan is still waiting on its walkthrough price. */
  priced: boolean
  walkthroughNote?: string
}

export type CommunityService = 'exterior' | 'inside_outside'

export const COMMUNITY_SERVICES: { id: CommunityService; label: string }[] = [
  { id: 'exterior', label: 'Outside only' },
  { id: 'inside_outside', label: 'Inside + outside' },
]

/** One two-tech crew day. Day-fill percentages are measured against this. */
export const CREW_DAY_MAN_HOURS = 14

export const DEFAULT_TIERS: DiscountTier[] = [
  { minManHours: 6, pct: 10, label: 'One tech, full day' },
  { minManHours: 14, pct: 15, label: 'Two techs, full day' },
  { minManHours: 28, pct: 20, label: 'Two crew days' },
]

export const DEFAULT_MIN_MAN_HOURS_TO_HOLD_DAY = 6

export const COMMUNITIES: Community[] = [
  {
    slug: 'poha-kea-point',
    name: 'Poha Kea Point',
    area: 'Kaneohe (Lilipuna)',
    intro:
      'Blue Pacific is offering Poha Kea Point owners a group rate on window cleaning. ' +
      'Every owner of the same floor plan pays the same fixed price, and the discount grows ' +
      'as more of your neighbors sign up for the same day.',
    // No days are invented. The page says community days are announced once
    // the first owners sign up; add real dates here when they are set.
    days: [],
    // PROVISIONAL — replace after the walkthrough. Man-hours are rough guesses
    // used only to size the discount tiers until each plan has been walked.
    floorPlans: [
      {
        id: 'plan-a',
        name: 'Plan A',
        description: 'Lower-level unit',
        priced: false,
        exteriorManHours: 1.5,
        insideOutsideManHours: 3,
      },
      {
        id: 'plan-b',
        name: 'Plan B',
        description: 'Upper-level unit',
        priced: false,
        exteriorManHours: 2,
        insideOutsideManHours: 3.5,
      },
      {
        id: 'plan-c',
        name: 'Plan C',
        description: 'Upper-level unit with lanai glass',
        priced: false,
        exteriorManHours: 2.5,
        insideOutsideManHours: 4,
      },
    ],
    tiers: DEFAULT_TIERS,
    minManHoursToHoldDay: DEFAULT_MIN_MAN_HOURS_TO_HOLD_DAY,
    priced: false,
    walkthroughNote:
      'Prices are set after one sample walkthrough of each floor plan. Every owner of the same ' +
      'floor plan then sees the same fixed price — not an estimate.',
  },
]

export function getCommunity(slug: string): Community | undefined {
  return COMMUNITIES.find((c) => c.slug === slug)
}

export function planManHours(plan: FloorPlan, service: CommunityService): number {
  return service === 'inside_outside' ? plan.insideOutsideManHours : plan.exteriorManHours
}

export interface TierStatus {
  pct: number
  label: string
  /** The next tier up, or null when the top tier is reached. */
  nextTier: DiscountTier | null
  /** 0–100: how far along the way from the current tier to the next. */
  progressPctToNext: number
}

export function computeTier(totalManHours: number, tiers: DiscountTier[]): TierStatus {
  const sorted = [...tiers].sort((a, b) => a.minManHours - b.minManHours)
  let current: DiscountTier | null = null
  let next: DiscountTier | null = null
  for (const t of sorted) {
    if (totalManHours >= t.minManHours) current = t
    else {
      next = t
      break
    }
  }
  const floor = current ? current.minManHours : 0
  let progress = 100
  if (next) {
    const span = next.minManHours - floor
    progress = span > 0 ? Math.min(100, Math.max(0, ((totalManHours - floor) / span) * 100)) : 100
  }
  return {
    pct: current ? current.pct : 0,
    label: current ? current.label : 'No discount yet',
    nextTier: next,
    progressPctToNext: Math.round(progress),
  }
}

/** Percentage of one two-tech crew day booked. Can exceed 100. */
export function dayFillPercent(totalManHours: number): number {
  return Math.round((totalManHours / CREW_DAY_MAN_HOURS) * 100)
}
