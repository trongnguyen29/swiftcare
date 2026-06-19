import SwiftUI

struct PatientAppointmentsView: View {
    let patient: Patient
    @State private var selectedDate: Date = Date()
    @State private var showingScheduleSheet = false
    @State private var appointments: [Appointment] = []
    @State private var isLoading = false
    
    var body: some View {
        ScrollView {
            HStack(alignment: .top, spacing: 24) {
                // LEFT COLUMN
                VStack(alignment: .leading, spacing: 24) {
                    // Custom Calendar Component
                    CustomCalendarView(selectedDate: $selectedDate)
                    
                    Divider()
                    
                    // Selected Date Overview
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text(dateString(from: selectedDate))
                                .font(.headline)
                                .foregroundColor(.secondary)
                            Spacer()
                            Button(action: {}) {
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
                            Text("Upcoming Appointments")
                                .font(.title2)
                                .fontWeight(.bold)
                            Text("\(appointments.count) scheduled for \(patient.displayName)")
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
                                patientName: patient.displayName,
                                patientMRN: patient.ptnum
                            )
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
            ScheduleAppointmentView(patient: patient)
        }
    }

    private func loadAppointments() async {
        isLoading = true
        defer { isLoading = false }
        appointments = (try? await APIService.shared.getAppointments(ptnum: patient.ptnum)) ?? []
        try? await Task.sleep(nanoseconds: 15_000_000_000)
        if !Task.isCancelled { await loadAppointments() }
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
                    .foregroundColor(appointment.type.color)
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
    
}

// MARK: - Custom Calendar
struct CustomCalendarView: View {
    @Binding var selectedDate: Date
    
    // Static mockup of calendar for June 2026 as seen in Figma
    let daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
    let days = Array(1...30)
    let columns = Array(repeating: GridItem(.flexible()), count: 7)
    
    var body: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                Image(systemName: "chevron.left")
                    .foregroundColor(.secondary)
                Spacer()
                Text("June 2026")
                    .font(.headline)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)
            
            // Days of week
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(daysOfWeek, id: \.self) { day in
                    Text(day)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.secondary)
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
                                .fill(Color(red: 0.1, green: 0.2, blue: 0.4)) // Navy
                        } else if isToday {
                            Circle()
                                .stroke(Color.teal, lineWidth: 1.5)
                        }
                        
                        VStack(spacing: 2) {
                            Text("\(day)")
                                .font(.system(size: 14))
                                .fontWeight(isSelected ? .bold : .regular)
                                .foregroundColor(isSelected ? .white : .primary)
                            
                            // Mock dots for events
                            if [18, 19, 23, 25].contains(day) {
                                Circle()
                                    .fill(isSelected ? .white : .teal)
                                    .frame(width: 4, height: 4)
                            }
                        }
                    }
                    .frame(height: 36)
                    .onTapGesture {
                        if let date = Calendar.current.date(from: DateComponents(year: 2026, month: 6, day: day)) {
                            selectedDate = date
                        }
                    }
                }
            }
        }
    }
}
