import SwiftUI

// MARK: - Timesheet View (Admin)

struct TimesheetView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = TimesheetViewModel()

    var body: some View {
        // Defense in depth: this screen approves staff hours, so it refuses to
        // render for non-admins even if reached through an ungated path.
        if !appState.isAdmin {
            VStack(spacing: 10) {
                Image(systemName: "lock.fill")
                    .font(.largeTitle)
                    .foregroundColor(.secondary)
                Text("Administrator access required")
                    .font(.headline)
                Text("Timesheet review and approval is limited to program administrators.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding()
        } else {
            timesheetContent
        }
    }

    private var timesheetContent: some View {
        NavigationStack {
            ZStack {
                Color.cfBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // Summary stats
                        TimesheetSummaryHeader(viewModel: viewModel)

                        // Flags banner
                        if viewModel.totalFlagged > 0 {
                            HStack(spacing: 10) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.cfHealth)
                                Text("\(viewModel.totalFlagged) entr\(viewModel.totalFlagged == 1 ? "y needs" : "ies need") attention")
                                    .font(.cfSubheadline)
                                    .foregroundColor(.cfHealth)
                                Spacer()
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .background(Color.cfHealthBg)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .padding(.horizontal, 16)
                        }

                        // Staff timesheets
                        ForEach(viewModel.weeks) { week in
                            StaffTimesheetCard(week: week, viewModel: viewModel)
                        }

                        Spacer(minLength: 32)
                    }
                    .padding(.top, 16)
                }
            }
            .navigationTitle("Timesheets")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button {
                            viewModel.filter = .all
                        } label: {
                            Label("All Staff", systemImage: "person.3")
                        }
                        Button {
                            viewModel.filter = .pending
                        } label: {
                            Label("Pending Review", systemImage: "clock.badge.questionmark")
                        }
                        Button {
                            viewModel.filter = .flagged
                        } label: {
                            Label("Flagged", systemImage: "exclamationmark.triangle")
                        }
                    } label: {
                        Image(systemName: viewModel.filter == .all
                              ? "line.3.horizontal.decrease.circle"
                              : "line.3.horizontal.decrease.circle.fill")
                        .foregroundColor(.cfPrimary)
                    }
                }
            }
            .task { await viewModel.load() }
        }
    }
}

// MARK: - Summary Header

struct TimesheetSummaryHeader: View {
    @ObservedObject var viewModel: TimesheetViewModel

    var body: some View {
        HStack(spacing: 12) {
            TimesheetStatPill(value: "\(viewModel.weeks.count)", label: "Staff", color: .cfChildren)
            TimesheetStatPill(value: "\(viewModel.totalPending)", label: "Pending", color: .cfFamily)
            TimesheetStatPill(value: "\(viewModel.totalFlagged)", label: "Flagged", color: .cfHealth)
            TimesheetStatPill(value: viewModel.totalHoursDisplay, label: "Total Hrs", color: .cfCompliance)
        }
        .padding(.horizontal, 16)
    }
}

struct TimesheetStatPill: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.cfTitle2)
                .fontWeight(.bold)
                .foregroundColor(color)
                .monospacedDigit()
            Text(label)
                .font(.cfCaption2)
                .foregroundColor(.cfTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .cfSubtleShadow()
    }
}

// MARK: - Staff Timesheet Card

struct StaffTimesheetCard: View {
    let week: TimesheetWeek
    @ObservedObject var viewModel: TimesheetViewModel
    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: 0) {
            // Header row
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
            } label: {
                HStack(spacing: 12) {
                    // Avatar
                    Circle()
                        .fill(Color.cfPrimaryLight)
                        .frame(width: 40, height: 40)
                        .overlay {
                            Text(week.staffName.split(separator: " ").compactMap { $0.first }.map(String.init).joined().prefix(2))
                                .font(.cfSubheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(.cfPrimary)
                        }

                    VStack(alignment: .leading, spacing: 3) {
                        Text(week.staffName)
                            .font(.cfSubheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.cfTextPrimary)

                        HStack(spacing: 6) {
                            Text(week.totalHoursString + " hrs")
                                .font(.cfCaption)
                                .foregroundColor(.cfTextSecondary)
                                .monospacedDigit()
                            if week.pendingCount > 0 {
                                CFBadge(label: "\(week.pendingCount) pending", color: .cfFamily)
                            }
                            if week.flaggedCount > 0 {
                                CFBadge(label: "\(week.flaggedCount) flagged", color: .cfHealth)
                            }
                        }
                    }

                    Spacer()

                    // Overtime indicator
                    if week.overtimeMinutes > 0 {
                        VStack(spacing: 1) {
                            Text("OT")
                                .font(.cfCaption2)
                                .fontWeight(.bold)
                                .foregroundColor(.cfHealth)
                            Text(String(format: "+%d:%02d",
                                        week.overtimeMinutes / 60,
                                        week.overtimeMinutes % 60))
                                .font(.cfCaption2)
                                .foregroundColor(.cfHealth)
                                .monospacedDigit()
                        }
                    }

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.cfTextSecondary)
                }
                .padding(16)
            }
            .buttonStyle(.plain)

            // Expanded entries
            if isExpanded {
                Divider().padding(.horizontal)

                ForEach(week.entries) { entry in
                    AdminEntryRow(entry: entry, viewModel: viewModel)
                    if entry.id != week.entries.last?.id {
                        Divider().padding(.leading, 16)
                    }
                }
            }
        }
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay {
            if week.flaggedCount > 0 {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(Color.cfHealth.opacity(0.25), lineWidth: 1)
            }
        }
        .cfCardShadow()
        .padding(.horizontal, 16)
    }
}

// MARK: - Admin Entry Row

struct AdminEntryRow: View {
    let entry: TimeEntry
    @ObservedObject var viewModel: TimesheetViewModel
    @State private var showFlagSheet = false
    @State private var flagNote = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                // Day
                VStack(spacing: 1) {
                    Text(entry.clockIn.formatted(.dateTime.weekday(.abbreviated)).uppercased())
                        .font(.cfCaption2)
                        .foregroundColor(.cfTextSecondary)
                    Text(entry.clockIn.formatted(.dateTime.day()))
                        .font(.cfHeadline)
                        .foregroundColor(.cfTextPrimary)
                }
                .frame(width: 32)

                VStack(alignment: .leading, spacing: 3) {
                    Text("\(entry.clockIn.formatted(.dateTime.hour().minute())) – \(entry.clockOut.map { $0.formatted(.dateTime.hour().minute()) } ?? "Missing")")
                        .font(.cfBody)
                        .foregroundColor(entry.status == .missedOut ? .cfHealth : .cfTextPrimary)

                    HStack(spacing: 4) {
                        Image(systemName: entry.status.icon)
                            .font(.system(size: 11))
                        Text(entry.status.rawValue)
                            .font(.cfCaption)
                    }
                    .foregroundColor(entry.status.color)
                }

                Spacer()

                Text(entry.totalHoursString)
                    .font(.cfSubheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.cfTextPrimary)
                    .monospacedDigit()
            }

            // Admin note
            if let note = entry.adminNote {
                HStack(spacing: 6) {
                    Image(systemName: "bubble.left.fill")
                        .font(.system(size: 10))
                    Text(note)
                        .font(.cfCaption)
                        .lineLimit(2)
                }
                .foregroundColor(.cfHealth)
                .padding(.leading, 44)
            }

            // Action buttons for non-approved entries
            if entry.status == .pending || entry.status == .flagged || entry.status == .missedOut {
                HStack(spacing: 8) {
                    Spacer().frame(width: 44)

                    Button {
                        Task { await viewModel.approve(entry) }
                    } label: {
                        Label("Approve", systemImage: "checkmark.circle.fill")
                            .font(.cfCaption2)
                            .fontWeight(.semibold)
                            .foregroundColor(.cfAttendance)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.cfAttendanceBg)
                            .clipShape(Capsule())
                    }

                    Button {
                        showFlagSheet = true
                    } label: {
                        Label("Flag", systemImage: "exclamationmark.triangle.fill")
                            .font(.cfCaption2)
                            .fontWeight(.semibold)
                            .foregroundColor(.cfHealth)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.cfHealthBg)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .sheet(isPresented: $showFlagSheet) {
            FlagEntrySheet(entry: entry, note: $flagNote) { note in
                Task { await viewModel.flag(entry, note: note) }
            }
        }
    }
}

// MARK: - Flag Sheet

struct FlagEntrySheet: View {
    let entry: TimeEntry
    @Binding var note: String
    let onFlag: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Shift: \(entry.clockIn.formatted(.dateTime.weekday(.wide).month().day())) · \(entry.totalHoursString) hrs")
                    .font(.cfBody)
                    .foregroundColor(.cfTextSecondary)

                TextEditor(text: $note)
                    .frame(minHeight: 100)
                    .font(.cfBody)
                    .padding(8)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                Spacer()
            }
            .padding()
            .navigationTitle("Flag Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Flag") {
                        onFlag(note)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(.cfHealth)
                    .disabled(note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - ViewModel

@MainActor
class TimesheetViewModel: ObservableObject {
    @Published var weeks: [TimesheetWeek] = []
    @Published var filter: Filter = .all
    @Published var isLoading = false

    enum Filter { case all, pending, flagged }

    var totalPending: Int {
        weeks.reduce(0) { $0 + $1.pendingCount }
    }

    var totalFlagged: Int {
        weeks.reduce(0) { $0 + $1.flaggedCount }
    }

    var totalHoursDisplay: String {
        let mins = weeks.reduce(0) { $0 + $1.totalMinutes }
        return String(format: "%d:%02d", mins / 60, mins % 60)
    }

    func load() async {
        isLoading = true
        do {
            let allWeeks = try await APIClient.shared.getAllTimesheets()
            applyFilter(allWeeks)
        } catch {
            #if DEBUG
            applyFilter(MockData.timesheetWeeks)
            #endif
        }
        isLoading = false
    }

    private func applyFilter(_ allWeeks: [TimesheetWeek]) {
        switch filter {
        case .all:
            weeks = allWeeks
        case .pending:
            weeks = allWeeks.filter { $0.pendingCount > 0 }
        case .flagged:
            weeks = allWeeks.filter { $0.flaggedCount > 0 }
        }
    }

    func approve(_ entry: TimeEntry) async {
        do {
            let updated = try await APIClient.shared.approveEntry(entryId: entry.id)
            updateEntry(updated)
        } catch {
            #if DEBUG
            updateEntryStatus(entryId: entry.id, status: .approved)
            #endif
        }
    }

    func flag(_ entry: TimeEntry, note: String) async {
        do {
            let updated = try await APIClient.shared.flagEntry(entryId: entry.id, note: note)
            updateEntry(updated)
        } catch {
            #if DEBUG
            updateEntryStatus(entryId: entry.id, status: .flagged, note: note)
            #endif
        }
    }

    private func updateEntry(_ updated: TimeEntry) {
        for wi in weeks.indices {
            if let ei = weeks[wi].entries.firstIndex(where: { $0.id == updated.id }) {
                weeks[wi].entries[ei] = updated
            }
        }
    }

    private func updateEntryStatus(entryId: String, status: TimeEntry.EntryStatus, note: String? = nil) {
        for wi in weeks.indices {
            if let ei = weeks[wi].entries.firstIndex(where: { $0.id == entryId }) {
                let e = weeks[wi].entries[ei]
                weeks[wi].entries[ei] = TimeEntry(
                    id: e.id, staffId: e.staffId, staffName: e.staffName,
                    clockIn: e.clockIn, clockOut: e.clockOut,
                    breaks: e.breaks, status: status, adminNote: note ?? e.adminNote
                )
            }
        }
    }
}
