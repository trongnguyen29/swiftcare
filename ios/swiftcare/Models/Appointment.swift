import Foundation

enum AppointmentType: String, Codable, Hashable {
    case inPerson = "In-Person"
    case telehealth = "Telehealth"
    case phone = "Phone"
    case newPatient = "New Patient"
    case followUp = "Follow Up"
    case physicalExam = "Physical Exam"
    
    var icon: String {
        switch self {
        case .inPerson: return "mappin.and.ellipse"
        case .telehealth: return "video"
        case .phone: return "phone"
        case .newPatient: return "person.badge.plus"
        case .followUp: return "arrow.clockwise"
        case .physicalExam: return "stethoscope"
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
    var isReminderSent: Bool
    
    var endTime: Date {
        return date.addingTimeInterval(TimeInterval(durationMinutes * 60))
    }
}

extension Appointment {
    enum CodingKeys: String, CodingKey {
        case id
        case patientId = "ptnum"
        case patientName = "patient_name"
        case date = "appointment_date"
        case durationMinutes = "duration_minutes"
        case type = "appointment_type"
        case status
        case reason
        case doctorName = "doctor_name"
        case phoneNumber = "phone_number"
        case isReminderSent = "is_reminder_sent"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        patientId = try container.decode(String.self, forKey: .patientId)
        patientName = try container.decodeIfPresent(String.self, forKey: .patientName) ?? patientId
        date = try container.decode(Date.self, forKey: .date)
        durationMinutes = try container.decodeIfPresent(Int.self, forKey: .durationMinutes) ?? 30
        // Decode enums leniently: an unrecognized value from the DB falls back to a
        // sane default instead of throwing and breaking the whole list load.
        let typeRaw = try container.decodeIfPresent(String.self, forKey: .type)
        type = typeRaw.flatMap(AppointmentType.init(rawValue:)) ?? .inPerson
        let statusRaw = try container.decodeIfPresent(String.self, forKey: .status)
        status = statusRaw.flatMap(AppointmentStatus.init(rawValue:)) ?? .scheduled
        reason = try container.decodeIfPresent(String.self, forKey: .reason) ?? ""
        doctorName = try container.decodeIfPresent(String.self, forKey: .doctorName) ?? ""
        phoneNumber = try container.decodeIfPresent(String.self, forKey: .phoneNumber) ?? ""
        isReminderSent = try container.decodeIfPresent(Bool.self, forKey: .isReminderSent) ?? false
    }
}

// MARK: - Mock Data

struct MockAppointmentPatient: Identifiable, Hashable {
    let id: String
    let displayName: String
    let mrn: String
    let phoneNumber: String
    let sourcePatient: Patient?

    init(
        id: String,
        displayName: String,
        mrn: String,
        phoneNumber: String,
        sourcePatient: Patient? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.mrn = mrn
        self.phoneNumber = phoneNumber
        self.sourcePatient = sourcePatient
    }
}

extension MockAppointmentPatient {
    var profilePatient: Patient {
        if let sourcePatient { return sourcePatient }

        let name = displayName.split(separator: " ", maxSplits: 1).map(String.init)
        let payload: [String: Any] = [
            "ptnum": mrn,
            "label": 0,
            "first_name": name.first ?? displayName,
            "last_name": name.dropFirst().first ?? "",
            "phone": phoneNumber
        ]
        let data = try! JSONSerialization.data(withJSONObject: payload)
        return try! JSONDecoder().decode(Patient.self, from: data)
    }
}

extension Appointment {
    static let mockPatients: [MockAppointmentPatient] = [
        MockAppointmentPatient(id: "patient-0", displayName: "Sarah Chen", mrn: "MRN-847261", phoneNumber: "+1 (415) 555-0182"),
        MockAppointmentPatient(id: "patient-1", displayName: "Michael Rodriguez", mrn: "MRN-592847", phoneNumber: "+1 (628) 555-0347"),
        MockAppointmentPatient(id: "patient-2", displayName: "Emily Johnson", mrn: "MRN-318529", phoneNumber: "+1 (510) 555-0094")
    ]

    static let mocks: [Appointment] = [
        Appointment(
            id: "1",
            patientId: "patient-0", // Assuming Sarah Chen
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
            patientId: "patient-1", // Michael Rodriguez
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
            patientId: "patient-2", // Emily Johnson
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
            patientId: "patient-0", // Sarah Chen
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

    var mockPatient: MockAppointmentPatient? {
        Self.mockPatients.first { $0.id == patientId || $0.mrn == patientId }
            ?? MockAppointmentPatient(
                id: patientId,
                displayName: patientName,
                mrn: patientId,
                phoneNumber: phoneNumber
            )
    }
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
