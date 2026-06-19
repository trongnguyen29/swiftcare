import { useState, useRef, useEffect, useCallback } from 'react'
import { transcribeAudio } from '../lib/api'
import { decodeAndChunk, dedupeMerge } from '../lib/audio'
import { saveRecording, deleteRecording, saveVisit, uploadVisitAudio, updateVisit } from '../lib/visits'

const MAX_ATTEMPTS = 5

type Status = 'idle' | 'recording' | 'transcribing' | 'done' | 'error'

interface Props {
  patientId: string | null
  onTranscript: (text: string) => void
  startSignal?: number
}

export default function VoiceRecorder({ patientId, onTranscript, startSignal = 0 }: Props) {
  const [status, setStatus]     = useState<Status>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const [pendingRecPath, setPendingRecPath] = useState<string | null>(null)
  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const animFrameRef     = useRef<number>(0)
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const recordedBlobRef  = useRef<Blob | null>(null)

  // ── Waveform ──────────────────────────────────────────────────────────────

  const drawWaveform = useCallback(() => {
    const canvas   = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx  = canvas.getContext('2d')!
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(data)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth   = 2
    ctx.strokeStyle = '#3b82f6'
    ctx.beginPath()
    const sliceW = canvas.width / data.length
    let x = 0
    for (let i = 0; i < data.length; i++) {
      const y = (data[i] / 128) * (canvas.height / 2)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      x += sliceW
    }
    ctx.stroke()
    animFrameRef.current = requestAnimationFrame(drawWaveform)
  }, [])

  const drawFlat = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth   = 2
    ctx.strokeStyle = '#e2e8f0'
    ctx.beginPath()
    ctx.moveTo(0, canvas.height / 2)
    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()
  }, [])

  useEffect(() => { drawFlat() }, [drawFlat])

  // ── Auto-start from banner ────────────────────────────────────────────────

  const handledSignal = useRef(0)
  useEffect(() => {
    if (startSignal && startSignal !== handledSignal.current) {
      handledSignal.current = startSignal
      if (status === 'idle' || status === 'done' || status === 'error') startRecording()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal])

  // ── Recording controls ────────────────────────────────────────────────────

  async function startRecording() {
    setError(null)
    setPendingRecPath(null)
    setCurrentVisitId(null)
    recordedBlobRef.current = null
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)
      audioCtxRef.current  = audioCtx
      analyserRef.current  = analyser

      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(250)
      mediaRecorderRef.current = mr

      setStatus('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
      drawWaveform()
    } catch {
      setError('Microphone access denied')
    }
  }

  async function stopRecording() {
    const mr = mediaRecorderRef.current
    if (!mr) return

    cancelAnimationFrame(animFrameRef.current)
    drawFlat()
    if (timerRef.current) clearInterval(timerRef.current)
    audioCtxRef.current?.close()

    setStatus('transcribing')

    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
      mr.stream.getTracks().forEach(t => t.stop())
      recordedBlobRef.current = blob

      // 1. Save to a local temp file before sending
      let tempPath: string | null = null
      try {
        const { blobToBase64 } = await import('../lib/api')
        const audioB64 = await blobToBase64(blob)
        tempPath = await saveRecording({ audioB64, mimeType: blob.type || 'audio/webm' })
        setPendingRecPath(tempPath)
      } catch {
        // non-fatal; continue to transcription even if local save fails
      }

      try {
        const text = await transcribeWithChunksAndRetry(blob, patientId ?? '')
        onTranscript(text)
        setStatus('done')

        // 2. Persist visit + upload audio, then delete the temp file
        persistVisitAndAudio(blob, text, tempPath)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Transcription failed'
        setError(msg)
        setStatus('error')
        // Keep pendingRecPath so user can retry
      }
    }
    mr.stop()
  }

  // ── Retry upload (shown in error / done state if upload failed) ────────────

  async function retryUpload() {
    if (!pendingRecPath || !currentVisitId || !recordedBlobRef.current) return
    try {
      const { blobToBase64 } = await import('../lib/api')
      const audioB64 = await blobToBase64(recordedBlobRef.current)
      const audioPath = await uploadVisitAudio({ visitId: currentVisitId, audioB64, mimeType: recordedBlobRef.current.type })
      await updateVisit(currentVisitId, { audio_path: audioPath })
      await deleteRecording(pendingRecPath)
      setPendingRecPath(null)
    } catch (e) {
      console.error('Retry upload failed:', e)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function transcribeWithChunksAndRetry(blob: Blob, pid: string): Promise<string> {
    const chunks = await decodeAndChunk(blob)
    if (!chunks) {
      return transcribeWithRetry(blob, pid)
    }
    // Parallel chunk transcription (cap 4 concurrent)
    const results = new Array<string>(chunks.length).fill('')
    const pending = chunks.map((chunk, idx) => ({ chunk, idx }))
    const inFlight: Promise<void>[] = []
    let qi = 0

    async function run(idx: number, chunk: Blob) {
      results[idx] = await transcribeWithRetry(chunk, pid)
    }

    while (qi < pending.length) {
      if (inFlight.length < 4) {
        const { chunk, idx } = pending[qi++]
        inFlight.push(run(idx, chunk).then(() => { inFlight.splice(0, 1) }))
      } else {
        await Promise.race(inFlight)
      }
    }
    await Promise.all(inFlight)
    return dedupeMerge(results)
  }

  async function transcribeWithRetry(blob: Blob, pid: string): Promise<string> {
    let lastErr: unknown
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(Math.min(2 ** attempt, 30) * 1000)
      try {
        return await transcribeAudio(blob, pid)
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr
  }

  async function persistVisitAndAudio(blob: Blob, transcript: string, tempPath: string | null) {
    try {
      const { blobToBase64 } = await import('../lib/api')
      const visit = await saveVisit({
        patientPtnum: patientId,
        transcript,
        note: '',
        status: 'complete',
      })
      setCurrentVisitId(visit.id)

      const audioB64 = await blobToBase64(blob)
      const audioPath = await uploadVisitAudio({
        visitId: visit.id,
        audioB64,
        mimeType: blob.type || 'audio/webm',
      })
      await updateVisit(visit.id, { audio_path: audioPath })

      if (tempPath) {
        await deleteRecording(tempPath)
        setPendingRecPath(null)
      }
    } catch (e) {
      console.error('Visit persist failed:', e)
      // pendingRecPath stays set so user sees Retry Upload button
    }
  }

  function reset() {
    setStatus('idle')
    setDuration(0)
    setError(null)
    setPendingRecPath(null)
    setCurrentVisitId(null)
    recordedBlobRef.current = null
    drawFlat()
  }

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="card recorder-card">
      <div className="card-header">
        <span className="card-title">Visit Recorder</span>
        {status === 'recording' && (
          <span className="rec-badge">
            <span className="rec-dot" /> REC {fmtTime(duration)}
          </span>
        )}
        {status === 'transcribing' && <span className="transcribing-badge">Transcribing…</span>}
        {status === 'done'         && <span className="done-badge">Done</span>}
      </div>

      <div className="recorder-body">
        <canvas ref={canvasRef} className="waveform" width={600} height={64} />

        {error && <div className="rec-error">{error}</div>}

        <div className="rec-controls">
          {(status === 'idle' || status === 'done' || status === 'error') && (
            <button className="btn-record" onClick={startRecording}>
              <span className="rec-dot-btn" /> Start Recording
            </button>
          )}
          {status === 'recording' && (
            <button className="btn-stop" onClick={stopRecording}>
              <span className="stop-icon" /> Stop & Transcribe
            </button>
          )}
          {status === 'transcribing' && (
            <button className="btn-record" disabled style={{ opacity: 0.5 }}>
              Transcribing…
            </button>
          )}
          {(status === 'done' || status === 'error') && (
            <button className="btn-ghost" onClick={reset}>New Recording</button>
          )}
          {pendingRecPath && currentVisitId && (
            <button className="btn-ghost" onClick={retryUpload} style={{ color: '#f97316' }}>
              ↺ Retry Upload
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
