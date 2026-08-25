/**
 * BPWC instant-estimate pricing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  SOURCE OF TRUTH: BPWC_BiddingCalculator_v4.1.xlsx
 *
 *  Every rate below is copied from that workbook, with sheet/cell references so
 *  it can be re-checked whenever Austin updates it. This file is the only place
 *  the web app defines a price.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  ⚠️  EVERYTHING IS PRICED PER **PANE**, NEVER PER WINDOW.
 *
 *  Austin: "This is a super common miscommunication." A single window opening
 *  can be 1, 2, or 3 panes of glass. If a customer counts openings and we price
 *  panes, the quote comes out roughly 40% low and the real estimate lands as an
 *  unpleasant surprise.
 *
 *  So the customer-facing UI must say PANES everywhere, and show a worked
 *  example. There is deliberately NO windows-to-panes conversion factor in this
 *  file — an earlier draft had one, and it was the single largest source of
 *  error in the model. We ask for the unit we actually bill.
 */

export type ServiceLevel = 'full' | 'exterior'

/* ───────────────────────────────────────────────────────────────────────────
 * RATE CARD — mirrors BPWC_BiddingCalculator_v4.1.xlsx
 * ──────────────────────────────────────────────────────────────────────────── */

export const PRICING = {
  /**
   * Controls!B43. Austin set this to $250 on 2026-08-24 (workbook v4.1 had
   * $275, which itself replaced $225). Update the workbook so they don't drift.
   */
  minimumCharge: 250,

  /** Controls!B10 — first-time clean multiplier (was 1.2, bumped to 1.3). */
  firstTimeMultiplier: 1.3,

  /** Controls!B11 — exterior-only price as a share of Full Service. */
  exteriorOnlyFactor: 0.7,

  /**
   * Per-PANE rates by floor — 'Window Estimate' B18 / B19 / B20.
   *
   * Note the second-floor rate is about height, not access method. BPWC works
   * second-storey glass with a water-fed pole wherever possible and actively
   * avoids ladders, so a second-floor pane over a roof costs the same as any
   * other second-floor pane. Don't describe this to customers as "ladder work".
   */
  perPaneByFloor: {
    ground: 6, // B18 — 1st floor
    second: 10, // B19 — 2nd floor
    third: 20, // B20 — 3rd floor
  },

  /** 'Window Estimate' B28 — sliding glass doors / large fixed panes, per panel. */
  perSlidingDoorPanel: 10,

  /** 'Window Estimate' B25 — louvers (jalousies), per set. Very common on Oahu. */
  perLouverSet: 18,

  /**
   * 'Window Estimate' B23 — per pane.
   *
   * This is about INTERIOR height: any pane needing a step stool or ladder on
   * the INSIDE of the house. Includes small transom panes sitting above other
   * windows. Panes that are high on both the inside and the outside also belong
   * in this bucket.
   */
  perHighInteriorPane: 18,

  /** Glass railings, per railing. Austin, 2026-08-24 — not in workbook v4.1. */
  perGlassRailing: 10,

  /** 'Window Estimate' B29 / Controls!B39 — solar panels, flat per panel. */
  perSolarPanel: 9,

  /** Controls!B40 — glass restoration (hard water), per pane. */
  perHardWaterPane: 250,

  /**
   * NOTE ON SCREENS — deliberately NOT charged here.
   *
   * Full Service already includes screens, frames and tracks (price book
   * WIN-FS). The workbook's $3 "screens that clip from outside" line (B26) is a
   * genuine edge case — Austin: "rare, old plantation style homes, maybe 10% of
   * estimates." Charging it by default would inflate 90% of quotes, so it's
   * left to the estimator to add after photos.
   */

  /**
   * Quoted-range width, as a fraction either side of the point estimate.
   * 0.15 → a $400 estimate displays as "$340 – $460".
   *
   * Now that customers give us panes directly, the input is far more accurate
   * than the old windows-based guess, so this is tighter than the 0.20 the
   * first draft used.
   */
  rangeSpread: 0.15,

  /**
   * There is deliberately NO "range with photos" setting.
   *
   * Austin, 2026-08-24: photos produce a 100% accurate and FINAL quote — not a
   * narrower range. That is a much stronger promise than tightening the band,
   * and it's the engine of the whole page: the range creates the open question,
   * photos close it completely. Never soften this back into a range.
   */
} as const

/* ────────────────────────────────────────────────────────────────────────────
 * QUOTE CALCULATION
 * ──────────────────────────────────────────────────────────────────────────── */

export interface QuoteInputs {
  service: ServiceLevel
  /** Panes of glass on the ground floor. */
  groundPanes: number
  /** Panes on the 2nd floor. */
  secondFloorPanes: number
  /** Panes on the 3rd floor. */
  thirdFloorPanes: number
  /** Sliding glass door PANELS (a 2-panel slider = 2). */
  slidingDoorPanels: number
  /** Sets of louvers / jalousies. */
  louverSets: number
  /** Panes needing a stool or ladder on the INSIDE. */
  highInteriorPanes: number
  /** Glass railing sections. */
  glassRailings: number
  /** Solar panels, if they want them cleaned. */
  solarPanels: number
  /** First-time clean — true for essentially all ad traffic. */
  firstTime: boolean
}

export interface QuoteRange {
  low: number
  high: number
  /** Un-rounded midpoint. Used in the lead note to Quo/HCP, never shown. */
  point: number
  /** True when the minimum charge is what's setting the price. */
  atMinimum: boolean
}

export const EMPTY_QUOTE: QuoteInputs = {
  service: 'full',
  groundPanes: 0,
  secondFloorPanes: 0,
  thirdFloorPanes: 0,
  slidingDoorPanels: 0,
  louverSets: 0,
  highInteriorPanes: 0,
  glassRailings: 0,
  solarPanels: 0,
  firstTime: true,
}

/** Round to the nearest $5 so quotes read as prices, not as calculations. */
function round5(n: number): number {
  return Math.round(n / 5) * 5
}

/** Web equivalent of 'Window Estimate'!E32 — the sum of the line totals. */
function paneSubtotal(i: QuoteInputs): number {
  const p = PRICING
  return (
    i.groundPanes * p.perPaneByFloor.ground +
    i.secondFloorPanes * p.perPaneByFloor.second +
    i.thirdFloorPanes * p.perPaneByFloor.third +
    i.slidingDoorPanels * p.perSlidingDoorPanel +
    i.louverSets * p.perLouverSet +
    i.highInteriorPanes * p.perHighInteriorPane +
    i.glassRailings * p.perGlassRailing
  )
}

/**
 * Mirrors the workbook:
 *   Full Service Price = Pane Subtotal × First-Time Multiplier   (E37)
 *   Exterior-Only      = Full Service × 0.7                      (E39)
 *   Minimum check      = if below Controls!B43, apply minimum    (E40)
 */
export function calculateQuote(inputs: QuoteInputs): QuoteRange {
  const p = PRICING

  let price = paneSubtotal(inputs)

  if (inputs.firstTime) price *= p.firstTimeMultiplier
  if (inputs.service === 'exterior') price *= p.exteriorOnlyFactor

  // Solar is billed flat as its own line item — not subject to the exterior
  // factor or the first-time multiplier.
  price += inputs.solarPanels * p.perSolarPanel

  const effective = Math.max(price, p.minimumCharge)

  /**
   * The floor applies to the QUOTED RANGE, not just the midpoint.
   *
   * Bug caught by Austin 2026-08-24: a job pricing at $276 sits above the $250
   * minimum, but spreading ±15% around it produced a low end of $235 — a number
   * we would never actually honour. Any displayed figure below the minimum is
   * wrong, so clamp the low end itself.
   */
  const low = Math.max(p.minimumCharge, round5(effective * (1 - p.rangeSpread)))
  const high = Math.max(low, round5(effective * (1 + p.rangeSpread)))

  /**
   * "At minimum" means the JOB ITSELF prices below the floor — not merely that
   * the clamp above trimmed the low end.
   *
   * Getting this wrong hid real information: 12 ground panes + 12 second-floor
   * + 2 slider panels prices at $276, comfortably above the $250 floor, but the
   * clamp pulled its low end to $250 and the old test fired — so the page
   * displayed "Starting at $250" and silently dropped the $315 top of the
   * range. A customer anchored on $250 who later hears $315 has been misled by
   * our own UI. Show the real band whenever there is one.
   */
  const atMinimum = price > 0 && price < p.minimumCharge

  return {
    low,
    high,
    point: effective,
    atMinimum,
  }
}

/** Has the customer entered enough for a quote to mean anything? */
export function hasEnoughInput(i: QuoteInputs): boolean {
  return paneSubtotal(i) > 0
}

/** "$340 – $460", or "Starting at $250" when the minimum is binding. */
export function formatRange(r: QuoteRange): string {
  if (r.atMinimum) return `Starting at $${r.low}`
  return `$${r.low.toLocaleString()} – $${r.high.toLocaleString()}`
}

/**
 * Plain-language recap of what was counted, so the number feels earned rather
 * than generated. Shows the counts, not the per-pane arithmetic.
 */
export function quoteBreakdown(i: QuoteInputs): string[] {
  const out: string[] = []
  const panes = i.groundPanes + i.secondFloorPanes + i.thirdFloorPanes
  if (panes > 0) out.push(`${panes} pane${panes === 1 ? '' : 's'} of glass`)
  if (i.slidingDoorPanels > 0)
    out.push(
      `${i.slidingDoorPanels} sliding door panel${i.slidingDoorPanels === 1 ? '' : 's'}`
    )
  if (i.louverSets > 0)
    out.push(`${i.louverSets} louver set${i.louverSets === 1 ? '' : 's'}`)
  if (i.highInteriorPanes > 0)
    out.push(`${i.highInteriorPanes} high interior pane${i.highInteriorPanes === 1 ? '' : 's'}`)
  if (i.glassRailings > 0)
    out.push(`${i.glassRailings} glass railing${i.glassRailings === 1 ? '' : 's'}`)
  if (i.solarPanels > 0) out.push(`${i.solarPanels} solar panels`)
  out.push(
    i.service === 'full'
      ? 'Full Service — inside, outside, screens, frames & tracks'
      : 'Exterior only'
  )
  return out
}

/**
 * The real photo instructions, lifted verbatim from the LSA auto-reply that
 * BPWC already sends (LSA_Auto-Reply_Build_Spec.md). Reused here so the
 * landing page asks for photos the same way the text message does — same
 * words, same expectations, no retraining customers mid-funnel.
 */
export const PHOTO_INSTRUCTIONS = {
  heading: 'How to photograph your home',
  steps: [
    'Walk around the outside and snap a photo of each section of the property',
    "Any windows you can't see from outside, just grab one from inside",
  ],
  reassurance:
    "Most customers finish this in under 2 minutes. It doesn't have to be perfect — just enough for us to see.",
  why: 'Photos are the fastest way to get an accurate quote and get you on the schedule right away.',
  /**
   * The promise that closes the loop. Photos don't narrow the range — they
   * replace it with a firm number. Keep this wording strong.
   */
  outcome: 'Your photos get you a final, exact price — no range, no walkthrough, no waiting.',
  /** SMS-specific: MMS drops large batches. Not needed for web upload. */
  smsNote:
    'Texting them instead? Send the photos one at a time so they come through properly.',
  fallback:
    "If photos aren't possible, give us a call and we'll walk you through it.",
} as const

/**
 * Maintenance plan pricing — Controls!B14:B17. The "it gets cheaper if you stay
 * on a schedule" upsell BPWC already advertises.
 */
export const MAINTENANCE_PLANS = [
  { id: 'bronze', label: 'Once a year', discount: 0.05 },
  { id: 'silver', label: 'Twice a year', discount: 0.1 },
  { id: 'gold', label: 'Every 3 months', discount: 0.15 },
  { id: 'platinum', label: 'Every 2 months', discount: 0.2 },
] as const

/** The steepest discount on offer — drives the "save up to X%" headline. */
export const MAX_PLAN_DISCOUNT = Math.max(
  ...MAINTENANCE_PLANS.map((p) => p.discount)
)

/**
 * Re-price an already-calculated quote under a maintenance plan.
 *
 * ⚠️  THE MINIMUM CHARGE STILL APPLIES.
 *
 * Controls!B43 covers travel, equipment and crew time for ANY visit, so a plan
 * discount can never take a visit below it. Without this clamp the 20% plan
 * would advertise $200 against a $250 job — a number BPWC would not honour.
 * This is the same class of bug as the range-spread one Austin caught on
 * 2026-08-24: any figure we PRINT below the minimum is wrong, no matter which
 * multiplier produced it.
 */
export function planQuote(base: QuoteRange, discount: number): QuoteRange {
  const factor = 1 - discount
  const low = Math.max(PRICING.minimumCharge, round5(base.low * factor))
  const high = Math.max(low, round5(base.high * factor))

  return {
    low,
    high,
    point: Math.max(PRICING.minimumCharge, base.point * factor),
    /**
     * The clamp ate the whole band, so there is no range left to show.
     *
     * Test the CLAMPED figures, not the raw ones. Austin's own house (12 ground
     * + 12 second-floor + 2 slider panels, $250 – $315) at the 20% plan gives
     * 315 × 0.8 = $252 — above the floor, so a raw test says "not at minimum" —
     * but round5 pulls it to $250, which is exactly the low end. That rendered
     * as "$250 – $250", which reads as a broken calculator.
     */
    atMinimum: high <= low,
  }
}

/**
 * Is there a plan discount worth showing this customer?
 *
 * Two ways the answer is no:
 *  1. The job already prices at the minimum charge — it's a floor, not an
 *     estimate, so there is nothing to take a percentage off.
 *  2. Even the steepest plan clamps back up to the minimum.
 *
 * Case 1 is the subtle one. An at-minimum quote still carries a nominal `high`
 * from the ±15% spread, so discounting it produced plan rows ABOVE the "$250"
 * the customer was just shown — a price list where committing to more frequent
 * service appeared to cost more. Never render the table in that state.
 */
export function planSavesMoney(base: QuoteRange): boolean {
  if (base.atMinimum) return false
  return planQuote(base, MAX_PLAN_DISCOUNT).high < base.high
}

/**
 * Plan price for the comparison table. Same as formatRange, except a collapsed
 * band shows as a flat "$250" rather than "Starting at $250" — inside a list of
 * four cadences the reader is comparing numbers, not reading a headline.
 */
export function formatPlanRange(r: QuoteRange): string {
  if (r.atMinimum) return `$${r.low.toLocaleString()}`
  return formatRange(r)
}
