import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, KeyRound, Camera, CalendarCheck, Receipt, Mail, Phone } from 'lucide-react'
import { LOGO_SRC } from '@/logoData'
import { firePmInquiryConversion } from '@/lib/analytics'

/**
 * /property-managers — lead page for property managers and realtors who
 * manage rental homes, condos and small portfolios on Oʻahu.
 *
 * Not a price calculator. The ask is one inquiry; we text a photo request for
 * the first property and call within one business day. The server tags the
 * lead with a track (turnover / recurring / unknown) from "what do you need
 * first" so Austin knows what the call is about before he dials.
 *
 * Homes, townhomes and low-rise buildings only. High-rise and lift / rope
 * work is out of scope; that is stated once, quietly, above the footer.
 */

const PHONE_DISPLAY = '(808) 207-2939'
const PHONE_E164 = '+18082072939'
const EMAIL = 'sales@bpwchi.com'

const ROLES = ['Property manager', 'Realtor', 'Owner-landlord'] as const
const MANAGES = ['Single-family rentals', 'Condos and townhomes', 'A mix', 'Vacation rentals'] as const
const NEEDS = [
  'Move-out or move-in turn',
  'Listing prep',
  'Recurring schedule',
  'One-time clean',
  'Not sure',
] as const
const AREAS = [
  'Honolulu',
  'East Honolulu',
  'Kaneohe–Kailua (Windward)',
  'Pearl City–Aiea',
  'Mililani–Central',
  'Ewa–Kapolei (West)',
  'Waianae',
  'North Shore',
  'Other',
] as const

const INPUT =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100'
const LABEL = 'block text-sm font-semibold text-slate-800'
const RADIO = (active: boolean) =>
  `flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 text-base ${
    active ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-800'
  }`

export default function PropertyManagersPage() {
  useEffect(() => {
    document.title = 'Window Cleaning for Property Managers & Realtors | Blue Pacific Window Cleaning'
  }, [])
  const formRef = useRef<HTMLDivElement>(null)

  const [role, setRole] = useState<string>('')
  const [manages, setManages] = useState<string>('')
  const [doors, setDoors] = useState('')
  const [area, setArea] = useState('')
  const [need, setNeed] = useState<string>('')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const scrollToForm = () =>
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!role) return setError('Please pick your role.')
    if (!need) return setError('Please tell us what you need first.')
    if (!phone.trim()) return setError('A phone number is required so we can text the photo request.')
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError('Please enter a valid email address.')
    }

    setSending(true)
    try {
      const res = await fetch('/api/pm-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          manages,
          doors: doors === '' ? null : Number(doors),
          area,
          need,
          address: address.trim(),
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          notes: notes.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message || 'submit failed')
      }
      // Success only. This is the one place the PM conversion fires.
      firePmInquiryConversion()
      setDone(true)
    } catch (err) {
      setError(
        err instanceof Error && err.message !== 'submit failed'
          ? err.message
          : `Something went wrong sending that. Please call ${PHONE_DISPLAY} or email ${EMAIL}.`
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white text-slate-900">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden">
        <img
          src="/crew-window-cleaning.jpg"
          alt="Blue Pacific technicians cleaning exterior windows with poles and ladders"
          className="absolute inset-0 h-full w-full object-cover object-center"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-900/75 to-slate-900/85" />

        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center sm:py-20">
          <div className="mx-auto inline-block rounded-2xl bg-white px-6 py-4 shadow-lg">
            <img
              src={LOGO_SRC}
              alt="Blue Pacific Window Cleaning"
              width={600}
              height={215}
              className="w-44 sm:w-56"
              fetchPriority="high"
            />
          </div>

          <h1 className="mt-8 text-3xl font-bold leading-tight text-white sm:text-5xl">
            Window cleaning for property managers and realtors
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-200">
            Move-outs, move-ins, listing prep, and a schedule that keeps every property looking
            rented. Send photos, get a price the same day, one invoice.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={scrollToForm}
              className="rounded-xl bg-sky-500 px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-sky-400"
            >
              Send me a photo request
            </button>
            <a
              href={`tel:${PHONE_E164}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 py-4 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              <Phone className="h-4 w-4" />
              {PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </header>

      {/* ── Four blocks ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            {
              icon: KeyRound,
              title: 'Turnovers',
              body:
                'Move-out and move-in cleans: glass, screens, tracks and sills, so the unit shows clean and the deposit conversation is simple. Tell us the key or lockbox situation and the deadline; we work it into the route.',
            },
            {
              icon: Camera,
              title: 'Listing prep',
              body: 'Glass cleaned before the photographer and the open house. Exterior-only or inside and out.',
            },
            {
              icon: CalendarCheck,
              title: 'On a schedule',
              body:
                'Put a property or the whole portfolio on a recurring plan (annual, twice a year, quarterly) and stop fielding tenant complaints about dirty windows. The same price every visit, with the plan discount shown as its own line.',
            },
            {
              icon: Receipt,
              title: 'One invoice, no chasing',
              body:
                'A job per property with the unit number, photos on request, invoices per property or one batched monthly statement. NET 30 available for management companies.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-base leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How pricing works ────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">How pricing works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Send photos',
                body: 'A photo of each side of the property, or the listing photos. Phone photos are fine.',
              },
              {
                title: 'Priced the same day',
                body: 'We price it from the photos. No site visit, no waiting on a walkthrough.',
              },
              {
                title: 'Fixed price per property',
                body: 'One number for that property. Recurring plans lock it in for every visit.',
              },
            ].map(({ title, body }, i) => (
              <li key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-base leading-relaxed text-slate-600">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── What tenants and owners see ──────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">What tenants and owners see</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            'A text the day before with a 3-hour arrival window.',
            'Techs who call if anything changes.',
            'A walkthrough at the end.',
            'Satisfaction guaranteed.',
          ].map((t) => (
            <li key={t} className="flex gap-3 rounded-xl border border-slate-200 p-4 text-base text-slate-700">
              <Check className="mt-1 h-4 w-4 flex-none text-sky-600" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Inquiry form ─────────────────────────────────────────────────── */}
      <section ref={formRef} className="scroll-mt-6 bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-2xl px-4">
          {done ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl bg-white p-8 text-center shadow-sm"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-700" />
              </div>
              <h2 className="mt-6 text-2xl font-bold text-slate-900">Got it.</h2>
              <p className="mt-3 text-lg text-slate-600">
                We&rsquo;ll text you a photo request for the first property and call within one
                business day.
              </p>
              <p className="mt-6 text-sm text-slate-500">
                Need us sooner? Call{' '}
                <a href={`tel:${PHONE_E164}`} className="font-semibold text-sky-700 underline">
                  {PHONE_DISPLAY}
                </a>
                .
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Tell us what you manage</h2>
              <p className="mt-2 text-base text-slate-600">
                A few questions so the first call is useful. We text a photo request for the first
                property and call within one business day.
              </p>

              <form onSubmit={submit} noValidate className="mt-8 space-y-6">
                {/* Role */}
                <fieldset>
                  <legend className={LABEL}>
                    Your role <span className="font-normal text-slate-500">(required)</span>
                  </legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {ROLES.map((r) => (
                      <label key={r} className={RADIO(role === r)}>
                        <input
                          type="radio"
                          name="role"
                          value={r}
                          checked={role === r}
                          onChange={() => setRole(r)}
                          required
                          className="h-4 w-4 accent-sky-600"
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* What you manage */}
                <div>
                  <label htmlFor="pm-manages" className={LABEL}>What you manage</label>
                  <select
                    id="pm-manages"
                    value={manages}
                    onChange={(e) => setManages(e.target.value)}
                    className={`${INPUT} mt-2`}
                  >
                    <option value="">Choose one</option>
                    {MANAGES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Doors / area */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pm-doors" className={LABEL}>
                      Doors you manage <span className="font-normal text-slate-500">(optional)</span>
                    </label>
                    <input
                      id="pm-doors"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={doors}
                      onChange={(e) => setDoors(e.target.value)}
                      className={`${INPUT} mt-2`}
                    />
                  </div>
                  <div>
                    <label htmlFor="pm-area" className={LABEL}>Area of Oʻahu</label>
                    <select
                      id="pm-area"
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className={`${INPUT} mt-2`}
                    >
                      <option value="">Choose one</option>
                      {AREAS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Need */}
                <fieldset>
                  <legend className={LABEL}>
                    What do you need first <span className="font-normal text-slate-500">(required)</span>
                  </legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {NEEDS.map((n) => (
                      <label key={n} className={RADIO(need === n)}>
                        <input
                          type="radio"
                          name="need"
                          value={n}
                          checked={need === n}
                          onChange={() => setNeed(n)}
                          required
                          className="h-4 w-4 accent-sky-600"
                        />
                        {n}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* First property */}
                <div>
                  <label htmlFor="pm-address" className={LABEL}>
                    First property address <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <input
                    id="pm-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    autoComplete="street-address"
                    aria-describedby="pm-address-help"
                    className={`${INPUT} mt-2`}
                  />
                  <p id="pm-address-help" className="mt-1.5 text-sm text-slate-500">
                    Unit number too, if it has one
                  </p>
                </div>

                {/* Contact */}
                <div>
                  <label htmlFor="pm-name" className={LABEL}>Your name</label>
                  <input
                    id="pm-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className={`${INPUT} mt-2`}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pm-phone" className={LABEL}>
                      Phone <span className="font-normal text-slate-500">(required)</span>
                    </label>
                    <input
                      id="pm-phone"
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
                    <label htmlFor="pm-email" className={LABEL}>
                      Email <span className="font-normal text-slate-500">(required)</span>
                    </label>
                    <input
                      id="pm-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${INPUT} mt-2`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="pm-notes" className={LABEL}>
                    Notes <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="pm-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Deadline, lockbox or tenant contact, anything about access"
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
                  {sending ? 'Sending…' : 'Send me a photo request'}
                </button>
                <p className="text-center text-xs text-slate-500">
                  One text with the photo request, one call. No sales sequence.
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── Scope line ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-center text-sm text-slate-500">
          We work on homes, townhomes and low-rise buildings. High-rises and anything needing a lift
          or rope access aren&rsquo;t our thing.
        </p>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 text-center text-sm text-slate-600">
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
