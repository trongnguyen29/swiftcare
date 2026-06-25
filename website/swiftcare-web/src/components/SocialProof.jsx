import './SocialProof.css'

const logos = [
  { name: 'UCSF Medical', abbr: 'UCSF' },
  { name: 'Mayo Clinic', abbr: 'MAYO' },
  { name: 'Johns Hopkins', abbr: 'JHU' },
  { name: 'Stanford Health', abbr: 'STAN' },
  { name: 'Cleveland Clinic', abbr: 'CCF' },
  { name: 'Kaiser Permanente', abbr: 'KP' },
]

export default function SocialProof() {
  return (
    <section id="social-proof" className="social-proof">
      <div className="container">
        <p className="social-proof__label">Loved by clinicians at leading health systems</p>
        <div className="social-proof__logos">
          {logos.map(l => (
            <div key={l.name} className="social-proof__logo" aria-label={l.name}>
              <span className="social-proof__logo-abbr">{l.abbr}</span>
              <span className="social-proof__logo-name">{l.name}</span>
            </div>
          ))}
        </div>
        <div className="social-proof__stats">
          <div className="social-proof__stat">
            <span className="social-proof__stat-num">2hrs</span>
            <span className="social-proof__stat-label">saved per day</span>
          </div>
          <div className="social-proof__divider" />
          <div className="social-proof__stat">
            <span className="social-proof__stat-num">0.8s</span>
            <span className="social-proof__stat-label">average note time</span>
          </div>
          <div className="social-proof__divider" />
          <div className="social-proof__stat">
            <span className="social-proof__stat-num">97%</span>
            <span className="social-proof__stat-label">clinician satisfaction</span>
          </div>
          <div className="social-proof__divider" />
          <div className="social-proof__stat">
            <span className="social-proof__stat-num">100+</span>
            <span className="social-proof__stat-label">specialties supported</span>
          </div>
        </div>
      </div>
    </section>
  )
}
