import Foundation
import Combine

// MARK: - TranscriptionTemplate

struct TranscriptionTemplate: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let icon: String          // SF Symbol name
    let description: String
    let promptInstructions: String
    let isBuiltIn: Bool

    static func == (lhs: TranscriptionTemplate, rhs: TranscriptionTemplate) -> Bool {
        lhs.id == rhs.id
    }

    // MARK: Built-in templates

    static let soap = TranscriptionTemplate(
        id: "soap",
        name: "SOAP Note",
        icon: "list.bullet.clipboard",
        description: "Subjective · Objective · Assessment · Plan",
        promptInstructions: """
        Generate a structured SOAP note:

        **SUBJECTIVE** — Chief complaint and history of present illness in the patient's own words. Include onset, duration, character, severity, and relevant context.

        **OBJECTIVE** — Vitals, physical exam findings, and diagnostic results mentioned in the visit only. Do not fabricate.

        **ASSESSMENT** — Clinical impression with hedged diagnostic language (e.g., "consistent with," "likely," "cannot rule out").

        **PLAN** — Numbered list of treatments, medications (with doses if stated), referrals, patient education, and follow-up instructions discussed during the visit.

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true
    )

    static let hp = TranscriptionTemplate(
        id: "hp",
        name: "H&P",
        icon: "stethoscope",
        description: "History & Physical — full admission-style note",
        promptInstructions: """
        Generate a comprehensive History & Physical (H&P) note:

        **CHIEF COMPLAINT** — Primary reason for the visit in the patient's own words.

        **HISTORY OF PRESENT ILLNESS** — Detailed narrative of the current illness including onset, location, duration, character, aggravating/relieving factors, associated symptoms, and prior treatment.

        **PAST MEDICAL HISTORY** — Chronic conditions and significant illnesses mentioned.

        **MEDICATIONS** — Current medications as discussed; include doses and frequency if stated.

        **ALLERGIES** — Drug and environmental allergies mentioned.

        **SOCIAL HISTORY** — Tobacco, alcohol, occupation, living situation as mentioned.

        **REVIEW OF SYSTEMS** — Pertinent positives and negatives discussed during the visit.

        **PHYSICAL EXAMINATION** — Vitals and exam findings as stated in the transcript only.

        **ASSESSMENT & PLAN** — Problem-based assessment with numbered plan for each active issue.

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true
    )

    static let progress = TranscriptionTemplate(
        id: "progress",
        name: "Progress Note",
        icon: "chart.line.uptrend.xyaxis",
        description: "Brief follow-up / interval note",
        promptInstructions: """
        Generate a concise Progress Note for a follow-up visit:

        **INTERVAL HISTORY** — Changes in symptoms, medication tolerance, and relevant events since the last visit.

        **OBJECTIVE** — Current vitals and focused exam findings mentioned in the visit.

        **ASSESSMENT** — Brief clinical impression and response to treatment.

        **PLAN** — Updated management plan: medication adjustments, new orders, referrals, and next follow-up.

        Keep the note focused and brief — this is an interval note, not a full H&P.

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true
    )

    static let discharge = TranscriptionTemplate(
        id: "discharge",
        name: "Discharge Summary",
        icon: "arrow.right.square",
        description: "Discharge summary with patient instructions",
        promptInstructions: """
        Generate a Discharge Summary:

        **ADMISSION DIAGNOSIS** — Reason for admission as discussed.

        **DISCHARGE DIAGNOSIS** — Final diagnosis at time of discharge.

        **HOSPITAL COURSE** — Brief narrative of the patient's course, key interventions, and response.

        **DISCHARGE CONDITION** — Patient status at discharge (stable, improved, etc.).

        **DISCHARGE MEDICATIONS** — Medication list with doses; note any new medications or changes.

        **DISCHARGE INSTRUCTIONS** — Activity restrictions, diet, wound care, or other patient instructions discussed.

        **FOLLOW-UP** — Scheduled appointments or recommended follow-up timeline.

        **RETURN PRECAUTIONS** — Warning signs that should prompt the patient to return or call.

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true
    )

    static let referral = TranscriptionTemplate(
        id: "referral",
        name: "Referral Letter",
        icon: "envelope.open",
        description: "Formal letter to a consulting specialist",
        promptInstructions: """
        Generate a professional Referral Letter addressed to a specialist:

        Begin with a formal salutation ("Dear Dr. [Specialist],").

        **REASON FOR REFERRAL** — The specific question or concern prompting the referral.

        **CLINICAL SUMMARY** — Relevant history, examination findings, and investigation results pertinent to the referral.

        **CURRENT MANAGEMENT** — What has been tried or is currently ongoing.

        **REQUEST** — Clearly state what input, investigation, or management is being requested from the specialist.

        Close with a professional sign-off ("Thank you for your assessment of this patient.").

        Keep the letter concise (under 300 words) and clinically precise.

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true
    )

    static let procedure = TranscriptionTemplate(
        id: "procedure",
        name: "Procedure Note",
        icon: "scissors",
        description: "Pre/post-procedure documentation",
        promptInstructions: """
        Generate a Procedure Note:

        **PROCEDURE** — Name and description of the procedure performed.

        **INDICATION** — Clinical reason the procedure was performed.

        **INFORMED CONSENT** — Whether consent was obtained (as mentioned in the visit).

        **ANESTHESIA / SEDATION** — Type and medications used, if mentioned.

        **TECHNIQUE** — Step-by-step description of how the procedure was performed based on the transcript.

        **FINDINGS** — Relevant intraoperative or intraprocedural findings.

        **SPECIMENS** — Any specimens sent for pathology or culture, if mentioned.

        **COMPLICATIONS** — Any complications encountered, or "None" if stated.

        **POST-PROCEDURE PLAN** — Recovery instructions, follow-up, and next steps.

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true
    )

    // Custom placeholder — promptInstructions will be filled in by the user
    static let custom = TranscriptionTemplate(
        id: "custom",
        name: "Custom",
        icon: "pencil.and.outline",
        description: "Write your own note instructions",
        promptInstructions: "",
        isBuiltIn: true
    )

    // MARK: - All built-ins

    static let builtIns: [TranscriptionTemplate] = [
        .soap, .hp, .progress, .discharge, .referral, .procedure, .custom
    ]
}

// MARK: - Template Store

/// Manages the selected template and any custom prompt the user has written.
/// Persists selections via UserDefaults.
class TemplateStore: ObservableObject {
    static let shared = TemplateStore()

    private let selectedIdKey = "swiftcare.selectedTemplateId"
    private let customPromptKey = "swiftcare.customTemplatePrompt"

    // @Published + didSet cannot be combined in Swift; use manual objectWillChange instead.
    var selectedTemplate: TranscriptionTemplate {
        willSet { objectWillChange.send() }
        didSet { UserDefaults.standard.set(selectedTemplate.id, forKey: selectedIdKey) }
    }

    /// The user-written prompt when "Custom" is selected
    var customPrompt: String {
        willSet { objectWillChange.send() }
        didSet { UserDefaults.standard.set(customPrompt, forKey: customPromptKey) }
    }

    private init() {
        let savedId = UserDefaults.standard.string(forKey: "swiftcare.selectedTemplateId") ?? "soap"
        self.selectedTemplate = TranscriptionTemplate.builtIns.first { $0.id == savedId } ?? .soap
        self.customPrompt = UserDefaults.standard.string(forKey: "swiftcare.customTemplatePrompt") ?? ""
    }

    /// Returns the effective prompt instructions for the current selection
    var effectivePromptInstructions: String {
        if selectedTemplate.id == "custom" {
            return customPrompt
        }
        return selectedTemplate.promptInstructions
    }
}
