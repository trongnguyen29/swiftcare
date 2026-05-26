import { notes } from "../../data/patient";

const typeColors: Record<string, string> = {
  "Progress Note": "var(--accent-blue)",
  "Nursing Note": "var(--ok)",
  "Consult Note": "var(--accent-cyan)",
};

export default function NotesTab() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Showing {notes.length} notes for current encounter
        </div>
        <button className="header-btn">+ Add Note</button>
      </div>

      {notes.map((note, i) => (
        <div className="note-card" key={i}>
          <div className="note-header">
            <div>
              <div className="note-type" style={{ color: typeColors[note.type] || "var(--accent-cyan)" }}>
                {note.type}
              </div>
              <div className="note-author" style={{ marginTop: 2 }}>{note.author}</div>
            </div>
            <div className="note-date">{note.date}</div>
          </div>
          <div className="note-body">{note.content}</div>
        </div>
      ))}
    </div>
  );
}
