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
    let patientName: String
    let date: Date
    let durationMinutes: Int
    let type: AppointmentType
    let status: AppointmentStatus
    let reason: String
    let doctorName: String
    let phoneNumber: String
    let isReminderSent: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case patientId       = "ptnum"
        case patientName     = "patient_name"
        case date            = "appointment_date"
        case durationMinutes = "duration_minutes"
        case type            = "appointment_type"
        case status
        case reason
        case doctorName      = "doctor_name"
        case phoneNumber     = "phone_number"
        case isReminderSent  = "is_reminder_sent"
    }

    var endTime: Date {
        return date.addingTimeInterval(TimeInterval(durationMinutes * 60))
    }
}

// MARK: - Mock Data
extension Appointment {
    static let mocks: [Appointment] = [
        Appointment(
            id: "1",
            patientId: "MRN-847261",
            patientName: "Sarah Chen",
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
            patientId: "MRN-592847",
            patientName: "Michael Rodriguez",
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
            patientId: "MRN-318529",
            patientName: "Emily Johnson",
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
            patientId: "MRN-847261",
            patientName: "Sarah Chen",
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

extension Patient {
    static var mock: Patient {
        let json = """
        {
            "ptnum": "MRN-847261",
            "label": 0,
            "first_name": "Sarah",
            "last_name": "Chen"
        }
        """
        return try! JSONDecoder().decode(Patient.self, from: json.data(using: .utf8)!)
    }
}
