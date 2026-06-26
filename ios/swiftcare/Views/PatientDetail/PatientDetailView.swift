import SwiftUI

enum PatientTab: String, CaseIterable {
    case overview   = "Overview"
    case chart      = "Chart"
    case visit      = "Visit"
    case pastVisits = "History"

    var icon: String {
        switch self {
        case .overview:   return "square.grid.2x2"
        case .chart:      return "chart.bar.doc.horizontal"
        case .visit:      return "waveform.circle"
        case .pastVisits: return "clock.arrow.circlepath"
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

            // Tab indicator (tap or 1-finger swipe via the TabView below)
            HStack(spacing: 0) {
                ForEach(PatientTab.allCases, id: \.self) { tab in
                    Button(action: { withAnimation { activeTab = tab } }) {
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

            // 1-finger swipe switches patient tabs
            TabView(selection: $activeTab) {
                ScrollView {
                    PatientOverviewView(patient: displayPatient).padding()
                }
                .background(Color(UIColor.systemGroupedBackground))
                .tag(PatientTab.overview)

                ScrollView {
                    VStack(spacing: 16) {
                        PatientChartView(patient: displayPatient)
                        PatientChartDetailView(patient: displayPatient)
                    }
                    .padding()
                }
                .background(Color(UIColor.systemGroupedBackground))
                .tag(PatientTab.chart)

                VisitView(patient: displayPatient, startSignal: startRecordingSignal)
                    .tag(PatientTab.visit)

                ScrollView {
                    PastVisitsView(patient: patient).padding()
                }
                .background(Color(UIColor.systemGroupedBackground))
                .tag(PatientTab.pastVisits)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showAIChat) {
            AIChatView(patient: displayPatient)
        }
        .task(id: patient.ptnum) {
            detailedPatient = try? await APIService.shared.getPatientDetail(fhirId: patient.ptnum)
        }
    }
}
