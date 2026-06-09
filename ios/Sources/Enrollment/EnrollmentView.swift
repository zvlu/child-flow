import SwiftUI

struct EnrollmentView: View {
    @StateObject private var viewModel = EnrollmentViewModel()

    var body: some View {
        List {
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(EnrollmentStatus.allCases, id: \.self) { status in
                            EnrollmentStatusChip(
                                status: status,
                                count: viewModel.count(for: status),
                                isSelected: viewModel.selectedStatus == status
                            ) {
                                viewModel.selectedStatus = viewModel.selectedStatus == status ? nil : status
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(.init())
            }

            ForEach(viewModel.filteredApplications) { application in
                ApplicationRow(application: application)
            }
        }
        .navigationTitle("Enrollment")
        .searchable(text: $viewModel.searchText)
        .task { await viewModel.load() }
    }
}

struct ApplicationRow: View {
    let application: EnrollmentApplication

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(application.childName)
                    .font(.subheadline.weight(.medium))
                Spacer()
                ApplicationStatusBadge(status: application.status)
            }
            HStack {
                Text("Applied: \(application.applicationDate, style: .date)")
                Spacer()
                Text("Priority: \(application.priority)")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct ApplicationStatusBadge: View {
    let status: String

    var color: Color {
        switch status.lowercased() {
        case "approved": return .green
        case "pending": return .orange
        case "under review": return .blue
        case "denied": return .red
        default: return .gray
        }
    }

    var body: some View {
        Text(status)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .clipShape(Capsule())
    }
}

struct EnrollmentStatusChip: View {
    let status: EnrollmentStatus
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(status.displayName)
                Text("\(count)")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(isSelected ? Color.white.opacity(0.3) : Color.accentColor.opacity(0.15))
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? Color.accentColor : Color(.secondarySystemBackground))
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
    }
}

enum EnrollmentStatus: String, CaseIterable {
    case pending, underReview, approved, denied

    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .underReview: return "Under Review"
        case .approved: return "Approved"
        case .denied: return "Denied"
        }
    }
}

@MainActor
class EnrollmentViewModel: ObservableObject {
    @Published var applications: [EnrollmentApplication] = []
    @Published var searchText = ""
    @Published var selectedStatus: EnrollmentStatus? = nil
    @Published var isLoading = false

    var filteredApplications: [EnrollmentApplication] {
        applications.filter { app in
            let matchesSearch = searchText.isEmpty || app.childName.localizedCaseInsensitiveContains(searchText)
            let matchesStatus = selectedStatus == nil || app.status == selectedStatus?.displayName
            return matchesSearch && matchesStatus
        }
    }

    func count(for status: EnrollmentStatus) -> Int {
        applications.filter { $0.status == status.displayName }.count
    }

    func load() async {
        isLoading = true
        do {
            applications = try await APIClient.shared.getEnrollmentApplications()
        } catch {}
        isLoading = false
    }
}
