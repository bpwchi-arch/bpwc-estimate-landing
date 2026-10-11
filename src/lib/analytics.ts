// Analytics helpers (Google Ads + Meta Pixel).
// Base tags are loaded in index.html: Google Ads gtag.js (AW-921629287) and the
// Meta Pixel (741350435355995). These helpers fire events from within the React
// app. All calls are guarded so they no-op safely if a tag hasn't loaded (e.g.
// blocked by an ad blocker) and never throw.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
    fbq?: (...args: unknown[]) => void
  }
}

/**
 * Google Ads Conversion: Estimate Form Submitted.
 * Call this ONCE, immediately after the estimate submission succeeds
 * (after the /api/submit-estimate -> Quo webhook returns OK).
 * Do NOT call it on click, on mount, or if submission fails.
 */
export function fireEstimateConversion(): void {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', {
      send_to: 'AW-921629287/eCSXCJ_84KUcEOfku7cD',
    })
  }
}

/**
 * Meta Pixel: Lead event. Call this ONCE in the same place as
 * fireEstimateConversion() (right after the submission succeeds). This is the
 * signal Meta optimizes ad delivery toward. Guarded so it no-ops if the Pixel
 * is blocked or not yet loaded.
 */
export function fireMetaLead(): void {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Lead')
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ENGAGEMENT MICRO-CONVERSIONS  (all SECONDARY in Google Ads)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Every one of these is registered as a *secondary* conversion action: excluded
 *  from the "Conversions" column and NOT used for bidding optimisation. They
 *  exist so engagement is readable in days rather than the 2–3 weeks a real
 *  conversion rate needs at ~15–20 clicks/week.
 *
 *  ⚠️  THEY MUST BE SENT AS `event: 'conversion'` WITH A `send_to` LABEL.
 *
 *  Until 2026-08-26 these fired as bare GA4-style events —
 *  gtag('event', 'call_intent', { event_category… }) — which recorded NOTHING,
 *  anywhere. There is no GA4 property on this site, and Google Ads only counts
 *  an event when it carries a conversion label. They looked like tracking and
 *  were dead code for months. If you add another micro-event, create the
 *  conversion action first and put its label here.
 *
 *  No `value` is sent on purpose: a fake $1 would pollute conversion-value
 *  reporting for clicks that are not revenue.
 */
const LABELS = {
  /** Call button tapped → "text photos instead" sheet shown. */
  callIntent: 'AW-921629287/SJ7eCIXq2OgcEOfku7cD',
  /** Chose to dial anyway after seeing the sheet. */
  callPlaced: 'AW-921629287/-HrjCIjq2OgcEOfku7cD',
  /** Desktop visitor sent the estimate link to their phone. */
  sendToPhone: 'AW-921629287/Y06NCIvq2OgcEOfku7cD',
  /** Chose to text photos — the path we actively want. */
  textPhotos: 'AW-921629287/PkJICL7tzegcEOfku7cD',
} as const

function fireMicroConversion(label: string, context: string): void {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', {
      send_to: label,
      event_label: context,
    })
  }
}

/**
 * Call INTENT — the sheet opened, before any dial. At BPWC's volume this
 * accumulates far faster than real conversions.
 */
export function trackCallIntent(): void {
  fireMicroConversion(LABELS.callIntent, 'call_sheet_opened')
}

/**
 * Chose to text photos rather than dial — the path we actively want, since the
 * IVR's option 1 sends this same instruction text anyway.
 */
export function trackTextPhotos(source: 'call_sheet' | 'form'): void {
  fireMicroConversion(LABELS.textPhotos, source)
}

/** Chose to dial anyway after seeing the sheet. */
export function trackCallPlaced(): void {
  fireMicroConversion(LABELS.callPlaced, 'from_call_sheet')
}

/** Desktop visitor tapped "Send This To My Phone" — a handoff to mobile. */
export function trackSendToPhone(): void {
  fireMicroConversion(LABELS.sendToPhone, 'estimate_handoff')
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PROPERTY-MANAGER INQUIRY  (/property-managers)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  A separate Google Ads conversion action from the homeowner estimate. The
 *  label defaults to the "PM / AOAO qualified inquiry" action created 10/10/2026
 *  (gPIHCL3KopgdEOfku7cD, secondary/observation) and can be overridden with
 *  VITE_PM_CONVERSION_LABEL at build time
 *  so the action can be created in Google Ads first and wired without a code
 *  change. When the env var is unset the call is skipped entirely (and says so
 *  in the console) rather than firing an event with a broken send_to.
 *
 *  Call ONCE, only after /api/pm-inquiry returns ok for a QUALIFIED (1–4
 *  story) property. Tower submissions never reach the API and never fire this.
 *  Never fire the homeowner 'Lead' / estimate conversion from the PM form.
 */
/** Google Ads conversion action "PM / AOAO qualified inquiry" (AW-921629287), created 2026-10-10. */
const PM_CONVERSION_LABEL = 'gPIHCL3KopgdEOfku7cD'

export function firePmInquiryConversion(): void {
  const label = (import.meta.env.VITE_PM_CONVERSION_LABEL as string | undefined) || PM_CONVERSION_LABEL
  if (!label) {
    console.info('[analytics] no PM conversion label — skipping Google Ads PM conversion')
  } else if (typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', { send_to: `AW-921629287/${label}` })
  }
  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', 'PMInquiry')
  }
}
