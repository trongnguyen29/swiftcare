import SwiftUI

// MARK: - Gauge bar (mirrors GaugeBar in PatientCharts.tsx)

struct GaugeBarView: View {
    let field: String
    let value: Double

    var body: some View {
        if let r = ClinicalRanges.ranges[field], let n = ClinicalRanges.normal[field] {
            let color  = ClinicalRanges.statusColor(for: ClinicalRanges.status(for: field, value: value))
            let span   = r.hi - r.lo
            let pct    = CGFloat(min(1, max(0, (value - r.lo) / span)))
            let nLoPct = CGFloat(max(0, (n.lo - r.lo) / span))
            let nHiPct = CGFloat(min(1, (n.hi - r.lo) / span))

            HStack(spacing: 8) {
                Text(r.label)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                    .frame(width: 108, alignment: .leading)

                GeometryReader { geo in
                    let w = geo.size.width
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.gray.opacity(0.12)).frame(height: 5)
                        Capsule().fill(Color.green.opacity(0.2))
                            .frame(width: max(0, w * (nHiPct - nLoPct)), height: 5)
                            .offset(x: w * nLoPct)
                        Capsule().fill(color)
                            .frame(width: max(0, w * pct), height: 5)
                    }
                }
                .frame(height: 5)

                Text("\(String(format: "%g", value))\(r.unit.isEmpty ? "" : " \(r.unit)")")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(color)
                    .frame(width: 62, alignment: .trailing)
            }
            .frame(height: 24)
        }
    }
}

// MARK: - Lipid mini-bar chart (mirrors MiniBarChart in PatientCharts.tsx)

struct LipidBarItem {
    let label: String
    let value: Double
    let normalHi: Double
    let key: String
}

struct LipidMiniBarChart: View {
    let items: [LipidBarItem]
    private let barH: CGFloat = 80

    var body: some View {
        let maxVal = (items.map(\.value).max() ?? 1) * 1.2

        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(items, id: \.label) { item in
                    let color   = ClinicalRanges.statusColor(for: ClinicalRanges.status(for: item.key, value: item.value))
                    let pct     = CGFloat(min(1.0, item.value / maxVal))
                    let refPct  = CGFloat(min(1.0, item.normalHi / maxVal))

                    VStack(spacing: 4) {
                        ZStack(alignment: .bottom) {
                            RoundedRectangle(cornerRadius: 4).fill(Color.gray.opacity(0.08)).frame(height: barH)
                            RoundedRectangle(cornerRadius: 3).fill(color.opacity(0.85)).frame(height: barH * pct)
                        }
                        .overlay(alignment: .bottom) {
                            // Normal-limit reference line
                            Rectangle()
                                .fill(Color.gray.opacity(0.4)).frame(height: 1)
                                .frame(maxWidth: .infinity)
                                .padding(.bottom, barH * refPct)
                        }
                        .frame(height: barH)

                        Text(item.label).font(.system(size: 10)).foregroundColor(.secondary)
                        Text(String(format: "%g", item.value)).font(.system(size: 10, weight: .bold)).foregroundColor(color)
                    }
                    .frame(maxWidth: .infinity)
                }
            }

            HStack(spacing: 4) {
                Rectangle().fill(Color.gray.opacity(0.4)).frame(width: 12, height: 1)
                Text("Normal limit").font(.caption2).foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - PatientChartView (mirrors PatientCharts.tsx)

struct PatientChartView: View {
    let patient: Patient

    private let vitalFields = ["systolic_bp", "diastolic_bp", "heart_rate", "bmi"]
    private let labFields   = ["hba1c", "glucose", "total_cholesterol", "ldl", "hdl", "triglycerides"]

    private var lipidItems: [LipidBarItem] {
        [("T.Chol", patient.total_cholesterol, 200.0, "total_cholesterol"),
         ("LDL",    patient.ldl,              130.0, "ldl"),
         ("HDL",    patient.hdl,               60.0, "hdl"),
         ("Trig.",  patient.triglycerides,    150.0, "triglycerides")]
            .compactMap { lab in
                guard let v = lab.1 else { return nil as LipidBarItem? }
                return LipidBarItem(label: lab.0, value: v, normalHi: lab.2, key: lab.3)
            }
    }

    var body: some View {
        VStack(spacing: 16) {
            // Two-column: vitals gauges + lipid bar chart
            HStack(alignment: .top, spacing: 16) {
                CardView(title: "Vitals vs. Reference") {
                    VStack(spacing: 10) {
                        let vals = vitalFields.compactMap { ClinicalRanges.value(for: $0, in: patient) }
                        if vals.isEmpty {
                            EmptyStateView(text: "No vitals recorded")
                        } else {
                            ForEach(vitalFields, id: \.self) { field in
                                if let v = ClinicalRanges.value(for: field, in: patient) {
                                    GaugeBarView(field: field, value: v)
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity)

                CardView(title: "Lipid Panel") {
                    if lipidItems.isEmpty {
                        EmptyStateView(text: "No lipid data recorded")
                    } else {
                        LipidMiniBarChart(items: lipidItems)
                    }
                }
                .frame(maxWidth: .infinity)
            }

            // Full-width metabolic labs gauge grid
            CardView(title: "Metabolic Labs vs. Reference") {
                let vals = labFields.compactMap { ClinicalRanges.value(for: $0, in: patient) }
                if vals.isEmpty {
                    EmptyStateView(text: "No lab data recorded")
                } else {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        ForEach(labFields, id: \.self) { field in
                            if let v = ClinicalRanges.value(for: field, in: patient) {
                                GaugeBarView(field: field, value: v)
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - PatientChartDetailView (mirrors the chart section of PatientSummary.tsx)

struct PatientChartDetailView: View {
    let patient: Patient

    // Helpers
    private func byDateDesc<T>(_ items: [T], date: (T) -> String?) -> [T] {
        items.sorted { (date($1) ?? "") > (date($0) ?? "") }
    }

    private func statusBadgeColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "active":   return .teal
        case "resolved": return .secondary
        case "inactive": return .orange
        default:         return .secondary
        }
    }

    var body: some View {
        VStack(spacing: 16) {
            // Row 1: Problems · Medications · Allergies
            HStack(alignment: .top, spacing: 16) {
                problemsCard.frame(maxWidth: .infinity)
                medicationsCard.frame(maxWidth: .infinity)
                allergiesDetailCard.frame(maxWidth: .infinity)
            }

            // Row 2: SDOH · Insurance · Care Team
            HStack(alignment: .top, spacing: 16) {
                sdohCard.frame(maxWidth: .infinity)
                insuranceCard.frame(maxWidth: .infinity)
                careTeamCard.frame(maxWidth: .infinity)
            }

            // Row 3: Goals · Assessment & Plan
            HStack(alignment: .top, spacing: 16) {
                goalsCard.frame(maxWidth: .infinity)
                if let plan = patient.assessment_plan, !plan.isEmpty {
                    assessmentCard(plan: plan).frame(maxWidth: .infinity)
                }
            }
        }
    }

    // MARK: Problems
    var problemsCard: some View {
        CardView(title: "Problems / Conditions") {
            let all = byDateDesc(patient.problems ?? [], date: \.onset_date)
            if all.isEmpty {
                EmptyStateView(text: "No conditions recorded")
            } else {
                ExpandableList(items: all, maxItems: 5) { prob in
                    HStack {
                        Text(prob.display).font(.subheadline.weight(.medium))
                        Spacer()
                        Text(prob.status.capitalized)
                            .font(.system(size: 10, weight: .bold))
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(statusBadgeColor(prob.status).opacity(0.12))
                            .foregroundColor(statusBadgeColor(prob.status))
                            .cornerRadius(4)
                    }
                    Text("\(prob.icd10_code)\(prob.onset_date != nil ? " · \(prob.onset_date!)" : "")")
                        .font(.caption).foregroundColor(.secondary)
                        .padding(.bottom, 4)
                    Divider()
                }
            }
        }
    }

    // MARK: Medications
    var medicationsCard: some View {
        CardView(title: "Medications") {
            let all = byDateDesc(patient.medications ?? [], date: \.start_date)
            if all.isEmpty {
                EmptyStateView(text: "No medications recorded")
            } else {
                ExpandableList(items: all, maxItems: 5) { med in
                    HStack {
                        Text("\(med.name) \(med.dose)").font(.subheadline.weight(.medium))
                        Spacer()
                        Text(med.status.capitalized)
                            .font(.system(size: 10, weight: .bold))
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(statusBadgeColor(med.status).opacity(0.12))
                            .foregroundColor(statusBadgeColor(med.status))
                            .cornerRadius(4)
                    }
                    Text("\(med.route) · \(med.frequency)")
                        .font(.caption).foregroundColor(.secondary)
                        .padding(.bottom, 4)
                    Divider()
                }
            }
        }
    }

    // MARK: Allergies detail
    var allergiesDetailCard: some View {
        CardView(title: "Allergies & Intolerances") {
            let all = byDateDesc(patient.allergies ?? [], date: \.onset_date)
            if all.isEmpty {
                Text("✓ No known allergies").font(.subheadline).foregroundColor(.green)
            } else {
                ForEach(all, id: \.id) { a in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(a.substance).font(.subheadline.weight(.medium))
                            Spacer()
                            Text(a.severity.capitalized)
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(a.severity == "severe" ? .red : (a.severity == "moderate" ? .orange : .secondary))
                        }
                        Text("Reaction: \(a.reaction) · Type: \(a.type)").font(.caption).foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                    Divider()
                }
            }
        }
    }

    // MARK: SDOH
    var sdohCard: some View {
        CardView(title: "Social Determinants") {
            let rows: [(String, String?)] = [
                ("Education",        patient.sdoh_education_level),
                ("Financial Strain", patient.sdoh_financial_strain),
                ("Housing",          patient.sdoh_housing_status),
                ("Transport",        patient.sdoh_transportation_insecurity == true ? "Insecure" : nil),
                ("Social Isolation", patient.sdoh_social_isolation),
                ("Veteran Status",   patient.sdoh_veteran_status == true ? "Yes" : nil),
            ]
            let valid = rows.filter { $0.1 != nil }
            if valid.isEmpty {
                EmptyStateView(text: "No SDOH data recorded")
            } else {
                VStack(spacing: 6) {
                    ForEach(valid, id: \.0) { row in
                        HStack {
                            Text(row.0).font(.caption).foregroundColor(.secondary)
                            Spacer()
                            Text(row.1 ?? "").font(.caption.bold())
                        }
                    }
                }
            }
        }
    }

    // MARK: Insurance
    var insuranceCard: some View {
        CardView(title: "Insurance") {
            if let ins = patient.insurance {
                VStack(spacing: 6) {
                    ForEach([
                        ("Status",       ins.coverage_status),
                        ("Type",         ins.coverage_type),
                        ("Payer",        ins.payer),
                        ("Member ID",    ins.member_id),
                        ("Group ID",     ins.group_id ?? "—"),
                        ("Relationship", ins.relationship_to_subscriber),
                    ], id: \.0) { row in
                        HStack {
                            Text(row.0).font(.caption).foregroundColor(.secondary)
                            Spacer()
                            Text(row.1).font(.caption.bold()).multilineTextAlignment(.trailing)
                        }
                    }
                }
            } else {
                EmptyStateView(text: "No insurance recorded")
            }
        }
    }

    // MARK: Care Team
    var careTeamCard: some View {
        CardView(title: "Care Team") {
            let team = patient.care_team ?? []
            if team.isEmpty {
                EmptyStateView(text: "No care team recorded")
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(team, id: \.name) { member in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(member.name).font(.subheadline.bold())
                                Spacer()
                                Text(member.role)
                                    .font(.system(size: 10, weight: .bold))
                                    .padding(.horizontal, 5).padding(.vertical, 1)
                                    .background(Color.teal.opacity(0.12))
                                    .foregroundColor(.teal).cornerRadius(4)
                            }
                            if let phone = member.phone {
                                Text(phone).font(.caption).foregroundColor(.secondary)
                            }
                            if let org = member.organization {
                                Text(org).font(.caption).foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: Goals
    var goalsCard: some View {
        CardView(title: "Patient Goals") {
            let goals = patient.goals ?? []
            if goals.isEmpty {
                EmptyStateView(text: "No goals documented")
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(goals, id: \.self) { goal in
                        HStack(alignment: .top, spacing: 6) {
                            Text("→").font(.caption).foregroundColor(.teal).padding(.top, 1)
                            Text(goal).font(.subheadline)
                        }
                    }
                }
            }
        }
    }

    // MARK: Assessment & Plan
    func assessmentCard(plan: String) -> some View {
        CardView(title: "Assessment & Plan") {
            Text(plan)
                .font(.subheadline)
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

// MARK: - Generic expandable list helper

struct ExpandableList<T: Identifiable, Content: View>: View {
    let items: [T]
    let maxItems: Int
    @ViewBuilder let rowContent: (T) -> Content

    @State private var expanded = false

    var body: some View {
        let shown = expanded ? items : Array(items.prefix(maxItems))
        VStack(alignment: .leading, spacing: 0) {
            ForEach(shown) { item in rowContent(item) }
            if items.count > maxItems {
                Button(expanded ? "Show less" : "Show all \(items.count)") {
                    withAnimation { expanded.toggle() }
                }
                .font(.caption)
                .foregroundColor(.teal)
                .padding(.top, 4)
            }
        }
    }
}
