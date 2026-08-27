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
 * Micro-event (not a conversion): user tapped a call button and was shown the
 * "text photos instead" sheet. Measures call INTENT, which at BPWC's traffic
 * volume accumulates far faster than actual conversions and is one of the few
 * signals readable on a weekly basis.
 */
export function trackCallIntent(): void {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'call_intent', {
      event_category: 'engagement',
      event_label: 'call_sheet_opened',
    })
  }
}

/**
 * SECONDARY conversion action: "LP - Text photos clicked" (created 2026-08-26).
 *
 * Marked *secondary* in Google Ads, so it is deliberately excluded from the
 * "Conversions" column and is NOT used for bidding optimisation. It exists
 * purely so engagement is readable in days rather than the 2–3 weeks a real
 * conversion rate needs at ~15–20 clicks/week.
 *
 * ⚠️  A bare gtag('event', 'text_photos_click', …) — which is what this used to
 * fire — reaches nothing. Google Ads only records an event as a conversion when
 * it is sent as `event: 'conversion'` with a `send_to` label. The old GA4-style
 * call looked like tracking and recorded nothing anywhere, because there is no
 * GA4 property on this page. Keep the send_to.
 *
 * No `value` is sent on purpose: a fake $1 would pollute conversion-value
 * reporting for a click that is not revenue.
 */
const TEXT_PHOTOS_LABEL = 'AW-921629287/PkJICL7tzegcEOfku7cD'

export function trackTextPhotos(source: 'call_sheet' | 'form'): void {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', {
      send_to: TEXT_PHOTOS_LABEL,
      event_label: source,
    })
  }
}

/** Micro-event: user chose to dial anyway after seeing the sheet. */
export function trackCallPlaced(): void {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'call_placed', {
      event_category: 'engagement',
      event_label: 'from_call_sheet',
    })
  }
}

/**
 * Micro-event (not a conversion): user tapped "Send This To My Phone".
 * Used to understand how many desktop users hand off to mobile.
 */
export function trackSendToPhone(): void {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'send_to_phone_click', {
      event_category: 'engagement',
      event_label: 'estimate_handoff',
    })
  }
}
