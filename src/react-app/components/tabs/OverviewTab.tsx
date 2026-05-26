import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { vitals, vitalsTrend, upcomingTasks } from "../../data/patient";

const statusColor = (s: string) =>
  s === "normal" ? "var(--ok)" : s === "elevated" ? "var(--warn)" : "var(--danger)";

const taskIcons: Record<string, string> = {
  appointment: "📅",
  lab: "🧪",
  referral: "📤",
  procedure: "🩺",
  medication: "💊",
};

const taskColors: Record<string, string> = {
  appointment: "var(--accent-blue-dim)",
  lab: "var(--accent-cyan-dim)",
  referral: "var(--info-dim)",
  procedure: "var(--warn-dim)",
  medication: "var(--ok-dim)",
};

export default function OverviewTab() {
  return (
    <div className="overview-grid">

      {/* Vitals Card */}
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div className="card-header">
          <span className="card-title">Current Vitals</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Last updated: {vitals.lastUpdated}</span>
        </div>
        <div className="vitals-grid">
          {[
            { label: "Blood Pressure", ...vitals.bp },
            { label: "Heart Rate", value: vitals.hr.value, unit: vitals.hr.unit, status: vitals.hr.status },
            { label: "Temperature", value: vitals.temp.value, unit: vitals.temp.unit, status: vitals.temp.status },
            { label: "SpO₂", value: vitals.spo2.value, unit: vitals.spo2.unit, status: vitals.spo2.status },
            { label: "Resp. Rate", value: vitals.rr.value, unit: vitals.rr.unit, status: vitals.rr.status },
            { label: "Blood Glucose", value: vitals.glucose.value, unit: vitals.glucose.unit, status: vitals.glucose.status },
          ].map((v) => (
            <div key={v.label} className="vital-cell">
              <div className="vital-label">{v.label}</div>
              <div className={`vital-value ${v.status}`}>{v.value}</div>
              <div className="vital-unit">{v.unit}</div>
              <div className="vital-status" style={{ color: statusColor(v.status) }}>
                ● {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vitals Trend Chart */}
      <div className="card" style={{ gridColumn: "1 / 3" }}>
        <div className="card-header">
          <span className="card-title">7-Day Vitals Trend</span>
        </div>
        <div className="chart-wrap">
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-dot" style={{ background: "var(--warn)" }} />
              Systolic BP
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: "var(--accent-blue)" }} />
              Diastolic BP
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: "var(--accent-cyan)" }} />
              Glucose
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ background: "var(--ok)" }} />
              Heart Rate
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={vitalsTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--text-primary)",
                }}
              />
              <Line type="monotone" dataKey="bp_s" stroke="var(--warn)" strokeWidth={2} dot={false} name="Systolic BP" />
              <Line type="monotone" dataKey="bp_d" stroke="var(--accent-blue)" strokeWidth={2} dot={false} name="Diastolic BP" />
              <Line type="monotone" dataKey="glucose" stroke="var(--accent-cyan)" strokeWidth={2} dot={false} name="Glucose" />
              <Line type="monotone" dataKey="hr" stroke="var(--ok)" strokeWidth={2} dot={false} name="Heart Rate" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming Tasks */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Upcoming Tasks</span>
          <span className="badge badge-warn">{upcomingTasks.length} pending</span>
        </div>
        <div className="card-body" style={{ padding: "12px 18px" }}>
          {upcomingTasks.map((t) => (
            <div className="task-row" key={t.task}>
              <div className="task-icon" style={{ background: taskColors[t.type] }}>
                {taskIcons[t.type]}
              </div>
              <div className="task-name">{t.task}</div>
              <div className="task-due">{t.due}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
