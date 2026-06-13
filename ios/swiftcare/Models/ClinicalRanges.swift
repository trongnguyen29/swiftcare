import Foundation
import SwiftUI

enum VitalStatus {
    case normal
    case borderline
    case critical
    case unknown
}

struct RangeDef {
    let lo: Double
    let hi: Double
    let unit: String
    let label: String
}

struct ZoneDef {
    let lo: Double
    let hi: Double
}

struct ClinicalRanges {
    static let ranges: [String: RangeDef] = [
        "systolic_bp":       RangeDef(lo: 90,  hi: 180, unit: "mmHg",  label: "Systolic BP"),
        "diastolic_bp":      RangeDef(lo: 60,  hi: 120, unit: "mmHg",  label: "Diastolic BP"),
        "heart_rate":        RangeDef(lo: 40,  hi: 140, unit: "bpm",   label: "Heart Rate"),
        "oxygen_saturation": RangeDef(lo: 88,  hi: 100, unit: "%",     label: "SpO₂"),
        "bmi":               RangeDef(lo: 15,  hi: 45,  unit: "",      label: "BMI"),
        "total_cholesterol": RangeDef(lo: 100, hi: 280, unit: "mg/dL", label: "Total Chol."),
        "ldl":               RangeDef(lo: 50,  hi: 200, unit: "mg/dL", label: "LDL"),
        "hdl":               RangeDef(lo: 20,  hi: 100, unit: "mg/dL", label: "HDL"),
        "triglycerides":     RangeDef(lo: 50,  hi: 400, unit: "mg/dL", label: "Triglycerides"),
        "hba1c":             RangeDef(lo: 4,   hi: 11,  unit: "%",     label: "HbA1c"),
        "glucose":           RangeDef(lo: 60,  hi: 300, unit: "mg/dL", label: "Glucose"),
        "egfr":              RangeDef(lo: 15,  hi: 120, unit: "mL/min",label: "eGFR")
    ]
    
    static let normal: [String: ZoneDef] = [
        "systolic_bp":       ZoneDef(lo: 90,   hi: 130),
        "diastolic_bp":      ZoneDef(lo: 60,   hi: 90),
        "heart_rate":        ZoneDef(lo: 60,   hi: 100),
        "oxygen_saturation": ZoneDef(lo: 95,   hi: 100),
        "bmi":               ZoneDef(lo: 18.5, hi: 25),
        "total_cholesterol": ZoneDef(lo: 100,  hi: 200),
        "ldl":               ZoneDef(lo: 50,   hi: 130),
        "hdl":               ZoneDef(lo: 40,   hi: 100),
        "triglycerides":     ZoneDef(lo: 50,   hi: 150),
        "hba1c":             ZoneDef(lo: 4,    hi: 5.7),
        "glucose":           ZoneDef(lo: 70,   hi: 100),
        "egfr":              ZoneDef(lo: 60,   hi: 120)
    ]
    
    static let critical: [String: ZoneDef] = [
        "systolic_bp":       ZoneDef(lo: 80,  hi: 160),
        "diastolic_bp":      ZoneDef(lo: 50,  hi: 100),
        "heart_rate":        ZoneDef(lo: 50,  hi: 120),
        "oxygen_saturation": ZoneDef(lo: 92,  hi: 101),
        "bmi":               ZoneDef(lo: 16,  hi: 35),
        "total_cholesterol": ZoneDef(lo: 0,   hi: 240),
        "ldl":               ZoneDef(lo: 0,   hi: 160),
        "hdl":               ZoneDef(lo: 30,  hi: 999),
        "triglycerides":     ZoneDef(lo: 0,   hi: 200),
        "hba1c":             ZoneDef(lo: 0,   hi: 6.5),
        "glucose":           ZoneDef(lo: 70,  hi: 126),
        "egfr":              ZoneDef(lo: 30,  hi: 999)
    ]
    
    static let refText: [String: String] = [
        "systolic_bp":       "ref 90–130",
        "diastolic_bp":      "ref 60–90",
        "heart_rate":        "ref 60–100",
        "oxygen_saturation": "ref ≥95",
        "bmi":               "ref 18.5–25",
        "total_cholesterol": "ref <200",
        "ldl":               "ref <130",
        "hdl":               "ref ≥40",
        "triglycerides":     "ref <150",
        "hba1c":             "ref <5.7",
        "glucose":           "ref 70–100",
        "egfr":              "ref ≥60"
    ]
    
    static func status(for key: String, value: Double?) -> VitalStatus {
        guard let value = value else { return .unknown }
        guard let n = normal[key], let c = critical[key] else { return .unknown }
        
        if value < c.lo || value > c.hi { return .critical }
        if value < n.lo || value > n.hi { return .borderline }
        return .normal
    }
    
    static func statusColor(for status: VitalStatus) -> Color {
        switch status {
        case .critical: return .red
        case .borderline: return .orange
        case .normal: return .green
        case .unknown: return .gray
        }
    }
    
    static func cvScore(for p: Patient) -> Double {
        var s = 0.0
        if let bp = p.systolic_bp {
            if bp >= 140 { s += 30 }
            else if bp >= 130 { s += 15 }
        }
        if let chol = p.total_cholesterol {
            if chol >= 240 { s += 25 }
            else if chol >= 200 { s += 12 }
        }
        if let ldl = p.ldl {
            if ldl >= 160 { s += 25 }
            else if ldl >= 130 { s += 12 }
        }
        if p.tobacco_status == "former" { s += 20 }
        return min(100, s)
    }
    
    static func metabolicScore(for p: Patient) -> Double {
        var s = 0.0
        if let hba1c = p.hba1c {
            if hba1c >= 6.5 { s += 35 }
            else if hba1c >= 5.7 { s += 18 }
        }
        if let glu = p.glucose {
            if glu >= 126 { s += 30 }
            else if glu >= 100 { s += 15 }
        }
        if let bmi = p.bmi {
            if bmi >= 30 { s += 25 }
            else if bmi >= 25 { s += 12 }
        }
        if let tri = p.triglycerides {
            if tri >= 200 { s += 10 }
        }
        return min(100, s)
    }
    
    static func overallScore(for p: Patient) -> Double {
        return round((cvScore(for: p) + metabolicScore(for: p)) / 2)
    }
    
    // The most informative one-liner for a list row
    static func rowSignal(for p: Patient) -> (text: String, isCritical: Bool)? {
        if let active = p.problems?.first(where: { $0.status == "active" }) ?? p.problems?.first {
            return (active.display, false)
        }
        
        var worst: (String, Bool)? = nil
        let keys = ["systolic_bp", "diastolic_bp", "heart_rate", "oxygen_saturation", "bmi", "total_cholesterol", "ldl", "hdl", "triglycerides", "hba1c", "glucose", "egfr"]
        
        for key in keys {
            // Need to get property value by key name, we'll implement a helper or hardcode
            let val = value(for: key, in: p)
            let st = status(for: key, value: val)
            
            if st == .critical {
                return ("\(ranges[key]?.label ?? "") \(val!)", true)
            }
            if st == .borderline && worst == nil {
                worst = ("\(ranges[key]?.label ?? "") \(val!)", false)
            }
        }
        return worst
    }
    
    static func value(for key: String, in p: Patient) -> Double? {
        switch key {
        case "systolic_bp": return p.systolic_bp
        case "diastolic_bp": return p.diastolic_bp
        case "heart_rate": return p.heart_rate
        case "oxygen_saturation": return p.oxygen_saturation
        case "bmi": return p.bmi
        case "total_cholesterol": return p.total_cholesterol
        case "ldl": return p.ldl
        case "hdl": return p.hdl
        case "triglycerides": return p.triglycerides
        case "hba1c": return p.hba1c
        case "glucose": return p.glucose
        case "egfr": return p.egfr
        default: return nil
        }
    }
}
