import Foundation

struct Visit: Codable, Identifiable {
    let id: String
    var patientPtnum: String?
    var transcript: String
    var note: String
    var templateName: String?
    var language: String?
    var audioPath: String?
    var status: String    // "processing" | "complete" | "failed"
    let createdAt: String
    var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case patientPtnum  = "patient_ptnum"
        case transcript
        case note
        case templateName  = "template_name"
        case language
        case audioPath     = "audio_path"
        case status
        case createdAt     = "created_at"
        case updatedAt     = "updated_at"
    }
}

/// Parses & formats Supabase timestamptz strings (which include fractional
/// seconds and a timezone) into a friendly display string.
enum VisitDate {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let noFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static func parse(_ s: String) -> Date? {
        if let d = withFraction.date(from: s) { return d }
        if let d = noFraction.date(from: s) { return d }
        // Handle microsecond precision (6 digits) by stripping fractional seconds.
        let stripped = s.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression)
        return noFraction.date(from: stripped)
    }

    static func display(_ s: String) -> String {
        guard let d = parse(s) else { return s }
        return d.formatted(date: .abbreviated, time: .shortened)
    }
}

class VisitsService {
    static let shared = VisitsService()
    private init() {}

    private var workerUrl: String { APIService.shared.workerUrl }

    /// Surfaces the Worker/Supabase error body so failures are diagnosable in the UI.
    private static func serverError(_ data: Data, _ response: URLResponse) -> Error {
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        var message = "Server error (\(code))"
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let err = json["error"] as? String, !err.isEmpty {
            message = err
        } else if let text = String(data: data, encoding: .utf8), !text.isEmpty {
            message = text
        }
        return NSError(domain: "VisitsService", code: code,
                       userInfo: [NSLocalizedDescriptionKey: message])
    }

    // MARK: - Create / update

    func saveVisit(
        id: String? = nil,
        patientPtnum: String? = nil,
        transcript: String,
        note: String,
        templateName: String? = nil,
        language: String = "en",
        audioPath: String? = nil,
        status: String = "complete"
    ) async throws -> Visit {
        var body: [String: Any] = [
            "transcript": transcript,
            "note": note,
            "language": language,
            "status": status,
        ]
        if let id          { body["id"]           = id }
        if let patientPtnum { body["patient_ptnum"] = patientPtnum }
        if let templateName { body["template_name"] = templateName }
        if let audioPath    { body["audio_path"]    = audioPath }

        let url = URL(string: "\(workerUrl)/api/visits")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw Self.serverError(data, response)
        }
        return try JSONDecoder().decode(Visit.self, from: data)
    }

    func updateVisit(id: String, fields: [String: Any]) async throws -> Visit {
        let url = URL(string: "\(workerUrl)/api/visits/\(id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: fields)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw Self.serverError(data, response)
        }
        return try JSONDecoder().decode(Visit.self, from: data)
    }

    // MARK: - Fetch

    func fetchVisits(patientPtnum: String) async throws -> [Visit] {
        let url = URL(string: "\(workerUrl)/api/visits?ptnum=\(patientPtnum)")!
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw Self.serverError(data, response)
        }
        return try JSONDecoder().decode([Visit].self, from: data)
    }

    func fetchUnassigned() async throws -> [Visit] {
        let url = URL(string: "\(workerUrl)/api/visits?unassigned=true")!
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw Self.serverError(data, response)
        }
        return try JSONDecoder().decode([Visit].self, from: data)
    }

    // MARK: - Audio upload

    func uploadAudio(visitId: String, wavData: Data, mimeType: String = "audio/wav") async throws -> String {
        let body: [String: Any] = [
            "audioB64": wavData.base64EncodedString(),
            "mimeType": mimeType,
            "visitId": visitId,
        ]
        let url = URL(string: "\(workerUrl)/api/visit-audio")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw Self.serverError(data, response)
        }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let path = json["path"] as? String else {
            throw URLError(.cannotParseResponse)
        }
        return path
    }

    func audioURL(for path: String) async throws -> URL {
        let encoded = path.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? path
        let url = URL(string: "\(workerUrl)/api/visit-audio-url?path=\(encoded)")!
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw Self.serverError(data, response)
        }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let urlString = json["url"] as? String,
              let audioURL = URL(string: urlString) else {
            throw URLError(.cannotParseResponse)
        }
        return audioURL
    }

    // MARK: - Assign visit to patient

    func assignVisit(id: String, patientPtnum: String) async throws -> Visit {
        try await updateVisit(id: id, fields: ["patient_ptnum": patientPtnum])
    }
}
