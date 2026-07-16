import SwiftUI

// MARK: - Clock In / Out Main View

struct ClockInView: View {
    @StateObject private var viewModel = ClockInViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.cfBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // Live clock card
                        ClockStatusCard(viewModel: viewModel)

                        // Today's shift summary
                        if let entry = viewModel.activeEntry ?? viewModel.todayCompletedEntry {
                            ShiftSummaryCard(entry: entry, isActive: viewModel.activeEntry != nil)
                        }

                        // This week strip
                        WeekSummaryStrip(viewModel: viewModel)

                        // Recent entries
                        if !viewModel.recentEntries.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                CFSectionHeader(title: "Recent Shifts")
                                    .padding(.horizontal)
                                ForEach(viewModel.recentEntries) { entry in
                                    ShiftEntryRow(entry: entry)
                                        .padding(.horizontal)
                                }
                            }
                        }

                        Spacer(minLength: 32)
                    }
                    .padding(.top, 16)
                }
            }
            .navigationTitle("My Timesheet")
            .navigationBarTitleDisplayMode(.large)
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}

// MARK: - Clock Status Card

struct ClockStatusCard: View {
    @ObservedObject var viewModel: ClockInViewModel

    var body: some View {
        VStack(spacing: 0) {
            // Header strip
            HStack {
                HStack(spacing: 6) {
                    Circle()
                        .fill(viewModel.isClockedIn ? Color.cfAttendance : Color.cfTextSecondary)
                        .frame(width: 8, height: 8)
                        .overlay {
                            if viewModel.isClockedIn {
                                Circle()
                                    .fill(Color.cfAttendance.opacity(0.3))
                                    .frame(width: 16, height: 16)
                            }
                        }
                    Text(viewModel.isClockedIn
                         ? (viewModel.isOnBreak ? "On Break" : "Clocked In")
                         : "Clocked Out")
                        .font(.cfSubheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(viewModel.isClockedIn ? .cfAttendance : .cfTextSecondary)
                }
                Spacer()
                if viewModel.isClockedIn, let entry = viewModel.activeEntry {
                    Text("Since \(entry.clockIn.formatted(.dateTime.hour().minute()))")
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 12)

            // Elapsed time
            Text(viewModel.elapsedDisplay)
                .font(.system(size: 56, weight: .bold, design: .rounded))
                .foregroundColor(.cfTextPrimary)
                .monospacedDigit()
                .padding(.bottom, 4)

            Text(viewModel.isClockedIn ? "hours worked today" : "not clocked in")
                .font(.cfCaption)
                .foregroundColor(.cfTextSecondary)
                .padding(.bottom, 24)

            // Action buttons
            VStack(spacing: 12) {
                if viewModel.isClockedIn {
                    // Break button
                    Button {
                        Task { await viewModel.toggleBreak() }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: viewModel.isOnBreak ? "play.fill" : "pause.fill")
                            Text(viewModel.isOnBreak ? "End Break" : "Start Break")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(viewModel.isOnBreak ? Color.cfAttendanceBg : Color.cfFamilyBg)
                        .foregroundColor(viewModel.isOnBreak ? .cfAttendance : .cfFamily)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay {
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(
                                    viewModel.isOnBreak ? Color.cfAttendance.opacity(0.3) : Color.cfFamily.opacity(0.3),
                                    lineWidth: 1
                                )
                        }
                    }
                    .disabled(viewModel.isLoading)

                    // Clock out
                    Button {
                        viewModel.showClockOutConfirm = true
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "stop.circle.fill")
                            Text("Clock Out")
                                .fontWeight(.bold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.cfHealth)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(viewModel.isLoading)

                } else {
                    // Clock in
                    Button {
                        Task { await viewModel.clockIn() }
                    } label: {
                        HStack(spacing: 10) {
                            if viewModel.isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Image(systemName: "play.circle.fill")
                                    .font(.system(size: 22))
                                Text("Clock In")
                                    .font(.system(size: 20, weight: .bold))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                        .background(
                            LinearGradient(
                                colors: [Color.cfPrimary, Color.cfPrimaryDark],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .shadow(color: Color.cfPrimary.opacity(0.4), radius: 10, y: 4)
                    }
                    .disabled(viewModel.isLoading)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .cfCardShadow()
        .padding(.horizontal, 16)
        .alert("Clock Out?", isPresented: $viewModel.showClockOutConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Clock Out", role: .destructive) {
                Task { await viewModel.clockOut() }
            }
        } message: {
            Text("This will end your current shift.")
        }
    }
}

// MARK: - Shift Summary Card

struct ShiftSummaryCard: View {
    let entry: TimeEntry
    let isActive: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            CFSectionHeader(title: isActive ? "Today's Shift" : "Last Shift")

            HStack(spacing: 0) {
                ShiftStat(label: "Clock In",
                          value: entry.clockIn.formatted(.dateTime.hour().minute()),
                          icon: "arrow.right.circle.fill", color: .cfAttendance)
                Divider().frame(height: 40)
                ShiftStat(label: "Clock Out",
                          value: entry.clockOut.map { $0.formatted(.dateTime.hour().minute()) } ?? "—",
                          icon: "arrow.left.circle.fill", color: isActive ? .cfTextSecondary : .cfHealth)
                Divider().frame(height: 40)
                ShiftStat(label: "Breaks",
                          value: "\(entry.breaks.filter { $0.endTime != nil }.count)",
                          icon: "pause.circle.fill", color: .cfFamily)
                Divider().frame(height: 40)
                ShiftStat(label: "Total",
                          value: entry.totalHoursString,
                          icon: "clock.fill", color: .cfChildren)
            }
        }
        .padding(16)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .cfCardShadow()
        .padding(.horizontal, 16)
    }
}

struct ShiftStat: View {
    let label: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(color)
            Text(value)
                .font(.cfSubheadline)
                .fontWeight(.semibold)
                .foregroundColor(.cfTextPrimary)
                .monospacedDigit()
            Text(label)
                .font(.cfCaption2)
                .foregroundColor(.cfTextSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Week Summary Strip

struct WeekSummaryStrip: View {
    @ObservedObject var viewModel: ClockInViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            CFSectionHeader(title: "This Week")
                .padding(.horizontal)

            HStack(spacing: 12) {
                WeekStatPill(label: "Hours", value: viewModel.weekHoursDisplay,
                             color: viewModel.weekMinutes >= 40*60 ? .cfCompliance : .cfChildren)
                WeekStatPill(label: "Days", value: "\(viewModel.daysWorked)",
                             color: .cfAttendance)
                WeekStatPill(label: "Overtime", value: viewModel.overtimeDisplay,
                             color: viewModel.weekMinutes > 40*60 ? .cfHealth : .cfTextSecondary)
            }
            .padding(.horizontal)
        }
    }
}

struct WeekStatPill: View {
    let label: String
    let value: String
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
        .padding(.vertical, 14)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .cfCardShadow()
    }
}

// MARK: - Shift Entry Row

struct ShiftEntryRow: View {
    let entry: TimeEntry

    var body: some View {
        HStack(spacing: 14) {
            // Day column
            VStack(spacing: 2) {
                Text(entry.clockIn.formatted(.dateTime.weekday(.abbreviated)))
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
                Text(entry.clockIn.formatted(.dateTime.day()))
                    .font(.cfHeadline)
                    .foregroundColor(.cfTextPrimary)
            }
            .frame(width: 36)

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text("\(entry.clockIn.formatted(.dateTime.hour().minute())) – \(entry.clockOut.map { $0.formatted(.dateTime.hour().minute()) } ?? "—")")
                        .font(.cfSubheadline)
                        .foregroundColor(.cfTextPrimary)
                    Spacer()
                    Text(entry.totalHoursString)
                        .font(.cfSubheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.cfTextPrimary)
                        .monospacedDigit()
                }

                HStack(spacing: 6) {
                    CFBadge(label: entry.status.rawValue, color: entry.status.color)
                    if !entry.breaks.isEmpty {
                        Text("\(entry.breaks.filter { $0.endTime != nil }.count) break\(entry.breaks.count == 1 ? "" : "s")")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    }
                }
            }
        }
        .padding(14)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay {
            if entry.status == .flagged || entry.status == .missedOut {
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.cfHealth.opacity(0.3), lineWidth: 1)
            }
        }
        .cfSubtleShadow()
    }
}

// MARK: - Dashboard Clock Widget (compact, embedded in Dashboard)

struct DashboardClockWidget: View {
    @ObservedObject var viewModel: ClockInViewModel

    var body: some View {
        NavigationLink(destination: ClockInView()) {
            HStack(spacing: 14) {
                // Status indicator
                ZStack {
                    Circle()
                        .fill(viewModel.isClockedIn ? Color.cfAttendanceBg : Color(.systemGray6))
                        .frame(width: 48, height: 48)
                    Image(systemName: viewModel.isClockedIn
                          ? (viewModel.isOnBreak ? "pause.circle.fill" : "clock.fill")
                          : "clock.badge.xmark")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(viewModel.isClockedIn ? .cfAttendance : .cfTextSecondary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(viewModel.isClockedIn
                         ? (viewModel.isOnBreak ? "On Break" : "Clocked In")
                         : "Not Clocked In")
                        .font(.cfSubheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.cfTextPrimary)
                    Text(viewModel.isClockedIn
                         ? viewModel.elapsedDisplay + " today"
                         : "Tap to clock in")
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                        .monospacedDigit()
                }

                Spacer()

                if !viewModel.isClockedIn {
                    Text("Clock In")
                        .font(.cfCaption2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(Color.cfPrimary)
                        .clipShape(Capsule())
                }
            }
            .padding(14)
            .background(Color.cfSurface)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay {
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(
                        viewModel.isClockedIn ? Color.cfAttendance.opacity(0.25) : Color.cfBorder,
                        lineWidth: 1
                    )
            }
            .cfSubtleShadow()
        }
        .buttonStyle(.plain)
    }
}

// MARK: - ViewModel

@MainActor
class ClockInViewModel: ObservableObject {
    @Published var activeEntry: TimeEntry?
    @Published var todayCompletedEntry: TimeEntry?
    @Published var recentEntries: [TimeEntry] = []
    @Published var weekEntries: [TimeEntry] = []
    @Published var isLoading = false
    @Published var showClockOutConfirm = false
    @Published var elapsedDisplay = "0:00"

    private var timer: Timer?

    var isClockedIn: Bool { activeEntry != nil }
    var isOnBreak: Bool { activeEntry?.isOnBreak ?? false }

    var weekMinutes: Int { weekEntries.reduce(0) { $0 + $1.totalMinutes } }
    var daysWorked: Int { weekEntries.filter { $0.clockOut != nil }.count }

    var weekHoursDisplay: String {
        let h = weekMinutes / 60
        let m = weekMinutes % 60
        return String(format: "%d:%02d", h, m)
    }

    var overtimeDisplay: String {
        let ot = max(0, weekMinutes - 40 * 60)
        if ot == 0 { return "0:00" }
        return String(format: "%d:%02d", ot / 60, ot % 60)
    }

    func load() async {
        isLoading = true
        do {
            // In production: fetch active entry + week entries from API
            activeEntry = try await APIClient.shared.getActiveEntry(staffId: "staff-1")
        } catch {
            #if DEBUG
            activeEntry = MockData.activeTimeEntry
            let week = MockData.timesheetWeeks.first
            weekEntries = week?.entries ?? []
            recentEntries = Array((week?.entries ?? []).prefix(4))
            #endif
        }
        isLoading = false
        startTimer()
    }

    func clockIn() async {
        isLoading = true
        let req = ClockInRequest(staffId: "staff-1", timestamp: Date(), locationNote: nil)
        do {
            activeEntry = try await APIClient.shared.clockIn(request: req)
        } catch {
            #if DEBUG
            activeEntry = TimeEntry(
                id: UUID().uuidString, staffId: "staff-1", staffName: "You",
                clockIn: Date(), clockOut: nil, breaks: [],
                status: .active, adminNote: nil
            )
            #endif
        }
        isLoading = false
        startTimer()
    }

    func clockOut() async {
        guard let entry = activeEntry else { return }
        isLoading = true
        let req = ClockOutRequest(entryId: entry.id, timestamp: Date())
        do {
            let completed = try await APIClient.shared.clockOut(request: req)
            todayCompletedEntry = completed
            activeEntry = nil
        } catch {
            #if DEBUG
            var completed = entry
            completed = TimeEntry(
                id: entry.id, staffId: entry.staffId, staffName: entry.staffName,
                clockIn: entry.clockIn, clockOut: Date(),
                breaks: entry.breaks, status: .pending, adminNote: nil
            )
            todayCompletedEntry = completed
            activeEntry = nil
            #endif
        }
        isLoading = false
        stopTimer()
        updateElapsed()
    }

    func toggleBreak() async {
        guard let entry = activeEntry else { return }
        do {
            if isOnBreak {
                activeEntry = try await APIClient.shared.endBreak(entryId: entry.id)
            } else {
                activeEntry = try await APIClient.shared.startBreak(entryId: entry.id)
            }
        } catch {
            #if DEBUG
            var updated = entry
            if isOnBreak {
                // end break
                if let lastIdx = updated.breaks.indices.last {
                    updated.breaks[lastIdx] = ShiftBreak(
                        id: updated.breaks[lastIdx].id,
                        startTime: updated.breaks[lastIdx].startTime,
                        endTime: Date()
                    )
                }
            } else {
                // start break
                updated.breaks.append(ShiftBreak(id: UUID().uuidString, startTime: Date(), endTime: nil))
            }
            activeEntry = updated
            #endif
        }
    }

    private func startTimer() {
        stopTimer()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in self?.updateElapsed() }
        }
        updateElapsed()
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func updateElapsed() {
        guard let entry = activeEntry else {
            elapsedDisplay = "0:00"
            return
        }
        let mins = entry.totalMinutes
        elapsedDisplay = String(format: "%d:%02d", mins / 60, mins % 60)
    }

    deinit {
        timer?.invalidate()
    }
}
