import SwiftUI

// MARK: - State machine (mirrors VoiceRecorder + TranscriptPanel)

enum RecorderState {
    case idle
    case recording
    case transcribing
    case done
    case error(String)

    var label: String {
        switch self {
        case .idle:         return "Ready"
        case .recording:    return "Recording"
        case .transcribing: return "Transcribing…"
        case .done:         return "Done"
        case .error:        return "Error"
        }
    }
}

struct VisitView: View {
    let patient: Patient
    @StateObject private var recorder = AudioRecorderManager()

    @State private var recorderState: RecorderState = .idle
    @State private var duration: TimeInterval = 0
    @State private var transcript: String = ""
    @State private var clinicalNote: String = ""
    @State private var noteGenerating = false
    @State private var noteError: String?
    @State private var saved = false
    @State private var showHistory = false
    @State private var history: [SavedNote] = []
    @State private var copiedTranscript = false
    @State private var copiedNote = false

    // Template — two independent selections
    @State private var selectedNoteFormat: TranscriptionTemplate = TemplateStore.shared.selectedNoteFormat
    @State private var selectedDiseaseTemplate: TranscriptionTemplate? = TemplateStore.shared.selectedDiseaseTemplate
    @State private var customPrompt: String = TemplateStore.shared.customPrompt
    @State private var showNoteFormatPicker = false
    @State private var showDiseasePicker = false

    // Show template selectors only when not actively recording / transcribing
    private var showTemplateSelectors: Bool {
        switch recorderState {
        case .idle, .error, .done: return true
        default: return false
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                recorderCard
                if case .done = recorderState { transcriptCard }
                if case .done = recorderState { noteCard }
            }
            .padding()
        }
        .background(Color(UIColor.systemGroupedBackground))
        .onAppear { loadHistory() }
        .sheet(isPresented: $showNoteFormatPicker) {
            TemplatePickerView(
                selectedNoteFormat: $selectedNoteFormat,
                selectedDiseaseTemplate: $selectedDiseaseTemplate,
                customPrompt: $customPrompt,
                initialCategory: .noteFormat
            ) {
                TemplateStore.shared.selectedNoteFormat = selectedNoteFormat
                TemplateStore.shared.customPrompt = customPrompt
            }
            .presentationDetents([.large])
        }
        .sheet(isPresented: $showDiseasePicker) {
            TemplatePickerView(
                selectedNoteFormat: $selectedNoteFormat,
                selectedDiseaseTemplate: $selectedDiseaseTemplate,
                customPrompt: $customPrompt,
                initialCategory: .disease
            ) {
                TemplateStore.shared.selectedDiseaseTemplate = selectedDiseaseTemplate
            }
            .presentationDetents([.large])
        }
    }

    // MARK: - Recorder Card

    var recorderCard: some View {
        CardView(title: "Visit Recorder", icon: "mic.fill") {
            VStack(spacing: 16) {

                // ── Note Format + Disease Focus selectors ──────────────────
                if showTemplateSelectors {
                    VStack(alignment: .leading, spacing: 10) {

                        // Note Format row
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Label("Note Format", systemImage: "doc.text")
                                    .font(.caption.bold())
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Button {
                                    showNoteFormatPicker = true
                                } label: {
                                    HStack(spacing: 2) {
                                        Text("More")
                                        Image(systemName: "chevron.right")
                                    }
                                    .font(.caption)
                                    .foregroundStyle(.teal)
                                }
                            }
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(TranscriptionTemplate.noteFormatTemplates) { fmt in
                                        InlineChip(
                                            label: fmt.name,
                                            icon: fmt.icon,
                                            isSelected: selectedNoteFormat.id == fmt.id,
                                            accent: .teal
                                        ) {
                                            selectedNoteFormat = fmt
                                            TemplateStore.shared.selectedNoteFormat = fmt
                                        }
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }

                        Divider()

                        // Disease Focus row
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Label("Disease Focus", systemImage: "cross.case")
                                    .font(.caption.bold())
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Button {
                                    showDiseasePicker = true
                                } label: {
                                    HStack(spacing: 2) {
                                        Text("More")
                                        Image(systemName: "chevron.right")
                                    }
                                    .font(.caption)
                                    .foregroundStyle(.indigo)
                                }
                            }
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    // "None" chip — clears disease focus
                                    InlineChip(
                                        label: "None",
                                        icon: "circle.slash",
                                        isSelected: selectedDiseaseTemplate == nil,
                                        accent: .indigo
                                    ) {
                                        selectedDiseaseTemplate = nil
                                        TemplateStore.shared.selectedDiseaseTemplate = nil
                                    }
                                    ForEach(TranscriptionTemplate.diseaseTemplates) { disease in
                                        InlineChip(
                                            label: disease.name,
                                            icon: disease.icon,
                                            isSelected: selectedDiseaseTemplate?.id == disease.id,
                                            accent: .indigo
                                        ) {
                                            selectedDiseaseTemplate = disease
                                            TemplateStore.shared.selectedDiseaseTemplate = disease
                                        }
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                    .padding(12)
                    .background(Color(UIColor.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // ── Status badge ───────────────────────────────────────────
                HStack(spacing: 8) {
                    if case .recording = recorderState {
                        Circle().fill(Color.red).frame(width: 8, height: 8)
                            .opacity(Double((Int(duration) % 2 == 0) ? 1 : 0.3))
                            .animation(.easeInOut(duration: 0.5).repeatForever(), value: duration)
                    }
                    Text(recorderState.label)
                        .font(.headline)
                        .foregroundColor(stateLabelColor)
                    if case .recording = recorderState {
                        Text(timeString(from: duration))
                            .font(.headline.monospacedDigit())
                            .foregroundColor(.red)
                    }
                }

                // Big time display
                if case .recording = recorderState {
                    Text(timeString(from: duration))
                        .font(.system(size: 52, weight: .thin, design: .monospaced))
                        .foregroundColor(.red)
                }

                // Controls
                HStack(spacing: 24) {
                    switch recorderState {
                    case .idle, .error:
                        Button(action: startRecording) {
                            Circle().fill(Color.teal)
                                .frame(width: 60, height: 60)
                                .overlay(Image(systemName: "mic.fill").font(.title2).foregroundColor(.white))
                        }
                        .buttonStyle(.plain)

                    case .recording:
                        Button(action: stopAndTranscribe) {
                            Circle().fill(Color.red)
                                .frame(width: 60, height: 60)
                                .overlay(Image(systemName: "stop.fill").font(.title2).foregroundColor(.white))
                        }
                        .buttonStyle(.plain)

                    case .transcribing:
                        ProgressView().scaleEffect(1.5)
                            .frame(width: 60, height: 60)

                    case .done:
                        Button("New Recording") {
                            withAnimation { recorderState = .idle; duration = 0; transcript = ""; clinicalNote = ""; saved = false; noteError = nil }
                        }
                        .font(.headline)
                        .padding(.horizontal, 20).padding(.vertical, 10)
                        .background(Color.teal.opacity(0.1))
                        .foregroundColor(.teal).cornerRadius(10)
                    }
                }

                // Error
                if case let .error(msg) = recorderState {
                    Text("⚠ \(msg)").font(.caption).foregroundColor(.red).multilineTextAlignment(.center)
                }

                Text("Tap mic to start recording a visit. Audio is transcribed locally.")
                    .font(.caption2).foregroundColor(.secondary).multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            .frame(maxWidth: .infinity)
        }
    }

    var stateLabelColor: Color {
        switch recorderState {
        case .recording: return .red
        case .done: return .green
        case .error: return .red
        default: return .primary
        }
    }

    // MARK: - Transcript Card (mirrors TranscriptPanel.tsx)

    var transcriptCard: some View {
        CardView(title: "Transcript & Notes") {
            VStack(alignment: .leading, spacing: 12) {
                // Header buttons
                HStack(spacing: 10) {
                    Button(showHistory ? "Hide History" : "History (\(history.count))") {
                        withAnimation { showHistory.toggle() }
                    }
                    .font(.system(size: 12))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.gray.opacity(0.1)).cornerRadius(6).foregroundColor(.secondary)

                    Spacer()

                    if !showHistory {
                        Button(action: { UIPasteboard.general.string = transcript; copiedTranscript = true }) {
                            Label(copiedTranscript ? "Copied!" : "Copy", systemImage: copiedTranscript ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 12))
                        }
                        .foregroundColor(.secondary)
                        .onChange(of: copiedTranscript) { val in
                            if val { DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copiedTranscript = false } }
                        }
                    }
                }

                if showHistory {
                    if history.isEmpty {
                        EmptyStateView(text: "No saved notes for this patient.")
                    } else {
                        VStack(spacing: 12) {
                            ForEach(history) { note in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(spacing: 6) {
                                        Text(ISO8601DateFormatter().date(from: note.createdAt).map { $0.formatted(.dateTime) } ?? note.createdAt)
                                            .font(.caption.bold()).foregroundColor(.secondary)
                                        if let tName = note.templateName {
                                            Text(tName)
                                                .font(.system(size: 9, weight: .semibold))
                                                .padding(.horizontal, 5).padding(.vertical, 2)
                                                .background(Color.teal.opacity(0.12))
                                                .foregroundColor(.teal)
                                                .clipShape(Capsule())
                                        }
                                    }
                                    Text(note.transcript).font(.caption).foregroundColor(.secondary).lineLimit(3)
                                    if !note.notes.isEmpty {
                                        Text(note.notes).font(.caption).foregroundColor(.primary).lineLimit(4)
                                    }
                                }
                                .padding()
                                .background(Color(UIColor.systemBackground))
                                .cornerRadius(8)
                            }
                        }
                    }
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Transcription").font(.caption.bold()).foregroundColor(.secondary)
                        TextEditor(text: $transcript)
                            .font(.body)
                            .frame(minHeight: 100)
                            .padding(8)
                            .background(Color(UIColor.systemBackground))
                            .cornerRadius(8)
                            .onChange(of: transcript) { _ in saved = false }
                    }
                }
            }
        }
    }

    // MARK: - Clinical Note Card

    var noteCard: some View {
        CardView(title: "Clinical Note") {
            VStack(alignment: .leading, spacing: 12) {

                // ── Active selection indicator ─────────────────────────────
                HStack(spacing: 6) {
                    Label(selectedNoteFormat.name, systemImage: selectedNoteFormat.icon)
                        .font(.caption.bold())
                        .foregroundStyle(.teal)
                    if let disease = selectedDiseaseTemplate {
                        Text("·").font(.caption).foregroundStyle(.secondary)
                        Label(disease.name, systemImage: disease.icon)
                            .font(.caption.bold())
                            .foregroundStyle(.indigo)
                    }
                }

                // ── Actions ────────────────────────────────────────────────
                HStack(spacing: 10) {
                    Button {
                        Task { await generateNote() }
                    } label: {
                        Label(noteGenerating ? "Generating…" : "✦ Generate Note", systemImage: "")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .disabled(noteGenerating || transcript.isEmpty)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.purple.opacity(0.1)).cornerRadius(6).foregroundColor(.purple)

                    Button(action: saveNote) {
                        Label("Save Note", systemImage: "square.and.arrow.down")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .disabled(transcript.isEmpty)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.teal.opacity(0.1)).cornerRadius(6).foregroundColor(.teal)

                    if saved {
                        Label("Saved", systemImage: "checkmark.circle.fill")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.green)
                    }

                    Spacer()

                    Button {
                        UIPasteboard.general.string = clinicalNote; copiedNote = true
                    } label: {
                        Label(copiedNote ? "Copied!" : "Copy", systemImage: copiedNote ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 12))
                    }
                    .foregroundColor(.secondary)
                    .disabled(clinicalNote.isEmpty)
                    .onChange(of: copiedNote) { val in
                        if val { DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copiedNote = false } }
                    }
                }

                if let error = noteError {
                    Text("⚠ \(error)").font(.caption).foregroundColor(.red)
                }

                if !clinicalNote.isEmpty {
                    HStack(spacing: 4) {
                        Text("Clinical Note")
                            .font(.caption.bold()).foregroundColor(.secondary)
                        Text("AI DRAFT")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 4).padding(.vertical, 1)
                            .background(Color.blue).foregroundColor(.white).cornerRadius(3)
                    }
                }

                TextEditor(text: $clinicalNote)
                    .font(.body)
                    .frame(minHeight: clinicalNote.isEmpty ? 60 : 200)
                    .padding(8)
                    .background(Color(UIColor.systemBackground))
                    .cornerRadius(8)
                    .opacity(noteGenerating ? 0.5 : 1)
                    .overlay(
                        Group {
                            if clinicalNote.isEmpty && !noteGenerating {
                                Text("Tap ✦ Generate Note for an AI-drafted \(selectedNoteFormat.name) note, or type manually…")
                                    .font(.body).foregroundColor(.secondary).padding(12)
                                    .allowsHitTesting(false)
                            }
                        },
                        alignment: .topLeading
                    )
                    .onChange(of: clinicalNote) { _ in saved = false }

                if !clinicalNote.isEmpty {
                    Text("AI-drafted — review and edit before saving. Not a substitute for physician judgment.")
                        .font(.caption2).foregroundColor(.secondary)
                }
            }
        }
    }

    // MARK: - Actions

    func startRecording() {
        Task {
            let granted = await recorder.checkPermission()
            guard granted else {
                recorderState = .error("Microphone permission denied")
                return
            }
            transcript = ""; clinicalNote = ""; saved = false; duration = 0
            recorder.startRecording()
            recorderState = .recording

            // Tick timer
            Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
                if case .recording = recorderState {
                    duration += 1
                } else {
                    t.invalidate()
                }
            }
        }
    }

    func stopAndTranscribe() {
        guard let audioB64 = recorder.stopRecording() else {
            recorderState = .error("Recording failed")
            return
        }
        recorderState = .transcribing

        Task {
            do {
                let text = try await APIService.shared.transcribeAudio(audioB64: audioB64, mimeType: "audio/wav", patientId: patient.ptnum)
                transcript = text
                recorderState = .done
            } catch {
                recorderState = .error(error.localizedDescription)
            }
        }
    }

    func generateNote() async {
        guard !transcript.isEmpty else { return }
        noteGenerating = true
        noteError = nil
        do {
            let context = PatientContext.build(for: patient)
            // Sync local state to store so effectivePromptInstructions is current
            TemplateStore.shared.selectedNoteFormat = selectedNoteFormat
            TemplateStore.shared.selectedDiseaseTemplate = selectedDiseaseTemplate
            TemplateStore.shared.customPrompt = customPrompt
            let effectivePrompt = TemplateStore.shared.effectivePromptInstructions
            clinicalNote = try await APIService.shared.summarizeTranscript(
                transcript: transcript,
                patientContext: context,
                templatePrompt: effectivePrompt.isEmpty ? nil : effectivePrompt
            )
            saved = false
        } catch {
            noteError = error.localizedDescription
        }
        noteGenerating = false
    }

    func saveNote() {
        let templateName = selectedDiseaseTemplate
            .map { "\(selectedNoteFormat.name) · \($0.name)" }
            ?? selectedNoteFormat.name
        NotesService.shared.saveNote(
            patientId: patient.ptnum,
            transcript: transcript,
            notes: clinicalNote,
            templateName: templateName
        )
        saved = true
        loadHistory()
    }

    func loadHistory() {
        history = NotesService.shared.loadNotes(patientId: patient.ptnum)
    }

    func timeString(from interval: TimeInterval) -> String {
        let m = Int(interval) / 60
        let s = Int(interval) % 60
        return String(format: "%02d:%02d", m, s)
    }
}

// MARK: - InlineChip

/// Compact horizontal-scroll pill used in the pre-record template selector rows.
private struct InlineChip: View {
    let label: String
    let icon: String
    let isSelected: Bool
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .semibold))
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                Capsule().fill(isSelected ? accent : accent.opacity(0.08))
            )
            .overlay(
                Capsule().stroke(isSelected ? accent : accent.opacity(0.3), lineWidth: 1)
            )
            .foregroundStyle(isSelected ? Color.white : accent)
        }
        .buttonStyle(.plain)
        .animation(.spring(response: 0.2, dampingFraction: 0.75), value: isSelected)
    }
}
