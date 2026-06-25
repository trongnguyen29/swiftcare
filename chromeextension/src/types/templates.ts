export interface TranscriptionTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  promptInstructions: string;
  isBuiltIn: boolean;
  category: "noteFormat" | "disease";
}

export const NOTE_FORMAT_TEMPLATES: TranscriptionTemplate[] = [
  {
    id: "soap",
    name: "SOAP Note",
    icon: "📋",
    description: "Subjective · Objective · Assessment · Plan",
    promptInstructions: `Generate a structured SOAP note:

**SUBJECTIVE** — Chief complaint and history of present illness in the patient's own words.

**OBJECTIVE** — Vitals, physical exam findings, and diagnostic results mentioned in the visit only. Do not fabricate.

**ASSESSMENT** — Clinical impression with hedged diagnostic language (e.g., "consistent with," "likely," "cannot rule out").

**PLAN** — Numbered list of treatments, medications (with doses if stated), referrals, patient education, and follow-up instructions.

---
⚠ AI-GENERATED DRAFT — Requires physician review before filing.`,
    isBuiltIn: true,
    category: "noteFormat",
  },
  {
    id: "hp",
    name: "H&P",
    icon: "🩺",
    description: "History & Physical — full admission-style note",
    promptInstructions: `Generate a comprehensive History & Physical (H&P) note:

**CHIEF COMPLAINT** — Primary reason for the visit.

**HISTORY OF PRESENT ILLNESS** — Detailed narrative including onset, location, duration, character, aggravating/relieving factors, associated symptoms, and prior treatment.

**PAST MEDICAL HISTORY** — Chronic conditions and significant illnesses mentioned.

**MEDICATIONS** — Current medications with doses and frequency if stated.

**ALLERGIES** — Drug and environmental allergies mentioned.

**SOCIAL HISTORY** — Tobacco, alcohol, occupation, living situation as mentioned.

**REVIEW OF SYSTEMS** — Pertinent positives and negatives.

**PHYSICAL EXAMINATION** — Vitals and exam findings as stated in the transcript only.

**ASSESSMENT & PLAN** — Problem-based assessment with numbered plan for each active issue.

---
⚠ AI-GENERATED DRAFT — Requires physician review before filing.`,
    isBuiltIn: true,
    category: "noteFormat",
  },
  {
    id: "progress",
    name: "Progress Note",
    icon: "📈",
    description: "Brief follow-up / interval note",
    promptInstructions: `Generate a concise Progress Note for a follow-up visit:

**INTERVAL HISTORY** — Changes in symptoms, medication tolerance, and relevant events since the last visit.

**OBJECTIVE** — Current vitals and focused exam findings mentioned in the visit.

**ASSESSMENT** — Brief clinical impression and response to treatment.

**PLAN** — Updated management plan: medication adjustments, new orders, referrals, and next follow-up.

---
⚠ AI-GENERATED DRAFT — Requires physician review before filing.`,
    isBuiltIn: true,
    category: "noteFormat",
  },
  {
    id: "discharge",
    name: "Discharge Summary",
    icon: "🚪",
    description: "Discharge summary with patient instructions",
    promptInstructions: `Generate a Discharge Summary:

**ADMISSION DIAGNOSIS** — Reason for admission.

**DISCHARGE DIAGNOSIS** — Final diagnosis at time of discharge.

**HOSPITAL COURSE** — Brief narrative of the patient's course, key interventions, and response.

**DISCHARGE CONDITION** — Patient status at discharge.

**DISCHARGE MEDICATIONS** — Medication list with doses; note any new medications or changes.

**DISCHARGE INSTRUCTIONS** — Activity restrictions, diet, wound care, or other patient instructions.

**FOLLOW-UP** — Scheduled appointments or recommended follow-up timeline.

**RETURN PRECAUTIONS** — Warning signs that should prompt the patient to return or call.

---
⚠ AI-GENERATED DRAFT — Requires physician review before filing.`,
    isBuiltIn: true,
    category: "noteFormat",
  },
  {
    id: "referral",
    name: "Referral Letter",
    icon: "✉️",
    description: "Formal letter to a consulting specialist",
    promptInstructions: `Generate a professional Referral Letter addressed to a specialist:

Begin with a formal salutation ("Dear Dr. [Specialist],").

**REASON FOR REFERRAL** — The specific question or concern prompting the referral.

**CLINICAL SUMMARY** — Relevant history, examination findings, and investigation results pertinent to the referral.

**CURRENT MANAGEMENT** — What has been tried or is currently ongoing.

**REQUEST** — Clearly state what input, investigation, or management is being requested.

Close with a professional sign-off ("Thank you for your assessment of this patient.").

---
⚠ AI-GENERATED DRAFT — Requires physician review before filing.`,
    isBuiltIn: true,
    category: "noteFormat",
  },
  {
    id: "procedure",
    name: "Procedure Note",
    icon: "✂️",
    description: "Pre/post-procedure documentation",
    promptInstructions: `Generate a Procedure Note:

**PROCEDURE** — Name and description of the procedure performed.

**INDICATION** — Clinical reason the procedure was performed.

**INFORMED CONSENT** — Whether consent was obtained.

**TECHNIQUE** — Step-by-step description based on the transcript.

**FINDINGS** — Relevant intraoperative or intraprocedural findings.

**COMPLICATIONS** — Any complications encountered, or "None" if stated.

**POST-PROCEDURE PLAN** — Recovery instructions, follow-up, and next steps.

---
⚠ AI-GENERATED DRAFT — Requires physician review before filing.`,
    isBuiltIn: true,
    category: "noteFormat",
  },
  {
    id: "custom",
    name: "Custom",
    icon: "✏️",
    description: "Write your own note instructions",
    promptInstructions: "",
    isBuiltIn: true,
    category: "noteFormat",
  },
];

export const DISEASE_TEMPLATES: TranscriptionTemplate[] = [
  {
    id: "hypertension",
    name: "Hypertension",
    icon: "❤️",
    description: "BP management, targets, medication adjustments",
    promptInstructions:
      "Focus on blood pressure readings (systolic/diastolic), antihypertensive medications and titration, lifestyle modifications, and JNC/AHA target adherence.",
    isBuiltIn: true,
    category: "disease",
  },
  {
    id: "diabetes",
    name: "Diabetes",
    icon: "🩸",
    description: "Glycemic control, HbA1c, insulin management",
    promptInstructions:
      "Focus on blood glucose values, HbA1c trends, diabetic medications (insulin, metformin, GLP-1, SGLT-2), hypoglycemia episodes, and diabetes complications screening.",
    isBuiltIn: true,
    category: "disease",
  },
  {
    id: "chf",
    name: "Heart Failure",
    icon: "💙",
    description: "Fluid status, EF, medication optimization",
    promptInstructions:
      "Focus on volume status (weight, edema, dyspnea), ejection fraction, guideline-directed medical therapy (ACEi/ARB, beta-blocker, diuretics, MRA), and functional class.",
    isBuiltIn: true,
    category: "disease",
  },
  {
    id: "asthma_copd",
    name: "Asthma / COPD",
    icon: "🫁",
    description: "Pulmonary function, inhaler adherence, exacerbations",
    promptInstructions:
      "Focus on symptom control, inhaler technique and adherence, spirometry/PFT results, exacerbation frequency, and step-up/step-down therapy.",
    isBuiltIn: true,
    category: "disease",
  },
  {
    id: "ckd",
    name: "CKD",
    icon: "🫘",
    description: "GFR trends, proteinuria, electrolytes",
    promptInstructions:
      "Focus on eGFR trend, proteinuria/creatinine ratio, potassium/phosphorus/bicarbonate levels, anemia of CKD, and nephrology referral thresholds.",
    isBuiltIn: true,
    category: "disease",
  },
];

export function buildEffectivePrompt(
  noteFormat: TranscriptionTemplate,
  diseaseTemplate: TranscriptionTemplate | null,
  customPrompt: string
): string {
  const base =
    noteFormat.id === "custom" ? customPrompt : noteFormat.promptInstructions;
  if (!diseaseTemplate) return base;
  return `${base}\n\nAdditionally, apply the following disease-specific clinical focus:\n\n${diseaseTemplate.promptInstructions}`;
}
