import SwiftUI

struct ChatMessage: Identifiable {
    let id = UUID()
    let role: String
    let content: String
}

struct AIChatView: View {
    let patient: Patient
    @Environment(\.presentationMode) var presentationMode
    
    @State private var messages: [ChatMessage] = []
    @State private var inputText: String = ""
    @State private var isLoading = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                ScrollView {
                    LazyVStack(spacing: 16) {
                        ForEach(messages) { msg in
                            HStack {
                                if msg.role == "user" {
                                    Spacer()
                                    Text(msg.content)
                                        .padding()
                                        .background(Color.teal)
                                        .foregroundColor(.white)
                                        .cornerRadius(16)
                                        .padding(.leading, 40)
                                } else {
                                    Text(msg.content)
                                        .padding()
                                        .background(Color(UIColor.secondarySystemBackground))
                                        .cornerRadius(16)
                                        .padding(.trailing, 40)
                                    Spacer()
                                }
                            }
                            .padding(.horizontal)
                        }
                        
                        if isLoading {
                            HStack {
                                ProgressView()
                                    .padding()
                                    .background(Color(UIColor.secondarySystemBackground))
                                    .cornerRadius(16)
                                Spacer()
                            }
                            .padding(.horizontal)
                        }
                    }
                    .padding(.vertical)
                }
                
                Divider()
                
                HStack {
                    TextField("Ask AI about this patient...", text: $inputText)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                    
                    Button(action: sendMessage) {
                        Image(systemName: "paperplane.fill")
                            .foregroundColor(.white)
                            .padding(10)
                            .background(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading ? Color.gray : Color.teal)
                            .clipShape(Circle())
                    }
                    .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
                }
                .padding()
            }
            .navigationTitle("Ask AI")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        }
    }
    
    func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        
        messages.append(ChatMessage(role: "user", content: text))
        inputText = ""
        isLoading = true
        
        Task {
            let context = PatientContext.build(for: patient)
            let apiMessages = messages.map { ["role": $0.role, "content": $0.content] }
            
            do {
                let reply = try await APIService.shared.chatWithPatientContext(messages: apiMessages, patientContext: context)
                DispatchQueue.main.async {
                    self.messages.append(ChatMessage(role: "assistant", content: reply))
                }
            } catch {
                DispatchQueue.main.async {
                    self.messages.append(ChatMessage(role: "assistant", content: "⚠ Error: \(error.localizedDescription)"))
                }
            }
            
            DispatchQueue.main.async {
                self.isLoading = false
            }
        }
    }
}
