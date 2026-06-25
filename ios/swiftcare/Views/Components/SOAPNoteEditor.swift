import SwiftUI

/// Renders / edits a structured SOAP note as a stack of section cards.
/// Section and subsection headers are fixed labels (never part of the editable
/// text), so they can't be deleted. Vitals are structured (HR + BP + extras).
struct SOAPNoteEditor: View {
    @Binding var note: SOAPNote
    let editing: Bool

    var body: some View {
        VStack(spacing: 14) {
            card("Subjective", icon: "person.text.rectangle", accent: .brand) {
                field("Chief Complaint", \.chiefComplaint, minHeight: 50)
                field("History of Present Illness", \.hpi, minHeight: 90)
                field("Review of Systems", \.ros, minHeight: 70)
                field("Additional Notes", \.subjectiveAdditional, minHeight: 60)
            }
            card("Objective", icon: "stethoscope", accent: .indigo) {
                vitalsBlock
                field("Physical Exam", \.physicalExam, minHeight: 80)
                field("Lab Results", \.labResults, minHeight: 60)
                field("Additional Notes", \.objectiveAdditional, minHeight: 60)
            }
            card("Assessment", icon: "list.clipboard", accent: .orange) {
                field(nil, \.assessment, minHeight: 100)
            }
            card("Plan", icon: "checklist", accent: .green) {
                field(nil, \.plan, minHeight: 100)
            }
        }
    }

    // MARK: - Section card

    @ViewBuilder
    private func card<Content: View>(_ title: String, icon: String, accent: Color,
                                     @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Image(systemName: icon).font(.system(size: 13, weight: .semibold)).foregroundColor(accent)
                Text(title).font(.headline).foregroundColor(accent)
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - Vitals

    private let vitalColumns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    private var vitalsBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Vitals").font(.subheadline.weight(.semibold)).foregroundColor(.primary)
            LazyVGrid(columns: vitalColumns, spacing: 10) {
                vitalTile("Heart Rate", placeholder: "72 bpm", \.heartRate)
                vitalTile("Blood Pressure", placeholder: "120/80", \.bloodPressure)
                vitalTile("SpO₂", placeholder: "98%", \.spo2)
                vitalTile("Temperature", placeholder: "98.6°F", \.temperature)
                vitalTile("Weight", placeholder: "70 kg", \.weight)
                vitalTile("Height", placeholder: "175 cm", \.height)
            }
        }
    }

    private func vitalTile(_ label: String, placeholder: String,
                           _ keyPath: WritableKeyPath<SOAPNote, String>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2).foregroundColor(.secondary)
            if editing {
                TextField(placeholder, text: binding(keyPath))
                    .font(.body.weight(.semibold))
                    .textFieldStyle(.plain)
            } else {
                let v = note[keyPath: keyPath].trimmingCharacters(in: .whitespacesAndNewlines)
                Text(v.isEmpty ? "—" : v)
                    .font(.body.weight(.semibold))
                    .foregroundColor(v.isEmpty ? .secondary : .primary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color(UIColor.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Generic field

    @ViewBuilder
    private func field(_ title: String?, _ keyPath: WritableKeyPath<SOAPNote, String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            if let title {
                Text(title).font(.subheadline.weight(.semibold)).foregroundColor(.primary)
            }
            if editing {
                TextEditor(text: binding(keyPath))
                    .font(.body).frame(minHeight: minHeight).padding(6)
                    .background(Color(UIColor.systemBackground)).cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.25), lineWidth: 1))
            } else {
                let value = note[keyPath: keyPath].trimmingCharacters(in: .whitespacesAndNewlines)
                Text(value.isEmpty ? "—" : value)
                    .font(.body)
                    .foregroundColor(value.isEmpty ? .secondary : .primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
        }
    }

    private func binding(_ keyPath: WritableKeyPath<SOAPNote, String>) -> Binding<String> {
        Binding(get: { note[keyPath: keyPath] }, set: { note[keyPath: keyPath] = $0 })
    }
}
