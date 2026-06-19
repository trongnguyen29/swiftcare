import Foundation

class APIService {
    static let shared = APIService()

    private let supabaseUrl = "https://ujqrxhhshxgqqjkblorh.supabase.co"
    private let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcXJ4aGhzaHhncXFqa2Jsb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDU3NjAsImV4cCI6MjA5NTM4MTc2MH0.t4CgUYE5oPLhocC2YtRF-WW6tMWu2Cvd0mYB_A1jWhk"
    private let workerUrl = "https://swiftcare.tnn-040.workers.dev"

    private let patientTable      = "patient_summary"
    private let summaryTable      = "patient_ai_summary"
    private let appointmentsTable = "appointments"

    private let cols = "ptnum,label,scc,first_name,last_name,age,administrative_sex,race,ethnicity,state,systolic_bp,diastolic_bp,heart_rate,bmi,total_cholesterol,ldl,hdl,triglycerides,hba1c,glucose,creatinine,egfr,hemoglobin,wbc,platelets,problems"

    private static let maxRetries = 5

    // MARK: - Supabase

    func queryPatients(query: String = "", filter: String = "all") async throws -> [Patient] {
        var urlComponents = URLComponents(string: "\(supabaseUrl)/rest/v1/\(patientTable)")!
        var queryItems = [
            URLQueryItem(name: "select", value: cols),
            URLQueryItem(name: "order", value: "last_name.asc,first_name.asc"),
            URLQueryItem(name: "limit", value: "150"),
        ]
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedQuery.isEmpty {
            let safeQuery = trimmedQuery
                .replacingOccurrences(of: ",", with: "")
                .replacingOccurrences(of: "(", with: "")
                .replacingOccurrences(of: ")", with: "")
            queryItems.append(URLQueryItem(
                name: "or",
                value: "(ptnum.ilike.*\(safeQuery)*,first_name.ilike.*\(safeQuery)*,last_name.ilike.*\(safeQuery)*)"
            ))
        }
        if filter == "positive" {
            queryItems.append(URLQueryItem(name: "label", value: "eq.1"))
        } else if filter == "control" {
            queryItems.append(URLQueryItem(name: "label", value: "eq.0"))
        }
        urlComponents.queryItems = queryItems

        var request = URLRequest(url: urlComponents.url!)
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode([Patient].self, from: data)
    }

    struct PatientSummaryRecord: Codable {
        let ai_summary: String?
        let ai_summary_hash: String?
        let ai_summary_at: String?
    }

    func getPatientSummary(ptnum: String) async throws -> PatientSummaryRecord? {
        var urlComponents = URLComponents(string: "\(supabaseUrl)/rest/v1/\(summaryTable)")!
        urlComponents.queryItems = [
            URLQueryItem(name: "select", value: "ai_summary,ai_summary_hash,ai_summary_at"),
            URLQueryItem(name: "ptnum", value: "eq.\(ptnum)"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        var request = URLRequest(url: urlComponents.url!)
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            return nil
        }
        let records = try JSONDecoder().decode([PatientSummaryRecord].self, from: data)
        return records.first { $0.ai_summary != nil }
    }

    func savePatientSummary(ptnum: String, summary: String, hash: String) async throws {
        let url = URL(string: "\(supabaseUrl)/rest/v1/\(summaryTable)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        let body: [String: Any] = [
            "ptnum": ptnum,
            "ai_summary": summary,
            "ai_summary_hash": hash,
            "ai_summary_at": ISO8601DateFormatter().string(from: Date()),
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    // MARK: - Appointments

    struct NewAppointment: Encodable {
        let ptnum: String
        let patient_name: String
        let appointment_date: String
        let duration_minutes: Int
        let appointment_type: String
        let status: String
        let reason: String
        let doctor_name: String
        let phone_number: String
        let is_reminder_sent: Bool
    }

    func getAllAppointments() async throws -> [Appointment] {
        var urlComponents = URLComponents(string: "\(supabaseUrl)/rest/v1/\(appointmentsTable)")!
        urlComponents.queryItems = [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "order", value: "appointment_date.asc"),
        ]
        let (data, response) = try await URLSession.shared.data(for: appointmentRequest(urlComponents))
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw appointmentError(data: data, response: response, action: "load appointments")
        }
        return try appointmentDecoder().decode([Appointment].self, from: data)
    }

    func getAppointments(ptnum: String) async throws -> [Appointment] {
        var urlComponents = URLComponents(string: "\(supabaseUrl)/rest/v1/\(appointmentsTable)")!
        urlComponents.queryItems = [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "ptnum", value: "eq.\(ptnum)"),
            URLQueryItem(name: "order", value: "appointment_date.asc"),
        ]
        let (data, response) = try await URLSession.shared.data(for: appointmentRequest(urlComponents))
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw appointmentError(data: data, response: response, action: "load appointments")
        }
        return try appointmentDecoder().decode([Appointment].self, from: data)
    }

    func createAppointment(_ appointment: NewAppointment) async throws -> Appointment {
        let url = URL(string: "\(supabaseUrl)/rest/v1/\(appointmentsTable)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONEncoder().encode(appointment)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw appointmentError(data: data, response: response, action: "save the appointment")
        }
        let appointments = try appointmentDecoder().decode([Appointment].self, from: data)
        guard let created = appointments.first else { throw URLError(.cannotParseResponse) }
        return created
    }

    func updateAppointmentStatus(id: String, status: AppointmentStatus) async throws {
        var urlComponents = URLComponents(string: "\(supabaseUrl)/rest/v1/\(appointmentsTable)")!
        urlComponents.queryItems = [URLQueryItem(name: "id", value: "eq.\(id)")]
        var request = appointmentRequest(urlComponents, method: "PATCH")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["status": status.rawValue])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw appointmentError(data: data, response: response, action: "update appointment status")
        }
    }

    func markReminderSent(forAppointmentID id: String) async throws {
        var urlComponents = URLComponents(string: "\(supabaseUrl)/rest/v1/\(appointmentsTable)")!
        urlComponents.queryItems = [URLQueryItem(name: "id", value: "eq.\(id)")]
        var request = appointmentRequest(urlComponents, method: "PATCH")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["is_reminder_sent": true])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw appointmentError(data: data, response: response, action: "update the reminder")
        }
    }

    private func appointmentRequest(_ urlComponents: URLComponents, method: String = "GET") -> URLRequest {
        var request = URLRequest(url: urlComponents.url!)
        request.httpMethod = method
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return request
    }

    private func appointmentDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            let withFractional = ISO8601DateFormatter()
            withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withFractional.date(from: dateString) { return date }
            let basic = ISO8601DateFormatter()
            basic.formatOptions = [.withInternetDateTime]
            if let date = basic.date(from: dateString) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date: \(dateString)")
        }
        return decoder
    }

    private func appointmentError(data: Data, response: URLResponse, action: String) -> Error {
        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
        let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        let detail = (payload?["message"] as? String) ?? (payload?["error"] as? String)
        let message = detail ?? "Could not \(action) (HTTP \(statusCode))."
        return NSError(domain: "Appointments", code: statusCode, userInfo: [NSLocalizedDescriptionKey: message])
    }

    // MARK: - Cloudflare Worker / Chat

    struct ChatRequest: Codable {
        let messages: [[String: String]]
        let patientContext: String
        let maxTokens: Int
    }

    func chatWithPatientContext(messages: [[String: String]], patientContext: String) async throws -> String {
        let url = URL(string: "\(workerUrl)/api/patient-chat")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(ChatRequest(messages: messages, patientContext: patientContext, maxTokens: 1000))
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        struct ChatResponse: Codable { let reply: String? }
        return (try JSONDecoder().decode(ChatResponse.self, from: data)).reply ?? ""
    }

    struct AppointmentReminderRequest: Encodable {
        let phoneNumber: String
        let patientName: String
        let appointmentTime: String
        let doctorName: String
    }

    struct AppointmentReminderResponse: Decodable {
        let success: Bool?
        let messageSid: String?
        let error: String?
    }

    func sendAppointmentReminder(
        to phoneNumber: String,
        patientName: String,
        appointmentDate: Date,
        doctorName: String
    ) async throws -> String? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "EEEE, MMMM d 'at' h:mm a"

        let url = URL(string: "\(workerUrl)/api/send-appointment-reminder")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            AppointmentReminderRequest(
                phoneNumber: phoneNumber,
                patientName: patientName,
                appointmentTime: formatter.string(from: appointmentDate),
                doctorName: doctorName
            )
        )

        let (data, response) = try await URLSession.shared.data(for: request)
        let payload = try? JSONDecoder().decode(AppointmentReminderResponse.self, from: data)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode), payload?.success == true else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            let message = payload?.error ?? reminderServiceError(for: statusCode)
            throw NSError(domain: "AppointmentReminder", code: statusCode, userInfo: [NSLocalizedDescriptionKey: message])
        }
        return payload?.messageSid
    }

    private func reminderServiceError(for statusCode: Int) -> String {
        switch statusCode {
        case 404:         return "The reminders service has not been deployed yet."
        case 401, 403:    return "The reminders service is not authorized to send messages."
        case 500...599:   return "The reminders service is unavailable right now."
        default:          return "The reminder could not be sent."
        }
    }

    // MARK: - Transcription

    struct TranscribeRequest: Codable {
        let audioB64: String
        let mimeType: String
        let patientId: String
        let language: String
    }

    func transcribeAudio(
        audioB64: String,
        mimeType: String,
        patientId: String,
        language: String = "en"
    ) async throws -> String {
        let url = URL(string: "\(workerUrl)/api/transcribe")!
        let body = TranscribeRequest(audioB64: audioB64, mimeType: mimeType, patientId: patientId, language: language)
        let bodyData = try JSONEncoder().encode(body)

        var lastError: Error = URLError(.unknown)
        for attempt in 0 ..< Self.maxRetries {
            if attempt > 0 {
                let delayNs = UInt64(min(pow(2.0, Double(attempt)), 30.0) * 1_000_000_000)
                try await Task.sleep(nanoseconds: delayNs)
            }
            do {
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = bodyData
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                    throw URLError(.badServerResponse)
                }
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    if let text = json["text"] as? String { return text }
                    if let transcript = json["transcript"] as? String { return transcript }
                    if let err = json["error"] as? String { throw NSError(domain: "transcribe", code: 0, userInfo: [NSLocalizedDescriptionKey: err]) }
                }
                return ""
            } catch {
                lastError = error
            }
        }
        throw lastError
    }

    func transcribeChunked(
        wavData: Data,
        durationSeconds: Double,
        patientId: String,
        language: String = "en"
    ) async throws -> String {
        guard let chunks = AudioChunker.chunk(wavData: wavData, durationSeconds: durationSeconds) else {
            return try await transcribeAudio(
                audioB64: wavData.base64EncodedString(),
                mimeType: "audio/wav",
                patientId: patientId,
                language: language
            )
        }

        var results = [String](repeating: "", count: chunks.count)
        try await withThrowingTaskGroup(of: (Int, String).self) { group in
            var inFlight = 0
            var nextChunk = 0

            func launchNext() {
                guard nextChunk < chunks.count else { return }
                let chunk = chunks[nextChunk]
                let idx = nextChunk
                nextChunk += 1
                inFlight += 1
                group.addTask {
                    let text = try await self.transcribeAudio(
                        audioB64: chunk.data.base64EncodedString(),
                        mimeType: "audio/wav",
                        patientId: patientId,
                        language: language
                    )
                    return (idx, text)
                }
            }

            while inFlight < 4 && nextChunk < chunks.count { launchNext() }
            for try await (idx, text) in group {
                results[idx] = text
                inFlight -= 1
                launchNext()
            }
        }

        return TranscriptMerger.merge(results)
    }

    // MARK: - SOAP note

    func summarizeTranscript(transcript: String, patientContext: String, templatePrompt: String? = nil) async throws -> String {
        let url = URL(string: "\(workerUrl)/api/soap-note")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = ["transcript": transcript, "patientContext": patientContext]
        if let tp = templatePrompt, !tp.isEmpty { body["templatePrompt"] = tp }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let note = json["note"] as? String { return note }
        return ""
    }

    func pushNoteToEHR(
        noteText: String,
        patientId: String,
        patientName: String? = nil,
        templateName: String? = nil
    ) async throws -> String {
        let url = URL(string: "\(workerUrl)/api/push-note-to-ehr")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = [
            "noteText":  noteText,
            "patientId": patientId,
            "date":      ISO8601DateFormatter().string(from: Date()),
        ]
        if let n = patientName  { body["patientName"]  = n }
        if let t = templateName { body["templateName"] = t }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let err = json["error"] as? String { throw NSError(domain: "EHR", code: 0, userInfo: [NSLocalizedDescriptionKey: err]) }
            throw URLError(.badServerResponse)
        }
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let id = json["resourceId"] as? String { return "Posted — ID: \(id)" }
            return "Posted to EHR"
        }
        return "Posted to EHR"
    }
}
