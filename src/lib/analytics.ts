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
 * Micro-event: user chose to text photos rather than dial. This is the path we
 * actively want - the IVR's option 1 sends this same instruction text anyway,
 * so texting skips a phone tree and gets photos moving sooner.
 */
export function trackTextPhotos(source: 'call_sheet' | 'form'): void {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'text_photos_click', {
      event_category: 'engagement',
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
