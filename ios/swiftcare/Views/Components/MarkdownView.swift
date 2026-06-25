import SwiftUI

/// Lightweight block-level markdown renderer for clinical notes.
/// Handles headings (#, ##, ###), bold/italic/inline-code (via AttributedString),
/// bullet & numbered lists, and paragraphs. Not a full CommonMark implementation,
/// but covers what the SOAP-note generator produces.
struct ClinicalMarkdownView: View {
    let markdown: String

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                row(for: line)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .textSelection(.enabled)
    }

    private var lines: [String] { markdown.components(separatedBy: "\n") }

    @ViewBuilder
    private func row(for raw: String) -> some View {
        let line = raw.trimmingCharacters(in: .whitespaces)
        if line.isEmpty {
            Color.clear.frame(height: 1)
        } else if line.hasPrefix("### ") {
            Text(inline(String(line.dropFirst(4))))
                .font(.subheadline.bold()).foregroundColor(.primary).padding(.top, 2)
        } else if line.hasPrefix("## ") {
            Text(inline(String(line.dropFirst(3))))
                .font(.headline).foregroundColor(.primary).padding(.top, 4)
        } else if line.hasPrefix("# ") {
            Text(inline(String(line.dropFirst(2))))
                .font(.title3.bold()).foregroundColor(.primary).padding(.top, 4)
        } else if let bullet = bulletContent(line) {
            HStack(alignment: .top, spacing: 8) {
                Text("•").font(.body).foregroundColor(.brand)
                Text(inline(bullet)).font(.body)
            }
        } else if let (num, rest) = numberedContent(line) {
            HStack(alignment: .top, spacing: 8) {
                Text("\(num).").font(.body.weight(.semibold)).foregroundColor(.brand)
                Text(inline(rest)).font(.body)
            }
        } else {
            Text(inline(line)).font(.body)
        }
    }

    private func bulletContent(_ line: String) -> String? {
        for prefix in ["- ", "* ", "• "] where line.hasPrefix(prefix) {
            return String(line.dropFirst(prefix.count))
        }
        return nil
    }

    private func numberedContent(_ line: String) -> (Int, String)? {
        guard let dot = line.firstIndex(of: ".") else { return nil }
        guard let n = Int(line[line.startIndex..<dot]) else { return nil }
        let after = line.index(after: dot)
        guard after < line.endIndex, line[after] == " " else { return nil }
        return (n, String(line[line.index(after: after)...]))
    }

    private func inline(_ s: String) -> AttributedString {
        (try? AttributedString(
            markdown: s,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(s)
    }
}
