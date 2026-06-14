import Foundation

struct SavedNote: Codable, Identifiable {
    let id: String
    let patientId: String
    let transcript: String
    var notes: String
    let createdAt: String
}

/// Local JSON-file note persistence, mirroring the Rust save_note / load_notes commands.
class NotesService {
    static let shared = NotesService()
    private init() {}

    private func notesURL(for patientId: String) -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("notes_\(patientId).json")
    }

    func loadNotes(patientId: String) -> [SavedNote] {
        let url = notesURL(for: patientId)
        guard let data = try? Data(contentsOf: url),
              let list = try? JSONDecoder().decode([SavedNote].self, from: data)
        else { return [] }
        return list
    }

    @discardableResult
    func saveNote(patientId: String, transcript: String, notes: String) -> SavedNote {
        var list = loadNotes(patientId: patientId)
        let note = SavedNote(
            id: UUID().uuidString,
            patientId: patientId,
            transcript: transcript,
            notes: notes,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        list.insert(note, at: 0)
        list = Array(list.prefix(50))   // cap at 50 entries
        if let data = try? JSONEncoder().encode(list) {
            try? data.write(to: notesURL(for: patientId))
        }
        return note
    }
}
