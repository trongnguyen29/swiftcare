import { useEffect, useRef } from 'react'
import { Mic, Cpu, FileCheck } from 'lucide-react'
import './HowItWorks.css'

const steps = [
  {
    num: '01',
    icon: Mic,
    color: 'teal',
    title: 'Open & Record',
    desc: 'Tap "Quick Record" or select a patient, then start talking naturally with your patient. SwiftCare quietly captures everything in the background — no clicks, no interruptions.',
    detail: 'Supports in-person, telehealth, and dictation modes',
  },
  {
    num: '02',
    icon: Cpu,
    color: 'indigo',
    title: 'AI Processes',
    desc: 'Our ambient AI engine transcribes, diarizes speakers, and structures the clinical conversation into a comprehensive SOAP note format — tuned for over 100 specialties.',
    detail: 'Powered by Cloudflare Workers edge AI for sub-second latency',
  },
  {
    num: '03',
    icon: FileCheck,
    color: 'purple',
    title: 'Review & Done',
    desc: 'Your note is ready. Review, edit if needed, and sign. Assign it to a patient or send it directly to your EHR. The whole process takes less time than finding a pen.',
    detail: 'Average clinician review time: under 45 seconds',
  },
]

const colorMap = {
  teal:   'var(--teal)',
  indigo: 'hsl(240,75%,72%)',
  purple: 'hsl(265,70%,72%)',
}

export default function HowItWorks() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.15 }
    )
    const els = sectionRef.current?.querySelectorAll('.reveal') ?? []
    els.forEach((el, i) => { el.style.transitionDelay = `${i * 0.15}s`; observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  return (
    <section id="how-it-works" className="section how-it-works" ref={sectionRef}>
      <div className="how-it-works__glow" />

      <div className="container">
        <div className="section-header">
          <p className="section-label">How It Works</p>
          <h2 className="heading-xl section-title">
            From visit to note in<br />
            <span className="text-gradient">three simple steps</span>
          </h2>
          <p className="section-subtitle">
            No training needed. No workflow changes. Just open SwiftCare and talk.
          </p>
        </div>

        <div className="how-steps">
          {steps.map((step, i) => {
            const Icon = step.icon
            const col = colorMap[step.color]
            return (
              <div key={step.num} id={`step-${i + 1}`} className="how-step reveal">
                {/* Connector line */}
                {i < steps.length - 1 && <div className="how-step__connector" />}

                {/* Step number bubble */}
                <div className="how-step__bubble" style={{ color: col, borderColor: `${col}33` }}>
                  <span className="how-step__num">{step.num}</span>
                </div>

                {/* Card */}
                <div className="how-step__card">
                  <div className="how-step__icon-wrap" style={{ background: `${col}18`, border: `1px solid ${col}33` }}>
                    <Icon size={26} style={{ color: col }} strokeWidth={1.75} />
                  </div>
                  <h3 className="heading-lg how-step__title">{step.title}</h3>
                  <p className="how-step__desc text-secondary">{step.desc}</p>
                  <p className="how-step__detail">
                    <span style={{ color: col }}>↗</span> {step.detail}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom CTA */}
        <div className="how-cta reveal">
          <a href="#pricing" className="btn btn-primary btn-lg">
            Try It Free Today
          </a>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
            Available on the App Store · iOS 17+ · Free plan included
          </p>
        </div>
      </div>
    </section>
  )
}
