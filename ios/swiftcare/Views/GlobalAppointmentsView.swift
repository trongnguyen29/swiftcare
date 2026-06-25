import SwiftUI

struct GlobalAppointmentsView: View {
    let onOpenPatient: (Patient) -> Void

    @ObservedObject private var appointmentStore = AppointmentStore.shared
    @State private var selectedDate = Date()
    @State private var showingScheduleSheet = false
    @State private var showingReminderLog = false
    @State private var typeFilter: AppointmentType? = nil

    private var dayAppointments: [Appointment] {
        appointmentStore.appointments
            .filter { Calendar.current.isDate($0.date, inSameDayAs: selectedDate) }
            .sorted { $0.date < $1.date }
    }

    private var upcomingAppointments: [Appointment] { dayAppointments.filter { $0.date >= Date() } }
    private var seenAppointments: [Appointment]     { dayAppointments.filter { $0.date <  Date() } }

    private func filtered(_ list: [Appointment]) -> [Appointment] {
        guard let filter = typeFilter else { return list }
        return list.filter { $0.type == filter }
    }

    init(onOpenPatient: @escaping (Patient) -> Void = { _ in }) {
        self.onOpenPatient = onOpenPatient
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: 24) {
                        calendarRail
                        agenda
                    }
                    .frame(width: 320)
                    
                    // RIGHT COLUMN
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            VStack(alignment: .leading) {
                                Text("Upcoming Appointments")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                Text("\(filteredAppointments.count) scheduled across all patients")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            
                            HStack(spacing: 12) {
                                Button(action: {}) {
                                    HStack {
                                        Image(systemName: "message")
                                        Text("Reminder Log")
                                    }
                                    .font(.subheadline.bold())
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 10)
                                    .background(Color(UIColor.systemBackground))
                                    .cornerRadius(8)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color(UIColor.separator), lineWidth: 1)
                                    )
                                    .overlay(
                                        Circle()
                                            .fill(Color.brand)
                                            .frame(width: 20, height: 20)
                                            .overlay(Text("1").font(.caption2.bold()).foregroundColor(.white))
                                            .offset(x: 10, y: -10)
                                        , alignment: .topTrailing
                                    )
                                }
                                .buttonStyle(PlainButtonStyle())
                                
                                Button(action: { showingScheduleSheet = true }) {
                                    HStack {
                                        Image(systemName: "plus")
                                        Text("Schedule Appointment")
                                    }
                                    .font(.subheadline.bold())
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 10)
                                    .background(Color.brand)
                                    .cornerRadius(8)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                        .padding(.bottom, 8)
                    VStack(alignment: .leading, spacing: 20) {
                        calendarRail
                        agenda
                    }
                }
                .padding()
            }
            .background(Color(UIColor.systemGroupedBackground))
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showingScheduleSheet) {
                ScheduleAppointmentView(initialDate: selectedDate) { appointment in
                    selectedDate = appointment.date
                }
                .presentationDetents([.large])
            }
            .sheet(isPresented: $showingReminderLog) {
                ReminderLogView()
            }
        }
        .task {
            await appointmentStore.loadAppointments()
        }
    }

    private var calendarRail: some View {
        CustomCalendarView(
            selectedDate: $selectedDate,
            appointmentDates: appointmentStore.appointments.map(\.date)
        )
        .frame(width: 320)
    }

    private var agenda: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(selectedDate.formatted(.dateTime.weekday(.wide).month().day()))
                        .font(.title3.bold())
                    Text("\(dayAppointments.count) \(dayAppointments.count == 1 ? "appointment" : "appointments")")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Button { showingReminderLog = true } label: {
                    Label("Reminder Log", systemImage: "bell.badge")
                }
                .buttonStyle(.bordered)
                Button { showingScheduleSheet = true } label: {
                    Image(systemName: "plus")
                }
                .buttonStyle(.borderedProminent)
                .accessibilityLabel("Schedule appointment")
            }

            // Type filter pills
            if !dayAppointments.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterPill(label: "All", isSelected: typeFilter == nil) { typeFilter = nil }
                        ForEach(AppointmentType.allCases, id: \.self) { type in
                            if dayAppointments.contains(where: { $0.type == type }) {
                                FilterPill(label: type.rawValue, isSelected: typeFilter == type, color: type.color) {
                                    typeFilter = typeFilter == type ? nil : type
                                }
                            }
                        }
                    }
                }
            }

            if dayAppointments.isEmpty {
                ContentUnavailableView(
                    "No appointments",
                    systemImage: "calendar",
                    description: Text("Choose another date or add an appointment."))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
            } else {
                let upcoming = filtered(upcomingAppointments)
                let seen     = filtered(seenAppointments)
                if !upcoming.isEmpty { appointmentSection("Upcoming", appointments: upcoming, isSeen: false) }
                if !seen.isEmpty     { appointmentSection("Seen",     appointments: seen,     isSeen: true)  }
                if upcoming.isEmpty && seen.isEmpty {
                    Text("No appointments match the selected filter.")
                        .font(.subheadline).foregroundColor(.secondary)
                }
            }
        }
        .frame(minWidth: 340, maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func appointmentSection(_ title: String, appointments: [Appointment], isSeen: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.caption.weight(.bold))
                .foregroundColor(.secondary)
            ForEach(appointments) { appointment in
                let patient = appointmentStore.patient(for: appointment)
                AppointmentCardView(
                    appointment: appointment,
                    patientName: patient?.displayName ?? "Unknown Patient",
                    patientMRN: patient?.mrn ?? "",
                    onOpenPatient: {
                        if let patient { onOpenPatient(patient.profilePatient) }
                    },
                    onSendReminder: {
                        try await appointmentStore.sendReminder(for: appointment)
                    }
                )
                .opacity(isSeen ? 0.76 : 1)
            }
        }
    }
}

// MARK: - Filter Pill

struct FilterPill: View {
    let label: String
    let isSelected: Bool
    var color: Color = Color.brand
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundColor(isSelected ? .white : color)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(isSelected ? color : color.opacity(0.08))
                .cornerRadius(20)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Reminder Log

struct ReminderLogView: View {
    @ObservedObject private var appointmentStore = AppointmentStore.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if appointmentStore.reminderLog.isEmpty {
                    ContentUnavailableView(
                        "No reminders sent",
                        systemImage: "bell.slash",
                        description: Text("Sent appointment reminders will appear here."))
                } else {
                    List(appointmentStore.reminderLog) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(entry.patientName).font(.headline)
                            Text(entry.phoneNumber).font(.subheadline).foregroundColor(.secondary)
                            Text(entry.sentAt.formatted(.dateTime.month().day().hour().minute()))
                                .font(.caption).foregroundColor(.secondary)
                        }
                        .padding(.vertical, 3)
                    }
                }
            }
            .navigationTitle("Reminder Log")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

#Preview {
    GlobalAppointmentsView()
}
