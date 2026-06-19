import Foundation

/// Merges consecutive chunk transcripts by removing words duplicated in the
/// 1-second overlap region.  Pure text-based — no timestamps required.
enum TranscriptMerger {

    /// Max words to inspect at the boundary between two chunks.
    private static let windowSize = 15

    /// Merge an array of transcripts (in order) into one clean transcript.
    static func merge(_ transcripts: [String]) -> String {
        guard !transcripts.isEmpty else { return "" }
        var result = transcripts[0]
        for i in 1 ..< transcripts.count {
            result = mergePair(result, transcripts[i])
        }
        return result.trimmingCharacters(in: .whitespaces)
    }

    // MARK: - Pair merge

    private static func mergePair(_ a: String, _ b: String) -> String {
        let aWords = tokenize(a)
        let bWords = tokenize(b)
        guard !aWords.isEmpty, !bWords.isEmpty else { return a + " " + b }

        // Look for the longest suffix of `a` (up to windowSize) that matches
        // a prefix of `b`. Drop that prefix from `b` before joining.
        let tailCount = min(windowSize, aWords.count)
        let aTail = Array(aWords.suffix(tailCount))

        for k in stride(from: tailCount, through: 1, by: -1) {
            let suffix = Array(aTail.suffix(k)).map(\.normal)
            let prefix = Array(bWords.prefix(k)).map(\.normal)
            if suffix == prefix {
                // Reconstruct: all of `a`, then the non-overlapping tail of `b`
                let bRemainder = Array(bWords.dropFirst(k))
                if bRemainder.isEmpty { return a }
                return a + " " + bRemainder.map(\.original).joined(separator: " ")
            }
        }

        // No overlap found — join with a space
        return a + " " + b
    }

    // MARK: - Tokenization

    private struct Token {
        let original: String
        let normal:   String  // lowercased, punctuation stripped
    }

    private static func tokenize(_ text: String) -> [Token] {
        text.components(separatedBy: .whitespaces)
            .filter { !$0.isEmpty }
            .map { word in
                let normal = word
                    .lowercased()
                    .filter { $0.isLetter || $0.isNumber }
                return Token(original: word, normal: normal)
            }
    }
}
