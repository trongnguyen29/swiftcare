import SwiftUI

struct BiometricLockView: View {
    @EnvironmentObject var auth: AuthService

    private let burgundy = Color(red: 0.52, green: 0.08, blue: 0.22)

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [burgundy, Color(red: 0.68, green: 0.18, blue: 0.35)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 36) {
                Spacer()

                if UIImage(named: "SwiftCareLogo") != nil {
                    Image("SwiftCareLogo")
                        .resizable()
                        .scaledToFill()
                        .frame(width: 90, height: 90)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.white.opacity(0.3), lineWidth: 1))
                }

                VStack(spacing: 8) {
                    Text("SwiftCare")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.white)
                    Text("Tap below to unlock")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                }

                Button(action: { Task { await auth.unlockWithBiometrics() } }) {
                    VStack(spacing: 10) {
                        Image(systemName: "touchid")
                            .font(.system(size: 52))
                            .foregroundColor(.white)
                        Text("Touch ID")
                            .font(.subheadline.bold())
                            .foregroundColor(.white.opacity(0.85))
                    }
                    .padding(28)
                    .background(Color.white.opacity(0.12))
                    .cornerRadius(20)
                }

                Button("Use Password Instead") {
                    Task { await auth.signOut() }
                }
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.6))
                .padding(.top, 8)

                Spacer()
            }
        }
        .task {
            // Auto-prompt Touch ID on appear
            await auth.unlockWithBiometrics()
        }
    }
}
