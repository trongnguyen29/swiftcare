import SwiftUI

enum SortKey {
    case name
    case risk
}

enum PatientFilter: String, CaseIterable {
    case all      = "all"
    case positive = "positive"
    case control  = "control"

    var label: String {
        switch self {
        case .all:      return "All"
        case .positive: return "LC+"
        case .control:  return "Control"
        }
    }
}

struct PatientListView: View {
    @Binding var selectedPatient: Patient?
    
    @State private var patients: [Patient] = []
    @State private var query: String = ""
    @State private var sort: SortKey = .name
    @State private var filter: PatientFilter = .all
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil
    
    var visiblePatients: [Patient] {
        var list = patients
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !q.isEmpty {
            list = list.filter {
                $0.displayName.lowercased().contains(q) || $0.ptnum.lowercased().contains(q)
            }
        }
        
        if sort == .name {
            list.sort { $0.displayName < $1.displayName }
        } else {
            list.sort { ClinicalRanges.overallScore(for: $0) > ClinicalRanges.overallScore(for: $1) }
        }
        return list
    }
    
    @EnvironmentObject var auth: AuthService

    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 12) {
                Text("Hi, Dr. \(auth.practitionerName.components(separatedBy: " ").last ?? auth.practitionerName) 👋")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
                Text("Patients")
                    .font(.headline)
                    .padding(.horizontal)
                
                TextField("Search by name or ID…", text: $query)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .padding(.horizontal)
                
                // Filter (All / LC+ / Control)
                HStack {
                    Text("Filter")
                        .font(.caption).foregroundColor(.secondary)
                    Picker("Filter", selection: $filter) {
                        ForEach(PatientFilter.allCases, id: \.self) { f in
                            Text(f.label).tag(f)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                .padding(.horizontal)
                .onChange(of: filter) { _ in Task { await loadPatients() } }

                // Sort (Name / Risk)
                HStack {
                    Text("Sort")
                        .font(.caption).foregroundColor(.secondary)
                    Picker("Sort", selection: $sort) {
                        Text("Name").tag(SortKey.name)
                        Text("Risk").tag(SortKey.risk)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                .padding(.horizontal)
                .padding(.bottom, 8)
            }
            .padding(.top)
            .background(Color(UIColor.systemGroupedBackground))
            
            Divider()
            
            // List
            if isLoading {
                ProgressView("Loading…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage = errorMessage {
                Text("⚠ \(errorMessage)")
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if visiblePatients.isEmpty {
                Text("No patients found")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(visiblePatients, selection: $selectedPatient) { p in
                    PatientRow(patient: p, isSelected: selectedPatient?.id == p.id)
                        .tag(p)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(selectedPatient?.id == p.id ? Color.teal.opacity(0.1) : Color.clear)
                }
                .listStyle(PlainListStyle())
            }
        }
        .task {
            await loadPatients()
        }
    }
    
    func loadPatients() async {
        isLoading = true
        errorMessage = nil
        do {
            patients = try await APIService.shared.queryPatients(filter: filter.rawValue)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

struct PatientRow: View {
    let patient: Patient
    let isSelected: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(patient.displayName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(isSelected ? .teal : .primary)
                
                Spacer()
                
                if patient.label == 1 {
                    Text("LC+")
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(Color.red.opacity(0.1))
                        .foregroundColor(.red)
                        .cornerRadius(4)
                }
            }
            
            HStack(spacing: 4) {
                Text(patient.age != nil ? "\(Int(patient.age!))y" : "—")
                Text("·")
                Text(patient.administrative_sex ?? "—")
            }
            .font(.system(size: 12))
            .foregroundColor(.secondary)
            
            if let signal = ClinicalRanges.rowSignal(for: patient) {
                Text(signal.text)
                    .font(.system(size: 11))
                    .foregroundColor(signal.isCritical ? .red : .orange)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .contentShape(Rectangle())
    }
}
