import SwiftUI
import CoreImage.CIFilterBuiltins

struct MFAPromptView: View {
    @EnvironmentObject var auth: AuthService

    @State private var step: Step  = .prompt
    @State private var enrollment: AuthService.MFAEnrollment?
    @State private var challengeId = ""
    @State private var code        = ""
    @State private var errorMessage: String?
    @State private var isLoading   = false

    private let burgundy = Color(red: 0.52, green: 0.08, blue: 0.22)

    enum Step { case prompt, scan, verify, done, error(String) }

    var body: some View {
        ZStack {
            Color(UIColor.systemGroupedBackground).ignoresSafeArea()

            switch step {
            case .prompt:        promptStep
            case .scan:          scanStep
            case .verify:        verifyStep
            case .done:          doneStep
            case .error(let msg): errorStep(msg)
            }
        }
    }

    // MARK: - Prompt (Set up or Skip)

    private var promptStep: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 32) {
                VStack(spacing: 12) {
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 56))
                        .foregroundColor(burgundy)

                    Text("Add Extra Security")
                        .font(.system(size: 26, weight: .bold))

                    Text("Two-factor authentication protects patient data by requiring a code from your authenticator app each time you sign in.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }

                VStack(spacing: 12) {
                    Button(action: { Task { await startEnrollment() } }) {
                        HStack(spacing: 8) {
                            if isLoading {
                                ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                            } else {
                                Image(systemName: "qrcode")
                                Text("Set Up Two-Factor Auth")
                                    .fontWeight(.semibold)
                            }
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: 320)
                        .padding()
                        .background(burgundy)
                        .cornerRadius(12)
                    }
                    .disabled(isLoading)

                    Button("Skip for Now") {
                        auth.mfaEnrollmentRequired = false
                        if !auth.biometricsEnabled { auth.shouldPromptTouchID = true }
                    }
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                }

                if let err = errorMessage {
                    Text(err).font(.caption).foregroundColor(.red)
                }
            }
            .frame(maxWidth: 480)
            .padding(32)
            .background(Color(UIColor.systemBackground))
            .cornerRadius(20)
            .shadow(color: .black.opacity(0.06), radius: 16, y: 4)
            .padding(.horizontal, 24)

            Spacer()
        }
    }

    // MARK: - Scan QR

    private var scanStep: some View {
        VStack(spacing: 28) {
            Spacer()

            VStack(spacing: 10) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 40))
                    .foregroundColor(burgundy)
                Text("Scan with Authenticator App")
                    .font(.title3.bold())
                Text("Use Google Authenticator, Authy, or any TOTP app")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

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
                    Text("Manual key").font(.caption).foregroundColor(.secondary)
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

            Button("Cancel") { step = .prompt }
                .font(.subheadline).foregroundColor(.secondary)

            Spacer()
        }
        .padding(.horizontal, 24)
    }

    // MARK: - Verify

    private var verifyStep: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 8) {
                Image(systemName: "checkmark.shield")
                    .font(.system(size: 40))
                    .foregroundColor(burgundy)
                Text("Confirm Setup")
                    .font(.title3.bold())
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
                .font(.caption).foregroundColor(.red)
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

            Button("Go Back") { step = .scan }
                .font(.subheadline).foregroundColor(.secondary)

            Spacer()
        }
        .padding()
    }

    // MARK: - Done

    private var doneStep: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64)).foregroundColor(.green)
            Text("2FA Enabled!")
                .font(.title2.bold())
            Text("Your account is now protected with two-factor authentication.")
                .font(.subheadline).foregroundColor(.secondary)
                .multilineTextAlignment(.center).padding(.horizontal, 32)
            Button("Enter SwiftCare →") {
                auth.mfaEnrollmentRequired = false
                if !auth.biometricsEnabled { auth.shouldPromptTouchID = true }
            }
            .fontWeight(.semibold).foregroundColor(.white)
            .padding().frame(maxWidth: 240)
            .background(burgundy).cornerRadius(12)
            Spacer()
        }
    }

    // MARK: - Error step

    private func errorStep(_ message: String) -> some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48)).foregroundColor(.orange)
            Text("Setup Failed")
                .font(.title3.bold())
            Text(message)
                .font(.subheadline).foregroundColor(.secondary)
                .multilineTextAlignment(.center).padding(.horizontal, 32)
            Button("Try Again") { step = .prompt }
                .fontWeight(.semibold).foregroundColor(.white)
                .padding().frame(maxWidth: 200)
                .background(burgundy).cornerRadius(12)
            Button("Skip for Now") { auth.mfaEnrollmentRequired = false }
                .font(.subheadline).foregroundColor(.secondary)
            Spacer()
        }
    }

    // MARK: - Logic

    private func startEnrollment() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let e = try await auth.enrollMFA(friendlyName: "Authenticator App")
            await MainActor.run { enrollment = e; step = .scan }
        } catch {
            await MainActor.run { step = .error(error.localizedDescription) }
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
        let ctx = CIContext()
        guard let cg = ctx.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
