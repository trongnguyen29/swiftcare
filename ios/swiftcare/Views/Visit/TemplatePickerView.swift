import SwiftUI

// MARK: - TemplatePickerView

struct TemplatePickerView: View {
    @Binding var selectedTemplate: TranscriptionTemplate
    @Binding var customPrompt: String
    let onConfirm: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var draft: TranscriptionTemplate
    @State private var draftCustomPrompt: String
    @State private var activeCategory: TemplateCategory = .noteFormat
    @FocusState private var customEditorFocused: Bool

    init(
        selectedTemplate: Binding<TranscriptionTemplate>,
        customPrompt: Binding<String>,
        onConfirm: @escaping () -> Void
    ) {
        self._selectedTemplate = selectedTemplate
        self._customPrompt = customPrompt
        self.onConfirm = onConfirm
        self._draft = State(initialValue: selectedTemplate.wrappedValue)
        self._draftCustomPrompt = State(initialValue: customPrompt.wrappedValue)
        // Open on the category of the current selection
        self._activeCategory = State(initialValue: selectedTemplate.wrappedValue.category)
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

                // ── Category description blurb ─────────────────────────────
                Text(activeCategory == .noteFormat
                     ? "Choose a documentation format for the AI note."
                     : "Focus the AI note on a specific condition's key clinical elements.")
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
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(visibleTemplates) { template in
                                TemplateCard(
                                    template: template,
                                    isSelected: draft.id == template.id
                                ) {
                                    withAnimation(.spring(response: 0.25)) {
                                        draft = template
                                    }
                                    if template.id == "custom" {
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                            customEditorFocused = true
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.top, 16)

                        // ── Custom prompt editor ───────────────────────────
                        if draft.id == "custom" && activeCategory == .noteFormat {
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

                        // ── Format preview (non-custom) ────────────────────
                        if draft.id != "custom" && visibleTemplates.contains(where: { $0.id == draft.id }) {
                            VStack(alignment: .leading, spacing: 8) {
                                Label("Format Preview", systemImage: "doc.text.magnifyingglass")
                                    .font(.headline)
                                    .padding(.horizontal)

                                Text(draft.promptInstructions
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

                        Spacer(minLength: 20)
                    }
                }
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationTitle("Note Template")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Use Template") {
                        if draft.id == "custom" && draftCustomPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            customEditorFocused = true
                            return
                        }
                        selectedTemplate = draft
                        customPrompt = draftCustomPrompt
                        onConfirm()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .tint(.teal)
                }
            }
            // When switching category, keep draft if it's in the new category;
            // otherwise preview the first template of the new category
            .onChange(of: activeCategory) { newCat in
                if draft.category != newCat {
                    // Don't change the committed selection — just preview the first
                }
            }
        }
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
