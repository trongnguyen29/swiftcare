import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService

    @State private var email    = ""
    @State private var password = ""
    @State private var isLoading   = false
    @State private var errorMessage: String?

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 0) {
                    Spacer(minLength: geo.size.height * 0.12)

                    VStack(spacing: 36) {
                        // Header
                        VStack(spacing: 10) {
                            Image(systemName: "stethoscope")
                                .font(.system(size: 52))
                                .foregroundColor(Color(red: 0.1, green: 0.2, blue: 0.4))
                            Text("SwiftCare")
                                .font(.system(size: 32, weight: .bold))
                            Text("Clinical Intelligence Platform")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }

                        // Card
                        VStack(spacing: 20) {
                            formField(label: "EMAIL") {
                                TextField("you@hospital.com", text: $email)
                                    .keyboardType(.emailAddress)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                            }

                            formField(label: "PASSWORD") {
                                SecureField("••••••••", text: $password)
                            }

                            if let error = errorMessage {
                                Text(error)
                                    .font(.caption)
                                    .foregroundColor(.red)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            Button(action: { Task { await signIn() } }) {
                                Group {
                                    if isLoading {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    } else {
                                        Text("Sign In")
                                            .fontWeight(.semibold)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(
                                    email.isEmpty || password.isEmpty
                                        ? Color.gray.opacity(0.4)
                                        : Color(red: 0.1, green: 0.2, blue: 0.4)
                                )
                                .foregroundColor(.white)
                                .cornerRadius(10)
                            }
                            .disabled(isLoading || email.isEmpty || password.isEmpty)
                        }
                        .padding(24)
                        .background(Color(UIColor.systemBackground))
                        .cornerRadius(16)
                        .shadow(color: .black.opacity(0.06), radius: 12, y: 4)
                        .frame(maxWidth: 420)
                    }
                    .padding(.horizontal, 24)

                    Spacer(minLength: geo.size.height * 0.12)
                }
                .frame(minHeight: geo.size.height)
            }
        }
        .background(Color(UIColor.systemGroupedBackground).ignoresSafeArea())
    }

    @ViewBuilder
    private func formField<Content: View>(label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.secondary)
            content()
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(UIColor.separator), lineWidth: 1)
                )
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
