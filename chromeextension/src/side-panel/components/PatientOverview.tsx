import type { Patient } from "../../types/patient";

interface Props { patient: Patient; }

function VitalCard({ label, value, unit, color }: {
  label: string; value?: number | null; unit?: string; color?: string;
}) {
  if (value == null) return null;
  return (
    <div className="vital-card">
      <div className="vital-card__label">{label}</div>
      <div className="vital-card__value" style={color ? { color } : undefined}>
        {typeof value === "number" ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
        {unit && <span className="vital-card__unit">{unit}</span>}
      </div>
    </div>
  );
}

function heightFt(cm: number) {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn % 12);
  return `${ft}'${inch}"`;
}

function bmiColor(bmi: number) {
  if (bmi < 18.5) return "var(--color-indigo)";
  if (bmi < 25) return "var(--color-green)";
  if (bmi < 30) return "var(--color-amber)";
  return "var(--color-red)";
}

export default function PatientOverview({ patient: p }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

      {/* Vitals */}
      <div className="vitals-grid">
        {p.systolic_bp && p.diastolic_bp && (
          <div className="vital-card">
            <div className="vital-card__label">Blood Pressure</div>
            <div className="vital-card__value">
              {p.systolic_bp}/{p.diastolic_bp}
              <span className="vital-card__unit">mmHg</span>
            </div>
          </div>
        )}
        <VitalCard label="Heart Rate" value={p.heart_rate} unit="bpm" />
        <VitalCard label="BMI" value={p.bmi} color={p.bmi ? bmiColor(p.bmi) : undefined} />
        <VitalCard label="Temp" value={p.temperature_c} unit="°C" />
        <VitalCard label="SpO₂" value={p.oxygen_saturation} unit="%" />
        <VitalCard label="Resp Rate" value={p.respiratory_rate} unit="/min" />
        {p.height_cm && (
          <div className="vital-card">
            <div className="vital-card__label">Height</div>
            <div className="vital-card__value">
              {heightFt(p.height_cm)}
              <span className="vital-card__unit">({p.height_cm} cm)</span>
            </div>
          </div>
        )}
        {p.weight_kg && (
          <div className="vital-card">
            <div className="vital-card__label">Weight</div>
            <div className="vital-card__value">
              {p.weight_kg.toFixed(1)}
              <span className="vital-card__unit">kg</span>
            </div>
          </div>
        )}
      </div>

      {/* Problems */}
      {p.problems && p.problems.length > 0 && (
        <div className="list-section">
          <div className="list-section__title">Problems ({p.problems.length})</div>
          {p.problems.map((pr, i) => (
            <div key={i} className="list-section__item">
              <div className="list-section__item-title">{pr.display}</div>
              <div className="list-section__item-sub">
                {pr.icd10_code}
                {pr.onset_date ? ` · Since ${pr.onset_date}` : ""}
                {pr.status ? ` · ${pr.status}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Medications */}
      {p.medications && p.medications.length > 0 && (
        <div className="list-section">
          <div className="list-section__title">Medications ({p.medications.length})</div>
          {p.medications.map((m, i) => (
            <div key={i} className="list-section__item">
              <div className="list-section__item-title">{m.name}</div>
              <div className="list-section__item-sub">
                {[m.dose, m.route, m.frequency].filter(Boolean).join(" · ")}
                {m.indication ? ` · ${m.indication}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Allergies */}
      {p.allergies && p.allergies.length > 0 && (
        <div className="list-section">
          <div className="list-section__title">Allergies ({p.allergies.length})</div>
          {p.allergies.map((a, i) => (
            <div key={i} className="list-section__item">
              <div className="list-section__item-title" style={{ color: "var(--color-red)" }}>
                ⚠️ {a.substance}
              </div>
              <div className="list-section__item-sub">
                {[a.reaction, a.severity, a.status].filter(Boolean).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Demographics */}
      <div className="list-section">
        <div className="list-section__title">Demographics</div>
        {[
          { label: "Date of Birth", value: p.date_of_birth },
          { label: "Sex", value: p.administrative_sex },
          { label: "Race", value: p.race },
          { label: "Ethnicity", value: p.ethnicity },
          { label: "Language", value: p.preferred_language },
          { label: "Marital", value: p.marital },
          { label: "Address", value: [p.address_line, p.city, p.state, p.zip_code].filter(Boolean).join(", ") },
          { label: "Phone", value: p.phone },
          { label: "Email", value: p.email },
        ]
          .filter((row) => row.value)
          .map((row, i) => (
            <div key={i} className="list-section__item" style={{ display: "flex", gap: "10px" }}>
              <span className="text-xs text-muted" style={{ minWidth: "80px" }}>
                {row.label}
              </span>
              <span className="text-sm">{row.value}</span>
            </div>
          ))}
      </div>

      {/* Care Team */}
      {p.care_team && p.care_team.length > 0 && (
        <div className="list-section">
          <div className="list-section__title">Care Team</div>
          {p.care_team.map((m, i) => (
            <div key={i} className="list-section__item">
              <div className="list-section__item-title">{m.name}</div>
              <div className="list-section__item-sub">
                {m.role}
                {m.organization ? ` · ${m.organization}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insurance */}
      {p.insurance && (
        <div className="list-section">
          <div className="list-section__title">Insurance</div>
          {[
            { label: "Payer", value: p.insurance.payer },
            { label: "Status", value: p.insurance.coverage_status },
            { label: "Type", value: p.insurance.coverage_type },
            { label: "Member ID", value: p.insurance.member_id },
          ]
            .filter((r) => r.value)
            .map((r, i) => (
              <div key={i} className="list-section__item" style={{ display: "flex", gap: "10px" }}>
                <span className="text-xs text-muted" style={{ minWidth: "80px" }}>
                  {r.label}
                </span>
                <span className="text-sm">{r.value}</span>
              </div>
            ))}
        </div>
      )}

      {/* SDOH */}
      {(p.sdoh_housing_status || p.sdoh_financial_strain || p.sdoh_education_level) && (
        <div className="list-section">
          <div className="list-section__title">Social Determinants</div>
          {[
            { label: "Housing", value: p.sdoh_housing_status },
            { label: "Financial", value: p.sdoh_financial_strain },
            { label: "Education", value: p.sdoh_education_level },
            { label: "Tobacco", value: p.tobacco_status },
          ]
            .filter((r) => r.value)
            .map((r, i) => (
              <div key={i} className="list-section__item" style={{ display: "flex", gap: "10px" }}>
                <span className="text-xs text-muted" style={{ minWidth: "80px" }}>
                  {r.label}
                </span>
                <span className="text-sm">{r.value}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
