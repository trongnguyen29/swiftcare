import SwiftUI

/// Sheet that lets the doctor search for a patient (by name) and link an
/// unassigned visit.
struct AssignPatientView: View {
    let visitId: String
    var onAssigned: ((Patient) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var query    = ""
    @State private var allPatients: [Patient] = []
    @State private var loading  = false
    @State private var error: String?

    private var filtered: [Patient] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return allPatients }
        return allPatients.filter { $0.displayName.lowercased().contains(q) }
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                HStack {
                    Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                    TextField("Search patients by name…", text: $query)
                        .textFieldStyle(.plain)
                        .autocorrectionDisabled()
                }
                .padding(10)
                .background(Color(UIColor.secondarySystemGroupedBackground))
                .cornerRadius(10)
                .padding()

                if loading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = error {
                    Text("⚠ \(err)").font(.caption).foregroundColor(.red)
                        .frame(maxWidth: .infinity, maxHeight: .infinity).padding()
                } else if filtered.isEmpty {
                    Text(query.isEmpty ? "No patients available." : "No patients found")
                        .font(.subheadline).foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(filtered) { patient in
                        Button(action: { Task { await assign(patient: patient) } }) {
                            HStack {
                                Text(patient.displayName).font(.headline).foregroundColor(.primary)
                                Spacer()
                                if patient.label == 1 {
                                    Text("LC+").font(.system(size: 9, weight: .bold))
                                        .padding(.horizontal, 5).padding(.vertical, 2)
                                        .background(Color.red.opacity(0.12)).foregroundColor(.red).clipShape(Capsule())
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Assign to Patient")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        loading = true; error = nil
        do {
            allPatients = try await APIService.shared.queryPatients(filter: "all")
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func assign(patient: Patient) async {
        do {
            _ = try await VisitsService.shared.assignVisit(id: visitId, patientPtnum: patient.ptnum)
            onAssigned?(patient)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
