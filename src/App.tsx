import LandingPage from './components/LandingPage'

/**
 * The old multi-screen EstimateFlow (WelcomeScreen -> HowItWorks -> ServiceType ->
 * PhotoUpload -> BasicInfo -> Confirmation) was retired on 2026-08-24 in favour of
 * a single branded landing page with the quote calculator built into it.
 *
 * Those components are still in the repo and still compile - nothing was
 * deleted - so reverting is a one-line change here if this doesn't outperform.
 */
function App() {
  return <LandingPage />
}

export default App
