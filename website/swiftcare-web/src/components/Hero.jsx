import { Mic, Play, ArrowRight, CheckCircle } from 'lucide-react'
import './Hero.css'

export default function Hero() {
  return (
    <section id="hero" className="hero">
      {/* Background glows */}
      <div className="hero__glow hero__glow--1" />
      <div className="hero__glow hero__glow--2" />
      <div className="hero__grid" />

      <div className="container hero__inner">
        {/* Left column */}
        <div className="hero__content">
          <div className="badge badge-teal hero__badge">
            <Mic size={12} />
            AI Medical Scribe for iOS
          </div>

          <h1 className="heading-display hero__headline">
            Document Less.<br />
            <span className="text-gradient">Care More.</span>
          </h1>

          <p className="hero__subtitle">
            SwiftCare listens to your patient visits and instantly generates accurate SOAP notes, 
            freeing you to focus on what matters — your patients.
          </p>

          <ul className="hero__proof">
            {[
              'Instant SOAP notes in seconds',
              'Ambient recording — no clicking required',
              'Patient management built in',
            ].map(item => (
              <li key={item} className="hero__proof-item">
                <CheckCircle size={16} className="hero__proof-icon" />
                {item}
              </li>
            ))}
          </ul>

          <div className="hero__ctas">
            <a href="#pricing" id="hero-cta-primary" className="btn btn-primary btn-lg">
              Start Free Today
              <ArrowRight size={18} />
            </a>
            <a href="#how-it-works" id="hero-cta-demo" className="btn btn-outline btn-lg">
              <Play size={16} />
              See How It Works
            </a>
          </div>

          <p className="hero__disclaimer">
            Free plan available · No credit card required · iOS 17+
          </p>
        </div>

        {/* Right column — phone mockup */}
        <div className="hero__mockup-wrap">
          <div className="hero__mockup">
            <div className="hero__phone">
              {/* Phone frame */}
              <div className="hero__phone-screen">
                {/* Status bar */}
                <div className="hero__phone-status">
                  <span>9:41</span>
                  <div className="hero__phone-notch" />
                  <span>SwiftCare</span>
                </div>

                {/* Greeting */}
                <div className="hero__app-greeting">
                  <p className="hero__app-greeting-text">Good morning, Dr. Nguyen</p>
                  <p className="hero__app-date">Wednesday, June 25</p>
                </div>

                {/* Stat cards */}
                <div className="hero__app-stats">
                  <div className="hero__stat-card hero__stat-card--teal">
                    <span className="hero__stat-num">8</span>
                    <span className="hero__stat-label">Today</span>
                  </div>
                  <div className="hero__stat-card hero__stat-card--orange">
                    <span className="hero__stat-num">2</span>
                    <span className="hero__stat-label">Unassigned</span>
                  </div>
                  <div className="hero__stat-card hero__stat-card--indigo">
                    <span className="hero__stat-num">14</span>
                    <span className="hero__stat-label">Upcoming</span>
                  </div>
                </div>

                {/* Quick Record button */}
                <div className="hero__quick-record">
                  <div className="hero__qr-icon">
                    <Mic size={20} />
                  </div>
                  <div className="hero__qr-text">
                    <p className="hero__qr-title">Quick Record</p>
                    <p className="hero__qr-sub">Start a visit instantly</p>
                  </div>
                  <ArrowRight size={16} className="hero__qr-arrow" />
                </div>

                {/* Recording waveform animation */}
                <div className="hero__waveform">
                  <div className="hero__wave-label">
                    <div className="hero__wave-dot" />
                    <span>Recording</span>
                  </div>
                  <div className="hero__bars">
                    {[...Array(18)].map((_, i) => (
                      <div key={i} className="hero__bar" style={{ animationDelay: `${i * 0.07}s` }} />
                    ))}
                  </div>
                </div>

                {/* Generating note indicator */}
                <div className="hero__generating">
                  <div className="hero__gen-pulse" />
                  <span>Generating SOAP note…</span>
                </div>

                {/* Schedule rows */}
                <div className="hero__schedule">
                  {[
                    { time: '10:00', name: 'John Mitchell', type: 'Follow-up', done: true },
                    { time: '10:30', name: 'Sarah Kim', type: 'Annual exam', done: false },
                    { time: '11:00', name: 'Robert Torres', type: 'New patient', done: false },
                  ].map(r => (
                    <div key={r.time} className={`hero__row${r.done ? ' hero__row--done' : ''}`}>
                      <span className="hero__row-time">{r.time}</span>
                      <div className="hero__row-info">
                        <span className="hero__row-name">{r.name}</span>
                        <span className="hero__row-type">{r.type}</span>
                      </div>
                      {r.done && <div className="hero__row-check" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Home indicator */}
              <div className="hero__phone-home" />
            </div>

            {/* Floating badges */}
            <div className="hero__float hero__float--tl">
              <div className="hero__float-icon">✓</div>
              <div>
                <p className="hero__float-main">Note Ready</p>
                <p className="hero__float-sub">0.8s generation</p>
              </div>
            </div>

            <div className="hero__float hero__float--br">
              <div className="hero__float-icon" style={{ fontSize: '1rem' }}>⚡</div>
              <div>
                <p className="hero__float-main">Quick Record</p>
                <p className="hero__float-sub">No patient needed</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="hero__bottom-fade" />
    </section>
  )
}
