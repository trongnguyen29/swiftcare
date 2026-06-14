import SwiftUI

// MARK: - Finding model

enum FindingSeverity: Int, Comparable {
    case critical = 0
    case warning  = 1
    case info     = 2
    case good     = 3

    static func < (lhs: FindingSeverity, rhs: FindingSeverity) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    var color: Color {
        switch self {
        case .critical: return .red
        case .warning:  return .orange
        case .info:     return Color(red: 0.22, green: 0.44, blue: 0.9)
        case .good:     return .green
        }
    }

    var sfSymbol: String {
        switch self {
        case .critical: return "exclamationmark.triangle.fill"
        case .warning:  return "exclamationmark.circle.fill"
        case .info:     return "info.circle.fill"
        case .good:     return "checkmark.circle.fill"
        }
    }
}

struct ClinicalFinding: Identifiable {
    let id     = UUID()
    let severity: FindingSeverity
    let category: String
    let title: String
    let detail: String
    let action: String?
}

// MARK: - Rules engine (mirrors AIInsights.tsx → derive())

func deriveClinicalFindings(for p: Patient) -> [ClinicalFinding] {
    var findings: [ClinicalFinding] = []

    func add(_ sev: FindingSeverity, _ cat: String, _ title: String, _ detail: String, _ action: String? = nil) {
        findings.append(ClinicalFinding(severity: sev, category: cat, title: title, detail: detail, action: action))
    }

    let fmt: (Double) -> String = { String(format: "%g", $0) }

    // ── Oncology ──────────────────────────────────────────────────────────────
    if p.label == 1 {
        add(.critical, "Oncology",
            "Lung Cancer — Positive (LC+)",
            "SCC score \(p.scc.map { fmt($0) } ?? "N/A"). Patient is flagged as lung-cancer positive. Verify imaging and pathology confirmation.",
            "Review CT/PET reports and confirm staging.")
    }

    // ── Cardiovascular ────────────────────────────────────────────────────────
    if let sbp = p.systolic_bp {
        if sbp >= 140 {
            add(.critical, "Cardiovascular",
                "Stage 2 Hypertension — SBP \(fmt(sbp)) mmHg",
                "Systolic BP ≥ 140 mmHg. DBP: \(p.diastolic_bp.map { fmt($0) } ?? "—") mmHg. Significantly elevated cardiovascular and stroke risk.",
                "Consider antihypertensive intensification. Evaluate renal function and sodium intake.")
        } else if sbp >= 130 {
            add(.warning, "Cardiovascular",
                "Stage 1 Hypertension — SBP \(fmt(sbp)) mmHg",
                "SBP 130–139 mmHg falls in Stage 1 HTN per ACC/AHA 2017 guidelines.",
                "Lifestyle modification; reassess in 3 months.")
        } else if let dbp = p.diastolic_bp, sbp < 130 && dbp < 80 {
            add(.good, "Cardiovascular",
                "Blood Pressure — Normal",
                "BP \(Int(sbp))/\(Int(dbp)) mmHg is within normal range.")
        }
    }

    if let hr = p.heart_rate {
        if hr > 100 {
            add(.warning, "Cardiovascular",
                "Tachycardia — HR \(fmt(hr)) bpm",
                "Resting heart rate > 100 bpm. Rule out thyroid disorder, anemia, or arrhythmia.",
                "ECG, TSH, CBC.")
        } else if hr < 60 {
            add(.warning, "Cardiovascular",
                "Bradycardia — HR \(fmt(hr)) bpm",
                "Resting heart rate < 60 bpm. May be physiological in athletes; rule out conduction disease or medication effect.")
        }
    }

    // ── Lipids ────────────────────────────────────────────────────────────────
    if let tc = p.total_cholesterol {
        if tc >= 240 {
            add(.critical, "Lipids",
                "High Cholesterol — \(fmt(tc)) mg/dL",
                "Total cholesterol ≥ 240 mg/dL. LDL: \(p.ldl.map { fmt($0) } ?? "—"), HDL: \(p.hdl.map { fmt($0) } ?? "—"), Triglycerides: \(p.triglycerides.map { fmt($0) } ?? "—").",
                "Initiate or intensify statin therapy. Dietary counseling.")
        } else if tc >= 200 {
            add(.warning, "Lipids",
                "Borderline Cholesterol — \(fmt(tc)) mg/dL",
                "Total cholesterol 200–239 mg/dL (borderline high). Evaluate 10-year ASCVD risk.")
        }
    }

    if let ldl = p.ldl, ldl >= 160 {
        add(.warning, "Lipids",
            "Elevated LDL — \(fmt(ldl)) mg/dL",
            "LDL ≥ 160 mg/dL. High-intensity statin therapy indicated for most patients.",
            "Consider rosuvastatin 20–40 mg or atorvastatin 40–80 mg.")
    }

    if let hdl = p.hdl {
        if hdl < 40 && p.gender == "m" {
            add(.warning, "Lipids", "Low HDL — \(fmt(hdl)) mg/dL", "HDL < 40 mg/dL in males is an independent cardiovascular risk factor.")
        } else if hdl < 50 && p.gender == "f" {
            add(.warning, "Lipids", "Low HDL — \(fmt(hdl)) mg/dL", "HDL < 50 mg/dL in females is an independent cardiovascular risk factor.")
        }
    }

    // ── Endocrine ─────────────────────────────────────────────────────────────
    if let hba1c = p.hba1c {
        if hba1c >= 6.5 {
            add(.critical, "Endocrine",
                "Diabetes — HbA1c \(hba1c)%",
                "HbA1c ≥ 6.5% meets ADA criteria for diabetes. Glucose: \(p.glucose.map { fmt($0) } ?? "—") mg/dL.",
                "Initiate metformin, patient education, and nutritional referral. Recheck HbA1c in 3 months.")
        } else if hba1c >= 5.7 {
            add(.warning, "Endocrine",
                "Prediabetes — HbA1c \(hba1c)%",
                "HbA1c 5.7–6.4% consistent with prediabetes. Risk of progression to T2DM ~10%/year without intervention.",
                "Intensive lifestyle intervention. Recheck HbA1c in 6–12 months.")
        } else {
            add(.good, "Endocrine", "HbA1c — Normal", "HbA1c \(hba1c)% — no evidence of diabetes or prediabetes.")
        }
    }

    if let glu = p.glucose {
        if glu >= 126 {
            add(.warning, "Endocrine", "Fasting Glucose Elevated — \(fmt(glu)) mg/dL",
                "Fasting plasma glucose ≥ 126 mg/dL consistent with diabetes; confirm with repeat testing.")
        } else if glu >= 100 {
            add(.info, "Endocrine", "Impaired Fasting Glucose — \(fmt(glu)) mg/dL",
                "Fasting glucose 100–125 mg/dL indicates impaired fasting glucose. Monitor closely.")
        }
    }

    // ── Metabolic ─────────────────────────────────────────────────────────────
    if let bmi = p.bmi {
        if bmi >= 35 {
            add(.critical, "Metabolic",
                "Severe Obesity — BMI \(fmt(bmi))",
                "BMI ≥ 35 (Class II/III obesity). High risk for T2DM, CVD, sleep apnea, and NASH.",
                "Structured weight management program. Consider GLP-1 agonist or bariatric evaluation.")
        } else if bmi >= 30 {
            add(.warning, "Metabolic",
                "Obesity — BMI \(fmt(bmi))",
                "BMI 30–34.9 (Class I obesity). Increased metabolic and cardiovascular risk.",
                "Behavioral weight loss intervention; target ≥5% weight reduction.")
        } else if bmi >= 25 {
            add(.info, "Metabolic", "Overweight — BMI \(fmt(bmi))", "BMI 25–29.9. Counsel on diet, physical activity, and weight management.")
        } else if bmi >= 18.5 {
            add(.good, "Metabolic", "BMI — Healthy Range", "BMI \(fmt(bmi)) is within the normal range (18.5–24.9).")
        }
    }

    // ── Oncology / Respiratory ────────────────────────────────────────────────
    if p.tobacco_status == "former" {
        add(.info, "Oncology / Respiratory",
            "Former Smoker",
            "Former tobacco use remains a significant risk factor for lung cancer, COPD, and cardiovascular disease.",
            "Annual low-dose CT (LDCT) lung cancer screening if within eligibility criteria (age 50–80, ≥20 pack-year history).")
    }

    // ── Geriatric ─────────────────────────────────────────────────────────────
    if let age = p.age, age >= 65 {
        add(.info, "Geriatric",
            "Age \(Int(age)) — Geriatric Considerations",
            "Patients ≥ 65 warrant assessment for polypharmacy, fall risk, cognitive screening, and vaccine status.")
    }

    // ── Pain ─────────────────────────────────────────────────────────────────
    if let pain = p.pain_score {
        if pain >= 7 {
            add(.warning, "Pain Management",
                "Severe Pain — Score \(Int(pain))/10",
                "Pain score ≥ 7 indicates severe pain requiring prompt assessment and management.",
                "Evaluate pain etiology, consider analgesic escalation or specialist referral.")
        } else if pain >= 4 {
            add(.info, "Pain Management", "Moderate Pain — Score \(Int(pain))/10",
                "Moderate pain (4–6/10). Ensure adequate pain management and monitor response.")
        }
    }

    // ── Renal ─────────────────────────────────────────────────────────────────
    if let egfr = p.egfr {
        if egfr < 30 {
            add(.critical, "Renal",
                "Severe CKD — eGFR \(fmt(egfr)) mL/min (Stage 4–5)",
                "eGFR < 30 indicates Stage 4–5 CKD. High risk for dialysis. Avoid nephrotoxic agents.",
                "Nephrology referral. Review all medications for renal dosing. Discuss AV fistula/dialysis planning.")
        } else if egfr < 60 {
            add(.warning, "Renal",
                "Moderate CKD — eGFR \(fmt(egfr)) mL/min (Stage 3)",
                "eGFR 30–59 indicates Stage 3 CKD. Avoid NSAIDs and nephrotoxic contrast agents.",
                "Monitor creatinine and potassium quarterly. BP target < 130/80.")
        } else {
            add(.good, "Renal", "Renal Function — Normal (eGFR \(Int(egfr)))", "eGFR ≥ 60 mL/min indicates adequate renal function.")
        }
    }

    // ── Respiratory ───────────────────────────────────────────────────────────
    if let spo2 = p.oxygen_saturation {
        if spo2 < 92 {
            add(.critical, "Respiratory",
                "Low Oxygen Saturation — SpO₂ \(fmt(spo2))%",
                "SpO₂ < 92% is clinically significant hypoxemia. Urgent assessment required.",
                "Supplemental O₂, ABG, chest X-ray. Consider pulmonology.")
        } else if spo2 < 95 {
            add(.warning, "Respiratory", "Borderline SpO₂ — \(fmt(spo2))%",
                "SpO₂ 92–94% warrants close monitoring, especially in COPD or lung cancer patients.")
        }
    }

    // ── Allergies ─────────────────────────────────────────────────────────────
    let severeAllergies = (p.allergies ?? []).filter { $0.severity == "severe" && $0.status == "active" }
    if !severeAllergies.isEmpty {
        let n = severeAllergies.count
        let list = severeAllergies.map { "\($0.substance) → \($0.reaction)" }.joined(separator: "; ")
        add(.critical, "Allergies",
            "\(n) Severe Active Allerg\(n > 1 ? "ies" : "y")",
            list,
            "Ensure allergy list is flagged in all prescribing systems. Verify no current medications are contraindicated.")
    } else if (p.allergies ?? []).isEmpty {
        add(.good, "Allergies", "No Known Allergies", "No allergies or intolerances documented for this patient.")
    }

    // ── SDOH ─────────────────────────────────────────────────────────────────
    if let housing = p.sdoh_housing_status, housing.lowercased().contains("unstable") {
        add(.warning, "Social Determinants",
            "Unstable Housing",
            "Patient housing status: \"\(housing)\". Unstable housing adversely impacts medication adherence and follow-up.",
            "Social work referral. Connect to local housing assistance programs.")
    }
    if let fin = p.sdoh_financial_strain, fin == "Severe" || fin == "Moderate" {
        add(.info, "Social Determinants",
            "Financial Strain — \(fin)",
            "Financial insecurity may impact medication adherence and access to care.",
            "Review medication cost burden. Explore patient assistance programs.")
    }
    if p.sdoh_transportation_insecurity == true {
        add(.info, "Social Determinants",
            "Transportation Insecurity",
            "Patient reports difficulty accessing transportation to appointments.",
            "Explore telehealth options and transportation assistance programs.")
    }

    // ── Care complexity ───────────────────────────────────────────────────────
    let activeProbs = (p.problems ?? []).filter { $0.status == "active" }
    if activeProbs.count >= 5 {
        add(.info, "Care Coordination",
            "High Complexity — \(activeProbs.count) Active Conditions",
            "Patient has \(activeProbs.count) active conditions requiring coordinated care across multiple specialties.",
            "Consider multidisciplinary care conference. Review for polypharmacy.")
    }

    let activeMeds = (p.medications ?? []).filter { $0.status == "active" }
    if activeMeds.count >= 7 {
        add(.warning, "Medications",
            "Polypharmacy — \(activeMeds.count) Active Medications",
            "Patients on 7+ medications have significantly elevated risk of adverse drug interactions and non-adherence.",
            "Medication reconciliation. Consider deprescribing review.")
    }

    return findings.sorted { $0.severity < $1.severity }
}

// MARK: - View

struct AIFindingsView: View {
    let patient: Patient
    @State private var expandedId: UUID?

    var body: some View {
        let findings = deriveClinicalFindings(for: patient)
        let criticalCount = findings.filter { $0.severity == .critical }.count
        let warningCount  = findings.filter { $0.severity == .warning  }.count

        CardView(title: "Clinical Insights", icon: "sparkles") {
            VStack(alignment: .leading, spacing: 0) {
                // Summary badges
                HStack(spacing: 8) {
                    if criticalCount > 0 { BadgeView(text: "\(criticalCount) Critical", color: .red) }
                    if warningCount  > 0 { BadgeView(text: "\(warningCount) Warning\(warningCount > 1 ? "s" : "")", color: .orange) }
                    if criticalCount == 0 && warningCount == 0 { BadgeView(text: "All Clear", color: .green) }
                    Text("\(findings.count) finding\(findings.count != 1 ? "s" : "")")
                        .font(.caption2).foregroundColor(.secondary)
                }
                .padding(.bottom, 12)

                if findings.isEmpty {
                    EmptyStateView(text: "No significant clinical findings. All reviewed parameters are within normal limits.")
                } else {
                    ForEach(findings) { f in
                        FindingRowView(finding: f, isExpanded: expandedId == f.id) {
                            withAnimation(.easeInOut(duration: 0.18)) {
                                expandedId = expandedId == f.id ? nil : f.id
                            }
                        }
                    }
                }

                Text("Insights use evidence-based clinical thresholds. Always apply professional judgment.")
                    .font(.caption2).foregroundColor(.secondary).padding(.top, 8)
            }
        }
    }
}

struct FindingRowView: View {
    let finding: ClinicalFinding
    let isExpanded: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onTap) {
                HStack(spacing: 10) {
                    ZStack {
                        Circle().fill(finding.severity.color).frame(width: 24, height: 24)
                        Image(systemName: finding.severity.sfSymbol)
                            .font(.system(size: 11, weight: .bold)).foregroundColor(.white)
                    }
                    VStack(alignment: .leading, spacing: 1) {
                        Text(finding.category).font(.caption2).foregroundColor(.secondary)
                        Text(finding.title)
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(.primary)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption2).foregroundColor(finding.severity.color)
                }
                .padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    Text(finding.detail)
                        .font(.subheadline).foregroundColor(.secondary)
                    if let action = finding.action {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Suggested Action")
                                .font(.caption.bold()).foregroundColor(finding.severity.color)
                            Text(action).font(.subheadline).foregroundColor(.primary)
                        }
                        .padding(10)
                        .background(finding.severity.color.opacity(0.06))
                        .cornerRadius(8)
                    }
                }
                .padding(.leading, 34).padding(.bottom, 10)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
            Divider()
        }
    }
}
