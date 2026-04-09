import { useState } from 'react'
import { Camera, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LOGO_SRC } from '../logoData'

type Props = {
  onNext: () => void
}

export default function WelcomeScreen({ onNext }: Props) {
  const [showTextForm, setShowTextForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSendText = async () => {
    if (!phone.trim()) return

    setSending(true)
    setError('')

    try {
      const response = await fetch('/api/send-estimate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send text')
      }

      setSent(true)

      setTimeout(() => {
        setShowTextForm(false)
        setSent(false)
        setPhone('')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send text. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 to-white tropical-bg">
      <div className="palm-right"></div>
      <div className="palm-left"></div>
      <div className="palm-top-left"></div>
      <div className="monstera-right"></div>
      <div className="monstera-left"></div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sky-100 py-4 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-xl font-semibold text-sky-900">Blue Pacific Window Cleaning</h1>
          <p className="text-sm text-sky-700">Proudly serving homes across Oʻahu</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-sky-950 mb-4 leading-tight">
              Get a Fast Window Cleaning Estimate — No Site Visit Needed
            </h2>
            <p className="text-lg text-sky-800">
              Proudly serving homes across Oahu.<br />
              Most customers just snap a few photos — we'll guide you through it 👍
            </p>
          </div>

          {!showTextForm ? (
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full h-14 text-lg bg-sky-600 hover:bg-sky-700 text-white shadow-lg rounded-xl"
                onClick={onNext}
              >
                <Camera className="w-6 h-6 mr-3" />
                Get a Fast Estimate
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="w-full h-auto py-3 px-4 border-2 border-sky-300 text-sky-700 hover:bg-sky-50 rounded-xl"
                onClick={() => setShowTextForm(true)}
              >
                <div className="flex items-start gap-3 w-full">
                  <MessageSquare className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="text-left flex-1">
                    <div className="font-semibold text-base">Send This To My Phone</div>
                    <div className="text-sm text-sky-600 font-normal mt-0.5">
                      On a desktop? Get the link on your phone to snap photos easily 👍
                    </div>
                  </div>
                </div>
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-sky-200 p-6 shadow-lg">
              {!sent ? (
                <>
                  <h3 className="text-lg font-semibold text-sky-950 mb-2">
                    We'll text you the link
                  </h3>
                  <p className="text-sky-700 text-sm mb-4">
                    Open it on your phone to snap photos right from your camera roll.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="welcome-phone" className="text-sky-950 font-medium mb-2 block">
                        Your Phone Number
                      </Label>
                      <Input
                        id="welcome-phone"
                        type="tel"
                        placeholder="(808) 555-1234"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                        className="h-12 text-base"
                      />
                    </div>

                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-800 text-sm">{error}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        size="lg"
                        className="flex-1 bg-sky-600 hover:bg-sky-700 text-white"
                        onClick={handleSendText}
                        disabled={sending || !phone.trim()}
                      >
                        {sending ? 'Sending...' : 'Send Link'}
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => {
                          setShowTextForm(false)
                          setError('')
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-sky-950 mb-2">
                    Text sent! 👍
                  </h3>
                  <p className="text-sky-700">
                    Check your phone — tap the link to get started
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-sky-100 py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <img src={LOGO_SRC} alt="Blue Pacific Window Cleaning" className="h-24 w-auto object-contain mx-auto mb-3" />
          <p className="text-sm text-sky-700">Detail-focused window cleaning for Oahu homes</p>
        </div>
      </footer>
    </div>
  )
}
