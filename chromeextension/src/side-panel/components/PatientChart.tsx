import type { Patient } from "../../types/patient";

interface Props { patient: Patient; }

type LabEntry = { label: string; value?: number | null; unit: string; low?: number; high?: number };

function LabRow({ label, value, unit, low, high }: LabEntry) {
  if (value == null) return null;
  const isHigh = high != null && value > high;
  const isLow = low != null && value < low;
  const className = isHigh || isLow ? "lab-row__value--high" : "lab-row__value--normal";
  return (
    <div className="lab-row">
      <span className="lab-row__name">{label}</span>
      <span className={`lab-row__value ${className}`}>
        {Number.isInteger(value) ? value : value.toFixed(1)} {unit}
        {isHigh ? " ↑" : isLow ? " ↓" : ""}
      </span>
    </div>
  );
}

export default function PatientChart({ patient: p }: Props) {
  const cardiovascular: LabEntry[] = [
    { label: "Total Cholesterol", value: p.total_cholesterol, unit: "mg/dL", high: 200 },
    { label: "LDL", value: p.ldl, unit: "mg/dL", high: 100 },
    { label: "HDL", value: p.hdl, unit: "mg/dL", low: 40 },
    { label: "Triglycerides", value: p.triglycerides, unit: "mg/dL", high: 150 },
  ];

  const metabolic: LabEntry[] = [
    { label: "HbA1c", value: p.hba1c, unit: "%", high: 5.7 },
    { label: "Glucose", value: p.glucose, unit: "mg/dL", high: 100, low: 70 },
    { label: "Creatinine", value: p.creatinine, unit: "mg/dL", high: 1.2 },
    { label: "eGFR", value: p.egfr, unit: "mL/min", low: 60 },
  ];

  const heme: LabEntry[] = [
    { label: "Hemoglobin", value: p.hemoglobin, unit: "g/dL", low: 12 },
    { label: "WBC", value: p.wbc, unit: "K/μL", low: 4, high: 11 },
    { label: "Platelets", value: p.platelets, unit: "K/μL", low: 150, high: 400 },
  ];

  function hasAny(entries: LabEntry[]) {
    return entries.some((e) => e.value != null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Cardiovascular */}
      {hasAny(cardiovascular) && (
        <div className="list-section">
          <div className="list-section__title">❤️ Cardiovascular</div>
          {cardiovascular.map((e) => <LabRow key={e.label} {...e} />)}
        </div>
      )}

      {/* Metabolic */}
      {hasAny(metabolic) && (
        <div className="list-section">
          <div className="list-section__title">🔬 Metabolic</div>
          {metabolic.map((e) => <LabRow key={e.label} {...e} />)}
        </div>
      )}

      {/* Hematology */}
      {hasAny(heme) && (
        <div className="list-section">
          <div className="list-section__title">🩸 Hematology</div>
          {heme.map((e) => <LabRow key={e.label} {...e} />)}
        </div>
      )}

      {/* Procedures */}
      {p.procedures && p.procedures.length > 0 && (
        <div className="list-section">
          <div className="list-section__title">🔧 Procedures ({p.procedures.length})</div>
          {p.procedures.map((proc, i) => (
            <div key={i} className="list-section__item">
              <div className="list-section__item-title">{proc.display}</div>
              <div className="list-section__item-sub">
                {[proc.date, proc.status, proc.performer].filter(Boolean).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Imaging */}
      {p.imaging_results && p.imaging_results.length > 0 && (
        <div className="list-section">
          <div className="list-section__title">🖼️ Imaging ({p.imaging_results.length})</div>
          {p.imaging_results.map((img, i) => (
            <div key={i} className="list-section__item">
              <div className="list-section__item-title">{img.study}</div>
              <div className="list-section__item-sub">{img.date}</div>
              <div className="text-xs text-muted" style={{ marginTop: "4px" }}>
                {img.finding}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Encounters */}
      {p.encounters && p.encounters.length > 0 && (
        <div className="list-section">
          <div className="list-section__title">🏥 Encounters ({p.encounters.length})</div>
          {p.encounters.map((enc, i) => (
            <div key={i} className="list-section__item">
              <div className="list-section__item-title">{enc.encounter_type}</div>
              <div className="list-section__item-sub">
                {[enc.date, enc.reason, enc.facility].filter(Boolean).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clinical Notes */}
      {p.clinical_notes && p.clinical_notes.length > 0 && (
        <div className="list-section">
          <div className="list-section__title">📝 Clinical Notes ({p.clinical_notes.length})</div>
          {p.clinical_notes.map((note, i) => (
            <div key={i} className="list-section__item">
              <div className="list-section__item-title">{note.note_type}</div>
              <div className="list-section__item-sub">{note.date} · {note.author}</div>
              <div
                className="text-xs text-muted"
                style={{
                  marginTop: "4px",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {note.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assessment / Plan */}
      {p.assessment_plan && (
        <div className="list-section">
          <div className="list-section__title">📋 Assessment & Plan</div>
          <div className="list-section__item" style={{ whiteSpace: "pre-wrap" }}>
            {p.assessment_plan}
          </div>
        </div>
      )}

      {/* Immunizations */}
      {p.immunizations && p.immunizations.length > 0 && (
        <div className="list-section">
          <div className="list-section__title">💉 Immunizations ({p.immunizations.length})</div>
          {p.immunizations.map((imm, i) => (
            <div key={i} className="list-section__item">
              <div className="list-section__item-title">{imm.vaccine}</div>
              <div className="list-section__item-sub">{imm.date} · {imm.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
