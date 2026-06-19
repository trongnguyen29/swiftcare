import SwiftUI

struct AppointmentCardView: View {
    let appointment: Appointment
    let patientName: String
    let patientMRN: String
    let onOpenPatient: (() -> Void)?
    let onSendReminder: (() async throws -> Void)?

    @ObservedObject private var contacts = PatientContactStore.shared
    @State private var sendingReminder = false
    @State private var reminderError: String?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if let onOpenPatient {
                Button(action: onOpenPatient) { appointmentContent }.buttonStyle(.plain)
            } else {
                appointmentContent
            }
            reminderControl
        }
        .padding()
        .background(Color(UIColor.systemBackground))
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color(UIColor.separator), lineWidth: 0.5))
        .alert("Reminder Not Sent", isPresented: Binding(
            get: { reminderError != nil },
            set: { if !$0 { reminderError = nil } }
        )) {
            Button("OK", role: .cancel) { reminderError = nil }
        } message: {
            Text(reminderError ?? "")
        }
    }

    private var appointmentContent: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack {
                Text(monthString(from: appointment.date))
                    .font(.caption).fontWeight(.semibold).foregroundColor(.secondary)
                Text(dayString(from: appointment.date))
                    .font(.title2).fontWeight(.bold)
            }
            .frame(width: 56, height: 64)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(12)

            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .center, spacing: 6) {
                    Text(patientName).font(.headline.weight(.bold))
                    StatusBadge(status: appointment.status)
                    if onOpenPatient != nil {
                        Image(systemName: "chevron.right").font(.caption2).foregroundColor(.secondary)
                    }
                }

                Text(appointment.reason).font(.subheadline).foregroundColor(.primary)

                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(timeString(from: appointment.date))
                            .font(.title3.bold()).monospacedDigit()
                        Text("\(appointment.durationMinutes) min")
                            .font(.caption.weight(.semibold)).foregroundColor(.teal)
                    }
                    .frame(minWidth: 78, alignment: .leading)

                    VStack(alignment: .leading, spacing: 5) {
                        DetailItem(icon: appointment.type.icon, text: appointment.type.rawValue, color: appointment.type.color)
                        DetailItem(icon: "stethoscope", text: appointment.doctorName)
                    }
                }

                HStack {
                    Image(systemName: "phone").foregroundColor(.secondary).font(.caption)
                    Text(displayedPhoneNumber).font(.caption).foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var reminderControl: some View {
        if appointment.isReminderSent {
            ActionButton(isReminderSent: true)
        } else if sendingReminder {
            ProgressView().controlSize(.small).frame(width: 112, height: 30)
        } else if onSendReminder != nil {
            Button(action: sendReminder) { ActionButton(isReminderSent: false) }.buttonStyle(.plain)
        } else {
            ActionButton(isReminderSent: false)
        }
    }

    private func sendReminder() {
        guard let onSendReminder else { return }
        Task {
            sendingReminder = true
            defer { sendingReminder = false }
            do { try await onSendReminder() }
            catch { reminderError = error.localizedDescription }
        }
    }

    private func monthString(from date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "MMM"; return f.string(from: date).uppercased()
    }
    private func dayString(from date: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "d"; return f.string(from: date)
    }
    private func timeString(from date: Date) -> String {
        let f = DateFormatter(); f.timeStyle = .short; return f.string(from: date)
    }
    private var displayedPhoneNumber: String {
        contacts.phone(forPtnum: patientMRN, fallback: appointment.phoneNumber) ?? "No phone on file"
    }
}

// MARK: - Subcomponents

struct StatusBadge: View {
    let status: AppointmentStatus

    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(statusColor).frame(width: 6, height: 6)
            Text(status.rawValue).font(.caption2).fontWeight(.medium)
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(statusColor.opacity(0.1)).cornerRadius(8)
    }

    var statusColor: Color {
        switch status {
        case .confirmed: return .teal
        case .scheduled: return .orange
        case .canceled:  return .red
        case .completed: return .green
        }
    }
}

struct ActionButton: View {
    let isReminderSent: Bool

    var body: some View {
        HStack {
            if isReminderSent {
                Image(systemName: "checkmark.circle"); Text("Reminder Sent")
            } else {
                Image(systemName: "bell.fill"); Text("Send Reminder")
            }
        }
        .font(.caption).fontWeight(.semibold)
        .padding(.horizontal, 12).padding(.vertical, 6)
        .foregroundColor(isReminderSent ? .teal : .white)
        .background(isReminderSent ? Color.clear : Color(red: 0.1, green: 0.2, blue: 0.4))
        .cornerRadius(8)
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(isReminderSent ? Color.teal.opacity(0.3) : Color.clear, lineWidth: 1))
    }
}

struct DetailItem: View {
    let icon: String
    let text: String
    var color: Color = .secondary

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon); Text(text)
        }
        .font(.caption).foregroundColor(color)
    }
}

#Preview {
    AppointmentCardView(
        appointment: Appointment.mocks[0],
        patientName: "Sarah Chen",
        patientMRN: "MRN-847261",
        onOpenPatient: nil,
        onSendReminder: nil
    )
    .padding()
    .background(Color(UIColor.systemGroupedBackground))
}
