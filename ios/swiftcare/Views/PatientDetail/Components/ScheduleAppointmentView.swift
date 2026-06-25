import SwiftUI

struct ScheduleAppointmentView: View {
    @Environment(\.dismiss) private var dismiss

    let onScheduled: ((Appointment) -> Void)?

    @ObservedObject private var contacts = PatientContactStore.shared
    @State private var selectedPatient: Patient?
    @State private var patientQuery = ""
    @State private var patientResults: [Patient] = []
    @State private var loadingPatients = false
    @State private var patientSearchError: String?
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var selectedDate: Date
    @State private var selectedTime: Date
    @State private var visitType: AppointmentType = .newPatient
    @State private var duration = "30 min"
    @State private var reason = ""
    @State private var showDismissConfirm = false

    private let providerName = "Dr. Marcus Webb"
    private let durations = ["15 min", "30 min", "45 min", "60 min"]

    init(
        initialPatient: Patient? = nil,
        initialDate: Date = Date(),
        onScheduled: ((Appointment) -> Void)? = nil
    ) {
        _selectedPatient = State(initialValue: initialPatient)
        _selectedDate = State(initialValue: initialDate)
        let cal = Calendar.current
        let nineAM = cal.date(bySettingHour: 9, minute: 0, second: 0, of: initialDate) ?? initialDate
        _selectedTime = State(initialValue: nineAM)
        self.onScheduled = onScheduled
    }

    private var isDirty: Bool {
        selectedPatient != nil || !reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canSchedule: Bool { selectedPatient != nil }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "calendar.badge.plus")
                    .foregroundColor(Color.brand)
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
            
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    patientField

                    HStack(alignment: .top, spacing: 16) {
                        FormField(label: "DATE") {
                            DatePicker("Date", selection: $selectedDate, displayedComponents: .date)
                                .labelsHidden()
                                .datePickerStyle(.compact)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                        }

                        FormField(label: "TIME") {
                            DatePicker("Time", selection: $selectedTime, displayedComponents: .hourAndMinute)
                                .labelsHidden()
                                .datePickerStyle(.compact)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                        }
                    }

                    HStack(alignment: .top, spacing: 16) {
                        FormField(label: "VISIT TYPE") {
                            Picker("Visit type", selection: $visitType) {
                                ForEach(AppointmentType.allCases, id: \.self) { type in
                                    Label(type.rawValue, systemImage: type.icon).tag(type)
                                }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                        }

                        FormField(label: "DURATION") {
                            Picker("Duration", selection: $duration) {
                                ForEach(durations, id: \.self) { d in Text(d).tag(d) }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                        }
                    }

                    FormField(label: "PROVIDER") {
                        Text(providerName)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                            .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                    }

                    FormField(label: "REASON FOR VISIT") {
                        TextField("e.g. Follow-up, Annual Wellness, Lab Review", text: $reason, axis: .vertical)
                            .lineLimit(2...4)
                            .padding()
                            .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                    }
                }
                .padding()
                .frame(maxWidth: 600, alignment: .leading)
            }
            .navigationTitle("Schedule Appointment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        if isDirty { showDismissConfirm = true } else { dismiss() }
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Color.brand)
                    .cornerRadius(8)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await scheduleAppointment() }
                    } label: {
                        if isSaving { ProgressView() } else { Text("Schedule") }
                    }
                    .disabled(!canSchedule || isSaving)
                }
            }
        }
        // Prevent accidental swipe-down / tap-outside dismiss when form has data.
        .interactiveDismissDisabled(isDirty)
        .confirmationDialog("Discard this appointment?", isPresented: $showDismissConfirm, titleVisibility: .visible) {
            Button("Discard", role: .destructive) { dismiss() }
            Button("Keep Editing", role: .cancel) { }
        }
        .alert("Appointment Not Saved", isPresented: Binding(
            get: { saveError != nil },
            set: { if !$0 { saveError = nil } }
        )) {
            Button("OK", role: .cancel) { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }

    private func scheduleAppointment() async {
        isSaving = true
        defer { isSaving = false }

        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let start = combineDateAndTime()
        let end = start.addingTimeInterval(TimeInterval(parseDuration() * 60))

        let resource: [String: Any] = [
            "resourceType": "Appointment",
            "status": "booked",
            "serviceType": [["coding": [["display": visitType.rawValue]]]],
            "start": iso.string(from: start),
            "end": iso.string(from: end),
            "minutesDuration": parseDuration(),
            "participant": [
                ["actor": ["reference": "Patient/\(patient.ptnum)", "display": patient.displayName], "status": "accepted"],
                ["actor": ["reference": "Practitioner/unknown", "display": provider], "status": "accepted"]
            ],
            "reasonCode": [["text": reason]]
        ]

        do {
            _ = try await APIService.shared.createAppointment(resource, patientId: patient.ptnum)
            dismiss()
        } catch {
            saveError = "Failed to schedule appointment. Please try again."
    // MARK: - Patient field

    private var patientField: some View {
        FormField(label: "PATIENT") {
            if let selectedPatient {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(selectedPatient.displayName).foregroundColor(.primary)
                        Text(patientSubtitle(selectedPatient)).font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                    Button {
                        self.selectedPatient = nil
                        patientQuery = ""
                        patientResults = []
                    } label: {
                        Image(systemName: "pencil")
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Change patient")
                }
                .padding()
                .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                        TextField("Search by patient name", text: $patientQuery)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .onChange(of: patientQuery) { _, query in
                                Task { await searchPatients(query) }
                            }
                    }
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))

                    if loadingPatients {
                        ProgressView().controlSize(.small)
                    } else if let patientSearchError {
                        Text(patientSearchError).font(.caption).foregroundColor(.red)
                    } else if patientQuery.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 {
                        if patientResults.isEmpty {
                            Text("No matching patients").font(.caption).foregroundColor(.secondary)
                        } else {
                            VStack(spacing: 0) {
                                ForEach(patientResults) { patient in
                                    Button {
                                        selectedPatient = patient
                                        patientQuery = ""
                                        patientResults = []
                                    } label: {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(patient.displayName).font(.subheadline.weight(.semibold))
                                                Text(patientSubtitle(patient)).font(.caption).foregroundColor(.secondary)
                                            }
                                            Spacer()
                                            Image(systemName: "chevron.right").font(.caption).foregroundColor(.secondary)
                                        }
                                        .padding(.vertical, 10)
                                        .padding(.horizontal, 12)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                    if patient.id != patientResults.last?.id {
                                        Divider().padding(.leading, 12)
                                    }
                                }
                            }
                            .background(Color(UIColor.secondarySystemGroupedBackground))
                            .cornerRadius(8)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private func searchPatients(_ query: String) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { patientResults = []; patientSearchError = nil; return }
        loadingPatients = true
        patientSearchError = nil
        do {
            let results = try await APIService.shared.queryPatients(query: trimmed)
            guard patientQuery.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed else { return }
            patientResults = Array(results.prefix(8))
        } catch {
            guard patientQuery.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed else { return }
            patientSearchError = "Could not load patients."
            patientResults = []
        }
        loadingPatients = false
    }

    private func scheduleAppointment() async {
        guard let selectedPatient else { return }
        isSaving = true
        defer { isSaving = false }

        let appointmentPatient = MockAppointmentPatient(
            id: selectedPatient.ptnum,
            displayName: selectedPatient.displayName,
            mrn: selectedPatient.ptnum,
            phoneNumber: contacts.phone(forPtnum: selectedPatient.ptnum, fallback: selectedPatient.phone) ?? "",
            sourcePatient: selectedPatient
        )
        do {
            let appointment = try await AppointmentStore.shared.schedule(
                patient: appointmentPatient,
                date: appointmentDate,
                durationMinutes: Int(duration.split(separator: " ").first ?? "30") ?? 30,
                type: visitType,
                reason: reason.trimmingCharacters(in: .whitespacesAndNewlines),
                doctorName: providerName
            )
            onScheduled?(appointment)
            dismiss()
        } catch {
            saveError = error.localizedDescription
        }
    }

    private func patientSubtitle(_ patient: Patient) -> String {
        [patient.age.map { "\(Int($0)) years" }, patient.administrative_sex]
            .compactMap { $0 }
            .joined(separator: " • ")
            .ifEmpty("Patient")
    }

    private var appointmentDate: Date {
        let cal = Calendar.current
        let timeComps = cal.dateComponents([.hour, .minute], from: selectedTime)
        return cal.date(bySettingHour: timeComps.hour ?? 9, minute: timeComps.minute ?? 0, second: 0, of: selectedDate) ?? selectedDate
    }
}

// MARK: - FormField

struct FormField<Content: View>: View {
    let label: String
    let content: Content

    init(label: String, @ViewBuilder content: () -> Content) {
        self.label = label
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.caption).fontWeight(.bold).foregroundColor(.secondary)
            content
        }
    }
}

// MARK: - Helpers

private extension String {
    func ifEmpty(_ fallback: String) -> String { isEmpty ? fallback : self }
}

// MARK: - AppointmentType CaseIterable

extension AppointmentType: CaseIterable {
    // Only the values the DB check constraint allows for new inserts.
    static var allCases: [AppointmentType] {
        [.newPatient, .followUp, .physicalExam]
    }
}

#Preview {
    ScheduleAppointmentView()
}
