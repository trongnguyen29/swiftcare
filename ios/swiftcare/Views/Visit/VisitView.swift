import SwiftUI
import AVFoundation

// MARK: - State machine

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
    let patient: Patient?

    /// Incremented by parent to auto-start a recording (mirrors desktop recordSignal).
    var startSignal: Int = 0

    /// When set, the view opens an already-saved visit (transcript + note) in the
    /// editable results screen instead of starting a new recording.
    var existingVisit: Visit? = nil

    @StateObject private var recorder = AudioRecorderManager()

    @State private var recorderState: RecorderState = .idle
    @State private var duration: TimeInterval = 0
    @State private var transcript: String = ""
    @State private var soap: SOAPNote = .empty
    @State private var clinicalNote: String = ""      // serialized SOAP, for save / EHR / copy
    @State private var noteGenerating = false
    @State private var noteError: String?
    @State private var copiedNote = false
    @State private var currentVisitId: String?
    @State private var pendingAudioURL: URL?
    @State private var audioUploadFailed = false
    @State private var saveError: String?      // visit row couldn't be saved (shows the real reason)
    @State private var handledSignal: Int = 0
    @State private var showTranscript = false
    @State private var editingNote = false
    @State private var starting = false               // suppresses the setup UI while auto-starting
    @State private var showAssignSheet = false
    @State private var assignedPatientName: String?

    enum SaveState { case idle, saving, saved }
    @State private var saveState: SaveState = .idle
    @State private var autosaveTask: Task<Void, Never>?

    enum EHRPushState { case idle, pushing, success(String), failure(String) }
    @State private var ehrPushState: EHRPushState = .idle

    // Template selections (note format selector retained for patient visits; the
    // note is always rendered/edited as a structured SOAP note)
    @State private var selectedNoteFormat: TranscriptionTemplate = TemplateStore.shared.selectedNoteFormat
    @State private var selectedDiseaseTemplate: TranscriptionTemplate? = TemplateStore.shared.selectedDiseaseTemplate
    @State private var customPrompt: String = TemplateStore.shared.customPrompt
    @State private var showNoteFormatPicker = false
    @State private var showDiseasePicker = false

    // Language
    @State private var selectedLanguage: TranscriptionLanguage = .persisted

    private var showTemplateSelectors: Bool {
        switch recorderState {
        case .idle, .error: return !starting
        default: return false
        }
    }

    private var isDone: Bool {
        if case .done = recorderState { return true }
        return false
    }

    var body: some View {
        Group {
            if isDone { doneView } else { recordingScroll }
        }
        .background(Color(UIColor.systemGroupedBackground))
        .onAppear {
            if let visit = existingVisit, case .idle = recorderState, currentVisitId == nil {
                loadExisting(visit)
                return
            }
            if startSignal > 0, handledSignal != startSignal {
                handledSignal = startSignal
                starting = true
                Task { await startIfPermitted() }
            }
        }
        .onChange(of: startSignal) { _, newValue in
            guard newValue != handledSignal else { return }
            handledSignal = newValue
            guard case .idle = recorderState else { return }
            starting = true
            Task { await startIfPermitted() }
        }
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

    // MARK: - Recording screen (idle / recording / transcribing)

    private var recordingScroll: some View {
        ScrollView {
            VStack(spacing: 16) { recorderCard }
                .padding()
        }
    }

    var recorderCard: some View {
        CardView(title: "Visit Recorder", icon: "mic.fill") {
            if starting {
                VStack(spacing: 12) {
                    ProgressView().scaleEffect(1.2)
                    Text("Starting recording…").font(.subheadline).foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 44)
            } else {
                recorderBody
            }
        }
    }

    private var recorderBody: some View {
        VStack(spacing: 16) {
            if showTemplateSelectors { templateSelectors }

            // Status badge
            HStack(spacing: 8) {
                if case .recording = recorderState {
                    Circle().fill(Color.red).frame(width: 8, height: 8)
                        .opacity(Double((Int(duration) % 2 == 0) ? 1 : 0.3))
                        .animation(.easeInOut(duration: 0.5).repeatForever(), value: duration)
                }
                Text(statusText).font(.headline).foregroundColor(stateLabelColor)
            }

            if case .recording = recorderState {
                Text(timeString(from: duration))
                    .font(.system(size: 52, weight: .thin, design: .monospaced))
                    .foregroundColor(.red)
            }

            HStack(spacing: 24) {
                switch recorderState {
                case .idle, .error:
                    Button(action: { Task { await startIfPermitted() } }) {
                        Circle().fill(Color.brand).frame(width: 60, height: 60)
                            .overlay(Image(systemName: "mic.fill").font(.title2).foregroundColor(.white))
                    }.buttonStyle(.plain)
                case .recording:
                    Button(action: { Task { await stopAndTranscribe() } }) {
                        Circle().fill(Color.red).frame(width: 60, height: 60)
                            .overlay(Image(systemName: "stop.fill").font(.title2).foregroundColor(.white))
                    }.buttonStyle(.plain)
                case .transcribing:
                    ProgressView().scaleEffect(1.5).frame(width: 60, height: 60)
                case .done:
                    EmptyView()
                }
            }

            if case let .error(msg) = recorderState {
                Text("⚠ \(msg)").font(.caption).foregroundColor(.red).multilineTextAlignment(.center)
            }

            Text("Tap mic to start recording a visit. Audio is transcribed securely.")
                .font(.caption2).foregroundColor(.secondary).multilineTextAlignment(.center).padding(.horizontal)
        }
        .frame(maxWidth: .infinity)
    }

    private var templateSelectors: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Label("Note Format", systemImage: "doc.text")
                        .font(.caption.bold()).foregroundStyle(.secondary)
                    Spacer()
                    Button { showNoteFormatPicker = true } label: {
                        HStack(spacing: 2) { Text("More"); Image(systemName: "chevron.right") }
                            .font(.caption).foregroundStyle(Color.brand)
                    }
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(TranscriptionTemplate.noteFormatTemplates) { fmt in
                            InlineChip(label: fmt.name, icon: fmt.icon,
                                       isSelected: selectedNoteFormat.id == fmt.id, accent: .brand) {
                                selectedNoteFormat = fmt
                                TemplateStore.shared.selectedNoteFormat = fmt
                            }
                        }
                    }.padding(.vertical, 2)
                }
            }
            Divider()
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Label("Disease Focus", systemImage: "cross.case")
                        .font(.caption.bold()).foregroundStyle(.secondary)
                    Spacer()
                    Button { showDiseasePicker = true } label: {
                        HStack(spacing: 2) { Text("More"); Image(systemName: "chevron.right") }
                            .font(.caption).foregroundStyle(Color.brandRose)
                    }
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        InlineChip(label: "None", icon: "circle.slash",
                                   isSelected: selectedDiseaseTemplate == nil, accent: .brandRose) {
                            selectedDiseaseTemplate = nil
                            TemplateStore.shared.selectedDiseaseTemplate = nil
                        }
                        ForEach(TranscriptionTemplate.diseaseTemplates) { disease in
                            InlineChip(label: disease.name, icon: disease.icon,
                                       isSelected: selectedDiseaseTemplate?.id == disease.id, accent: .brandRose) {
                                selectedDiseaseTemplate = disease
                                TemplateStore.shared.selectedDiseaseTemplate = disease
                            }
                        }
                    }.padding(.vertical, 2)
                }
            }
            Divider()
            VStack(alignment: .leading, spacing: 5) {
                Label("Language", systemImage: "globe")
                    .font(.caption.bold()).foregroundStyle(.secondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(TranscriptionLanguage.all) { lang in
                            InlineChip(label: "\(lang.flag) \(lang.name)", icon: "",
                                       isSelected: selectedLanguage.id == lang.id, accent: .brand) {
                                selectedLanguage = lang
                                TranscriptionLanguage.persisted = lang
                            }
                        }
                    }.padding(.vertical, 2)
                }
            }
        }
        .padding(12)
        .background(Color(UIColor.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var statusText: String {
        if case .transcribing = recorderState {
            return noteGenerating ? "Generating clinical note…" : "Transcribing…"
        }
        return recorderState.label
    }

    var stateLabelColor: Color {
        switch recorderState {
        case .recording: return .red
        case .done:      return .green
        case .error:     return .red
        default:         return .primary
        }
    }

    // MARK: - Results screen (full height)

    private var doneView: some View {
        VStack(spacing: 0) {
            // Header
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Visit Note").font(.title2.bold())
                    if let p = patient {
                        Text(p.displayName).font(.caption).foregroundColor(.secondary)
                    } else if let name = assignedPatientName {
                        Label("Assigned to \(name)", systemImage: "checkmark.circle.fill")
                            .font(.caption.weight(.semibold)).foregroundColor(.green)
                    } else {
                        Button { showAssignSheet = true } label: {
                            Label("Assign to Patient", systemImage: "person.badge.plus")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 9).padding(.vertical, 4)
                                .background(Color.brandBlush).foregroundColor(.brand)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(currentVisitId == nil)
                        .opacity(currentVisitId == nil ? 0.5 : 1)
                    }
                }
                Spacer()
                Button(action: { Task { await startIfPermitted() } }) {
                    Label("New Recording", systemImage: "mic.fill")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(Color.brandBlush).foregroundColor(.brand)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal).padding(.top, 12).padding(.bottom, 8)

            Divider()

            // Scrollable note (fills available height)
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 8) {
                        Label("SOAP Note", systemImage: "doc.text")
                            .font(.caption.bold()).foregroundStyle(Color.brand)
                        if !soap.isEmpty {
                            Text("AI DRAFT").font(.system(size: 9, weight: .bold))
                                .padding(.horizontal, 4).padding(.vertical, 1)
                                .background(Color.blue).foregroundColor(.white).cornerRadius(3)
                        }
                        Spacer()
                        autosaveLabel
                    }

                    if !soap.isEmpty && !noteGenerating { actionChips }

                    if noteGenerating {
                        HStack(spacing: 8) {
                            ProgressView().scaleEffect(0.8)
                            Text("Generating clinical note…").font(.subheadline).foregroundColor(.secondary)
                        }
                        .padding(.vertical, 8)
                    }

                    if let error = noteError {
                        Text("⚠ \(error)").font(.caption).foregroundColor(.red)
                    }

                    if soap.isEmpty && !noteGenerating {
                        Text("The clinical note will appear here once recording finishes.")
                            .font(.body).foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
                    } else if !soap.isEmpty {
                        SOAPNoteEditor(note: $soap, editing: editingNote)
                    }

                    if showTranscript { transcriptSection }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Pinned footer — Push to EHR is always visible & prominent
            VStack(spacing: 8) {
                if !soap.isEmpty {
                    if !editingNote {
                        Text("AI-drafted — review before pushing. Not a substitute for physician judgment.")
                            .font(.caption2).foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    pushToEHRButton
                }
                if case let .failure(msg) = ehrPushState {
                    Text("⚠ \(msg)").font(.caption).foregroundColor(.red)
                }
                if let saveError {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Couldn't save this visit", systemImage: "exclamationmark.triangle.fill")
                            .font(.subheadline.bold()).foregroundColor(.red)
                        Text(saveError).font(.caption2).foregroundColor(.secondary).lineLimit(3)
                        Button(action: { Task { await retryUpload() } }) {
                            Label("Retry Save", systemImage: "arrow.clockwise")
                                .font(.system(size: 12, weight: .semibold))
                                .frame(maxWidth: .infinity).padding(.vertical, 8)
                                .background(Color.red.opacity(0.12)).foregroundColor(.red).cornerRadius(8)
                        }
                        .buttonStyle(.plain)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10).background(Color.red.opacity(0.06)).cornerRadius(8)
                }
            }
            .padding()
            .background(.bar)
        }
        .onChange(of: soap) { _, _ in
            clinicalNote = soap.markdown()
            scheduleAutosave()
        }
        .onChange(of: transcript) { _, _ in scheduleAutosave() }
        .sheet(isPresented: $showAssignSheet) {
            if let id = currentVisitId {
                AssignPatientView(visitId: id) { p in assignedPatientName = p.displayName }
            }
        }
    }

    private var actionChips: some View {
        HStack(spacing: 8) {
            Button { withAnimation(.easeInOut(duration: 0.15)) { showTranscript.toggle() } } label: {
                Label(showTranscript ? "Hide Transcript" : "Show Transcript", systemImage: "text.bubble")
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundColor(.secondary)

            Button { withAnimation(.easeInOut(duration: 0.15)) { editingNote.toggle() } } label: {
                Label(editingNote ? "Done Editing" : "Edit",
                      systemImage: editingNote ? "checkmark" : "pencil")
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundColor(.brand)

            Spacer()

            Button { UIPasteboard.general.string = clinicalNote; copiedNote = true } label: {
                Label(copiedNote ? "Copied" : "Copy",
                      systemImage: copiedNote ? "checkmark" : "doc.on.doc")
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundColor(.secondary)
            .onChange(of: copiedNote) { _, val in
                if val { DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copiedNote = false } }
            }
        }
    }

    private var transcriptSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Divider().padding(.vertical, 4)
            Text("Transcript").font(.headline)
            TextEditor(text: $transcript)
                .font(.body).frame(minHeight: 120).padding(6)
                .background(Color(UIColor.systemBackground)).cornerRadius(8)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.2), lineWidth: 1))
        }
    }

    @ViewBuilder
    private var autosaveLabel: some View {
        switch saveState {
        case .saving: Label("Saving…", systemImage: "arrow.triangle.2.circlepath")
                .font(.system(size: 10, weight: .medium)).foregroundColor(.secondary)
        case .saved:  Label("Saved", systemImage: "checkmark")
                .font(.system(size: 10, weight: .medium)).foregroundColor(.green)
        case .idle:   EmptyView()
        }
    }

    private var pushToEHRButton: some View {
        let isPushing: Bool = { if case .pushing = ehrPushState { return true }; return false }()
        let ehrColor: Color = {
            switch ehrPushState {
            case .success: return .green
            case .failure: return .red
            default:       return Color(red: 0.06, green: 0.47, blue: 0.43)
            }
        }()
        return Button(action: { Task { await pushToEHR() } }) {
            HStack(spacing: 8) {
                if isPushing { ProgressView().tint(.white) }
                else {
                    Image(systemName: {
                        switch ehrPushState {
                        case .success: return "checkmark.seal.fill"
                        case .failure: return "exclamationmark.arrow.circlepath"
                        default:       return "arrow.up.doc.fill"
                        }
                    }())
                }
                Text({
                    switch ehrPushState {
                    case .pushing: return "Pushing to EHR…"
                    case .success: return "Pushed to EHR"
                    case .failure: return "Retry Push to EHR"
                    default:       return "Push to EHR"
                    }
                }())
            }
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(ehrColor)
            .foregroundColor(.white)
            .cornerRadius(12)
            .shadow(color: ehrColor.opacity(0.3), radius: 6, y: 3)
        }
        .buttonStyle(.plain)
        .disabled(soap.isEmpty || isPushing)
    }

    // MARK: - Actions

    /// Hydrates the editable results screen from an already-saved visit.
    private func loadExisting(_ visit: Visit) {
        currentVisitId = visit.id
        transcript = visit.transcript
        soap = SOAPNote.parse(visit.note)
        clinicalNote = visit.note
        recorderState = .done
        saveState = .saved
    }

    func startIfPermitted() async {
        starting = true
        let granted = await recorder.checkPermission()
        guard granted else {
            starting = false
            recorderState = .error("Microphone permission denied")
            return
        }
        autosaveTask?.cancel()
        transcript = ""; soap = .empty; clinicalNote = ""
        duration = 0; currentVisitId = nil; pendingAudioURL = nil; audioUploadFailed = false
        showTranscript = false; editingNote = false; ehrPushState = .idle; saveState = .idle
        noteError = nil; saveError = nil; assignedPatientName = nil
        recorder.startRecording()
        recorderState = .recording
        starting = false

        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
            if case .recording = recorderState { duration += 1 } else { t.invalidate() }
        }
    }

    func stopAndTranscribe() async {
        guard let result = recorder.stopRecording() else {
            recorderState = .error("Recording failed")
            return
        }
        let (_, audioURL, recordDuration) = result
        recorderState = .transcribing

        do {
            let wavData = try Data(contentsOf: audioURL)
            let text = try await APIService.shared.transcribeChunked(
                wavData: wavData,
                durationSeconds: recordDuration,
                patientId: patient?.ptnum ?? "",
                language: selectedLanguage.id
            )
            transcript = text
            showTranscript = false
            ehrPushState = .idle

            // Generate the note BEFORE showing the results page, so it doesn't
            // land on a still-loading screen.
            await generateNote()
            recorderState = .done

            Task { await persistVisit(audioURL: audioURL, wavData: wavData) }
        } catch {
            recorderState = .error(error.localizedDescription)
            pendingAudioURL = audioURL
        }
    }

    /// Saves the visit row first (immediately findable), then uploads audio as a
    /// secondary step. A failed audio upload no longer discards the visit.
    private func persistVisit(audioURL: URL, wavData: Data) async {
        let templateName = selectedDiseaseTemplate.map { "SOAP · \($0.name)" } ?? "SOAP Note"

        let visitId: String
        if let existing = currentVisitId {
            visitId = existing
        } else {
            saveState = .saving
            do {
                let visit = try await VisitsService.shared.saveVisit(
                    patientPtnum: patient?.ptnum,
                    transcript: transcript,
                    note: clinicalNote,
                    templateName: templateName,
                    language: selectedLanguage.id,
                    status: "complete"
                )
                currentVisitId = visit.id
                visitId = visit.id
                saveState = .saved
                saveError = nil
            } catch {
                pendingAudioURL = audioURL
                saveError = error.localizedDescription
                saveState = .idle
                print("Visit save failed: \(error.localizedDescription)")
                return
            }
        }

        // Step 2 — upload the audio file. The Retry button reflects ONLY this step.
        // Clear any stale failure flag before re-attempting so a prior error can't linger.
        audioUploadFailed = false
        let audioPath: String
        do {
            audioPath = try await VisitsService.shared.uploadAudio(visitId: visitId, wavData: wavData)
        } catch {
            pendingAudioURL = audioURL
            audioUploadFailed = true
            print("Audio upload failed: \(error.localizedDescription)")
            return
        }

        // Audio is safely in storage — clear the failure flag and drop the temp file.
        audioUploadFailed = false
        pendingAudioURL = nil
        recorder.deleteRecording(at: audioURL)

        // Step 3 — link the path onto the visit row (best-effort; a failure here
        // does NOT mean the audio failed to upload, so it must not show Retry).
        do {
            try await VisitsService.shared.updateVisit(id: visitId, fields: ["audio_path": audioPath])
        } catch {
            print("Linking audio_path failed (audio is already uploaded): \(error.localizedDescription)")
        }
    }

    func retryUpload() async {
        guard let audioURL = pendingAudioURL,
              let wavData = try? Data(contentsOf: audioURL) else { return }
        await persistVisit(audioURL: audioURL, wavData: wavData)
    }

    func generateNote() async {
        guard !transcript.isEmpty else { return }
        noteGenerating = true; noteError = nil
        do {
            let context = patient.map { PatientContext.build(for: $0) } ?? ""
            var prompt = SOAPNote.generationFormat
            if let disease = selectedDiseaseTemplate {
                prompt += "\n\nAdditionally, apply this disease-specific clinical focus:\n\(disease.promptInstructions)"
            }
            let text = try await APIService.shared.summarizeTranscript(
                transcript: transcript,
                patientContext: context,
                templatePrompt: prompt
            )
            soap = SOAPNote.parse(text)
            clinicalNote = soap.markdown()
            scheduleAutosave()
        } catch {
            noteError = error.localizedDescription
        }
        noteGenerating = false
    }

    // MARK: - Autosave

    private func scheduleAutosave() {
        guard let id = currentVisitId else { return }
        saveState = .saving
        autosaveTask?.cancel()
        autosaveTask = Task {
            try? await Task.sleep(nanoseconds: 700_000_000)
            if Task.isCancelled { return }
            do {
                _ = try await VisitsService.shared.updateVisit(
                    id: id, fields: ["note": clinicalNote, "transcript": transcript]
                )
                if !Task.isCancelled { saveState = .saved }
            } catch {
                if !Task.isCancelled { saveState = .idle }
            }
        }
    }

    func timeString(from interval: TimeInterval) -> String {
        let m = Int(interval) / 60
        let s = Int(interval) % 60
        return String(format: "%02d:%02d", m, s)
    }

    // Placeholder for now — real EHR integration isn't wired up, so this simply
    // simulates a successful push and never errors out.
    func pushToEHR() async {
        guard !clinicalNote.isEmpty else { return }
        ehrPushState = .pushing
        try? await Task.sleep(nanoseconds: 600_000_000)
        ehrPushState = .success("Pushed to EHR (placeholder)")
    }
}

// MARK: - InlineChip

private struct InlineChip: View {
    let label: String
    let icon: String
    let isSelected: Bool
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if !icon.isEmpty { Image(systemName: icon).font(.system(size: 10, weight: .semibold)) }
                Text(label).font(.system(size: 12, weight: .semibold)).lineLimit(1)
            }
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(Capsule().fill(isSelected ? accent : accent.opacity(0.08)))
            .overlay(Capsule().stroke(isSelected ? accent : accent.opacity(0.3), lineWidth: 1))
            .foregroundStyle(isSelected ? Color.white : accent)
        }
        .buttonStyle(.plain)
        .animation(.spring(response: 0.2, dampingFraction: 0.75), value: isSelected)
    }
}
