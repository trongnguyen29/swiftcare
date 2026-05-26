import { useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import OverviewTab from "./components/tabs/OverviewTab";
import MedicationsTab from "./components/tabs/MedicationsTab";
import LabsTab from "./components/tabs/LabsTab";
import NotesTab from "./components/tabs/NotesTab";
import ProblemsTab from "./components/tabs/ProblemsTab";
import "./App.css";

const TABS = ["Overview", "Problems", "Medications", "Labs", "Notes"];

export default function App() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="app-shell">
      <Header />
      <div className="content-area">
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className={`main-content ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
          <div className="tab-bar">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="tab-content">
            {activeTab === "Overview" && <OverviewTab />}
            {activeTab === "Problems" && <ProblemsTab />}
            {activeTab === "Medications" && <MedicationsTab />}
            {activeTab === "Labs" && <LabsTab />}
            {activeTab === "Notes" && <NotesTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
