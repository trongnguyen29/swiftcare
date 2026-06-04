import { useState, useRef, useEffect } from "react";

interface Message { role: "user" | "assistant"; content: string; }

const SYSTEM = `You are an expert clinical research analyst embedded in SwiftCare, a lung cancer surveillance EHR platform. You specialize in interpreting the Synthea synthetic lung cancer research cohort for clinical researchers, epidemiologists, and physicians.

DATASET — Synthea Synthetic Lung Cancer Cohort
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cohort size:   21,601 total | 5,566 LC Positive (25.8%) | 16,035 Control (74.2%)
Demographics:  Mean age 59.5y | 57.5% male, 42.5% female
               Race: 81.9% white, 8.3% Black, 7.2% Asian
Tobacco:       56.8% never smoked | 43.1% former smokers | 0% current smokers
SCC Score:     Mean 103.8, range 9–172
               Low (<80): 3,676 pts | Mid (80–120): 14,131 pts | High (>120): 3,794 pts
BMI:           Mean 28.9
Vitals (avg):  Systolic 124.3 mmHg | Diastolic 82.6 | HR 81.0 bpm
Labs (avg):    Total Chol 185.5 | LDL 106.5 | HDL 61.8 | HbA1c 5.8%

TOBACCO RISK STRATIFICATION:
  Former smokers → 3,241 LC+ out of 9,317 total = 34.8% LC rate
  Never smokers  → 2,312 LC+ out of 12,271 total = 18.8% LC rate
  Relative risk  → ~1.85× higher LC rate in former smokers

AGE DISTRIBUTION:
  Zero LC cases under age 40. Cases rise sharply from 50–60.
  Peak: age 60–70 group with 1,910 LC positive cases.

NOTE: This is synthetic Synthea data — statistical patterns may not directly extrapolate to real-world populations.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE RULES:
1. Lead with the direct answer — then support with data
2. Always cite specific numbers with denominators (e.g., "3,241 of 9,317 former smokers")
3. Prefix dataset findings with "In this cohort..." and general evidence with "Clinically..."
4. For comparisons, provide both absolute counts and rates
5. If asked about data not in this dataset, say so and offer the closest available insight
6. Flag anything unexpected or counter-intuitive in the data
7. Keep responses concise and scannable — use bullets when listing multiple items`;

const SUGGESTIONS = [
  "What is the lung cancer prevalence in this cohort?",
  "How does tobacco use affect LC risk here?",
  "Which age group has the highest LC rate?",
  "Summarize the key risk factors in this dataset",
  "What do the SCC scores tell us?",
  "Compare male vs female LC rates",
  "What are the average vitals for LC positive patients?",
];

export default function AITab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const updated = [...messages, {role:"user" as const, content: text.trim()}];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const res  = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          system: SYSTEM,
          max_tokens: 1000,
          messages: updated.map(m => ({role:m.role, content:m.content})),
        }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || data.error?.message || "No response.";
      setMessages(prev => [...prev, {role:"assistant", content:reply}]);
    } catch {
      setMessages(prev => [...prev, {role:"assistant", content:"⚠ Unable to reach AI service."}]);
    } finally { setLoading(false); }
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{background:"var(--info-bg)",border:"1px solid var(--info-bdr)",borderRadius:"var(--radius-lg)",padding:"12px 18px",display:"flex",alignItems:"center",gap:10,fontSize:12,color:"var(--info)"}}>
        <span style={{fontSize:16}}>ℹ</span>
        <span><strong>Dataset AI</strong> — This assistant has the full Synthea lung cancer cohort (21,601 patients) loaded as context. Ask about trends, statistics, risk factors, or individual patient questions.</span>
      </div>

      <div className="ai-panel">
        <div className="ai-panel-header">
          <div className="ai-icon">✦</div>
          <div>
            <div className="ai-panel-title">Lung Cancer Dataset Assistant</div>
            <div className="ai-panel-sub">21,601 patients · Synthea cohort · Full context loaded</div>
          </div>
        </div>

        <div className="ai-messages">
          {messages.length === 0 && (
            <div style={{textAlign:"center",padding:"28px 20px",color:"var(--text-faint)",fontSize:13}}>
              <div style={{fontSize:32,marginBottom:10}}>✦</div>
              Ask anything about the lung cancer dataset.<br/>
              <span style={{fontSize:11}}>All 21,601 patient statistics are pre-loaded as context.</span>
            </div>
          )}
          {messages.map((m,i) => (
            <div key={i} className={`ai-msg ${m.role}`}>
              {m.role === "assistant" && <div style={{fontSize:10,fontWeight:700,color:"var(--blue-600)",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>AI Assistant</div>}
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="ai-msg loading">
              <div style={{fontSize:10,fontWeight:700,color:"var(--blue-600)",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>AI Assistant</div>
              Analyzing dataset…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="ai-input-row">
          <input className="ai-input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send(input)} placeholder="Ask about the dataset, risk factors, statistics…" disabled={loading} />
          <button className="ai-send-btn" onClick={()=>send(input)} disabled={loading||!input.trim()}>{loading?"…":"Ask"}</button>
        </div>

        <div className="ai-suggestions">
          {SUGGESTIONS.map(s => <button key={s} className="ai-chip" onClick={()=>send(s)}>{s}</button>)}
        </div>
      </div>
    </div>
  );
}
