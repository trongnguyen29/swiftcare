import Foundation

@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var session: AuthSession?
    @Published var isLoading = true

    private let supabaseUrl = "https://zbnvigxkforwbmphghpg.supabase.co"
    private let anonKey     = "sb_publishable_U3hegesGlIhrENKOreNbuQ_WIKcYrOL"
    private let sessionKey  = "swiftcare_session"

    struct AuthSession: Codable {
        let access_token: String
        let refresh_token: String
        let expires_at: Double
        let user: AuthUser
    }

    struct AuthUser: Codable {
        let id: String
        let email: String?
    }

    enum AuthError: LocalizedError {
        case invalidCredentials
        case serverError(String)

        var errorDescription: String? {
            switch self {
            case .invalidCredentials:     return "Invalid email or password."
            case .serverError(let msg):   return msg
            }
        }
    }

    var isSignedIn: Bool  { session != nil }
    var accessToken: String? { session?.access_token }
    var userId: String?   { session?.user.id }

    init() { restoreSession() }

    func signIn(email: String, password: String) async throws {
        let url = URL(string: "\(supabaseUrl)/auth/v1/token?grant_type=password")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["email": email, "password": password])

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw AuthError.serverError("No response") }

        if !(200...299).contains(http.statusCode) {
            let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error_description"] as? String
            throw msg == nil ? AuthError.invalidCredentials : AuthError.serverError(msg!)
        }

        let sess = try JSONDecoder().decode(AuthSession.self, from: data)
        session = sess
        persist(sess)
    }

    func signOut() async {
        if let token = accessToken {
            var req = URLRequest(url: URL(string: "\(supabaseUrl)/auth/v1/logout")!)
            req.httpMethod = "POST"
            req.setValue(anonKey, forHTTPHeaderField: "apikey")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            try? await URLSession.shared.data(for: req)
        }
        session = nil
        UserDefaults.standard.removeObject(forKey: sessionKey)
    }

    private func restoreSession() {
        defer { isLoading = false }
        guard let data = UserDefaults.standard.data(forKey: sessionKey),
              let sess = try? JSONDecoder().decode(AuthSession.self, from: data),
              sess.expires_at > Date().timeIntervalSince1970 else { return }
        session = sess
    }

    private func persist(_ sess: AuthSession) {
        if let data = try? JSONEncoder().encode(sess) {
            UserDefaults.standard.set(data, forKey: sessionKey)
        }
    }
}
