import { useState } from "react";
import Header from "./components/Header";
import PatientListTab from "./components/tabs/PatientListTab";
import PatientDetailTab from "./components/tabs/PatientDetailTab";
import CohortTab from "./components/tabs/CohortTab";
import AITab from "./components/tabs/AITab";
import "./App.css";

export type Patient = {
  ptnum: string; label: number; scc: number | null;
  age: number | null; gender: string | null; race: string | null;
  ethnicity: string | null; marital: string | null; state: string | null;
  systolic_bp: number | null; diastolic_bp: number | null; heart_rate: number | null;
  height: number | null; weight: number | null; bmi: number | null;
  tobacco_status: string | null; pain_score: number | null;
  total_cholesterol: number | null; ldl: number | null; hdl: number | null;
  triglycerides: number | null; hba1c: number | null; glucose: number | null;
};

const TABS = [
  { id: "patients",  label: "Patient Registry" },
  { id: "cohort",    label: "Cohort Analytics" },
  { id: "ai",        label: "✦ AI Assistant"   },
];

export default function App() {
  const [activeTab, setActiveTab]       = useState("patients");
  const [selected, setSelected]         = useState<Patient | null>(null);

  function openPatient(p: Patient) {
    setSelected(p);
  }
  function closePatient() {
    setSelected(null);
  }

  return (
    <div className="app-shell">
      <Header />
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id && !selected ? "active" : ""}`}
            onClick={() => { setSelected(null); setActiveTab(t.id); }}
            style={t.id === "ai" ? { color: activeTab === "ai" && !selected ? "var(--blue-600)" : "var(--teal-500)", fontWeight: 600 } : {}}
          >
            {t.label}
          </button>
        ))}
        {selected && (
          <button className="tab-btn active" style={{ color: "var(--blue-600)" }}>
            📋 {selected.ptnum}
          </button>
        )}
      </div>

      <div className="tab-content">
        {selected ? (
          <PatientDetailTab patient={selected} onBack={closePatient} />
        ) : (
          <>
            {activeTab === "patients" && <PatientListTab onSelect={openPatient} />}
            {activeTab === "cohort"   && <CohortTab />}
            {activeTab === "ai"       && <AITab />}
          </>
        )}
      </div>
    </div>
  );
}
