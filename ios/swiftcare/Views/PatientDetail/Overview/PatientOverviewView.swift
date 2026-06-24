import SwiftUI

struct PatientOverviewView: View {
    let patient: Patient
    
    @State private var aiOverview: String?
    @State private var aiLoading = false
    @State private var aiError: String?
    
    // Extracted vitals/labs data matching desktop
    var vitals: [(label: String, val: Double?, unit: String, key: String)] {
        [
            ("Systolic BP", patient.systolic_bp, "mmHg", "systolic_bp"),
            ("Diastolic BP", patient.diastolic_bp, "mmHg", "diastolic_bp"),
            ("Heart Rate", patient.heart_rate, "bpm", "heart_rate"),
            ("Resp. Rate", patient.respiratory_rate, "/min", "respiratory_rate"),
            ("SpO₂", patient.oxygen_saturation, "%", "oxygen_saturation"),
            ("Temp.", patient.temperature_c, "°C", "temperature_c"),
            ("BMI", patient.bmi, "", "bmi"),
            ("Pain Score", patient.pain_score, "/ 10", "pain_score")
        ].filter { $0.val != nil }
    }
    
    var labs: [(label: String, val: Double?, unit: String, key: String)] {
        [
            ("Total Cholesterol", patient.total_cholesterol, "mg/dL", "total_cholesterol"),
            ("LDL", patient.ldl, "mg/dL", "ldl"),
            ("HDL", patient.hdl, "mg/dL", "hdl"),
            ("Triglycerides", patient.triglycerides, "mg/dL", "triglycerides"),
            ("HbA1c", patient.hba1c, "%", "hba1c"),
            ("Glucose", patient.glucose, "mg/dL", "glucose"),
            ("Creatinine", patient.creatinine, "mg/dL", "creatinine"),
            ("eGFR", patient.egfr, "mL/min", "egfr"),
            ("Hemoglobin", patient.hemoglobin, "g/dL", "hemoglobin")
        ].filter { $0.val != nil }
    }
    
    var flags: [(label: String, val: Double, unit: String, key: String, status: VitalStatus)] {
        var items: [(label: String, val: Double, unit: String, key: String, status: VitalStatus)] = []
        let flagFields = ["systolic_bp", "diastolic_bp", "heart_rate", "oxygen_saturation", "bmi", "total_cholesterol", "ldl", "hdl", "triglycerides", "hba1c", "glucose", "egfr"]
        
        for key in flagFields {
            if let val = ClinicalRanges.value(for: key, in: patient) {
                let status = ClinicalRanges.status(for: key, value: val)
                if status == .borderline || status == .critical {
                    let label = ClinicalRanges.ranges[key]?.label ?? key
                    let unit = ClinicalRanges.ranges[key]?.unit ?? ""
                    items.append((label, val, unit, key, status))
                }
            }
        }
        
        items.sort {
            let rank1 = $0.status == .critical ? 2 : 1
            let rank2 = $1.status == .critical ? 2 : 1
            return rank1 > rank2
        }
        return items
    }
    
    let columns = [
        GridItem(.adaptive(minimum: 300, maximum: 600), spacing: 16)
    ]
    
    var body: some View {
        VStack(spacing: 16) {
            // Attention Bar
            attentionBar
            
            // AI Brief
            aiBriefCard
            
            // Grid of cards
            LazyVGrid(columns: columns, spacing: 16) {
                riskCard
                AIFindingsView(patient: patient)
                activeProblemsCard
                vitalsCard
                labsCard
                allergiesCard
            }
        }
        .task(id: patient.id) {
            await loadOrGenerateOverview()
        }
    }
    
    // MARK: - Components
    
    var attentionBar: some View {
        let hasCritical = flags.contains { $0.status == .critical }
        let hasWarn = !flags.isEmpty
        let bgColor = hasCritical ? Color.red.opacity(0.1) : (hasWarn ? Color.orange.opacity(0.1) : Color.green.opacity(0.1))
        let fgColor = hasCritical ? Color.red : (hasWarn ? Color.orange : Color.green)
        let icon = hasWarn ? "exclamationmark.triangle.fill" : "checkmark.circle.fill"
        
        let measuredCount = vitals.count + labs.count
        var title = ""
        if hasWarn {
            title = "\(flags.count) value\(flags.count > 1 ? "s" : "") need\(flags.count > 1 ? "" : "s") attention"
        } else if measuredCount > 0 {
            title = "All measured values within range"
        } else {
            title = "No vitals or labs recorded"
        }
        
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(fgColor)
                Text(title)
                    .font(.headline)
                    .foregroundColor(fgColor)
            }
            
            if hasWarn {
                HStack(spacing: 16) {
                    ForEach(flags, id: \.key) { f in
                        HStack(spacing: 4) {
                            Text(f.label)
                                .font(.caption)
                            Text("\(String(format: "%g", f.val))\(f.unit.isEmpty ? "" : " \(f.unit)")")
                                .font(.caption.bold())
                        }
                        .foregroundColor(ClinicalRanges.statusColor(for: f.status))
                    }
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(bgColor)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(fgColor.opacity(0.3), lineWidth: 1)
        )
    }
    
    var aiBriefCard: some View {
        CardView(title: "Patient Overview", icon: "sparkles") {
            if aiLoading {
                ProgressView("Generating…")
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else if let error = aiError {
                Text("⚠ \(error)")
                    .font(.subheadline)
                    .foregroundColor(.red)
            } else if let overview = aiOverview {
                VStack(alignment: .leading, spacing: 12) {
                    Text(overview)
                        .font(.body)
                        .lineSpacing(4)
                    
                    Text("AI-generated clinical summary — for decision support only. Always apply professional judgment.")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .padding(.top, 4)
                }
            } else {
                Text("Preparing clinical summary…")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            }
        }
    }
    
    var riskCard: some View {
        CardView(title: "Risk Overview") {
            VStack(spacing: 16) {
                RiskRingsView(patient: patient)
                
                HStack(spacing: 16) {
                    LegendItem(color: .green, label: "Low (0-29)")
                    LegendItem(color: .orange, label: "Moderate (30-59)")
                    LegendItem(color: .red, label: "High (60+)")
                }
                .font(.caption2)
                
                Text("Scores derived from current vitals & labs")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
        }
    }
    
    var activeProblemsCard: some View {
        CardView(title: "Active Problems") {
            let activeProbs = (patient.problems ?? []).filter { $0.status == "active" }
            if activeProbs.isEmpty {
                EmptyStateView(text: "No active problems recorded")
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(activeProbs.prefix(5), id: \.self) { prob in
                        HStack(alignment: .top) {
                            Circle().fill(Color.orange).frame(width: 6, height: 6).padding(.top, 6)
                            Text(prob.display)
                                .font(.subheadline)
                        }
                    }
                    if activeProbs.count > 5 {
                        Text("...and \(activeProbs.count - 5) more")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }
    
    var vitalsCard: some View {
        CardView(title: "Vital Signs") {
            if vitals.isEmpty {
                EmptyStateView(text: "Not recorded")
            } else {
                VStack(spacing: 8) {
                    ForEach(vitals, id: \.key) { v in
                        ValueRow(label: v.label, val: v.val, unit: v.unit, key: v.key)
                    }
                }
            }
        }
    }
    
    var labsCard: some View {
        CardView(title: "Labs") {
            if labs.isEmpty {
                EmptyStateView(text: "Not recorded")
            } else {
                VStack(spacing: 8) {
                    ForEach(labs, id: \.key) { l in
                        ValueRow(label: l.label, val: l.val, unit: l.unit, key: l.key)
                    }
                }
            }
        }
    }
    
    var allergiesCard: some View {
        CardView(title: "Allergies") {
            let allgs = patient.allergies ?? []
            if allgs.isEmpty {
                Text("✓ No known allergies")
                    .font(.subheadline)
                    .foregroundColor(.green)
            } else {
                VStack(spacing: 8) {
                    ForEach(allgs, id: \.self) { a in
                        HStack {
                            Text(a.substance)
                                .font(.subheadline.bold())
                            Spacer()
                            Text(a.severity.capitalized)
                                .font(.caption.bold())
                                .foregroundColor(a.severity == "severe" ? .red : (a.severity == "moderate" ? .orange : .secondary))
                        }
                    }
                }
            }
        }
    }
    
    func loadOrGenerateOverview() async {
        let fp = PatientContext.fingerprint(for: PatientContext.build(for: patient))
        aiLoading = true
        aiError = nil
        
        do {
            if let stored = try await APIService.shared.getPatientSummary(patientId: patient.ptnum), stored.ai_summary_hash == fp {
                aiOverview = stored.ai_summary
                aiLoading = false
                return
            }
            
            // Generate
            let context = PatientContext.build(for: patient)
            let prompt = """
            Write a clinical handoff brief for a physician seeing this patient for the first time today. They have 60 seconds to read it before entering the room.

            Write exactly 3 sentences in this order:
            1. THE MOST URGENT CONCERN: The single most critical clinical fact right now. If LC+, lead with diagnosis status and SCC score. If not LC+, lead with the most dangerous risk factor or abnormal value.
            2. CLINICAL CONTEXT: The 2–3 most important comorbidities, active conditions, or risk factors shaping clinical decisions — include specific values (e.g., "HbA1c 7.4%", "BMI 34", "SBP 148 mmHg").
            3. PRIORITY ACTION: One specific, actionable instruction — what the clinician must do or verify in this visit.

            STRICT RULES:
            - Use actual numbers from the record — do not be vague
            - Physician-level clinical language — not patient-facing
            - No hedging ("it appears", "may be") — be direct and assertive
            - No headers, no bullets — three sentences of flowing prose only
            - Under 90 words total
            """
            
            let reply = try await APIService.shared.chatWithPatientContext(messages: [["role": "user", "content": prompt]], patientContext: context)
            aiOverview = reply
            
            // Save fire and forget
            Task {
                try? await APIService.shared.savePatientSummary(patientId: patient.ptnum, summary: reply, hash: fp)
            }
        } catch {
            aiError = error.localizedDescription
        }
        aiLoading = false
    }
}

// MARK: - Helpers

struct CardView<Content: View>: View {
    let title: String
    var icon: String? = nil
    @ViewBuilder let content: () -> Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                if let icon = icon {
                    Image(systemName: icon)
                        .foregroundColor(.brandRose)
                        .font(.caption)
                        .padding(4)
                        .background(Color.brandBlush)
                        .cornerRadius(4)
                }
                Text(title)
                    .font(.headline)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemGroupedBackground))
            
            Divider()
            
            VStack(alignment: .leading) {
                content()
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemGroupedBackground))
        }
        .cornerRadius(12)
        .shadow(color: Color.black.opacity(0.05), radius: 5, x: 0, y: 2)
    }
}

struct EmptyStateView: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.subheadline)
            .foregroundColor(.secondary)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding()
    }
}

struct ValueRow: View {
    let label: String
    let val: Double?
    let unit: String
    let key: String
    
    var body: some View {
        let status = ClinicalRanges.status(for: key, value: val)
        let isAbnormal = status == .borderline || status == .critical
        let refText = ClinicalRanges.refText[key] ?? ""
        
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            Spacer()
            
            if let v = val {
                HStack(spacing: 4) {
                    Text("\(String(format: "%g", v))\(unit.isEmpty ? "" : " \(unit)")")
                        .font(.subheadline.bold())
                        .foregroundColor(ClinicalRanges.statusColor(for: status))
                    
                    if isAbnormal && !refText.isEmpty {
                        Text(refText)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .padding(.leading, 4)
                    }
                }
            } else {
                Text("Not recorded")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct LegendItem: View {
    let color: Color
    let label: String
    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label).foregroundColor(.secondary)
        }
    }
}
