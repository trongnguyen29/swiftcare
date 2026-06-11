import type { Patient } from '../lib/supabase'

interface Props { patient: Patient; onAskAI?: () => void; onStartRecording?: () => void }

function sexGlyph(sex: string | null): string {
  return sex === 'Male' ? '♂' : sex === 'Female' ? '♀' : '⊕'
}

function maritalLabel(m: string | null): string | null {
  if (!m) return null
  return m === 'm' ? 'Married' : m === 's' ? 'Single' : m
}

/** The single authoritative patient identity banner.
 *  Replaces the former header UUID chip, gradient pt-strip, and summary hero. */
export default function PatientBanner({ patient: p, onAskAI, onStartRecording }: Props) {
  const isLC = p.label === 1
  const name =
    [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ').replace(/\d+/g, '').trim() ||
    p.ptnum
  const subline = [p.age != null ? `${p.age}y` : null, p.administrative_sex, p.preferred_language]
    .filter(Boolean)
    .join(' · ')

  const sccPct = p.scc != null ? Math.min(100, Math.round((p.scc / 172) * 100)) : 0

  const demographics = [
    { label: 'Race',      val: p.race },
    { label: 'Ethnicity', val: p.ethnicity },
    { label: 'Marital',   val: maritalLabel(p.marital) },
    { label: 'State',     val: p.state },
  ].filter(d => d.val) as { label: string; val: string }[]

  return (
    <div className="pt-banner">
      <div className="pb-avatar">{sexGlyph(p.administrative_sex)}</div>

      <div className="pb-info">
        <div className="pb-name-row">
          <span className="pb-name">{name}</span>
          {isLC && <span className="badge badge-danger pb-status">⚠ LC Positive</span>}
          {p.tobacco_status === 'former' && <span className="badge badge-warn pb-status">Former Smoker</span>}
          {p.sdoh_veteran_status && <span className="badge badge-blue pb-status">Veteran</span>}
        </div>
        <div className="pb-sub">{subline || '—'}</div>
        {demographics.length > 0 && (
          <div className="pb-meta">
            {demographics.map(d => (
              <span key={d.label} className="pb-meta-item">
                <span className="pb-meta-key">{d.label}</span>
                <span className="pb-meta-val">{d.val}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="pb-right">
        {onStartRecording && (
          <button className="pb-rec" onClick={onStartRecording} title="Start recording this visit">
            <span className="pb-rec-dot" />
            Start Recording
          </button>
        )}
        {onAskAI && (
          <button className="pb-ask-ai" onClick={onAskAI} title="Ask AI about this patient">
            <span className="pb-ask-ai-icon">✦</span>
            Ask AI
          </button>
        )}
        {p.scc != null && (
          <div className="pb-scc">
            <div className="pb-scc-label">SCC Score</div>
            <div className="pb-scc-val">{p.scc}</div>
            <div className="pb-scc-bar">
              <div className="pb-scc-fill" style={{ width: `${sccPct}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
