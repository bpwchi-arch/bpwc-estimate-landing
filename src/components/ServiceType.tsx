import { useState } from 'react'
import { ArrowLeft, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EstimateData } from '@/pages/EstimateFlow'

type Props = {
  data: EstimateData
  updateData: (updates: Partial<EstimateData>) => void
  onNext: () => void
  onBack: () => void
}

const SERVICE_OPTIONS = [
  {
    id: 'windows',
    label: 'Window Cleaning',
    description: 'Interior, exterior, or both — we handle screens too',
    emoji: '🪟'
  },
  {
    id: 'pressure',
    label: 'Pressure Washing',
    description: 'Driveways, walkways, lanais, walls, and exterior surfaces',
    emoji: '💧'
  }
]

const WINDOW_SERVICE_OPTIONS = [
  { id: 'exterior-only', label: 'Exterior Only', description: 'Outside surfaces of all windows' },
  { id: 'interior-exterior', label: 'Interior + Exterior', description: 'Both sides of every window' },
  { id: 'not-sure', label: "I'm not sure yet", description: "We'll go over options when we send your estimate" }
]

export default function ServiceType({ data, updateData, onNext, onBack }: Props) {
  const [services, setServices] = useState<string[]>(data.services)
  const [windowService, setWindowService] = useState(data.windowService)
  const [error, setError] = useState('')

  const toggleService = (id: string) => {
    setServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
    setError('')
  }

  const wantsWindows = services.includes('windows')

  const handleNext = () => {
    if (services.length === 0) {
      setError('Please select at least one service to continue')
      return
    }
    if (wantsWindows && !windowService) {
      setError('Please select a window cleaning preference')
      return
    }
    updateData({ services, windowService: wantsWindows ? windowService : '' })
    onNext()
  }

  const handleCall = () => {
    window.location.href = 'tel:+18084577600'
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
          <h2 className="text-3xl font-bold text-sky-950 mb-2 text-center">What Can We Help With?</h2>
          <p className="text-center text-sky-700 mb-8">Select everything that applies — you can always adjust later</p>

          {/* Service Selection */}
          <div className="space-y-3 mb-8">
            {SERVICE_OPTIONS.map(option => {
              const selected = services.includes(option.id)
              return (
                <button
                  key={option.id}
                  onClick={() => toggleService(option.id)}
                  className={`w-full text-left rounded-xl border-2 p-5 transition-all ${
                    selected
                      ? 'border-sky-500 bg-sky-50 shadow-sm'
                      : 'border-sky-200 bg-white hover:border-sky-300 hover:bg-sky-50/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                      selected ? 'border-sky-500 bg-sky-500' : 'border-sky-300'
                    }`}>
                     {selected && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{option.emoji}</span>
                        <span className="text-lg font-semibold text-sky-950">{option.label}</span>
                      </div>
                      <p className="text-sky-700 text-sm mt-1">{option.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Window Service Preference (conditional) */}
          {wantsWindows && (
            <div className="bg-white rounded-xl border-2 border-sky-100 p-6 mb-8 shadow-sm">
              <h3 className="text-lg font-semibold text-sky-950 mb-1">Window Cleaning Preference</h3>
              <p className="text-sky-700 text-sm mb-4">Which sides would you like cleaned?</p>
              <div className="space-y-2">
                {WINDOW_SERVICE_OPTIONS.map(opt => {
                  const selected = windowService === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => { setWindowService(opt.id); setError('') }}
                      className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                        selected
                          ? 'border-sky-500 bg-sky-50'
                          : 'border-sky-100 hover:border-sky-300 hover:bg-sky-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          selected ? 'border-sky-500 bg-sky-500' : 'border-sky-300'
                        }`}>
                          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div>
                          <span className="font-medium text-sky-950">{opt.label}</span>
                          <p className="text-sky-600 text-xs mt-0.5">{opt.description}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <Button
            size="lg"
            className="w-full h-14 text-lg bg-sky-600 hover:bg-sky-700 text-white shadow-lg rounded-xl"
            onClick={handleNext}
          >
            Continue to Photos
          </Button>
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

