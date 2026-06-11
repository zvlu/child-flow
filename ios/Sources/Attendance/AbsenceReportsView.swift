import SwiftUI

/// Family advocate review queue for parent-reported absences.
/// Approving marks that day's attendance "excused" and notifies the family.
struct AbsenceReportsView: View {
    @StateObject private var viewModel = AbsenceReportsViewModel()

    var body: some View {
        List {
            if !viewModel.reports.isEmpty {
                Section {
                    ForEach(viewModel.reports) { report in
                        AbsenceReviewRow(report: report) { approve in
                            Task { await viewModel.review(report, approve: approve) }
                        }
                    }
                } footer: {
                    Text("Approving marks the day as an excused absence and notifies the family.")
                }
            }
        }
        .navigationTitle("Absence Reports")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await viewModel.load() }
        .task { await viewModel.load() }
        .overlay {
            if viewModel.isLoading && viewModel.reports.isEmpty {
                ProgressView()
            } else if viewModel.reports.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.largeTitle)
                        .foregroundColor(.cfAttendance)
                    Text("All caught up")
                        .font(.headline)
                    Text("No absence reports waiting for review.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

struct AbsenceReviewRow: View {
    let report: AbsenceReport
    let onReview: (Bool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(report.childName)
                        .font(.subheadline.weight(.semibold))
                    Text("\(report.familyName) · reported \(report.reportedAt.formatted(.relative(presentation: .named)))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(report.date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
                        .font(.caption.weight(.semibold))
                    Text(report.reasonLabel)
                        .font(.caption2)
                        .foregroundColor(.cfPrimary)
                }
            }

            if !report.note.isEmpty {
                Text("“\(report.note)”")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 10) {
                Button {
                    onReview(true)
                } label: {
                    Label("Approve — excused", systemImage: "checkmark.circle.fill")
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(Color.cfAttendance.opacity(0.15))
                        .foregroundColor(.cfAttendance)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)

                Button {
                    onReview(false)
                } label: {
                    Label("Deny", systemImage: "xmark.circle")
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(Color.cfHealth.opacity(0.12))
                        .foregroundColor(.cfHealth)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 6)
    }
}

@MainActor
class AbsenceReportsViewModel: ObservableObject {
    @Published var reports: [AbsenceReport] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        reports = (try? await APIClient.shared.getAbsenceReports()) ?? reports
        isLoading = false
    }

    func review(_ report: AbsenceReport, approve: Bool) async {
        do {
            try await APIClient.shared.reviewAbsence(id: report.id, approve: approve)
            reports.removeAll { $0.id == report.id }
        } catch {
            await load()
        }
    }
}
