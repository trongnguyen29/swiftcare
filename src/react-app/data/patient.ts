export const patient = {
  id: "PT-2024-00847",
  name: "Margaret L. Thornton",
  dob: "1958-04-12",
  age: 66,
  sex: "Female",
  mrn: "MRN-884721",
  bloodType: "A+",
  weight: "68 kg",
  height: "165 cm",
  bmi: 25.0,
  room: "4B-204",
  admittedOn: "2024-05-20",
  primaryDx: "Type 2 Diabetes Mellitus w/ CKD Stage 3",
  attending: "Dr. James R. Okafor, MD",
  insurance: "BlueCross BlueShield PPO",
  emergencyContact: "Robert Thornton (Spouse) · (617) 555-0192",
  allergies: [
    { substance: "Penicillin", reaction: "Anaphylaxis", severity: "severe" },
    { substance: "Sulfa drugs", reaction: "Rash, hives", severity: "moderate" },
    { substance: "Latex", reaction: "Contact dermatitis", severity: "mild" },
  ],
};

export const vitals = {
  lastUpdated: "Today, 08:42 AM",
  bp: { value: "138/86", unit: "mmHg", status: "elevated" },
  hr: { value: 74, unit: "bpm", status: "normal" },
  temp: { value: 37.1, unit: "°C", status: "normal" },
  spo2: { value: 97, unit: "%", status: "normal" },
  rr: { value: 16, unit: "/min", status: "normal" },
  glucose: { value: 182, unit: "mg/dL", status: "elevated" },
};

export const vitalsTrend = [
  { time: "Mon", bp_s: 145, bp_d: 90, glucose: 210, hr: 78 },
  { time: "Tue", bp_s: 142, bp_d: 88, glucose: 195, hr: 76 },
  { time: "Wed", bp_s: 140, bp_d: 87, glucose: 188, hr: 75 },
  { time: "Thu", bp_s: 139, bp_d: 86, glucose: 182, hr: 74 },
  { time: "Fri", bp_s: 138, bp_d: 86, glucose: 176, hr: 74 },
  { time: "Sat", bp_s: 136, bp_d: 85, glucose: 170, hr: 73 },
  { time: "Today", bp_s: 138, bp_d: 86, glucose: 182, hr: 74 },
];

export const medications = [
  {
    name: "Metformin",
    dose: "1000 mg",
    route: "PO",
    frequency: "Twice daily",
    status: "active",
    prescriber: "Dr. Okafor",
    lastGiven: "Today 08:00",
    nextDue: "Today 20:00",
  },
  {
    name: "Lisinopril",
    dose: "10 mg",
    route: "PO",
    frequency: "Once daily",
    status: "active",
    prescriber: "Dr. Okafor",
    lastGiven: "Today 08:00",
    nextDue: "Tomorrow 08:00",
  },
  {
    name: "Atorvastatin",
    dose: "40 mg",
    route: "PO",
    frequency: "Once nightly",
    status: "active",
    prescriber: "Dr. Okafor",
    lastGiven: "Yesterday 21:00",
    nextDue: "Tonight 21:00",
  },
  {
    name: "Empagliflozin",
    dose: "10 mg",
    route: "PO",
    frequency: "Once daily",
    status: "active",
    prescriber: "Dr. Okafor",
    lastGiven: "Today 08:00",
    nextDue: "Tomorrow 08:00",
  },
  {
    name: "Aspirin",
    dose: "81 mg",
    route: "PO",
    frequency: "Once daily",
    status: "active",
    prescriber: "Dr. Okafor",
    lastGiven: "Today 08:00",
    nextDue: "Tomorrow 08:00",
  },
  {
    name: "Furosemide",
    dose: "20 mg",
    route: "PO",
    frequency: "PRN edema",
    status: "prn",
    prescriber: "Dr. Okafor",
    lastGiven: "3 days ago",
    nextDue: "As needed",
  },
];

export const labs = [
  {
    panel: "Comprehensive Metabolic Panel",
    date: "May 25, 2024",
    results: [
      { name: "Glucose", value: 182, unit: "mg/dL", ref: "70–99", flag: "H" },
      { name: "BUN", value: 28, unit: "mg/dL", ref: "7–20", flag: "H" },
      { name: "Creatinine", value: 1.8, unit: "mg/dL", ref: "0.6–1.2", flag: "H" },
      { name: "eGFR", value: 38, unit: "mL/min", ref: ">60", flag: "L" },
      { name: "Sodium", value: 138, unit: "mEq/L", ref: "136–145", flag: null },
      { name: "Potassium", value: 4.2, unit: "mEq/L", ref: "3.5–5.0", flag: null },
      { name: "CO2", value: 24, unit: "mEq/L", ref: "22–29", flag: null },
      { name: "ALT", value: 32, unit: "U/L", ref: "7–40", flag: null },
      { name: "AST", value: 28, unit: "U/L", ref: "10–40", flag: null },
    ],
  },
  {
    panel: "HbA1c",
    date: "May 25, 2024",
    results: [
      { name: "HbA1c", value: 8.4, unit: "%", ref: "<5.7", flag: "H" },
    ],
  },
  {
    panel: "CBC",
    date: "May 25, 2024",
    results: [
      { name: "WBC", value: 7.2, unit: "K/uL", ref: "4.5–11.0", flag: null },
      { name: "RBC", value: 4.1, unit: "M/uL", ref: "4.2–5.4", flag: "L" },
      { name: "Hemoglobin", value: 11.8, unit: "g/dL", ref: "12.0–16.0", flag: "L" },
      { name: "Hematocrit", value: 35.2, unit: "%", ref: "37–47", flag: "L" },
      { name: "Platelets", value: 245, unit: "K/uL", ref: "150–400", flag: null },
    ],
  },
];

export const problems = [
  { name: "Type 2 Diabetes Mellitus", icd: "E11.9", onset: "2012", status: "active", severity: "moderate" },
  { name: "Chronic Kidney Disease, Stage 3", icd: "N18.3", onset: "2019", status: "active", severity: "moderate" },
  { name: "Hypertension", icd: "I10", onset: "2010", status: "active", severity: "moderate" },
  { name: "Hyperlipidemia", icd: "E78.5", onset: "2011", status: "active", severity: "mild" },
  { name: "Mild Normocytic Anemia", icd: "D64.9", onset: "2023", status: "active", severity: "mild" },
  { name: "Peripheral Neuropathy", icd: "G62.9", onset: "2020", status: "active", severity: "mild" },
  { name: "Appendectomy", icd: "Z87.19", onset: "1984", status: "historical", severity: null },
];

export const notes = [
  {
    type: "Progress Note",
    author: "Dr. James R. Okafor, MD",
    date: "May 26, 2024 · 09:15 AM",
    content:
      "Patient presents for follow-up on DM2 management. Reports mild fatigue but denies chest pain, shortness of breath, or vision changes. BG has been trending down since medication adjustment. BP remains mildly elevated — plan to uptitrate Lisinopril at next visit if not improving. eGFR stable at 38. Continue current regimen. Nephrology referral placed. Repeat labs in 3 months. Diet counseling reinforced — reduce sodium and refined carbs.",
  },
  {
    type: "Nursing Note",
    author: "RN Patricia Kim",
    date: "May 26, 2024 · 08:45 AM",
    content:
      "Patient awake, alert, and oriented x3. Morning vitals obtained. Blood glucose 182 mg/dL. Fasting labs drawn. Morning medications administered. Patient tolerated breakfast well. Denies pain. Lower extremity edema 1+ bilaterally. IV site patent and without signs of infiltration.",
  },
  {
    type: "Consult Note",
    author: "Dr. Linda Schwartz, Nephrology",
    date: "May 24, 2024 · 02:30 PM",
    content:
      "Consulted for CKD Stage 3 management in the setting of T2DM. Reviewed current medications — Empagliflozin appropriate and renoprotective. Recommend avoiding NSAIDs. Ensure adequate hydration. Continue monitoring K+ given ACE inhibitor use. Follow-up in nephrology clinic in 6 weeks. Repeat BMP prior to visit.",
  },
];

export const upcomingTasks = [
  { task: "Nephrology Clinic Follow-up", due: "Jun 10, 2024", type: "appointment" },
  { task: "Repeat BMP (Pre-nephrology labs)", due: "Jun 7, 2024", type: "lab" },
  { task: "HbA1c Recheck", due: "Aug 25, 2024", type: "lab" },
  { task: "Annual Eye Exam (Diabetic Retinopathy Screen)", due: "Jul 1, 2024", type: "referral" },
  { task: "Foot Exam", due: "Jun 26, 2024", type: "procedure" },
  { task: "Uptitrate Lisinopril (if BP not at goal)", due: "Jun 10, 2024", type: "medication" },
];
