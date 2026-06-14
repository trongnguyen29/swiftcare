import Foundation
import AVFoundation
import Combine

@MainActor
class AudioRecorderManager: NSObject, ObservableObject, AVAudioRecorderDelegate {
    var audioRecorder: AVAudioRecorder?

    @Published var isRecording = false
    @Published var recordingDuration: TimeInterval = 0
    private var timer: Timer?

    func checkPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    func startRecording() {
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .default)
            try audioSession.setActive(true)

            let url = getDocumentsDirectory().appendingPathComponent("recording.wav")

            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatLinearPCM),
                AVSampleRateKey: 16000,
                AVNumberOfChannelsKey: 1,
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsFloatKey: false,
                AVLinearPCMIsBigEndianKey: false
            ]

            audioRecorder = try AVAudioRecorder(url: url, settings: settings)
            audioRecorder?.delegate = self
            audioRecorder?.record()

            isRecording = true
            recordingDuration = 0

            timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    self?.recordingDuration += 1
                }
            }
        } catch {
            print("Failed to start recording: \(error.localizedDescription)")
        }
    }

    func stopRecording() -> String? {
        audioRecorder?.stop()
        isRecording = false
        timer?.invalidate()
        timer = nil

        let url = getDocumentsDirectory().appendingPathComponent("recording.wav")
        do {
            let data = try Data(contentsOf: url)
            return data.base64EncodedString()
        } catch {
            print("Failed to encode audio: \(error.localizedDescription)")
            return nil
        }
    }

    private func getDocumentsDirectory() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
}
