import SwiftUI

struct GlobalAppointmentsView: View {
    @State private var selectedDate: Date = Date()
    @State private var showingScheduleSheet = false
    @State private var appointments: [Appointment] = []
    @State private var isLoading = false
    @State private var typeFilter: AppointmentType? = nil

    var filteredAppointments: [Appointment] {
        guard let filter = typeFilter else { return appointments }
        return appointments.filter { $0.type == filter }
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                HStack(alignment: .top, spacing: 24) {
                    // LEFT COLUMN
                    VStack(alignment: .leading, spacing: 24) {
                        // Reusing the CustomCalendarView from PatientAppointmentsView
                        CustomCalendarView(selectedDate: $selectedDate)
                        
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
                                        patientName: appt.patientName
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

                        // Filter pills
                        HStack(spacing: 8) {
                            FilterPill(label: "All", isSelected: typeFilter == nil) {
                                typeFilter = nil
                            }
                            ForEach(AppointmentType.allCases, id: \.self) { type in
                                FilterPill(label: type.rawValue, isSelected: typeFilter == type, color: type.color) {
                                    typeFilter = typeFilter == type ? nil : type
                                }
                            }
                        }

                        // Cards
                        VStack(spacing: 16) {
                            ForEach(filteredAppointments.sorted(by: { $0.date < $1.date })) { appt in
                                AppointmentCardView(
                                    appointment: appt,
                                    patientName: appt.patientName,
                                    patientMRN: appt.patientId
                                )
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .padding()
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationTitle("Appointments")
            .task { await loadAppointments() }
            .sheet(isPresented: $showingScheduleSheet, onDismiss: { Task { await loadAppointments() } }) {
                ScheduleAppointmentView(patient: Patient.mock)
            }
        }
    }

    private func loadAppointments() async {
        isLoading = true
        defer { isLoading = false }
        appointments = (try? await APIService.shared.getAllAppointments()) ?? []
        // Poll every 15 seconds so the view stays live
        try? await Task.sleep(nanoseconds: 15_000_000_000)
        if !Task.isCancelled { await loadAppointments() }
    }

    private func dateString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM d, yyyy"
        return formatter.string(from: date).uppercased()
    }
}

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
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    GlobalAppointmentsView()
}
