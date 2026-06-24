import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService

    @State private var email       = ""
    @State private var password    = ""
    @State private var isLoading   = false
    @State private var errorMessage: String?
    @FocusState private var focused: Field?

    enum Field { case email, password }

    private let navy      = Color(red: 0.52, green: 0.08, blue: 0.22)   // deep burgundy
    private let navyLight = Color(red: 0.68, green: 0.18, blue: 0.35)  // rose burgundy

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 0) {

                // ── Left panel — branding ──────────────────────────
                ZStack {
                    LinearGradient(
                        colors: [navy, navyLight],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                    // Decorative circles
                    Circle()
                        .fill(Color(red: 0.85, green: 0.55, blue: 0.65).opacity(0.12))
                        .frame(width: 320)
                        .offset(x: -60, y: -120)
                    Circle()
                        .fill(Color(red: 0.85, green: 0.55, blue: 0.65).opacity(0.08))
                        .frame(width: 220)
                        .offset(x: 80, y: 160)

                    VStack(spacing: 28) {
                        if UIImage(named: "SwiftCareLogo") != nil {
                            Image("SwiftCareLogo")
                                .resizable()
                                .scaledToFill()
                                .frame(width: 120, height: 120)
                                .clipShape(Circle())
                                .overlay(Circle().stroke(Color.white.opacity(0.2), lineWidth: 1))
                        } else {
                            Image(systemName: "cross.case.fill")
                                .font(.system(size: 64))
                                .foregroundColor(.white.opacity(0.9))
                        }

                        VStack(spacing: 10) {
                            Text("SwiftCare")
                                .font(.system(size: 38, weight: .bold))
                                .foregroundColor(.white)
                            Text("Clinical Intelligence Platform")
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.65))
                                .multilineTextAlignment(.center)
                        }

                        Divider()
                            .background(Color.white.opacity(0.2))
                            .frame(width: 60)

                        VStack(spacing: 14) {
                            featurePill(icon: "waveform.path.ecg",       text: "AI-Powered Visit Notes")
                            featurePill(icon: "person.text.rectangle",  text: "FHIR-Native Patient Records")
                            featurePill(icon: "lock.shield.fill",       text: "HIPAA-Ready Infrastructure")
                        }
                    }
                    .padding(48)
                }
                .frame(width: geo.size.width * 0.42)

                // ── Right panel — form ─────────────────────────────
                ZStack {
                    Color(UIColor.systemGroupedBackground)

                    VStack(spacing: 0) {
                        Spacer()

                        VStack(alignment: .leading, spacing: 32) {

                            VStack(alignment: .leading, spacing: 6) {
                                Text("Welcome back")
                                    .font(.system(size: 28, weight: .bold))
                                Text("Sign in to your clinical workspace")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }

                            VStack(spacing: 18) {
                                inputField(
                                    label: "Email address",
                                    placeholder: "webb@cnh.com",
                                    text: $email,
                                    icon: "envelope",
                                    field: .email,
                                    isSecure: false
                                )

                                inputField(
                                    label: "Password",
                                    placeholder: "••••••••",
                                    text: $password,
                                    icon: "lock",
                                    field: .password,
                                    isSecure: true
                                )

                                if let error = errorMessage {
                                    HStack(spacing: 6) {
                                        Image(systemName: "exclamationmark.circle.fill")
                                        Text(error)
                                    }
                                    .font(.caption)
                                    .foregroundColor(.red)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }

                            Button(action: { Task { await signIn() } }) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(canSubmit ? navy : Color.gray.opacity(0.3))
                                    if isLoading {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    } else {
                                        HStack(spacing: 8) {
                                            Text("Sign In")
                                                .fontWeight(.semibold)
                                            Image(systemName: "arrow.right")
                                                .font(.system(size: 14, weight: .semibold))
                                        }
                                        .foregroundColor(.white)
                                    }
                                }
                                .frame(height: 52)
                            }
                            .disabled(!canSubmit || isLoading)
                        }
                        .frame(maxWidth: 360)

                        Spacer()

                        Text("© 2026 SwiftCare · HIPAA Compliant")
                            .font(.caption2)
                            .foregroundColor(.secondary.opacity(0.6))
                            .padding(.bottom, 24)
                    }
                    .frame(maxWidth: .infinity)
                }
                .frame(width: geo.size.width * 0.58)
            }
        }
        .ignoresSafeArea()
    }

    private var canSubmit: Bool { !email.isEmpty && !password.isEmpty }

    @ViewBuilder
    private func featurePill(icon: String, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundColor(.white.opacity(0.7))
                .frame(width: 20)
            Text(text)
                .font(.system(size: 13))
                .foregroundColor(.white.opacity(0.75))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func inputField(
        label: String,
        placeholder: String,
        text: Binding<String>,
        icon: String,
        field: Field,
        isSecure: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)

            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
                    .frame(width: 18)

                if isSecure {
                    SecureField(placeholder, text: text)
                        .focused($focused, equals: field)
                        .onSubmit { if field == .email { focused = .password } else { Task { await signIn() } } }
                } else {
                    TextField(placeholder, text: text)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focused, equals: field)
                        .onSubmit { focused = .password }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color(UIColor.systemBackground))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(
                                focused == field ? navy.opacity(0.6) : Color(UIColor.separator),
                                lineWidth: focused == field ? 1.5 : 1
                            )
                    )
            )
            .animation(.easeInOut(duration: 0.15), value: focused)
        }
    }

    private func signIn() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await auth.signIn(email: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    LoginView().environmentObject(AuthService.shared)
}
