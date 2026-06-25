import SwiftUI
import UIKit

// MARK: - Tabs

enum AppTab: Int, CaseIterable, Identifiable {
    case home, patients, appointments
    var id: Int { rawValue }

    var title: String {
        switch self {
        case .home:         return "Home"
        case .patients:     return "Patients"
        case .appointments: return "Schedule"
        }
    }
    var icon: String {
        switch self {
        case .home:         return "house.fill"
        case .patients:     return "person.2.fill"
        case .appointments: return "calendar"
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var auth: AuthService

    // Main app state
    @State private var tab: AppTab = .home
    @State private var selectedPatient: Patient?
    @State private var sidebarOpen = false
    @State private var drawerProgress: CGFloat = 0
    @State private var draggingDrawer = false

    private let edgeZone: CGFloat = 30

    var body: some View {
        Group {
            if auth.isLoading {
                ProgressView("Loading…")
            } else if let factor = auth.pendingMFA, !auth.biometricLocked {
                MFAVerifyView(factor: factor)
            } else if auth.mfaEnrollmentRequired {
                MFAPromptView()
            } else if auth.isSignedIn && !auth.biometricLocked {
                mainApp
                    .sheet(isPresented: $auth.shouldPromptTouchID) {
                        TouchIDEnrollPrompt(isPresented: $auth.shouldPromptTouchID)
                            .environmentObject(auth)
                    }
            } else {
                LoginView()
            }
        }
    }

    // MARK: - Main app (drawer UI from main branch)

    private var mainApp: some View {
        GeometryReader { geo in
            let drawerW = min(330, geo.size.width * 0.82)

            VStack(spacing: 0) {
                NativeGlassTabBar(tab: $tab) { selectTopLevelTab($0) }
                    .frame(maxWidth: .infinity)
                    .frame(height: 58)

                ZStack(alignment: .leading) {
                    TabView(selection: $tab) {
                        HomeView(
                            selectedPatient: $selectedPatient,
                            onOpenPatient: openPatient,
                            onShowAppointments: { switchTab(.appointments) }
                        )
                        .tag(AppTab.home)

                        patientsPage
                            .tag(AppTab.patients)

                        GlobalAppointmentsView(onOpenPatient: openPatient)
                            .tag(AppTab.appointments)
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .disabled(sidebarOpen)

                    if tab == .patients && !sidebarOpen {
                        Color.clear
                            .frame(width: edgeZone)
                            .frame(maxHeight: .infinity)
                            .contentShape(Rectangle())
                            .gesture(drawerOpenGesture(drawerW: drawerW))
                    }

                    Color.black.opacity(0.28 * effectiveDrawerProgress)
                        .ignoresSafeArea()
                        .allowsHitTesting(effectiveDrawerProgress > 0)
                        .onTapGesture {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) { sidebarOpen = false }
                        }

                    PatientListView(selectedPatient: $selectedPatient)
                        .frame(width: drawerW)
                        .frame(maxHeight: .infinity)
                        .background(Color(UIColor.systemBackground))
                        .offset(x: -drawerW * (1 - effectiveDrawerProgress))
                        .shadow(color: .black.opacity(0.18 * effectiveDrawerProgress), radius: 12, x: 4)
                        .gesture(drawerCloseGesture(drawerW: drawerW))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
            }
            .ignoresSafeArea(.keyboard, edges: .bottom)
        }
        .onChange(of: selectedPatient) { _, p in
            if let p {
                RecentPatientsStore.shared.record(p)
                if sidebarOpen {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) { sidebarOpen = false }
                }
            }
        }
    }

    // MARK: - Patients page

    private var patientsPage: some View {
        NavigationStack {
            Group {
                if let patient = selectedPatient {
                    PatientDetailView(patient: patient)
                } else {
                    PatientListView(selectedPatient: $selectedPatient)
                }
            }
            .navigationTitle(selectedPatient?.displayName ?? "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if selectedPatient != nil {
                    ToolbarItemGroup(placement: .topBarLeading) {
                        Button { selectedPatient = nil } label: {
                            Image(systemName: "chevron.left")
                        }
                        .accessibilityLabel("Back to patients")

                        Button {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) { sidebarOpen.toggle() }
                        } label: {
                            Image(systemName: "sidebar.left")
                        }
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private var effectiveDrawerProgress: CGFloat {
        draggingDrawer ? drawerProgress : (sidebarOpen ? 1 : 0)
    }

    private func openPatient(_ patient: Patient) {
        selectedPatient = patient
        switchTab(.patients)
    }

    private func switchTab(_ newTab: AppTab) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) {
            sidebarOpen = false
            tab = newTab
        }
    }

    private func selectTopLevelTab(_ newTab: AppTab) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) {
            sidebarOpen = false
            if newTab == .patients { selectedPatient = nil }
            tab = newTab
        }
    }

    // MARK: - Drawer gestures

    private func drawerOpenGesture(drawerW: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 12, coordinateSpace: .local)
            .onChanged { v in
                guard abs(v.translation.width) > abs(v.translation.height) * 1.3 else { return }
                draggingDrawer = true
                drawerProgress = min(max(v.translation.width / drawerW, 0), 1)
            }
            .onEnded { v in
                guard draggingDrawer else { return }
                let shouldOpen = drawerProgress > 0.4 || v.predictedEndTranslation.width > drawerW * 0.5
                withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) {
                    sidebarOpen = shouldOpen
                    drawerProgress = 0
                    draggingDrawer = false
                }
            }
    }

    private func drawerCloseGesture(drawerW: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 12, coordinateSpace: .local)
            .onChanged { v in
                guard sidebarOpen, abs(v.translation.width) > abs(v.translation.height) * 1.3 else { return }
                draggingDrawer = true
                drawerProgress = min(max(1 + v.translation.width / drawerW, 0), 1)
            }
            .onEnded { v in
                guard draggingDrawer else { return }
                let shouldStayOpen = drawerProgress > 0.6 && v.predictedEndTranslation.width > -drawerW * 0.5
                withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) {
                    sidebarOpen = shouldStayOpen
                    drawerProgress = 0
                    draggingDrawer = false
                }
            }
    }
}

// MARK: - Native glass tab bar

struct NativeGlassTabBar: UIViewRepresentable {
    @Binding var tab: AppTab
    let onSelect: (AppTab) -> Void

    func makeUIView(context: Context) -> UITabBar {
        let tabBar = UITabBar()
        tabBar.delegate = context.coordinator
        tabBar.isTranslucent = true
        tabBar.backgroundColor = .clear
        tabBar.barTintColor = .clear
        tabBar.tintColor = UIColor(Color.brand)
        tabBar.itemPositioning = .fill
        tabBar.itemWidth = 0
        tabBar.itemSpacing = 0
        let appearance = transparentAppearance()
        tabBar.standardAppearance = appearance
        tabBar.scrollEdgeAppearance = appearance
        tabBar.items = AppTab.allCases.map { appTab in
            UITabBarItem(title: appTab.title, image: UIImage(systemName: appTab.icon), tag: appTab.rawValue)
        }
        tabBar.selectedItem = tabBar.items?.first { $0.tag == tab.rawValue }
        return tabBar
    }

    func updateUIView(_ tabBar: UITabBar, context: Context) {
        if tabBar.items?.count != AppTab.allCases.count {
            tabBar.items = AppTab.allCases.map { appTab in
                UITabBarItem(title: appTab.title, image: UIImage(systemName: appTab.icon), tag: appTab.rawValue)
            }
        }
        tabBar.selectedItem = tabBar.items?.first { $0.tag == tab.rawValue }
    }

    private func transparentAppearance() -> UITabBarAppearance {
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundColor = .clear
        appearance.backgroundEffect = nil
        appearance.shadowColor = .clear
        return appearance
    }

    func makeCoordinator() -> Coordinator { Coordinator(tab: $tab, onSelect: onSelect) }

    final class Coordinator: NSObject, UITabBarDelegate {
        @Binding private var tab: AppTab
        private let onSelect: (AppTab) -> Void

        init(tab: Binding<AppTab>, onSelect: @escaping (AppTab) -> Void) {
            _tab = tab
            self.onSelect = onSelect
        }

        func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
            guard let selected = AppTab(rawValue: item.tag) else { return }
            onSelect(selected)
        }
    }
}

#Preview {
    ContentView().environmentObject(AuthService.shared)
}
