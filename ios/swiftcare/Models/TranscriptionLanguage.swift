import Foundation

// MARK: - TranscriptionLanguage

struct TranscriptionLanguage: Identifiable, Equatable {
    let id: String          // BCP-47 / Whisper language code, e.g. "en"
    let name: String        // Display name, e.g. "English"
    let flag: String        // Flag emoji for compact display
}

extension TranscriptionLanguage {

    // MARK: - Built-in languages
    // Whisper supports many more; add entries here as needed.

    static let english    = TranscriptionLanguage(id: "en",  name: "English",    flag: "🇺🇸")
    static let spanish    = TranscriptionLanguage(id: "es",  name: "Spanish",    flag: "🇪🇸")
    static let french     = TranscriptionLanguage(id: "fr",  name: "French",     flag: "🇫🇷")
    static let portuguese = TranscriptionLanguage(id: "pt",  name: "Portuguese", flag: "🇧🇷")
    static let mandarin   = TranscriptionLanguage(id: "zh",  name: "Mandarin",   flag: "🇨🇳")
    static let cantonese  = TranscriptionLanguage(id: "yue", name: "Cantonese",  flag: "🇭🇰")
    static let hindi      = TranscriptionLanguage(id: "hi",  name: "Hindi",      flag: "🇮🇳")
    static let arabic     = TranscriptionLanguage(id: "ar",  name: "Arabic",     flag: "🇸🇦")
    static let korean     = TranscriptionLanguage(id: "ko",  name: "Korean",     flag: "🇰🇷")
    static let tagalog    = TranscriptionLanguage(id: "tl",  name: "Tagalog",    flag: "🇵🇭")
    static let vietnamese = TranscriptionLanguage(id: "vi",  name: "Vietnamese", flag: "🇻🇳")
    static let russian    = TranscriptionLanguage(id: "ru",  name: "Russian",    flag: "🇷🇺")
    static let german     = TranscriptionLanguage(id: "de",  name: "German",     flag: "🇩🇪")
    static let italian    = TranscriptionLanguage(id: "it",  name: "Italian",    flag: "🇮🇹")
    static let japanese   = TranscriptionLanguage(id: "ja",  name: "Japanese",   flag: "🇯🇵")

    /// All available languages — first entry is the default.
    static let all: [TranscriptionLanguage] = [
        .english, .spanish, .french, .portuguese,
        .mandarin, .cantonese, .hindi, .arabic,
        .korean, .tagalog, .vietnamese, .russian,
        .german, .italian, .japanese,
    ]

    // MARK: - Persistence

    private static let defaultsKey = "swiftcare.transcriptionLanguageId"

    static var persisted: TranscriptionLanguage {
        get {
            let saved = UserDefaults.standard.string(forKey: defaultsKey) ?? "en"
            return all.first { $0.id == saved } ?? .english
        }
        set {
            UserDefaults.standard.set(newValue.id, forKey: defaultsKey)
        }
    }
}
