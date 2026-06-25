import { useEffect, useRef } from 'react'
import { Mic, FileText, Users, Calendar, Inbox, Zap, Shield, Globe } from 'lucide-react'
import './Features.css'

const features = [
  {
    id: 'ambient-recording',
    icon: Mic,
    color: 'teal',
    title: 'Ambient Recording',
    desc: 'Just start talking. SwiftCare listens in the background while you focus on your patient — no buttons, no interruptions, no friction.',
    size: 'large',
  },
  {
    id: 'instant-notes',
    icon: FileText,
    color: 'indigo',
    title: 'Instant SOAP Notes',
    desc: 'AI generates a complete, structured SOAP note in under a second. Review and sign — never start from a blank page again.',
    size: 'small',
  },
  {
    id: 'patient-mgmt',
    icon: Users,
    color: 'purple',
    title: 'Patient Management',
    desc: 'Search, view, and track your entire patient panel with vital signs, lab results, and AI-generated summaries — all in one tap.',
    size: 'small',
  },
  {
    id: 'quick-record',
    icon: Zap,
    color: 'teal',
    title: 'Quick Record',
    desc: "Start a visit immediately without choosing a patient first. Assign afterward — because clinical moments shouldn't wait for admin.",
    size: 'medium',
  },
  {
    id: 'scheduling',
    icon: Calendar,
    color: 'indigo',
    title: 'Smart Scheduling',
    desc: 'View today\'s appointments at a glance, filter upcoming vs. seen, and jump directly to any patient chart.',
    size: 'medium',
  },
  {
    id: 'unassigned',
    icon: Inbox,
    color: 'orange',
    title: 'Unassigned Queue',
    desc: 'Recordings without patients land here. Assign them in one tap — nothing gets lost, nothing gets forgotten.',
    size: 'small',
  },
  {
    id: 'hipaa',
    icon: Shield,
    color: 'green',
    title: 'HIPAA Compliant',
    desc: 'End-to-end encryption, zero-retention audio processing, and SOC 2 certified infrastructure keep your data safe.',
    size: 'small',
  },
]

const colorMap = {
  teal:   { bg: 'hsl(180,75%,44%,0.1)',  icon: 'var(--teal)',   border: 'hsl(180,75%,44%,0.2)' },
  indigo: { bg: 'hsl(240,65%,60%,0.1)',  icon: 'hsl(240,75%,72%)', border: 'hsl(240,65%,60%,0.2)' },
  purple: { bg: 'hsl(265,60%,58%,0.1)',  icon: 'hsl(265,70%,72%)', border: 'hsl(265,60%,58%,0.2)' },
  orange: { bg: 'hsl(32,90%,62%,0.1)',   icon: 'hsl(32,90%,62%)', border: 'hsl(32,90%,62%,0.2)' },
  green:  { bg: 'hsl(140,60%,45%,0.1)',  icon: 'hsl(140,60%,55%)', border: 'hsl(140,60%,45%,0.2)' },
}

function FeatureCard({ feature }) {
  const c = colorMap[feature.color]
  const Icon = feature.icon

  return (
    <div id={`feature-card-${feature.id}`} className={`feature-card feature-card--${feature.size} reveal`}>
      <div
        className="feature-card__icon"
        style={{ background: c.bg, border: `1px solid ${c.border}` }}
      >
        <Icon size={22} style={{ color: c.icon }} strokeWidth={2} />
      </div>
      <h3 className="heading-md feature-card__title">{feature.title}</h3>
      <p className="feature-card__desc text-secondary">{feature.desc}</p>
    </div>
  )
}

export default function Features() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      }),
      { threshold: 0.15 }
    )
    const cards = sectionRef.current?.querySelectorAll('.reveal') ?? []
    cards.forEach((el, i) => {
      el.style.transitionDelay = `${i * 0.08}s`
      observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <section id="features" className="section features" ref={sectionRef}>
      {/* Ambient glow */}
      <div className="features__glow" />

      <div className="container">
        <div className="section-header">
          <p className="section-label">Features</p>
          <h2 className="heading-xl section-title">
            Everything a modern<br />
            <span className="text-gradient">clinician needs</span>
          </h2>
          <p className="section-subtitle">
            Built for the pace of real clinical practice — record, document, manage patients, and schedule, 
            all from your iPhone.
          </p>
        </div>

        <div className="features__bento">
          {features.map(f => <FeatureCard key={f.id} feature={f} />)}
        </div>
      </div>
    </section>
  )
}
