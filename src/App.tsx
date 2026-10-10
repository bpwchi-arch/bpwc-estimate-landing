import { useEffect } from 'react'
import LandingPage from './components/LandingPage'
import PropertyManagersPage from './components/PropertyManagersPage'
import CommunityPage from './components/CommunityPage'

/**
 * The old multi-screen EstimateFlow (WelcomeScreen -> HowItWorks -> ServiceType ->
 * PhotoUpload -> BasicInfo -> Confirmation) was retired on 2026-08-24 in favour of
 * a single branded landing page with the quote calculator built into it.
 *
 * Those components are still in the repo and still compile - nothing was
 * deleted - so reverting is a one-line change here if this doesn't outperform.
 *
 * Routing (added 2026-10-10) is deliberately light — no react-router. The
 * site is three static entry points and the landing page must stay exactly as
 * it was, so we switch on window.location.pathname once at load:
 *
 *   /                      → LandingPage (unchanged)
 *   /property-managers     → PropertyManagersPage (AOAO / PM qualification)
 *   /community/:slug       → CommunityPage (unlisted group-rate sign-up)
 *   anything else          → LandingPage
 *
 * vercel.json rewrites every non-/api path to index.html so deep links work.
 */

type Route =
  | { name: 'landing' }
  | { name: 'property-managers' }
  | { name: 'community'; slug: string }

function resolveRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/property-managers') return { name: 'property-managers' }
  const community = path.match(/^\/community\/([a-z0-9-]+)$/i)
  if (community) return { name: 'community', slug: community[1].toLowerCase() }
  return { name: 'landing' }
}

function App() {
  const route = resolveRoute(window.location.pathname)

  // Community pages are unlisted: tell crawlers not to index them. Only these
  // pages get the tag; it is removed again if the route ever changes in-page.
  useEffect(() => {
    if (route.name !== 'community') return
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [route.name])

  if (route.name === 'property-managers') return <PropertyManagersPage />
  if (route.name === 'community') return <CommunityPage slug={route.slug} />
  return <LandingPage />
}

export default App
