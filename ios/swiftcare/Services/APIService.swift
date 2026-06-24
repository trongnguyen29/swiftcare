import Foundation

class APIService {
    static let shared = APIService()

    private let supabaseUrl = "https://zbnvigxkforwbmphghpg.supabase.co"
    private let supabaseKey = "sb_publishable_U3hegesGlIhrENKOreNbuQ_WIKcYrOL"
    private let workerUrl  = "https://swiftcare.tnn-040.workers.dev"

    // MARK: - Helpers

    private func makeRequest(_ url: URL, method: String = "GET") -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        return req
    }

    private func supabaseURL(_ table: String, params: [URLQueryItem] = []) -> URL {
        var c = URLComponents(string: "\(supabaseUrl)/rest/v1/\(table)")!
        if !params.isEmpty { c.queryItems = params }
        return c.url!
    }

    // MARK: - Patients

    func queryPatients(query: String = "", filter: String = "all") async throws -> [Patient] {
        let url = supabaseURL("fhir_patient", params: [
            URLQueryItem(name: "select", value: "fhir_id,resource"),
            URLQueryItem(name: "limit",  value: "150"),
        ])
        let (data, response) = try await URLSession.shared.data(for: makeRequest(url))
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let rows = try JSONDecoder().decode([FHIRPatientRow].self, from: data)
        var patients = rows.map { Patient(fromFHIR: $0) }

        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !q.isEmpty {
            patients = patients.filter {
                $0.displayName.lowercased().contains(q) || $0.ptnum.lowercased().contains(q)
            }
        }
        return patients.sorted { $0.displayName < $1.displayName }
    }

    func getPatientDetail(fhirId: String) async throws -> Patient {
        async let patientTask  = fetchPatientRow(fhirId: fhirId)
        async let vitalsTask   = fetchObservations(patientId: fhirId, view: "patient_latest_vitals")
        async let labsTask     = fetchObservations(patientId: fhirId, view: "patient_latest_labs")

        let (row, vitals, labs) = try await (patientTask, vitalsTask, labsTask)
        return Patient(fromFHIR: row, vitals: vitals, labs: labs)
    }

    private func fetchPatientRow(fhirId: String) async throws -> FHIRPatientRow {
        let url = supabaseURL("fhir_patient", params: [
            URLQueryItem(name: "select",  value: "fhir_id,resource"),
            URLQueryItem(name: "fhir_id", value: "eq.\(fhirId)"),
            URLQueryItem(name: "limit",   value: "1"),
        ])
        let (data, response) = try await URLSession.shared.data(for: makeRequest(url))
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let rows = try JSONDecoder().decode([FHIRPatientRow].self, from: data)
        guard let row = rows.first else { throw URLError(.cannotParseResponse) }
        return row
    }

    private func fetchObservations(patientId: String, view: String) async throws -> [LatestObservation] {
        let url = supabaseURL(view, params: [
            URLQueryItem(name: "patient_id", value: "eq.\(patientId)"),
        ])
        let (data, response) = try await URLSession.shared.data(for: makeRequest(url))
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            return []
        }
        return (try? JSONDecoder().decode([LatestObservation].self, from: data)) ?? []
    }

    // MARK: - AI Summary

    struct PatientSummaryRecord: Codable {
        let ai_summary: String?
        let ai_summary_hash: String?
        let ai_summary_at: String?
    }

    func getPatientSummary(patientId: String) async throws -> PatientSummaryRecord? {
        let url = supabaseURL("patient_ai_summary", params: [
            URLQueryItem(name: "select",     value: "ai_summary,ai_summary_hash,ai_summary_at"),
            URLQueryItem(name: "patient_id", value: "eq.\(patientId)"),
            URLQueryItem(name: "limit",      value: "1"),
        ])
        let (data, response) = try await URLSession.shared.data(for: makeRequest(url))
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            return nil
        }
        let records = try JSONDecoder().decode([PatientSummaryRecord].self, from: data)
        return records.first { $0.ai_summary != nil }
    }

    func savePatientSummary(patientId: String, summary: String, hash: String) async throws {
        let url = URL(string: "\(supabaseUrl)/rest/v1/patient_ai_summary")!
        var req = makeRequest(url, method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "patient_id":       patientId,
            "ai_summary":       summary,
            "ai_summary_hash":  hash,
            "ai_summary_at":    ISO8601DateFormatter().string(from: Date()),
        ])
        let (_, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    // MARK: - Appointments

    private func makeAppointmentDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let str = try container.decode(String.self)
            let withFrac = ISO8601DateFormatter()
            withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withFrac.date(from: str) { return date }
            let basic = ISO8601DateFormatter()
            basic.formatOptions = [.withInternetDateTime]
            if let date = basic.date(from: str) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date: \(str)")
        }
        return decoder
    }

    func getAppointments(patientId: String) async throws -> [Appointment] {
        let url = supabaseURL("fhir_appointment", params: [
            URLQueryItem(name: "select",     value: "fhir_id,patient_id,resource"),
            URLQueryItem(name: "patient_id", value: "eq.\(patientId)"),
            URLQueryItem(name: "order",      value: "resource->start.asc"),
        ])
        let (data, response) = try await URLSession.shared.data(for: makeRequest(url))
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let rows = try makeAppointmentDecoder().decode([FHIRAppointmentRow].self, from: data)
        return rows.compactMap { Appointment.fromFHIR($0) }
    }

    func getAllAppointments() async throws -> [Appointment] {
        let url = supabaseURL("fhir_appointment", params: [
            URLQueryItem(name: "select", value: "fhir_id,patient_id,resource"),
            URLQueryItem(name: "order",  value: "resource->start.asc"),
        ])
        let (data, response) = try await URLSession.shared.data(for: makeRequest(url))
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let rows = try makeAppointmentDecoder().decode([FHIRAppointmentRow].self, from: data)
        return rows.compactMap { Appointment.fromFHIR($0) }
    }

    func createAppointment(_ resource: [String: Any], patientId: String) async throws -> Appointment {
        let url = URL(string: "\(supabaseUrl)/rest/v1/fhir_appointment")!
        var req = makeRequest(url, method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("return=representation", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "patient_id": patientId,
            "resource":   resource,
        ])
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let rows = try makeAppointmentDecoder().decode([FHIRAppointmentRow].self, from: data)
        guard let appt = rows.first.flatMap({ Appointment.fromFHIR($0) }) else {
            throw URLError(.cannotParseResponse)
        }
        return appt
    }

    func updateAppointmentStatus(id: String, status: AppointmentStatus) async throws {
        var c = URLComponents(string: "\(supabaseUrl)/rest/v1/fhir_appointment")!
        c.queryItems = [URLQueryItem(name: "fhir_id", value: "eq.\(id)")]
        var req = makeRequest(c.url!, method: "PATCH")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Patch the status inside the jsonb resource column using jsonb_set
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "resource": ["status": status.rawValue.lowercased()]
        ])
        let (_, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }

    // MARK: - Cloudflare Workers

    struct ChatRequest: Codable {
        let messages: [[String: String]]
        let patientContext: String
        let maxTokens: Int
    }

    struct ChatResponse: Codable {
        let reply: String?
    }

    func chatWithPatientContext(messages: [[String: String]], patientContext: String) async throws -> String {
        let url = URL(string: "\(workerUrl)/api/patient-chat")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(ChatRequest(messages: messages, patientContext: patientContext, maxTokens: 1000))
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return (try JSONDecoder().decode(ChatResponse.self, from: data)).reply ?? ""
    }

    struct TranscribeRequest: Codable {
        let audioB64: String
        let mimeType: String
        let patientId: String
        let language: String
    }

    func transcribeAudio(audioB64: String, mimeType: String, patientId: String, language: String = "en") async throws -> String {
        let url = URL(string: "\(workerUrl)/api/transcribe")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(TranscribeRequest(audioB64: audioB64, mimeType: mimeType, patientId: patientId, language: language))
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let text = json["text"] as? String { return text }
            if let text = json["transcript"] as? String { return text }
        }
        return ""
    }

    func summarizeTranscript(transcript: String, patientContext: String, templatePrompt: String? = nil) async throws -> String {
        let url = URL(string: "\(workerUrl)/api/soap-note")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var body: [String: Any] = ["transcript": transcript, "patientContext": patientContext]
        if let tp = templatePrompt, !tp.isEmpty { body["templatePrompt"] = tp }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let note = json["note"] as? String { return note }
        return ""
    }
}
