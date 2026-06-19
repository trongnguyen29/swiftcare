import Foundation
import Combine

@MainActor
final class PatientContactStore: ObservableObject {
    static let shared = PatientContactStore()

    @Published private var phoneOverrides: [String: String]

    private let storageKey = "swiftcare.patientPhoneOverrides"

    private init() {
        phoneOverrides = UserDefaults.standard.dictionary(forKey: storageKey) as? [String: String] ?? [:]
    }

    func phone(forPtnum ptnum: String, fallback: String?) -> String? {
        phoneOverrides[ptnum] ?? fallback
    }

    func savePhone(_ phone: String, forPtnum ptnum: String) {
        let value = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty {
            phoneOverrides.removeValue(forKey: ptnum)
        } else {
            phoneOverrides[ptnum] = value
        }
        UserDefaults.standard.set(phoneOverrides, forKey: storageKey)
    }
}
