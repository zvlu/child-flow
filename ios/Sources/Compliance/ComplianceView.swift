import SwiftUI

struct ComplianceView: View {
    @StateObject private var viewModel = ComplianceViewModel()

    var body: some View {
        List {
            Section {
                ComplianceScoreCard(score: viewModel.overallScore)
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init())
            }

            Section("PIR Sections") {
                ForEach(viewModel.pirSections) { section in
                    PIRSectionRow(section: section)
                }
            }

            Section("Monitoring Checklist") {
                ForEach($viewModel.checklistItems) { $item in
                    ChecklistItemRow(item: $item)
                }
            }
        }
        .navigationTitle("Compliance")
        .task { await viewModel.load() }
    }
}

struct ComplianceScoreCard: View {
    let score: Int

    var color: Color {
        score >= 90 ? .green : score >= 70 ? .orange : .red
    }

    var body: some View {
        VStack(spacing: 8) {
            Text("\(score)%")
                .font(.system(size: 52, weight: .bold))
                .foregroundColor(color)
            Text("Overall Compliance Score")
                .font(.subheadline)
                .foregroundColor(.secondary)
            ProgressView(value: Double(score), total: 100)
                .tint(color)
                .padding(.horizontal)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding()
    }
}

struct PIRSectionRow: View {
    let section: PIRSection

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(section.name)
                    .font(.subheadline.weight(.medium))
                Text(section.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text("\(section.completionRate)%")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(section.completionRate >= 90 ? .green : .orange)
                ProgressView(value: Double(section.completionRate), total: 100)
                    .frame(width: 60)
                    .tint(section.completionRate >= 90 ? .green : .orange)
            }
        }
        .padding(.vertical, 4)
    }
}

struct ChecklistItemRow: View {
    @Binding var item: ComplianceChecklistItem

    var body: some View {
        HStack {
            Image(systemName: item.isCompliant ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .foregroundColor(item.isCompliant ? .green : .red)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.subheadline)
                if let note = item.note {
                    Text(note)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            Toggle("", isOn: $item.isCompliant)
                .labelsHidden()
        }
    }
}

@MainActor
class ComplianceViewModel: ObservableObject {
    @Published var overallScore: Int = 0
    @Published var pirSections: [PIRSection] = []
    @Published var checklistItems: [ComplianceChecklistItem] = []

    func load() async {
        do {
            let data = try await APIClient.shared.getComplianceData()
            overallScore = data.overallScore
            pirSections = data.pirSections
            checklistItems = data.checklistItems
        } catch {}
    }
}
