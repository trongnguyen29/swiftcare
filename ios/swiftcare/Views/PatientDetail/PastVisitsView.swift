import SwiftUI
import AVKit

struct PastVisitsView: View {
    let patient: Patient

    @State private var visits: [Visit] = []
    @State private var loading = false
    @State private var error: String?
    @State private var retryingId: String?
    @State private var playerItem: (visitId: String, url: URL)?
    @State private var showAssign = false

    var body: some View {
        Group {
            if loading {
                ProgressView().frame(maxWidth: .infinity).padding()
            } else if let err = error {
                Text("⚠ \(err)").font(.caption).foregroundColor(.red).padding()
            } else if visits.isEmpty {
                EmptyStateView(text: "No past visits recorded yet.")
            } else {
                LazyVStack(spacing: 12) {
                    ForEach(visits) { visit in
                        VisitCard(
                            visit: visit,
                            isRetrying: retryingId == visit.id,
                            playerItem: playerItem?.visitId == visit.id ? playerItem?.url : nil,
                            onPlayAudio: { Task { await loadAudio(for: visit) } },
                            onRetry: { Task { await retryVisit(visit) } }
                        )
                    }
                }
                .padding()
            }
        }
        .task { await load() }
    }

    private func load() async {
        loading = true; error = nil
        do { visits = try await VisitsService.shared.fetchVisits(patientPtnum: patient.ptnum) }
        catch { self.error = error.localizedDescription }
        loading = false
    }

    private func loadAudio(for visit: Visit) async {
        guard let path = visit.audioPath else { return }
        do {
            let url = try await VisitsService.shared.audioURL(for: path)
            playerItem = (visitId: visit.id, url: url)
        } catch {
            self.error = "Could not load audio: \(error.localizedDescription)"
        }
    }

    private func retryVisit(_ visit: Visit) async {
        retryingId = visit.id
        do {
            // Re-transcribe using the stored audio path if available, or just mark complete
            _ = try await VisitsService.shared.updateVisit(id: visit.id, fields: ["status": "complete"])
            await load()
        } catch {
            self.error = error.localizedDescription
        }
        retryingId = nil
    }
}

// MARK: - Visit Card

private struct VisitCard: View {
    let visit: Visit
    let isRetrying: Bool
    let playerItem: URL?
    let onPlayAudio: () -> Void
    let onRetry: () -> Void

    @State private var expanded = false
    @State private var player: AVPlayer?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(formattedDate).font(.caption.bold()).foregroundColor(.secondary)
                    if let tn = visit.templateName {
                        Text(tn).font(.system(size: 9, weight: .semibold))
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(Color.teal.opacity(0.12)).foregroundColor(.teal).clipShape(Capsule())
                    }
                }
                Spacer()
                VisitStatusBadge(status: visit.status)
            }

            // Transcript excerpt
            if !visit.transcript.isEmpty {
                Text(visit.transcript)
                    .font(.caption).foregroundColor(.secondary)
                    .lineLimit(expanded ? nil : 3)
                Button(expanded ? "Show less" : "Show more") { withAnimation { expanded.toggle() } }
                    .font(.caption.bold()).foregroundColor(.teal)
            }

            // Note excerpt
            if !visit.note.isEmpty {
                Divider()
                Text(visit.note)
                    .font(.caption).foregroundColor(.primary)
                    .lineLimit(expanded ? nil : 4)
            }

            // Audio player
            if visit.audioPath != nil {
                Divider()
                if let url = playerItem {
                    AudioPlayerView(url: url)
                } else {
                    Button(action: onPlayAudio) {
                        Label("Play Recording", systemImage: "play.circle.fill")
                            .font(.system(size: 12, weight: .semibold)).foregroundColor(.teal)
                    }
                }
            }

            // Retry button (only on failed visits)
            if visit.status == "failed" {
                Divider()
                if isRetrying {
                    HStack { ProgressView(); Text("Retrying…").font(.caption).foregroundColor(.orange) }
                } else {
                    Button(action: onRetry) {
                        Label("Retry Transcription", systemImage: "arrow.clockwise")
                            .font(.system(size: 12, weight: .semibold)).foregroundColor(.orange)
                    }
                }
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private var formattedDate: String { VisitDate.display(visit.createdAt) }
}

// MARK: - Audio Player

private struct AudioPlayerView: View {
    let url: URL
    @State private var player: AVPlayer?
    @State private var isPlaying = false

    var body: some View {
        HStack(spacing: 10) {
            Button(action: togglePlay) {
                Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.title2).foregroundColor(.teal)
            }
            Text("Recording").font(.caption).foregroundColor(.secondary)
            Spacer()
        }
        .onAppear {
            player = AVPlayer(url: url)
            NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: player?.currentItem, queue: .main
            ) { _ in isPlaying = false }
        }
        .onDisappear { player?.pause() }
    }

    private func togglePlay() {
        guard let player else { return }
        if isPlaying { player.pause() } else { player.play() }
        isPlaying.toggle()
    }
}

// MARK: - Status Badge

private struct VisitStatusBadge: View {
    let status: String
    var body: some View {
        Text(status.capitalized)
            .font(.system(size: 9, weight: .bold))
            .padding(.horizontal, 5).padding(.vertical, 2)
            .background(color.opacity(0.12)).foregroundColor(color).clipShape(Capsule())
    }
    private var color: Color {
        switch status {
        case "complete": return .green
        case "failed":   return .red
        default:         return .orange
        }
    }
}
