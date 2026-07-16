import SwiftUI

struct FamilyHomeView: View {
    @EnvironmentObject var appState: FamilyAppState
    @StateObject private var viewModel = FamilyHomeViewModel()
    @State private var showReportAbsence = false
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // School open/closed today
                    if let status = viewModel.schoolStatus {
                        SchoolStatusBanner(status: status)
                            .padding(.horizontal)
                            .padding(.top, 8)
                    }

                    // Greeting
                    if let profile = appState.familyProfile {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(L(.helloFmt, profile.fullName.split(separator: " ").first.map(String.init) ?? profile.fullName))
                                    .font(.title2.bold())
                                Text(L(.childUpdateSubtitle))
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                        .padding(.horizontal)
                    }

                    // Report an absence — the most common reason a parent
                    // opens this app on a school morning.
                    Button {
                        showReportAbsence = true
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "calendar.badge.minus")
                                .font(.system(size: 18, weight: .semibold))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(L(.childNotComing))
                                    .font(.subheadline.weight(.semibold))
                                Text(L(.reportAbsenceSubtitle))
                                    .font(.caption2)
                                    .opacity(0.85)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundColor(.white)
                        .padding(14)
                        .background(Color.accentColor)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .padding(.horizontal)

                    if let loadErrorMessage = viewModel.loadErrorMessage {
                        Label(loadErrorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.caption)
                            .foregroundColor(.orange)
                            .padding(.horizontal)
                    }

                    // Child cards
                    if viewModel.isLoading {
                        ProgressView().padding(.top, 40)
                    } else {
                        ForEach(viewModel.children) { child in
                            FamilyChildCard(
                                child: child,
                                today: viewModel.today(for: child.id),
                                busy: viewModel.busyChildId == child.id,
                                onCheckIn: { Task { await viewModel.checkIn(child.id) } },
                                onCheckOut: { Task { await viewModel.checkOut(child.id) } }
                            )
                            .padding(.horizontal)
                        }
                    }

                    // Recent absence reports + their review status
                    if !viewModel.absences.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(L(.absenceReports))
                                .font(.headline)
                                .padding(.horizontal)
                            ForEach(viewModel.absences.prefix(3)) { report in
                                AbsenceReportRow(report: report)
                                    .padding(.horizontal)
                            }
                        }
                    }

                    // Notifications
                    if !viewModel.notifications.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(L(.notifications))
                                .font(.headline)
                                .padding(.horizontal)
                            ForEach(viewModel.notifications.prefix(5)) { note in
                                NotificationRow(notification: note)
                                    .padding(.horizontal)
                            }
                        }
                    }

                    // Upcoming events
                    if !viewModel.upcomingEvents.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(L(.upcoming))
                                .font(.headline)
                                .padding(.horizontal)

                            ForEach(viewModel.upcomingEvents) { event in
                                UpcomingEventRow(event: event)
                                    .padding(.horizontal)
                            }
                        }
                    }
                }
                .padding(.bottom, 24)
            }
            .navigationTitle(L(.tabHome))
            .refreshable { await viewModel.load() }
            .task { await viewModel.load() }
            .sheet(isPresented: $showReportAbsence) {
                ReportAbsenceSheet(children: appState.familyProfile?.children ?? viewModel.profileChildren) {
                    await viewModel.load()
                }
            }
            .alert("Couldn't Update Check-In", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: { Text(viewModel.errorMessage ?? "") }
        }
    }
}

// MARK: - School Status Banner

struct SchoolStatusBanner: View {
    let status: SchoolStatus

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: status.isOpen ? "checkmark.circle.fill" : "xmark.octagon.fill")
                .font(.system(size: 20))
            VStack(alignment: .leading, spacing: 1) {
                Text(status.label)
                    .font(.subheadline.weight(.semibold))
                if let title = status.nextClosureTitle, let date = status.nextClosureDate {
                    Text(L(.nextClosureFmt, "\(title) · \(date.formatted(.dateTime.month(.abbreviated).day()))"))
                        .font(.caption2)
                        .opacity(0.8)
                }
            }
            Spacer()
        }
        .foregroundColor(status.isOpen ? .green : .red)
        .padding(12)
        .background((status.isOpen ? Color.green : Color.red).opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Absence Report Row

struct AbsenceReportRow: View {
    let report: AbsenceReport

    var statusColor: Color {
        switch report.status {
        case "approved": return .green
        case "denied":   return .red
        default:         return .orange
        }
    }

    var statusLabel: String {
        switch report.status {
        case "approved": return L(.approved)
        case "denied":   return L(.seeAdvocate)
        default:         return L(.pendingReview)
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar.badge.minus")
                .foregroundColor(.secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(report.childName) · \(report.date.formatted(.dateTime.month(.abbreviated).day()))")
                    .font(.subheadline.weight(.medium))
                Text(report.reasonLabel + (report.note.isEmpty ? "" : " — \(report.note)"))
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(statusLabel)
                .font(.caption2.weight(.semibold))
                .foregroundColor(statusColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(statusColor.opacity(0.12))
                .clipShape(Capsule())
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Notification Row

struct NotificationRow: View {
    let notification: ParentNotification

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "bell.fill")
                    .foregroundColor(.accentColor)
                if !notification.isRead {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                        .offset(x: 4, y: -3)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(notification.message)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
                Text(notification.createdAt, style: .relative)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Report Absence Sheet

struct ReportAbsenceSheet: View {
    let children: [FamilyChild]
    let onSubmitted: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedChildId: String = ""
    @State private var date = Date()
    @State private var reason = "sick"
    @State private var note = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    @ObservedObject private var l10n = FamilyL10n.shared

    private var reasons: [(String, String)] {
        [
            ("sick", L(.reasonIllness)),
            ("appointment", L(.reasonAppointment)),
            ("family_emergency", L(.reasonEmergency)),
            ("transportation", L(.reasonTransportation)),
            ("travel", L(.reasonTravel)),
            ("other", L(.reasonOther)),
        ]
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(L(.whoStayingHome)) {
                    if children.isEmpty {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text(L(.loadingChildren))
                                .font(.footnote)
                                .foregroundColor(.secondary)
                        }
                    } else {
                        Picker(L(.childLabel), selection: $selectedChildId) {
                            ForEach(children) { child in
                                Text(child.fullName).tag(child.id)
                            }
                        }
                    }
                }
                Section(L(.whenAndWhy)) {
                    DatePicker(L(.dateLabel), selection: $date, in: Date()..., displayedComponents: .date)
                    Picker(L(.reasonLabel), selection: $reason) {
                        ForEach(reasons, id: \.0) { value, label in
                            Text(label).tag(value)
                        }
                    }
                    TextField(L(.addNoteOptional), text: $note, axis: .vertical)
                        .lineLimit(2...4)
                }
                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
                Section {
                    Button {
                        submit()
                    } label: {
                        if isSubmitting {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text(L(.sendToAdvocate))
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isSubmitting || selectedChildId.isEmpty)
                } footer: {
                    Text(L(.absenceFooter))
                }
            }
            .navigationTitle(L(.reportAbsence))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(L(.cancel)) { dismiss() }
                }
            }
            .onAppear {
                if selectedChildId.isEmpty { selectedChildId = children.first?.id ?? "" }
            }
            // The sheet can open before the family's children list has
            // finished loading (right after login, or on a slow connection),
            // in which case `.onAppear` ran with an empty `children` array
            // and never re-fired once the real list arrived — leaving the
            // submit button permanently disabled with no explanation. Watch
            // for the list actually populating and pick a default then too.
            .onChange(of: children.count) { _, newCount in
                if selectedChildId.isEmpty && newCount > 0 {
                    selectedChildId = children.first?.id ?? ""
                }
            }
        }
    }

    private func submit() {
        isSubmitting = true
        errorMessage = nil
        Task {
            do {
                _ = try await APIClient.shared.reportAbsence(
                    childId: selectedChildId, date: date, reason: reason, note: note
                )
                await onSubmitted()
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isSubmitting = false
                }
            }
        }
    }
}

// MARK: - Child Card

struct FamilyChildCard: View {
    let child: FamilyChild
    var today: FamilyAttendanceToday? = nil
    var busy: Bool = false
    var onCheckIn: () -> Void = {}
    var onCheckOut: () -> Void = {}
    @State private var expanded = true

    private func timeStr(_ d: Date?) -> String {
        guard let d else { return "" }
        return d.formatted(.dateTime.hour().minute())
    }

    private var stateKey: String {
        "\(today?.checkInTime != nil)-\(today?.checkOutTime != nil)"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            Button(action: { withAnimation { expanded.toggle() } }) {
                HStack(spacing: 12) {
                    Circle()
                        .fill(Color.accentColor.opacity(0.15))
                        .frame(width: 48, height: 48)
                        .overlay {
                            Text(child.initials)
                                .font(.headline)
                                .foregroundColor(.accentColor)
                        }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(child.fullName)
                            .font(.headline)
                            .foregroundColor(.primary)
                        Text(child.classroom)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
            }

            if expanded {
                Divider()

                // Drop-off / pickup — the parent's most frequent action, big and obvious.
                checkInOutControl
                    .padding(.horizontal)
                    .padding(.vertical, 12)
                    .animation(.spring(response: 0.45, dampingFraction: 0.85), value: stateKey)

                Divider()

                // Stats row
                HStack(spacing: 0) {
                    ChildStatCell(label: L(.attendance), value: "\(child.attendanceRate)%",
                                  color: child.attendanceRate >= 90 ? .green : .orange)
                    Divider().frame(height: 44)
                    ChildStatCell(label: L(.health), value: child.healthStatus,
                                  color: healthColor(child.healthStatus))
                    Divider().frame(height: 44)
                    ChildStatCell(label: L(.statusWord), value: child.enrollmentStatus, color: .blue)
                }

                Divider()

                // Teacher info
                HStack(spacing: 8) {
                    Image(systemName: "person.fill")
                        .foregroundColor(.secondary)
                        .font(.caption)
                    Text(L(.teacherFmt, child.teacher))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 10)

                if let nextEvent = child.nextEvent {
                    Divider()
                    HStack(spacing: 8) {
                        Image(systemName: "calendar.badge.clock")
                            .foregroundColor(.accentColor)
                            .font(.caption)
                        Text(L(.nextFmt, nextEvent))
                            .font(.subheadline)
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 10)
                }
            }
        }
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    @ViewBuilder
    private var checkInOutControl: some View {
        let checkedIn = today?.isCheckedIn ?? false
        let checkedOut = today?.isCheckedOut ?? false

        if checkedOut {
            // Done for the day — calm confirmation, no further action.
            HStack(spacing: 10) {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundColor(.green)
                    .font(.title3)
                VStack(alignment: .leading, spacing: 1) {
                    Text(L(.pickedUpFmt, timeStr(today?.checkOutTime)))
                        .font(.subheadline.weight(.semibold))
                    Text(L(.droppedOffFmt, timeStr(today?.checkInTime)))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .transition(.opacity.combined(with: .move(edge: .top)))
        } else if checkedIn {
            HStack(spacing: 12) {
                HStack(spacing: 6) {
                    Circle().fill(Color.green).frame(width: 8, height: 8)
                    Text(L(.checkedInFmt, timeStr(today?.checkInTime)))
                        .font(.subheadline.weight(.medium))
                }
                Spacer()
                Button(action: onCheckOut) {
                    Group {
                        if busy { ProgressView().tint(.white) }
                        else { Label(L(.checkOut), systemImage: "arrow.up.right.square") }
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 9)
                    .background(Color(hex: "C96E47"))
                    .clipShape(Capsule())
                }
                .disabled(busy)
            }
            .transition(.opacity.combined(with: .move(edge: .top)))
        } else {
            Button(action: onCheckIn) {
                Group {
                    if busy { ProgressView().tint(.white) }
                    else { Label(L(.checkInFmt, child.firstName), systemImage: "checkmark.circle.fill") }
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.accentColor)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .disabled(busy)
            .transition(.opacity.combined(with: .move(edge: .top)))
        }
    }

    private func healthColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "current": return .green
        case "due soon": return .orange
        case "overdue": return .red
        default: return .gray
        }
    }
}

struct ChildStatCell: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(color)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
    }
}

// MARK: - Upcoming Event
// `FamilyEvent` is defined in Sources/Models/Models.swift (shared with the
// APIClient); only the display helpers live here.

extension FamilyEvent {
    var icon: String {
        switch type {
        case "homeVisit": return "house.fill"
        case "meeting": return "person.2.fill"
        case "health": return "heart.fill"
        default: return "calendar"
        }
    }

    var color: Color {
        switch type {
        case "homeVisit": return .blue
        case "meeting": return .purple
        case "health": return .red
        default: return .gray
        }
    }
}

struct UpcomingEventRow: View {
    let event: FamilyEvent

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8)
                .fill(event.color.opacity(0.12))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: event.icon)
                        .foregroundColor(event.color)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                    .font(.subheadline.weight(.medium))
                Text(event.date, style: .date)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Text(event.date, style: .relative)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - ViewModel

@MainActor
class FamilyHomeViewModel: ObservableObject {
    @Published var children: [FamilyChild] = []
    @Published var upcomingEvents: [FamilyEvent] = []
    @Published var schoolStatus: SchoolStatus?
    @Published var absences: [AbsenceReport] = []
    @Published var notifications: [ParentNotification] = []
    @Published var attendanceToday: [String: FamilyAttendanceToday] = [:]
    @Published var busyChildId: String? = nil
    @Published var isLoading = false
    @Published var errorMessage: String?
    /// Set when one or more of load()'s independent fetches failed. Every
    /// fetch below used `try?` with a silent fallback to the previous
    /// value — on this, the primary check-in screen, a parent whose
    /// connection dropped mid-morning would see yesterday's data with no
    /// indication anything was stale or wrong. This surfaces that instead
    /// of staying silent.
    @Published var loadErrorMessage: String?

    /// Children for the report-absence sheet when the profile isn't cached.
    var profileChildren: [FamilyChild] { children }

    func today(for childId: String) -> FamilyAttendanceToday? { attendanceToday[childId] }

    func load() async {
        isLoading = true
        var failures = 0
        // Each section loads independently; one failure shouldn't blank the
        // rest, but a run where everything (or the attendance check-in state
        // specifically) fails shouldn't look identical to a clean load.
        if let profile = try? await APIClient.shared.getFamilyProfile() {
            children = profile.children
        } else {
            failures += 1
        }
        if let events = try? await APIClient.shared.getFamilyEvents() {
            upcomingEvents = events
        } else {
            failures += 1
        }
        if let status = try? await APIClient.shared.getSchoolStatus() {
            schoolStatus = status
        } else {
            failures += 1
        }
        if let reports = try? await APIClient.shared.getFamilyAbsences() {
            absences = reports
        } else {
            failures += 1
        }
        if let notes = try? await APIClient.shared.getFamilyNotifications() {
            notifications = notes
        } else {
            failures += 1
        }
        let attendanceOk = await loadAttendance()
        if !attendanceOk { failures += 1 }
        loadErrorMessage = failures > 0
            ? "Some information couldn't be updated. What you see below may be out of date — pull down to try again."
            : nil
        isLoading = false
    }

    @discardableResult
    private func loadAttendance() async -> Bool {
        guard let rows = try? await APIClient.shared.getFamilyAttendanceToday() else { return false }
        attendanceToday = Dictionary(uniqueKeysWithValues: rows.map { ($0.childId, $0) })
        return true
    }

    func checkIn(_ childId: String) async {
        busyChildId = childId
        defer { busyChildId = nil }
        do {
            try await APIClient.shared.checkInChild(childId: childId)
            await loadAttendance()
        } catch {
            // Used to be `catch {}` — a failed check-in looked identical to a
            // successful one, since the button just did nothing either way.
            errorMessage = "Check-in didn't go through. Check your connection and try again."
        }
    }

    func checkOut(_ childId: String) async {
        busyChildId = childId
        defer { busyChildId = nil }
        do {
            try await APIClient.shared.checkOutChild(childId: childId)
            await loadAttendance()
        } catch {
            errorMessage = "Check-out didn't go through. Check your connection and try again."
        }
    }
}
