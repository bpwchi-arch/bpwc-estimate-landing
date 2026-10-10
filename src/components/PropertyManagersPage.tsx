import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, ClipboardList, Mail, Phone, ShieldCheck, Mountain, Calculator } from 'lucide-react'
import { LOGO_SRC } from '@/logoData'
import { firePmInquiryConversion } from '@/lib/analytics'

/**
 * /property-managers — qualification page for property managers and AOAO
 * boards of LOW-RISE properties (ladder / water-fed-pole reach, up to 4
 * stories). Not a price calculator: the ask is one call-back from Austin.
 *
 * Two offers, in order of what we want:
 *   1. Association contract — recurring exterior schedule billed to the AOAO.
 *   2. Group rate program — when the association does not cover windows, the
 *      board endorses a community day and owners sign up one by one
 *      (see CommunityPage for what that sign-up looks like).
 *
 * Towers (5+ stories) are turned away in the form itself, before any request
 * is made: no lead is created and no conversion fires. The server rejects them
 * too, as a backstop.
 */

const PHONE_DISPLAY = '(808) 207-2939'
const PHONE_E164 = '+18082072939'
const EMAIL = 'sales@bpwchi.com'

const ROLES = ['Property manager', 'Board member', 'Owner'] as const
const PROPERTY_TYPES = [
  'Low-rise condo',
  'Townhomes',
  'Small complex',
  'Portfolio of homes or small buildings',
  'Other',
] as const
const STORIES = ['1', '2', '3', '4', '5 or more'] as const
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
const WHO_PAYS = ['The association', 'Individual owners', 'Not sure'] as const

const INPUT =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100'
const LABEL = 'block text-sm font-semibold text-slate-800'

export default function PropertyManagersPage() {
  useEffect(() => { document.title = 'Window Cleaning for Property Managers & AOAOs | Blue Pacific Window Cleaning' }, [])
  const formRef = useRef<HTMLDivElement>(null)

  const [role, setRole] = useState<string>('')
  const [propertyType, setPropertyType] = useState<string>('')
  const [stories, setStories] = useState<string>('')
  const [buildings, setBuildings] = useState('')
  const [units, setUnits] = useState('')
  const [area, setArea] = useState('')
  const [whoPays, setWhoPays] = useState<string>('')
  const [propertyName, setPropertyName] = useState('')
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const isTower = stories === '5 or more'

  const scrollToForm = () =>
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    // Towers never leave the browser. No API call, no conversion, no lead.
    if (isTower) return

    if (!stories) return setError('Please tell us how many stories the buildings are.')
    if (!phone.trim()) return setError('A phone number is required so Austin can call you back.')
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
          propertyType,
          stories: Number(stories),
          buildings: buildings === '' ? null : Number(buildings),
          units: units === '' ? null : Number(units),
          area,
          whoPays,
          propertyName: propertyName.trim(),
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
      // Qualified success only. This is the one place the PM conversion fires.
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

          <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-sky-300">
            For property managers and AOAO boards
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-white sm:text-5xl">
            Window cleaning for low-rise condos, townhomes and managed portfolios
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-200">
            The buildings owners can&rsquo;t safely clean themselves, and our crew can
            reach with normal gear.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={scrollToForm}
              className="rounded-xl bg-sky-500 px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-sky-400"
            >
              Tell us about your property
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
              icon: ClipboardList,
              title: 'Reliability and reporting',
              body:
                'Scheduled visits on a set cadence. A work order for each visit, photos of what was done, and one invoice.',
            },
            {
              icon: ShieldCheck,
              title: 'Insurance',
              body:
                'Certificate of insurance on request. The association can be named as additional insured.',
            },
            {
              icon: Mountain,
              title: 'Access',
              body:
                'We reach what owners can’t: hillside buildings, second- and third-floor glass, stacked lanais.',
            },
            {
              icon: Calculator,
              title: 'Pricing',
              body:
                'Per-unit-type pricing that stays predictable across a portfolio. The same floor plan costs the same every time.',
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

      {/* ── Two offers ───────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Two ways to work with us</h2>
          <p className="mt-2 max-w-2xl text-base text-slate-600">
            Which one fits depends on who pays for window cleaning at your property.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="flex flex-col rounded-2xl border-2 border-sky-600 bg-white p-6 shadow-sm">
              <span className="inline-block w-fit rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                Lead offer
              </span>
              <h3 className="mt-3 text-xl font-bold text-slate-900">Association contract</h3>
              <p className="mt-1 text-sm text-slate-500">When the association covers exterior windows</p>
              <ul className="mt-4 space-y-3 text-base text-slate-700">
                {[
                  'Recurring exterior schedule, priced per unit type after one sample walkthrough.',
                  'Quarterly or twice-a-year visits.',
                  'Billed to the association, with work orders and one invoice per visit or per month.',
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <Check className="mt-1 h-4 w-4 flex-none text-sky-600" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="inline-block w-fit rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                Alternative
              </span>
              <h3 className="mt-3 text-xl font-bold text-slate-900">Group rate program</h3>
              <p className="mt-1 text-sm text-slate-500">When the association doesn&rsquo;t cover windows</p>
              <ul className="mt-4 space-y-3 text-base text-slate-700">
                {[
                  'The board endorses a community day; owners sign up one by one.',
                  'Each floor plan has one fixed price. No estimates, no haggling.',
                  'A group discount grows as more units join the day.',
                  'Inside cleaning stays an owner add-on.',
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <Check className="mt-1 h-4 w-4 flex-none text-slate-500" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── What we're not set up for ────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 p-5 text-base text-slate-600">
          <span className="font-semibold text-slate-800">What we&rsquo;re not set up for:</span>{' '}
          high-rises and towers, rope access, swing stage or lifts. Five stories and up, we&rsquo;ll
          point you to a high-rise company.
        </div>
      </section>

      {/* ── Qualification form ───────────────────────────────────────────── */}
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
              <p className="mt-3 text-lg text-slate-600">Austin will call you within one business day.</p>
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
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Tell us about your property</h2>
              <p className="mt-2 text-base text-slate-600">
                A few questions so the call-back is useful. Austin, the owner, calls every inquiry himself.
              </p>

              <form onSubmit={submit} noValidate className="mt-8 space-y-6">
                {/* Role */}
                <fieldset>
                  <legend className={LABEL}>Your role</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {ROLES.map((r) => (
                      <label
                        key={r}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 text-base ${
                          role === r ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={r}
                          checked={role === r}
                          onChange={() => setRole(r)}
                          className="h-4 w-4 accent-sky-600"
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* Property type */}
                <div>
                  <label htmlFor="pm-type" className={LABEL}>Property type</label>
                  <select
                    id="pm-type"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className={`${INPUT} mt-2`}
                  >
                    <option value="">Choose one</option>
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Stories */}
                <fieldset>
                  <legend className={LABEL}>Stories</legend>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {STORIES.map((s) => (
                      <label
                        key={s}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3.5 text-base ${
                          stories === s ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="stories"
                          value={s}
                          checked={stories === s}
                          onChange={() => setStories(s)}
                          className="h-4 w-4 accent-sky-600"
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {isTower ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-base text-amber-950"
                  >
                    <p className="font-semibold">We&rsquo;re not set up for towers.</p>
                    <p className="mt-2 leading-relaxed">
                      Buildings of five stories and up need rope access or a lift, which we don&rsquo;t do.
                      For those we&rsquo;d suggest a high-rise window cleaning company.
                    </p>
                    <p className="mt-4 text-sm">
                      If you also manage low-rise properties, we&rsquo;d be glad to talk about those:{' '}
                      <a href={`tel:${PHONE_E164}`} className="font-semibold underline">
                        {PHONE_DISPLAY}
                      </a>
                      .
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Buildings / units */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="pm-buildings" className={LABEL}>Number of buildings</label>
                        <input
                          id="pm-buildings"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={buildings}
                          onChange={(e) => setBuildings(e.target.value)}
                          className={`${INPUT} mt-2`}
                        />
                      </div>
                      <div>
                        <label htmlFor="pm-units" className={LABEL}>Number of units</label>
                        <input
                          id="pm-units"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={units}
                          onChange={(e) => setUnits(e.target.value)}
                          className={`${INPUT} mt-2`}
                        />
                      </div>
                    </div>

                    {/* Area */}
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

                    {/* Who pays */}
                    <fieldset>
                      <legend className={LABEL}>Who pays for window cleaning</legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {WHO_PAYS.map((w) => (
                          <label
                            key={w}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 text-base ${
                              whoPays === w ? 'border-sky-600 bg-sky-50 text-sky-900' : 'border-slate-300 bg-white text-slate-800'
                            }`}
                          >
                            <input
                              type="radio"
                              name="whoPays"
                              value={w}
                              checked={whoPays === w}
                              onChange={() => setWhoPays(w)}
                              className="h-4 w-4 accent-sky-600"
                            />
                            {w}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {/* Property name and address */}
                    <div>
                      <label htmlFor="pm-property" className={LABEL}>Property name</label>
                      <input
                        id="pm-property"
                        value={propertyName}
                        onChange={(e) => setPropertyName(e.target.value)}
                        autoComplete="organization"
                        className={`${INPUT} mt-2`}
                      />
                    </div>
                    <div>
                      <label htmlFor="pm-address" className={LABEL}>Property address</label>
                      <input
                        id="pm-address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        autoComplete="street-address"
                        className={`${INPUT} mt-2`}
                      />
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
                        placeholder="Anything we should know: access, timing, what the board has asked for."
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
                      {sending ? 'Sending…' : 'Request a call from Austin'}
                    </button>
                    <p className="text-center text-xs text-slate-500">
                      No auto-texts, no sales sequence. One call-back within a business day.
                    </p>
                  </>
                )}
              </form>
            </>
          )}
        </div>
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
