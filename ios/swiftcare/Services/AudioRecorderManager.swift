import Foundation
import AVFoundation
import Combine

@MainActor
class AudioRecorderManager: NSObject, ObservableObject, AVAudioRecorderDelegate {
    var audioRecorder: AVAudioRecorder?

    @Published var isRecording = false
    @Published var recordingDuration: TimeInterval = 0
    private var recordingStartTime: Date?

    // URL of the last completed recording (set after stopRecording)
    private(set) var lastRecordingURL: URL?

    func checkPermission() async -> Bool {
        await AVAudioApplication.requestRecordPermission()
    }

    func startRecording() {
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .default)
            try audioSession.setActive(true)

            // Unique file per recording so previous recordings are never overwritten.
            let dir = recordingsDirectory()
            let url = dir.appendingPathComponent("\(UUID().uuidString).wav")
            lastRecordingURL = nil

            let settings: [String: Any] = [
                AVFormatIDKey:          Int(kAudioFormatLinearPCM),
                AVSampleRateKey:        16000,
                AVNumberOfChannelsKey:  1,
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsFloatKey:  false,
                AVLinearPCMIsBigEndianKey: false,
            ]

            audioRecorder = try AVAudioRecorder(url: url, settings: settings)
            audioRecorder?.delegate = self
            audioRecorder?.record()

            recordingStartTime = Date()
            isRecording = true
            recordingDuration = 0
        } catch {
            print("Failed to start recording: \(error.localizedDescription)")
        }
    }

    // Returns (base64-encoded audio, file URL, duration).
    func stopRecording() -> (audioB64: String, url: URL, duration: TimeInterval)? {
        guard let recorder = audioRecorder else { return nil }
        let url = recorder.url
        let duration = recordingStartTime.map { Date().timeIntervalSince($0) } ?? recordingDuration
        recordingDuration = duration

        recorder.stop()
        isRecording = false
        recordingStartTime = nil

        do {
            let data = try Data(contentsOf: url)
            lastRecordingURL = url
            return (data.base64EncodedString(), url, duration)
        } catch {
            print("Failed to read recording: \(error.localizedDescription)")
            return nil
        }
    }

    func deleteRecording(at url: URL) {
        try? FileManager.default.removeItem(at: url)
        if lastRecordingURL == url { lastRecordingURL = nil }
    }

    // MARK: - Directories

    private func recordingsDirectory() -> URL {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Recordings", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    // Legacy helper kept for compatibility
    private func getDocumentsDirectory() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
}
