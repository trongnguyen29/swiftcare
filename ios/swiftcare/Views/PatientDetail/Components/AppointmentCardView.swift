import SwiftUI

struct AppointmentCardView: View {
    let appointment: Appointment
    let patientName: String
    let patientMRN: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Date Block
            VStack {
                Text(monthString(from: appointment.date))
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)
                Text(dayString(from: appointment.date))
                    .font(.title2)
                    .fontWeight(.bold)
            }
            .frame(width: 56, height: 64)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(12)
            
            // Content
            VStack(alignment: .leading, spacing: 8) {
                // Header row
                HStack(alignment: .center) {
                    Text(patientName)
                        .font(.headline)
                        .fontWeight(.bold)
                    
                    Text(patientMRN)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    StatusBadge(status: appointment.status)
                    
                    Spacer()
                    
                    ActionButton(isReminderSent: appointment.isReminderSent)
                }
                
                // Reason
                Text(appointment.reason)
                    .font(.subheadline)
                    .foregroundColor(.primary)
                
                // Details Row
                HStack(spacing: 16) {
                    DetailItem(icon: "clock", text: "\(timeString(from: appointment.date)) • \(appointment.durationMinutes) min")
                    
                    DetailItem(icon: appointment.type.icon, text: appointment.type.rawValue, color: appointment.type.color)
                    
                    DetailItem(icon: "stethoscope", text: appointment.doctorName)
                }
                
                // Phone Row
                HStack {
                    Image(systemName: "phone")
                        .foregroundColor(.secondary)
                        .font(.caption)
                    Text(appointment.phoneNumber)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(UIColor.systemBackground))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(UIColor.separator), lineWidth: 0.5)
        )
    }
    
    // Formatters & Helpers
    private func monthString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        return formatter.string(from: date).uppercased()
    }
    
    private func dayString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }
    
    private func timeString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
}

// Subcomponents
struct StatusBadge: View {
    let status: AppointmentStatus
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(statusColor)
                .frame(width: 6, height: 6)
            Text(status.rawValue)
                .font(.caption2)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(statusColor.opacity(0.1))
        .cornerRadius(8)
    }
    
    var statusColor: Color {
        switch status {
        case .confirmed: return .teal
        case .scheduled: return .orange
        case .canceled: return .red
        case .completed: return .green
        }
    }
}

struct ActionButton: View {
    let isReminderSent: Bool
    
    var body: some View {
        HStack {
            if isReminderSent {
                Image(systemName: "checkmark.circle")
                Text("Reminder Sent")
            } else {
                Image(systemName: "bell.fill")
                Text("Send Reminder")
            }
        }
        .font(.caption)
        .fontWeight(.semibold)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .foregroundColor(isReminderSent ? .teal : .white)
        .background(isReminderSent ? Color.clear : Color.init(red: 0.1, green: 0.2, blue: 0.4)) // Dark navy blue from Figma
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isReminderSent ? Color.teal.opacity(0.3) : Color.clear, lineWidth: 1)
        )
    }
}

struct DetailItem: View {
    let icon: String
    let text: String
    var color: Color = .secondary
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
            Text(text)
        }
        .font(.caption)
        .foregroundColor(color)
    }
}

#Preview {
    AppointmentCardView(
        appointment: Appointment.mocks[0],
        patientName: "Sarah Chen",
        patientMRN: "MRN-847261"
    )
    .padding()
    .background(Color(UIColor.systemGroupedBackground))
}
