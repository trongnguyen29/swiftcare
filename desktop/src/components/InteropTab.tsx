import { useState, useEffect, useCallback } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  epicStartLogin,
  epicGetStatus,
  epicListPatients,
  epicSearchPatients,
  epicGetPatient,
  epicGetResources,
  epicClaimCode,
  storeSessionId,
  getStoredSessionId,
  clearSession,
  type EpicPatient,
  type EpicCondition,
  type EpicMedication,
  type EpicAllergy,
  type EpicObservation,
  type EpicImmunization,
  type EpicEncounter,
} from '../lib/epic'

type Status = 'idle' | 'connecting' | 'connected' | 'error'

interface PatientResources {
  conditions:    EpicCondition[]
  medications:   EpicMedication[]
  allergies:     EpicAllergy[]
  observations:  EpicObservation[]
  immunizations: EpicImmunization[]
  encounters:    EpicEncounter[]
}

type ResourceTab = 'conditions' | 'medications' | 'allergies' | 'observations' | 'immunizations' | 'encounters'

// ─── helpers ──────────────────────────────────────────────────────────────────

function age(dob: string | null): string {
  if (!dob) return '—'
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000))
  return `${years}y`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ─── Module-level poll handle — survives HMR re-mounts ───────────────────────
let _pollInterval: ReturnType<typeof setInterval> | null = null

function stopPollingGlobal() {
  if (_pollInterval !== null) {
    clearInterval(_pollInterval)
    _pollInterval = null
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InteropTab({
  incomingClaim,
  onClaimProcessed,
}: {
  incomingClaim?: string | null
  onClaimProcessed?: () => void
}) {
  const [status,       setStatus]       = useState<Status>('idle')
  const [statusMsg,    setStatusMsg]    = useState('')
  const [sessionId,    setSessionId]    = useState<string | null>(null)

  const [patients,     setPatients]     = useState<EpicPatient[]>([])
  const [patientsLoading, setPatientsLoading] = useState(false)

  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchResults, setSearchResults] = useState<EpicPatient[]>([])
  const [searching,    setSearching]    = useState(false)

  const [selected,     setSelected]     = useState<EpicPatient | null>(null)
  const [resources,    setResources]    = useState<PatientResources | null>(null)
  const [resLoading,   setResLoading]   = useState(false)
  const [resFetchErrors, setResFetchErrors] = useState<string[]>([])
  const [activeTab,    setActiveTab]    = useState<ResourceTab>('conditions')

  // ─── On mount: restore session; cancel any stale poll ────────────────────────
  useEffect(() => {
    stopPollingGlobal()   // kill any interval left over from a previous mount / HMR
    const stored = getStoredSessionId()
    if (stored) {
      epicGetStatus(stored).then(s => {
        if (s.connected) {
          setSessionId(stored)
          setStatus('connected')
          loadPersistedPatients(stored)
        }
        // stored sessions don't auto-poll — already settled
      }).catch(() => {})
    }
    return () => stopPollingGlobal()
  }, [])

  useEffect(() => {
    if (!incomingClaim) return
    handleDeepLinkClaim(incomingClaim)
  }, [incomingClaim])

  async function handleDeepLinkClaim(code: string) {
    try {
      const result = await epicClaimCode(code)
      storeSessionId(result.sessionId)
      setSessionId(result.sessionId)
      setStatus('connected')
      setStatusMsg('')
      await loadPersistedPatients(result.sessionId)
      if (result.launchKind === 'ehr' && result.patientFhirId) {
        openEhrPatient(result.sessionId, result.patientFhirId)
      }
    } catch (e) {
      setStatus('error')
      setStatusMsg(String(e))
    } finally {
      onClaimProcessed?.()   // clear incomingClaim in App so remounts don't re-submit
    }
  }

  async function loadPersistedPatients(sid: string) {
    setPatientsLoading(true)
    try {
      const list = await epicListPatients(sid)
      setPatients(list)
    } catch { /* non-fatal */ } finally {
      setPatientsLoading(false)
    }
  }

  async function openEhrPatient(sid: string, fhirId: string) {
    const pt = await epicGetPatient(sid, fhirId).catch(() => null)
    if (pt) selectPatient(pt, sid)
  }

  // ─── Connect flow ────────────────────────────────────────────────────────────
  async function handleConnect() {
    stopPollingGlobal()
    setStatus('connecting')
    setStatusMsg('Opening Epic login in browser…')
    try {
      const sid = await epicStartLogin(openUrl)
      setSessionId(sid)
      setStatusMsg('Waiting for authorization… (complete login in the browser)')
      startPolling(sid)
    } catch (e) {
      setStatus('error')
      setStatusMsg(String(e))
    }
  }

  function startPolling(sid: string) {
    stopPollingGlobal()
    let attempts = 0
    _pollInterval = setInterval(async () => {
      attempts++
      try {
        const s = await epicGetStatus(sid)
        if (s.connected) {
          stopPollingGlobal()
          setStatus('connected')
          setStatusMsg('')
          await loadPersistedPatients(sid)
          if (s.launchKind === 'ehr' && s.patientFhirId) {
            openEhrPatient(sid, s.patientFhirId)
          }
        }
      } catch { /* ignore transient errors */ }
      if (attempts > 36) stopPollingGlobal()   // 3-minute timeout at 5s interval
    }, 5000)   // 5s — enough to catch completion without flooding the terminal
  }

  function handleDisconnect() {
    stopPollingGlobal()
    clearSession()
    setSessionId(null)
    setStatus('idle')
    setStatusMsg('')
    setPatients([])
    setSearchResults([])
    setSelected(null)
    setResources(null)
  }

  // ─── Search ──────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q)
    if (!sessionId || q.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await epicSearchPatients(sessionId, { family: q.trim() })
      setSearchResults(results)
    } catch { /* ignore */ } finally {
      setSearching(false)
    }
  }, [sessionId])

  // ─── Patient detail ──────────────────────────────────────────────────────────
  async function selectPatient(pt: EpicPatient, sid?: string) {
    setSelected(pt)
    setResources(null)
    setResFetchErrors([])
    setResLoading(true)
    const session = sid ?? sessionId
    if (!session) { setResLoading(false); return }
    try {
      const res = await epicGetResources(session, pt.fhirId)
      setResources(res)
      setResFetchErrors(res.fetchErrors)
    } catch (e) {
      setResFetchErrors([String(e)])
    } finally {
      setResLoading(false)
    }
  }

  // ─── Combined list (persisted + live search results) ─────────────────────────
  const searchResultIds = new Set(searchResults.map(p => p.fhirId))
  const mergedList = [
    ...searchResults,
    ...patients.filter(p => !searchResultIds.has(p.fhirId)),
  ]

  const displayList: EpicPatient[] = searchQuery.trim().length > 0
    ? mergedList.filter(p =>
        p.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mrn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        searchResultIds.has(p.fhirId)
      )
    : patients

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <>
        {resFetchErrors.length > 0 && (
          <div style={{ background: '#fef3c7', borderBottom: '1px solid #fcd34d', padding: '8px 16px', fontSize: 12, color: '#92400e' }}>
            ⚠ Some resources failed to load: {resFetchErrors.join(' · ')}
          </div>
        )}
        <EpicPatientDetail
          patient={selected}
          resources={resources}
          loading={resLoading}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBack={() => { setSelected(null); setResources(null); setResFetchErrors([]) }}
        />
      </>
    )
  }

  // `selected` is null past this point — don't access .fhirId on it below
  const activeFhirId: string | null = null  // nothing selected when list is visible

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Sidebar: status + patient list ── */}
      <div style={{ width: 280, flexShrink: 0, background: 'var(--bg-white)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Epic EHR
          </div>

          {status === 'idle' && (
            <button className="settings-btn" style={{ width: '100%', textAlign: 'center', background: 'var(--teal-600)', color: '#fff', border: 'none', padding: '8px 14px' }} onClick={handleConnect}>
              Connect to Epic
            </button>
          )}

          {status === 'connecting' && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <div style={{ color: 'var(--teal-600)', fontWeight: 600, marginBottom: 4 }}>Connecting…</div>
              {statusMsg}
            </div>
          )}

          {status === 'connected' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 600, flex: 1 }}>Connected</span>
              <button className="settings-btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          )}

          {status === 'error' && (
            <div style={{ fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>
              <strong>Error:</strong> {statusMsg}
              <br />
              <button className="settings-btn" style={{ marginTop: 6 }} onClick={handleConnect}>Retry</button>
            </div>
          )}
        </div>

        {/* Search */}
        {status === 'connected' && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <input
              className="search-input"
              placeholder="Search Epic patients…"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
            />
            {searching && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Searching Epic…</div>}
          </div>
        )}

        {/* Patient list */}
        <div className="patient-list" style={{ flex: 1, overflowY: 'auto' }}>
          {patientsLoading && (
            <div className="list-empty">Loading patients…</div>
          )}
          {!patientsLoading && status === 'connected' && displayList.length === 0 && (
            <div className="list-empty">
              {searchQuery ? 'No results — try a last name or MRN.' : 'No persisted patients yet. Search above to fetch.'}
            </div>
          )}
          {!patientsLoading && status !== 'connected' && status !== 'connecting' && (
            <div className="list-empty" style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6 }}>
              Connect to Epic to see patients.
            </div>
          )}
          {displayList.map(pt => (
            <button
              key={pt.fhirId}
              className={`patient-row ${activeFhirId === pt.fhirId ? 'active' : ''}`}
              onClick={() => selectPatient(pt)}
            >
              <div className="patient-row-top">
                <span className="patient-id">{pt.fullName ?? pt.fhirId}</span>
                <span className="badge" style={{ fontSize: 10, background: 'var(--teal-50)', color: 'var(--teal-600)', border: '1px solid var(--teal-100)', borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>Epic</span>
              </div>
              <div className="patient-row-sub">
                {[age(pt.birthDate), pt.gender, pt.mrn ? `MRN ${pt.mrn}` : null].filter(Boolean).join(' · ')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main: empty state ── */}
      <main className="main-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div className="empty-icon" style={{ color: 'var(--teal-600)' }}>⇌</div>
          <div className="empty-title">Epic Interoperability</div>
          <div className="empty-sub">
            {status === 'connected'
              ? 'Select a patient from the list or search to load live Epic data.'
              : 'Connect to Epic to see patients and fetch live clinical data.'}
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Patient detail view ──────────────────────────────────────────────────────

function EpicPatientDetail({
  patient: pt,
  resources,
  loading,
  activeTab,
  onTabChange,
  onBack,
}: {
  patient: EpicPatient
  resources: PatientResources | null
  loading: boolean
  activeTab: ResourceTab
  onTabChange: (t: ResourceTab) => void
  onBack: () => void
}) {
  const TABS: { id: ResourceTab; label: string }[] = [
    { id: 'conditions',    label: 'Conditions'    },
    { id: 'medications',   label: 'Medications'   },
    { id: 'allergies',     label: 'Allergies'     },
    { id: 'observations',  label: 'Vitals / Labs' },
    { id: 'immunizations', label: 'Immunizations' },
    { id: 'encounters',    label: 'Encounters'    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Patient strip */}
      <div className="pt-strip" style={{ flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: '0 8px 0 0' }} title="Back">←</button>
        <div className="pt-strip-avatar" style={{ background: 'var(--teal-50)', color: 'var(--teal-600)' }}>
          {pt.gender === 'male' ? '♂' : pt.gender === 'female' ? '♀' : '⊕'}
        </div>
        <div className="pt-strip-info">
          <div className="pt-strip-name">{pt.fullName ?? pt.fhirId}</div>
          <div className="pt-strip-sub">
            {[age(pt.birthDate), pt.gender, pt.mrn ? `MRN ${pt.mrn}` : null].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="pt-strip-badges">
          <span className="badge" style={{ background: 'var(--teal-50)', color: 'var(--teal-600)', border: '1px solid var(--teal-100)' }}>Epic</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="pt-tabbar" style={{ flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`pt-tab ${activeTab === t.id ? 'pt-tab--active' : ''}`}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-tab-content" style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {loading && <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>Loading clinical data…</div>}

        {!loading && !resources && (
          <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>No data available. Ensure Epic session is connected.</div>
        )}

        {!loading && resources && (
          <>
            {activeTab === 'conditions'    && <ConditionList    items={resources.conditions}    />}
            {activeTab === 'medications'   && <MedicationList   items={resources.medications}   />}
            {activeTab === 'allergies'     && <AllergyList      items={resources.allergies}     />}
            {activeTab === 'observations'  && <ObservationList  items={resources.observations}  />}
            {activeTab === 'immunizations' && <ImmunizationList items={resources.immunizations} />}
            {activeTab === 'encounters'    && <EncounterList    items={resources.encounters}    />}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Resource list sub-components ─────────────────────────────────────────────

const SECTION: React.CSSProperties = { marginBottom: 24 }
const CARD: React.CSSProperties = { background: 'var(--bg-white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 8 }
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }
const VALUE: React.CSSProperties = { fontSize: 13, color: 'var(--text-heading)', fontWeight: 500 }
const EMPTY: React.CSSProperties = { fontSize: 13, color: 'var(--text-faint)', fontStyle: 'italic' }

function statusBadge(s: string | null) {
  if (!s) return null
  const lower = s.toLowerCase()
  const bg = lower === 'active' ? 'var(--ok-bg)' : lower === 'resolved' || lower === 'inactive' ? 'var(--bg-subtle)' : 'var(--warn-bg)'
  const color = lower === 'active' ? 'var(--ok)' : lower === 'resolved' || lower === 'inactive' ? 'var(--text-muted)' : 'var(--warn)'
  return <span style={{ fontSize: 10, background: bg, color, border: `1px solid ${color}`, borderRadius: 10, padding: '1px 7px', fontWeight: 600, marginLeft: 6, verticalAlign: 'middle' }}>{s}</span>
}

function ConditionList({ items }: { items: EpicCondition[] }) {
  if (!items.length) return <p style={EMPTY}>No conditions on record.</p>
  return (
    <div style={SECTION}>
      {items.map(c => (
        <div key={c.id} style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={VALUE}>{c.display ?? c.text ?? c.code ?? '—'}</span>
            {statusBadge(c.status)}
          </div>
          {c.onset && <div style={LABEL}>Onset: {fmtDate(c.onset)}</div>}
        </div>
      ))}
    </div>
  )
}

function MedicationList({ items }: { items: EpicMedication[] }) {
  if (!items.length) return <p style={EMPTY}>No medications on record.</p>
  return (
    <div style={SECTION}>
      {items.map(m => (
        <div key={m.id} style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={VALUE}>{m.display ?? m.text ?? m.code ?? '—'}</span>
            {statusBadge(m.status)}
          </div>
          {m.dosageText && <div style={LABEL}>{m.dosageText}</div>}
          {m.authoredOn && <div style={LABEL}>Ordered: {fmtDate(m.authoredOn)}</div>}
        </div>
      ))}
    </div>
  )
}

function AllergyList({ items }: { items: EpicAllergy[] }) {
  if (!items.length) return <p style={EMPTY}>No known allergies.</p>
  return (
    <div style={SECTION}>
      {items.map(a => (
        <div key={a.id} style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={VALUE}>{a.display ?? a.text ?? a.code ?? '—'}</span>
            {a.criticality && <span style={{ fontSize: 10, marginLeft: 6, color: a.criticality === 'high' ? 'var(--danger)' : 'var(--warn)', fontWeight: 600 }}>{a.criticality.toUpperCase()}</span>}
          </div>
          {a.reactions.length > 0 && <div style={LABEL}>Reactions: {a.reactions.join(', ')}</div>}
        </div>
      ))}
    </div>
  )
}

function ObservationList({ items }: { items: EpicObservation[] }) {
  if (!items.length) return <p style={EMPTY}>No recent vital signs or labs.</p>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
      {items.map(o => (
        <div key={o.id} style={{ ...CARD, marginBottom: 0 }}>
          <div style={LABEL}>{o.display ?? o.code ?? '—'}</div>
          <div style={{ ...VALUE, fontSize: 16 }}>
            {o.value ?? '—'}
            {o.unit && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{o.unit}</span>}
          </div>
          {o.effective && <div style={{ ...LABEL, marginTop: 2 }}>{fmtDate(o.effective)}</div>}
        </div>
      ))}
    </div>
  )
}

function ImmunizationList({ items }: { items: EpicImmunization[] }) {
  if (!items.length) return <p style={EMPTY}>No immunizations on record.</p>
  return (
    <div style={SECTION}>
      {items.map(i => (
        <div key={i.id} style={CARD}>
          <div style={VALUE}>{i.display ?? i.vaccine ?? '—'}</div>
          {i.occurrence && <div style={LABEL}>{fmtDate(i.occurrence)}</div>}
        </div>
      ))}
    </div>
  )
}

function EncounterList({ items }: { items: EpicEncounter[] }) {
  if (!items.length) return <p style={EMPTY}>No encounters on record.</p>
  return (
    <div style={SECTION}>
      {items.map(e => (
        <div key={e.id} style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={VALUE}>{e.type ?? e.class ?? '—'}</span>
            {statusBadge(e.status)}
          </div>
          {e.periodStart && <div style={LABEL}>{fmtDate(e.periodStart)}{e.periodEnd ? ` – ${fmtDate(e.periodEnd)}` : ''}</div>}
        </div>
      ))}
    </div>
  )
}
