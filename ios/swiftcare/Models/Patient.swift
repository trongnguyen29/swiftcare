import Foundation

struct Allergy: Codable, Hashable {
    let substance: String
    let type: String
    let reaction: String
    let severity: String
    let onset_date: String?
    let status: String
}

struct Medication: Codable, Hashable {
    let name: String
    let rxnorm_code: String?
    let dose: String
    let route: String
    let frequency: String
    let indication: String?
    let start_date: String
    let status: String
}

struct Problem: Codable, Hashable {
    let display: String
    let icd10_code: String
    let snomed_code: String?
    let onset_date: String?
    let status: String
    let category: String
}

struct Immunization: Codable, Hashable {
    let vaccine: String
    let cvx_code: String
    let date: String
    let status: String
    let lot_number: String?
}

struct CareTeamMember: Codable, Hashable {
    let name: String
    let role: String
    let npi: String?
    let phone: String?
    let organization: String?
}

struct Insurance: Codable, Hashable {
    let coverage_status: String
    let coverage_type: String
    let payer: String
    let payer_id: String?
    let member_id: String
    let subscriber_id: String?
    let group_id: String?
    let relationship_to_subscriber: String
}

struct Encounter: Codable, Hashable {
    let encounter_type: String
    let date: String
    let reason: String
    let facility: String?
    let performing_provider: String?
    let disposition: String?
}

struct ClinicalNote: Codable, Hashable {
    let note_type: String
    let date: String
    let author: String
    let text: String
}

struct Procedure: Codable, Hashable {
    let display: String
    let cpt_code: String?
    let snomed_code: String?
    let date: String
    let status: String
    let performer: String?
}

struct ImagingResult: Codable, Hashable {
    let study: String
    let date: String
    let finding: String
}

struct Patient: Codable, Identifiable, Hashable {
    var id: String { ptnum }
    
    let ptnum: String
    let label: Int
    let scc: Double?
    
    let first_name: String?
    let last_name: String?
    let middle_name: String?
    let date_of_birth: String?
    let age: Double?
    let administrative_sex: String?
    let birth_sex: String?
    let gender_identity: String?
    let preferred_language: String?
    let race: String?
    let ethnicity: String?
    let tribal_affiliation: String?
    let marital: String?
    let address_line: String?
    let city: String?
    let state: String?
    let zip_code: String?
    let phone: String?
    let email: String?
    
    let systolic_bp: Double?
    let diastolic_bp: Double?
    let heart_rate: Double?
    let respiratory_rate: Double?
    let temperature_c: Double?
    let oxygen_saturation: Double?
    let height_cm: Double?
    let weight_kg: Double?
    let bmi: Double?
    let pain_score: Double?
    
    let total_cholesterol: Double?
    let ldl: Double?
    let hdl: Double?
    let triglycerides: Double?
    let hba1c: Double?
    let glucose: Double?
    let creatinine: Double?
    let egfr: Double?
    let hemoglobin: Double?
    let wbc: Double?
    let platelets: Double?
    
    let problems: [Problem]?
    let medications: [Medication]?
    let allergies: [Allergy]?
    let immunizations: [Immunization]?
    let procedures: [Procedure]?
    let care_team: [CareTeamMember]?
    let insurance: Insurance?
    let encounters: [Encounter]?
    let clinical_notes: [ClinicalNote]?
    
    let functional_status: String?
    let mental_cognitive_status: String?
    let disability_status: String?
    let pregnancy_status: String?
    
    let sdoh_education_level: String?
    let sdoh_financial_strain: String?
    let sdoh_housing_status: String?
    let sdoh_transportation_insecurity: Bool?
    let sdoh_veteran_status: Bool?
    let sdoh_social_isolation: String?
    
    let tobacco_status: String?
    let assessment_plan: String?
    let goals: [String]?
    let imaging_results: [ImagingResult]?
    
    let provenance_author: String?
    let provenance_organization: String?
    let provenance_timestamp: String?
    let gender: String?
    
    // Computed property for display name
    var displayName: String {
        let name = [first_name, last_name].compactMap { $0 }.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        // Remove digits
        let cleanName = name.components(separatedBy: CharacterSet.decimalDigits).joined()
        return cleanName.isEmpty ? ptnum : cleanName
    }
}
