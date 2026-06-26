import Foundation

private extension Array {
    func nilIfEmpty() -> [Element]? { isEmpty ? nil : self }
}

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

struct FHIRConditionRow: Decodable {
    let fhir_id: String
    let patient_id: String
    let resource: FHIRConditionResource
}

struct FHIRMedicationRequestRow: Decodable {
    let fhir_id: String
    let patient_id: String
    let resource: FHIRMedicationRequestResource
}

struct FHIRAllergyRow: Decodable {
    let fhir_id: String
    let patient_id: String
    let resource: FHIRAllergyResource
}

struct FHIRCareTeamRow: Decodable {
    let fhir_id: String
    let patient_id: String
    let resource: FHIRCareTeamResource
}

struct FHIRCoverageRow: Decodable {
    let fhir_id: String
    let patient_id: String
    let resource: FHIRCoverageResource
}

struct LatestObservation: Decodable {
    let patient_id: String
    let code: String
    let value: String?
    let recorded_at: String?
}

// MARK: - FHIR Condition resource

struct FHIRConditionResource: Decodable {
    let id: String
    let code: FHIRCodeableConcept?
    let onsetDateTime: String?
    let clinicalStatus: FHIRCodeableConcept?
    let category: [FHIRCodeableConcept]?
}

// MARK: - FHIR MedicationRequest resource

struct FHIRMedicationRequestResource: Decodable {
    let id: String
    let status: String?
    let medicationCodeableConcept: FHIRCodeableConcept?
    let authoredOn: String?
    let dosageInstruction: [FHIRDosageInstruction]?
}

struct FHIRDosageInstruction: Decodable {
    let text: String?
    let route: FHIRCodeableConcept?
    let doseAndRate: [FHIRDoseAndRate]?
}

struct FHIRDoseAndRate: Decodable {
    let doseQuantity: FHIRQuantity?
}

struct FHIRQuantity: Decodable {
    let value: Double?
    let unit: String?
}

// MARK: - FHIR AllergyIntolerance resource

struct FHIRAllergyResource: Decodable {
    let id: String
    let clinicalStatus: FHIRCodeableConcept?
    let type: String?
    let category: [String]?
    let criticality: String?
    let code: FHIRCodeableConcept?
    let onsetDateTime: String?
    let reaction: [FHIRAllergyReaction]?
}

struct FHIRAllergyReaction: Decodable {
    let manifestation: [FHIRCodeableConcept]?
    let severity: String?
}

// MARK: - FHIR CareTeam resource

struct FHIRCareTeamResource: Decodable {
    let id: String
    let participant: [FHIRCareTeamParticipant]?
}

struct FHIRCareTeamParticipant: Decodable {
    let role: [FHIRCodeableConcept]?
    let member: FHIRActor?
    let onBehalfOf: FHIRActor?
}

// MARK: - FHIR Coverage resource

struct FHIRCoverageResource: Decodable {
    let id: String
    let status: String?
    let type: FHIRCodeableConcept?
    let payor: [FHIRActor]?
    let subscriberId: String?
    let `class`: [FHIRCoverageClass]?
}

struct FHIRCoverageClass: Decodable {
    let value: String?
    let name: String?
}

// MARK: - Conversion helpers

extension FHIRConditionResource {
    func toProblem() -> Problem {
        let icd10 = code?.coding?.first(where: { $0.system?.contains("icd-10") == true })?.code
            ?? code?.coding?.first?.code ?? ""
        return Problem(
            display:     code?.text ?? code?.coding?.first?.display ?? "",
            icd10_code:  icd10,
            snomed_code: code?.coding?.first(where: { $0.system?.contains("snomed") == true })?.code,
            onset_date:  onsetDateTime ?? "",
            status:      clinicalStatus?.coding?.first?.code ?? "active",
            category:    category?.first?.coding?.first?.code == "encounter-diagnosis"
                            ? "encounter-diagnosis" : "problem-list-item"
        )
    }
}

extension FHIRMedicationRequestResource {
    func toMedication() -> Medication {
        let dosage = dosageInstruction?.first
        let dose = dosage?.doseAndRate?.first?.doseQuantity
        return Medication(
            name:        medicationCodeableConcept?.text ?? medicationCodeableConcept?.coding?.first?.display ?? "",
            rxnorm_code: medicationCodeableConcept?.coding?.first(where: { $0.system?.contains("rxnorm") == true })?.code,
            dose:        dose.map { "\(Int($0.value ?? 0))\($0.unit ?? "")" } ?? "",
            route:       dosage?.route?.coding?.first?.display ?? dosage?.route?.text ?? "Oral",
            frequency:   dosage?.text ?? "",
            indication:  nil,
            start_date:  authoredOn ?? "",
            status:      status == "active" ? "active" : "discontinued"
        )
    }
}

extension FHIRAllergyResource {
    func toAllergy() -> Allergy {
        let reaction = self.reaction?.first
        let sev = reaction?.severity ?? "mild"
        let allergyType: String
        switch (self.type ?? "").lowercased() {
        case "allergy":     allergyType = "medication"
        case "intolerance": allergyType = "medication"
        default:            allergyType = "non-medication"
        }
        return Allergy(
            substance: code?.text ?? code?.coding?.first?.display ?? "",
            type:      allergyType,
            reaction:  reaction?.manifestation?.first?.coding?.first?.display ?? reaction?.manifestation?.first?.text ?? "",
            severity:  sev == "severe" ? "severe" : sev == "moderate" ? "moderate" : "mild",
            onset_date: onsetDateTime,
            status:    clinicalStatus?.coding?.first?.code == "active" ? "active" : "resolved"
        )
    }
}

extension FHIRCareTeamParticipant {
    func toCareTeamMember() -> CareTeamMember {
        CareTeamMember(
            name:         member?.display ?? "",
            role:         role?.first?.coding?.first?.display ?? "",
            npi:          nil,
            phone:        nil,
            organization: onBehalfOf?.display
        )
    }
}

extension FHIRCoverageResource {
    func toInsurance() -> Insurance {
        Insurance(
            coverage_status: status == "active" ? "active" : "cancelled",
            coverage_type:   type?.text ?? type?.coding?.first?.display ?? "",
            payer:           payor?.first?.display ?? "",
            payer_id:        nil,
            member_id:       subscriberId ?? "",
            subscriber_id:   subscriberId,
            group_id:        `class`?.first(where: { $0.name?.lowercased().contains("group") == true })?.value,
            relationship_to_subscriber: "self"
        )
    }
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
    let id: String?
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
    init(fromFHIR row: FHIRPatientRow,
         vitals: [LatestObservation] = [],
         labs: [LatestObservation] = [],
         conditions: [FHIRConditionRow] = [],
         medications: [FHIRMedicationRequestRow] = [],
         allergies: [FHIRAllergyRow] = [],
         careTeam: [FHIRCareTeamRow] = [],
         coverage: [FHIRCoverageRow] = []) {
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
        problems       = conditions.map { $0.resource.toProblem() }.nilIfEmpty()
        self.medications = medications.map { $0.resource.toMedication() }.nilIfEmpty()
        self.allergies   = allergies.map { $0.resource.toAllergy() }.nilIfEmpty()
        care_team      = careTeam.flatMap { $0.resource.participant ?? [] }.map { $0.toCareTeamMember() }.nilIfEmpty()
        insurance      = coverage.first?.resource.toInsurance()
        immunizations                  = nil
        procedures                     = nil
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
        case "noshow", "no-show":                 apptStatus = .noShow
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
            id:              r.id ?? row.fhir_id,
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
