import SwiftUI

struct MFAVerifyView: View {
    @EnvironmentObject var auth: AuthService
    let factor: AuthService.MFAFactor

    @State private var code        = ""
    @State private var challengeId = ""
    @State private var isLoading   = false
    @State private var errorMessage: String?

    private let burgundy = Color(red: 0.52, green: 0.08, blue: 0.22)

    var body: some View {
        ZStack {
            Color(UIColor.systemGroupedBackground).ignoresSafeArea()

            VStack(spacing: 40) {
                Spacer()

                VStack(spacing: 16) {
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 56))
                        .foregroundColor(burgundy)

                    Text("Two-Factor Authentication")
                        .font(.title2.bold())

                    Text("Enter the 6-digit code from your authenticator app")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }

                // 6-digit code input
                VStack(spacing: 20) {
                    TextField("000000", text: $code)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.center)
                        .font(.system(size: 36, weight: .bold, design: .monospaced))
                        .tracking(12)
                        .frame(maxWidth: 260)
                        .padding()
                        .background(Color(UIColor.systemBackground))
                        .cornerRadius(12)
                        .overlay(RoundedRectangle(cornerRadius: 12)
                            .stroke(burgundy.opacity(0.4), lineWidth: 1.5))
                        .onChange(of: code) { val in
                            code = String(val.prefix(6).filter(\.isNumber))
                            if code.count == 6 { Task { await verify() } }
                        }

                    if let error = errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(error)
                        }
                        .font(.caption)
                        .foregroundColor(.red)
                    }

                    Button(action: { Task { await verify() } }) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(code.count == 6 ? burgundy : Color.gray.opacity(0.3))
                            if isLoading {
                                ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Text("Verify").fontWeight(.semibold).foregroundColor(.white)
                            }
                        }
                        .frame(width: 260, height: 50)
                    }
                    .disabled(code.count < 6 || isLoading)
                }

                Button("Sign in with a different account") {
                    Task { await auth.signOut() }
                }
                .font(.subheadline)
                .foregroundColor(.secondary)

                Spacer()
            }
        }
        .task { await fetchChallenge() }
    }

    private func fetchChallenge() async {
        do {
            challengeId = try await auth.challengeMFA(factorId: factor.id)
        } catch {
            let msg = error.localizedDescription.lowercased()
            if msg.contains("factor") && msg.contains("not found") {
                // Stale factor in Keychain — clear it and show enrollment
                auth.clearStoredMFAFactor()
                await MainActor.run { auth.pendingMFA = nil; auth.mfaEnrollmentRequired = true }
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func verify() async {
        guard code.count == 6, !challengeId.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await auth.verifyMFA(factorId: factor.id, challengeId: challengeId, code: code)
        } catch {
            errorMessage = "Invalid code. Please try again."
            code = ""
            await fetchChallenge()
        }
    }
}
