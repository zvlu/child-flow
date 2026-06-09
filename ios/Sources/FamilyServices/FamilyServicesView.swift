import SwiftUI

struct FamilyServicesView: View {
    @StateObject private var viewModel = FamilyServicesViewModel()

    var body: some View {
        List {
            ForEach(viewModel.families) { family in
                NavigationLink(destination: FamilyDetailView(family: family)) {
                    FamilyRow(family: family)
                }
            }
        }
        .navigationTitle("Family Services")
        .searchable(text: $viewModel.searchText)
        .task { await viewModel.load() }
        .overlay {
            if viewModel.isLoading { ProgressView() }
        }
    }
}

struct FamilyRow: View {
    let family: Family

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(family.name)
                .font(.subheadline.weight(.medium))
            HStack(spacing: 8) {
                Label("\(family.childrenCount) children", systemImage: "person.2")
                Spacer()
                Label(family.lastContact, systemImage: "calendar")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct FamilyDetailView: View {
    let family: Family

    var body: some View {
        List {
            Section("Contact Information") {
                LabeledContent("Phone", value: family.phone)
                LabeledContent("Address", value: family.address)
                LabeledContent("Email", value: family.email)
            }
            Section("Goals") {
                ForEach(family.goals, id: \.self) { goal in
                    Label(goal, systemImage: "target")
                }
            }
            Section("Upcoming") {
                Label("Home Visit: \(family.nextHomeVisit)", systemImage: "house")
            }
        }
        .navigationTitle(family.name)
    }
}

@MainActor
class FamilyServicesViewModel: ObservableObject {
    @Published var families: [Family] = []
    @Published var searchText = ""
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            families = try await APIClient.shared.getFamilies()
        } catch {}
        isLoading = false
    }
}
