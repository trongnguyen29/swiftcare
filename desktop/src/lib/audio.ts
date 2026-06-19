// Audio utilities: WebM/Opus decode → PCM chunks → WAV encode, plus transcript dedup-merge.

const MAX_CHUNK_SEC = 120
const OVERLAP_SEC = 1

// ── Decode & chunk ────────────────────────────────────────────────────────────

/**
 * Decode an audio Blob (any format supported by the browser, e.g. WebM/Opus),
 * split into overlapping chunks of ≤ MAX_CHUNK_SEC, and return each chunk
 * as a WAV Blob ready for base64-encoding and Whisper.
 *
 * Returns null if the recording is short enough to send as-is.
 */
export async function decodeAndChunk(blob: Blob): Promise<Blob[] | null> {
  const arrayBuffer = await blob.arrayBuffer()
  let decoded: AudioBuffer
  try {
    decoded = await new AudioContext().decodeAudioData(arrayBuffer)
  } catch {
    return null  // can't decode — caller falls back to sending blob directly
  }

  const totalSec = decoded.duration
  if (totalSec <= MAX_CHUNK_SEC) return null

  // Downmix to mono at 16 kHz
  const targetRate = 16_000
  const offline = new OfflineAudioContext(1, Math.ceil(totalSec * targetRate), targetRate)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()

  const mono = rendered.getChannelData(0)
  const n = Math.ceil(totalSec / MAX_CHUNK_SEC)
  const chunkSamples = Math.floor((totalSec / n) * targetRate)
  const overlapSamples = Math.floor(OVERLAP_SEC * targetRate)

  const chunks: Blob[] = []
  let offset = 0
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1
    const end = isLast ? mono.length : Math.min(offset + chunkSamples + overlapSamples, mono.length)
    const slice = mono.subarray(offset, end)
    chunks.push(encodeWav(slice, targetRate))
    if (!isLast) offset += chunkSamples
  }
  return chunks
}

// ── WAV encoder ───────────────────────────────────────────────────────────────

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const pcm = floatTo16BitPCM(samples)
  const dataSize = pcm.byteLength
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)          // PCM
  view.setUint16(22, 1, true)          // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)  // byteRate
  view.setUint16(32, 2, true)          // blockAlign
  view.setUint16(34, 16, true)         // bitsPerSample
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  new Uint8Array(buffer, 44).set(new Uint8Array(pcm))
  return new Blob([buffer], { type: 'audio/wav' })
}

function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(float32.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buf
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

// ── Transcript dedup-merge ────────────────────────────────────────────────────

const WINDOW = 15

/**
 * Merge consecutive chunk transcripts produced with 1s overlap by finding
 * the longest suffix of `a` (up to WINDOW words) that matches a prefix of `b`,
 * then dropping that prefix from `b`.
 */
export function dedupeMerge(transcripts: string[]): string {
  if (transcripts.length === 0) return ''
  return transcripts.reduce((acc, cur) => mergePair(acc, cur))
}

function mergePair(a: string, b: string): string {
  const aWords = tokenize(a)
  const bWords = tokenize(b)
  if (!aWords.length || !bWords.length) return (a + ' ' + b).trim()

  const tailCount = Math.min(WINDOW, aWords.length)
  const aTail = aWords.slice(-tailCount)

  for (let k = tailCount; k >= 1; k--) {
    const suffix = aTail.slice(-k).map(w => w.norm)
    const prefix = bWords.slice(0, k).map(w => w.norm)
    if (suffix.join(' ') === prefix.join(' ')) {
      const remainder = bWords.slice(k).map(w => w.raw).join(' ')
      return remainder ? a + ' ' + remainder : a
    }
  }
  return (a + ' ' + b).trim()
}

function tokenize(text: string): { raw: string; norm: string }[] {
  return text.split(/\s+/).filter(Boolean).map(raw => ({
    raw,
    norm: raw.toLowerCase().replace(/[^a-z0-9]/g, ''),
  }))
}
