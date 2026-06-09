import SwiftUI

struct ReportsView: View {
    @StateObject private var viewModel = ReportsViewModel()

    var body: some View {
        List {
            ForEach(ReportType.allCases, id: \.self) { type in
                ReportTypeRow(type: type) {
                    viewModel.generate(type)
                }
            }
        }
        .navigationTitle("Reports")
        .sheet(item: $viewModel.activeReport) { report in
            ReportPreviewSheet(report: report)
        }
        .overlay {
            if viewModel.isGenerating {
                ZStack {
                    Color.black.opacity(0.3).ignoresSafeArea()
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("Generating report...")
                            .font(.subheadline)
                    }
                    .padding(24)
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }
            }
        }
    }
}

struct ReportTypeRow: View {
    let type: ReportType
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: type.icon)
                    .font(.title3)
                    .foregroundColor(type.color)
                    .frame(width: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(type.displayName)
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(.primary)
                    Text(type.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct ReportPreviewSheet: View {
    let report: GeneratedReport
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(report.content)
                    .padding()
            }
            .navigationTitle(report.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    ShareLink(item: report.content, subject: Text(report.title))
                }
            }
        }
    }
}

enum ReportType: String, CaseIterable {
    case attendance, enrollment, health, familyServices, staffTraining, pir, demographics

    var displayName: String {
        switch self {
        case .attendance: return "Attendance Report"
        case .enrollment: return "Enrollment Report"
        case .health: return "Health Compliance"
        case .familyServices: return "Family Services"
        case .staffTraining: return "Staff Training"
        case .pir: return "PIR Report"
        case .demographics: return "Demographics"
        }
    }

    var description: String {
        switch self {
        case .attendance: return "Daily and monthly attendance rates"
        case .enrollment: return "Current enrollment by classroom"
        case .health: return "Health screening compliance overview"
        case .familyServices: return "Family goals and home visit activity"
        case .staffTraining: return "Training hours and certification status"
        case .pir: return "Program Information Report sections"
        case .demographics: return "Enrollment demographics breakdown"
        }
    }

    var icon: String {
        switch self {
        case .attendance: return "checkmark.circle"
        case .enrollment: return "person.badge.plus"
        case .health: return "heart.text.square"
        case .familyServices: return "house"
        case .staffTraining: return "graduationcap"
        case .pir: return "doc.text"
        case .demographics: return "chart.pie"
        }
    }

    var color: Color {
        switch self {
        case .attendance: return .green
        case .enrollment: return .blue
        case .health: return .red
        case .familyServices: return .orange
        case .staffTraining: return .purple
        case .pir: return .teal
        case .demographics: return .indigo
        }
    }
}

@MainActor
class ReportsViewModel: ObservableObject {
    @Published var activeReport: GeneratedReport? = nil
    @Published var isGenerating = false

    func generate(_ type: ReportType) {
        isGenerating = true
        Task {
            do {
                let report = try await APIClient.shared.generateReport(type: type.rawValue)
                activeReport = report
            } catch {}
            isGenerating = false
        }
    }
}
