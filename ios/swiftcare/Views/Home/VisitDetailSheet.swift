import SwiftUI

struct VisitDetailSheet: View {
    let visit: Visit
    let onAssign: () -> Void
    @Environment(\.dismiss) private var dismiss

    private let burgundy = Color(red: 0.52, green: 0.08, blue: 0.22)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // Meta
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(formattedDate)
                                .font(.subheadline.bold())
                            if let lang = visit.language {
                                Label(lang.uppercased(), systemImage: "globe")
                                    .font(.caption).foregroundColor(.secondary)
                            }
                        }
                        Spacer()
                        Button(action: { dismiss(); onAssign() }) {
                            Label("Assign to Patient", systemImage: "person.badge.plus")
                                .font(.subheadline.bold())
                                .padding(.horizontal, 14).padding(.vertical, 8)
                                .background(burgundy)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }
                        .buttonStyle(.plain)
                    }

                    Divider()

                    // Clinical note
                    if !visit.note.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Clinical Note", systemImage: "doc.text.fill")
                                .font(.headline).foregroundColor(burgundy)
                            Text(visit.note)
                                .font(.body)
                                .padding()
                                .background(Color(UIColor.secondarySystemGroupedBackground))
                                .cornerRadius(10)
                        }
                    }

                    // Transcript
                    if !visit.transcript.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Transcript", systemImage: "waveform")
                                .font(.headline).foregroundColor(burgundy)
                            Text(visit.transcript)
                                .font(.body)
                                .foregroundColor(.secondary)
                                .padding()
                                .background(Color(UIColor.secondarySystemGroupedBackground))
                                .cornerRadius(10)
                        }
                    }

                    if visit.note.isEmpty && visit.transcript.isEmpty {
                        ContentUnavailableView(
                            "No content yet",
                            systemImage: "doc.text",
                            description: Text("This visit has no note or transcript.")
                        )
                    }
                }
                .padding()
            }
            .navigationTitle("Visit Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
    }

    private var formattedDate: String {
        guard let date = ISO8601DateFormatter().date(from: visit.createdAt) else {
            return visit.createdAt
        }
        return date.formatted(.dateTime.month().day().year().hour().minute())
    }
}
