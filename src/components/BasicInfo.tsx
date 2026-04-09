import { useState } from 'react'
import { ArrowLeft, Phone, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EstimateData } from '@/pages/EstimateFlow'

type Props = {
  data: EstimateData
  updateData: (updates: Partial<EstimateData>) => void
  onNext: () => void
  onBack: () => void
}

export default function BasicInfo({ data, updateData, onNext, onBack }: Props) {
  const [firstName, setFirstName] = useState(data.name.split(' ')[0] || '')
  const [lastName, setLastName] = useState(data.name.split(' ').slice(1).join(' ') || '')
  const [phone, setPhone] = useState(data.phone)
  const [email, setEmail] = useState(data.email)
  const [address, setAddress] = useState(data.address)
  const [notes, setNotes] = useState(data.notes)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleCall = () => {
    window.location.href = 'tel:+18084577600'
  }

  const validate = () => {
    if (!firstName.trim()) return 'Please enter your first name'
    if (!lastName.trim()) return 'Please enter your last name'
    if (!phone.trim()) return 'Please enter your phone number'
    if (phone.replace(/\D/g, '').length < 10) return 'Please enter a valid 10-digit phone number'
    if (!email.trim()) return 'Please enter your email address'
    if (!/\S+@\S+\.\S+/.test(email)) return 'Please enter a valid email address'
    return null
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/submit-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: fullName,
          address: address.trim(),
          email: email.trim(),
          services: data.services,
          windowService: data.windowService,
          notes: notes.trim(),
          photoUrls: data.photoUrls
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Submission failed')
      }

      updateData({
        phone: phone.trim(),
        name: fullName,
        address: address.trim(),
        email: email.trim(),
        notes: notes.trim()
      })

      onNext()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Something went wrong: ${message}. Please try again or give us a call.`)
      console.error('Submission error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-sky-50 tropical-bg">
      <div className="palm-right"></div>
      <div className="palm-left"></div>
      <div className="palm-top-left"></div>
      <div className="monstera-right"></div>
      <div className="monstera-left"></div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sky-100 py-4 px-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="text-sky-700 hover:text-sky-900 transition-colors flex-shrink-0">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-sky-900">Blue Pacific Window Cleaning</h1>
            <p className="text-xs text-sky-700">Serving Oʻahu</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-sky-950 mb-2 text-center">Almost Done!</h2>
          <p className="text-center text-sky-700 mb-8">We just need a few details to send you your estimate</p>

          <div className="bg-white rounded-xl border-2 border-sky-100 p-6 shadow-sm space-y-5">

            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="text-sky-950 font-medium mb-2 block">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Kai"
                  value={firstName}
                  onChange={e => { setFirstName(e.target.value); setError('') }}
                  className="h-12 text-base"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-sky-950 font-medium mb-2 block">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Nakamura"
                  value={lastName}
                  onChange={e => { setLastName(e.target.value); setError('') }}
                  className="h-12 text-base"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phone" className="text-sky-950 font-medium mb-2 block">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(808) 555-1234"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError('') }}
                className="h-12 text-base"
              />
              <p className="text-sky-600 text-xs mt-1.5">We'll text or call you with your estimate</p>
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-sky-950 font-medium mb-2 block">
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="kai@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                className="h-12 text-base"
              />
              <p className="text-sky-600 text-xs mt-1.5">We'll send your estimate here</p>
            </div>

            {/* Address */}
            <div>
              <Label htmlFor="address" className="text-sky-950 font-medium mb-2 block">
                Home Address <span className="text-sky-500 text-xs font-normal">(optional)</span>
              </Label>
              <Input
                id="address"
                type="text"
                placeholder="123 Aloha St, Honolulu, HI 96813"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="text-sky-950 font-medium mb-2 block">
                Anything else we should know? <span className="text-sky-500 text-xs font-normal">(optional)</span>
              </Label>
              <textarea
                id="notes"
                placeholder="e.g. I have a 2-story home, hard-to-reach skylights, or specific areas I'd like prioritized..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-5 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <Button
              size="lg"
              className="w-full h-14 text-lg bg-sky-600 hover:bg-sky-700 text-white shadow-lg rounded-xl"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting Your Request...
                </>
              ) : (
                'Submit My Estimate Request 🌺'
              )}
            </Button>

            <p className="text-center text-xs text-sky-600">
              By submitting, you agree to be contacted by Blue Pacific Window Cleaning regarding your estimate request.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-sky-100 py-4 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <button
            onClick={handleCall}
            className="text-sky-700 hover:text-sky-900 font-medium inline-flex items-center gap-2 transition-colors"
          >
            <Phone className="w-4 h-4" />
            Call Us
          </button>
        </div>
      </footer>
    </div>
  )
}
