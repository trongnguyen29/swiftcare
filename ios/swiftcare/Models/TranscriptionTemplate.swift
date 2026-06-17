import Foundation
import Combine

// MARK: - TemplateCategory

enum TemplateCategory: String, Codable, CaseIterable {
    case noteFormat = "noteFormat"
    case disease    = "disease"

    var label: String {
        switch self {
        case .noteFormat: return "Note Format"
        case .disease:    return "Disease Focus"
        }
    }
}

// MARK: - TranscriptionTemplate

struct TranscriptionTemplate: Identifiable, Codable, Equatable {
    let id: String
    let name: String
    let icon: String            // SF Symbol name
    let description: String
    let promptInstructions: String
    let isBuiltIn: Bool
    let category: TemplateCategory

    static func == (lhs: TranscriptionTemplate, rhs: TranscriptionTemplate) -> Bool {
        lhs.id == rhs.id
    }

    // MARK: - Note Format built-ins

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
        isBuiltIn: true,
        category: .noteFormat
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
        isBuiltIn: true,
        category: .noteFormat
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
        isBuiltIn: true,
        category: .noteFormat
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
        isBuiltIn: true,
        category: .noteFormat
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
        isBuiltIn: true,
        category: .noteFormat
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
        isBuiltIn: true,
        category: .noteFormat
    )

    // Custom placeholder — promptInstructions filled in by the user
    static let custom = TranscriptionTemplate(
        id: "custom",
        name: "Custom",
        icon: "pencil.and.outline",
        description: "Write your own note instructions",
        promptInstructions: "",
        isBuiltIn: true,
        category: .noteFormat
    )

    // MARK: - Disease Focus built-ins

    static let diabetes = TranscriptionTemplate(
        id: "disease_diabetes",
        name: "Diabetes",
        icon: "drop.fill",
        description: "Type 1/2 DM — glycemic control & complications",
        promptInstructions: """
        Generate a SOAP-style clinical note specifically focused on diabetes management:

        **SUBJECTIVE** — Chief complaint, symptoms of hypo/hyperglycemia (polyuria, polydipsia, blurred vision, fatigue, diaphoresis), medication adherence, dietary habits, self-monitoring frequency, and any recent illness or changes that may have affected glycemic control.

        **OBJECTIVE** — Current vitals (BP, weight, BMI). Key labs as discussed: HbA1c (with prior values if mentioned), fasting glucose, recent lipid panel, eGFR/creatinine, urine albumin-to-creatinine ratio. Foot exam and eye exam status if mentioned.

        **ASSESSMENT** — Glycemic control status (well-controlled / suboptimal / uncontrolled) based on HbA1c targets (<7% for most adults). Identify comorbidities: hypertension, dyslipidemia, CKD, neuropathy, retinopathy, cardiovascular disease. Note DM type (Type 1 / Type 2 / unspecified).

        **PLAN** — Numbered plan covering:
        1. Medication adjustments (insulin regimens, GLP-1 agonists, SGLT-2 inhibitors, metformin, etc.) with doses if stated
        2. Target HbA1c and monitoring frequency
        3. Referrals: endocrinology, ophthalmology, podiatry, dietitian, diabetes education
        4. Lifestyle counseling discussed
        5. Labs to order or recheck
        6. Follow-up interval

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true,
        category: .disease
    )

    static let hypertension = TranscriptionTemplate(
        id: "disease_htn",
        name: "Hypertension",
        icon: "waveform.path.ecg",
        description: "BP management, targets & end-organ damage",
        promptInstructions: """
        Generate a SOAP-style clinical note specifically focused on hypertension management:

        **SUBJECTIVE** — Chief complaint, symptoms (headache, dizziness, chest pain, palpitations, visual changes, dyspnea), medication adherence and tolerability, home BP readings if reported, salt/fluid intake, alcohol and caffeine use, stress levels.

        **OBJECTIVE** — BP readings (both arms if mentioned), HR, weight, BMI. Target-organ damage signs discussed: retinal changes, bruits, peripheral edema. Relevant labs: BMP, eGFR, urine albumin, lipids, ECG findings if mentioned.

        **ASSESSMENT** — BP classification per ACC/AHA guidelines (Normal / Elevated / Stage 1 / Stage 2 / Hypertensive urgency or emergency). Identify contributing factors and end-organ damage. Note cardiovascular risk stratification if discussed.

        **PLAN** — Numbered plan covering:
        1. Antihypertensive medication changes (ACEi, ARB, CCB, thiazide, beta-blocker) with doses if stated
        2. BP target (e.g., <130/80 mmHg for most patients)
        3. Lifestyle modifications discussed (DASH diet, sodium restriction, exercise, weight loss, alcohol reduction)
        4. Home BP monitoring instructions
        5. Labs to order
        6. Follow-up interval and threshold to return sooner

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true,
        category: .disease
    )

    static let copd = TranscriptionTemplate(
        id: "disease_copd",
        name: "COPD",
        icon: "lungs.fill",
        description: "Airflow obstruction, exacerbations & inhaler review",
        promptInstructions: """
        Generate a SOAP-style clinical note specifically focused on COPD management:

        **SUBJECTIVE** — Chief complaint, dyspnea (quantify: rest / exertion / at night), chronic cough and sputum production (character, color, volume), wheeze, exercise tolerance (MRC dyspnea scale if mentioned), recent exacerbations (frequency, severity, ED visits, hospitalizations), smoking history (pack-years, current status), inhaler technique and adherence.

        **OBJECTIVE** — Vitals including O₂ saturation (room air vs supplemental O₂). Respiratory exam findings as described: air entry, wheeze, rhonchi, accessory muscle use, barrel chest. Relevant data: spirometry (FEV1, FEV1/FVC ratio, GOLD stage), CXR or CT findings if mentioned.

        **ASSESSMENT** — GOLD classification if determinable (GOLD 1–4, Group A–D). Exacerbation risk (low / high). Identify comorbidities: cor pulmonale, heart failure, anxiety/depression, OSA, lung cancer risk.

        **PLAN** — Numbered plan covering:
        1. Inhaler regimen (SABA, LABA, LAMA, ICS combinations) with changes if discussed
        2. Exacerbation action plan review
        3. Pulmonary rehabilitation referral if discussed
        4. Vaccination status (influenza, pneumococcal, COVID-19)
        5. Smoking cessation support if applicable
        6. Supplemental O₂ threshold or current prescription
        7. Follow-up interval; criteria for urgent return

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true,
        category: .disease
    )

    static let heartFailure = TranscriptionTemplate(
        id: "disease_hf",
        name: "Heart Failure",
        icon: "heart.fill",
        description: "HFrEF / HFpEF — volume status & GDMT",
        promptInstructions: """
        Generate a SOAP-style clinical note specifically focused on heart failure management:

        **SUBJECTIVE** — Chief complaint, dyspnea on exertion (NYHA class if determinable), orthopnea (number of pillows), paroxysmal nocturnal dyspnea, leg swelling, weight gain (daily weights if tracked), fatigue, reduced exercise tolerance, dietary sodium and fluid adherence, medication adherence including diuretics.

        **OBJECTIVE** — Vitals: BP, HR, weight (compare to dry weight if known), O₂ saturation. Clinical volume status: JVD, S3 gallop, crackles, peripheral edema (grade). Relevant data: BNP/NT-proBNP, BMP (K⁺, Na⁺, creatinine, eGFR), recent echo (EF, LV size) if mentioned.

        **ASSESSMENT** — HF phenotype (HFrEF EF <40% / HFmrEF 40–49% / HFpEF ≥50%). NYHA functional class. Volume status (euvolemic / hypervolemic / hypovolemic). Identify precipitants of any decompensation: arrhythmia, dietary indiscretion, medication non-adherence, infection, ischemia.

        **PLAN** — Numbered plan covering:
        1. Diuretic adjustment (furosemide dose, frequency) based on volume status
        2. GDMT optimization: ACEi/ARB/ARNI, beta-blocker, MRA, SGLT-2 inhibitor — doses if stated
        3. Electrolyte management
        4. Device therapy (ICD, CRT) discussion if applicable
        5. Fluid and sodium restriction targets discussed
        6. Weight monitoring instructions and escalation threshold
        7. Referrals: cardiology, heart failure clinic, cardiac rehab
        8. Follow-up interval

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true,
        category: .disease
    )

    static let lungCancer = TranscriptionTemplate(
        id: "disease_lc",
        name: "Lung Cancer",
        icon: "cross.case.fill",
        description: "Screening, staging, treatment & surveillance",
        promptInstructions: """
        Generate a SOAP-style clinical note specifically focused on lung cancer care:

        **SUBJECTIVE** — Chief complaint, pulmonary symptoms (cough character/hemoptysis, dyspnea, wheezing, chest pain), constitutional symptoms (weight loss, fatigue, anorexia, night sweats, fever), neurological symptoms if mentioned (headache, focal deficits — metastatic concern), smoking history (pack-years, current status, cessation attempts), occupational/environmental exposures. For established patients: treatment tolerance, side effects, functional status.

        **OBJECTIVE** — Vitals, O₂ saturation, weight/weight change. Respiratory exam findings as stated. Relevant imaging: CXR, CT chest (nodule size, location, characteristics), PET/CT, brain MRI findings if mentioned. Pathology: cell type (NSCLC — adenocarcinoma, squamous, large cell; SCLC), molecular markers (EGFR, ALK, ROS1, KRAS, PD-L1 TPS) if discussed.

        **ASSESSMENT** — Cancer stage (TNM: I–IV) if determinable. ECOG performance status if discussed. Treatment phase: screening / diagnostic workup / curative intent / palliative / surveillance. Note LC screening eligibility per USPSTF criteria (50–80 yo, 20+ pack-year, current or quit <15 years) if relevant.

        **PLAN** — Numbered plan covering:
        1. Pending diagnostic workup (biopsy, bronchoscopy, mediastinoscopy, molecular profiling)
        2. Multidisciplinary tumor board discussion if applicable
        3. Treatment plan (surgery, radiation, chemotherapy, targeted therapy, immunotherapy) with regimen and cycle if stated
        4. Symptom management: pain, dyspnea, cough, nausea
        5. Smoking cessation support
        6. LDCT surveillance schedule if applicable
        7. Palliative care / hospice referral if discussed
        8. Follow-up: imaging, labs, oncology visit

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true,
        category: .disease
    )

    static let ckd = TranscriptionTemplate(
        id: "disease_ckd",
        name: "CKD",
        icon: "aqi.medium",
        description: "Staging, progression & renal protection",
        promptInstructions: """
        Generate a SOAP-style clinical note specifically focused on chronic kidney disease management:

        **SUBJECTIVE** — Chief complaint, uremic symptoms (fatigue, nausea, anorexia, pruritus, edema, dyspnea, cognitive changes), urine output changes, medication adherence, diet adherence (protein, potassium, phosphorus, sodium restriction), fluid intake. For dialysis patients: treatment tolerance, access issues.

        **OBJECTIVE** — Vitals: BP (target <130/80), weight, volume status. Relevant labs as discussed: creatinine, eGFR (CKD-EPI), BUN, electrolytes (K⁺, Na⁺, bicarbonate), CBC (anemia), phosphorus, calcium, PTH, 25-OH vitamin D, urine ACR. Current CKD stage (1–5) if determinable.

        **ASSESSMENT** — CKD stage by eGFR and albuminuria category (G1–G5, A1–A3). Identify etiology (diabetic nephropathy, hypertensive nephrosclerosis, glomerulonephritis, etc.). Assess progression risk. Note complications: anemia, hyperkalemia, metabolic acidosis, CKD-MBD (bone/mineral disorder), hypertension, cardiovascular risk.

        **PLAN** — Numbered plan covering:
        1. BP management and RAAS blockade (ACEi/ARB) — nephroprotective dosing
        2. SGLT-2 inhibitor if applicable (eGFR threshold)
        3. Electrolyte management (K⁺ binders, bicarbonate supplementation)
        4. Anemia management (EPO stimulating agent, IV iron)
        5. CKD-MBD: phosphate binders, vitamin D, cinacalcet
        6. Dietary referral (renal diet: protein, potassium, phosphorus, sodium targets)
        7. Nephrology referral or current follow-up plan
        8. AV fistula planning / dialysis education if approaching ESKD
        9. Labs to recheck and follow-up interval

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true,
        category: .disease
    )

    static let asthma = TranscriptionTemplate(
        id: "disease_asthma",
        name: "Asthma",
        icon: "wind",
        description: "Severity, control & step therapy",
        promptInstructions: """
        Generate a SOAP-style clinical note specifically focused on asthma management:

        **SUBJECTIVE** — Chief complaint, symptom frequency (daytime/nighttime), rescue inhaler use (frequency per week), activity limitation, symptom triggers (allergens, exercise, cold air, NSAIDS, smoke, infections), recent exacerbations (ED visits, oral steroid courses, hospitalizations), current inhaler regimen and technique, adherence. Assess control level: well-controlled / not well-controlled / very poorly controlled.

        **OBJECTIVE** — Vitals, O₂ saturation. Respiratory exam: wheeze, prolonged expiration, accessory muscle use. Relevant data: peak flow (% predicted or personal best), spirometry (FEV1, FEV1/FVC, reversibility with bronchodilator) if mentioned, FeNO if measured.

        **ASSESSMENT** — Asthma control level per NAEPP guidelines. Identify triggers and comorbidities that worsen control: allergic rhinitis, GERD, obesity, OSA, anxiety, vocal cord dysfunction. Assess step of therapy (Steps 1–6).

        **PLAN** — Numbered plan covering:
        1. Step therapy adjustment: ICS dose, addition of LABA, LAMA, LTRA, biologic eligibility (eosinophilic asthma — dupilumab, benralizumab, mepolizumab)
        2. Rescue inhaler (SABA or ICS-formoterol PRN per GINA)
        3. Asthma action plan review (green/yellow/red zones)
        4. Trigger avoidance counseling
        5. Allergen testing / immunotherapy referral if appropriate
        6. Smoking cessation support if applicable
        7. Pulmonology or allergist referral if applicable
        8. Follow-up interval

        ---
        ⚠ AI-GENERATED DRAFT — Requires physician review before filing.
        """,
        isBuiltIn: true,
        category: .disease
    )

    // MARK: - Grouped collections

    static let noteFormatTemplates: [TranscriptionTemplate] = [
        .soap, .hp, .progress, .discharge, .referral, .procedure, .custom
    ]

    static let diseaseTemplates: [TranscriptionTemplate] = [
        .diabetes, .hypertension, .copd, .heartFailure, .lungCancer, .ckd, .asthma
    ]

    /// All built-ins across both categories
    static let builtIns: [TranscriptionTemplate] = noteFormatTemplates + diseaseTemplates
}

// MARK: - Template Store

/// Manages the selected template and any custom prompt the user has written.
/// Persists selections via UserDefaults.
class TemplateStore: ObservableObject {
    static let shared = TemplateStore()

    private let selectedIdKey    = "swiftcare.selectedTemplateId"
    private let customPromptKey  = "swiftcare.customTemplatePrompt"

    // @Published + didSet cannot be combined in Swift; use manual objectWillChange instead.
    var selectedTemplate: TranscriptionTemplate {
        willSet { objectWillChange.send() }
        didSet  { UserDefaults.standard.set(selectedTemplate.id, forKey: selectedIdKey) }
    }

    /// The user-written prompt when "Custom" is selected
    var customPrompt: String {
        willSet { objectWillChange.send() }
        didSet  { UserDefaults.standard.set(customPrompt, forKey: customPromptKey) }
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
