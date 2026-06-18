import Foundation

enum AppointmentType: String, Codable {
    case inPerson = "In-Person"
    case telehealth = "Telehealth"
    case phone = "Phone"
    
    var icon: String {
        switch self {
        case .inPerson: return "mappin.and.ellipse"
        case .telehealth: return "video"
        case .phone: return "phone"
        }
    }
}

enum AppointmentStatus: String, Codable {
    case scheduled = "Scheduled"
    case confirmed = "Confirmed"
    case canceled = "Canceled"
    case completed = "Completed"
}

struct Appointment: Identifiable, Codable {
    let id: String
    let patientId: String
    let date: Date
    let durationMinutes: Int
    let type: AppointmentType
    let status: AppointmentStatus
    let reason: String
    let doctorName: String
    let phoneNumber: String
    let isReminderSent: Bool
    
    var endTime: Date {
        return date.addingTimeInterval(TimeInterval(durationMinutes * 60))
    }
}

// MARK: - Mock Data
extension Appointment {
    static let mocks: [Appointment] = [
        Appointment(
            id: "1",
            patientId: "patient-0", // Assuming Sarah Chen
            date: Calendar.current.date(from: DateComponents(year: 2026, month: 6, day: 18, hour: 9, minute: 0))!,
            durationMinutes: 30,
            type: .inPerson,
            status: .confirmed,
            reason: "Follow-up: Pulmonary Function Test Results",
            doctorName: "Dr. Marcus Webb",
            phoneNumber: "+1 (415) 555-0182",
            isReminderSent: true
        ),
        Appointment(
            id: "2",
            patientId: "patient-1", // Michael Rodriguez
            date: Calendar.current.date(from: DateComponents(year: 2026, month: 6, day: 18, hour: 10, minute: 30))!,
            durationMinutes: 45,
            type: .telehealth,
            status: .scheduled,
            reason: "Medication Review — Metoprolol Titration",
            doctorName: "Dr. Marcus Webb",
            phoneNumber: "+1 (628) 555-0347",
            isReminderSent: false
        ),
        Appointment(
            id: "3",
            patientId: "patient-2", // Emily Johnson
            date: Calendar.current.date(from: DateComponents(year: 2026, month: 6, day: 19, hour: 14, minute: 0))!,
            durationMinutes: 60,
            type: .inPerson,
            status: .scheduled,
            reason: "Annual Wellness Exam + CT Review",
            doctorName: "Dr. Marcus Webb",
            phoneNumber: "+1 (510) 555-0094",
            isReminderSent: false
        ),
        Appointment(
            id: "4",
            patientId: "patient-0", // Sarah Chen
            date: Calendar.current.date(from: DateComponents(year: 2026, month: 6, day: 23, hour: 11, minute: 0))!,
            durationMinutes: 30,
            type: .phone,
            status: .scheduled,
            reason: "Lab Results Discussion",
            doctorName: "Dr. Marcus Webb",
            phoneNumber: "+1 (415) 555-0182",
            isReminderSent: false
        )
    ]
}
