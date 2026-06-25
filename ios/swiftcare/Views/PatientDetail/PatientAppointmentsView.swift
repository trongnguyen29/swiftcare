import SwiftUI

struct PatientAppointmentsView: View {
    let patient: Patient

    @ObservedObject private var appointmentStore = AppointmentStore.shared
    @State private var selectedDate: Date = Date()
    @State private var showingScheduleSheet = false
    @State private var showingReminderLog = false
    @State private var appointments: [Appointment] = []
    @State private var isLoading = false

    var body: some View {
        ScrollView {
            HStack(alignment: .top, spacing: 24) {
                // LEFT COLUMN
                VStack(alignment: .leading, spacing: 24) {
                    CustomCalendarView(
                        selectedDate: $selectedDate,
                        appointmentDates: appointments.map(\.date)
                    )

                    Divider()

                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text(dateString(from: selectedDate))
                                .font(.headline).foregroundColor(.secondary)
                            Spacer()
                            Button(action: { showingScheduleSheet = true }) {
                                HStack(spacing: 4) { Image(systemName: "plus"); Text("New") }
                                    .font(.subheadline.bold())
                            }
                        }

                        let dayAppointments = appointments.filter { Calendar.current.isDate($0.date, inSameDayAs: selectedDate) }
                        if dayAppointments.isEmpty {
                            Text("No appointments scheduled.")
                                .font(.subheadline).foregroundColor(.secondary)
                        } else {
                            ForEach(dayAppointments) { appt in
                                MiniAppointmentCard(appointment: appt, patientName: patient.displayName)
                            }
                        }
                    }
                }
                .frame(width: 320)

                // RIGHT COLUMN
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Upcoming Appointments").font(.title2).fontWeight(.bold)
                            Text("\(appointments.count) scheduled for \(patient.displayName)")
                                .font(.subheadline).foregroundColor(.secondary)
                        }
                        Spacer()
                        HStack(spacing: 12) {
                            Button(action: { showingReminderLog = true }) {
                                HStack {
                                    Image(systemName: "message"); Text("Reminder Log")
                                }
                                .font(.subheadline.bold())
                                .padding(.horizontal, 16).padding(.vertical, 10)
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
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
                            }
                            .buttonStyle(.plain)

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
                                HStack { Image(systemName: "plus"); Text("Schedule Appointment") }
                                    .font(.subheadline.bold()).foregroundColor(.white)
                                    .padding(.horizontal, 16).padding(.vertical, 10)
                                    .background(Color(red: 0.1, green: 0.2, blue: 0.4))
                                    .cornerRadius(8)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.bottom, 8)

                    if isLoading && appointments.isEmpty {
                        ProgressView().frame(maxWidth: .infinity).padding(.vertical, 40)
                    } else {
                        VStack(spacing: 16) {
                            ForEach(appointments.sorted(by: { $0.date < $1.date })) { appt in
                                AppointmentCardView(
                                    appointment: appt,
                                    patientName: patient.displayName,
                                    patientMRN: patient.ptnum,
                                    onOpenPatient: nil,
                                    onSendReminder: {
                                        try await appointmentStore.sendReminder(for: appt)
                                    }
                                )
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .padding()
        }
        .background(Color(UIColor.systemGroupedBackground))
        .task(id: patient.ptnum) { await loadAppointments() }
        .sheet(isPresented: $showingScheduleSheet, onDismiss: { Task { await loadAppointments() } }) {
            ScheduleAppointmentView(initialPatient: patient, initialDate: selectedDate)
                .presentationDetents([.large])
        }
        .sheet(isPresented: $showingReminderLog) {
            ReminderLogView()
        }
    }

    private func loadAppointments() async {
        isLoading = true
        defer { isLoading = false }
        appointments = (try? await APIService.shared.getAppointments(patientId: patient.ptnum)) ?? []
        try? await Task.sleep(nanoseconds: 15_000_000_000)
        if !Task.isCancelled { await loadAppointments() }
        appointments = (try? await APIService.shared.getAppointments(ptnum: patient.ptnum)) ?? []
    }

    private func dateString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM d, yyyy"
        return formatter.string(from: date).uppercased()
    }
}

// MARK: - Mini Card for Left Column

struct MiniAppointmentCard: View {
    let appointment: Appointment
    let patientName: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                StatusBadge(status: appointment.status)
                Spacer()
                Text(appointment.type.rawValue).font(.caption).foregroundColor(appointment.type.color)
            }
            Text(patientName).font(.headline)
            Text(appointment.reason).font(.subheadline).foregroundColor(.secondary).lineLimit(1)
            HStack {
                Image(systemName: "clock")
                Text("\(timeString(from: appointment.date))  \(appointment.durationMinutes) min")
            }
            .font(.caption).foregroundColor(.secondary)
            if appointment.isReminderSent {
                HStack {
                    Image(systemName: "checkmark.circle")
                    Text("Reminder sent")
                }
                .font(.caption)
                .foregroundColor(.brand)
                .padding(.top, 4)
                HStack { Image(systemName: "checkmark.circle"); Text("Reminder sent") }
                    .font(.caption).foregroundColor(.teal).padding(.top, 4)
            }
        }
        .padding()
        .background(Color(UIColor.systemBackground))
        .cornerRadius(12)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(UIColor.separator), lineWidth: 0.5))
    }

    private func timeString(from date: Date) -> String {
        let f = DateFormatter(); f.timeStyle = .short; return f.string(from: date)
    }
}

// MARK: - Custom Calendar

struct CustomCalendarView: View {
    @Binding var selectedDate: Date
    let appointmentDates: [Date]

    @State private var displayedMonth: Date

    private let calendar = Calendar.current
    private let daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
    private let columns = Array(repeating: GridItem(.flexible()), count: 7)

    init(selectedDate: Binding<Date>, appointmentDates: [Date] = []) {
        _selectedDate = selectedDate
        self.appointmentDates = appointmentDates
        let cal = Calendar.current
        let comps = cal.dateComponents([.year, .month], from: selectedDate.wrappedValue)
        _displayedMonth = State(initialValue: cal.date(from: comps) ?? selectedDate.wrappedValue)
    }

    private var monthTitle: String { displayedMonth.formatted(.dateTime.month(.wide).year()) }

    private var monthDays: [Date?] {
        guard let range = calendar.range(of: .day, in: .month, for: displayedMonth),
              let firstDay = calendar.date(from: calendar.dateComponents([.year, .month], from: displayedMonth)) else {
            return []
        }
        let firstWeekday = calendar.component(.weekday, from: firstDay)
        let leadingDays = (firstWeekday - calendar.firstWeekday + 7) % 7
        let days = range.compactMap { day in
            calendar.date(byAdding: .day, value: day - 1, to: firstDay)
        }
        return Array<Date?>(repeating: nil, count: leadingDays) + days.map(Optional.some)
    }

    var body: some View {
        VStack(spacing: 14) {
            HStack {
                Button {
                    displayedMonth = calendar.date(byAdding: .month, value: -1, to: displayedMonth) ?? displayedMonth
                } label: { Image(systemName: "chevron.left") }
                .buttonStyle(.plain).accessibilityLabel("Previous month")
                Spacer()
                Text(monthTitle).font(.headline)
                Spacer()
                Button {
                    displayedMonth = calendar.date(byAdding: .month, value: 1, to: displayedMonth) ?? displayedMonth
                } label: { Image(systemName: "chevron.right") }
                .buttonStyle(.plain).accessibilityLabel("Next month")
            }

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(daysOfWeek, id: \.self) { day in
                    Text(day).font(.caption2.weight(.bold)).foregroundColor(.secondary)
                }
            }
            
            // Days grid (starting Tuesday)
            LazyVGrid(columns: columns, spacing: 12) {
                // Empty offset for Sunday and Monday
                Text("").frame(height: 32)
                Text("").frame(height: 32)
                
                ForEach(days, id: \.self) { day in
                    let isSelected = day == 18
                    let isToday = day == 17
                    
                    ZStack {
                        if isSelected {
                            Circle()
                                .fill(Color.brand) // Navy
                        } else if isToday {
                            Circle()
                                .stroke(Color.brand, lineWidth: 1.5)
                        }
                        
                        VStack(spacing: 2) {
                            Text("\(day)")
                                .font(.system(size: 14))
                                .fontWeight(isSelected ? .bold : .regular)
                                .foregroundColor(isSelected ? .white : .primary)
                            
                            // Mock dots for events
                            if [18, 19, 23, 25].contains(day) {
                                Circle()
                                    .fill(isSelected ? .white : .brand)
                                    .frame(width: 4, height: 4)

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(Array(monthDays.indices), id: \.self) { index in
                    if let date = monthDays[index] {
                        let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)
                        let isToday = calendar.isDateInToday(date)
                        let hasAppt = appointmentDates.contains { calendar.isDate($0, inSameDayAs: date) }
                        Button { selectedDate = date } label: {
                            ZStack {
                                if isSelected { Circle().fill(Color.teal) }
                                else if isToday { Circle().stroke(Color.teal, lineWidth: 1.5) }
                                VStack(spacing: 2) {
                                    Text(date.formatted(.dateTime.day()))
                                        .font(.system(size: 14, weight: isSelected ? .bold : .regular))
                                        .foregroundColor(isSelected ? .white : .primary)
                                    Circle()
                                        .fill(isSelected ? .white : (hasAppt ? Color.teal : Color.clear))
                                        .frame(width: 4, height: 4)
                                }
                            }
                            .frame(height: 38)
                        }
                        .buttonStyle(.plain)
                    } else {
                        Color.clear.frame(height: 38)
                    }
                }
            }
        }
    }
}
