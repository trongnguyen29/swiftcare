import SwiftUI

struct VisitView: View {
    let patient: Patient
    @StateObject private var recorder = AudioRecorderManager()
    
    @State private var transcript: String = ""
    @State private var soapNote: String = ""
    @State private var isProcessing = false
    @State private var errorMsg: String?
    
    var body: some View {
        VStack(spacing: 16) {
            // Recorder Card
            CardView(title: "Record Visit", icon: "mic.fill") {
                VStack(spacing: 16) {
                    Text(recorder.isRecording ? "Recording in progress..." : "Ready to record")
                        .font(.headline)
                    
                    Text(timeString(from: recorder.recordingDuration))
                        .font(.system(size: 48, weight: .light, design: .monospaced))
                        .foregroundColor(recorder.isRecording ? .red : .primary)
                    
                    HStack(spacing: 24) {
                        if recorder.isRecording {
                            Button(action: stopAndProcess) {
                                Image(systemName: "stop.fill")
                                    .font(.system(size: 24))
                                    .foregroundColor(.white)
                                    .padding(20)
                                    .background(Color.red)
                                    .clipShape(Circle())
                            }
                        } else {
                            Button(action: startRecording) {
                                Image(systemName: "mic.fill")
                                    .font(.system(size: 24))
                                    .foregroundColor(.white)
                                    .padding(20)
                                    .background(Color.teal)
                                    .clipShape(Circle())
                            }
                        }
                    }
                    
                    if isProcessing {
                        ProgressView("Transcribing & generating SOAP note...")
                            .padding(.top)
                    }
                    
                    if let error = errorMsg {
                        Text("⚠ \(error)")
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            
            if !transcript.isEmpty {
                CardView(title: "Transcript", icon: "doc.plaintext") {
                    Text(transcript)
                        .font(.body)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(UIColor.systemBackground))
                        .cornerRadius(8)
                }
            }
            
            if !soapNote.isEmpty {
                CardView(title: "Generated SOAP Note", icon: "doc.text.fill") {
                    Text(soapNote)
                        .font(.body)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(UIColor.systemBackground))
                        .cornerRadius(8)
                }
            }
        }
    }
    
    func startRecording() {
        Task {
            let granted = await recorder.checkPermission()
            if granted {
                DispatchQueue.main.async {
                    errorMsg = nil
                    transcript = ""
                    soapNote = ""
                    recorder.startRecording()
                }
            } else {
                errorMsg = "Microphone permission denied"
            }
        }
    }
    
    func stopAndProcess() {
        guard let b64 = recorder.stopRecording() else { return }
        
        isProcessing = true
        errorMsg = nil
        
        Task {
            do {
                let text = try await APIService.shared.transcribeAudio(audioB64: b64, mimeType: "audio/m4a", patientId: patient.ptnum)
                DispatchQueue.main.async {
                    self.transcript = text
                }
                
                let context = PatientContext.build(for: patient)
                let note = try await APIService.shared.summarizeTranscript(transcript: text, patientContext: context)
                DispatchQueue.main.async {
                    self.soapNote = note
                }
            } catch {
                DispatchQueue.main.async {
                    self.errorMsg = error.localizedDescription
                }
            }
            DispatchQueue.main.async {
                self.isProcessing = false
            }
        }
    }
    
    func timeString(from interval: TimeInterval) -> String {
        let min = Int(interval) / 60
        let sec = Int(interval) % 60
        return String(format: "%02d:%02d", min, sec)
    }
}
