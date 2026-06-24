import Foundation

// MARK: - Supabase row wrappers

struct FHIRPatientRow: Decodable {
    let fhir_id: String
    let resource: FHIRPatientResource
}

struct FHIRAppointmentRow: Decodable {
    let fhir_id: String
    let patient_id: String
    let resource: FHIRAppointmentResource
}

struct LatestObservation: Decodable {
    let patient_id: String
    let code: String
    let value: String?
    let recorded_at: String?
}

// MARK: - FHIR Patient resource (US Core)

struct FHIRPatientResource: Decodable {
    let id: String
    let name: [FHIRHumanName]?
    let telecom: [FHIRContactPoint]?
    let gender: String?
    let birthDate: String?
    let address: [FHIRAddress]?
    let communication: [FHIRCommunication]?
    let fhirExtensions: [FHIRExtension]?

    enum CodingKeys: String, CodingKey {
        case id, name, telecom, gender, birthDate, address, communication
        case fhirExtensions = "extension"
    }
}

struct FHIRHumanName: Decodable {
    let use: String?
    let family: String?
    let given: [String]?
}

struct FHIRContactPoint: Decodable {
    let system: String?
    let value: String?
}

struct FHIRAddress: Decodable {
    let line: [String]?
    let city: String?
    let state: String?
    let postalCode: String?
}

struct FHIRCommunication: Decodable {
    let language: FHIRCodeableConcept?
    let preferred: Bool?
}

struct FHIRCodeableConcept: Decodable {
    let coding: [FHIRCoding]?
    let text: String?
}

struct FHIRCoding: Decodable {
    let system: String?
    let code: String?
    let display: String?
}

struct FHIRExtension: Decodable {
    let url: String?
    let valueCode: String?
    let valueString: String?
    let valueCodeableConcept: FHIRCodeableConcept?
    let fhirExtensions: [FHIRExtension]?

    enum CodingKeys: String, CodingKey {
        case url, valueCode, valueString, valueCodeableConcept
        case fhirExtensions = "extension"
    }
}

// MARK: - FHIR Appointment resource

struct FHIRAppointmentResource: Decodable {
    let id: String
    let status: String?
    let serviceType: [FHIRServiceType]?
    let start: String?
    let end: String?
    let minutesDuration: Int?
    let participant: [FHIRParticipant]?
    let reasonCode: [FHIRCodeableConcept]?
}

struct FHIRServiceType: Decodable {
    let coding: [FHIRCoding]?
    let text: String?
}

struct FHIRParticipant: Decodable {
    let actor: FHIRActor?
    let status: String?
}

struct FHIRActor: Decodable {
    let reference: String?
    let display: String?
}

// MARK: - Patient init from FHIR

extension Patient {
    init(fromFHIR row: FHIRPatientRow, vitals: [LatestObservation] = [], labs: [LatestObservation] = []) {
        let r = row.resource
        let officialName = r.name?.first(where: { $0.use == "official" }) ?? r.name?.first
        let addr = r.address?.first

        var raceVal: String?
        var ethVal: String?
        var birthSexVal: String?
        var genderIdentityVal: String?

        for ext in r.fhirExtensions ?? [] {
            switch ext.url {
            case "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race":
                raceVal = ext.fhirExtensions?.first(where: { $0.url == "text" })?.valueString
            case "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity":
                ethVal = ext.fhirExtensions?.first(where: { $0.url == "text" })?.valueString
            case "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex":
                birthSexVal = ext.valueCode
            case "http://hl7.org/fhir/us/core/StructureDefinition/us-core-genderIdentity":
                genderIdentityVal = ext.valueCodeableConcept?.text
            default: break
            }
        }

        let vitalMap = Dictionary(uniqueKeysWithValues: vitals.compactMap { o -> (String, Double)? in
            guard let v = o.value, let d = Double(v) else { return nil }
            return (o.code, d)
        })
        let labMap = Dictionary(uniqueKeysWithValues: labs.compactMap { o -> (String, Double)? in
            guard let v = o.value, let d = Double(v) else { return nil }
            return (o.code, d)
        })

        ptnum                          = r.id
        label                          = 0
        scc                            = nil
        first_name                     = officialName?.given?.first
        last_name                      = officialName?.family
        middle_name                    = officialName?.given?.dropFirst().first
        date_of_birth                  = r.birthDate
        age                            = Self.computeAge(from: r.birthDate)
        administrative_sex             = r.gender
        birth_sex                      = birthSexVal
        gender_identity                = genderIdentityVal
        gender                         = r.gender
        preferred_language             = r.communication?.first(where: { $0.preferred == true })?.language?.coding?.first?.code
        race                           = raceVal
        ethnicity                      = ethVal
        tribal_affiliation             = nil
        marital                        = nil
        address_line                   = addr?.line?.first
        city                           = addr?.city
        state                          = addr?.state
        zip_code                       = addr?.postalCode
        phone                          = r.telecom?.first(where: { $0.system == "phone" })?.value
        email                          = r.telecom?.first(where: { $0.system == "email" })?.value
        systolic_bp                    = vitalMap["8480-6"]
        diastolic_bp                   = vitalMap["8462-4"]
        heart_rate                     = vitalMap["8867-4"]
        respiratory_rate               = vitalMap["9279-1"]
        temperature_c                  = vitalMap["8310-5"]
        oxygen_saturation              = vitalMap["2708-6"]
        height_cm                      = vitalMap["8302-2"]
        weight_kg                      = vitalMap["29463-7"]
        bmi                            = vitalMap["39156-5"]
        pain_score                     = vitalMap["72514-3"]
        total_cholesterol              = labMap["2093-3"]
        ldl                            = labMap["18262-6"]
        hdl                            = labMap["2085-9"]
        triglycerides                  = labMap["2571-8"]
        hba1c                          = labMap["4548-4"]
        glucose                        = labMap["2345-7"]
        creatinine                     = labMap["2160-0"]
        egfr                           = labMap["62238-1"]
        hemoglobin                     = labMap["718-7"]
        wbc                            = labMap["6690-2"]
        platelets                      = labMap["777-3"]
        problems                       = nil
        medications                    = nil
        allergies                      = nil
        immunizations                  = nil
        procedures                     = nil
        care_team                      = nil
        insurance                      = nil
        encounters                     = nil
        clinical_notes                 = nil
        functional_status              = nil
        mental_cognitive_status        = nil
        disability_status              = nil
        pregnancy_status               = nil
        sdoh_education_level           = nil
        sdoh_financial_strain          = nil
        sdoh_housing_status            = nil
        sdoh_transportation_insecurity = nil
        sdoh_veteran_status            = nil
        sdoh_social_isolation          = nil
        tobacco_status                 = nil
        assessment_plan                = nil
        goals                          = nil
        imaging_results                = nil
        provenance_author              = nil
        provenance_organization        = nil
        provenance_timestamp           = nil
    }

    private static func computeAge(from birthDate: String?) -> Double? {
        guard let bd = birthDate else { return nil }
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        guard let date = fmt.date(from: bd) else { return nil }
        return Double(Calendar.current.dateComponents([.year], from: date, to: Date()).year ?? 0)
    }
}

// MARK: - Appointment init from FHIR

extension Appointment {
    static func fromFHIR(_ row: FHIRAppointmentRow) -> Appointment? {
        let r = row.resource
        guard let startStr = r.start else { return nil }

        let decoder = ISO8601DateFormatter()
        decoder.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = decoder.date(from: startStr)
        if date == nil {
            let basic = ISO8601DateFormatter()
            basic.formatOptions = [.withInternetDateTime]
            date = basic.date(from: startStr)
        }
        guard let date else { return nil }

        let patientParticipant = r.participant?.first(where: { $0.actor?.reference?.hasPrefix("Patient/") == true })
        let practParticipant   = r.participant?.first(where: { $0.actor?.reference?.hasPrefix("Practitioner/") == true })

        let serviceDisplay = r.serviceType?.first?.coding?.first?.display ?? r.serviceType?.first?.text ?? ""
        let apptType: AppointmentType
        switch serviceDisplay.lowercased() {
        case let s where s.contains("new"):      apptType = .newPatient
        case let s where s.contains("follow"):   apptType = .followUp
        case let s where s.contains("physical"): apptType = .physicalExam
        default:                                  apptType = .followUp
        }

        let apptStatus: AppointmentStatus
        switch r.status?.lowercased() {
        case "fulfilled":                         apptStatus = .completed
        case "cancelled":                         apptStatus = .canceled
        case "arrived", "checked-in":             apptStatus = .confirmed
        default:                                  apptStatus = .scheduled
        }

        let duration: Int
        if let mins = r.minutesDuration {
            duration = mins
        } else if let endStr = r.end,
                  let endDate = decoder.date(from: endStr) ?? ISO8601DateFormatter().date(from: endStr) {
            duration = Int(endDate.timeIntervalSince(date) / 60)
        } else {
            duration = 30
        }

        return Appointment(
            id:              r.id,
            patientId:       row.patient_id,
            patientName:     patientParticipant?.actor?.display ?? "",
            date:            date,
            durationMinutes: duration,
            type:            apptType,
            status:          apptStatus,
            reason:          r.reasonCode?.first?.text ?? "",
            doctorName:      practParticipant?.actor?.display ?? "",
            phoneNumber:     "",
            isReminderSent:  false
        )
    }
}
