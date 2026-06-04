import { useState, useRef, useEffect, useCallback } from 'react'
import { transcribeAudio } from '../lib/api'

type Status = 'idle' | 'recording' | 'transcribing' | 'done' | 'error'

interface Props {
  patientId: string | null
  onTranscript: (text: string) => void
}

export default function VoiceRecorder({ patientId, onTranscript }: Props) {
  const [status, setStatus]     = useState<Status>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError]       = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const animFrameRef     = useRef<number>(0)
  const audioCtxRef      = useRef<AudioContext | null>(null)

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

  useEffect(() => {
    drawFlat()
  }, [drawFlat])

  async function startRecording() {
    setError(null)
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
      try {
        const text = await transcribeAudio(blob, patientId ?? '')
        onTranscript(text)
        setStatus('done')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Transcription failed')
        setStatus('error')
      }
    }
    mr.stop()
  }

  function reset() {
    setStatus('idle')
    setDuration(0)
    setError(null)
    drawFlat()
  }

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="card recorder-card">
      <div className="card-header">
        <span className="card-title">Visit Recorder</span>
        {status === 'recording' && (
          <span className="rec-badge">
            <span className="rec-dot" /> REC {fmtTime(duration)}
          </span>
        )}
        {status === 'transcribing' && (
          <span className="transcribing-badge">Transcribing…</span>
        )}
        {status === 'done' && (
          <span className="done-badge">Done</span>
        )}
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
        </div>

        {status === 'idle' && !patientId && (
          <div className="rec-hint">Select a patient to begin</div>
        )}
        {status === 'idle' && patientId && (
          <div className="rec-hint">Ready to record visit for {patientId}</div>
        )}
      </div>
    </div>
  )
}
