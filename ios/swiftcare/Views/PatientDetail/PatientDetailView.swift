import SwiftUI

enum PatientTab: String, CaseIterable {
    case overview = "Overview"
    case chart = "Chart"
    case visit = "Visit"
    
    var icon: String {
        switch self {
        case .overview: return "square.grid.2x2"
        case .chart: return "chart.bar.doc.horizontal"
        case .visit: return "waveform.circle"
        }
    }
}

struct PatientDetailView: View {
    let patient: Patient
    @State private var activeTab: PatientTab = .overview
    @State private var showAIChat = false
    @State private var startRecordingSignal = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Banner
            PatientBannerView(
                patient: patient,
                onAskAI: { showAIChat = true },
                onStartRecording: {
                    activeTab = .visit
                    startRecordingSignal.toggle()
                }
            )
            .padding()
            
            // Tab Bar
            HStack(spacing: 0) {
                ForEach(PatientTab.allCases, id: \.self) { tab in
                    Button(action: {
                        withAnimation {
                            activeTab = tab
                        }
                    }) {
                        HStack(spacing: 8) {
                            Image(systemName: tab.icon)
                            Text(tab.rawValue)
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .padding(.vertical, 12)
                        .frame(maxWidth: .infinity)
                        .foregroundColor(activeTab == tab ? .teal : .secondary)
                        .background(
                            VStack {
                                Spacer()
                                Rectangle()
                                    .fill(activeTab == tab ? Color.teal : Color.clear)
                                    .frame(height: 2)
                            }
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            .background(Color(UIColor.systemBackground))
            
            Divider()
            
            // Content
            ScrollView {
                VStack {
                    switch activeTab {
                    case .overview:
                        PatientOverviewView(patient: patient)
                    case .chart:
                        Text("Chart coming soon") // PatientChartView(patient: patient)
                    case .visit:
                        VisitView(patient: patient)
                    }
                }
                .padding()
            }
            .background(Color(UIColor.systemGroupedBackground))
        }
        .navigationTitle(patient.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showAIChat) {
            AIChatView(patient: patient)
        }
    }
}
