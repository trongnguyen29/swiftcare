import SwiftUI

struct RiskRing: View {
    let score: Double
    let label: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.2), lineWidth: 7)
                
                Circle()
                    .trim(from: 0, to: CGFloat(score / 100.0))
                    .stroke(color, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                
                Text("\(Int(score))")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(color)
            }
            .frame(width: 72, height: 72)
            
            Text(label)
                .font(.caption)
                .foregroundColor(.primary)
                .multilineTextAlignment(.center)
        }
    }
}

struct RiskRingsView: View {
    let patient: Patient
    
    var body: some View {
        let cv = ClinicalRanges.cvScore(for: patient)
        let meta = ClinicalRanges.metabolicScore(for: patient)
        let ov = ClinicalRanges.overallScore(for: patient)
        
        HStack(spacing: 16) {
            RiskRing(score: ov, label: "Overall", color: ringColor(for: ov))
            
            Divider()
                .frame(height: 50)
            
            RiskRing(score: cv, label: "Cardiovasc.", color: ringColor(for: cv))
            
            Divider()
                .frame(height: 50)
            
            RiskRing(score: meta, label: "Metabolic", color: ringColor(for: meta))
        }
    }
    
    func ringColor(for score: Double) -> Color {
        if score >= 60 { return .red }
        if score >= 30 { return .orange }
        return .green
    }
}
