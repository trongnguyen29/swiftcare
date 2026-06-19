import Foundation

/// A structured SOAP note with fixed sections and subsections.
/// Subjective → Chief Complaint, History of Present Illness, Review of Systems, Additional Notes.
/// Objective  → Vitals (HR, BP, SpO₂, Temp, Weight, Height), Physical Exam, Lab Results, Additional Notes.
/// Assessment → free-form.  Plan → free-form.
struct SOAPNote: Equatable {
    var chiefComplaint = ""
    var hpi = ""
    var ros = ""
    var subjectiveAdditional = ""        // displayed as "Additional Notes"

    // Vitals — always six fixed fields. Extra vitals go in objectiveAdditional.
    var heartRate = ""
    var bloodPressure = ""
    var spo2 = ""
    var temperature = ""
    var weight = ""
    var height = ""

    var physicalExam = ""
    var labResults = ""
    var objectiveAdditional = ""         // displayed as "Additional Notes" (extra vitals / context)

    var assessment = ""
    var plan = ""

    static let empty = SOAPNote()

    private var allFields: [String] {
        [chiefComplaint, hpi, ros, subjectiveAdditional,
         heartRate, bloodPressure, spo2, temperature, weight, height,
         physicalExam, labResults, objectiveAdditional, assessment, plan]
    }

    var isEmpty: Bool {
        allFields.allSatisfy { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    /// Serialize to markdown for storage / EHR / copy.
    func markdown() -> String {
        func body(_ s: String) -> String {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? "Not discussed." : t
        }
        func vital(_ s: String) -> String {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? "Not stated" : t
        }
        return """
        ## Subjective
        ### Chief Complaint
        \(body(chiefComplaint))
        ### History of Present Illness
        \(body(hpi))
        ### Review of Systems
        \(body(ros))
        ### Additional Notes
        \(body(subjectiveAdditional))

        ## Objective
        ### Vitals
        Heart Rate: \(vital(heartRate))
        Blood Pressure: \(vital(bloodPressure))
        SpO2: \(vital(spo2))
        Temperature: \(vital(temperature))
        Weight: \(vital(weight))
        Height: \(vital(height))
        ### Physical Exam
        \(body(physicalExam))
        ### Lab Results
        \(body(labResults))
        ### Additional Notes
        \(body(objectiveAdditional))

        ## Assessment
        \(body(assessment))

        ## Plan
        \(body(plan))
        """
    }

    // MARK: - Parsing

    private enum Target { case none, cc, hpi, ros, subjNote, vitals, exam, labs, objNote, assessment, plan }

    /// Parse an LLM-generated note into the structured fields.
    static func parse(_ text: String) -> SOAPNote {
        var note = SOAPNote()
        var target: Target = .none
        var section: Section = .none
        var buffers: [Target: [String]] = [:]

        for rawLine in text.components(separatedBy: "\n") {
            if let header = headerTitle(rawLine) {
                let h = normalizedHeader(header)
                if let resolved = resolveHeader(h, section) {
                    target = resolved.0
                    section = resolved.1
                } else if target != .none {
                    buffers[target, default: []].append(plainLine(rawLine))
                }
                continue
            }
            if target != .none {
                buffers[target, default: []].append(plainLine(rawLine))
            }
        }

        func joined(_ t: Target) -> String {
            stripFiller((buffers[t] ?? []).joined(separator: "\n")
                .trimmingCharacters(in: .whitespacesAndNewlines))
        }
        note.chiefComplaint      = joined(.cc)
        note.hpi                 = joined(.hpi)
        note.ros                 = joined(.ros)
        note.subjectiveAdditional = joined(.subjNote)
        note.physicalExam        = joined(.exam)
        note.labResults          = joined(.labs)
        note.objectiveAdditional = joined(.objNote)
        note.assessment          = joined(.assessment)
        note.plan                = joined(.plan)

        let v = parseVitals(buffers[.vitals] ?? [])
        note.heartRate = v.hr
        note.bloodPressure = v.bp
        note.spo2 = v.spo2
        note.temperature = v.temp
        note.weight = v.weight
        note.height = v.height
        // Any non-standard vitals the model emitted under Vitals → fold into Additional Notes.
        if !v.leftover.isEmpty {
            note.objectiveAdditional = [note.objectiveAdditional, v.leftover]
                .filter { !$0.isEmpty }.joined(separator: "\n")
        }

        if note.isEmpty {
            note.assessment = text
                .components(separatedBy: "\n").map { plainLine($0) }
                .joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return note
    }

    private static func parseVitals(_ lines: [String]) ->
        (hr: String, bp: String, spo2: String, temp: String, weight: String, height: String, leftover: String) {
        var hr = "", bp = "", spo2 = "", temp = "", weight = "", height = ""
        var leftover: [String] = []
        for raw in lines {
            let t = raw.trimmingCharacters(in: .whitespaces)
            if t.isEmpty { continue }
            let lower = t.lowercased()
            let val = stripFiller(afterColon(t))
            if lower.contains("heart rate") || lower.contains("pulse") || lower.hasPrefix("hr") {
                hr = val
            } else if lower.contains("blood pressure") || lower.hasPrefix("bp") {
                bp = val
            } else if lower.contains("spo") || lower.contains("o2 sat") || lower.contains("oxygen") || lower.contains("sao2") {
                spo2 = val
            } else if lower.contains("temp") {
                temp = val
            } else if lower.contains("weight") {
                weight = val
            } else if lower.contains("height") {
                height = val
            } else {
                leftover.append(t)
            }
        }
        return (hr, bp, spo2, temp, weight, height, stripFiller(leftover.joined(separator: "\n")))
    }

    private static func afterColon(_ s: String) -> String {
        if let r = s.range(of: ":") { return String(s[r.upperBound...]).trimmingCharacters(in: .whitespaces) }
        return s.trimmingCharacters(in: .whitespaces)
    }

    private enum Section { case none, subjective, objective, other }

    /// Resolve a heading to (target field, section), using the current section so
    /// the duplicate "Additional Notes" heading routes to the right field.
    private static func resolveHeader(_ h: String, _ section: Section) -> (Target, Section)? {
        if h == "subjective" { return (.none, .subjective) }
        if h == "objective" { return (.none, .objective) }
        if h.contains("chief complaint") || h == "cc" { return (.cc, .subjective) }
        if h.contains("history of present illness") || h == "hpi" { return (.hpi, .subjective) }
        if h.contains("review of systems") || h == "ros" { return (.ros, .subjective) }
        if h.contains("vital") { return (.vitals, .objective) }
        if h.contains("lab") { return (.labs, .objective) }
        if h.contains("physical exam") || h == "exam" || h.contains("physical examination") { return (.exam, .objective) }
        if h.contains("additional note") {
            return section == .objective ? (.objNote, .objective) : (.subjNote, .subjective)
        }
        if h.contains("plan") { return (.plan, .other) }
        if h.contains("assessment") { return (.assessment, .other) }
        return nil
    }

    private static func headerTitle(_ line: String) -> String? {
        var s = line.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") {
            while s.hasPrefix("#") { s.removeFirst() }
            return s.trimmingCharacters(in: .whitespaces)
        }
        if s.hasPrefix("**"), s.hasSuffix("**"), s.count > 4, !s.contains(" — ") {
            let inner = String(s.dropFirst(2).dropLast(2))
            if inner.count < 48 { return inner }
        }
        return nil
    }

    private static func normalizedHeader(_ h: String) -> String {
        h.lowercased()
            .replacingOccurrences(of: "*", with: "")
            .replacingOccurrences(of: ":", with: "")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")
            .trimmingCharacters(in: .whitespaces)
    }

    private static func plainLine(_ line: String) -> String {
        var s = line
        while s.hasPrefix("#") { s.removeFirst() }
        s = s.trimmingCharacters(in: .whitespaces)
        for bullet in ["- ", "* ", "• "] where s.hasPrefix(bullet) {
            s = "• " + s.dropFirst(bullet.count); break
        }
        s = s.replacingOccurrences(of: "**", with: "")
        s = s.replacingOccurrences(of: "`", with: "")
        s = s.replacingOccurrences(of: "*", with: "")
        return s
    }

    private static func stripFiller(_ s: String) -> String {
        let lc = s.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let fillers: Set<String> = ["not discussed.", "not discussed", "not stated", "not stated.", "n/a", "none", "—", "-"]
        return fillers.contains(lc) ? "" : s
    }

    // MARK: - Generation prompt

    static let generationFormat = """
    Produce a SOAP note using EXACTLY the following sections and headings, in this order, each heading on its own line. Do not add, rename, merge, or remove any heading.

    ## Subjective
    ### Chief Complaint
    ### History of Present Illness
    ### Review of Systems
    ### Additional Notes

    ## Objective
    ### Vitals
    ### Physical Exam
    ### Lab Results
    ### Additional Notes

    ## Assessment

    ## Plan

    Rules:
    - Write the content for each subsection on the line(s) below its heading.
    - VITALS: Under "### Vitals", output EXACTLY these six lines, in this order, each on its own line: "Heart Rate: <value>", "Blood Pressure: <value>", "SpO2: <value>", "Temperature: <value>", "Weight: <value>", "Height: <value>". Use "Not stated" for any not mentioned. NEVER include pain score or BMI. If the clinician states any OTHER vital, put it in the Objective "### Additional Notes" section instead.
    - LAB RESULTS: list any lab values mentioned in the transcript, one per line; otherwise "Not discussed."
    - "Additional Notes" captures relevant context (including any extra vitals) that doesn't fit the other subsections.
    - "Assessment" and "Plan" are free-form: structure them however best fits the visit (e.g., problem-by-problem).
    - Document ONLY what is stated in the transcript. Never fabricate findings. Use hedged diagnostic language.
    - If a subsection has no information from the transcript, write "Not discussed." under it.
    """
}
