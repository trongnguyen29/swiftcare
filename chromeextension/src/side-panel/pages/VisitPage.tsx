import { useState, useRef, useEffect } from "react";
import type { Patient } from "../../types/patient";
import { displayName } from "../../types/patient";
import { transcribeAudio, summarizeTranscript, saveVisit, pushNoteToEHR } from "../../api/api";
import {
  NOTE_FORMAT_TEMPLATES,
  DISEASE_TEMPLATES,
  buildEffectivePrompt,
  type TranscriptionTemplate,
} from "../../types/templates";

interface VisitPageProps {
  patient: Patient | null;
  onBack: () => void;
  embedded?: boolean;
}

type Phase = "idle" | "recording" | "transcribing" | "done";

function buildPatientContext(p: Patient | null): string {
  if (!p) return "No patient selected.";
  const lines: string[] = [
    `Patient: ${displayName(p)}, MRN: ${p.ptnum}`,
    p.age ? `Age: ${Math.round(p.age)}` : "",
    p.administrative_sex ? `Sex: ${p.administrative_sex}` : "",
    p.systolic_bp && p.diastolic_bp
      ? `BP: ${p.systolic_bp}/${p.diastolic_bp} mmHg`
      : "",
    p.heart_rate ? `HR: ${p.heart_rate} bpm` : "",
    p.bmi ? `BMI: ${p.bmi.toFixed(1)}` : "",
    p.hba1c ? `HbA1c: ${p.hba1c}%` : "",
    p.problems?.length
      ? `Problems: ${p.problems
          .slice(0, 5)
          .map((pr) => pr.display)
          .join(", ")}`
      : "",
    p.medications?.length
      ? `Medications: ${p.medications
          .slice(0, 5)
          .map((m) => m.name)
          .join(", ")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export default function VisitPage({ patient, onBack, embedded }: VisitPageProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [pushed, setPushed] = useState(false);

  // Template selection
  const [noteFormat, setNoteFormat] = useState<TranscriptionTemplate>(
    NOTE_FORMAT_TEMPLATES[0]
  );
  const [diseaseTemplate, setDiseaseTemplate] =
    useState<TranscriptionTemplate | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.start(1000);
      mediaRef.current = mr;
      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (e) {
      setError(`Microphone access denied: ${(e as Error).message}`);
    }
  }

  async function stopRecording() {
    if (!mediaRef.current) return;
    const mr = mediaRef.current;
    clearInterval(timerRef.current!);
    setPhase("transcribing");

    await new Promise<void>((res) => {
      mr.onstop = () => res();
      mr.stop();
    });
    mr.stream.getTracks().forEach((t) => t.stop());

    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const b64 = await blobToBase64(blob);
      const text = await transcribeAudio(
        b64,
        "audio/webm",
        patient?.ptnum ?? "unassigned"
      );
      setTranscript(text);

      const prompt = buildEffectivePrompt(noteFormat, diseaseTemplate, customPrompt);
      const soap = await summarizeTranscript(
        text,
        buildPatientContext(patient),
        prompt
      );
      setNote(soap);
      setPhase("done");
    } catch (e) {
      setError(`Transcription failed: ${(e as Error).message}`);
      setPhase("idle");
    }
  }

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current!);
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveVisit({
        patient_ptnum: patient?.ptnum,
        transcript,
        note,
        template_name: noteFormat.name,
        status: "complete",
      });
      showToast("✓ Visit saved");
    } catch {
      showToast("Failed to save visit");
    } finally {
      setSaving(false);
    }
  }

  async function handlePushToEHR() {
    setSaving(true);
    try {
      const msg = await pushNoteToEHR(
        note,
        patient?.ptnum ?? "unassigned",
        patient ? displayName(patient) : undefined,
        noteFormat.name
      );
      setPushed(true);
      showToast(`✓ ${msg}`);
    } catch (e) {
      showToast(`EHR push failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setPhase("idle");
    setTranscript("");
    setNote("");
    setError("");
    setElapsed(0);
    setPushed(false);
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        {!embedded && (
          <div className="back-header">
            <button className="back-btn" onClick={onBack}>←</button>
            <div className="back-header__title">
              {patient ? `Visit — ${displayName(patient)}` : "Quick Record"}
            </div>
          </div>
        )}

        <div className="page">
          <div className="page-inner">
            {error && (
              <div
                style={{
                  background: "var(--color-red-subtle)",
                  border: "1px solid var(--color-red)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                  fontSize: "13px",
                  color: "var(--color-red)",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {/* Template picker toggle */}
            {phase === "idle" && (
              <div>
                <button
                  id="template-picker-btn"
                  className="btn btn--ghost w-full"
                  onClick={() => setShowTemplates(!showTemplates)}
                  style={{ justifyContent: "space-between" }}
                >
                  <span>
                    {noteFormat.icon} {noteFormat.name}
                    {diseaseTemplate ? ` + ${diseaseTemplate.name}` : ""}
                  </span>
                  <span style={{ opacity: 0.6 }}>{showTemplates ? "▲" : "▼"}</span>
                </button>

                {showTemplates && (
                  <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Note format */}
                    <div>
                      <div className="text-xs text-muted font-bold" style={{ marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Note Format
                      </div>
                      <div className="template-grid">
                        {NOTE_FORMAT_TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            id={`note-format-${t.id}`}
                            className={`template-card ${noteFormat.id === t.id ? "template-card--active" : ""}`}
                            onClick={() => setNoteFormat(t)}
                          >
                            <div className="template-card__icon">{t.icon}</div>
                            <div className="template-card__name">{t.name}</div>
                            <div className="template-card__desc">{t.description}</div>
                          </button>
                        ))}
                      </div>
                      {noteFormat.id === "custom" && (
                        <textarea
                          id="custom-prompt-input"
                          placeholder="Enter your custom note instructions…"
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          style={{
                            marginTop: "8px",
                            width: "100%",
                            background: "var(--color-surface-2)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-md)",
                            color: "var(--color-text)",
                            padding: "10px",
                            fontSize: "13px",
                            minHeight: "80px",
                            outline: "none",
                            resize: "vertical",
                          }}
                        />
                      )}
                    </div>

                    {/* Disease focus */}
                    <div>
                      <div className="text-xs text-muted font-bold" style={{ marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Disease Focus (optional)
                      </div>
                      <div className="template-grid">
                        {DISEASE_TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            id={`disease-${t.id}`}
                            className={`template-card ${diseaseTemplate?.id === t.id ? "template-card--active" : ""}`}
                            onClick={() =>
                              setDiseaseTemplate(
                                diseaseTemplate?.id === t.id ? null : t
                              )
                            }
                          >
                            <div className="template-card__icon">{t.icon}</div>
                            <div className="template-card__name">{t.name}</div>
                            <div className="template-card__desc">{t.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recording UI */}
            {(phase === "idle" || phase === "recording") && (
              <div className="recording-ui">
                {phase === "recording" && (
                  <>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--color-red)",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "var(--color-red)",
                          display: "inline-block",
                          animation: "pulse-red 1.5s infinite",
                        }}
                      />
                      Recording
                    </div>
                    <div className="recording-timer">{formatTime(elapsed)}</div>
                  </>
                )}
                <button
                  id="record-btn"
                  className={`record-btn ${phase === "recording" ? "record-btn--active" : ""}`}
                  onClick={() =>
                    phase === "idle" ? startRecording() : stopRecording()
                  }
                >
                  {phase === "idle" ? "🎙️" : "⏹️"}
                </button>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--color-text-muted)",
                    textAlign: "center",
                  }}
                >
                  {phase === "idle"
                    ? "Tap to start recording"
                    : "Tap to stop and generate note"}
                </div>
              </div>
            )}

            {/* Transcribing */}
            {phase === "transcribing" && (
              <div className="loading-row" style={{ flexDirection: "column", gap: "12px", padding: "40px" }}>
                <div className="spinner" style={{ width: "32px", height: "32px" }} />
                <div style={{ fontSize: "14px" }}>Transcribing and generating note…</div>
                <div className="text-xs text-muted">This usually takes 10–30 seconds</div>
              </div>
            )}

            {/* Done */}
            {phase === "done" && (
              <>
                {/* Transcript */}
                {transcript && (
                  <div>
                    <div className="section-header">
                      <div className="section-title">Transcript</div>
                      <button className="section-link" onClick={reset}>
                        Record again
                      </button>
                    </div>
                    <div
                      style={{
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "12px",
                        fontSize: "12px",
                        color: "var(--color-text-muted)",
                        lineHeight: 1.6,
                        maxHeight: "120px",
                        overflowY: "auto",
                      }}
                    >
                      {transcript}
                    </div>
                  </div>
                )}

                {/* SOAP Note */}
                <div>
                  <div className="section-title" style={{ marginBottom: "8px" }}>
                    {noteFormat.name}
                  </div>
                  <textarea
                    id="soap-note-textarea"
                    className="soap-editor"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Generated note will appear here…"
                    style={{
                      width: "100%",
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--color-text)",
                      padding: "12px",
                      fontSize: "13px",
                      lineHeight: "1.6",
                      resize: "vertical",
                      minHeight: "220px",
                      outline: "none",
                    }}
                  />
                  <div className="ai-warning" style={{ marginTop: "8px" }}>
                    ⚠️ AI-GENERATED DRAFT — Requires physician review before filing.
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    id="save-visit-btn"
                    className="btn btn--primary"
                    style={{ flex: 1 }}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "💾 Save Visit"}
                  </button>
                  <button
                    id="push-ehr-btn"
                    className="btn btn--ghost"
                    style={{ flex: 1 }}
                    onClick={handlePushToEHR}
                    disabled={saving || pushed}
                  >
                    {pushed ? "✓ Pushed" : "🏥 Push to EHR"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = (reader.result as string).split(",")[1];
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
