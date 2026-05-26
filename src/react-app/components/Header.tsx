export default function Header() {
  return (
    <header className="ehr-header">
      <div className="header-logo">
        <div className="logo-mark">LC</div>
        SwiftCare · Lung Cancer Registry
      </div>
      <div className="header-divider" />
      <span className="header-subtitle">Synthea Dataset · 21,601 Patients</span>
      <div className="header-spacer" />
      <div className="header-stats">
        <div className="hstat"><div className="hstat-val">21,601</div><div className="hstat-lbl">Patients</div></div>
        <div className="hstat"><div className="hstat-val" style={{color:"var(--danger)"}}>5,566</div><div className="hstat-lbl">LC Positive</div></div>
        <div className="hstat"><div className="hstat-val" style={{color:"var(--ok)"}}>16,035</div><div className="hstat-lbl">Control</div></div>
        <div className="hstat"><div className="hstat-val">25.8%</div><div className="hstat-lbl">Prevalence</div></div>
      </div>
      <div className="header-divider" />
      <div className="dr-chip"><div className="dr-dot" />Dr. Okafor</div>
    </header>
  );
}
