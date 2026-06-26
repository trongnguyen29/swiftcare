import Foundation
import Combine

struct ReminderLogEntry: Identifiable {
    let id = UUID()
    let appointmentId: String
    let patientName: String
    let phoneNumber: String
    let sentAt: Date
    let messageSid: String?
}

enum AppointmentStoreError: LocalizedError {
    case unknownPatient
    case missingPhoneNumber(patientName: String)

    var errorDescription: String? {
        switch self {
        case .unknownPatient:
            return "The appointment patient could not be found."
        case .missingPhoneNumber(let patientName):
            return "Add a phone number for \(patientName) before sending a reminder."
        }
    }
}

@MainActor
final class AppointmentStore: ObservableObject {
    static let shared = AppointmentStore()

    @Published private(set) var appointments: [Appointment]
    @Published private(set) var reminderLog: [ReminderLogEntry]
    @Published private(set) var patientsByAppointmentID: [String: MockAppointmentPatient] = [:]
    @Published private(set) var isLoading = false

    private init() {
        // Start empty; the real schedule is loaded from Supabase via loadAppointments().
        appointments = []
        reminderLog = []
    }

    func schedule(
        patient: MockAppointmentPatient,
        date: Date,
        durationMinutes: Int,
        type: AppointmentType,
        reason: String,
        doctorName: String
    ) async throws -> Appointment {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let endDate = date.addingTimeInterval(TimeInterval(durationMinutes * 60))

        let resource: [String: Any] = [
            "id": UUID().uuidString,
            "resourceType": "Appointment",
            "status": "booked",
            "serviceType": [["coding": [["display": type.rawValue]]]],
            "start": iso.string(from: date),
            "end": iso.string(from: endDate),
            "minutesDuration": durationMinutes,
            "participant": [
                ["actor": ["reference": "Patient/\(patient.mrn)", "display": patient.displayName], "status": "accepted"],
                ["actor": ["reference": "Practitioner/unknown", "display": doctorName], "status": "accepted"]
            ],
            "reasonCode": [["text": reason]]
        ]

        let appointment = try await APIService.shared.createAppointment(resource, patientId: patient.mrn)

        appointments.append(appointment)
        patientsByAppointmentID[appointment.id] = patient
        appointments.sort { $0.date < $1.date }
        return appointment
    }

    func loadAppointments() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            appointments = try await APIService.shared.getAllAppointments()
            reminderLog = appointments.compactMap(reminderLogEntry)
        } catch {
            // Keep the current schedule visible if the network is temporarily unavailable.
        }
    }

    func delete(appointmentId: String) async throws {
        try await APIService.shared.deleteAppointment(id: appointmentId)
        appointments.removeAll { $0.id == appointmentId }
    }

    func updateStatus(appointmentId: String, status: AppointmentStatus) async throws {
        try await APIService.shared.updateAppointmentStatus(id: appointmentId, status: status)
        if let index = appointments.firstIndex(where: { $0.id == appointmentId }) {
            appointments[index].status = status
        }
    }

    func patient(for appointment: Appointment) -> MockAppointmentPatient? {
        patientsByAppointmentID[appointment.id] ?? appointment.mockPatient
    }

    func sendReminder(for appointment: Appointment) async throws {
        guard let index = appointments.firstIndex(where: { $0.id == appointment.id }),
              let patient = patient(for: appointments[index]) else {
            throw AppointmentStoreError.unknownPatient
        }

        guard !appointments[index].isReminderSent else { return }

        let currentAppointment = appointments[index]
        let deliveryPhone = PatientContactStore.shared.phone(forPtnum: patient.mrn, fallback: currentAppointment.phoneNumber) ?? currentAppointment.phoneNumber
        guard !deliveryPhone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw AppointmentStoreError.missingPhoneNumber(patientName: patient.displayName)
        }

        let messageSid = try await APIService.shared.sendAppointmentReminder(
            to: deliveryPhone,
            patientName: patient.displayName,
            appointmentDate: currentAppointment.date,
            doctorName: currentAppointment.doctorName
        )
        try await APIService.shared.markReminderSent(forAppointmentID: currentAppointment.id)

        appointments[index].isReminderSent = true
        reminderLog.insert(
            ReminderLogEntry(
                appointmentId: currentAppointment.id,
                patientName: patient.displayName,
                phoneNumber: deliveryPhone,
                sentAt: Date(),
                messageSid: messageSid
            ),
            at: 0
        )
    }

    private func reminderLogEntry(for appointment: Appointment) -> ReminderLogEntry? {
        guard appointment.isReminderSent else { return nil }
        let patient = patient(for: appointment)
        return ReminderLogEntry(
            appointmentId: appointment.id,
            patientName: patient?.displayName ?? appointment.patientName,
            phoneNumber: appointment.phoneNumber,
            sentAt: appointment.date,
            messageSid: nil
        )
    }
}
