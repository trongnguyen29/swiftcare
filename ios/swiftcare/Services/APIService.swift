import Foundation

class APIService {
    static let shared = APIService()
    
    private let supabaseUrl = "https://ujqrxhhshxgqqjkblorh.supabase.co"
    private let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcXJ4aGhzaHhncXFqa2Jsb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDU3NjAsImV4cCI6MjA5NTM4MTc2MH0.t4CgUYE5oPLhocC2YtRF-WW6tMWu2Cvd0mYB_A1jWhk"
    private let workerUrl = "https://swiftcare.tnn-040.workers.dev"
    
    private let patientTable       = "patient_summary"
    private let summaryTable       = "patient_ai_summary"
    private let appointmentsTable  = "appointments"
    private let cols = "ptnum,label,scc,first_name,last_name,age,administrative_sex,race,ethnicity,state,systolic_bp,diastolic_bp,heart_rate,bmi,total_cholesterol,ldl,hdl,triglycerides,hba1c,glucose,creatinine,egfr,hemoglobin,wbc,platelets,problems"
    
    // MARK: - Supabase
    
    func queryPatients(query: String = "", filter: String = "all") async throws -> [Patient] {
        var urlComponents = URLComponents(string: "\(supabaseUrl)/rest/v1/\(patientTable)")!
        var queryItems = [
            URLQueryItem(name: "select", value: cols),
            URLQueryItem(name: "order", value: "last_name.asc,first_name.asc"),
            URLQueryItem(name: "limit", value: "150")
        ]
        
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedQuery.isEmpty {
            queryItems.append(URLQueryItem(name: "ptnum", value: "ilike.*\(trimmedQuery)*"))
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
        
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        
        let patients = try JSONDecoder().decode([Patient].self, from: data)
        return patients
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
            URLQueryItem(name: "limit", value: "1")
        ]
        
        var request = URLRequest(url: urlComponents.url!)
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
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
            "ai_summary_at": ISO8601DateFormatter().string(from: Date())
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
    
    // MARK: - Appointments

    private func makeAppointmentDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let str = try container.decode(String.self)
            let withFractional = ISO8601DateFormatter()
            withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withFractional.date(from: str) { return date }
            let basic = ISO8601DateFormatter()
            basic.formatOptions = [.withInternetDateTime]
            if let date = basic.date(from: str) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date: \(str)")
        }
        return decoder
    }

    private func appointmentRequest(_ urlComponents: URLComponents, method: String = "GET") -> URLRequest {
        var request = URLRequest(url: urlComponents.url!)
        request.httpMethod = method
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return request
    }

    func getAppointments(ptnum: String) async throws -> [Appointment] {
        var urlComponents = URLComponents(string: "\(supabaseUrl)/rest/v1/\(appointmentsTable)")!
        urlComponents.queryItems = [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "ptnum", value: "eq.\(ptnum)"),
            URLQueryItem(name: "order", value: "appointment_date.asc")
        ]
        let (data, response) = try await URLSession.shared.data(for: appointmentRequest(urlComponents))
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try makeAppointmentDecoder().decode([Appointment].self, from: data)
    }

    func getAllAppointments() async throws -> [Appointment] {
        var urlComponents = URLComponents(string: "\(supabaseUrl)/rest/v1/\(appointmentsTable)")!
        urlComponents.queryItems = [
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "order", value: "appointment_date.asc")
        ]
        let (data, response) = try await URLSession.shared.data(for: appointmentRequest(urlComponents))
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try makeAppointmentDecoder().decode([Appointment].self, from: data)
    }

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

    func createAppointment(_ appt: NewAppointment) async throws -> Appointment {
        let url = URL(string: "\(supabaseUrl)/rest/v1/\(appointmentsTable)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONEncoder().encode(appt)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let created = try makeAppointmentDecoder().decode([Appointment].self, from: data)
        guard let first = created.first else { throw URLError(.cannotParseResponse) }
        return first
    }

    func updateAppointmentStatus(id: String, status: AppointmentStatus) async throws {
        var urlComponents = URLComponents(string: "\(supabaseUrl)/rest/v1/\(appointmentsTable)")!
        urlComponents.queryItems = [URLQueryItem(name: "id", value: "eq.\(id)")]
        var request = URLRequest(url: urlComponents.url!)
        request.httpMethod = "PATCH"
        request.setValue(supabaseKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["status": status.rawValue])
        let (_, response) = try await URLSession.shared.data(for: request)
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
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ChatRequest(messages: messages, patientContext: patientContext, maxTokens: 1000)
        request.httpBody = try JSONEncoder().encode(body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        
        let chatResponse = try JSONDecoder().decode(ChatResponse.self, from: data)
        return chatResponse.reply ?? ""
    }
    
    struct TranscribeRequest: Codable {
        let audioB64: String
        let mimeType: String
        let patientId: String
        let language: String
    }
    
    func transcribeAudio(audioB64: String, mimeType: String, patientId: String, language: String = "en") async throws -> String {
        let url = URL(string: "\(workerUrl)/api/transcribe")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = TranscribeRequest(audioB64: audioB64, mimeType: mimeType, patientId: patientId, language: language)
        request.httpBody = try JSONEncoder().encode(body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let text = json["text"] as? String {
                return text
            } else if let transcript = json["transcript"] as? String {
                return transcript
            }
        }
        return ""
    }
    
    func summarizeTranscript(transcript: String, patientContext: String, templatePrompt: String? = nil) async throws -> String {
        let url = URL(string: "\(workerUrl)/api/soap-note")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = ["transcript": transcript, "patientContext": patientContext]
        if let tp = templatePrompt, !tp.isEmpty {
            body["templatePrompt"] = tp
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any], let note = json["note"] as? String {
            return note
        }
        return ""
    }
}
