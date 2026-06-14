import Foundation

// MARK: - Sub-types (tolerate missing optional keys too)

struct Allergy: Identifiable, Hashable {
    let id = UUID()
    let substance: String
    let type: String
    let reaction: String
    let severity: String
    let onset_date: String?
    let status: String
}

extension Allergy: Codable {
    enum CodingKeys: String, CodingKey {
        case substance, type, reaction, severity, onset_date, status
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        substance   = try c.decodeIfPresent(String.self, forKey: .substance)   ?? ""
        type        = try c.decodeIfPresent(String.self, forKey: .type)        ?? ""
        reaction    = try c.decodeIfPresent(String.self, forKey: .reaction)    ?? ""
        severity    = try c.decodeIfPresent(String.self, forKey: .severity)    ?? ""
        onset_date  = try c.decodeIfPresent(String.self, forKey: .onset_date)
        status      = try c.decodeIfPresent(String.self, forKey: .status)      ?? ""
    }
}

struct Medication: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let rxnorm_code: String?
    let dose: String
    let route: String
    let frequency: String
    let indication: String?
    let start_date: String
    let status: String
}

extension Medication: Codable {
    enum CodingKeys: String, CodingKey {
        case name, rxnorm_code, dose, route, frequency, indication, start_date, status
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name        = try c.decodeIfPresent(String.self, forKey: .name)        ?? ""
        rxnorm_code = try c.decodeIfPresent(String.self, forKey: .rxnorm_code)
        dose        = try c.decodeIfPresent(String.self, forKey: .dose)        ?? ""
        route       = try c.decodeIfPresent(String.self, forKey: .route)       ?? ""
        frequency   = try c.decodeIfPresent(String.self, forKey: .frequency)   ?? ""
        indication  = try c.decodeIfPresent(String.self, forKey: .indication)
        start_date  = try c.decodeIfPresent(String.self, forKey: .start_date)  ?? ""
        status      = try c.decodeIfPresent(String.self, forKey: .status)      ?? ""
    }
}

struct Problem: Identifiable, Hashable {
    let id = UUID()
    let display: String
    let icd10_code: String
    let snomed_code: String?
    let onset_date: String?
    let status: String
    let category: String
}

extension Problem: Codable {
    enum CodingKeys: String, CodingKey {
        case display, icd10_code, snomed_code, onset_date, status, category
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        display     = try c.decodeIfPresent(String.self, forKey: .display)     ?? ""
        icd10_code  = try c.decodeIfPresent(String.self, forKey: .icd10_code)  ?? ""
        snomed_code = try c.decodeIfPresent(String.self, forKey: .snomed_code)
        onset_date  = try c.decodeIfPresent(String.self, forKey: .onset_date)
        status      = try c.decodeIfPresent(String.self, forKey: .status)      ?? ""
        category    = try c.decodeIfPresent(String.self, forKey: .category)    ?? ""
    }
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

// MARK: - Patient

struct Patient: Identifiable, Hashable {
    var id: String { ptnum }

    let ptnum: String
    let label: Int           // defaults to 0 if missing/null
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

    // Computed display name
    var displayName: String {
        let name = [first_name, last_name]
            .compactMap { $0 }
            .joined(separator: " ")
            .components(separatedBy: CharacterSet.decimalDigits)
            .joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? ptnum : name
    }
}

// MARK: - Codable (custom so absent keys decode as nil, not keyNotFound)

extension Patient: Codable {
    enum CodingKeys: String, CodingKey {
        case ptnum, label, scc
        case first_name, last_name, middle_name, date_of_birth, age
        case administrative_sex, birth_sex, gender_identity, preferred_language
        case race, ethnicity, tribal_affiliation, marital
        case address_line, city, state, zip_code, phone, email
        case systolic_bp, diastolic_bp, heart_rate, respiratory_rate
        case temperature_c, oxygen_saturation, height_cm, weight_kg, bmi, pain_score
        case total_cholesterol, ldl, hdl, triglycerides, hba1c, glucose
        case creatinine, egfr, hemoglobin, wbc, platelets
        case problems, medications, allergies, immunizations, procedures
        case care_team, insurance, encounters, clinical_notes
        case functional_status, mental_cognitive_status, disability_status, pregnancy_status
        case sdoh_education_level, sdoh_financial_strain, sdoh_housing_status
        case sdoh_transportation_insecurity, sdoh_veteran_status, sdoh_social_isolation
        case tobacco_status, assessment_plan, goals, imaging_results
        case provenance_author, provenance_organization, provenance_timestamp, gender
    }

    // Use decodeIfPresent for every optional so absent keys (not returned by
    // Supabase's column-filtered queries) gracefully become nil instead of
    // throwing DecodingError.keyNotFound.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        ptnum  = try c.decode(String.self, forKey: .ptnum)
        label  = (try? c.decodeIfPresent(Int.self,    forKey: .label)) ?? 0
        scc    = try c.decodeIfPresent(Double.self,  forKey: .scc)

        first_name          = try c.decodeIfPresent(String.self, forKey: .first_name)
        last_name           = try c.decodeIfPresent(String.self, forKey: .last_name)
        middle_name         = try c.decodeIfPresent(String.self, forKey: .middle_name)
        date_of_birth       = try c.decodeIfPresent(String.self, forKey: .date_of_birth)
        age                 = try c.decodeIfPresent(Double.self, forKey: .age)
        administrative_sex  = try c.decodeIfPresent(String.self, forKey: .administrative_sex)
        birth_sex           = try c.decodeIfPresent(String.self, forKey: .birth_sex)
        gender_identity     = try c.decodeIfPresent(String.self, forKey: .gender_identity)
        preferred_language  = try c.decodeIfPresent(String.self, forKey: .preferred_language)
        race                = try c.decodeIfPresent(String.self, forKey: .race)
        ethnicity           = try c.decodeIfPresent(String.self, forKey: .ethnicity)
        tribal_affiliation  = try c.decodeIfPresent(String.self, forKey: .tribal_affiliation)
        marital             = try c.decodeIfPresent(String.self, forKey: .marital)
        address_line        = try c.decodeIfPresent(String.self, forKey: .address_line)
        city                = try c.decodeIfPresent(String.self, forKey: .city)
        state               = try c.decodeIfPresent(String.self, forKey: .state)
        zip_code            = try c.decodeIfPresent(String.self, forKey: .zip_code)
        phone               = try c.decodeIfPresent(String.self, forKey: .phone)
        email               = try c.decodeIfPresent(String.self, forKey: .email)

        systolic_bp         = try c.decodeIfPresent(Double.self, forKey: .systolic_bp)
        diastolic_bp        = try c.decodeIfPresent(Double.self, forKey: .diastolic_bp)
        heart_rate          = try c.decodeIfPresent(Double.self, forKey: .heart_rate)
        respiratory_rate    = try c.decodeIfPresent(Double.self, forKey: .respiratory_rate)
        temperature_c       = try c.decodeIfPresent(Double.self, forKey: .temperature_c)
        oxygen_saturation   = try c.decodeIfPresent(Double.self, forKey: .oxygen_saturation)
        height_cm           = try c.decodeIfPresent(Double.self, forKey: .height_cm)
        weight_kg           = try c.decodeIfPresent(Double.self, forKey: .weight_kg)
        bmi                 = try c.decodeIfPresent(Double.self, forKey: .bmi)
        pain_score          = try c.decodeIfPresent(Double.self, forKey: .pain_score)

        total_cholesterol   = try c.decodeIfPresent(Double.self, forKey: .total_cholesterol)
        ldl                 = try c.decodeIfPresent(Double.self, forKey: .ldl)
        hdl                 = try c.decodeIfPresent(Double.self, forKey: .hdl)
        triglycerides       = try c.decodeIfPresent(Double.self, forKey: .triglycerides)
        hba1c               = try c.decodeIfPresent(Double.self, forKey: .hba1c)
        glucose             = try c.decodeIfPresent(Double.self, forKey: .glucose)
        creatinine          = try c.decodeIfPresent(Double.self, forKey: .creatinine)
        egfr                = try c.decodeIfPresent(Double.self, forKey: .egfr)
        hemoglobin          = try c.decodeIfPresent(Double.self, forKey: .hemoglobin)
        wbc                 = try c.decodeIfPresent(Double.self, forKey: .wbc)
        platelets           = try c.decodeIfPresent(Double.self, forKey: .platelets)

        problems            = try c.decodeIfPresent([Problem].self,         forKey: .problems)
        medications         = try c.decodeIfPresent([Medication].self,      forKey: .medications)
        allergies           = try c.decodeIfPresent([Allergy].self,         forKey: .allergies)
        immunizations       = try c.decodeIfPresent([Immunization].self,    forKey: .immunizations)
        procedures          = try c.decodeIfPresent([Procedure].self,       forKey: .procedures)
        care_team           = try c.decodeIfPresent([CareTeamMember].self,  forKey: .care_team)
        insurance           = try c.decodeIfPresent(Insurance.self,         forKey: .insurance)
        encounters          = try c.decodeIfPresent([Encounter].self,       forKey: .encounters)
        clinical_notes      = try c.decodeIfPresent([ClinicalNote].self,    forKey: .clinical_notes)

        functional_status       = try c.decodeIfPresent(String.self, forKey: .functional_status)
        mental_cognitive_status = try c.decodeIfPresent(String.self, forKey: .mental_cognitive_status)
        disability_status       = try c.decodeIfPresent(String.self, forKey: .disability_status)
        pregnancy_status        = try c.decodeIfPresent(String.self, forKey: .pregnancy_status)

        sdoh_education_level           = try c.decodeIfPresent(String.self, forKey: .sdoh_education_level)
        sdoh_financial_strain          = try c.decodeIfPresent(String.self, forKey: .sdoh_financial_strain)
        sdoh_housing_status            = try c.decodeIfPresent(String.self, forKey: .sdoh_housing_status)
        sdoh_transportation_insecurity = try c.decodeIfPresent(Bool.self,   forKey: .sdoh_transportation_insecurity)
        sdoh_veteran_status            = try c.decodeIfPresent(Bool.self,   forKey: .sdoh_veteran_status)
        sdoh_social_isolation          = try c.decodeIfPresent(String.self, forKey: .sdoh_social_isolation)

        tobacco_status      = try c.decodeIfPresent(String.self,         forKey: .tobacco_status)
        assessment_plan     = try c.decodeIfPresent(String.self,         forKey: .assessment_plan)
        goals               = try c.decodeIfPresent([String].self,       forKey: .goals)
        imaging_results     = try c.decodeIfPresent([ImagingResult].self, forKey: .imaging_results)

        provenance_author       = try c.decodeIfPresent(String.self, forKey: .provenance_author)
        provenance_organization = try c.decodeIfPresent(String.self, forKey: .provenance_organization)
        provenance_timestamp    = try c.decodeIfPresent(String.self, forKey: .provenance_timestamp)
        gender                  = try c.decodeIfPresent(String.self, forKey: .gender)
    }
}


