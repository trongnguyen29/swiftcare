import SwiftUI
import CoreImage.CIFilterBuiltins

struct MFAEnrollView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) var dismiss

    @State private var enrollment: AuthService.MFAEnrollment?
    @State private var challengeId = ""
    @State private var code        = ""
    @State private var step: Step  = .loading
    @State private var errorMessage: String?

    private let burgundy = Color(red: 0.52, green: 0.08, blue: 0.22)

    enum Step { case loading, scan, verify, done, error(String) }

    var body: some View {
        NavigationView {
            ZStack {
                Color(UIColor.systemGroupedBackground).ignoresSafeArea()

                switch step {
                case .loading:
                    ProgressView("Setting up MFA…")
                case .scan:
                    scanStep
                case .verify:
                    verifyStep
                case .done:
                    doneStep
                case .error(let msg):
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 40)).foregroundColor(.orange)
                        Text("Setup Failed").font(.headline)
                        Text(msg).font(.subheadline).foregroundColor(.secondary)
                            .multilineTextAlignment(.center).padding(.horizontal)
                        Button("Try Again") { Task { await startEnrollment() } }
                            .foregroundColor(.white).padding()
                            .background(Color(red: 0.52, green: 0.08, blue: 0.22))
                            .cornerRadius(10)
                    }.padding()
                }
            }
            .navigationTitle("Set Up 2FA")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .task { await startEnrollment() }
    }

    // MARK: - Steps

    private var scanStep: some View {
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 10) {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 44))
                        .foregroundColor(burgundy)
                    Text("Scan with Authenticator App")
                        .font(.title3.bold())
                    Text("Use Google Authenticator, Authy, or any TOTP app")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }

                if let e = enrollment, let qr = generateQR(from: e.qrUri) {
                    Image(uiImage: qr)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 200, height: 200)
                        .padding(16)
                        .background(Color.white)
                        .cornerRadius(12)
                }

                // Manual entry
                if let e = enrollment {
                    VStack(spacing: 6) {
                        Text("Or enter this key manually")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(e.secret)
                            .font(.system(.body, design: .monospaced))
                            .padding(10)
                            .background(Color(UIColor.systemBackground))
                            .cornerRadius(8)
                    }
                }

                Button(action: { Task { await fetchChallenge() } }) {
                    Text("I've scanned it →")
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(maxWidth: 280)
                        .padding()
                        .background(burgundy)
                        .cornerRadius(12)
                }
            }
            .padding(24)
        }
    }

    private var verifyStep: some View {
        VStack(spacing: 28) {
            Spacer()

            VStack(spacing: 10) {
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 44))
                    .foregroundColor(burgundy)
                Text("Confirm Setup")
                    .font(.title3.bold())
                Text("Enter the 6-digit code shown in your authenticator app")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
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
                Text(err).font(.caption).foregroundColor(.red)
            }

            Button(action: { Task { await confirmEnrollment() } }) {
                Text("Confirm & Enable 2FA")
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
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundColor(.green)
            Text("2FA Enabled!")
                .font(.title2.bold())
            Text("Your account is now protected with two-factor authentication.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("Done") { dismiss() }
                .fontWeight(.semibold)
                .foregroundColor(.white)
                .padding()
                .frame(maxWidth: 200)
                .background(burgundy)
                .cornerRadius(12)
            Spacer()
        }
    }

    // MARK: - Logic

    private func startEnrollment() async {
        await MainActor.run { step = .loading }
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
        return UIImage(ciImage: scaled)
    }
}
