import Foundation
import Combine

/// A lightweight, persisted record of a recently-opened patient.
struct RecentPatient: Codable, Identifiable, Hashable {
    let ptnum: String
    let name: String
    let label: Int
    var id: String { ptnum }
}

/// Tracks the most recently opened patients (UserDefaults-backed) for quick
/// access on the Home screen.
@MainActor
final class RecentPatientsStore: ObservableObject {
    static let shared = RecentPatientsStore()

    private let key = "recent_patients_v1"
    private let maxCount = 10

    @Published private(set) var recents: [RecentPatient] = []

    private init() { load() }

    func record(_ patient: Patient) {
        let entry = RecentPatient(ptnum: patient.ptnum, name: patient.displayName, label: patient.label)
        var list = recents.filter { $0.ptnum != entry.ptnum }
        list.insert(entry, at: 0)
        if list.count > maxCount { list = Array(list.prefix(maxCount)) }
        recents = list
        save()
    }

    func clear() {
        recents = []
        save()
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let list = try? JSONDecoder().decode([RecentPatient].self, from: data) else { return }
        recents = list
    }

    private func save() {
        if let data = try? JSONEncoder().encode(recents) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
