import { useRef, useState } from 'react'
import {
  Camera,
  Check,
  MessageSquare,
  Minus,
  Phone,
  Plus,
  Star,
  Upload,
  X,
} from 'lucide-react'
import {
  calculateQuote,
  formatRange,
  hasEnoughInput,
  quoteBreakdown,
  PRICING,
  PHOTO_INSTRUCTIONS,
  EMPTY_QUOTE,
  type QuoteInputs,
  type ServiceLevel,
} from '@/lib/pricing'
import { LOGO_SRC } from '@/logoData'
import {
  fireEstimateConversion,
  fireMetaLead,
  trackCallIntent,
  trackCallPlaced,
  trackTextPhotos,
} from '@/lib/analytics'

/**
 * The Blue Pacific landing page — one page, one scroll, no wizard.
 *
 * Replaces the previous six-screen estimate app entirely. Austin, 2026-08-24:
 * "ditch the entire existing app and start fresh with a full landing page and
 * this calculator in it. Nice, fresh, branded, with marketing. Not so many
 * steps."
 *
 * Structure, in the order a visitor from a "window cleaning oahu" ad meets it:
 *
 *   Hero (proof + two ways to act)
 *     ↓
 *   Calculator — a real price, with nothing asked in return
 *     ↓
 *   Contact form, revealed only once a price exists
 *     ↓
 *   Marketing: how it works · what's included · reviews · guarantee · area
 *
 * The single most important sequencing rule: THE PRICE COMES BEFORE THE ASK.
 * The form does not exist in the DOM until the visitor has a number. They
 * receive before they give.
 *
 * Mobile is call-first — a tap-to-call bar is fixed to the bottom of the
 * viewport on small screens throughout. Desktop is form-first. That's the
 * reverse of the old Swipe Pages setup, which had it backwards.
 */

const PHONE_DISPLAY = '(808) 207-2939'
const PHONE_E164 = '+18082072939'

/**
 * Pre-filled text so the customer doesn't have to compose anything — they tap,
 * their messaging app opens addressed to us with this already typed, and all
 * that's left is attaching photos.
 *
 * The `?&body=` form is deliberate: iOS expects `&` after the number and
 * Android expects `?`. `?&` is the one construction both parse correctly.
 */
const SMS_HREF = `sms:${PHONE_E164}?&body=${encodeURIComponent(
  "Aloha! I'd like a window cleaning estimate — sending photos now."
)}`

/**
 * REAL review numbers, pulled from the live listings on 2026-08-24.
 *
 * Google and Yelp were read directly off each profile. Facebook shows "100%
 * recommend" publicly; the count of 18 comes from search indexing, since the
 * full page sits behind a login wall.
 *
 * The old Swipe Pages figures (4.9★/49, 5★/200+, 5★/240+, 5★/15+) were stale
 * and unattributed — Google has since grown from 200+ to 240, and Yelp ticked
 * from 49 to 50 and up to a clean 5.0. Re-check these every few months; a stale
 * review count is a small credibility leak on a page built to earn trust.
 *
 * Sources:
 *   Google — maps.google.com/maps?cid=12287644772206425146
 *   Yelp   — yelp.com/biz/blue-pacific-window-cleaning-honolulu-2
 *   FB     — facebook.com/bluepacificwindowcleaning/reviews
 */
const REVIEWS = [
  { rating: '5.0', count: '240 reviews', source: 'Google' },
  { rating: '5.0', count: '50 reviews', source: 'Yelp' },
  { rating: '100%', count: 'recommend', source: 'Facebook' },
]

/** Total across the three verified platforms: 240 + 50 + 18 = 308. */
const TOTAL_REVIEWS = '300+'

/**
 * Real customer reviews, quoted verbatim from bluepacificwindowcleaning.com.
 * Named customers with a named platform are far stronger proof than anonymous
 * praise — and these mention the techs by name, which reads as genuine.
 */
const TESTIMONIALS = [
  {
    quote:
      "Blue Pacific's window cleaning service is amazing! After they were done I thought they forgot to put the screens on but they didn't! So clean I couldn't see them.",
    name: 'Kulia Pacheco',
    source: 'Google',
  },
  {
    quote:
      'I shopped around before I decided to go with Blue Pacific. They did a very thorough fabulous job for the price I paid. Austin the owner was very personable, knowledgeable, professional and such a great guy all around.',
    name: 'Iris Kinerney',
    source: 'Google',
  },
  {
    quote:
      'Professional, friendly, very affordable and great work. Thank you Marco! I have a lot of big sliders so it was no small job. 100% recommend.',
    name: 'Colleen Haviland',
    source: 'Facebook',
  },
]

const INCLUDED = [
  'Interior and exterior glass',
  'Screens cleaned',
  'Frames wiped down',
  'Tracks vacuumed and detailed',
]

const STEPS = [
  {
    title: 'Count your panes',
    body: 'Takes about a minute. You get a real price range on the spot — no waiting, no sales call.',
  },
  {
    title: 'Send a few photos',
    body: 'Upload them here or text them to us. Photos turn your range into a final, exact price.',
  },
  {
    title: 'Pick your day',
    body: "We text you when the crew's on the way, so you're never sitting around waiting.",
  },
]

type CounterKey =
  | 'groundPanes'
  | 'secondFloorPanes'
  | 'thirdFloorPanes'
  | 'slidingDoorPanels'
  | 'louverSets'
  | 'highInteriorPanes'
  | 'glassRailings'

const FIELDS: { key: CounterKey; label: string; hint: string }[] = [
  { key: 'groundPanes', label: 'Ground-floor panes', hint: 'Panes of glass on the first floor' },
  { key: 'secondFloorPanes', label: 'Second-floor panes', hint: 'Anything on the second story' },
  { key: 'thirdFloorPanes', label: 'Third-floor panes', hint: 'Leave at 0 for most homes' },
  { key: 'slidingDoorPanels', label: 'Sliding door panels', hint: 'A slider that opens one side is 2' },
  { key: 'louverSets', label: 'Louvers / jalousies', hint: 'Count each set of slats' },
  {
    key: 'highInteriorPanes',
    label: 'High interior panes',
    hint: 'Needs a stool or ladder inside — including small panes above other windows',
  },
  { key: 'glassRailings', label: 'Glass railings', hint: 'Lanai or stair railing sections' },
]

export default function LandingPage() {
  const [q, setQ] = useState<QuoteInputs>(EMPTY_QUOTE)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const [callSheet, setCallSheet] = useState(false)

  const calcRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  /**
   * Every call button opens this sheet rather than dialling straight away.
   *
   * Austin, 2026-08-24: "If they call and press 1 they're just getting that
   * text anyway." The IVR's option 1 sends the photo instructions by SMS, so
   * dialling to reach it is a detour through a phone tree. The sheet offers the
   * text directly — and still dials for anyone who actually wants to talk.
   *
   * Deliberately not a dark pattern: "Call us anyway" is a full-width button,
   * not a buried link, and the sheet says plainly what the call would do.
   */
  const openCallSheet = () => {
    trackCallIntent()
    setCallSheet(true)
  }

  const quote = calculateQuote(q)
  const priced = hasEnoughInput(q)

  const bump = (key: CounterKey, d: number) =>
    setQ((p) => ({ ...p, [key]: Math.max(0, p[key] + d) }))

  const scrollTo = (r: React.RefObject<HTMLDivElement>) =>
    r.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Please add your name')
    if (phone.replace(/\D/g, '').length < 10)
      return setError('Please add a phone number we can text')
    if (!address.trim()) return setError('Please add the service address')
    setError('')
    setSending(true)

    try {
      /**
       * Photos have to be uploaded FIRST — /api/submit-estimate takes
       * `photoUrls` (strings), not files. An earlier version of this component
       * held the File objects in state and sent only a count, which the API
       * would have rejected outright. Caught before launch; don't reintroduce.
       */
      let photoUrls: string[] = []
      if (photos.length > 0) {
        const fd = new FormData()
        photos.forEach((f) => fd.append('photos', f))
        const up = await fetch('/api/upload-photos', { method: 'POST', body: fd })
        if (!up.ok) throw new Error('upload failed')
        photoUrls = (await up.json()).photoUrls ?? []
      }

      const textingPhotos = photoUrls.length === 0

      const payload = {
        name,
        phone,
        address,
        services: ['windows'],
        windowService:
          q.service === 'full' ? 'interior-exterior' : 'exterior-only',
        notes: [
          `Customer's own count → ${formatRange(quote)}`,
          ...quoteBreakdown(q).map((l) => `  • ${l}`),
          '(Estimate from customer-entered counts. Confirm against photos.)',
          textingPhotos
            ? '⚠️ NO PHOTOS UPLOADED — customer chose to text them instead. Watch for an MMS from this number.'
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        photoUrls,
      }

      const res = await fetch('/api/submit-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('submit failed')
      // Fire once, only after the submission actually succeeds.
      fireEstimateConversion()
      fireMetaLead()
      setDone(true)
    } catch {
      setError(
        `Something went wrong sending that. Please call or text us at ${PHONE_DISPLAY} and we'll sort it out.`
      )
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <Check className="h-8 w-8 text-green-700" />
        </div>
        <h1 className="mt-6 text-3xl font-bold text-slate-900">
          Got it, {name.split(' ')[0]}.
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          We&rsquo;ll text you at {phone} shortly with your final price.
        </p>
        <p className="mt-6 rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
          Haven&rsquo;t sent photos yet? Text them to{' '}
          <a
            href={SMS_HREF}
            onClick={() => trackTextPhotos('form')}
            className="font-semibold underline"
          >
            {PHONE_DISPLAY}
          </a>{' '}
          and we&rsquo;ll have your exact price back to you faster.
        </p>
      </div>
    )
  }

  return (
    <div className="pb-24 md:pb-0">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden">
        {/* Uses the filename already committed to the repo — byte-identical to
            the local crew.jpg, so there was no need to add a duplicate. */}
        <img
          src="/crew-window-cleaning.jpg"
          alt="Blue Pacific technicians cleaning windows on an Oahu home"
          className="absolute inset-0 h-full w-full object-cover object-center"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-900/70 to-slate-900/85" />

        <div className="relative mx-auto max-w-3xl px-6 py-14 text-center sm:py-20">
          {/*
            The brand logo is a WIDE mark (≈2.86:1) — size it by width, never by
            height, or the artwork collapses to a sliver.

            It sits on a white card rather than being knocked out to white: the
            mark has a blue-to-teal gradient squeegee and shaded lettering, and a
            flat white silhouette throws all of that away. A white plate keeps
            the logo exactly as drawn and reads cleanly against the dark hero.

            The source is the inlined data URI from src/logoData.ts, not
            /logo.png — the PNG committed to public/ is a corrupt file no decoder
            can read, which is why the logo rendered broken on the old page.
            LOGO_SRC is a white-background JPEG, which is invisible here because
            it sits on the white card.
          */}
          <div className="mx-auto inline-block rounded-2xl bg-white px-6 py-4 shadow-lg">
            <img
              src={LOGO_SRC}
              alt="Blue Pacific Window Cleaning"
              width={600}
              height={215}
              className="w-52 sm:w-64"
              fetchPriority="high"
            />
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-sky-300">
            Streak free windows, every time
          </p>
          <h1 className="mt-2 text-4xl font-bold leading-tight text-white sm:text-5xl">
            Oahu&rsquo;s #1 rated window cleaners
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-200">
            Get a real price in about a minute. No walkthrough, no waiting on a
            callback, no pressure.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => scrollTo(calcRef)}
              className="rounded-xl bg-sky-500 px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-sky-400"
            >
              See my price
            </button>
            <button
              onClick={openCallSheet}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-4 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <Phone className="h-4 w-4" />
              {PHONE_DISPLAY}
            </button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {REVIEWS.map((r) => (
              <div key={r.count} className="text-center">
                <div className="flex items-center justify-center gap-1 text-amber-400">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="text-base font-bold text-white">
                    {r.rating}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-300">{r.count}</div>
                {r.source && (
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    {r.source}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-slate-300">
            {TOTAL_REVIEWS} five-star reviews &middot; Serving Oahu for over 30
            years &middot; Licensed &amp; insured
          </p>
        </div>
      </header>

      {/* ── Calculator ───────────────────────────────────────────────────── */}
      <section ref={calcRef} className="bg-slate-50 px-4 py-14 sm:py-16">
        <div className="mx-auto max-w-lg">
          <h2 className="text-center text-3xl font-bold text-slate-900">
            See your price
          </h2>
          <p className="mt-2 text-center text-slate-600">
            No email required. We&rsquo;ll confirm the exact price from your
            photos.
          </p>

          <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            <strong className="font-semibold">
              Count panes of glass, not windows.
            </strong>{' '}
            One window can hold more than one pane. A slider that opens on one
            side is 2 panes. A single fixed picture window is 1.
          </div>

          <div className="mt-5 flex gap-2">
            {(
              [
                ['full', 'Full service'],
                ['exterior', 'Exterior only'],
              ] as [ServiceLevel, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setQ((p) => ({ ...p, service: value }))}
                className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                  q.service === value
                    ? 'border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            {q.service === 'full'
              ? 'Inside, outside, screens, frames and tracks.'
              : 'Outside surfaces only. Screens not included.'}
          </p>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {FIELDS.map((f, i) => (
              <div
                key={f.key}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  i < FIELDS.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    {f.label}
                  </div>
                  <div className="text-xs leading-snug text-slate-500">
                    {f.hint}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    aria-label={`Decrease ${f.label}`}
                    onClick={() => bump(f.key, -1)}
                    disabled={q[f.key] === 0}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700 disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-[28px] text-center text-lg font-bold tabular-nums text-slate-900">
                    {q[f.key]}
                  </span>
                  <button
                    aria-label={`Increase ${f.label}`}
                    onClick={() => bump(f.key, 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-700"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-5 rounded-2xl border-2 border-sky-100 bg-white p-5 text-center"
            aria-live="polite"
          >
            <div className="text-sm font-medium text-slate-600">
              Your estimated range
            </div>
            <div className="mt-1 text-4xl font-bold text-slate-900">
              {priced ? formatRange(quote) : '—'}
            </div>
            {priced ? (
              <>
                <ul className="mt-3 space-y-0.5">
                  {quoteBreakdown(q).map((l) => (
                    <li key={l} className="text-xs text-slate-600">
                      {l}
                    </li>
                  ))}
                </ul>
                {quote.atMinimum && (
                  <p className="mt-2 text-xs text-slate-500">
                    Our ${PRICING.minimumCharge} minimum covers travel,
                    equipment and crew time for any visit.
                  </p>
                )}
                <button
                  onClick={() => scrollTo(formRef)}
                  className="mt-5 w-full rounded-xl bg-sky-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-sky-500"
                >
                  Get my exact price
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Add your panes above to see a price.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Contact — only exists once a price does ──────────────────────── */}
      {priced && (
        <section ref={formRef} className="bg-white px-4 py-14 sm:py-16">
          <div className="mx-auto max-w-lg">
            <h2 className="text-center text-3xl font-bold text-slate-900">
              Get your exact price
            </h2>
            <p className="mt-2 text-center text-slate-600">
              {PHOTO_INSTRUCTIONS.outcome}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Service address"
                autoComplete="street-address"
                className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Camera className="h-4 w-4" />
                  {PHOTO_INSTRUCTIONS.heading}
                </div>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {PHOTO_INSTRUCTIONS.steps.map((s) => (
                    <li key={s}>&bull; {s}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  {PHOTO_INSTRUCTIONS.reassurance}
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-sky-400">
                    <Upload className="h-4 w-4" />
                    {photos.length
                      ? `${photos.length} photo${photos.length === 1 ? '' : 's'} added`
                      : 'Upload photos'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) =>
                        setPhotos(Array.from(e.target.files ?? []))
                      }
                    />
                  </label>

                  {/* The path most BPWC customers already use. Austin confirmed
                      MMS works fine in small batches, and the existing LSA
                      auto-reply sends people to this exact number. */}
                  <a
                    href={SMS_HREF}
                    onClick={() => trackTextPhotos('form')}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-sky-400"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Text photos instead
                  </a>
                </div>
                <p className="mt-2 text-center text-xs text-slate-500">
                  Texting? Send them to {PHONE_DISPLAY} a few at a time so they
                  come through properly. You can submit this form either way.
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-xl bg-sky-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Send my estimate request'}
              </button>
              <p className="text-center text-xs text-slate-500">
                We&rsquo;ll text you your final price. No spam, no sales calls.
              </p>
            </form>
          </div>
        </section>
      )}

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="bg-slate-50 px-4 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-slate-900">
            How it works
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl bg-white p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Real reviews ─────────────────────────────────────────────────── */}
      <section className="bg-white px-4 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold text-slate-900">
            What Oahu says about us
          </h2>
          <p className="mt-2 text-center text-slate-600">
            {TOTAL_REVIEWS} five-star reviews across Google, Yelp and Facebook.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex gap-0.5 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold text-slate-900">{t.name}</span>
                  <span className="text-slate-500"> &middot; {t.source}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Included + guarantee ─────────────────────────────────────────── */}
      <section className="bg-white px-4 py-14">
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              What full service includes
            </h2>
            <ul className="mt-4 space-y-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2 text-slate-700">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-sky-600" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-600">
              Get on a regular schedule and save up to 20% on every visit.
            </p>
          </div>
          <div className="rounded-2xl bg-sky-50 p-6">
            <h2 className="text-2xl font-bold text-sky-950">
              Satisfaction guaranteed
            </h2>
            <p className="mt-3 text-sky-900">
              If something isn&rsquo;t right, tell us and we&rsquo;ll come back
              and re-clean it. No argument, no invoice.
            </p>
            <p className="mt-4 text-sm text-sky-800">
              We text you when the crew is on the way, so you&rsquo;re never
              stuck waiting on a four-hour window.
            </p>
          </div>
        </div>
      </section>

      {/* ── Service area ─────────────────────────────────────────────────── */}
      <section className="bg-slate-900 px-4 py-14 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-white">
            All of Oahu, North Shore to town
          </h2>
          <p className="mt-3 text-slate-300">
            One, two and three story homes. Condos and townhomes. If
            you&rsquo;re on the island, we cover you.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={() => scrollTo(calcRef)}
              className="rounded-xl bg-sky-500 px-7 py-4 font-semibold text-white hover:bg-sky-400"
            >
              See my price
            </button>
            <button
              onClick={openCallSheet}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/30 px-7 py-4 font-semibold text-white hover:bg-white/10"
            >
              <Phone className="h-4 w-4" />
              {PHONE_DISPLAY}
            </button>
          </div>
          <p className="mt-8 text-xs text-slate-500">
            Blue Pacific Window Cleaning &middot; Serving Oahu for over 30 years
          </p>
        </div>
      </section>

      {/* ── Mobile call bar — call-first on the device that can call ─────── */}
      <button
        onClick={openCallSheet}
        className="fixed inset-x-0 bottom-0 z-40 flex w-full items-center justify-center gap-2 bg-sky-600 py-4 text-base font-semibold text-white shadow-lg md:hidden"
      >
        <Phone className="h-5 w-5" />
        Call {PHONE_DISPLAY}
      </button>

      {/* ── Call sheet — offers the text before the phone tree ───────────── */}
      {callSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Get your estimate"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4"
          onClick={() => setCallSheet(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">
                Fastest way to get your price
              </h2>
              <button
                onClick={() => setCallSheet(false)}
                aria-label="Close"
                className="-m-2 p-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              If you call and press 1, we just text you these same instructions.
              Skip the step &mdash; text us your photos and we&rsquo;ll send back
              a final, exact price.
            </p>

            <div className="mt-4 rounded-xl bg-sky-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-950">
                <Camera className="h-4 w-4" />
                {PHOTO_INSTRUCTIONS.heading}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-sky-900">
                {PHOTO_INSTRUCTIONS.steps.map((s) => (
                  <li key={s}>&bull; {s}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-sky-800">
                {PHOTO_INSTRUCTIONS.reassurance}
              </p>
            </div>

            <a
              href={SMS_HREF}
              onClick={() => trackTextPhotos('call_sheet')}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-4 text-base font-semibold text-white hover:bg-sky-500"
            >
              <MessageSquare className="h-5 w-5" />
              Text photos to {PHONE_DISPLAY}
            </a>

            {/* Full-width and unmissable — someone who wants a human gets one. */}
            <a
              href={`tel:${PHONE_E164}`}
              onClick={() => trackCallPlaced()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-300 px-6 py-4 text-base font-semibold text-slate-700 hover:border-slate-400"
            >
              <Phone className="h-5 w-5" />
              Call us anyway
            </a>

            <p className="mt-3 text-center text-xs text-slate-500">
              Rather do it here? Close this and use the calculator &mdash; you
              can upload photos on the form.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
