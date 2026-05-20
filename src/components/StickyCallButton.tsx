import { Phone } from 'lucide-react'

/**
 * Mobile-only sticky call button. Floats in the bottom-right corner so a
 * high-intent-but-unsure visitor can always reach a person without scrolling
 * to find a link. Hidden on md+ screens; styled as a secondary element so it
 * doesn't compete with the primary CTAs.
 */
export default function StickyCallButton() {
  return (
    <a
      href="tel:+18082072939"
      className="md:hidden fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border-2 border-sky-300 bg-white/95 px-4 py-2.5 text-sm font-semibold text-sky-700 shadow-lg backdrop-blur-sm transition-colors hover:bg-sky-50"
      aria-label="Call Blue Pacific Window Cleaning at (808) 207-2939"
    >
      <Phone className="h-4 w-4" />
      (808) 207-2939
    </a>
  )
}
