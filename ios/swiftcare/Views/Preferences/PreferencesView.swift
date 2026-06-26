import SwiftUI

/// Preferences tab: security (Touch ID, 2FA) and AI-output settings.
struct PreferencesView: View {
    @EnvironmentObject var auth: AuthService
    @State private var showMFAEnroll = false

    // Placeholder AI-output settings (persisted locally; not yet wired into generation).
    @AppStorage("ai.noteStyle")   private var noteStyle = NoteStyle.bullets.rawValue
    @AppStorage("ai.detailLevel") private var detailLevel = DetailLevel.standard.rawValue
    @AppStorage("ai.tone")        private var tone = Tone.clinical.rawValue

    enum NoteStyle: String, CaseIterable, Identifiable {
        case bullets, paragraphs
        var id: String { rawValue }
        var label: String { self == .bullets ? "Bullets" : "Paragraphs" }
    }
    enum DetailLevel: String, CaseIterable, Identifiable {
        case concise, standard, detailed
        var id: String { rawValue }
        var label: String { rawValue.capitalized }
    }
    enum Tone: String, CaseIterable, Identifiable {
        case clinical, plain
        var id: String { rawValue }
        var label: String { self == .clinical ? "Clinical" : "Plain language" }
    }

    var body: some View {
        NavigationStack {
            Form {
                // MARK: Security
                Section("Security") {
                    if auth.biometricsAvailable {
                        Toggle(isOn: Binding(
                            get: { auth.biometricsEnabled },
                            set: { _ in
                                Task {
                                    if auth.biometricsEnabled { auth.disableBiometrics() }
                                    else { await auth.enableBiometrics() }
                                }
                            }
                        )) {
                            Label("Touch ID", systemImage: "touchid")
                        }
                        .tint(.brand)
                    }

                    if auth.isMFAEnrolled {
                        Label("2FA Active", systemImage: "checkmark.shield.fill")
                            .foregroundColor(.green)
                    } else {
                        Button(action: { showMFAEnroll = true }) {
                            Label("Set up 2FA", systemImage: "lock.shield")
                        }
                        .foregroundColor(.brand)
                    }
                }

                // MARK: AI Output
                Section {
                    Picker(selection: $noteStyle) {
                        ForEach(NoteStyle.allCases) { Text($0.label).tag($0.rawValue) }
                    } label: {
                        Label("Note style", systemImage: "list.bullet")
                    }
                    .pickerStyle(.menu)

                    Picker(selection: $detailLevel) {
                        ForEach(DetailLevel.allCases) { Text($0.label).tag($0.rawValue) }
                    } label: {
                        Label("Detail level", systemImage: "text.alignleft")
                    }
                    .pickerStyle(.menu)

                    Picker(selection: $tone) {
                        ForEach(Tone.allCases) { Text($0.label).tag($0.rawValue) }
                    } label: {
                        Label("Default tone", systemImage: "character.bubble")
                    }
                    .pickerStyle(.menu)

                } header: {
                    Text("AI Output")
                }
            }
            .navigationTitle("Preferences")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showMFAEnroll) {
                MFAEnrollView().environmentObject(auth)
            }
        }
    }
}

#Preview {
    PreferencesView().environmentObject(AuthService.shared)
}
