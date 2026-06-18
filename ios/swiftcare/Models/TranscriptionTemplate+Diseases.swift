import Foundation

// MARK: - Disease Focus built-ins
//
// To add a new disease:
//   1. Add a `static let` below using `disease(...)` + `soapPrompt(...)`.
//   2. Append the new property name to `diseaseTemplates` at the bottom.

extension TranscriptionTemplate {

    // MARK: Cardiovascular

    static let hypertension = disease(
        id: "disease_htn",
        name: "Hypertension",
        icon: "waveform.path.ecg",
        description: "BP management, targets & end-organ damage",
        promptInstructions: soapPrompt(
            topic: "hypertension management",
            subjective: "Chief complaint, symptoms (headache, dizziness, chest pain, palpitations, visual changes, dyspnea), medication adherence and tolerability, home BP readings if reported, salt/fluid intake, alcohol and caffeine use, stress levels.",
            objective: "BP readings (both arms if mentioned), HR, weight, BMI. Target-organ damage signs discussed: retinal changes, bruits, peripheral edema. Relevant labs: BMP, eGFR, urine albumin, lipids, ECG findings if mentioned.",
            assessment: "BP classification per ACC/AHA guidelines (Normal / Elevated / Stage 1 / Stage 2 / Hypertensive urgency or emergency). Identify contributing factors and end-organ damage. Note cardiovascular risk stratification if discussed.",
            planItems: [
                "Antihypertensive medication changes (ACEi, ARB, CCB, thiazide, beta-blocker) with doses if stated",
                "BP target (e.g., <130/80 mmHg for most patients)",
                "Lifestyle modifications discussed (DASH diet, sodium restriction, exercise, weight loss, alcohol reduction)",
                "Home BP monitoring instructions",
                "Labs to order",
                "Follow-up interval and threshold to return sooner",
            ]
        )
    )

    static let heartFailure = disease(
        id: "disease_hf",
        name: "Heart Failure",
        icon: "heart.fill",
        description: "HFrEF / HFpEF — volume status & GDMT",
        promptInstructions: soapPrompt(
            topic: "heart failure management",
            subjective: "Chief complaint, dyspnea on exertion (NYHA class if determinable), orthopnea (number of pillows), paroxysmal nocturnal dyspnea, leg swelling, weight gain (daily weights if tracked), fatigue, reduced exercise tolerance, dietary sodium and fluid adherence, medication adherence including diuretics.",
            objective: "Vitals: BP, HR, weight (compare to dry weight if known), O₂ saturation. Clinical volume status: JVD, S3 gallop, crackles, peripheral edema (grade). Relevant data: BNP/NT-proBNP, BMP (K⁺, Na⁺, creatinine, eGFR), recent echo (EF, LV size) if mentioned.",
            assessment: "HF phenotype (HFrEF EF <40% / HFmrEF 40–49% / HFpEF ≥50%). NYHA functional class. Volume status (euvolemic / hypervolemic / hypovolemic). Identify precipitants of any decompensation: arrhythmia, dietary indiscretion, medication non-adherence, infection, ischemia.",
            planItems: [
                "Diuretic adjustment (furosemide dose, frequency) based on volume status",
                "GDMT optimization: ACEi/ARB/ARNI, beta-blocker, MRA, SGLT-2 inhibitor — doses if stated",
                "Electrolyte management",
                "Device therapy (ICD, CRT) discussion if applicable",
                "Fluid and sodium restriction targets discussed",
                "Weight monitoring instructions and escalation threshold",
                "Referrals: cardiology, heart failure clinic, cardiac rehab",
                "Follow-up interval",
            ]
        )
    )

    static let atrialFibrillation = disease(
        id: "disease_afib",
        name: "Atrial Fibrillation",
        icon: "waveform.path.ecg.rectangle",
        description: "Rate/rhythm control & stroke prevention",
        promptInstructions: soapPrompt(
            topic: "atrial fibrillation management",
            subjective: "Chief complaint, palpitations (onset, frequency, duration, triggers), dyspnea, fatigue, presyncope or syncope, exercise tolerance, medication adherence (especially anticoagulants and rate/rhythm agents), bleeding symptoms, alcohol and caffeine use.",
            objective: "Vitals: HR (resting rate control target <110 bpm or <80 bpm per strategy), BP, O₂ saturation. ECG findings (AFib confirmed, rate, flutter vs. fibrillation). Thyroid function (TSH), CBC, BMP, renal function, LFTs if on DOAC. Echo findings (EF, LA size) if mentioned.",
            assessment: "AFib pattern (paroxysmal / persistent / long-standing persistent / permanent). Rate vs. rhythm control strategy. CHA₂DS₂-VASc score for stroke risk and anticoagulation indication. HAS-BLED bleeding risk. Identify reversible triggers: hyperthyroidism, OSA, alcohol, infection.",
            planItems: [
                "Rate control: beta-blocker or non-dihydropyridine CCB with dose if stated",
                "Rhythm control discussion: cardioversion timing, antiarrhythmic (flecainide, amiodarone, sotalol), ablation referral if applicable",
                "Anticoagulation: DOAC or warfarin (INR target) per CHA₂DS₂-VASc score",
                "OSA screening/referral if not yet evaluated",
                "Alcohol/trigger reduction counseling",
                "Labs to order or recheck",
                "Cardiology or electrophysiology referral if applicable",
                "Follow-up interval and return precautions",
            ]
        )
    )

    static let coronaryArteryDisease = disease(
        id: "disease_cad",
        name: "Coronary Artery Disease",
        icon: "heart.text.square",
        description: "Stable CAD — risk factor control & anti-anginal therapy",
        promptInstructions: soapPrompt(
            topic: "coronary artery disease management",
            subjective: "Chief complaint, chest pain or pressure (character, radiation, onset, duration, exertional vs. rest, relieving factors), dyspnea on exertion, palpitations, syncope, medication adherence (aspirin, statin, beta-blocker, nitrates), history of MI, PCI, or CABG.",
            objective: "Vitals: BP, HR. Cardiac exam as described. ECG findings if mentioned. Relevant labs: lipid panel (LDL target <70 mg/dL for high-risk), HbA1c, renal function. Stress test or imaging results if discussed.",
            assessment: "Stable vs. unstable angina. CCS angina class if determinable. Adequacy of risk factor control: BP, LDL, glucose, smoking. Assess medication adherence and tolerance. Note history of revascularization and any stent type (bare metal vs. drug-eluting).",
            planItems: [
                "Antiplatelet therapy: aspirin ± P2Y12 inhibitor — dose and duration per revascularization history",
                "Statin intensification to achieve LDL <70 mg/dL (or <55 mg/dL if very high risk); consider ezetimibe or PCSK9 inhibitor",
                "Anti-anginal optimization: beta-blocker, long-acting nitrate, CCB — doses if stated",
                "BP and HR targets discussed",
                "Cardiac rehabilitation referral if applicable",
                "Stress testing or cardiology referral if symptoms have changed",
                "Lifestyle: diet, exercise, smoking cessation, weight management",
                "Labs to order and follow-up interval",
            ]
        )
    )

    // MARK: Endocrine & Metabolic

    static let diabetes = disease(
        id: "disease_diabetes",
        name: "Diabetes",
        icon: "drop.fill",
        description: "Type 1/2 DM — glycemic control & complications",
        promptInstructions: soapPrompt(
            topic: "diabetes management",
            subjective: "Chief complaint, symptoms of hypo/hyperglycemia (polyuria, polydipsia, blurred vision, fatigue, diaphoresis), medication adherence, dietary habits, self-monitoring frequency, and any recent illness or changes that may have affected glycemic control.",
            objective: "Current vitals (BP, weight, BMI). Key labs as discussed: HbA1c (with prior values if mentioned), fasting glucose, recent lipid panel, eGFR/creatinine, urine albumin-to-creatinine ratio. Foot exam and eye exam status if mentioned.",
            assessment: "Glycemic control status (well-controlled / suboptimal / uncontrolled) based on HbA1c targets (<7% for most adults). Identify comorbidities: hypertension, dyslipidemia, CKD, neuropathy, retinopathy, cardiovascular disease. Note DM type (Type 1 / Type 2 / unspecified).",
            planItems: [
                "Medication adjustments (insulin regimens, GLP-1 agonists, SGLT-2 inhibitors, metformin, etc.) with doses if stated",
                "Target HbA1c and monitoring frequency",
                "Referrals: endocrinology, ophthalmology, podiatry, dietitian, diabetes education",
                "Lifestyle counseling discussed",
                "Labs to order or recheck",
                "Follow-up interval",
            ]
        )
    )

    static let hypothyroidism = disease(
        id: "disease_hypothyroid",
        name: "Hypothyroidism",
        icon: "thermometer.medium",
        description: "TSH titration & symptom management",
        promptInstructions: soapPrompt(
            topic: "hypothyroidism management",
            subjective: "Chief complaint, hypothyroid symptoms (fatigue, weight gain, cold intolerance, constipation, dry skin, hair loss, cognitive slowing, depression, menstrual irregularities), medication adherence and timing of levothyroxine, interfering medications or supplements (calcium, iron, PPIs).",
            objective: "Vitals: HR, BP, weight. Clinical signs discussed: bradycardia, delayed reflexes, dry skin, periorbital edema. Labs: TSH (with reference range), free T4; prior TSH trend if mentioned.",
            assessment: "Thyroid status (hypothyroid / euthyroid / over-replaced). Identify etiology if discussed: Hashimoto's (anti-TPO), post-thyroidectomy, radioiodine ablation, central. Assess for cardiac risk of over-replacement in elderly (AF, osteoporosis).",
            planItems: [
                "Levothyroxine dose adjustment (in 12.5–25 mcg increments) per TSH target (0.5–2.5 mIU/L for most)",
                "Instructions: take on empty stomach, 30–60 min before food, separate from interfering supplements by 4 h",
                "TSH recheck timing (6–8 weeks after dose change)",
                "Screen for depression if symptomatic",
                "Bone density or cardiac monitoring if over-replacement risk",
                "Follow-up interval",
            ]
        )
    )

    static let obesity = disease(
        id: "disease_obesity",
        name: "Obesity",
        icon: "figure.stand",
        description: "Weight management, metabolic risk & treatment options",
        promptInstructions: soapPrompt(
            topic: "obesity management",
            subjective: "Chief complaint, weight history (peak weight, recent changes, prior weight-loss attempts and outcomes), dietary patterns, physical activity level, sleep quality (OSA symptoms), mood/emotional eating, medications contributing to weight gain, readiness to change.",
            objective: "Vitals: weight, height, BMI (class I ≥30 / II ≥35 / III ≥40), waist circumference. Obesity-related comorbidities noted: BP, fasting glucose/HbA1c, lipids, liver enzymes (NAFLD). STOP-BANG or Epworth score if mentioned.",
            assessment: "BMI class and associated comorbidities (hypertension, T2DM, dyslipidemia, OSA, NAFLD, osteoarthritis, GERD). Edmonton Obesity Staging if applicable. Identify contributing medications. Assess candidacy for pharmacotherapy or bariatric surgery.",
            planItems: [
                "Dietary counseling: caloric deficit target, meal structure, referral to dietitian",
                "Physical activity prescription: aerobic + resistance, goal 150 min/week",
                "Behavioural/psychological support: referral to obesity medicine, CBT, or structured program",
                "Pharmacotherapy discussion: GLP-1 agonist (semaglutide, tirzepatide), orlistat, naltrexone/bupropion — indications, doses, and side effects if stated",
                "Bariatric surgery referral criteria (BMI ≥40 or ≥35 with comorbidities) if applicable",
                "OSA screening and sleep study if indicated",
                "Labs to order: fasting lipids, glucose/HbA1c, LFTs, TSH",
                "Follow-up interval and weight-monitoring plan",
            ]
        )
    )

    // MARK: Renal & Pulmonary

    static let ckd = disease(
        id: "disease_ckd",
        name: "CKD",
        icon: "aqi.medium",
        description: "Staging, progression & renal protection",
        promptInstructions: soapPrompt(
            topic: "chronic kidney disease management",
            subjective: "Chief complaint, uremic symptoms (fatigue, nausea, anorexia, pruritus, edema, dyspnea, cognitive changes), urine output changes, medication adherence, diet adherence (protein, potassium, phosphorus, sodium restriction), fluid intake. For dialysis patients: treatment tolerance, access issues.",
            objective: "Vitals: BP (target <130/80), weight, volume status. Relevant labs as discussed: creatinine, eGFR (CKD-EPI), BUN, electrolytes (K⁺, Na⁺, bicarbonate), CBC (anemia), phosphorus, calcium, PTH, 25-OH vitamin D, urine ACR. Current CKD stage (1–5) if determinable.",
            assessment: "CKD stage by eGFR and albuminuria category (G1–G5, A1–A3). Identify etiology (diabetic nephropathy, hypertensive nephrosclerosis, glomerulonephritis, etc.). Assess progression risk. Note complications: anemia, hyperkalemia, metabolic acidosis, CKD-MBD (bone/mineral disorder), hypertension, cardiovascular risk.",
            planItems: [
                "BP management and RAAS blockade (ACEi/ARB) — nephroprotective dosing",
                "SGLT-2 inhibitor if applicable (eGFR threshold)",
                "Electrolyte management (K⁺ binders, bicarbonate supplementation)",
                "Anemia management (EPO stimulating agent, IV iron)",
                "CKD-MBD: phosphate binders, vitamin D, cinacalcet",
                "Dietary referral (renal diet: protein, potassium, phosphorus, sodium targets)",
                "Nephrology referral or current follow-up plan",
                "AV fistula planning / dialysis education if approaching ESKD",
                "Labs to recheck and follow-up interval",
            ]
        )
    )

    static let copd = disease(
        id: "disease_copd",
        name: "COPD",
        icon: "lungs.fill",
        description: "Airflow obstruction, exacerbations & inhaler review",
        promptInstructions: soapPrompt(
            topic: "COPD management",
            subjective: "Chief complaint, dyspnea (quantify: rest / exertion / at night), chronic cough and sputum production (character, color, volume), wheeze, exercise tolerance (MRC dyspnea scale if mentioned), recent exacerbations (frequency, severity, ED visits, hospitalizations), smoking history (pack-years, current status), inhaler technique and adherence.",
            objective: "Vitals including O₂ saturation (room air vs supplemental O₂). Respiratory exam findings as described: air entry, wheeze, rhonchi, accessory muscle use, barrel chest. Relevant data: spirometry (FEV1, FEV1/FVC ratio, GOLD stage), CXR or CT findings if mentioned.",
            assessment: "GOLD classification if determinable (GOLD 1–4, Group A–D). Exacerbation risk (low / high). Identify comorbidities: cor pulmonale, heart failure, anxiety/depression, OSA, lung cancer risk.",
            planItems: [
                "Inhaler regimen (SABA, LABA, LAMA, ICS combinations) with changes if discussed",
                "Exacerbation action plan review",
                "Pulmonary rehabilitation referral if discussed",
                "Vaccination status (influenza, pneumococcal, COVID-19)",
                "Smoking cessation support if applicable",
                "Supplemental O₂ threshold or current prescription",
                "Follow-up interval; criteria for urgent return",
            ]
        )
    )

    static let asthma = disease(
        id: "disease_asthma",
        name: "Asthma",
        icon: "wind",
        description: "Severity, control & step therapy",
        promptInstructions: soapPrompt(
            topic: "asthma management",
            subjective: "Chief complaint, symptom frequency (daytime/nighttime), rescue inhaler use (frequency per week), activity limitation, symptom triggers (allergens, exercise, cold air, NSAIDS, smoke, infections), recent exacerbations (ED visits, oral steroid courses, hospitalizations), current inhaler regimen and technique, adherence. Assess control level: well-controlled / not well-controlled / very poorly controlled.",
            objective: "Vitals, O₂ saturation. Respiratory exam: wheeze, prolonged expiration, accessory muscle use. Relevant data: peak flow (% predicted or personal best), spirometry (FEV1, FEV1/FVC, reversibility with bronchodilator) if mentioned, FeNO if measured.",
            assessment: "Asthma control level per NAEPP guidelines. Identify triggers and comorbidities that worsen control: allergic rhinitis, GERD, obesity, OSA, anxiety, vocal cord dysfunction. Assess step of therapy (Steps 1–6).",
            planItems: [
                "Step therapy adjustment: ICS dose, addition of LABA, LAMA, LTRA, biologic eligibility (eosinophilic asthma — dupilumab, benralizumab, mepolizumab)",
                "Rescue inhaler (SABA or ICS-formoterol PRN per GINA)",
                "Asthma action plan review (green/yellow/red zones)",
                "Trigger avoidance counseling",
                "Allergen testing / immunotherapy referral if appropriate",
                "Smoking cessation support if applicable",
                "Pulmonology or allergist referral if applicable",
                "Follow-up interval",
            ]
        )
    )

    // MARK: Oncology

    static let lungCancer = disease(
        id: "disease_lc",
        name: "Lung Cancer",
        icon: "cross.case.fill",
        description: "Screening, staging, treatment & surveillance",
        promptInstructions: soapPrompt(
            topic: "lung cancer care",
            subjective: "Chief complaint, pulmonary symptoms (cough character/hemoptysis, dyspnea, wheezing, chest pain), constitutional symptoms (weight loss, fatigue, anorexia, night sweats, fever), neurological symptoms if mentioned (headache, focal deficits — metastatic concern), smoking history (pack-years, current status, cessation attempts), occupational/environmental exposures. For established patients: treatment tolerance, side effects, functional status.",
            objective: "Vitals, O₂ saturation, weight/weight change. Respiratory exam findings as stated. Relevant imaging: CXR, CT chest (nodule size, location, characteristics), PET/CT, brain MRI findings if mentioned. Pathology: cell type (NSCLC — adenocarcinoma, squamous, large cell; SCLC), molecular markers (EGFR, ALK, ROS1, KRAS, PD-L1 TPS) if discussed.",
            assessment: "Cancer stage (TNM: I–IV) if determinable. ECOG performance status if discussed. Treatment phase: screening / diagnostic workup / curative intent / palliative / surveillance. Note LC screening eligibility per USPSTF criteria (50–80 yo, 20+ pack-year, current or quit <15 years) if relevant.",
            planItems: [
                "Pending diagnostic workup (biopsy, bronchoscopy, mediastinoscopy, molecular profiling)",
                "Multidisciplinary tumor board discussion if applicable",
                "Treatment plan (surgery, radiation, chemotherapy, targeted therapy, immunotherapy) with regimen and cycle if stated",
                "Symptom management: pain, dyspnea, cough, nausea",
                "Smoking cessation support",
                "LDCT surveillance schedule if applicable",
                "Palliative care / hospice referral if discussed",
                "Follow-up: imaging, labs, oncology visit",
            ]
        )
    )

    // MARK: Neurology

    static let stroke = disease(
        id: "disease_stroke",
        name: "Stroke / TIA",
        icon: "brain.head.profile",
        description: "Secondary prevention & neurological follow-up",
        promptInstructions: soapPrompt(
            topic: "stroke and TIA secondary prevention",
            subjective: "Chief complaint, neurological symptoms (focal weakness, speech difficulty, facial droop, visual changes, ataxia, headache), symptom onset and duration, FAST criteria, prior stroke/TIA history, medication adherence (antiplatelet or anticoagulant), vascular risk factor control.",
            objective: "Vitals: BP (both arms if mentioned), HR. Neurological exam findings as described. Relevant imaging: CT/MRI brain (infarct location, size, acuity), CTA/MRA findings if mentioned. Cardiac workup: ECG, echo, telemetry results if discussed. Labs: lipid panel, glucose/HbA1c, CBC.",
            assessment: "Stroke type (ischemic / hemorrhagic) or TIA. ABCD² score for TIA if applicable. Identify mechanism: cardioembolic (AFib), large vessel atherosclerosis, small vessel/lacunar, cryptogenic. Risk factor burden: HTN, DM, dyslipidemia, AFib, smoking, alcohol.",
            planItems: [
                "Antiplatelet therapy: aspirin ± clopidogrel (DAPT for minor stroke/high-risk TIA per POINT/CHANCE), or anticoagulation if cardioembolic",
                "Statin: high-intensity (atorvastatin 40–80 mg) for LDL <70 mg/dL",
                "BP management: target <130/80 mmHg (after acute phase)",
                "Cardiac monitoring: prolonged telemetry or wearable monitor for AFib detection if cryptogenic",
                "Neurology follow-up; stroke program or neurovascular clinic referral",
                "Rehabilitation: PT, OT, speech therapy referral as appropriate",
                "Driving restrictions and return-to-activity counseling if applicable",
                "Follow-up interval and return precautions",
            ]
        )
    )

    // MARK: Mental Health

    static let depression = disease(
        id: "disease_depression",
        name: "Depression",
        icon: "person.crop.circle.badge.minus",
        description: "MDD / persistent depressive disorder — PHQ-9 & treatment",
        promptInstructions: soapPrompt(
            topic: "depression management",
            subjective: "Chief complaint, mood (persistent low mood, anhedonia), neurovegetative symptoms (sleep disturbance, appetite change, fatigue, concentration difficulty, psychomotor changes), hopelessness, guilt, suicidal ideation (passive vs. active, plan, intent, access to means), prior depressive episodes, current medications and adherence, substance use.",
            objective: "PHQ-9 score if administered (with prior score for comparison). Mental status: appearance, affect, thought content, cognition as described. Thyroid function (TSH), CBC, BMP, vitamin D, B12 if relevant labs discussed.",
            assessment: "Severity per PHQ-9 (minimal 0–4 / mild 5–9 / moderate 10–14 / moderately severe 15–19 / severe 20–27). Episode characteristics: first episode vs. recurrent; psychotic features; bipolar screen. Rule out organic cause (hypothyroidism, anemia). Assess suicide risk level (low / moderate / high).",
            planItems: [
                "Safety planning if suicidal ideation present; emergency resources provided",
                "Antidepressant initiation or adjustment: SSRI/SNRI with dose if stated; counsel on 4–6 week onset and side effects",
                "Psychotherapy referral: CBT, IPT, or collaborative care model",
                "Follow-up PHQ-9 monitoring (4–6 weeks after medication change)",
                "Lifestyle counseling: exercise, sleep hygiene, alcohol reduction",
                "Psychiatric referral if severe, psychotic features, bipolar concern, or treatment-resistant",
                "Follow-up interval",
            ]
        )
    )

    static let anxiety = disease(
        id: "disease_anxiety",
        name: "Anxiety",
        icon: "exclamationmark.triangle",
        description: "GAD / panic disorder — GAD-7 & treatment",
        promptInstructions: soapPrompt(
            topic: "anxiety disorder management",
            subjective: "Chief complaint, anxiety symptoms (excessive worry, restlessness, irritability, muscle tension, sleep difficulty, difficulty concentrating), panic attacks (frequency, triggers, duration, physical symptoms — palpitations, dyspnea, chest tightness, dizziness, paresthesias), avoidance behaviours, medication adherence, substance use, caffeine intake, life stressors.",
            objective: "GAD-7 score if administered (with prior for comparison). Vitals: HR, BP. Relevant physical exam findings that overlap with anxiety (palpitations → ECG, thyroid symptoms → TSH, dyspnea → pulmonary exam). Labs: TSH, CBC, BMP if applicable to rule out organic cause.",
            assessment: "Anxiety disorder type (GAD / panic disorder / social anxiety / PTSD / mixed). GAD-7 severity (minimal 0–4 / mild 5–9 / moderate 10–14 / severe 15–21). Assess occupational/functional impairment. Identify contributing factors: thyroid disease, stimulant use, medication side effects. Comorbid depression screening (PHQ-9).",
            planItems: [
                "First-line pharmacotherapy: SSRI or SNRI with dose if stated; counsel on initial anxiogenic effect and 4–6 week onset",
                "Short-term anxiolytic: low-dose benzodiazepine or buspirone if appropriate; counsel on dependence risk",
                "Psychotherapy referral: CBT (including exposure therapy for panic), mindfulness-based therapy",
                "Lifestyle modification: caffeine reduction, regular exercise, sleep hygiene, breathing techniques",
                "GAD-7 reassessment at follow-up",
                "Psychiatry referral if severe, not responding, or complex comorbidities",
                "Follow-up interval",
            ]
        )
    )

    // MARK: Gastroenterology

    static let gerd = disease(
        id: "disease_gerd",
        name: "GERD",
        icon: "flame",
        description: "Acid reflux — lifestyle, PPI therapy & alarm symptoms",
        promptInstructions: soapPrompt(
            topic: "GERD management",
            subjective: "Chief complaint, reflux symptoms (heartburn frequency and severity, regurgitation, chest pain, waterbrash), atypical symptoms (chronic cough, hoarseness, throat clearing, globus), nocturnal symptoms, meal timing, dietary triggers (fatty/spicy food, caffeine, alcohol, chocolate, mint), positional worsening, medication use (PPIs, antacids) and response.",
            objective: "Vitals, BMI. Oropharyngeal or dental exam findings if mentioned (enamel erosion, posterior pharyngitis). Relevant history: prior endoscopy results (esophagitis grade, Barrett's, H. pylori status), esophageal manometry if discussed.",
            assessment: "GERD severity: non-erosive / erosive (LA grade A–D) / complicated (Barrett's, stricture). Alarm features requiring urgent endoscopy: dysphagia, odynophagia, unintentional weight loss, GI bleeding, anemia, persistent vomiting. Identify contributing medications (NSAIDs, CCBs, bisphosphonates).",
            planItems: [
                "PPI therapy: initiate, continue, or step down — dose and timing (30 min before meal) if stated",
                "Alarm symptoms: refer for urgent endoscopy if any present",
                "Barrett's surveillance schedule if applicable",
                "Lifestyle modifications: head-of-bed elevation, avoid eating within 3 h of bedtime, weight loss, dietary trigger avoidance",
                "H. pylori testing and treatment if not previously done",
                "Discontinue or substitute contributing medications if possible",
                "GI referral for refractory symptoms or complications",
                "Follow-up interval",
            ]
        )
    )

    // MARK: - Disease collection
    // ↓ Add new disease property names here when created above.

    static let diseaseTemplates: [TranscriptionTemplate] = [
        // Cardiovascular
        .hypertension, .heartFailure, .atrialFibrillation, .coronaryArteryDisease,
        // Endocrine & Metabolic
        .diabetes, .hypothyroidism, .obesity,
        // Renal & Pulmonary
        .ckd, .copd, .asthma,
        // Oncology
        .lungCancer,
        // Neurology
        .stroke,
        // Mental Health
        .depression, .anxiety,
        // Gastroenterology
        .gerd,
    ]
}
