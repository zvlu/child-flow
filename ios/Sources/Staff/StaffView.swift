import SwiftUI

struct StaffView: View {
    @StateObject private var viewModel = StaffViewModel()

    var body: some View {
        List {
            ForEach(StaffRole.allCases, id: \.self) { role in
                let members = viewModel.staff(for: role)
                if !members.isEmpty {
                    Section(role.displayName) {
                        ForEach(members) { member in
                            StaffRow(member: member)
                        }
                    }
                }
            }
        }
        .navigationTitle("Staff")
        .searchable(text: $viewModel.searchText)
        .task { await viewModel.load() }
    }
}

struct StaffRow: View {
    let member: StaffMember

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.blue.opacity(0.15))
                .frame(width: 40, height: 40)
                .overlay {
                    Text(member.initials)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.blue)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(member.fullName)
                    .font(.subheadline.weight(.medium))
                Text(member.role)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(member.trainingHours)h")
                    .font(.caption.weight(.semibold))
                Text("training")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

enum StaffRole: String, CaseIterable {
    case director, teacher, assistant, familyWorker, healthCoordinator

    var displayName: String {
        switch self {
        case .director: return "Program Directors"
        case .teacher: return "Lead Teachers"
        case .assistant: return "Teacher Assistants"
        case .familyWorker: return "Family Service Workers"
        case .healthCoordinator: return "Health Coordinators"
        }
    }
}

@MainActor
class StaffViewModel: ObservableObject {
    @Published var allStaff: [StaffMember] = []
    @Published var searchText = ""
    @Published var isLoading = false

    func staff(for role: StaffRole) -> [StaffMember] {
        allStaff.filter { $0.roleKey == role.rawValue }
    }

    func load() async {
        isLoading = true
        do {
            allStaff = try await APIClient.shared.getStaff()
        } catch {}
        isLoading = false
    }
}
