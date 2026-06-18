import SwiftUI

struct GlobalAppointmentsView: View {
    @State private var selectedDate: Date = Calendar.current.date(from: DateComponents(year: 2026, month: 6, day: 18)) ?? Date()
    @State private var showingScheduleSheet = false
    
    // Global mock data
    var appointments: [Appointment] {
        Appointment.mocks
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
                                        patientName: mockName(for: appt.patientId)
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
                                Text("\(appointments.count) scheduled across all patients")
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
                                AppointmentCardView(
                                    appointment: appt,
                                    patientName: mockName(for: appt.patientId),
                                    patientMRN: mockMRN(for: appt.patientId)
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
            .sheet(isPresented: $showingScheduleSheet) {
                // For a global view, we create a dummy patient just to fulfill the ScheduleAppointmentView parameter,
                // or we could refactor ScheduleAppointmentView to take an optional patient.
                ScheduleAppointmentView(patient: Patient.mock)
            }
        }
    }
    
    private func dateString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM d, yyyy"
        return formatter.string(from: date).uppercased()
    }
    
    private func mockName(for id: String) -> String {
        switch id {
        case "patient-0": return "Sarah Chen"
        case "patient-1": return "Michael Rodriguez"
        case "patient-2": return "Emily Johnson"
        default: return "Unknown Patient"
        }
    }
    
    private func mockMRN(for id: String) -> String {
        switch id {
        case "patient-0": return "MRN-847261"
        case "patient-1": return "MRN-592847"
        case "patient-2": return "MRN-318529"
        default: return "MRN-000000"
        }
    }
}

#Preview {
    GlobalAppointmentsView()
}
