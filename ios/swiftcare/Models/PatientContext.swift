import Foundation

struct PatientContext {
    
    static func fingerprint(for string: String) -> String {
        var h: UInt32 = 0x811c9dc5
        for char in string.utf16 {
            h ^= UInt32(char)
            h = h &* 0x01000193
        }
        return String(format: "%x", h)
    }
    
    static func build(for p: Patient) -> String {
        let name = p.displayName
        
        let meds = (p.medications ?? [])
            .filter { $0.status == "active" }
            .map { "\($0.name) \($0.dose) (\($0.frequency))" }
            .joined(separator: ", ")
        let medsString = meds.isEmpty ? "None" : meds
        
        let probs = (p.problems ?? [])
            .filter { $0.status == "active" }
            .map { "\($0.display) (\($0.icd10_code))" }
            .joined(separator: ", ")
        let probsString = probs.isEmpty ? "None" : probs
        
        let allgs = (p.allergies ?? [])
            .map { "\($0.substance) [\($0.severity)]" }
            .joined(separator: ", ")
        let allgsString = allgs.isEmpty ? "NKDA" : allgs
        
        let ageStr = p.age != nil ? "\(Int(p.age!))" : "—"
        let sysStr = p.systolic_bp != nil ? "\(p.systolic_bp!)" : "—"
        let diaStr = p.diastolic_bp != nil ? "\(p.diastolic_bp!)" : "—"
        let hrStr = p.heart_rate != nil ? "\(p.heart_rate!)" : "—"
        let spo2Str = p.oxygen_saturation != nil ? "\(p.oxygen_saturation!)" : "—"
        let bmiStr = p.bmi != nil ? "\(p.bmi!)" : "—"
        let painStr = p.pain_score != nil ? "\(p.pain_score!)" : "—"
        
        let tcStr = p.total_cholesterol != nil ? "\(p.total_cholesterol!)" : "—"
        let ldlStr = p.ldl != nil ? "\(p.ldl!)" : "—"
        let hdlStr = p.hdl != nil ? "\(p.hdl!)" : "—"
        let tgStr = p.triglycerides != nil ? "\(p.triglycerides!)" : "—"
        let hba1cStr = p.hba1c != nil ? "\(p.hba1c!)" : "—"
        let gluStr = p.glucose != nil ? "\(p.glucose!)" : "—"
        let egfrStr = p.egfr != nil ? "\(p.egfr!)" : "—"
        let crStr = p.creatinine != nil ? "\(p.creatinine!)" : "—"
        let hbStr = p.hemoglobin != nil ? "\(p.hemoglobin!)" : "—"
        let wbcStr = p.wbc != nil ? "\(p.wbc!)" : "—"
        let platStr = p.platelets != nil ? "\(p.platelets!)" : "—"
        
        let transInsec = p.sdoh_transportation_insecurity == true ? "Yes" : "No"
        
        var context = """
        PATIENT RECORD — CONFIDENTIAL
        Patient: \(name) | ID: \(p.ptnum)
        Age: \(ageStr) | Sex: \(p.administrative_sex ?? "—") | Race: \(p.race ?? "—")
        LC Status: \(p.label == 1 ? "Lung Cancer Positive (LC+)" : "Control") | SCC Score: \(p.scc != nil ? "\(p.scc!)" : "—")
        Tobacco: \(p.tobacco_status ?? "—")
        
        VITALS
        BP: \(sysStr)/\(diaStr) mmHg | HR: \(hrStr) bpm | SpO₂: \(spo2Str)% | BMI: \(bmiStr) | Pain: \(painStr)/10
        
        LABS
        Total Cholesterol: \(tcStr) | LDL: \(ldlStr) | HDL: \(hdlStr) | TG: \(tgStr)
        HbA1c: \(hba1cStr)% | Glucose: \(gluStr) | eGFR: \(egfrStr) | Creatinine: \(crStr)
        Hemoglobin: \(hbStr) | WBC: \(wbcStr) | Platelets: \(platStr)
        
        ACTIVE PROBLEMS: \(probsString)
        ACTIVE MEDICATIONS: \(medsString)
        ALLERGIES: \(allgsString)
        
        SDOH: Education: \(p.sdoh_education_level ?? "—") | Housing: \(p.sdoh_housing_status ?? "—") | Financial: \(p.sdoh_financial_strain ?? "—") | Transport insecurity: \(transInsec)
        """
        
        if let plan = p.assessment_plan, !plan.isEmpty {
            context += "\n\nASSESSMENT & PLAN:\n\(plan)"
        }
        
        return context
    }
}
