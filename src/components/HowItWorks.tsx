import { Camera, FileCheck, MessageSquare, Phone, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  onNext: () => void
  onBack: () => void
}

export default function HowItWorks({ onNext, onBack }: Props) {
  const [showTextForm, setShowTextForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleCall = () => {
    window.location.href = 'tel:+18084577600'
  }

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

      console.log('SMS sent successfully:', data)
      setSent(true)
      
      setTimeout(() => {
        setShowTextForm(false)
        setSent(false)
        setPhone('')
      }, 3000)
    } catch (err) {
      console.error('Failed to send SMS:', err)
      setError(err instanceof Error ? err.message : 'Failed to send text. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-sky-50 tropical-bg">
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
      <main className="flex-1 px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-sky-950 mb-8 text-center">How It Works</h2>

          <div className="space-y-8 mb-12">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center">
                <Camera className="w-6 h-6 text-sky-700" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl font-semibold text-sky-950 mb-2">Snap a few photos of your home</h3>
                <p className="text-sky-800">Take wide shots of each side so we can see all your windows</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center">
                <FileCheck className="w-6 h-6 text-sky-700" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl font-semibold text-sky-950 mb-2">Our team reviews and builds your estimate</h3>
                <p className="text-sky-800">{'We\'ll'} carefully look over your photos and prepare accurate pricing</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-sky-700" />
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl font-semibold text-sky-950 mb-2">You receive pricing by text or email</h3>
                <p className="text-sky-800">Usually within 24 hours — no site visit needed</p>
              </div>
            </div>
          </div>

          <div className="bg-sky-50 rounded-xl p-6 mb-8 border border-sky-200">
            <p className="text-sky-900 text-center font-medium">
              {'It\'s'} that simple. Most homeowners get their estimate the same day.
            </p>
          </div>

          {!showTextForm ? (
            <div className="space-y-3">
              <Button 
                size="lg" 
                className="w-full h-14 text-lg bg-sky-600 hover:bg-sky-700 text-white shadow-lg rounded-xl"
                onClick={onNext}
              >
                {'Let\'s'} Get Started
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
                      {'We\'ll'} text you so you can snap a few photos right from your phone 👍
                    </div>
                  </div>
                </div>
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-sky-200 p-6 shadow-lg">
              {!sent ? (
                <>
                  <h3 className="text-lg font-semibold text-sky-950 mb-4">
                    {'We\'ll'} text you what to do next
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="phone" className="text-sky-950 font-medium mb-2 block">
                        Your Phone Number
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(808) 555-1234"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
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
                        {sending ? 'Sending...' : 'Send Instructions'}
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
                    Check your phone in a moment
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer Call Option */}
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

