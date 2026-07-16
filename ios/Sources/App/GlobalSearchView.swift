import SwiftUI

/// App-wide search (parity with the web ⌘K palette): type any child or family
/// name and jump straight to their detail screen. Presented as a sheet from the
/// dashboard header.
@MainActor
final class GlobalSearchViewModel: ObservableObject {
    @Published var children: [Child] = []
    @Published var families: [Family] = []
    @Published var isLoading = false
    private var loaded = false

    func loadIfNeeded() async {
        if loaded { return }
        isLoading = true
        defer { isLoading = false }
        async let c = APIClient.shared.getChildren()
        async let f = APIClient.shared.getFamilies()
        children = (try? await c) ?? []
        families = (try? await f) ?? []
        loaded = true
    }
}

struct GlobalSearchView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = GlobalSearchViewModel()
    @State private var query = ""

    private var trimmed: String { query.trimmingCharacters(in: .whitespaces).lowercased() }

    private var matchedChildren: [Child] {
        guard !trimmed.isEmpty else { return [] }
        return vm.children.filter {
            $0.fullName.lowercased().contains(trimmed)
            || $0.parentName.lowercased().contains(trimmed)
            || $0.classroom.lowercased().contains(trimmed)
        }
    }

    private var matchedFamilies: [Family] {
        guard !trimmed.isEmpty else { return [] }
        return vm.families.filter {
            $0.name.lowercased().contains(trimmed) || $0.phone.contains(trimmed)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if vm.isLoading {
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .listRowSeparator(.hidden)
                } else if trimmed.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 32))
                            .foregroundColor(.cfTextSecondary.opacity(0.4))
                        Text("Search any child or family")
                            .font(.cfSubheadline).foregroundColor(.cfTextPrimary)
                        Text("Type a name to jump straight to their record.")
                            .font(.cfCaption).foregroundColor(.cfTextSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowSeparator(.hidden)
                } else if matchedChildren.isEmpty && matchedFamilies.isEmpty {
                    Text("No matches for \u{201C}\(query)\u{201D}")
                        .font(.cfSubheadline).foregroundColor(.cfTextSecondary)
                        .frame(maxWidth: .infinity).padding(.vertical, 32)
                        .listRowSeparator(.hidden)
                } else {
                    if !matchedChildren.isEmpty {
                        Section("Children") {
                            ForEach(matchedChildren) { child in
                                NavigationLink(destination: ChildDetailView(child: child)) {
                                    SearchResultRow(
                                        initials: child.initials,
                                        title: child.fullName,
                                        subtitle: "\(child.classroom) · \(child.parentName)",
                                        color: .cfPrimary
                                    )
                                }
                            }
                        }
                    }
                    if !matchedFamilies.isEmpty {
                        Section("Families") {
                            ForEach(matchedFamilies) { family in
                                NavigationLink(destination: FamilyDetailView(family: family)) {
                                    SearchResultRow(
                                        initials: familyInitials(family.name),
                                        title: family.name,
                                        subtitle: family.childrenCount == 1 ? "1 child" : "\(family.childrenCount) children",
                                        color: .cfFamily
                                    )
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $query, prompt: "Search children or families")
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
            }
            .task { await vm.loadIfNeeded() }
        }
    }

    private func familyInitials(_ name: String) -> String {
        String(name.split(separator: " ").compactMap { $0.first }.prefix(2)).uppercased()
    }
}

private struct SearchResultRow: View {
    let initials: String
    let title: String
    let subtitle: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(color.opacity(0.12)).frame(width: 36, height: 36)
                Text(initials).font(.system(size: 12, weight: .bold)).foregroundColor(color)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                Text(subtitle).font(.cfCaption).foregroundColor(.cfTextSecondary)
            }
        }
        .padding(.vertical, 2)
    }
}
