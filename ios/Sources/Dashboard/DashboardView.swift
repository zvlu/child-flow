import SwiftUI

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @StateObject private var clockViewModel = ClockInViewModel()
    @EnvironmentObject var appState: AppState
    @State private var showMenu = false
    @State private var showSearch = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Color.cfBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 0) {
                        DashboardHeader(userName: appState.currentUser?.fullName ?? "", onMenuTap: { showMenu = true }, onSearchTap: { showSearch = true })

                        VStack(spacing: 20) {
                            // Clock Widget
                            DashboardClockWidget(viewModel: clockViewModel)
                                .padding(.horizontal)

                            // Workspace Section
                            VStack(alignment: .leading, spacing: 12) {
                                CFSectionHeader(title: "My Workspace")
                                    .padding(.horizontal)

                                // Messages + Documents (2-col)
                                HStack(spacing: 12) {
                                    NavigationLink(destination: MessagingView()) {
                                        WorkspaceCard(
                                            icon: "tray.fill",
                                            color: .cfPrimary,
                                            bgColor: .cfPrimaryLight,
                                            title: "Inbox",
                                            badge: "\(viewModel.unreadMessageCount)",
                                            subtitle: viewModel.unreadMessageCount == 1 ? "1 unread message" : "\(viewModel.unreadMessageCount) unread messages",
                                            detail: viewModel.lastMessagePreview
                                        )
                                    }
                                    NavigationLink(destination: DocumentsView()) {
                                        WorkspaceCard(
                                            icon: "folder.fill",
                                            color: .cfFamily,
                                            bgColor: .cfFamilyBg,
                                            title: "Documents",
                                            badge: viewModel.pendingDocumentCount > 0 ? "\(viewModel.pendingDocumentCount)" : nil,
                                            subtitle: "\(viewModel.totalDocumentCount) files",
                                            detail: viewModel.pendingDocumentCount > 0 ? "\(viewModel.pendingDocumentCount) pending assignment" : "All filed"
                                        )
                                    }
                                }
                                .padding(.horizontal)

                                // My Caseload
                                NavigationLink(destination: ChildrenView()) {
                                    CaseloadCard(children: viewModel.myCaseload)
                                        .padding(.horizontal)
                                }

                                // Pending Tasks
                                PendingTasksCard(tasks: viewModel.pendingTasks)
                                    .padding(.horizontal)

                                // Today's Agenda
                                TodayAgendaCard(events: viewModel.todayAgenda)
                                    .padding(.horizontal)
                            }

                            // Quick Actions
                            QuickActionsRow()
                                .padding(.horizontal)

                            // Alerts — each navigates to the module where the
                            // flagged work lives (see AlertLinkRow).
                            if !viewModel.alerts.isEmpty {
                                VStack(spacing: 10) {
                                    CFSectionHeader(title: "Alerts & Reminders")
                                        .padding(.horizontal)
                                    ForEach(viewModel.alerts) { alert in
                                        AlertLinkRow(alert: alert)
                                            .padding(.horizontal)
                                    }
                                }
                            }

                            Spacer(minLength: 32)
                        }
                        .padding(.top, 24)
                    }
                }
            }
            .navigationBarHidden(true)
            .task {
                await viewModel.load()
                await clockViewModel.load()
            }
            .sheet(isPresented: $showMenu) { AppMenuSheet() }
            .sheet(isPresented: $showSearch) { GlobalSearchView() }
        }
    }
}

// MARK: - Workspace Card (half-width)

struct WorkspaceCard: View {
    let icon: String
    let color: Color
    let bgColor: Color
    let title: String
    let badge: String?
    let subtitle: String
    let detail: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(color.opacity(0.15))
                        .frame(width: 40, height: 40)
                    Image(systemName: icon)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(color)
                }
                Spacer()
                if let badge {
                    Text(badge)
                        .font(.cfCaption2.bold())
                        .foregroundColor(.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(color)
                        .clipShape(Capsule())
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.cfSubheadline.bold())
                    .foregroundColor(.cfTextPrimary)
                Text(subtitle)
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
                if let detail {
                    Text(detail)
                        .font(.cfCaption)
                        .foregroundColor(color)
                        .lineLimit(1)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(color.opacity(0.12), lineWidth: 1)
        }
        .cfCardShadow()
    }
}

// MARK: - Caseload Card

struct CaseloadCard: View {
    let children: [CaseloadChild]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("My Caseload", systemImage: "person.2.fill")
                    .font(.cfSubheadline.bold())
                    .foregroundColor(.cfTextPrimary)
                Spacer()
                Text("\(children.count) children")
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(.cfTextSecondary)
            }

            if children.isEmpty {
                Text("No children assigned to your caseload.")
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(children) { child in
                            CaseloadChildPill(child: child)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color.cfChildren.opacity(0.12), lineWidth: 1)
        }
        .cfCardShadow()
    }
}

struct CaseloadChildPill: View {
    let child: CaseloadChild

    var statusColor: Color {
        switch child.attendanceStatus {
        case .present: return .cfAttendance
        case .absent:  return .cfHealth
        case .unknown: return .cfTextSecondary
        }
    }

    var statusIcon: String {
        switch child.attendanceStatus {
        case .present: return "checkmark.circle.fill"
        case .absent:  return "xmark.circle.fill"
        case .unknown: return "questionmark.circle.fill"
        }
    }

    var body: some View {
        VStack(spacing: 6) {
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(Color.cfChildren.opacity(0.15))
                    .frame(width: 44, height: 44)
                    .overlay {
                        Text(child.initials)
                            .font(.cfCaption2.bold())
                            .foregroundColor(.cfChildren)
                    }
                Image(systemName: statusIcon)
                    .font(.system(size: 13))
                    .foregroundColor(statusColor)
                    .background(Color.cfSurface.clipShape(Circle()))
                    .offset(x: 3, y: 3)
            }
            Text(child.firstName)
                .font(.cfCaption2)
                .foregroundColor(.cfTextSecondary)
                .lineLimit(1)
        }
        .frame(width: 54)
    }
}

// MARK: - Pending Tasks Card

struct PendingTasksCard: View {
    let tasks: [DashboardTask]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Pending Tasks", systemImage: "checklist")
                    .font(.cfSubheadline.bold())
                    .foregroundColor(.cfTextPrimary)
                Spacer()
                if !tasks.isEmpty {
                    Text("\(tasks.count)")
                        .font(.cfCaption2.bold())
                        .foregroundColor(.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.cfAccent)
                        .clipShape(Capsule())
                }
            }

            if tasks.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.cfAttendance)
                    Text("You're all caught up!")
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                }
            } else {
                VStack(spacing: 0) {
                    ForEach(tasks.prefix(4)) { task in
                        DashboardTaskRow(task: task)
                        if task.id != tasks.prefix(4).last?.id {
                            Divider().padding(.leading, 28)
                        }
                    }
                }
                if tasks.count > 4 {
                    NavigationLink(destination: AllTasksView(tasks: tasks)) {
                        Text("View all \(tasks.count) tasks →")
                            .font(.cfCaption.bold())
                            .foregroundColor(.cfPrimary)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                            .padding(.top, 4)
                    }
                }
            }
        }
        .padding(16)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color.cfAccent.opacity(0.12), lineWidth: 1)
        }
        .cfCardShadow()
    }
}

struct DashboardTaskRow: View {
    let task: DashboardTask

    var urgencyColor: Color {
        switch task.urgency {
        case .overdue:  return .cfHealth
        case .today:    return .cfAccent
        case .upcoming: return .cfTextSecondary
        }
    }

    var body: some View {
        NavigationLink(destination: TaskDestinationView(destination: task.destination)) {
            HStack(spacing: 10) {
                Circle()
                    .fill(urgencyColor.opacity(0.2))
                    .frame(width: 8, height: 8)
                    .overlay(Circle().stroke(urgencyColor, lineWidth: 1.5))
                VStack(alignment: .leading, spacing: 2) {
                    Text(task.title)
                        .font(.cfCaption)
                        .foregroundColor(.cfTextPrimary)
                        .lineLimit(1)
                    Text(task.dueLabel)
                        .font(.cfCaption2)
                        .foregroundColor(urgencyColor)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.cfTextSecondary.opacity(0.5))
            }
            .padding(.vertical, 7)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Today's Agenda Card

struct TodayAgendaCard: View {
    let events: [AgendaEvent]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Today's Agenda", systemImage: "calendar")
                    .font(.cfSubheadline.bold())
                    .foregroundColor(.cfTextPrimary)
                Spacer()
                Text(Date().formatted(.dateTime.month(.abbreviated).day()))
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
            }

            if events.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "calendar.badge.checkmark")
                        .foregroundColor(.cfAttendance)
                    Text("Nothing scheduled for today.")
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                }
            } else {
                VStack(spacing: 0) {
                    ForEach(events) { event in
                        AgendaEventRow(event: event)
                        if event.id != events.last?.id {
                            Divider().padding(.leading, 52)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color.cfGoals.opacity(0.12), lineWidth: 1)
        }
        .cfCardShadow()
    }
}

struct AgendaEventRow: View {
    let event: AgendaEvent

    var body: some View {
        NavigationLink(destination: TaskDestinationView(destination: event.destination)) {
            HStack(spacing: 12) {
                VStack(spacing: 2) {
                    Text(event.timeLabel)
                        .font(.cfCaption2.bold())
                        .foregroundColor(.cfPrimary)
                        .frame(width: 40)
                }

                Rectangle()
                    .fill(event.color)
                    .frame(width: 3)
                    .clipShape(Capsule())
                    .padding(.vertical, 4)

                VStack(alignment: .leading, spacing: 2) {
                    Text(event.title)
                        .font(.cfCaption)
                        .fontWeight(.medium)
                        .foregroundColor(.cfTextPrimary)
                        .lineLimit(1)
                    if let subtitle = event.subtitle {
                        Text(subtitle)
                            .font(.cfCaption2)
                            .foregroundColor(.cfTextSecondary)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.cfTextSecondary.opacity(0.5))
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Header Banner

struct DashboardHeader: View {
    let userName: String
    var onMenuTap: (() -> Void)? = nil
    var onSearchTap: (() -> Void)? = nil

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning" }
        if hour < 17 { return "Good afternoon" }
        return "Good evening"
    }

    private var firstName: String {
        userName.split(separator: " ").first.map(String.init) ?? userName
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [Color.cfPrimary, Color.cfPrimaryDark],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .frame(height: 140)
            .overlay(alignment: .topTrailing) {
                Circle()
                    .fill(Color.white.opacity(0.06))
                    .frame(width: 120, height: 120)
                    .offset(x: 40, y: -30)
            }
            .overlay(alignment: .bottomTrailing) {
                Circle()
                    .fill(Color.white.opacity(0.05))
                    .frame(width: 80, height: 80)
                    .offset(x: 20, y: 20)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("\(greeting)\(firstName.isEmpty ? "" : ", \(firstName)") 👋")
                            .font(.cfTitle2)
                            .foregroundColor(.white)
                        Text(Date().formatted(.dateTime.weekday(.wide).month().day().year()))
                            .font(.cfCaption)
                            .foregroundColor(.white.opacity(0.75))
                    }
                    Spacer()
                    HStack(spacing: 18) {
                        Button(action: { onSearchTap?() }) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(.white.opacity(0.85))
                        }
                        .accessibilityLabel("Search children and families")
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "bell.fill")
                                .font(.system(size: 20))
                                .foregroundColor(.white.opacity(0.85))
                            Circle()
                                .fill(Color.cfAccent)
                                .frame(width: 8, height: 8)
                                .offset(x: 2, y: -2)
                        }
                        Button(action: { onMenuTap?() }) {
                            Image(systemName: "line.3.horizontal")
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(.white.opacity(0.85))
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
    }
}

// MARK: - Quick Actions

struct QuickActionsRow: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            CFSectionHeader(title: "Quick Actions")
            HStack(spacing: 10) {
                NavigationLink(destination: AttendanceView()) {
                    QuickActionChip(label: "Attendance", icon: "checkmark.circle.fill", color: .cfAttendance)
                }
                NavigationLink(destination: MessagingView()) {
                    QuickActionChip(label: "Log Contact", icon: "phone.fill", color: .cfPrimary)
                }
                NavigationLink(destination: HealthView()) {
                    QuickActionChip(label: "Health", icon: "heart.fill", color: .cfHealth)
                }
                Spacer()
            }
            .buttonStyle(.plain)
        }
    }
}

struct QuickActionChip: View {
    let label: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
            Text(label)
                .font(.cfCaption2)
                .fontWeight(.semibold)
        }
        .foregroundColor(color)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(color.opacity(0.1))
        .clipShape(Capsule())
        .overlay {
            Capsule()
                .strokeBorder(color.opacity(0.2), lineWidth: 1)
        }
    }
}

// MARK: - Supporting Models

struct CaseloadChild: Identifiable {
    let id: String
    let firstName: String
    let lastName: String
    let attendanceStatus: AttendanceStatus

    var initials: String {
        let f = firstName.prefix(1)
        let l = lastName.prefix(1)
        return "\(f)\(l)"
    }

    enum AttendanceStatus { case present, absent, unknown }
}

struct DashboardTask: Identifiable {
    let id: String
    let title: String
    let dueLabel: String
    let urgency: Urgency
    let destination: TaskDestination

    enum Urgency { case overdue, today, upcoming }

    enum TaskDestination {
        case familyServices
        /// Deep link to a specific family's detail screen, opened on the tab
        /// where the task lives (FNA, CFCR, contacts, …). `name` is matched
        /// against the family name, case-insensitively.
        case family(name: String, tab: FamilyDetailTab)
        case health
        case healthCompliance
        case healthCategory(HealthCategory)
        /// Deep link to one child's record within a health category — lands on
        /// the record detail itself (worst status first if the child has
        /// several), falling back to the category list if none match.
        case healthRecord(childName: String, category: HealthCategory)
        /// Deep link to a family's pending e-sign document — lands on the sign
        /// screen itself, falling back to the E-Signatures list if none match.
        case documentSign(familyName: String, documentType: String? = nil)
        case documents
        case attendance
        case chronicAbsence
        case messages
    }
}

struct AgendaEvent: Identifiable {
    let id: String
    let timeLabel: String
    let title: String
    let subtitle: String?
    let color: Color
    var destination: DashboardTask.TaskDestination = .familyServices
}

// MARK: - Alert Link Row
// Program alerts navigate to the module that owns the flagged work:
// attendance alerts → attendance success plans, health → health records,
// compliance → compliance dashboard. Unknown types render as a plain row.

struct AlertLinkRow: View {
    let alert: ProgramAlert

    @ViewBuilder
    private var destination: some View {
        switch alert.type {
        case "attendance": AttendancePlansView()
        // Server sends the status filter that matters most ("Overdue" before
        // "Due Soon"), so the alert lands on the records needing action.
        case "health":     HealthView(initialStatusFilter: alert.filter)
        case "compliance": ComplianceView()
        case "message":    MessagingView()
        case "document":   DocumentsView()
        case "absence":    AbsenceReportsView()
        default:           EmptyView()
        }
    }

    private var isNavigable: Bool {
        ["attendance", "health", "compliance", "message", "document", "absence"].contains(alert.type)
    }

    var body: some View {
        if isNavigable {
            NavigationLink(destination: destination) {
                CFAlertRow(alert: alert, showsChevron: true)
            }
            .buttonStyle(.plain)
        } else {
            CFAlertRow(alert: alert)
        }
    }
}

// MARK: - All Tasks View
// Full task list behind the "View all N tasks" link.

struct AllTasksView: View {
    let tasks: [DashboardTask]

    var body: some View {
        List(tasks) { task in
            DashboardTaskRow(task: task)
                .listRowBackground(Color.cfSurface)
        }
        .listStyle(.insetGrouped)
        .background(Color.cfBackground)
        .navigationTitle("Pending Tasks")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Task Destination Resolver
// Single place that maps a TaskDestination to its screen; used by both the
// pending-task rows and the agenda rows.

struct TaskDestinationView: View {
    let destination: DashboardTask.TaskDestination

    var body: some View {
        switch destination {
        case .familyServices:                FamilyServicesView()
        case .family(let name, let tab):     FamilyLaunchView(familyName: name, tab: tab)
        case .health:                        HealthView()
        case .healthCompliance:              HealthComplianceView()
        case .healthCategory(let category):  HealthCategoryLaunchView(category: category)
        case .healthRecord(let child, let category):
                                             HealthRecordLaunchView(childName: child, category: category)
        case .documentSign(let family, let type):
                                             DocumentSignLaunchView(familyName: family, documentType: type)
        case .documents:                     DocumentsView()
        case .attendance:                    AttendanceView()
        case .chronicAbsence:               ChronicAbsenceView()
        case .messages:                      MessagingView()
        }
    }
}

// MARK: - Health Category Launch View
// Self-contained wrapper so task rows can push directly to a health category

struct HealthCategoryLaunchView: View {
    let category: HealthCategory
    @StateObject private var viewModel = HealthViewModel()

    var body: some View {
        HealthCategoryDetailView(category: category, viewModel: viewModel)
            .task { await viewModel.load() }
    }
}

// MARK: - Health Record Launch View
// Resolves one child's record in a category and lands directly on its detail,
// so "Schedule Jason Chen dental screening" opens Jason's dental record — not
// the whole dental list. If the child has several records in the category, the
// most urgent wins; if none match, falls back to the category list.

struct HealthRecordLaunchView: View {
    let childName: String
    let category: HealthCategory

    @StateObject private var viewModel = HealthViewModel()
    @State private var isLoading = true

    private var match: HealthRecord? {
        let statusRank: [String: Int] = ["Overdue": 0, "Due Soon": 1, "Current": 2]
        return viewModel.records(for: category)
            .filter { $0.childName.localizedCaseInsensitiveContains(childName) }
            .min { (statusRank[$0.status] ?? 3) < (statusRank[$1.status] ?? 3) }
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let record = match {
                HealthRecordDetailView(record: record, viewModel: viewModel)
            } else {
                HealthCategoryDetailView(category: category, viewModel: viewModel)
            }
        }
        .task {
            await viewModel.load()
            isLoading = false
        }
    }
}

// MARK: - Family Launch View
// Resolves a family by name and pushes straight to the relevant detail tab,
// so a task like "Complete FNA — Rodriguez family" lands on that family's FNA.
// Falls back to the family list if the name can't be matched.

struct FamilyLaunchView: View {
    let familyName: String
    let tab: FamilyDetailTab

    @State private var family: Family?
    @State private var isLoading = true

    var body: some View {
        Group {
            if let family {
                FamilyDetailView(family: family, initialTab: tab)
            } else if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                FamilyServicesView()
            }
        }
        .task {
            var families: [Family] = []
            do {
                families = try await APIClient.shared.getFamilies()
            } catch {
                #if DEBUG
                families = MockData.families
                #endif
            }
            family = families.first {
                $0.name.localizedCaseInsensitiveContains(familyName)
            }
            isLoading = false
        }
    }
}

// MARK: - ViewModel

@MainActor
class DashboardViewModel: ObservableObject {
    @Published var alerts: [ProgramAlert] = []
    @Published var isLoading = false

    // Inbox
    @Published var unreadMessageCount = 0
    @Published var lastMessagePreview = ""

    // Documents
    @Published var totalDocumentCount = 0
    @Published var pendingDocumentCount = 0

    // Caseload
    @Published var myCaseload: [CaseloadChild] = []

    // Tasks
    @Published var pendingTasks: [DashboardTask] = []

    // Agenda
    @Published var todayAgenda: [AgendaEvent] = []

    func load() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let data = try await APIClient.shared.getDashboardStats()
            alerts = data.alerts
            myCaseload = data.caseload.map { item in
                CaseloadChild(id: item.id, firstName: item.firstName, lastName: item.lastName,
                               attendanceStatus: Self.attendanceStatus(from: item.attendanceStatus))
            }
            pendingTasks = data.tasks.map(Self.dashboardTask(from:))
            todayAgenda = data.agenda.map(Self.agendaEvent(from:))
            if let inbox = data.inbox {
                unreadMessageCount = inbox.unreadMessageCount
                lastMessagePreview = inbox.lastMessagePreview
            }
            if let documents = data.documents {
                totalDocumentCount = documents.totalDocumentCount
                pendingDocumentCount = documents.pendingDocumentCount
            }
        } catch {
            // Server unreachable / decode failure — demo mode only, never in a
            // real build, so a real user never sees fabricated names on a real
            // account.
            #if DEBUG
            loadMockData()
            #endif
        }
    }

    private static func attendanceStatus(from raw: String) -> CaseloadChild.AttendanceStatus {
        switch raw {
        case "present": return .present
        case "absent":  return .absent
        default:        return .unknown
        }
    }

    private static func familyTab(from raw: String?) -> FamilyDetailTab {
        switch raw {
        case "contacts": return .contacts
        case "goals":    return .goals
        case "fna":      return .fna
        case "cfcr":     return .cfcr
        case "notes":    return .notes
        case "moments":  return .moments
        default:         return .overview
        }
    }

    private static func urgency(from raw: String) -> DashboardTask.Urgency {
        switch raw {
        case "overdue": return .overdue
        case "today":   return .today
        default:        return .upcoming
        }
    }

    private static func dashboardTask(from dto: DashboardTaskItemDTO) -> DashboardTask {
        let destination: DashboardTask.TaskDestination
        switch dto.type {
        case "documentSign":
            destination = .documentSign(familyName: dto.familyName ?? "", documentType: dto.documentType)
        case "healthRecord":
            if let category = dto.category.flatMap(HealthCategory.init(rawValue:)) {
                destination = .healthRecord(childName: dto.childName ?? "", category: category)
            } else {
                destination = .health
            }
        case "family":
            destination = .family(name: dto.familyName ?? "", tab: familyTab(from: dto.tab))
        case "attendance":
            destination = .attendance
        default:
            destination = .familyServices
        }
        return DashboardTask(id: dto.id, title: dto.title, dueLabel: dto.dueLabel,
                              urgency: urgency(from: dto.urgency), destination: destination)
    }

    private static func agendaEvent(from dto: DashboardAgendaItemDTO) -> AgendaEvent {
        let color: Color
        switch dto.colorType {
        case "parent_event":   color = .cfGoals
        case "staff_training": color = .cfChildren
        case "deadline":       color = .cfHealth
        case "holiday":        color = .cfAttendance
        default:                color = .cfPrimary
        }
        let destination: DashboardTask.TaskDestination = dto.type == "messages" ? .messages : .familyServices
        return AgendaEvent(id: dto.id, timeLabel: dto.timeLabel, title: dto.title,
                            subtitle: dto.subtitle, color: color, destination: destination)
    }

    private func loadMockData() {
        unreadMessageCount = 3
        lastMessagePreview = "Maria G: Thanks for the update on…"

        totalDocumentCount = 7
        pendingDocumentCount = 2

        myCaseload = [
            CaseloadChild(id: "c1", firstName: "Sofia",   lastName: "Martinez",  attendanceStatus: .present),
            CaseloadChild(id: "c2", firstName: "Jason",   lastName: "Chen",      attendanceStatus: .absent),
            CaseloadChild(id: "c3", firstName: "Aaliyah", lastName: "Johnson",   attendanceStatus: .present),
            CaseloadChild(id: "c4", firstName: "Marcus",  lastName: "Williams",  attendanceStatus: .present),
            CaseloadChild(id: "c5", firstName: "Lily",    lastName: "Torres",    attendanceStatus: .unknown),
            CaseloadChild(id: "c6", firstName: "Noah",    lastName: "Patel",     attendanceStatus: .present),
        ]

        // Each task deep-links to the screen where it gets done. Names match
        // MockData families/children so the links resolve in demo mode too.
        pendingTasks = [
            DashboardTask(id: "t1", title: "Sign Sofia Johnson's IEP",              dueLabel: "Due today",  urgency: .today,    destination: .documentSign(familyName: "Johnson", documentType: "iep")),
            DashboardTask(id: "t2", title: "Complete FNA — Rodriguez family",        dueLabel: "Due Jun 12", urgency: .upcoming, destination: .family(name: "Rodriguez", tab: .fna)),
            DashboardTask(id: "t3", title: "Schedule Jason Chen dental screening",   dueLabel: "Overdue",    urgency: .overdue,  destination: .healthRecord(childName: "Jason Chen", category: .dental)),
            DashboardTask(id: "t4", title: "Upload Aaliyah's immunization record",   dueLabel: "Due Jun 15", urgency: .upcoming, destination: .healthRecord(childName: "Aaliyah", category: .immunizations)),
            DashboardTask(id: "t5", title: "Review Marcus Williams CFCR",            dueLabel: "Due Jun 18", urgency: .upcoming, destination: .family(name: "Williams", tab: .cfcr)),
        ]

        todayAgenda = [
            AgendaEvent(id: "e1", timeLabel: "9:30",  title: "Home Visit — Johnson Family",  subtitle: "Maria & Sofia Johnson",  color: .cfPrimary,   destination: .family(name: "Johnson", tab: .contacts)),
            AgendaEvent(id: "e2", timeLabel: "11:00", title: "Staff Team Meeting",            subtitle: "Room 102 · All staff",   color: .cfChildren,  destination: .messages),
            AgendaEvent(id: "e3", timeLabel: "2:00",  title: "Parent Conference — Williams",  subtitle: "Marcus Williams family", color: .cfGoals,     destination: .family(name: "Williams", tab: .contacts)),
        ]
    }
}
