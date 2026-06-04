import { useState } from 'react'
import Header from './components/Header'
import PatientListTab from './components/tabs/PatientListTab'
import PatientDetailTab from './components/tabs/PatientDetailTab'
import CohortTab from './components/tabs/CohortTab'
import AITab from './components/tabs/AITab'
import type { Patient } from './lib/supabase'
import './App.css'

const TABS = [
  { id: 'patients', label: 'Patient Registry' },
  { id: 'cohort',   label: 'Cohort Analytics' },
  { id: 'ai',       label: '✦ AI Assistant'   },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('patients')
  const [selected,  setSelected]  = useState<Patient | null>(null)

  return (
    <div className="app-shell">
      <Header />
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id && !selected ? 'active' : ''}`}
            onClick={() => { setSelected(null); setActiveTab(t.id) }}
            style={t.id === 'ai' ? { color: activeTab === 'ai' && !selected ? 'var(--blue-600)' : 'var(--teal-500)', fontWeight: 600 } : {}}
          >
            {t.label}
          </button>
        ))}
        {selected && (
          <button className="tab-btn active" style={{ color: 'var(--blue-600)' }}>
            📋 {selected.ptnum}
          </button>
        )}
      </div>

      <div className="tab-content">
        {selected
          ? <PatientDetailTab patient={selected} onBack={() => setSelected(null)} />
          : activeTab === 'patients' ? <PatientListTab onSelect={setSelected} />
          : activeTab === 'cohort'   ? <CohortTab />
          : <AITab />
        }
      </div>
    </div>
  )
}
