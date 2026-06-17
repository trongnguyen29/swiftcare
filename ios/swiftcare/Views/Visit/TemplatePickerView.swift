import SwiftUI

// MARK: - TemplatePickerView

struct TemplatePickerView: View {
    @Binding var selectedTemplate: TranscriptionTemplate
    @Binding var customPrompt: String
    let onConfirm: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var draft: TranscriptionTemplate
    @State private var draftCustomPrompt: String
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
    }

    // Grid layout — 2 columns
    let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Intro
                    Text("Choose how the AI should format the clinical note generated from your recording.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal)

                    // Template grid
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(TranscriptionTemplate.builtIns) { template in
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

                    // Custom prompt editor — shown only when Custom is selected
                    if draft.id == "custom" {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Custom Instructions", systemImage: "pencil.and.outline")
                                .font(.headline)
                                .padding(.horizontal)

                            Text("Describe how you want the note formatted. Be as specific as you like — sections, style, length, etc.")
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

                    // Selected template preview
                    if draft.id != "custom" {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Format Preview", systemImage: "doc.text.magnifyingglass")
                                .font(.headline)
                                .padding(.horizontal)

                            Text(draft.promptInstructions
                                .replacingOccurrences(of: "**", with: "")
                                .components(separatedBy: "\n")
                                .prefix(8)
                                .joined(separator: "\n")
                            )
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(10)
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
                .padding(.top, 8)
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
                        // Validate custom
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
        }
    }
}

// MARK: - TemplateCard

private struct TemplateCard: View {
    let template: TranscriptionTemplate
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: template.icon)
                        .font(.title2)
                        .foregroundStyle(isSelected ? .white : .teal)
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(isSelected ? Color.teal : Color.teal.opacity(0.12))
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
                        ? Color.teal
                        : Color(UIColor.systemBackground)
                    )
                    .shadow(
                        color: isSelected ? Color.teal.opacity(0.35) : Color.black.opacity(0.06),
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
