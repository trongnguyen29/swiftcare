import { useState, useRef, useEffect } from "react";
import type { Patient } from "../../types/patient";
import { displayName } from "../../types/patient";
import { chatWithPatient } from "../../api/api";

interface AIChatProps {
  patient: Patient;
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

function buildPatientContext(p: Patient): string {
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
      ? `Problems: ${p.problems.map((pr) => pr.display).join(", ")}`
      : "",
    p.medications?.length
      ? `Medications: ${p.medications.map((m) => `${m.name} ${m.dose}`).join(", ")}`
      : "",
    p.allergies?.length
      ? `Allergies: ${p.allergies.map((a) => a.substance).join(", ")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const SUGGESTED = [
  "Summarize this patient's key concerns",
  "What are the medication risks?",
  "Suggest follow-up questions",
  "Check drug interactions",
];

export default function AIChat({ patient, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi! I have context on ${displayName(patient)}. Ask me anything about their chart, medications, or care plan.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const reply = await chatWithPatient(apiMessages, buildPatientContext(patient));
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Sorry, I couldn't connect. Please try again." },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="back-header">
        <button className="back-btn" onClick={onClose}>✕</button>
        <div className="back-header__title">AI Chat — {displayName(patient)}</div>
      </div>

      {/* Messages */}
      <div className="page">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`chat-bubble chat-bubble--${m.role}`}
              id={`chat-msg-${i}`}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="chat-bubble chat-bubble--assistant" style={{ opacity: 0.7 }}>
              <div className="spinner" style={{ width: "16px", height: "16px" }} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div
            style={{
              padding: "0 16px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {SUGGESTED.map((s) => (
              <button
                key={s}
                id={`suggest-${s.slice(0, 20).replace(/\s/g, "-")}`}
                onClick={() => send(s)}
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--color-text-muted)",
                  padding: "9px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--color-teal)")}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-input-row">
        <input
          id="chat-input"
          ref={inputRef}
          type="text"
          placeholder="Ask about this patient…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          disabled={loading}
          autoFocus
        />
        <button
          id="chat-send-btn"
          className="btn btn--primary btn--icon"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
        >
          →
        </button>
      </div>
    </div>
  );
}
