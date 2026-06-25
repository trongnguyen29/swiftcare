import SwiftUI

struct TouchIDEnrollPrompt: View {
    @EnvironmentObject var auth: AuthService
    @Binding var isPresented: Bool
    @State private var isEnabling = false

    private let burgundy = Color(red: 0.52, green: 0.08, blue: 0.22)

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            VStack(spacing: 16) {
                Image(systemName: "touchid")
                    .font(.system(size: 64))
                    .foregroundColor(burgundy)

                Text("Enable Touch ID?")
                    .font(.title2.bold())

                Text("Sign in faster next time using Touch ID instead of your password.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            VStack(spacing: 12) {
                Button(action: {
                    Task {
                        isEnabling = true
                        let enabled = await auth.enableBiometrics()
                        isEnabling = false
                        isPresented = false // dismiss either way
                        _ = enabled
                    }
                }) {
                    Group {
                        if isEnabling {
                            ProgressView().progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            HStack(spacing: 8) {
                                Image(systemName: "touchid")
                                Text("Enable Touch ID")
                                    .fontWeight(.semibold)
                            }
                        }
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: 300)
                    .padding()
                    .background(burgundy)
                    .cornerRadius(12)
                }
                .disabled(isEnabling)

                Button("Not Now") {
                    isPresented = false
                }
                .font(.subheadline)
                .foregroundColor(.secondary)
            }

            Spacer()
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}
