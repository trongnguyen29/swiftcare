import Foundation

struct SavedNote: Codable, Identifiable {
    let id: String
    let patientId: String
    let transcript: String
    var notes: String
    let createdAt: String
    var templateName: String?   // optional — nil for notes created before this field
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
    func saveNote(patientId: String, transcript: String, notes: String, templateName: String? = nil) -> SavedNote {
        var list = loadNotes(patientId: patientId)
        let note = SavedNote(
            id: UUID().uuidString,
            patientId: patientId,
            transcript: transcript,
            notes: notes,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            templateName: templateName
        )
        list.insert(note, at: 0)
        list = Array(list.prefix(50))   // cap at 50 entries
        if let data = try? JSONEncoder().encode(list) {
            try? data.write(to: notesURL(for: patientId))
        }
        return note
    }
}
