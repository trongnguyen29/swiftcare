import SwiftUI

enum PatientTab: String, CaseIterable {
    case overview     = "Overview"
    case chart        = "Chart"
    case visit        = "Visit"
    case pastVisits   = "History"
    case appointments = "Appointments"

    var icon: String {
        switch self {
        case .overview:     return "square.grid.2x2"
        case .chart:        return "chart.bar.doc.horizontal"
        case .visit:        return "waveform.circle"
        case .pastVisits:   return "clock.arrow.circlepath"
        case .appointments: return "calendar"
        }
    }
}

struct PatientDetailView: View {
    let patient: Patient
    @State private var detailedPatient: Patient? = nil
    @State private var activeTab: PatientTab = .overview
    @State private var showAIChat = false
    private var displayPatient: Patient { detailedPatient ?? patient }
    @State private var startRecordingSignal = 0

    var body: some View {
        VStack(spacing: 0) {
            // Banner
            PatientBannerView(
                patient: displayPatient,
                onAskAI: { showAIChat = true },
                onStartRecording: {
                    activeTab = .visit
                    startRecordingSignal += 1
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
                        .foregroundColor(activeTab == tab ? .brand : .secondary)
                        .background(
                            VStack {
                                Spacer()
                                Rectangle()
                                    .fill(activeTab == tab ? Color.brand : Color.clear)
                                    .frame(height: 2)
                            }
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            .background(Color(UIColor.systemBackground))
            
            Divider()
            
            // Content — each tab owns its own scroll
            Group {
                switch activeTab {
                case .overview:
                    ScrollView {
                        PatientOverviewView(patient: displayPatient)
                            .padding()
                    }
                    .background(Color(UIColor.systemGroupedBackground))

                case .chart:
                    ScrollView {
                        VStack(spacing: 16) {
                            PatientChartView(patient: displayPatient)
                            PatientChartDetailView(patient: displayPatient)
                        }
                        .padding()
                    }
                    .background(Color(UIColor.systemGroupedBackground))

                case .visit:
                    VisitView(patient: displayPatient, startSignal: startRecordingSignal)

                case .pastVisits:
                    ScrollView {
                        PastVisitsView(patient: patient).padding()
                    }
                    .background(Color(UIColor.systemGroupedBackground))

                case .appointments:
                    PatientAppointmentsView(patient: displayPatient)
                }
            }
        }
        .navigationTitle(patient.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showAIChat) {
            AIChatView(patient: displayPatient)
        }
        .task(id: patient.ptnum) {
            detailedPatient = try? await APIService.shared.getPatientDetail(fhirId: patient.ptnum)
        }
    }
}
