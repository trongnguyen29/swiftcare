import SwiftUI

struct ChatMessage: Identifiable {
    let id   = UUID()
    let role: String
    let content: String
}

struct AIChatView: View {
    let patient: Patient
    @Environment(\.presentationMode) var presentationMode

    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false

    private let suggestions = [
        "Summarize this patient's key clinical concerns",
        "What drug interactions should I watch for?",
        "Are there any care gaps based on current data?",
        "What does the SCC score indicate here?",
    ]

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Status bar
                HStack {
                    Circle().fill(Color.green).frame(width: 7, height: 7)
                    Text("AI Assistant · ready")
                        .font(.system(size: 10)).foregroundColor(.secondary)
                    Spacer()
                    if !messages.isEmpty {
                        Button("Clear") { messages = [] }
                            .font(.system(size: 12)).foregroundColor(.secondary)
                    }
                }
                .padding(.horizontal).padding(.vertical, 6)
                .background(Color(UIColor.secondarySystemBackground))

                Divider()

                // Messages
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            // Empty state with suggestion chips
                            if messages.isEmpty && !isLoading {
                                VStack(spacing: 12) {
                                    Image(systemName: "sparkles")
                                        .font(.system(size: 32)).foregroundColor(.purple.opacity(0.6))
                                    Text("Ask anything about this patient")
                                        .font(.headline)
                                    Text("Full patient record loaded as context")
                                        .font(.caption).foregroundColor(.secondary)

                                    VStack(spacing: 8) {
                                        ForEach(suggestions, id: \.self) { q in
                                            Button(q) { inputText = q }
                                                .font(.system(size: 13))
                                                .multilineTextAlignment(.center)
                                                .padding(.horizontal, 14).padding(.vertical, 8)
                                                .background(Color(UIColor.secondarySystemBackground))
                                                .foregroundColor(.primary)
                                                .cornerRadius(16)
                                        }
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.top, 40)
                            }

                            ForEach(messages) { msg in
                                HStack {
                                    if msg.role == "user" {
                                        Spacer()
                                        VStack(alignment: .trailing, spacing: 2) {
                                            Text("You").font(.caption2).foregroundColor(.secondary)
                                            Text(msg.content)
                                                .padding(10)
                                                .background(Color.teal)
                                                .foregroundColor(.white)
                                                .cornerRadius(14)
                                        }
                                        .padding(.leading, 60)
                                    } else {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("AI Response").font(.caption2).foregroundColor(.secondary)
                                            Text(msg.content)
                                                .padding(10)
                                                .background(Color(UIColor.secondarySystemBackground))
                                                .cornerRadius(14)
                                        }
                                        .padding(.trailing, 60)
                                        Spacer()
                                    }
                                }
                                .padding(.horizontal)
                                .id(msg.id)
                            }

                            if isLoading {
                                HStack {
                                    HStack(spacing: 4) {
                                        ForEach(0..<3, id: \.self) { i in
                                            Circle().fill(Color.secondary)
                                                .frame(width: 6, height: 6)
                                                .opacity(0.4)
                                        }
                                    }
                                    .padding(10)
                                    .background(Color(UIColor.secondarySystemBackground))
                                    .cornerRadius(14)
                                    Spacer()
                                }
                                .padding(.horizontal)
                                .id("loading")
                            }
                        }
                        .padding(.vertical)
                    }
                    .onChange(of: messages.count) {
                        withAnimation { proxy.scrollTo(messages.last?.id) }
                    }
                    .onChange(of: isLoading) {
                        if isLoading { withAnimation { proxy.scrollTo("loading") } }
                    }
                }

                Divider()

                // Input row
                HStack(spacing: 10) {
                    TextField("Ask about this patient… (Enter to send)", text: $inputText, axis: .vertical)
                        .textFieldStyle(.plain)
                        .padding(10)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(12)
                        .lineLimit(1...4)
                        .onSubmit { sendMessage() }

                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 30))
                            .foregroundColor(canSend ? .teal : .secondary)
                    }
                    .disabled(!canSend)
                }
                .padding()

                Text("Clinical output is for decision support only — always apply professional judgment.")
                    .font(.caption2).foregroundColor(.secondary).padding(.bottom, 8)
            }
            .navigationTitle("Ask AI — \(patient.displayName)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { presentationMode.wrappedValue.dismiss() }
                }
            }
        }
    }

    var canSend: Bool { !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading }

    func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }

        messages.append(ChatMessage(role: "user", content: text))
        inputText = ""
        isLoading = true

        Task {
            let context    = PatientContext.build(for: patient)
            let apiMessages = messages.map { ["role": $0.role, "content": $0.content] }

            do {
                let reply = try await APIService.shared.chatWithPatientContext(messages: apiMessages, patientContext: context)
                messages.append(ChatMessage(role: "assistant", content: reply))
            } catch {
                messages.append(ChatMessage(role: "assistant", content: "⚠ Error: \(error.localizedDescription)"))
            }
            isLoading = false
        }
    }
}
