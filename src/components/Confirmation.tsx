import { CheckCircle2, Phone, Clock, MessageSquare } from 'lucide-react'
import { Button } from 'A/components/ui/button'

export default function Confirmation() {
  const handleCall = () => {
    window.location.href = 'tel:+18084577600'
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
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Blue Pacific Window Cleaning"
            className="h-10 w-auto"
          />
          <div>
            <h1 className="text-xl font-semibold text-sky-900">Blue Pacific Window Cleaning</h1>
            <p className="text-xs text-sky-700">Serving Oʻahu</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">

          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-sky-950 mb-3">
              We've Got Your Photos! 🌺
            </h2>
            <p className="text-lg text-sky-800">
              Thank you for reaching out to Blue Pacific Window Cleaning. Your estimate request has been submitted successfully.
            </p>
          </div>

          {/* What Happens Next */}
          <div className="bg-white rounded-xl border-2 border-sky-100 p-6 shadow-sm mb-6">
            <h3 className="text-lg font-semibold text-sky-950 mb-4">What happens next:</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-sky-700" />
                </div>
                <div className="pt-1">
                  <p className="font-medium text-sky-950">Our team reviews your photos</p>
                  <p className="text-sm text-sky-700">Usually within a few hours</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-sky-700" />
                </div>
                <div className="pt-1">
                  <p className="font-medium text-sky-950">You receive your estimate</p>
                  <p className="text-sm text-sky-700">By text or email — most estimates arrive within 24 hours</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-sky-50 rounded-xl border border-sky-200 p-6 text-center">
            <p className="text-sky-900 font-medium mb-1">Have a question? Want to talk to someone right now?</p>
            <p className="text-sky-700 text-sm mb-4">We're happy to help.</p>
            <Button
              size="lg"
              className="w-full h-12 bg-sky-600 hover:bg-sky-700 text-white rounded-xl"
              onClick={handleCall}
            >
              <Phone className="w-5 h-5 mr-2" />
              Call Us: (808) 457-7600
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-sky-100 py-6 px-4">
        <div className="max-w-2xl mx-auto text-center text-sm text-sky-700">
          <p>Blue Pacific Window Cleaning · Detail-focused window cleaning for Oʻahu homes</p>
          <p className="mt-1">
            <a href="https://bluepacificwindowcleaning.com" className="hover:text-sky-900 transition-colors">
              bluepacificwindowcleaning.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
