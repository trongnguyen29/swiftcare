import Foundation

/// Splits a 16 kHz / mono / 16-bit PCM WAV file into overlapping chunks.
///
/// Chunk constraints:
///   - minimum duration: 30 s
///   - maximum duration: 120 s
///   - overlap:           1 s between consecutive chunks (for dedup-merge)
enum AudioChunker {

    struct Chunk {
        let data: Data        // complete WAV file (header + PCM)
        let index: Int
        let total: Int
    }

    // 16 kHz × 1 channel × 2 bytes/sample = 32 000 bytes/s
    private static let bytesPerSecond: Int = 32_000
    private static let wavHeaderSize:  Int = 44
    private static let overlapSeconds: Double = 1.0
    private static let maxChunkSeconds: Double = 120.0
    private static let minChunkSeconds: Double = 30.0

    /// Returns nil if the recording is short enough to be sent as a single chunk.
    static func chunk(wavData: Data, durationSeconds: Double) -> [Chunk]? {
        guard durationSeconds > maxChunkSeconds else { return nil }

        let pcmData = wavData.dropFirst(wavHeaderSize)

        let n = Int(ceil(durationSeconds / maxChunkSeconds))
        let chunkSec = durationSeconds / Double(n)
        let overlapBytes = Int(overlapSeconds * Double(bytesPerSecond))
        // Align to 2-byte (sample) boundary
        let chunkBytes = (Int(chunkSec * Double(bytesPerSecond)) / 2) * 2

        var chunks: [Chunk] = []
        var offset = 0

        for i in 0 ..< n {
            let isLast = (i == n - 1)
            let end = isLast ? pcmData.count : min(offset + chunkBytes + overlapBytes, pcmData.count)
            let slice = pcmData[offset ..< end]

            var chunkWav = Data()
            chunkWav.append(makeWavHeader(pcmByteCount: slice.count))
            chunkWav.append(contentsOf: slice)

            chunks.append(Chunk(data: chunkWav, index: i, total: n))
            if isLast { break }
            offset += chunkBytes  // next chunk starts chunkBytes after current start
        }

        return chunks
    }

    // MARK: - WAV header construction

    private static func makeWavHeader(pcmByteCount: Int) -> Data {
        // Standard 44-byte PCM WAV header
        var h = Data(count: 44)
        let sampleRate: UInt32 = 16_000
        let channels:   UInt16 = 1
        let bitDepth:   UInt16 = 16
        let byteRate:   UInt32 = sampleRate * UInt32(channels) * UInt32(bitDepth / 8)
        let blockAlign: UInt16 = channels * (bitDepth / 8)
        let dataSize:   UInt32 = UInt32(pcmByteCount)
        let riffSize:   UInt32 = 36 + dataSize

        h.writeASCII("RIFF",  at: 0)
        h.writeLE32(riffSize,   at: 4)
        h.writeASCII("WAVE",  at: 8)
        h.writeASCII("fmt ", at: 12)
        h.writeLE32(16,         at: 16) // PCM chunk size
        h.writeLE16(1,          at: 20) // PCM format
        h.writeLE16(channels,   at: 22)
        h.writeLE32(sampleRate, at: 24)
        h.writeLE32(byteRate,   at: 28)
        h.writeLE16(blockAlign, at: 32)
        h.writeLE16(bitDepth,   at: 34)
        h.writeASCII("data",  at: 36)
        h.writeLE32(dataSize,   at: 40)
        return h
    }
}

// MARK: - Data helpers

private extension Data {
    mutating func writeASCII(_ s: String, at offset: Int) {
        let bytes = Array(s.utf8)
        replaceSubrange(offset ..< offset + bytes.count, with: bytes)
    }
    mutating func writeLE32(_ v: UInt32, at offset: Int) {
        var le = v.littleEndian
        Swift.withUnsafeBytes(of: &le) { buf in
            replaceSubrange(offset ..< offset + 4, with: buf)
        }
    }
    mutating func writeLE16(_ v: UInt16, at offset: Int) {
        var le = v.littleEndian
        Swift.withUnsafeBytes(of: &le) { buf in
            replaceSubrange(offset ..< offset + 2, with: buf)
        }
    }
}
