import SwiftUI

struct PatientBannerView: View {
    let patient: Patient
    let onAskAI: (() -> Void)?
    let onStartRecording: (() -> Void)?

    @ObservedObject private var contacts = PatientContactStore.shared
    @ObservedObject private var appointmentStore = AppointmentStore.shared
    @State private var editingPhone = false
    @State private var draftPhone = ""
    @State private var updatingStatus = false

    private var nextAppointment: Appointment? {
        appointmentStore.appointments
            .filter { $0.patientId == patient.ptnum && $0.status != .canceled }
            .filter { $0.date >= Calendar.current.startOfDay(for: Date()) }
            .sorted { $0.date < $1.date }
            .first
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Avatar
            Circle()
                .fill(Color.brandBlush)
                .frame(width: 56, height: 56)
                .overlay(
                    Text(initials)
                        .font(.title2.bold())
                        .foregroundColor(.brand)
                )
            
            // Info
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(patient.displayName)
                        .font(.title2.bold())
                    
                    if patient.label == 1 {
                        BadgeView(text: "⚠ LC Positive", color: .red)
                    }
                    if patient.tobacco_status == "former" {
                        BadgeView(text: "Former Smoker", color: .orange)
                    }
                    if patient.sdoh_veteran_status == true {
                        BadgeView(text: "Veteran", color: .brand)
                    }
                }
                
                Text(subline)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                HStack(spacing: 6) {
                    Image(systemName: "phone")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(phoneNumber ?? "Add phone number")
                        .font(.subheadline)
                        .foregroundColor(phoneNumber == nil ? .secondary : .primary)
                    Button {
                        draftPhone = phoneNumber ?? ""
                        editingPhone = true
                    } label: {
                        Image(systemName: "pencil")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Edit phone number")
                }
                
                if !demographics.isEmpty {
                    HStack(spacing: 12) {
                        ForEach(demographics, id: \.label) { d in
                            HStack(spacing: 4) {
                                Text(d.label)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text(d.val)
                                    .font(.caption.bold())
                            }
                        }
                    }
                }
            }
            
            Spacer()
            
            // Right Actions & Score
            VStack(alignment: .trailing, spacing: 12) {
                HStack(spacing: 12) {
                    if let onStartRecording = onStartRecording {
                        Button(action: onStartRecording) {
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(Color.red)
                                    .frame(width: 8, height: 8)
                                Text("Start Recording")
                            }
                            .font(.system(size: 13, weight: .semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.red.opacity(0.1))
                            .foregroundColor(.red)
                            .cornerRadius(8)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }

                    if let onAskAI = onAskAI {
                        Button(action: onAskAI) {
                            HStack(spacing: 6) {
                                Image(systemName: "sparkles")
                                Text("Ask AI")
                            }
                            .font(.system(size: 13, weight: .semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.brandBlush)
                            .foregroundColor(.brandRose)
                            .cornerRadius(8)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }

                if let appt = nextAppointment {
                    VStack(alignment: .trailing, spacing: 8) {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar").font(.caption2).foregroundColor(.secondary)
                            Text("Next: \(appt.date.formatted(.dateTime.month(.abbreviated).day().hour().minute()))")
                                .font(.caption).foregroundColor(.secondary)
                        }
                        if updatingStatus {
                            ProgressView().controlSize(.small)
                        } else {
                            HStack(spacing: 8) {
                                let isNoShow   = appt.status == .noShow
                                let isCheckedIn = appt.status == .completed
                                Button {
                                    guard !isNoShow else { return }
                                    Task {
                                        updatingStatus = true
                                        try? await appointmentStore.updateStatus(appointmentId: appt.id, status: .noShow)
                                        updatingStatus = false
                                    }
                                } label: {
                                    HStack(spacing: 5) {
                                        if isNoShow { Image(systemName: "checkmark").font(.caption2.weight(.bold)) }
                                        Text("No Show")
                                    }
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundColor(isNoShow ? .white : .red)
                                    .padding(.horizontal, 14).padding(.vertical, 8)
                                    .background(isNoShow ? Color.red : Color.red.opacity(0.08))
                                    .cornerRadius(8)
                                }
                                .buttonStyle(.plain)

                                Button {
                                    guard !isCheckedIn else { return }
                                    Task {
                                        updatingStatus = true
                                        try? await appointmentStore.updateStatus(appointmentId: appt.id, status: .completed)
                                        updatingStatus = false
                                    }
                                } label: {
                                    HStack(spacing: 5) {
                                        if isCheckedIn { Image(systemName: "checkmark").font(.caption2.weight(.bold)) }
                                        Text("Checked In")
                                    }
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundColor(isCheckedIn ? .white : .green)
                                    .padding(.horizontal, 14).padding(.vertical, 8)
                                    .background(isCheckedIn ? Color.green : Color.green.opacity(0.08))
                                    .cornerRadius(8)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                
                if let scc = patient.scc {
                    VStack(alignment: .trailing, spacing: 4) {
                        HStack(alignment: .firstTextBaseline) {
                            Text("SCC Score")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            Text(String(format: "%.1f", scc))
                                .font(.subheadline.bold())
                        }
                        
                        // Progress bar
                        GeometryReader { geometry in
                            let pct = min(1.0, max(0.0, scc / 172.0))
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(Color.gray.opacity(0.2))
                                Capsule()
                                    .fill(Color.brand)
                                    .frame(width: geometry.size.width * CGFloat(pct))
                            }
                        }
                        .frame(width: 100, height: 4)
                    }
                }
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
        .sheet(isPresented: $editingPhone) {
            NavigationStack {
                Form {
                    TextField("Phone number", text: $draftPhone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                }
                .navigationTitle("Phone Number")
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Cancel") { editingPhone = false }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Save") {
                            contacts.savePhone(draftPhone, forPtnum: patient.ptnum)
                            editingPhone = false
                        }
                    }
                }
            }
            .presentationDetents([.height(220)])
        }
    }
    
    var initials: String {
        let first = (patient.first_name ?? "").trimmingCharacters(in: .decimalDigits).trimmingCharacters(in: .whitespaces)
        let last = (patient.last_name ?? "").trimmingCharacters(in: .decimalDigits).trimmingCharacters(in: .whitespaces)
        let initFirst = first.first.map(String.init) ?? ""
        let initLast = last.first.map(String.init) ?? ""
        let combined = (initFirst + initLast).uppercased()
        
        if combined.isEmpty {
            return patient.ptnum.first.map { String($0).uppercased() } ?? "?"
        }
        return combined
    }
    
    var subline: String {
        var parts: [String] = []
        if let age = patient.age {
            parts.append("\(Int(age))y")
        }
        if let sex = patient.administrative_sex {
            parts.append(sex)
        }
        if let lang = patient.preferred_language {
            parts.append(lang)
        }
        return parts.isEmpty ? "—" : parts.joined(separator: " · ")
    }

    private var phoneNumber: String? {
        contacts.phone(forPtnum: patient.ptnum, fallback: patient.phone)
    }
    
    var demographics: [(label: String, val: String)] {
        var items: [(label: String, val: String)] = []
        if let race = patient.race { items.append(("Race", race)) }
        if let ethnicity = patient.ethnicity { items.append(("Ethnicity", ethnicity)) }
        if let marital = patient.marital {
            let val = marital == "m" ? "Married" : (marital == "s" ? "Single" : marital)
            items.append(("Marital", val))
        }
        if let state = patient.state { items.append(("State", state)) }
        return items
    }
}

struct BadgeView: View {
    let text: String
    let color: Color
    
    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.1))
            .foregroundColor(color)
            .cornerRadius(4)
    }
}
