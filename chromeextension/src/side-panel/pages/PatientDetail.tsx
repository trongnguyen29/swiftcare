import { useState } from "react";
import type { Patient } from "../../types/patient";
import { displayName, initials } from "../../types/patient";
import PatientOverview from "../components/PatientOverview";
import PatientChart from "../components/PatientChart";
import VisitPage from "./VisitPage";
import PastVisits from "../components/PastVisits";
import PatientAppointments from "../components/PatientAppointments";
import AIChat from "./AIChat";

type PatientTab = "overview" | "chart" | "visit" | "history" | "appointments";

const TABS: { id: PatientTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "⊞" },
  { id: "chart", label: "Chart", icon: "📊" },
  { id: "visit", label: "Visit", icon: "🎙️" },
  { id: "history", label: "History", icon: "🕐" },
  { id: "appointments", label: "Appts", icon: "📅" },
];

interface PatientDetailProps {
  patient: Patient;
  onBack: () => void;
}

export default function PatientDetail({ patient, onBack }: PatientDetailProps) {
  const [activeTab, setActiveTab] = useState<PatientTab>("overview");
  const [showAIChat, setShowAIChat] = useState(false);

  const name = displayName(patient);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Back header + banner */}
      <div
        style={{
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        <div className="back-header">
          <button id="back-to-patients" className="back-btn" onClick={onBack}>
            ←
          </button>
          <div className="back-header__title">{name}</div>
          <button
            id="ai-chat-btn"
            className="btn btn--sm"
            style={{ background: "var(--color-teal-subtle)", color: "var(--color-teal)" }}
            onClick={() => setShowAIChat(true)}
          >
            🤖 Ask AI
          </button>
        </div>

        {/* Patient banner */}
        <div style={{ padding: "0 16px 12px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="patient-avatar patient-avatar--large">{initials(name)}</div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800 }}>{name}</div>
            <div className="text-xs text-muted">
              {patient.ptnum}
              {patient.age ? ` · ${Math.round(patient.age)} y/o` : ""}
              {patient.administrative_sex ? ` · ${patient.administrative_sex}` : ""}
              {patient.state ? ` · ${patient.state}` : ""}
            </div>
            {patient.label === 1 && (
              <span className="badge badge--lc" style={{ marginTop: "4px" }}>
                LC+ Positive
              </span>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="detail-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`patient-tab-${t.id}`}
              className={`detail-tab ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "overview" && (
          <div className="page">
            <div className="page-inner">
              <PatientOverview patient={patient} />
            </div>
          </div>
        )}
        {activeTab === "chart" && (
          <div className="page">
            <div className="page-inner">
              <PatientChart patient={patient} />
            </div>
          </div>
        )}
        {activeTab === "visit" && (
          <VisitPage patient={patient} onBack={() => setActiveTab("history")} embedded />
        )}
        {activeTab === "history" && (
          <div className="page">
            <div className="page-inner">
              <PastVisits patient={patient} />
            </div>
          </div>
        )}
        {activeTab === "appointments" && (
          <div className="page">
            <div className="page-inner">
              <PatientAppointments patient={patient} />
            </div>
          </div>
        )}
      </div>

      {/* AI Chat overlay */}
      {showAIChat && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            background: "var(--color-bg)",
          }}
        >
          <AIChat patient={patient} onClose={() => setShowAIChat(false)} />
        </div>
      )}
    </div>
  );
}
