import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthService

    @State private var email    = ""
    @State private var password = ""
    @State private var isLoading   = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color(UIColor.systemGroupedBackground).ignoresSafeArea()

            VStack(spacing: 40) {
                Spacer()

                // Logo
                VStack(spacing: 12) {
                    if UIImage(named: "SwiftCareLogo") != nil {
                        Image("SwiftCareLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 120, height: 120)
                    } else {
                        Image(systemName: "stethoscope")
                            .font(.system(size: 56))
                            .foregroundColor(Color(red: 0.1, green: 0.2, blue: 0.4))
                    }
                    Text("SwiftCare")
                        .font(.system(size: 34, weight: .bold))
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
                                Text("Sign In").fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            email.isEmpty || password.isEmpty
                                ? Color.gray.opacity(0.35)
                                : Color(red: 0.1, green: 0.2, blue: 0.4)
                        )
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    }
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                }
                .padding(28)
                .background(Color(UIColor.systemBackground))
                .cornerRadius(18)
                .shadow(color: .black.opacity(0.07), radius: 16, y: 6)
                .frame(maxWidth: 440)

                Spacer()
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 32)
        }
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
                .background(RoundedRectangle(cornerRadius: 8).stroke(Color(UIColor.separator), lineWidth: 1))
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
