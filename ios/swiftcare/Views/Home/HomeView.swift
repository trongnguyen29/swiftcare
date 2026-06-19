import SwiftUI

/// Landing screen with at-a-glance stats, inline patient search, recent patients,
/// Quick Record, unassigned visits, and today's schedule.
struct HomeView: View {
    @Binding var selectedPatient: Patient?
    var onOpenPatient: (Patient) -> Void
    var onShowAppointments: () -> Void

    @StateObject private var recents = RecentPatientsStore.shared
    @ObservedObject private var appointmentStore = AppointmentStore.shared

    @State private var showQuickRecord   = false
    @State private var unassigned: [Visit] = []
    @State private var loadingUnassigned = false
    @State private var assignVisit: Visit?

    // Patient search
    @State private var searchText = ""
    @State private var allPatients: [Patient] = []
    @State private var loadingPatients = false
    @State private var resolving = false

    private var today: Date { Date() }
    private var todaysAppointments: [Appointment] {
        appointmentStore.appointments
            .filter { Calendar.current.isDate($0.date, inSameDayAs: today) }
            .sorted { $0.date < $1.date }
    }
    private var upcomingCount: Int {
        let start = Calendar.current.startOfDay(for: today)
        return appointmentStore.appointments.filter { $0.date >= start }.count
    }

    private var searchResults: [Patient] {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return [] }
        return allPatients.filter {
            $0.displayName.lowercased().contains(q)
        }.prefix(6).map { $0 }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                greeting
                statCards
                quickRecordHero
                searchSection
                if !recents.recents.isEmpty { recentPatientsSection }
                if loadingUnassigned || !unassigned.isEmpty { unassignedSection }
                scheduleSection
            }
            .padding()
        }
        .background(Color(UIColor.systemGroupedBackground))
        .fullScreenCover(isPresented: $showQuickRecord, onDismiss: { Task { await loadUnassigned() } }) {
            QuickRecordView()
        }
        .sheet(item: $assignVisit) { visit in
            AssignPatientView(visitId: visit.id) { _ in Task { await loadUnassigned() } }
        }
        .task {
            await appointmentStore.loadAppointments()
            await loadUnassigned()
            await loadPatientsIfNeeded()
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            Task { await loadUnassigned() }
        }
    }

    // MARK: - Greeting

    private var greeting: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(greetingText).font(.title.bold())
            Text(today.formatted(.dateTime.weekday(.wide).month().day()))
                .font(.subheadline).foregroundColor(.secondary)
        }
    }

    private var greetingText: String {
        let h = Calendar.current.component(.hour, from: today)
        switch h {
        case 5..<12:  return "Good morning"
        case 12..<17: return "Good afternoon"
        default:      return "Good evening"
        }
    }

    // MARK: - Stat cards

    private var statCards: some View {
        HStack(spacing: 12) {
            StatCard(icon: "calendar", tint: .teal,
                     value: "\(todaysAppointments.count)", label: "Today",
                     action: onShowAppointments)
            StatCard(icon: "tray.full", tint: .orange,
                     value: "\(unassigned.count)", label: "Unassigned",
                     action: nil)
            StatCard(icon: "clock.badge", tint: .indigo,
                     value: "\(upcomingCount)", label: "Upcoming",
                     action: onShowAppointments)
        }
    }

    // MARK: - Quick Record hero

    private var quickRecordHero: some View {
        Button { showQuickRecord = true } label: {
            HStack(spacing: 16) {
                ZStack {
                    Circle().fill(.white.opacity(0.22)).frame(width: 54, height: 54)
                    Image(systemName: "mic.fill").font(.title2).foregroundColor(.white)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text("Quick Record").font(.title3.bold()).foregroundColor(.white)
                    Text("Start a visit without picking a patient")
                        .font(.caption).foregroundColor(.white.opacity(0.9))
                }
                Spacer()
                Image(systemName: "arrow.right.circle.fill")
                    .font(.title2).foregroundColor(.white.opacity(0.9))
            }
            .padding(18)
            .background(
                LinearGradient(colors: [Color.teal, Color(red: 0.0, green: 0.5, blue: 0.5)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            )
            .cornerRadius(18)
            .shadow(color: .teal.opacity(0.3), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Patient search

    private var searchSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                TextField("Search patients by name…", text: $searchText)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                if !searchText.isEmpty {
                    Button { searchText = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                    }
                }
            }
            .padding(12)
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .cornerRadius(12)
            .onChange(of: searchText) { _, newValue in
                if !newValue.isEmpty { Task { await loadPatientsIfNeeded() } }
            }

            if !searchText.isEmpty {
                VStack(spacing: 0) {
                    if loadingPatients && allPatients.isEmpty {
                        HStack { ProgressView(); Text("Loading patients…").font(.caption).foregroundColor(.secondary) }
                            .frame(maxWidth: .infinity).padding()
                    } else if searchResults.isEmpty {
                        Text("No matches").font(.caption).foregroundColor(.secondary)
                            .frame(maxWidth: .infinity).padding()
                    } else {
                        ForEach(Array(searchResults.enumerated()), id: \.element.id) { idx, p in
                            Button { selectAndOpen(p) } label: {
                                HStack {
                                    Text(p.displayName).font(.subheadline.weight(.semibold)).foregroundColor(.primary)
                                    Spacer()
                                    if p.label == 1 { LCBadge() }
                                    Image(systemName: "chevron.right").font(.caption).foregroundColor(.secondary)
                                }
                                .padding(.vertical, 10).padding(.horizontal, 12)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            if idx < searchResults.count - 1 { Divider().padding(.leading, 12) }
                        }
                    }
                }
                .background(Color(UIColor.secondarySystemGroupedBackground))
                .cornerRadius(12)
            }
        }
    }

    // MARK: - Recent patients

    private var recentPatientsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Recent Patients").font(.headline)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(recents.recents) { r in
                        Button { Task { await resolveAndOpen(ptnum: r.ptnum) } } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                ZStack {
                                    Circle().fill(Color.teal.opacity(0.15)).frame(width: 36, height: 36)
                                    Text(initials(r.name)).font(.caption.bold()).foregroundColor(.teal)
                                }
                                Text(r.name).font(.caption.weight(.semibold)).foregroundColor(.primary)
                                    .lineLimit(2)
                            }
                            .frame(width: 130, alignment: .leading)
                            .padding(12)
                            .background(Color(UIColor.secondarySystemGroupedBackground))
                            .cornerRadius(12)
                            .overlay(alignment: .topTrailing) {
                                if r.label == 1 { LCBadge().padding(8) }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .opacity(resolving ? 0.6 : 1)
        }
    }

    // MARK: - Unassigned visits

    private var unassignedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Unassigned Visits").font(.headline)
            if loadingUnassigned && unassigned.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 8)
            } else if unassigned.isEmpty {
                Text("All caught up — no unassigned visits.")
                    .font(.subheadline).foregroundColor(.secondary)
            } else {
                ForEach(unassigned) { visit in
                    UnassignedCard(visit: visit) { assignVisit = visit }
                }
            }
        }
    }

    // MARK: - Today's schedule

    private struct ScheduleEntry: Identifiable {
        let appointment: Appointment
        let mockPatient: MockAppointmentPatient?
        let patient: Patient?
        var id: String { appointment.id }

        var patientName: String {
            patient?.displayName ?? mockPatient?.displayName ?? "Unknown Patient"
        }

        var profilePatient: Patient? {
            patient ?? mockPatient?.profilePatient
        }
    }

    // Use the same local schedule fixture as the Schedule tab. A real patient is
    // attached only when its MRN is present in the loaded patient list.
    private var scheduleEntries: [ScheduleEntry] {
        todaysAppointments.map { appointment in
            let mockPatient = appointmentStore.patient(for: appointment)
            let patient = mockPatient.flatMap { mockPatient in
                allPatients.first { $0.ptnum == mockPatient.mrn }
            }
            return ScheduleEntry(
                appointment: appointment,
                mockPatient: mockPatient,
                patient: patient
            )
        }
    }

    private var scheduleSection: some View {
        let now = Date()
        let entries = scheduleEntries
        let upcoming = entries.filter { $0.appointment.date >= now }
        let seen     = entries.filter { $0.appointment.date <  now }
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Today's Schedule").font(.headline)
                Spacer()
                Button(action: onShowAppointments) {
                    HStack(spacing: 2) { Text("See all"); Image(systemName: "chevron.right") }.font(.subheadline)
                }
            }
            if entries.isEmpty {
                Text("No appointments today.").font(.subheadline).foregroundColor(.secondary)
            } else {
                if !upcoming.isEmpty {
                    Text("UPCOMING").font(.caption2.weight(.bold)).foregroundColor(.secondary)
                    ForEach(upcoming) { scheduleRow($0, seen: false) }
                }
                if !seen.isEmpty {
                    Text("SEEN").font(.caption2.weight(.bold)).foregroundColor(.secondary).padding(.top, 4)
                    ForEach(seen) { scheduleRow($0, seen: true) }
                }
            }
        }
    }

    private func scheduleRow(_ entry: ScheduleEntry, seen: Bool) -> some View {
        Button {
            if let p = entry.profilePatient { onOpenPatient(p) }
        } label: {
            HStack(spacing: 12) {
                Text(entry.appointment.date.formatted(.dateTime.hour().minute()))
                    .font(.subheadline.weight(.bold)).foregroundColor(seen ? .secondary : .teal)
                    .frame(width: 60)
                Rectangle().fill((seen ? Color.secondary : Color.teal).opacity(0.35))
                    .frame(width: 3).cornerRadius(2)
                VStack(alignment: .leading, spacing: 3) {
                    Text(entry.patientName)
                        .font(.subheadline.weight(.semibold)).foregroundColor(.primary).lineLimit(1)
                    Text(entry.appointment.reason).font(.caption).foregroundColor(.secondary).lineLimit(2)
                    HStack(spacing: 5) {
                        Image(systemName: entry.appointment.type.icon).font(.caption2)
                        Text(entry.appointment.type.rawValue).font(.caption2)
                    }.foregroundColor(.secondary)
                }
                Spacer()
                if seen {
                    Image(systemName: "checkmark.circle.fill").foregroundColor(.green).font(.caption)
                } else if entry.profilePatient != nil {
                    Image(systemName: "chevron.right").font(.caption).foregroundColor(.secondary)
                }
            }
            .padding(12)
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .cornerRadius(12)
            .opacity(seen ? 0.9 : 1)
        }
        .buttonStyle(.plain)
        .disabled(entry.profilePatient == nil)
    }

    // MARK: - Actions

    private func selectAndOpen(_ p: Patient) {
        searchText = ""
        onOpenPatient(p)
    }

    private func loadPatientsIfNeeded() async {
        guard allPatients.isEmpty, !loadingPatients else { return }
        loadingPatients = true
        allPatients = (try? await APIService.shared.queryPatients(filter: "all")) ?? []
        loadingPatients = false
    }

    private func resolveAndOpen(ptnum: String) async {
        resolving = true
        defer { resolving = false }
        if let p = allPatients.first(where: { $0.ptnum == ptnum }) { onOpenPatient(p); return }
        if let results = try? await APIService.shared.queryPatients(query: ptnum),
           let match = results.first(where: { $0.ptnum == ptnum }) ?? results.first {
            onOpenPatient(match)
        }
    }

    private func loadUnassigned() async {
        loadingUnassigned = true
        unassigned = (try? await VisitsService.shared.fetchUnassigned()) ?? []
        loadingUnassigned = false
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.map { String($0.prefix(1)) }.joined().uppercased()
    }
}

// MARK: - Stat card

private struct StatCard: View {
    let icon: String
    let tint: Color
    let value: String
    let label: String
    let action: (() -> Void)?

    var body: some View {
        let content = VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon).font(.system(size: 18)).foregroundColor(tint)
            Text(value).font(.title2.bold())
            Text(label).font(.caption).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(14)

        if let action {
            Button(action: action) { content }.buttonStyle(.plain)
        } else {
            content
        }
    }
}

// MARK: - Unassigned visit card

private struct UnassignedCard: View {
    let visit: Visit
    let onAssign: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(formattedDate).font(.caption.bold()).foregroundColor(.secondary)
                    VisitStatusBadge(status: visit.status)
                }
                Spacer()
                Button(action: onAssign) {
                    Label("Assign", systemImage: "person.badge.plus")
                        .font(.system(size: 12, weight: .semibold))
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(Color.teal.opacity(0.1)).foregroundColor(.teal).cornerRadius(8)
                }
            }
            if !visit.transcript.isEmpty {
                Text(visit.transcript)
                    .font(.caption).foregroundColor(.secondary).lineLimit(3)
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private var formattedDate: String { VisitDate.display(visit.createdAt) }
}

// MARK: - Badges

private struct LCBadge: View {
    var body: some View {
        Text("LC+").font(.system(size: 9, weight: .bold))
            .padding(.horizontal, 5).padding(.vertical, 2)
            .background(Color.red.opacity(0.12)).foregroundColor(.red).clipShape(Capsule())
    }
}

private struct VisitStatusBadge: View {
    let status: String
    var body: some View {
        Text(status.capitalized)
            .font(.system(size: 9, weight: .bold))
            .padding(.horizontal, 5).padding(.vertical, 2)
            .background(color.opacity(0.12)).foregroundColor(color).clipShape(Capsule())
    }
    private var color: Color {
        switch status {
        case "complete": return .green
        case "failed":   return .red
        default:         return .orange
        }
    }
}
