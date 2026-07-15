import SwiftUI
import Charts

/// Graphs for parents: weekly attendance per child and family goal progress.
struct FamilyProgressView: View {
    @StateObject private var viewModel = FamilyProgressViewModel()
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    if viewModel.isLoading && viewModel.progress == nil {
                        ProgressView().padding(.top, 60)
                    } else if let progress = viewModel.progress {
                        ForEach(progress.attendance) { series in
                            AttendanceChartCard(series: series)
                                .padding(.horizontal)
                        }

                        if !progress.goals.isEmpty {
                            GoalsCard(goals: progress.goals)
                                .padding(.horizontal)
                        }

                        if progress.attendance.isEmpty && progress.goals.isEmpty {
                            emptyState
                        }
                    } else if viewModel.loadFailed {
                        // Previously this fell through to the same emptyState
                        // as "no progress data yet" — indistinguishable from a
                        // failed fetch, so a parent on a bad connection would
                        // conclude there was simply nothing to see.
                        errorState
                    } else {
                        emptyState
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle(L(.tabProgress))
            .refreshable { await viewModel.load() }
            .task { await viewModel.load() }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "chart.bar")
                .font(.largeTitle)
                .foregroundColor(.secondary)
            Text(L(.noProgressData))
                .font(.headline)
            Text(L(.progressWillAppear))
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.top, 60)
    }

    private var errorState: some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.orange)
            Text(L(.somethingWentWrong))
                .font(.headline)
            Text(L(.pullToRefreshRetry))
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.top, 60)
    }
}

// MARK: - Attendance Chart

struct AttendanceChartCard: View {
    let series: ChildAttendanceSeries

    private func barColor(_ rate: Int) -> Color {
        if rate >= 85 { return .green }
        if rate >= 70 { return .orange }
        return .red
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(L(.attendanceChartFmt, series.childName))
                    .font(.headline)
                Spacer()
                if let latest = series.weeks.last {
                    Text(L(.thisWeekFmt, latest.rate))
                        .font(.caption.weight(.semibold))
                        .foregroundColor(barColor(latest.rate))
                }
            }

            if series.weeks.isEmpty {
                Text(L(.noAttendanceRecorded))
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                Chart(series.weeks) { week in
                    BarMark(
                        x: .value("Week", week.label),
                        y: .value("Attendance", week.rate)
                    )
                    .foregroundStyle(barColor(week.rate).gradient)
                    .cornerRadius(4)

                    // Head Start's 85% attendance benchmark.
                    RuleMark(y: .value("Goal", 85))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        .foregroundStyle(.secondary)
                }
                .chartYScale(domain: 0...100)
                .frame(height: 170)

                Text(L(.dashedLine85))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Goals Card

struct GoalsCard: View {
    let goals: [GoalProgressItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(L(.familyGoals))
                .font(.headline)

            ForEach(goals) { goal in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(goal.title)
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        if goal.status == "completed" {
                            Label(L(.done), systemImage: "checkmark.circle.fill")
                                .font(.caption.weight(.semibold))
                                .foregroundColor(.green)
                        } else {
                            Text("\(goal.progress)%")
                                .font(.caption.weight(.semibold))
                                .foregroundColor(.secondary)
                        }
                    }
                    ProgressView(value: Double(goal.progress), total: 100)
                        .tint(goal.progress >= 100 ? .green : .accentColor)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - ViewModel

@MainActor
class FamilyProgressViewModel: ObservableObject {
    @Published var progress: FamilyProgress?
    @Published var isLoading = false
    /// Previously there was no way to tell "the fetch failed" apart from
    /// "the family genuinely has no progress data" — both rendered the same
    /// emptyState. This distinguishes the two so a parent on a dropped
    /// connection doesn't read a real error as "nothing to see here yet."
    @Published var loadFailed = false

    func load() async {
        isLoading = true
        if let latest = try? await APIClient.shared.getFamilyProgress() {
            progress = latest
            loadFailed = false
        } else {
            loadFailed = progress == nil
        }
        isLoading = false
    }
}
