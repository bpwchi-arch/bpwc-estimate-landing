import { useEffect, useState, type FormEvent } from 'react'
import { Check, Mail, Phone, Users } from 'lucide-react'
import { LOGO_SRC } from '@/logoData'
import {
  getCommunity,
  computeTier,
  dayFillPercent,
  planManHours,
  COMMUNITY_SERVICES,
  CREW_DAY_MAN_HOURS,
  type CommunityService,
  type TierStatus,
} from '@/lib/communities'

/**
 * /community/:slug — unlisted sign-up page for one community's group-rate day.
 *
 * One URL per community, all driven by src/lib/communities.ts. The page does
 * three things: explains the group rate, shows the live tier (fetched from
 * /api/community/:slug), and takes a sign-up. No price is ever shown pre-netted
 * with the discount — the discount is its own line at invoicing, so the number
 * on the page is always the fixed floor-plan price.
 *
 * No conversion events here on purpose: these visitors arrive from a board
 * email or a flyer, not an ad.
 */

const PHONE_DISPLAY = '(808) 207-2939'
const PHONE_E164 = '+18082072939'
const EMAIL = 'sales@bpwchi.com'

const INPUT =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100'
const LABEL = 'block text-sm font-semibold text-slate-800'

interface Summary {
  count: number
  totalManHours: number
  tier: TierStatus
  dayFill: number
  byDay: Record<string, number>
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

export default function CommunityPage({ slug }: { slug: string }) {
  const community = getCommunity(slug)

  const [summary, setSummary] = useState<Summary | null>(null)
  const [unit, setUnit] = useState('')
  const [floorPlan, setFloorPlan] = useState('')
  const [service, setService] = useState<CommunityService>('exterior')
  const [day, setDay] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!community) return
    document.title = `${community.name} group rate | Blue Pacific Window Cleaning`
    let cancelled = false
    fetch(`/api/community/${community.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Summary | null) => {
        if (!cancelled && s) setSummary(s)
      })
      .catch(() => {
        /* roster is a nicety; the page works without it */
      })
    return () => {
      cancelled = true
    }
  }, [community])

  if (!community) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">We couldn&rsquo;t find that community page.</h1>
        <p className="mt-3 text-base text-slate-600">
          Check the link you were sent, or call us at{' '}
          <a href={`tel:${PHONE_E164}`} className="font-semibold text-sky-700 underline">
            {PHONE_DISPLAY}
          </a>
          .
        </p>
      </div>
    )
  }

  const total = summary?.totalManHours ?? 0
  const tier = summary?.tier ?? computeTier(0, community.tiers)
  const dayFill = summary?.dayFill ?? dayFillPercent(0)
  const count = summary?.count ?? 0
  const hasDays = community.days.length > 0

  // What this sign-up would add — shown next to the tier so the visitor sees
  // their own effect before they commit.
  const chosenPlan = community.floorPlans.find((p) => p.id === floorPlan)
  const myHours = chosenPlan ? planManHours(chosenPlan, service) : 0
  const tierAfterMe = computeTier(total + myHours, community.tiers)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!unit.trim()) return setError('Please enter your unit number.')
    if (!floorPlan) return setError('Please pick your floor plan.')
    if (!phone.trim()) return setError('A mobile number is required so we can text your arrival window.')

    setSending(true)
    try {
      const res = await fetch(`/api/community/${community!.slug}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit: unit.trim(),
          floorPlan,
          service,
          day,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          notes: notes.trim(),
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.message || 'submit failed')
      if (body?.summary) setSummary(body.summary)
      setDone(true)
    } catch (err) {
      setError(
        err instanceof Error && err.message !== 'submit failed'
          ? err.message
          : `Something went wrong sending that. Please text or call ${PHONE_DISPLAY}.`
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white text-slate-900">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:py-14">
          <div className="mx-auto inline-block rounded-2xl bg-white px-5 py-3 shadow-lg">
            <img src={LOGO_SRC} alt="Blue Pacific Window Cleaning" width={600} height={215} className="w-40 sm:w-48" />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-sky-300">
            Community group rate &middot; {community.area}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{community.name}</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
            {community.intro}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        {/* ── How it works ─────────────────────────────────────────────── */}
        <section className="py-12">
          <h2 className="text-2xl font-bold text-slate-900">How the group rate works</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ['Pick your floor plan', 'Every unit of the same plan pays the same fixed price.'],
              ['Pick a community day', 'The crew does the whole community in one trip, so the price can be lower.'],
              ['The discount grows as neighbors join', 'Shown live below. It is applied as its own line on your invoice.'],
            ].map(([t, b], i) => (
              <li key={t} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <p className="mt-3 font-semibold text-slate-900">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{b}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Price list ───────────────────────────────────────────────── */}
        <section className="pb-12">
          <h2 className="text-2xl font-bold text-slate-900">Floor plans and prices</h2>
          {!community.priced && community.walkthroughNote && (
            <p className="mt-2 rounded-xl bg-sky-50 p-4 text-sm leading-relaxed text-sky-900">
              {community.walkthroughNote}
            </p>
          )}
          <ul className="mt-5 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {community.floorPlans.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{p.name}</p>
                  <p className="text-sm text-slate-600">{p.description}</p>
                </div>
                <p className="text-base text-slate-800 sm:text-right">
                  {p.priced && p.exteriorPrice !== undefined && p.insideOutsidePrice !== undefined ? (
                    <>
                      Outside only <span className="font-semibold">{money(p.exteriorPrice)}</span>
                      {' · '}
                      Inside + outside <span className="font-semibold">{money(p.insideOutsidePrice)}</span>
                      <span className="text-sm text-slate-500">, plus GET</span>
                    </>
                  ) : (
                    <span className="text-slate-500">Set after walkthrough</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
          {community.priced && (
            <p className="mt-3 text-sm text-slate-500">
              Prices above are the fixed floor-plan prices. The group discount is applied as its own line at
              invoicing, so what you see here is never pre-discounted.
            </p>
          )}
        </section>

        {/* ── Live tier panel ──────────────────────────────────────────── */}
        <section className="pb-12">
          <div className="rounded-2xl bg-slate-900 p-6 text-white" aria-live="polite">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sky-300">
              <Users className="h-4 w-4" /> Live group status
            </div>
            <p className="mt-3 text-lg leading-relaxed">
              <span className="font-bold">{count}</span> {count === 1 ? 'unit has' : 'units have'} joined &middot;{' '}
              <span className="font-bold">{dayFill}%</span> of a crew day booked &middot; current group discount:{' '}
              <span className="font-bold">{tier.pct}%</span>
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-sky-400 transition-all"
                style={{ width: `${Math.min(100, dayFill)}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-300">
              {tier.nextTier
                ? `Next tier at ${tier.nextTier.minManHours} crew hours (${tier.nextTier.label}): ${tier.nextTier.pct}% off. ` +
                  `${Math.max(0, Math.round((tier.nextTier.minManHours - total) * 10) / 10)} more crew hours to go.`
                : `Top tier reached (${tier.label}).`}
            </p>
            {chosenPlan && !done && (
              <p className="mt-2 text-sm text-sky-200">
                Your {chosenPlan.name}, {COMMUNITY_SERVICES.find((s) => s.id === service)?.label.toLowerCase()}, adds{' '}
                {myHours} crew {myHours === 1 ? 'hour' : 'hours'}
                {tierAfterMe.pct > tier.pct ? ` and moves the group to ${tierAfterMe.pct}% off.` : '.'}
              </p>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Tiers are based on crew hours booked, not unit count: an inside + outside unit takes about twice as
              long as outside only. One crew day is {CREW_DAY_MAN_HOURS} crew hours.
            </p>
          </div>
        </section>

        {/* ── Community days ───────────────────────────────────────────── */}
        <section className="pb-12">
          <h2 className="text-2xl font-bold text-slate-900">Community days</h2>
          {hasDays ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {community.days.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-5">
                  <span className="font-semibold text-slate-900">{d.label}</span>
                  <span className="text-sm text-slate-600">
                    {summary?.byDay?.[d.id] ?? 0} signed up
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-slate-300 p-5 text-base text-slate-600">
              Community days are announced once the first owners sign up. Sign up now and we&rsquo;ll text you the
              options.
            </p>
          )}
        </section>

        {/* ── Sign-up form ─────────────────────────────────────────────── */}
        <section id="signup" className="pb-16">
          {done ? (
            <div role="status" aria-live="polite" className="rounded-2xl bg-slate-50 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-700" />
              </div>
              <h2 className="mt-6 text-2xl font-bold text-slate-900">You&rsquo;re on the list for {community.name}.</h2>
              <p className="mt-3 text-lg text-slate-600">We&rsquo;ll text you the arrival window the day before.</p>
              <p className="mt-6 text-sm text-slate-500">
                Questions? Text or call{' '}
                <a href={`tel:${PHONE_E164}`} className="font-semibold text-sky-700 underline">
                  {PHONE_DISPLAY}
                </a>
                .
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Sign up</h2>
              <p className="mt-2 text-base text-slate-600">
                Takes about a minute. No payment now; you are invoiced after the visit.
              </p>
              <form onSubmit={submit} noValidate className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="c-unit" className={LABEL}>
                      Unit number <span className="font-normal text-slate-500">(required)</span>
                    </label>
                    <input
                      id="c-unit"
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className={`${INPUT} mt-2`}
                    />
                  </div>
                  <div>
                    <label htmlFor="c-plan" className={LABEL}>Floor plan</label>
                    <select
                      id="c-plan"
                      value={floorPlan}
                      onChange={(e) => setFloorPlan(e.target.value)}
                      className={`${INPUT} mt-2`}
                    >
                      <option value="">Choose one</option>
                      {community.floorPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <fieldset>
                  <legend className={LABEL}>Service</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {COMMUNITY_SERVICES.map((s) => (
                      <label
                        key={s.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 text-base ${
                          service === s.id ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="service"
                          value={s.id}
                          checked={service === s.id}
                          onChange={() => setService(s.id)}
                          className="h-4 w-4 accent-sky-600"
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="c-day" className={LABEL}>Community day</label>
                  <select
                    id="c-day"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className={`${INPUT} mt-2`}
                  >
                    {hasDays ? (
                      <>
                        <option value="">Choose a day</option>
                        {community.days.map((d) => (
                          <option key={d.id} value={d.id}>{d.label}</option>
                        ))}
                        <option value="">I&rsquo;m flexible</option>
                      </>
                    ) : (
                      <option value="">I&rsquo;m flexible — tell me when the day is set</option>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor="c-name" className={LABEL}>Name</label>
                  <input
                    id="c-name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`${INPUT} mt-2`}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="c-phone" className={LABEL}>
                      Mobile number <span className="font-normal text-slate-500">(required)</span>
                    </label>
                    <input
                      id="c-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`${INPUT} mt-2`}
                    />
                  </div>
                  <div>
                    <label htmlFor="c-email" className={LABEL}>Email</label>
                    <input
                      id="c-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${INPUT} mt-2`}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="c-notes" className={LABEL}>
                    Notes <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="c-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Gate code, pets, anything about access."
                    className={`${INPUT} mt-2`}
                  />
                </div>

                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full rounded-xl bg-sky-600 px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-sky-500 disabled:opacity-60"
                >
                  {sending ? 'Sending…' : `Join the ${community.name} day`}
                </button>
              </form>
            </>
          )}
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 text-center text-sm text-slate-600">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-6">
            <a href={`tel:${PHONE_E164}`} className="flex items-center gap-2 py-2 font-semibold text-sky-700">
              <Phone className="h-4 w-4" /> {PHONE_DISPLAY}
            </a>
            <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 py-2 font-semibold text-sky-700">
              <Mail className="h-4 w-4" /> {EMAIL}
            </a>
          </div>
          <p className="text-xs text-slate-500">Blue Pacific Window Cleaning &middot; Oʻahu</p>
        </div>
      </footer>
    </div>
  )
}
