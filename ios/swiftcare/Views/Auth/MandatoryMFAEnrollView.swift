import SwiftUI
import CoreImage.CIFilterBuiltins

struct MandatoryMFAEnrollView: View {
    @EnvironmentObject var auth: AuthService

    @State private var enrollment: AuthService.MFAEnrollment?
    @State private var challengeId = ""
    @State private var code        = ""
    @State private var step: Step  = .loading
    @State private var errorMessage: String?

    private let burgundy = Color(red: 0.52, green: 0.08, blue: 0.22)

    enum Step { case loading, scan, verify, done }

    var body: some View {
        ZStack {
            Color(UIColor.systemGroupedBackground).ignoresSafeArea()

            VStack(spacing: 0) {
                // Header — no dismiss
                VStack(spacing: 6) {
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 36))
                        .foregroundColor(burgundy)
                    Text("Secure Your Account")
                        .font(.title2.bold())
                    Text("SwiftCare requires two-factor authentication for all clinical accounts")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                .padding(.top, 48)
                .padding(.bottom, 32)

                Divider()

                switch step {
                case .loading:
                    Spacer()
                    ProgressView("Setting up…")
                    Spacer()

                case .scan:
                    scanStep

                case .verify:
                    verifyStep

                case .done:
                    doneStep
                }

                // Always show sign out option
                Button("Sign Out") { Task { await auth.signOut() } }
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.bottom, 24)
            }
        }
        .task { await startEnrollment() }
    }

    private var scanStep: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 8) {
                    Text("Step 1 — Scan QR Code")
                        .font(.headline)
                    Text("Open Google Authenticator, Authy, or any TOTP app and scan this code")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 24)

                if let e = enrollment, let qr = generateQR(from: e.qrUri) {
                    Image(uiImage: qr)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 180, height: 180)
                        .padding(16)
                        .background(Color.white)
                        .cornerRadius(12)
                        .shadow(color: .black.opacity(0.08), radius: 8)
                }

                if let e = enrollment {
                    VStack(spacing: 4) {
                        Text("Manual entry key").font(.caption).foregroundColor(.secondary)
                        Text(e.secret)
                            .font(.system(.footnote, design: .monospaced))
                            .padding(10)
                            .background(Color(UIColor.systemBackground))
                            .cornerRadius(8)
                    }
                }

                Button(action: { Task { await fetchChallenge() } }) {
                    Text("I've scanned it — Continue →")
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(maxWidth: 300)
                        .padding()
                        .background(burgundy)
                        .cornerRadius(12)
                }
                .padding(.bottom, 16)
            }
            .padding(.horizontal, 24)
        }
    }

    private var verifyStep: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 8) {
                Text("Step 2 — Verify Code")
                    .font(.headline)
                Text("Enter the 6-digit code from your authenticator app")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            TextField("000000", text: $code)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .font(.system(size: 36, weight: .bold, design: .monospaced))
                .tracking(12)
                .frame(maxWidth: 240)
                .padding()
                .background(Color(UIColor.systemBackground))
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(burgundy.opacity(0.4), lineWidth: 1.5))
                .onChange(of: code) { val in
                    code = String(val.prefix(6).filter(\.isNumber))
                }

            if let err = errorMessage {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.circle.fill")
                    Text(err)
                }
                .font(.caption)
                .foregroundColor(.red)
            }

            Button(action: { Task { await confirmEnrollment() } }) {
                Text("Activate 2FA")
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: 280)
                    .padding()
                    .background(code.count == 6 ? burgundy : Color.gray.opacity(0.3))
                    .cornerRadius(12)
            }
            .disabled(code.count < 6)

            Spacer()
        }
        .padding()
    }

    private var doneStep: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 64))
                .foregroundColor(.green)
            Text("2FA Activated!")
                .font(.title2.bold())
            Text("Your account is now protected. You'll be asked for a code on every sign in.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button("Enter SwiftCare →") {
                Task { await MainActor.run { auth.mfaEnrollmentRequired = false } }
            }
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .padding()
            .frame(maxWidth: 240)
            .background(burgundy)
            .cornerRadius(12)
            Spacer()
        }
    }

    private func startEnrollment() async {
        do {
            let e = try await auth.enrollMFA(friendlyName: "Authenticator App")
            await MainActor.run { enrollment = e; step = .scan }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription }
        }
    }

    private func fetchChallenge() async {
        guard let e = enrollment else { return }
        do {
            let cid = try await auth.challengeMFA(factorId: e.factorId)
            await MainActor.run { challengeId = cid; step = .verify }
        } catch {
            await MainActor.run { errorMessage = error.localizedDescription }
        }
    }

    private func confirmEnrollment() async {
        guard let e = enrollment else { return }
        do {
            try await auth.verifyMFA(factorId: e.factorId, challengeId: challengeId, code: code)
            await MainActor.run { step = .done }
        } catch {
            await MainActor.run { errorMessage = "Invalid code. Try again."; code = "" }
        }
    }

    private func generateQR(from string: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "H"
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
        return UIImage(ciImage: scaled)
    }
}
