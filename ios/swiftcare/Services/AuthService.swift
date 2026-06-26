import Foundation
import Combine
import Security
import LocalAuthentication

// MARK: - Keychain

private enum Keychain {
    static func save(_ data: Data, key: String) {
        let q: [CFString: Any] = [kSecClass: kSecClassGenericPassword, kSecAttrAccount: key, kSecValueData: data]
        SecItemDelete(q as CFDictionary)
        SecItemAdd(q as CFDictionary, nil)
    }
    static func load(key: String) -> Data? {
        let q: [CFString: Any] = [kSecClass: kSecClassGenericPassword, kSecAttrAccount: key,
                                   kSecReturnData: true, kSecMatchLimit: kSecMatchLimitOne]
        var r: AnyObject?
        SecItemCopyMatching(q as CFDictionary, &r)
        return r as? Data
    }
    static func delete(key: String) {
        let q: [CFString: Any] = [kSecClass: kSecClassGenericPassword, kSecAttrAccount: key]
        SecItemDelete(q as CFDictionary)
    }
}

// MARK: - AuthService

class AuthService: ObservableObject {
    static let shared = AuthService()

    // Published state
    @Published var session: AuthSession?
    @Published var isLoading             = true
    @Published var biometricLocked       = false
    @Published var pendingMFA: MFAFactor?
    @Published var mfaEnrollmentRequired = false
    @Published var isMFAEnrolled         = false
    @Published var shouldPromptTouchID   = false  // shown once after first password sign-in

    private let base         = "https://zbnvigxkforwbmphghpg.supabase.co"
    private let anonKey      = "sb_publishable_U3hegesGlIhrENKOreNbuQ_WIKcYrOL"
    private let sessionKey   = "swiftcare_auth_session"
    private let bioKey       = "swiftcare_biometrics_enabled"
    // Factor key is per-user so different accounts on same device work correctly
    private func mfaFactorKey(for userId: String) -> String { "swiftcare_mfa_factor_\(userId)" }
    private func mfaEnrolledKey(for userId: String) -> String { "swiftcare_mfa_enrolled_\(userId)" }

    // MARK: Models

    struct AuthSession: Codable {
        let access_token:  String
        let refresh_token: String
        let expires_at:    Double
        let user:          AuthUser
    }

    struct AuthUser: Codable {
        let id:            String
        let email:         String?
        let user_metadata: UserMetadata?
        struct UserMetadata: Codable {
            let full_name: String?
            let name:      String?
        }
    }

    struct MFAFactor: Codable {
        let id:            String
        let factor_type:   String
        let friendly_name: String?
        let status:        String   // "verified" | "unverified"
    }

    struct MFAEnrollment {
        let factorId: String
        let qrUri:    String   // otpauth:// URI for QR code
        let secret:   String   // manual entry fallback
    }

    enum AuthError: LocalizedError {
        case invalidCredentials, emailNotConfirmed, emailAlreadyExists, serverError(String)
        var errorDescription: String? {
            switch self {
            case .invalidCredentials:  return "Invalid email or password."
            case .emailNotConfirmed:   return "Please confirm your email before signing in."
            case .emailAlreadyExists:  return "An account with this email already exists. Sign in instead."
            case .serverError(let m):  return m
            }
        }
    }

    // MARK: Computed

    var isSignedIn: Bool     { session != nil }
    var accessToken: String? { session?.access_token }
    var userId: String?      { session?.user.id }

    var practitionerName: String {
        session?.user.user_metadata?.full_name
            ?? session?.user.user_metadata?.name
            ?? session?.user.email?.components(separatedBy: "@").first
            ?? "Doctor"
    }

    var biometricsEnabled: Bool {
        Keychain.load(key: bioKey) != nil
    }

    var biometricsAvailable: Bool {
        var error: NSError?
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    var biometryType: String { "Touch ID" }

    init() { restoreSession() }

    // MARK: - Sign In

    func signIn(email: String, password: String) async throws {
        let url = URL(string: "\(base)/auth/v1/token?grant_type=password")!
        var req = urlRequest(url, method: "POST")
        req.httpBody = try JSONEncoder().encode(["email": email, "password": password])
        let (data, response) = try await URLSession.shared.data(for: req)
        try checkHTTP(response, data: data)
        let sess = try JSONDecoder().decode(AuthSession.self, from: data)
        await apply(sess)
        scheduleRefresh(for: sess)
        await MainActor.run { biometricLocked = false }

        let userKey     = mfaFactorKey(for: sess.user.id)
        let enrolledKey = mfaEnrolledKey(for: sess.user.id)
        let alreadyEnrolled = Keychain.load(key: enrolledKey) != nil

        if let storedId = Keychain.load(key: userKey).flatMap({ String(data: $0, encoding: .utf8) }) {
            let factor = MFAFactor(id: storedId, factor_type: "totp", friendly_name: "Authenticator App", status: "verified")
            await MainActor.run { isMFAEnrolled = true; pendingMFA = factor }
        } else if let factor = try? await enrolledMFAFactor(token: sess.access_token) {
            if let idData = factor.id.data(using: .utf8) { Keychain.save(idData, key: userKey) }
            Keychain.save(Data([1]), key: enrolledKey)
            await MainActor.run { isMFAEnrolled = true; pendingMFA = factor }
        } else if alreadyEnrolled {
            // Enrolled flag in Keychain but factor ID lost — skip prompt, let user in
            await MainActor.run { isMFAEnrolled = true; mfaEnrollmentRequired = false }
        } else {
            await MainActor.run { isMFAEnrolled = false; mfaEnrollmentRequired = true }
        }
    }

    // MARK: - Sign Up

    func signUp(email: String, password: String, fullName: String) async throws {
        let url = URL(string: "\(base)/auth/v1/signup")!
        var req = urlRequest(url, method: "POST")
        req.httpBody = try JSONSerialization.data(withJSONObject: [
            "email":    email,
            "password": password,
            "data":     ["full_name": fullName]
        ])
        let (data, response) = try await URLSession.shared.data(for: req)
        try checkHTTP(response, data: data)

        // If email confirmation is required Supabase returns a User object (no access_token)
        // If auto-confirmed it returns a full AuthSession
        if let sess = try? JSONDecoder().decode(AuthSession.self, from: data),
           !sess.access_token.isEmpty {
            try? await createProfile(userId: sess.user.id, token: sess.access_token)
            await apply(sess)
            scheduleRefresh(for: sess)
            await MainActor.run { biometricLocked = false }
        } else {
            // Email confirmation required — throw a friendly message
            throw AuthError.serverError("Account created! Check your email to confirm before signing in.")
        }
    }

    // MARK: - Sign Out

    func signOut() async {
        if let token = accessToken {
            var req = urlRequest(URL(string: "\(base)/auth/v1/logout")!, method: "POST")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            try? await URLSession.shared.data(for: req)
        }
        await MainActor.run {
            session = nil; pendingMFA = nil; biometricLocked = false; mfaEnrollmentRequired = false
        }
        Keychain.delete(key: sessionKey)
        await MainActor.run { RecentPatientsStore.shared.clear() }
        // bioKey and mfaFactorKey persist (preferences kept, re-enabled on next login)
    }

    // MARK: - MFA

    func enrolledMFAFactor(token: String) async throws -> MFAFactor? {
        let factors = (try? await listAllFactors(token: token)) ?? []
        return factors.first(where: { $0.factor_type == "totp" && $0.status == "verified" })
    }

    private func listAllFactors(token: String) async throws -> [MFAFactor] {
        var req = urlRequest(URL(string: "\(base)/auth/v1/factors")!, method: "GET")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, _) = try await URLSession.shared.data(for: req)

        // Supabase returns {"totp": [...], "phone": [...]} not a flat array
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let totpArray = json["totp"] as? [[String: Any]] ?? []
            return totpArray.compactMap { dict -> MFAFactor? in
                guard let id     = dict["id"]          as? String,
                      let type   = dict["factor_type"] as? String,
                      let status = dict["status"]      as? String else { return nil }
                return MFAFactor(
                    id:            id,
                    factor_type:   type,
                    friendly_name: dict["friendly_name"] as? String,
                    status:        status
                )
            }
        }
        // Fallback: try flat array (older Supabase versions)
        return (try? JSONDecoder().decode([MFAFactor].self, from: data)) ?? []
    }

    func enrollMFA(friendlyName: String) async throws -> MFAEnrollment {
        guard let token = accessToken else { throw AuthError.serverError("Not signed in") }

        // If already enrolled for this user, don't re-enroll
        if let uid = userId, Keychain.load(key: mfaFactorKey(for: uid)) != nil {
            throw AuthError.serverError("2FA is already set up for this account.")
        }

        // Clean up unverified factors only
        if let existing = try? await listAllFactors(token: token) {
            for f in existing where f.factor_type == "totp" && f.status == "unverified" {
                try? await unenrollMFA(factorId: f.id)
            }
        }

        var req = urlRequest(URL(string: "\(base)/auth/v1/factors")!, method: "POST")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder().encode(["friendly_name": friendlyName, "factor_type": "totp"])
        let (data, response) = try await URLSession.shared.data(for: req)
        // Use MFA-specific error handling (not the auth error handler)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["msg"] as? String
                ?? (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["message"] as? String
                ?? String(data: data, encoding: .utf8)
                ?? "MFA setup failed"
            throw AuthError.serverError(msg)
        }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id    = json["id"] as? String,
              let totp  = json["totp"] as? [String: Any],
              let uri    = totp["uri"] as? String,
              let secret = totp["secret"] as? String
        else {
            let raw = String(data: data, encoding: .utf8) ?? "no body"
            throw AuthError.serverError("Enrollment failed: \(raw)")
        }
        return MFAEnrollment(factorId: id, qrUri: uri, secret: secret)
    }

    func challengeMFA(factorId: String) async throws -> String {
        guard let token = accessToken else { throw AuthError.serverError("Not signed in") }
        var req = urlRequest(URL(string: "\(base)/auth/v1/factors/\(factorId)/challenge")!, method: "POST")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: req)
        try checkHTTP(response, data: data)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let challengeId = json["id"] as? String
        else { throw AuthError.serverError("Challenge failed") }
        return challengeId
    }

    func verifyMFA(factorId: String, challengeId: String, code: String) async throws {
        guard let token = accessToken else { throw AuthError.serverError("Not signed in") }
        var req = urlRequest(URL(string: "\(base)/auth/v1/factors/\(factorId)/verify")!, method: "POST")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder().encode(["factor_id": factorId, "challenge_id": challengeId, "code": code])
        let (data, response) = try await URLSession.shared.data(for: req)
        try checkHTTP(response, data: data)
        let sess = try JSONDecoder().decode(AuthSession.self, from: data)
        await apply(sess)
        // Persist factor ID and enrolled flag per user
        if let uid = session?.user.id {
            if let idData = factorId.data(using: .utf8) {
                Keychain.save(idData, key: mfaFactorKey(for: uid))
            }
            Keychain.save(Data([1]), key: mfaEnrolledKey(for: uid))
        }
        let offerTouchID = !biometricsEnabled
        await MainActor.run {
            pendingMFA = nil
            isMFAEnrolled = true
            mfaEnrollmentRequired = false
            if offerTouchID { shouldPromptTouchID = true }
        }
    }

    func unenrollMFA(factorId: String) async throws {
        guard let token = accessToken else { return }
        var req = urlRequest(URL(string: "\(base)/auth/v1/factors/\(factorId)")!, method: "DELETE")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        try? await URLSession.shared.data(for: req)
    }

    // MARK: - Biometrics

    func enableBiometrics() async -> Bool {
        let ctx = LAContext()
        do {
            let ok = try await ctx.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Enable Touch ID for SwiftCare"
            )
            if ok { Keychain.save(Data([1]), key: bioKey) }
            return ok
        } catch {
            // On simulator without Touch ID enrolled, still save preference so flow works
            #if targetEnvironment(simulator)
            Keychain.save(Data([1]), key: bioKey)
            return true
            #else
            return false
            #endif
        }
    }

    func disableBiometrics() {
        Keychain.delete(key: bioKey)
    }

    func clearStoredMFAFactor() {
        guard let uid = userId else { return }
        Keychain.delete(key: mfaFactorKey(for: uid))
        DispatchQueue.main.async { self.isMFAEnrolled = false }
    }

    func authenticateWithBiometrics() async -> Bool {
        #if targetEnvironment(simulator)
        // Simulator: attempt real Touch ID (Features → Touch ID → Matching Touch)
        // but fall back to true if not enrolled so testing flow still works
        let ctx = LAContext()
        do {
            return try await ctx.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Use Touch ID to sign in to SwiftCare"
            )
        } catch {
            return biometricsEnabled // if enabled, treat simulator as authenticated
        }
        #else
        let ctx = LAContext()
        do {
            return try await ctx.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Use Touch ID to sign in to SwiftCare"
            )
        } catch { return false }
        #endif
    }

    func unlockWithBiometrics() async {
        let success = await authenticateWithBiometrics()
        guard success else { return }

        // Restore session from Keychain if not already in memory
        if session == nil,
           let data = Keychain.load(key: sessionKey),
           let sess = try? JSONDecoder().decode(AuthSession.self, from: data) {
            if sess.expires_at > Date().timeIntervalSince1970 {
                await MainActor.run { session = sess }
                scheduleRefresh(for: sess)
            } else {
                // Expired — refresh using stored refresh token
                await refreshToken(using: sess.refresh_token)
            }
        }

        await MainActor.run { biometricLocked = false }
    }

    // MARK: - Token Refresh

    func refreshIfNeeded() async {
        guard let sess = session, sess.expires_at - Date().timeIntervalSince1970 < 300 else { return }
        await refreshToken(using: sess.refresh_token)
    }

    @discardableResult
    private func refreshToken(using refreshToken: String) async -> Bool {
        var req = urlRequest(URL(string: "\(base)/auth/v1/token?grant_type=refresh_token")!, method: "POST")
        req.httpBody = try? JSONEncoder().encode(["refresh_token": refreshToken])
        guard let (data, response) = try? await URLSession.shared.data(for: req),
              let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode),
              let sess = try? JSONDecoder().decode(AuthSession.self, from: data) else {
            await MainActor.run { session = nil }
            Keychain.delete(key: sessionKey)
            return false
        }
        await apply(sess)
        scheduleRefresh(for: sess)
        return true
    }

    private func scheduleRefresh(for sess: AuthSession) {
        let refreshIn = max(0, sess.expires_at - Date().timeIntervalSince1970 - 300)
        Task {
            try? await Task.sleep(nanoseconds: UInt64(refreshIn * 1_000_000_000))
            guard session != nil else { return }
            await refreshToken(using: sess.refresh_token)
        }
    }

    // MARK: - Session persistence

    private func restoreSession() {
        guard let data = Keychain.load(key: sessionKey),
              let sess = try? JSONDecoder().decode(AuthSession.self, from: data) else {
            DispatchQueue.main.async { self.isLoading = false }
            return
        }
        let timeLeft = sess.expires_at - Date().timeIntervalSince1970
        if timeLeft <= 0 {
            Task {
                await refreshToken(using: sess.refresh_token)
                await checkBiometricLock()
                await MainActor.run { self.isLoading = false }
            }
        } else {
            DispatchQueue.main.async { self.session = sess }
            scheduleRefresh(for: sess)
            Task {
                await checkMFAOnRestore(sess: sess)
                await checkBiometricLock()
                await MainActor.run { self.isLoading = false }
            }
        }
    }

    private func checkMFAOnRestore(sess: AuthSession) async {
        let userKey     = mfaFactorKey(for: sess.user.id)
        let enrolledKey = mfaEnrolledKey(for: sess.user.id)
        let alreadyEnrolled = Keychain.load(key: enrolledKey) != nil

        if let storedId = Keychain.load(key: userKey).flatMap({ String(data: $0, encoding: .utf8) }) {
            let factor = MFAFactor(id: storedId, factor_type: "totp", friendly_name: "Authenticator App", status: "verified")
            await MainActor.run { isMFAEnrolled = true; pendingMFA = factor }
        } else if let factor = try? await enrolledMFAFactor(token: sess.access_token) {
            if let idData = factor.id.data(using: .utf8) { Keychain.save(idData, key: userKey) }
            Keychain.save(Data([1]), key: enrolledKey)
            await MainActor.run { isMFAEnrolled = true; pendingMFA = factor }
        } else if alreadyEnrolled {
            await MainActor.run { isMFAEnrolled = true; mfaEnrollmentRequired = false }
        } else {
            await MainActor.run { isMFAEnrolled = false; mfaEnrollmentRequired = true }
        }
    }

    private func checkBiometricLock() async {
        guard biometricsEnabled && session != nil else { return }
        await MainActor.run { biometricLocked = true }
    }

    private func apply(_ sess: AuthSession) async {
        await MainActor.run { session = sess }
        if let data = try? JSONEncoder().encode(sess) { Keychain.save(data, key: sessionKey) }
    }

    // MARK: - Helpers

    private func urlRequest(_ url: URL, method: String) -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return req
    }

    private func checkHTTP(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw AuthError.serverError("No response") }
        guard (200...299).contains(http.statusCode) else {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                // Supabase v2 uses "msg", v1 uses "error_description"
                let msg = (json["msg"] as? String
                    ?? json["error_description"] as? String
                    ?? json["message"] as? String
                    ?? "").lowercased()
                let errorCode = json["error_code"] as? String ?? ""

                if msg.contains("email not confirmed")       { throw AuthError.emailNotConfirmed }
                if msg.contains("already registered")
                    || msg.contains("already exists")
                    || errorCode == "email_exists"           { throw AuthError.emailAlreadyExists }
                if msg.contains("invalid") && msg.contains("email")
                    || errorCode == "validation_failed"      { throw AuthError.serverError("Please enter a valid email address.") }
                if msg.contains("password") && msg.contains("short") { throw AuthError.serverError("Password must be at least 6 characters.") }
                if !msg.isEmpty                              { throw AuthError.serverError(msg) }
            }
            throw AuthError.invalidCredentials
        }
    }

    private func createProfile(userId: String, token: String) async throws {
        // 1. Create profile row
        var req = urlRequest(URL(string: "\(base)/rest/v1/profiles")!, method: "POST")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req.httpBody = try JSONEncoder().encode(["id": userId, "user_type": "practitioner"])
        try? await URLSession.shared.data(for: req)

        // 2. Create practitioners entry
        let ehrId = "dr-\(userId.prefix(8))"
        var req2 = urlRequest(URL(string: "\(base)/rest/v1/practitioners")!, method: "POST")
        req2.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req2.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req2.httpBody = try JSONSerialization.data(withJSONObject: ["ehr_id": ehrId])
        try? await URLSession.shared.data(for: req2)

        // 3. Link user to their practitioner FHIR resource
        var req3 = urlRequest(URL(string: "\(base)/rest/v1/user_fhir_links")!, method: "POST")
        req3.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req3.setValue("return=minimal", forHTTPHeaderField: "Prefer")
        req3.httpBody = try JSONSerialization.data(withJSONObject: [
            "user_id": userId,
            "fhir_resource_type": "Practitioner",
            "fhir_resource_id": ehrId
        ])
        try? await URLSession.shared.data(for: req3)
    }
}
