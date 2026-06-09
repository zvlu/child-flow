import SwiftUI

struct HealthView: View {
    @StateObject private var viewModel = HealthViewModel()

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 16) {
                        HealthSummaryPill(label: "Current", count: viewModel.currentCount, color: .green)
                        HealthSummaryPill(label: "Due Soon", count: viewModel.dueSoonCount, color: .orange)
                        HealthSummaryPill(label: "Overdue", count: viewModel.overdueCount, color: .red)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init())
                    .padding(.vertical, 4)
                }

                ForEach(HealthCategory.allCases, id: \.self) { category in
                    Section(category.displayName) {
                        ForEach(viewModel.records(for: category)) { record in
                            HealthRecordRow(record: record)
                        }
                    }
                }
            }
            .navigationTitle("Health Records")
            .searchable(text: $viewModel.searchText)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Picker("Filter", selection: $viewModel.statusFilter) {
                        Text("All").tag(String?.none)
                        Text("Overdue").tag(String?.some("overdue"))
                        Text("Due Soon").tag(String?.some("due_soon"))
                    }
                    .pickerStyle(.menu)
                }
            }
            .task { await viewModel.load() }
        }
    }
}

struct HealthSummaryPill: View {
    let label: String
    let count: Int
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text("\(count)")
                .font(.title2.bold())
                .foregroundColor(color)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

struct HealthRecordRow: View {
    let record: HealthRecord

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(record.childName)
                    .font(.subheadline.weight(.medium))
                if let date = record.dueDate {
                    Text("Due: \(date, style: .date)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            HealthStatusBadge(status: record.status)
        }
    }
}

enum HealthCategory: String, CaseIterable {
    case physical, dental, vision, hearing, immunizations

    var displayName: String {
        switch self {
        case .physical: return "Physical Exams"
        case .dental: return "Dental Exams"
        case .vision: return "Vision Screening"
        case .hearing: return "Hearing Screening"
        case .immunizations: return "Immunizations"
        }
    }
}

@MainActor
class HealthViewModel: ObservableObject {
    @Published var allRecords: [HealthRecord] = []
    @Published var searchText = ""
    @Published var statusFilter: String? = nil
    @Published var isLoading = false

    var currentCount: Int { allRecords.filter { $0.status == "Current" }.count }
    var dueSoonCount: Int { allRecords.filter { $0.status == "Due Soon" }.count }
    var overdueCount: Int { allRecords.filter { $0.status == "Overdue" }.count }

    func records(for category: HealthCategory) -> [HealthRecord] {
        allRecords.filter { $0.category == category.rawValue }
    }

    func load() async {
        isLoading = true
        do {
            allRecords = try await APIClient.shared.getHealthRecords()
        } catch {}
        isLoading = false
    }
}
