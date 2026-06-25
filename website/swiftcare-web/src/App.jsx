import Navbar from './components/Navbar'
import Hero from './components/Hero'
import SocialProof from './components/SocialProof'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import AppShowcase from './components/AppShowcase'
import Testimonials from './components/Testimonials'
import Pricing from './components/Pricing'
import FAQ from './components/FAQ'
import CTABand from './components/CTABand'
import Footer from './components/Footer'
import './App.css'

export default function App() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <AppShowcase />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTABand />
      </main>
      <Footer />
    </>
  )
}
