import { useEffect, useRef, useState } from 'react'
import { Star, ChevronLeft, ChevronRight } from 'lucide-react'
import './Testimonials.css'

const testimonials = [
  {
    quote: "I used to spend 2–3 hours after clinic finishing notes. With SwiftCare, I'm done before I leave the room. The SOAP notes are actually good — I maybe change a sentence or two.",
    author: 'Dr. Marcus Chen',
    role: 'Internal Medicine',
    org: 'UCSF Medical Center',
    initials: 'MC',
    color: 'hsl(180,75%,44%)',
    stars: 5,
  },
  {
    quote: "Quick Record is a game changer. Sometimes a patient stops me in the hallway. I just tap record, have the conversation, and assign it later. Nothing gets lost anymore.",
    author: 'Dr. Priya Patel',
    role: 'Family Medicine',
    org: 'Kaiser Permanente',
    initials: 'PP',
    color: 'hsl(240,75%,72%)',
    stars: 5,
  },
  {
    quote: "The patient management piece surprised me. Having vitals, labs, and an AI summary right next to my notes means I walk into every room actually prepared. It's like having a junior resident.",
    author: 'Dr. Rachel Torres',
    role: 'Hospitalist',
    org: 'Johns Hopkins Hospital',
    initials: 'RT',
    color: 'hsl(265,70%,72%)',
    stars: 5,
  },
  {
    quote: "We've tried four ambient scribes. SwiftCare is the only one that handles the full workflow — recording, notes, scheduling, patient lookup — in one app. The others required too much context switching.",
    author: 'Dr. James Okafor',
    role: 'Emergency Medicine',
    org: 'Cleveland Clinic',
    initials: 'JO',
    color: 'hsl(32,90%,62%)',
    stars: 5,
  },
]

export default function Testimonials() {
  const [active, setActive] = useState(0)
  const ref = useRef(null)

  const prev = () => setActive(a => (a - 1 + testimonials.length) % testimonials.length)
  const next = () => setActive(a => (a + 1) % testimonials.length)

  useEffect(() => {
    const interval = setInterval(next, 6000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.1 }
    )
    const els = ref.current?.querySelectorAll('.reveal') ?? []
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const t = testimonials[active]

  return (
    <section id="testimonials" className="section testimonials" ref={ref}>
      <div className="testimonials__glow" />

      <div className="container">
        <div className="section-header reveal">
          <p className="section-label">Testimonials</p>
          <h2 className="heading-xl section-title">
            Clinicians love<br />
            <span className="text-gradient">SwiftCare</span>
          </h2>
        </div>

        <div className="testimonials__carousel reveal">
          {/* Navigation */}
          <button id="testimonial-prev" className="testimonials__nav testimonials__nav--prev" onClick={prev} aria-label="Previous testimonial">
            <ChevronLeft size={20} />
          </button>
          <button id="testimonial-next" className="testimonials__nav testimonials__nav--next" onClick={next} aria-label="Next testimonial">
            <ChevronRight size={20} />
          </button>

          {/* Main card */}
          <div className="testimonials__card" key={active}>
            {/* Stars */}
            <div className="testimonials__stars">
              {[...Array(t.stars)].map((_, i) => (
                <Star key={i} size={18} fill={t.color} style={{ color: t.color }} />
              ))}
            </div>

            {/* Quote */}
            <blockquote className="testimonials__quote">
              "{t.quote}"
            </blockquote>

            {/* Author */}
            <div className="testimonials__author">
              <div className="testimonials__avatar" style={{ background: `${t.color}20`, borderColor: `${t.color}40`, color: t.color }}>
                {t.initials}
              </div>
              <div className="testimonials__author-info">
                <p className="testimonials__author-name">{t.author}</p>
                <p className="testimonials__author-role">{t.role} · {t.org}</p>
              </div>
            </div>
          </div>

          {/* Dots */}
          <div className="testimonials__dots">
            {testimonials.map((_, i) => (
              <button
                key={i}
                id={`testimonial-dot-${i}`}
                className={`testimonials__dot${i === active ? ' testimonials__dot--active' : ''}`}
                onClick={() => setActive(i)}
                aria-label={`Testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Mini cards */}
        <div className="testimonials__mini reveal">
          {testimonials.map((t, i) => (
            <button
              key={i}
              id={`testimonial-mini-${i}`}
              className={`testimonials__mini-card${i === active ? ' testimonials__mini-card--active' : ''}`}
              onClick={() => setActive(i)}
            >
              <div
                className="testimonials__mini-avatar"
                style={{ background: `${t.color}20`, borderColor: `${t.color}40`, color: t.color }}
              >
                {t.initials}
              </div>
              <div>
                <p className="testimonials__mini-name">{t.author}</p>
                <p className="testimonials__mini-role">{t.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
