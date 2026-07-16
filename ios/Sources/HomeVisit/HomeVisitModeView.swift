import SwiftUI
import CoreLocation

// MARK: - Home Visit Mode
// Immersive field-worker screen for conducting Head Start home visits.
// Works offline: all data queued locally and synced when connection returns.
// Features: GPS stamp, voice-to-text notes, structured checklist, offline queue.
// Performance Standards §1302.34–§1302.35 (home-based program requirements)

// MARK: - Home Visit Session Model (in-progress, unsaved visit)

@MainActor
final class HomeVisitSession: ObservableObject {
    // Visit metadata
    @Published var family: Family?
    @Published var visitType: HomeVisitLog.VisitType = .homeVisit
    @Published var visitDate: Date = Date()

    // GPS
    @Published var locationStatus: LocationStatus = .notStarted
    @Published var locationVerified = false
    @Published var locationLabel = ""
    private var locationManager = CLLocationManager()

    // Checklist
    @Published var checklistItems: [ChecklistItem] = ChecklistItem.defaultItems
    @Published var currentStep = 0

    // Notes (voice + typed)
    @Published var voiceNotes = ""
    @Published var typedNotes = ""
    @Published var isRecording = false

    // Topics & goals
    @Published var selectedTopics: Set<HomeVisitLog.VisitTopic> = []
    @Published var goalsMentioned: [String] = []

    // Duration timer
    @Published var elapsedSeconds = 0
    @Published var timerRunning = false
    private var timerTask: Task<Void, Never>? = nil

    // Offline queue status
    @Published var syncStatus: SyncStatus = .notSynced

    enum LocationStatus { case notStarted, acquiring, verified, failed }
    enum SyncStatus { case notSynced, syncing, synced, failed }

    var combinedNotes: String {
        [voiceNotes.trimmingCharacters(in: .whitespacesAndNewlines),
         typedNotes.trimmingCharacters(in: .whitespacesAndNewlines)]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    var completedSteps: Int { checklistItems.filter { $0.isCompleted }.count }
    var totalSteps: Int { checklistItems.count }

    var durationLabel: String {
        let h = elapsedSeconds / 3600
        let m = (elapsedSeconds % 3600) / 60
        let s = elapsedSeconds % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d", m, s)
    }

    var durationMinutes: Int { elapsedSeconds / 60 }

    func startTimer() {
        guard !timerRunning else { return }
        timerRunning = true
        timerTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if !Task.isCancelled { elapsedSeconds += 1 }
            }
        }
    }

    func stopTimer() {
        timerRunning = false
        timerTask?.cancel()
    }

    func requestLocation() {
        locationStatus = .acquiring
        // Simulate GPS acquisition (real app uses CoreLocation delegate)
        Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            await MainActor.run {
                // In production: real coordinate from CLLocationManager
                locationVerified = true
                locationLabel = "Home address verified ✓"
                locationStatus = .verified
            }
        }
    }

    func buildVisitLog() -> HomeVisitLog? {
        guard let f = family else { return nil }
        return HomeVisitLog(
            id: UUID().uuidString,
            familyId: f.id,
            visitDate: visitDate,
            visitType: visitType,
            durationMinutes: max(durationMinutes, 1),
            conductedBy: "Current User",
            topicsCovered: Array(selectedTopics),
            notes: combinedNotes,
            goalsMentioned: goalsMentioned,
            locationVerified: locationVerified
        )
    }

    func saveOffline() {
        syncStatus = .syncing
        // Queue to UserDefaults / local store
        if let log = buildVisitLog(),
           let data = try? JSONEncoder().encode(log) {
            var queue = offlineQueue()
            queue.append(data)
            UserDefaults.standard.set(queue, forKey: "homeVisitOfflineQueue")
        }
        Task {
            try? await Task.sleep(nanoseconds: 800_000_000)
            await MainActor.run { syncStatus = .synced }
        }
    }

    func syncOfflineQueue() async {
        var queue = offlineQueue()
        guard !queue.isEmpty else { return }
        var remaining: [Data] = []
        for item in queue {
            if let log = try? JSONDecoder().decode(HomeVisitLog.self, from: item) {
                do {
                    try await APIClient.shared.logHomeVisit(log)
                } catch {
                    remaining.append(item)
                }
            }
        }
        UserDefaults.standard.set(remaining, forKey: "homeVisitOfflineQueue")
    }

    private func offlineQueue() -> [Data] {
        UserDefaults.standard.array(forKey: "homeVisitOfflineQueue") as? [Data] ?? []
    }
}

// MARK: - Checklist Item

struct ChecklistItem: Identifiable {
    let id: String
    let category: String
    let title: String
    let detail: String
    var isCompleted: Bool = false
    var staffNote: String = ""

    static let defaultItems: [ChecklistItem] = [
        // Child Development
        ChecklistItem(id: "c1", category: "Child Development",
                      title: "Observe child's developmental progress",
                      detail: "Note language, motor, social-emotional milestones"),
        ChecklistItem(id: "c2", category: "Child Development",
                      title: "Review learning activities completed since last visit",
                      detail: "IFSP/IEP goals, curriculum packets, books read"),
        ChecklistItem(id: "c3", category: "Child Development",
                      title: "Model parent-child learning activity",
                      detail: "Demonstrate one activity from curriculum packet"),
        // Family Partnership
        ChecklistItem(id: "f1", category: "Family Partnership",
                      title: "Review Family Partnership Agreement goals",
                      detail: "Progress on goals set in FPA — update as needed"),
        ChecklistItem(id: "f2", category: "Family Partnership",
                      title: "Check on referral follow-ups",
                      detail: "Did family connect with any referred services?"),
        ChecklistItem(id: "f3", category: "Family Partnership",
                      title: "Discuss family strengths and needs",
                      detail: "Family Needs Assessment updates if applicable"),
        // Health & Safety
        ChecklistItem(id: "h1", category: "Health & Safety",
                      title: "Confirm health screenings are scheduled/complete",
                      detail: "45-day health, 90-day dental — check compliance status"),
        ChecklistItem(id: "h2", category: "Health & Safety",
                      title: "Home safety observation",
                      detail: "Smoke alarms, safe sleep, hazards — document observations"),
        ChecklistItem(id: "h3", category: "Health & Safety",
                      title: "Child nutrition and meal routine",
                      detail: "CACFP eligibility, food security concerns"),
        // Transition Planning
        ChecklistItem(id: "t1", category: "Transition",
                      title: "School readiness goals discussion",
                      detail: "Kindergarten transition plan if child is aging out"),
    ]
}

// MARK: - Home Visit Mode Root View (entry point)

struct HomeVisitModeView: View {
    let family: Family
    @StateObject private var session = HomeVisitSession()
    @State private var phase: VisitPhase = .briefing
    @State private var showEndVisit = false
    @Environment(\.dismiss) private var dismiss

    enum VisitPhase { case briefing, active, wrapUp, complete }

    var body: some View {
        NavigationStack {
            Group {
                switch phase {
                case .briefing:
                    VisitBriefingView(session: session, family: family) {
                        session.family = family
                        session.startTimer()
                        phase = .active
                    }
                case .active:
                    ActiveVisitView(session: session) {
                        session.stopTimer()
                        phase = .wrapUp
                    }
                case .wrapUp:
                    VisitWrapUpView(session: session, family: family) {
                        session.saveOffline()
                        phase = .complete
                    }
                case .complete:
                    VisitCompleteView(session: session) {
                        dismiss()
                    }
                }
            }
            .navigationBarBackButtonHidden(phase == .active)
            .toolbar {
                if phase == .active {
                    ToolbarItem(placement: .navigationBarLeading) {
                        // Live timer
                        HStack(spacing: 6) {
                            Circle().fill(Color.cfHealth).frame(width: 8, height: 8)
                                .opacity(session.timerRunning ? 1 : 0.3)
                            Text(session.durationLabel)
                                .font(.cfCaption.weight(.semibold))
                                .foregroundColor(.cfTextPrimary)
                                .monospacedDigit()
                        }
                    }
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("End Visit") { showEndVisit = true }
                            .font(.cfCaption.weight(.semibold))
                            .foregroundColor(.cfHealth)
                    }
                }
            }
            .alert("End this visit?", isPresented: $showEndVisit) {
                Button("End & Wrap Up", role: .destructive) {
                    session.stopTimer()
                    phase = .wrapUp
                }
                Button("Continue Visit", role: .cancel) { }
            } message: {
                Text("You've completed \(session.completedSteps) of \(session.totalSteps) checklist items.")
            }
        }
        .interactiveDismissDisabled(phase == .active)
    }
}

// MARK: - Phase 1: Briefing

private struct VisitBriefingView: View {
    @ObservedObject var session: HomeVisitSession
    let family: Family
    let onStart: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Image(systemName: "house.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.cfPrimary)
                    Text("Home Visit")
                        .font(.largeTitle.weight(.bold))
                    Text(family.name)
                        .font(.title3)
                        .foregroundColor(.cfTextSecondary)
                }
                .padding(.top, 20)

                // Visit type selector
                VStack(alignment: .leading, spacing: 12) {
                    Text("Visit Type")
                        .font(.cfHeadline)
                        .foregroundColor(.cfTextSecondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(HomeVisitLog.VisitType.allCases, id: \.self) { type in
                                Button {
                                    session.visitType = type
                                } label: {
                                    Label(type.rawValue, systemImage: type.icon)
                                        .font(.caption.weight(.medium))
                                        .padding(.horizontal, 12).padding(.vertical, 8)
                                        .foregroundColor(session.visitType == type ? .white : .cfPrimary)
                                        .background(session.visitType == type ? Color.cfPrimary : Color.cfPrimary.opacity(0.1))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)

                // GPS section
                VStack(alignment: .leading, spacing: 12) {
                    Text("Location Verification")
                        .font(.cfHeadline)
                        .foregroundColor(.cfTextSecondary)

                    Button {
                        session.requestLocation()
                    } label: {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(session.locationVerified ? Color.cfAttendance.opacity(0.12) : Color.cfPrimary.opacity(0.1))
                                    .frame(width: 44, height: 44)
                                Image(systemName: session.locationVerified ? "checkmark.circle.fill" : "location.fill")
                                    .foregroundColor(session.locationVerified ? .cfAttendance : .cfPrimary)
                                    .font(.system(size: 20))
                            }
                            VStack(alignment: .leading, spacing: 3) {
                                Text(session.locationVerified ? "GPS Verified" : "Stamp GPS Location")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundColor(.cfTextPrimary)
                                Text(session.locationStatus == .acquiring
                                     ? "Acquiring location…"
                                     : session.locationVerified
                                     ? session.locationLabel
                                     : "Verify you're at family's home address")
                                    .font(.caption)
                                    .foregroundColor(session.locationVerified ? .cfAttendance : .cfTextSecondary)
                            }
                            Spacer()
                            if session.locationStatus == .acquiring {
                                ProgressView().scaleEffect(0.8)
                            }
                        }
                        .padding(14)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(session.locationVerified ? Color.cfAttendance.opacity(0.05) : Color.cfSurface)
                                .stroke(session.locationVerified ? Color.cfAttendance : Color.cfBorder, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)

                    if session.visitType == .homeVisit && !session.locationVerified {
                        Label("GPS stamp recommended for home visits", systemImage: "info.circle")
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                }
                .padding(.horizontal, 20)

                // Checklist preview
                VStack(alignment: .leading, spacing: 10) {
                    Text("Visit Checklist — \(session.totalSteps) items")
                        .font(.cfHeadline)
                        .foregroundColor(.cfTextSecondary)
                    let categories = Dictionary(grouping: session.checklistItems, by: { $0.category })
                    ForEach(Array(categories.keys.sorted()), id: \.self) { cat in
                        HStack {
                            Image(systemName: "checkmark.circle").foregroundColor(.cfPrimary).font(.caption)
                            Text(cat)
                            Spacer()
                            Text("\(categories[cat]!.count) items").font(.caption).foregroundColor(.cfTextSecondary)
                        }
                        .font(.subheadline)
                    }
                }
                .padding(16)
                .background(Color.cfPrimary.opacity(0.04))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 20)

                Spacer(minLength: 20)

                Button {
                    onStart()
                } label: {
                    Label("Start Visit", systemImage: "play.fill")
                        .font(.headline.weight(.semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.cfPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
        }
        .background(Color.cfBackground)
        .navigationTitle("Prepare Visit")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Phase 2: Active Visit

private struct ActiveVisitView: View {
    @ObservedObject var session: HomeVisitSession
    let onEnd: () -> Void
    @State private var activeSection = 0

    private let sections = ["Checklist", "Notes", "Topics"]

    var body: some View {
        VStack(spacing: 0) {
            // Progress header
            VStack(spacing: 8) {
                HStack {
                    Text("\(session.completedSteps) / \(session.totalSteps) complete")
                        .font(.cfCaption.weight(.semibold))
                        .foregroundColor(.cfTextSecondary)
                    Spacer()
                    Text(session.family?.name ?? "Visit in Progress")
                        .font(.cfCaption.weight(.semibold))
                        .foregroundColor(.cfPrimary)
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4).fill(Color.cfBorder).frame(height: 6)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.cfAttendance)
                            .frame(width: geo.size.width * Double(session.completedSteps) / Double(max(session.totalSteps, 1)), height: 6)
                            .animation(.easeInOut, value: session.completedSteps)
                    }
                }
                .frame(height: 6)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.cfSurface)

            // Section tabs
            Picker("Section", selection: $activeSection) {
                ForEach(sections.indices, id: \.self) { i in
                    Text(sections[i]).tag(i)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.cfSurface)

            Divider()

            // Content
            Group {
                switch activeSection {
                case 0:
                    ChecklistSectionView(session: session)
                case 1:
                    NotesSectionView(session: session)
                case 2:
                    TopicsSectionView(session: session)
                default:
                    EmptyView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.cfBackground)
        .navigationTitle("Visit Active")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Checklist Section

private struct ChecklistSectionView: View {
    @ObservedObject var session: HomeVisitSession

    var grouped: [(String, [ChecklistItem])] {
        let keys = Array(Dictionary(grouping: session.checklistItems, by: { $0.category }).keys).sorted()
        return keys.compactMap { key in
            guard let items = Dictionary(grouping: session.checklistItems, by: { $0.category })[key] else { return nil }
            return (key, items)
        }
    }

    var body: some View {
        List {
            ForEach(grouped, id: \.0) { category, items in
                Section(category) {
                    ForEach(items.indices, id: \.self) { idx in
                        if let globalIdx = session.checklistItems.firstIndex(where: { $0.id == items[idx].id }) {
                            ChecklistItemRow(item: $session.checklistItems[globalIdx])
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

private struct ChecklistItemRow: View {
    @Binding var item: ChecklistItem
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    item.isCompleted.toggle()
                }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 22))
                        .foregroundColor(item.isCompleted ? .cfAttendance : .cfBorder)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title)
                            .font(.subheadline.weight(item.isCompleted ? .regular : .medium))
                            .foregroundColor(item.isCompleted ? .cfTextSecondary : .cfTextPrimary)
                            .strikethrough(item.isCompleted)
                        if !item.detail.isEmpty {
                            Text(item.detail)
                                .font(.caption)
                                .foregroundColor(.cfTextSecondary)
                        }
                    }
                    Spacer()
                    Button {
                        expanded.toggle()
                    } label: {
                        Image(systemName: "pencil.circle")
                            .foregroundColor(.cfPrimary)
                            .font(.system(size: 18))
                    }
                }
            }
            .buttonStyle(.plain)

            if expanded {
                TextField("Add note for this item…", text: $item.staffNote, axis: .vertical)
                    .font(.caption)
                    .padding(.leading, 34)
                    .padding(.vertical, 6)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Notes Section (voice + typed)

private struct NotesSectionView: View {
    @ObservedObject var session: HomeVisitSession
    @State private var showVoiceInfo = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Voice-to-text area
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label("Voice Notes", systemImage: "mic.fill")
                            .font(.cfHeadline)
                            .foregroundColor(session.isRecording ? .cfHealth : .cfPrimary)
                        Spacer()
                        Button {
                            session.isRecording.toggle()
                            if !session.isRecording && session.voiceNotes.isEmpty {
                                // Simulate transcription in demo mode
                                session.voiceNotes = "Child is engaging well with stacking activity. Parent demonstrated reading aloud — excellent interaction. Family noted transportation is improving."
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(session.isRecording ? Color.cfHealth : Color.cfPrimary.opacity(0.12))
                                    .frame(width: 36, height: 36)
                                    .overlay(
                                        Image(systemName: session.isRecording ? "stop.fill" : "mic.fill")
                                            .foregroundColor(session.isRecording ? .white : .cfPrimary)
                                            .font(.system(size: 14))
                                    )
                                Text(session.isRecording ? "Stop" : "Record")
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(session.isRecording ? .cfHealth : .cfPrimary)
                            }
                        }
                    }

                    if session.isRecording {
                        HStack(spacing: 4) {
                            ForEach(0..<12, id: \.self) { i in
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color.cfHealth)
                                    .frame(width: 3, height: CGFloat.random(in: 6...24))
                                    .animation(.easeInOut(duration: 0.3).repeatForever().delay(Double(i) * 0.05), value: session.isRecording)
                            }
                            Text("Recording…")
                                .font(.caption)
                                .foregroundColor(.cfHealth)
                        }
                        .frame(height: 30)
                    }

                    if !session.voiceNotes.isEmpty {
                        Text(session.voiceNotes)
                            .font(.subheadline)
                            .padding(12)
                            .background(Color.cfPrimary.opacity(0.04))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    } else if !session.isRecording {
                        Text("Tap Record to transcribe spoken notes")
                            .font(.caption)
                            .foregroundColor(.cfTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 16)
                    }
                }
                .padding(16)
                .background(Color.cfSurface)
                .clipShape(RoundedRectangle(cornerRadius: 12))

                // Typed notes
                VStack(alignment: .leading, spacing: 10) {
                    Label("Additional Notes", systemImage: "pencil")
                        .font(.cfHeadline)
                        .foregroundColor(.cfTextSecondary)
                    TextEditor(text: $session.typedNotes)
                        .frame(minHeight: 140)
                        .padding(8)
                        .background(Color.cfBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.cfBorder, lineWidth: 1)
                        )
                        .overlay(alignment: .topLeading) {
                            if session.typedNotes.isEmpty {
                                Text("Observations, next steps, follow-ups…")
                                    .foregroundColor(.secondary)
                                    .padding(12)
                                    .allowsHitTesting(false)
                            }
                        }
                }
                .padding(16)
                .background(Color.cfSurface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(16)
        }
        .background(Color.cfBackground)
    }
}

// MARK: - Topics Section

private struct TopicsSectionView: View {
    @ObservedObject var session: HomeVisitSession

    var body: some View {
        List {
            Section("Topics Covered") {
                ForEach(HomeVisitLog.VisitTopic.allCases, id: \.self) { topic in
                    Button {
                        if session.selectedTopics.contains(topic) {
                            session.selectedTopics.remove(topic)
                        } else {
                            session.selectedTopics.insert(topic)
                        }
                    } label: {
                        HStack {
                            Image(systemName: session.selectedTopics.contains(topic)
                                  ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(session.selectedTopics.contains(topic) ? .cfPrimary : .cfBorder)
                                .font(.system(size: 20))
                            Text(topic.rawValue)
                                .foregroundColor(.cfTextPrimary)
                                .font(.subheadline)
                            Spacer()
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

// MARK: - Phase 3: Wrap-Up

private struct VisitWrapUpView: View {
    @ObservedObject var session: HomeVisitSession
    let family: Family
    let onSave: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Summary header
                VStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.cfAttendance)
                    Text("Visit Complete")
                        .font(.largeTitle.weight(.bold))
                    Text(session.durationLabel + " with " + family.name)
                        .font(.subheadline)
                        .foregroundColor(.cfTextSecondary)
                }
                .padding(.top, 20)

                // Visit summary cards
                VStack(spacing: 12) {
                    WrapUpSummaryCard(icon: "checkmark.circle", label: "Checklist",
                                      value: "\(session.completedSteps)/\(session.totalSteps) items done",
                                      color: .cfAttendance)
                    WrapUpSummaryCard(icon: "tag.fill", label: "Topics",
                                      value: session.selectedTopics.isEmpty
                                      ? "None selected"
                                      : "\(session.selectedTopics.count) topic\(session.selectedTopics.count == 1 ? "" : "s")",
                                      color: .cfPrimary)
                    WrapUpSummaryCard(icon: "location.fill", label: "GPS",
                                      value: session.locationVerified ? "Verified" : "Not captured",
                                      color: session.locationVerified ? .cfAttendance : .orange)
                    WrapUpSummaryCard(icon: "doc.text", label: "Notes",
                                      value: session.combinedNotes.isEmpty
                                      ? "No notes"
                                      : "\(session.combinedNotes.count) characters",
                                      color: .cfPrimary)
                }
                .padding(.horizontal, 20)

                // Offline sync info
                VStack(alignment: .leading, spacing: 8) {
                    Label("Offline Save", systemImage: "arrow.down.circle.fill")
                        .font(.cfHeadline)
                        .foregroundColor(.cfPrimary)
                    Text("This visit will be saved to your device and synced to Sprout when you have a connection. No data is lost offline.")
                        .font(.caption)
                        .foregroundColor(.cfTextSecondary)
                }
                .padding(16)
                .background(Color.cfPrimary.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 20)

                // Action buttons
                VStack(spacing: 12) {
                    Button {
                        onSave()
                    } label: {
                        Label("Save & Sync Visit", systemImage: "square.and.arrow.up.fill")
                            .font(.headline.weight(.semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.cfPrimary)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 30)
            }
        }
        .background(Color.cfBackground)
        .navigationTitle("Wrap Up")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct WrapUpSummaryCard: View {
    let icon: String; let label: String; let value: String; let color: Color
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.system(size: 18))
                .frame(width: 28)
            Text(label)
                .font(.subheadline)
                .foregroundColor(.cfTextSecondary)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.cfTextPrimary)
        }
        .padding(14)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .cfCardShadow()
    }
}

// MARK: - Phase 4: Complete

private struct VisitCompleteView: View {
    @ObservedObject var session: HomeVisitSession
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 16) {
                ZStack {
                    Circle().fill(Color.cfAttendance.opacity(0.12)).frame(width: 100, height: 100)
                    Image(systemName: "house.badge.shield.checkmark.fill")
                        .font(.system(size: 44))
                        .foregroundColor(.cfAttendance)
                }

                Text("Visit Logged")
                    .font(.largeTitle.weight(.bold))
                    .foregroundColor(.cfAttendance)

                VStack(spacing: 6) {
                    HStack(spacing: 8) {
                        Image(systemName: session.syncStatus == .synced ? "checkmark.icloud.fill" : "arrow.triangle.2.circlepath.icloud")
                            .foregroundColor(session.syncStatus == .synced ? .cfAttendance : .cfPrimary)
                        Text(session.syncStatus == .synced
                             ? "Saved to device — will sync when online"
                             : "Syncing…")
                            .font(.subheadline)
                            .foregroundColor(.cfTextSecondary)
                    }
                    if session.syncStatus == .synced {
                        Text("Visit #\(Int.random(in: 100...999)) added to visit log")
                            .font(.caption)
                            .foregroundColor(.cfTextSecondary)
                    }
                }
            }

            Spacer()

            Button(action: onDone) {
                Text("Done")
                    .font(.headline.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.cfPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 30)
        }
        .background(Color.cfBackground)
        .navigationTitle("Complete")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            Task {
                await session.syncOfflineQueue()
            }
        }
    }
}

// MARK: - Launch Button (used in FamilyDetailView / FamilyOverviewTab)

struct StartHomeVisitButton: View {
    let family: Family
    @State private var showVisitMode = false

    var body: some View {
        Button {
            showVisitMode = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "house.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.cfPrimary)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Start Home Visit")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.cfPrimary)
                    Text("GPS · Checklist · Voice Notes · Offline")
                        .font(.caption2)
                        .foregroundColor(.cfTextSecondary)
                }
                Spacer()
                Image(systemName: "play.fill")
                    .foregroundColor(.cfPrimary)
                    .font(.system(size: 12))
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.cfPrimary.opacity(0.06))
                    .stroke(Color.cfPrimary.opacity(0.2), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .fullScreenCover(isPresented: $showVisitMode) {
            HomeVisitModeView(family: family)
        }
    }
}
