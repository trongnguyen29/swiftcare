import SwiftUI

struct GlobalAppointmentsView: View {
    let onOpenPatient: (Patient) -> Void

    @ObservedObject private var appointmentStore = AppointmentStore.shared
    @State private var selectedDate = Date()
    @State private var showingScheduleSheet = false
    @State private var showingReminderLog = false

    private var dayAppointments: [Appointment] {
        appointmentStore.appointments
            .filter { Calendar.current.isDate($0.date, inSameDayAs: selectedDate) }
            .sorted { $0.date < $1.date }
    }

    private var upcomingAppointments: [Appointment] {
        dayAppointments.filter { $0.date >= Date() }
    }

    private var seenAppointments: [Appointment] {
        dayAppointments.filter { $0.date < Date() }
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

            if dayAppointments.isEmpty {
                ContentUnavailableView(
                    "No appointments",
                    systemImage: "calendar",
                    description: Text("Choose another date or add an appointment."))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
            } else {
                if !upcomingAppointments.isEmpty {
                    appointmentSection("Upcoming", appointments: upcomingAppointments, isSeen: false)
                }
                if !seenAppointments.isEmpty {
                    appointmentSection("Seen", appointments: seenAppointments, isSeen: true)
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
                    patientMRN: patient?.mrn ?? "MRN-000000",
                    onOpenPatient: {
                        if let patient {
                            onOpenPatient(patient.profilePatient)
                        }
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
                            Text(entry.patientName)
                                .font(.headline)
                            Text(entry.phoneNumber)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Text(entry.sentAt.formatted(.dateTime.month().day().hour().minute()))
                                .font(.caption)
                                .foregroundColor(.secondary)
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
