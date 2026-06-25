import { useEffect, useRef } from 'react'
import { CheckCircle, Mic, FileText, Users, Calendar } from 'lucide-react'
import './AppShowcase.css'

const featureList = [
  { icon: Mic,      text: 'One-tap ambient recording for any visit' },
  { icon: FileText, text: 'Structured SOAP notes auto-generated in under 1 second' },
  { icon: Users,    text: 'Full patient panel with vitals, labs, and AI summaries' },
  { icon: Calendar, text: 'Integrated schedule — upcoming and completed visits' },
  { icon: CheckCircle, text: 'Unassigned visits queue to keep your inbox clean' },
]

export default function AppShowcase() {
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.1 }
    )
    const els = ref.current?.querySelectorAll('.reveal') ?? []
    els.forEach((el, i) => { el.style.transitionDelay = `${i * 0.1}s`; observer.observe(el) })
    return () => observer.disconnect()
  }, [])

  return (
    <section id="app-showcase" className="section app-showcase" ref={ref}>
      <div className="container app-showcase__inner">

        {/* Left: visual */}
        <div className="app-showcase__visual reveal">
          <div className="app-showcase__bg-glow" />

          {/* Main screen */}
          <div className="app-showcase__screen">
            {/* Header */}
            <div className="aps__header">
              <div className="aps__header-dot aps__header-dot--teal" />
              <span className="aps__header-title">Patient Detail — Sarah Kim</span>
              <div className="aps__header-badge">LC+</div>
            </div>

            {/* AI Summary card */}
            <div className="aps__ai-card">
              <div className="aps__ai-label">
                <div className="aps__ai-dot" />
                <span>AI Summary</span>
              </div>
              <p className="aps__ai-text">
                35F presenting for annual exam. HTN well-controlled on lisinopril 10mg. 
                Recent HbA1c 6.1% — borderline pre-diabetic. BMI 27.4. Counseled on diet 
                and exercise. Follow-up labs in 3 months.
              </p>
              <div className="aps__ai-footer">
                <span>Generated from visit 06/25/26</span>
                <span>·</span>
                <span className="aps__ai-refresh">Regenerate</span>
              </div>
            </div>

            {/* Vitals */}
            <div className="aps__vitals">
              {[
                { label: 'BP', value: '118/76', unit: 'mmHg', ok: true },
                { label: 'HR', value: '72', unit: 'bpm', ok: true },
                { label: 'BMI', value: '27.4', unit: 'kg/m²', ok: true },
                { label: 'HbA1c', value: '6.1', unit: '%', ok: false },
              ].map(v => (
                <div key={v.label} className={`aps__vital${v.ok ? '' : ' aps__vital--warn'}`}>
                  <span className="aps__vital-val">{v.value}</span>
                  <span className="aps__vital-label">{v.label}</span>
                  <span className="aps__vital-unit">{v.unit}</span>
                </div>
              ))}
            </div>

            {/* Visit list */}
            <div className="aps__visits-label">Recent Visits</div>
            {[
              { date: 'Jun 25, 2026', status: 'complete', snippet: 'Annual exam, all labs reviewed...' },
              { date: 'Mar 10, 2026', status: 'complete', snippet: 'HTN follow-up, BP well controlled...' },
              { date: 'Nov 02, 2025', status: 'complete', snippet: 'New patient intake, comprehensive...' },
            ].map(v => (
              <div key={v.date} className="aps__visit-row">
                <div className="aps__visit-info">
                  <span className="aps__visit-date">{v.date}</span>
                  <span className="aps__visit-snippet">{v.snippet}</span>
                </div>
                <div className={`aps__visit-badge aps__visit-badge--${v.status}`}>{v.status}</div>
              </div>
            ))}
          </div>

          {/* Floating SOAP note preview */}
          <div className="app-showcase__note-preview">
            <div className="anp__header">
              <FileText size={13} style={{ color: 'var(--teal)' }} />
              <span>SOAP Note — Kim, Sarah</span>
            </div>
            <div className="anp__section">
              <span className="anp__section-label">S</span>
              <span className="anp__section-text">Patient reports feeling well, no complaints...</span>
            </div>
            <div className="anp__section">
              <span className="anp__section-label" style={{ color: 'hsl(240,75%,72%)' }}>O</span>
              <span className="anp__section-text">BP 118/76, HR 72, BMI 27.4...</span>
            </div>
            <div className="anp__section">
              <span className="anp__section-label" style={{ color: 'hsl(265,70%,72%)' }}>A</span>
              <span className="anp__section-text">Hypertension, controlled. Pre-diabetes...</span>
            </div>
          </div>
        </div>

        {/* Right: copy */}
        <div className="app-showcase__copy">
          <p className="section-label reveal">The App</p>
          <h2 className="heading-xl app-showcase__title reveal">
            Your entire practice,<br />
            <span className="text-gradient">in your pocket</span>
          </h2>
          <p className="app-showcase__subtitle text-secondary reveal">
            SwiftCare is a native iOS app built from the ground up for clinical speed. 
            Every screen is designed to reduce friction so you spend time with patients, 
            not with paperwork.
          </p>

          <ul className="app-showcase__list">
            {featureList.map((f, i) => {
              const Icon = f.icon
              return (
                <li key={i} className="app-showcase__list-item reveal">
                  <div className="app-showcase__list-icon">
                    <Icon size={16} style={{ color: 'var(--teal)' }} />
                  </div>
                  <span className="text-secondary">{f.text}</span>
                </li>
              )
            })}
          </ul>

          <div className="app-showcase__cta reveal">
            <a href="#pricing" className="btn btn-primary">
              Download on App Store
            </a>
            <a href="#how-it-works" className="btn btn-ghost">
              See How It Works
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
