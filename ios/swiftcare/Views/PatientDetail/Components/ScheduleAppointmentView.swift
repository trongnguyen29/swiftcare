import SwiftUI

struct ScheduleAppointmentView: View {
    let patient: Patient
    @Environment(\.dismiss) var dismiss
    
    // Form State
    @State private var selectedDate = Date()
    @State private var selectedTime = "9:00 AM"
    @State private var visitType: AppointmentType = .newPatient
    @State private var duration = "30 min"
    @State private var provider = "Dr. Marcus Webb"
    @State private var reason = ""
    @State private var isSaving = false
    @State private var saveError: String?
    
    // Mock Options
    let times = ["8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM"]
    let durations = ["15 min", "30 min", "45 min", "60 min"]
    let providers = ["Dr. Marcus Webb", "Dr. Emily Chen", "Dr. Sarah Johnson"]
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "calendar.badge.plus")
                    .foregroundColor(Color(red: 0.1, green: 0.2, blue: 0.4))
                    .font(.title2)
                Text("Schedule Appointment")
                    .font(.title2)
                    .fontWeight(.bold)
                Spacer()
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark")
                        .foregroundColor(.secondary)
                        .font(.headline)
                }
            }
            .padding()
            
            Divider()
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    
                    // Patient Field (Read-only or Mock Dropdown)
                    FormField(label: "PATIENT") {
                        HStack {
                            Text(patient.displayName)
                            Spacer()
                            Image(systemName: "chevron.down").foregroundColor(.secondary)
                        }
                        .padding()
                        .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                    }
                    
                    // Date and Time Row
                    HStack(spacing: 16) {
                        FormField(label: "DATE") {
                            HStack {
                                DatePicker("", selection: $selectedDate, displayedComponents: .date)
                                    .labelsHidden()
                                    .colorMultiply(.primary) // Simplistic way to style it somewhat
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                        }
                        
                        FormField(label: "TIME") {
                            Menu {
                                ForEach(times, id: \.self) { time in
                                    Button(time) { selectedTime = time }
                                }
                            } label: {
                                HStack {
                                    Text(selectedTime).foregroundColor(.primary)
                                    Spacer()
                                    Image(systemName: "chevron.down").foregroundColor(.secondary)
                                }
                                .padding()
                                .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                            }
                        }
                    }
                    
                    // Visit Type and Duration Row
                    HStack(spacing: 16) {
                        FormField(label: "VISIT TYPE") {
                            Menu {
                                ForEach(AppointmentType.allCases, id: \.self) { type in
                                    Button(type.rawValue) { visitType = type }
                                }
                            } label: {
                                HStack {
                                    Text(visitType.rawValue).foregroundColor(.primary)
                                    Spacer()
                                    Image(systemName: "chevron.down").foregroundColor(.secondary)
                                }
                                .padding()
                                .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                            }
                        }
                        
                        FormField(label: "DURATION") {
                            Menu {
                                ForEach(durations, id: \.self) { dur in
                                    Button(dur) { duration = dur }
                                }
                            } label: {
                                HStack {
                                    Text(duration).foregroundColor(.primary)
                                    Spacer()
                                    Image(systemName: "chevron.down").foregroundColor(.secondary)
                                }
                                .padding()
                                .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                            }
                        }
                    }
                    
                    // Provider Field
                    FormField(label: "PROVIDER") {
                        Menu {
                            ForEach(providers, id: \.self) { prov in
                                Button(prov) { provider = prov }
                            }
                        } label: {
                            HStack {
                                Text(provider).foregroundColor(.primary)
                                Spacer()
                                Image(systemName: "chevron.down").foregroundColor(.secondary)
                            }
                            .padding()
                            .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                        }
                    }
                    
                    // Reason For Visit Field
                    FormField(label: "REASON FOR VISIT") {
                        Menu {
                            ForEach(AppointmentType.allCases, id: \.self) { type in
                                Button(type.rawValue) { reason = type.rawValue }
                            }
                        } label: {
                            HStack {
                                Text(reason.isEmpty ? "Select reason..." : reason)
                                    .foregroundColor(reason.isEmpty ? Color(UIColor.placeholderText) : .primary)
                                Spacer()
                                Image(systemName: "chevron.down").foregroundColor(.secondary)
                            }
                            .padding()
                            .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                        }
                    }
                }
                .padding()
            }
            
            // Bottom Action Buttons
            HStack(spacing: 12) {
                Spacer()
                Button(action: { dismiss() }) {
                    Text("Cancel")
                        .fontWeight(.semibold)
                        .foregroundColor(.primary)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(8)
                }
                
                Button(action: {
                    Task { await scheduleAppointment() }
                }) {
                    Group {
                        if isSaving {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Schedule Appointment")
                                .fontWeight(.semibold)
                        }
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Color(red: 0.1, green: 0.2, blue: 0.4))
                    .cornerRadius(8)
                }
                .disabled(isSaving)
            }
            .padding()
            .background(Color(UIColor.systemBackground))
        }
        .frame(width: 500, height: 600)
        .alert("Error", isPresented: Binding(get: { saveError != nil }, set: { if !$0 { saveError = nil } })) {
            Button("OK") { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }

    private func scheduleAppointment() async {
        isSaving = true
        defer { isSaving = false }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let appt = APIService.NewAppointment(
            ptnum: patient.ptnum,
            patient_name: patient.displayName,
            appointment_date: iso.string(from: combineDateAndTime()),
            duration_minutes: parseDuration(),
            appointment_type: visitType.rawValue,
            status: AppointmentStatus.scheduled.rawValue,
            reason: reason,
            doctor_name: provider,
            phone_number: patient.phone ?? "",
            is_reminder_sent: false
        )
        do {
            _ = try await APIService.shared.createAppointment(appt)
            dismiss()
        } catch {
            saveError = "Failed to schedule appointment. Please try again."
        }
    }

    private func combineDateAndTime() -> Date {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        guard let timeDate = formatter.date(from: selectedTime) else { return selectedDate }
        let cal = Calendar.current
        let t = cal.dateComponents([.hour, .minute], from: timeDate)
        return cal.date(bySettingHour: t.hour ?? 9, minute: t.minute ?? 0, second: 0, of: selectedDate) ?? selectedDate
    }

    private func parseDuration() -> Int {
        Int(duration.components(separatedBy: " ").first ?? "30") ?? 30
    }
}

// Reusable Form Field Wrapper
struct FormField<Content: View>: View {
    let label: String
    let content: Content
    
    init(label: String, @ViewBuilder content: () -> Content) {
        self.label = label
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.secondary)
            content
        }
    }
}

#Preview {
    // Mock preview patient
    ScheduleAppointmentView(patient: Patient.mock)
}
