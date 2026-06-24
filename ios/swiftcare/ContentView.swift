import SwiftUI

struct ContentView: View {
    @EnvironmentObject var auth: AuthService
    @State private var selectedPatient: Patient?

    var body: some View {
        Group {
            if auth.isLoading {
                ProgressView("Loading…")
            } else if auth.isSignedIn {
                mainApp
            } else {
                LoginView()
            }
        }
    }

    private var mainApp: some View {
        TabView {
            NavigationSplitView {
                PatientListView(selectedPatient: $selectedPatient)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .principal) {
                            HStack(spacing: 6) {
                                if UIImage(named: "SwiftCareLogo") != nil {
                                    Image("SwiftCareLogo")
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 28, height: 28)
                                        .clipShape(Circle())
                                }
                                Text("SwiftCare")
                                    .font(.headline.bold())
                            }
                        }
                        ToolbarItem(placement: .navigationBarTrailing) {
                            Button("Sign Out") {
                                Task { await auth.signOut() }
                            }
                            .foregroundColor(.red)
                        }
                    }
            } detail: {
                if let patient = selectedPatient {
                    PatientDetailView(patient: patient)
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "cross.case.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.brand)
                        Text("Select a patient")
                            .font(.title2.bold())
                        Text("Choose a patient from the sidebar to view their EHR summary and start recording a visit.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                    }
                }
            }
            .tabItem { Label("Patients", systemImage: "person.2.fill") }

            GlobalAppointmentsView()
                .tabItem { Label("Appointments", systemImage: "calendar") }
        }
    }
}

#Preview {
    ContentView().environmentObject(AuthService.shared)
}
