import { useState } from "react";
import type { Patient } from "../types/patient";
import Home from "./pages/Home";
import Patients from "./pages/Patients";
import Schedule from "./pages/Schedule";

type Tab = "home" | "patients" | "schedule";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  function openPatient(p: Patient) {
    setSelectedPatient(p);
    setTab("patients");
  }

  function handleTabChange(t: Tab) {
    if (t === "patients") setSelectedPatient(null);
    setTab(t);
  }

  return (
    <div className="shell">
      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "home" && (
          <Home
            onOpenPatient={openPatient}
            onShowSchedule={() => handleTabChange("schedule")}
          />
        )}
        {tab === "patients" && (
          <Patients
            selectedPatient={selectedPatient}
            onSelectPatient={setSelectedPatient}
            onOpenPatient={openPatient}
          />
        )}
        {tab === "schedule" && <Schedule onOpenPatient={openPatient} />}
      </div>

      {/* Tab Bar at bottom */}
      <nav className="tab-bar">
        <button
          id="tab-home"
          className={`tab-bar__item ${tab === "home" ? "active" : ""}`}
          onClick={() => handleTabChange("home")}
        >
          <span className="tab-bar__icon">🏠</span>
          Home
        </button>
        <button
          id="tab-patients"
          className={`tab-bar__item ${tab === "patients" ? "active" : ""}`}
          onClick={() => handleTabChange("patients")}
        >
          <span className="tab-bar__icon">👥</span>
          Patients
        </button>
        <button
          id="tab-schedule"
          className={`tab-bar__item ${tab === "schedule" ? "active" : ""}`}
          onClick={() => handleTabChange("schedule")}
        >
          <span className="tab-bar__icon">📅</span>
          Schedule
        </button>
      </nav>
    </div>
  );
}
