import { ArrowRight } from 'lucide-react'
import './CTABand.css'

export default function CTABand() {
  return (
    <section id="cta" className="cta-band">
      <div className="cta-band__glow cta-band__glow--1" />
      <div className="cta-band__glow cta-band__glow--2" />
      <div className="cta-band__grid" />

      <div className="container cta-band__inner">
        <div className="cta-band__content">
          <h2 className="heading-xl cta-band__title">
            Ready to reclaim your evenings?
          </h2>
          <p className="cta-band__subtitle">
            Join thousands of clinicians who have already cut documentation time by 80% with SwiftCare. 
            Start free — no credit card required.
          </p>
          <div className="cta-band__ctas">
            <a href="#download" id="cta-band-primary" className="btn btn-primary btn-lg">
              Download SwiftCare Free
              <ArrowRight size={18} />
            </a>
            <a href="#pricing" id="cta-band-secondary" className="btn btn-outline btn-lg">
              View Pricing
            </a>
          </div>
          <p className="cta-band__disclaimer">
            Free plan · iOS 17+ · HIPAA compliant · Cancel anytime
          </p>
        </div>
      </div>
    </section>
  )
}
