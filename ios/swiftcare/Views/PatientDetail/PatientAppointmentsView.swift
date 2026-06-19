import SwiftUI

struct PatientAppointmentsView: View {
    let patient: Patient
    @ObservedObject private var appointmentStore = AppointmentStore.shared
    @State private var selectedDate = Date()
    @State private var showingScheduleSheet = false
    @State private var showingReminderLog = false
    
    // Using mock data for demonstration
    var appointments: [Appointment] {
        appointmentStore.appointments.filter { appointmentStore.patient(for: $0)?.mrn == patient.ptnum }
    }
    
    var body: some View {
        ScrollView {
            HStack(alignment: .top, spacing: 24) {
                // LEFT COLUMN
                VStack(alignment: .leading, spacing: 24) {
                    // Custom Calendar Component
                    CustomCalendarView(
                        selectedDate: $selectedDate,
                        appointmentDates: appointments.map(\.date)
                    )
                    
                    Divider()
                    
                    // Selected Date Overview
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text(dateString(from: selectedDate))
                                .font(.headline)
                                .foregroundColor(.secondary)
                            Spacer()
                            Button(action: { showingScheduleSheet = true }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "plus")
                                    Text("New")
                                }
                                .font(.subheadline.bold())
                            }
                        }
                        
                        // Show appointments for selected date
                        let dayAppointments = appointments.filter { Calendar.current.isDate($0.date, inSameDayAs: selectedDate) }
                        
                        if dayAppointments.isEmpty {
                            Text("No appointments scheduled.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        } else {
                            ForEach(dayAppointments) { appt in
                                MiniAppointmentCard(
                                    appointment: appt,
                                    patientName: appt.mockPatient?.displayName ?? patient.displayName
                                )
                            }
                        }
                    }
                }
                .frame(width: 320)
                
                // RIGHT COLUMN
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Upcoming Appointments")
                                .font(.title2)
                                .fontWeight(.bold)
                            Text("\(appointments.count) scheduled for \(patient.displayName)")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        HStack(spacing: 12) {
                            Button(action: { showingReminderLog = true }) {
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
                                        .fill(Color.teal)
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
                                .background(Color(red: 0.1, green: 0.2, blue: 0.4))
                                .cornerRadius(8)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding(.bottom, 8)
                    
                    // Cards
                    VStack(spacing: 16) {
                        ForEach(appointments.sorted(by: { $0.date < $1.date })) { appt in
                            // Provide mock MRN for visual completeness
                            AppointmentCardView(
                                appointment: appt,
                                patientName: appt.mockPatient?.displayName ?? patient.displayName,
                                patientMRN: appt.mockPatient?.mrn ?? patient.ptnum,
                                onOpenPatient: nil,
                                onSendReminder: {
                                    try await appointmentStore.sendReminder(for: appt)
                                }
                            )
                        }
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .padding()
        }
        .background(Color(UIColor.systemGroupedBackground))
        .sheet(isPresented: $showingScheduleSheet) {
            ScheduleAppointmentView(
                initialPatient: patient,
                initialDate: selectedDate
            )
            .presentationDetents([.large])
        }
        .sheet(isPresented: $showingReminderLog) {
            ReminderLogView()
        }
        .task {
            await appointmentStore.loadAppointments()
        }
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
                Text(appointment.type.rawValue)
                    .font(.caption)
                    .foregroundColor(typeColor(for: appointment.type))
            }
            
            Text(patientName)
                .font(.headline)
            Text(appointment.reason)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(1)
            
            HStack {
                Image(systemName: "clock")
                Text("\(timeString(from: appointment.date))  \(appointment.durationMinutes) min")
            }
            .font(.caption)
            .foregroundColor(.secondary)
            
            if appointment.isReminderSent {
                HStack {
                    Image(systemName: "checkmark.circle")
                    Text("Reminder sent")
                }
                .font(.caption)
                .foregroundColor(.teal)
                .padding(.top, 4)
            }
        }
        .padding()
        .background(Color(UIColor.systemBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(UIColor.separator), lineWidth: 0.5)
        )
    }
    
    private func timeString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    private func typeColor(for type: AppointmentType) -> Color {
        switch type {
        case .inPerson: return .primary
        case .telehealth: return .teal
        case .phone: return .purple
        case .newPatient: return .blue
        case .followUp: return .teal
        case .physicalExam: return .indigo
        }
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

    init(selectedDate: Binding<Date>, appointmentDates: [Date]) {
        _selectedDate = selectedDate
        self.appointmentDates = appointmentDates

        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: selectedDate.wrappedValue)
        _displayedMonth = State(initialValue: calendar.date(from: components) ?? selectedDate.wrappedValue)
    }

    private var monthTitle: String {
        displayedMonth.formatted(.dateTime.month(.wide).year())
    }

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
                } label: {
                    Image(systemName: "chevron.left")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Previous month")

                Spacer()

                Text(monthTitle)
                    .font(.headline)

                Spacer()

                Button {
                    displayedMonth = calendar.date(byAdding: .month, value: 1, to: displayedMonth) ?? displayedMonth
                } label: {
                    Image(systemName: "chevron.right")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Next month")
            }

            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(daysOfWeek, id: \.self) { day in
                    Text(day)
                        .font(.caption2.weight(.bold))
                        .foregroundColor(.secondary)
                }
            }

            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(Array(monthDays.indices), id: \.self) { index in
                    if let date = monthDays[index] {
                        let isSelected = calendar.isDate(date, inSameDayAs: selectedDate)
                        let isToday = calendar.isDateInToday(date)
                        let hasAppointment = appointmentDates.contains { calendar.isDate($0, inSameDayAs: date) }

                        Button {
                            selectedDate = date
                        } label: {
                            ZStack {
                                if isSelected {
                                    Circle().fill(Color.teal)
                                } else if isToday {
                                    Circle().stroke(Color.teal, lineWidth: 1.5)
                                }

                                VStack(spacing: 2) {
                                    Text(date.formatted(.dateTime.day()))
                                        .font(.system(size: 14, weight: isSelected ? .bold : .regular))
                                        .foregroundColor(isSelected ? .white : .primary)
                                    Circle()
                                        .fill(isSelected ? .white : (hasAppointment ? .teal : .clear))
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
