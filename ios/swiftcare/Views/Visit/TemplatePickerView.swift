import SwiftUI

// MARK: - TemplatePickerView
//
// Full-screen picker opened from the [More ›] buttons on each inline selector row.
// Pass `initialCategory` to open directly on the right tab.
// "Use Format" / "Apply Focus" writes back only the active category's selection.

struct TemplatePickerView: View {
    @Binding var selectedNoteFormat: TranscriptionTemplate
    @Binding var selectedDiseaseTemplate: TranscriptionTemplate?
    @Binding var customPrompt: String
    let initialCategory: TemplateCategory
    let onConfirm: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var activeCategory: TemplateCategory
    @State private var draftNoteFormat: TranscriptionTemplate
    @State private var draftDiseaseTemplate: TranscriptionTemplate?
    @State private var draftCustomPrompt: String
    @FocusState private var customEditorFocused: Bool

    init(
        selectedNoteFormat: Binding<TranscriptionTemplate>,
        selectedDiseaseTemplate: Binding<TranscriptionTemplate?>,
        customPrompt: Binding<String>,
        initialCategory: TemplateCategory = .noteFormat,
        onConfirm: @escaping () -> Void
    ) {
        self._selectedNoteFormat = selectedNoteFormat
        self._selectedDiseaseTemplate = selectedDiseaseTemplate
        self._customPrompt = customPrompt
        self.initialCategory = initialCategory
        self.onConfirm = onConfirm
        self._activeCategory = State(initialValue: initialCategory)
        self._draftNoteFormat = State(initialValue: selectedNoteFormat.wrappedValue)
        self._draftDiseaseTemplate = State(initialValue: selectedDiseaseTemplate.wrappedValue)
        self._draftCustomPrompt = State(initialValue: customPrompt.wrappedValue)
    }

    let columns = [GridItem(.flexible()), GridItem(.flexible())]

    private var visibleTemplates: [TranscriptionTemplate] {
        switch activeCategory {
        case .noteFormat: return TranscriptionTemplate.noteFormatTemplates
        case .disease:    return TranscriptionTemplate.diseaseTemplates
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // ── Category segmented picker ──────────────────────────────
                Picker("Category", selection: $activeCategory) {
                    ForEach(TemplateCategory.allCases, id: \.self) { cat in
                        Text(cat.label).tag(cat)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.top, 12)
                .padding(.bottom, 8)

                // ── Category description ───────────────────────────────────
                Text(activeCategory == .noteFormat
                     ? "Choose a documentation format for the AI note."
                     : "Optionally focus the AI note on a specific condition.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                    .padding(.bottom, 12)
                    .animation(.none, value: activeCategory)

                Divider()

                // ── Template grid ──────────────────────────────────────────
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {

                        // "No Disease Focus" option at top of disease tab
                        if activeCategory == .disease {
                            Button {
                                withAnimation(.spring(response: 0.25)) {
                                    draftDiseaseTemplate = nil
                                }
                            } label: {
                                let isNone = draftDiseaseTemplate == nil
                                HStack(spacing: 12) {
                                    Image(systemName: "circle.slash")
                                        .font(.title2)
                                        .foregroundStyle(isNone ? .white : .secondary)
                                        .frame(width: 32, height: 32)
                                        .background(
                                            Circle().fill(isNone ? Color.indigo : Color.secondary.opacity(0.12))
                                        )
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("No Disease Focus")
                                            .font(.system(size: 14, weight: .semibold))
                                            .foregroundStyle(isNone ? .white : .primary)
                                        Text("Generate a general note without disease-specific guidance")
                                            .font(.system(size: 11))
                                            .foregroundStyle(isNone ? .white.opacity(0.8) : .secondary)
                                    }
                                    Spacer()
                                    if isNone {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(.white.opacity(0.9))
                                    }
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(
                                    RoundedRectangle(cornerRadius: 14)
                                        .fill(isNone ? Color.indigo : Color(UIColor.systemBackground))
                                        .shadow(
                                            color: isNone ? Color.indigo.opacity(0.35) : Color.black.opacity(0.06),
                                            radius: isNone ? 8 : 3,
                                            y: isNone ? 4 : 1
                                        )
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14)
                                        .stroke(
                                            isNone ? Color.clear : Color(UIColor.separator).opacity(0.5),
                                            lineWidth: 0.5
                                        )
                                )
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal)
                            .padding(.top, 16)
                        }

                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(visibleTemplates) { template in
                                TemplateCard(
                                    template: template,
                                    isSelected: activeCategory == .noteFormat
                                        ? draftNoteFormat.id == template.id
                                        : draftDiseaseTemplate?.id == template.id
                                ) {
                                    withAnimation(.spring(response: 0.25)) {
                                        if activeCategory == .noteFormat {
                                            draftNoteFormat = template
                                            if template.id == "custom" {
                                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                                    customEditorFocused = true
                                                }
                                            }
                                        } else {
                                            draftDiseaseTemplate = template
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.top, activeCategory == .disease ? 8 : 16)

                        // ── Custom prompt editor ───────────────────────────
                        if draftNoteFormat.id == "custom" && activeCategory == .noteFormat {
                            VStack(alignment: .leading, spacing: 8) {
                                Label("Custom Instructions", systemImage: "pencil.and.outline")
                                    .font(.headline)
                                    .padding(.horizontal)

                                Text("Describe how you want the note formatted — sections, style, length, etc.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal)

                                TextEditor(text: $draftCustomPrompt)
                                    .focused($customEditorFocused)
                                    .font(.body)
                                    .frame(minHeight: 140)
                                    .padding(10)
                                    .background(Color(UIColor.systemBackground))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color.purple.opacity(0.4), lineWidth: 1)
                                    )
                                    .overlay(
                                        Group {
                                            if draftCustomPrompt.isEmpty {
                                                Text("e.g. \"Write a brief 3-paragraph progress note. Lead with the primary problem, then interval history, then plan. Keep it under 200 words.\"")
                                                    .font(.body)
                                                    .foregroundStyle(.tertiary)
                                                    .padding(14)
                                                    .allowsHitTesting(false)
                                            }
                                        },
                                        alignment: .topLeading
                                    )
                                    .padding(.horizontal)

                                if draftCustomPrompt.isEmpty {
                                    Label("Enter instructions above to use this template", systemImage: "exclamationmark.triangle")
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                        .padding(.horizontal)
                                }
                            }
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                        }

                        // ── Prompt preview ─────────────────────────────────
                        if activeCategory == .noteFormat && draftNoteFormat.id != "custom" {
                            promptPreview(text: draftNoteFormat.promptInstructions, label: "Format Preview")
                        }
                        if activeCategory == .disease, let disease = draftDiseaseTemplate {
                            promptPreview(text: disease.promptInstructions, label: "Focus Preview")
                        }

                        Spacer(minLength: 20)
                    }
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationTitle(activeCategory == .noteFormat ? "Note Format" : "Disease Focus")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(activeCategory == .noteFormat ? "Use Format" : "Apply") {
                        if activeCategory == .noteFormat {
                            if draftNoteFormat.id == "custom"
                                && draftCustomPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                customEditorFocused = true
                                return
                            }
                            selectedNoteFormat = draftNoteFormat
                            customPrompt = draftCustomPrompt
                        } else {
                            selectedDiseaseTemplate = draftDiseaseTemplate
                        }
                        onConfirm()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .tint(activeCategory == .noteFormat ? .teal : .indigo)
                }
            }
        }
    }

    @ViewBuilder
    private func promptPreview(text: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(label, systemImage: "doc.text.magnifyingglass")
                .font(.headline)
                .padding(.horizontal)

            Text(text
                .replacingOccurrences(of: "**", with: "")
                .components(separatedBy: "\n")
                .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
                .prefix(10)
                .joined(separator: "\n")
            )
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(12)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal)
        }
        .transition(.opacity)
    }
}

// MARK: - TemplateCard

private struct TemplateCard: View {
    let template: TranscriptionTemplate
    let isSelected: Bool
    let action: () -> Void

    /// Accent color: teal for note formats, indigo for disease templates
    private var accent: Color {
        template.category == .disease ? .indigo : .teal
    }

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: template.icon)
                        .font(.title2)
                        .foregroundStyle(isSelected ? .white : accent)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(isSelected ? accent : accent.opacity(0.12))
                        )

                    Spacer()

                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.white.opacity(0.9))
                            .font(.headline)
                    }
                }

                Text(template.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(isSelected ? .white : .primary)
                    .lineLimit(1)

                Text(template.description)
                    .font(.system(size: 11))
                    .foregroundStyle(isSelected ? .white.opacity(0.8) : .secondary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(isSelected
                          ? accent
                          : Color(UIColor.systemBackground))
                    .shadow(
                        color: isSelected ? accent.opacity(0.35) : Color.black.opacity(0.06),
                        radius: isSelected ? 8 : 3,
                        y: isSelected ? 4 : 1
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(
                        isSelected ? Color.clear : Color(UIColor.separator).opacity(0.5),
                        lineWidth: 0.5
                    )
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(isSelected ? 1.02 : 1.0)
        .animation(.spring(response: 0.2, dampingFraction: 0.7), value: isSelected)
    }
}
