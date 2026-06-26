import SwiftUI

let PORTFOLIO_DOMAINS: [(value: String, label: String)] = [
    ("social_emotional", "Social-Emotional"),
    ("language_literacy", "Language & Literacy"),
    ("cognition", "Cognition"),
    ("physical", "Physical"),
    ("creative_arts", "Creative Arts"),
    ("approaches_to_learning", "Approaches to Learning"),
]
func domainLabel(_ v: String?) -> String? {
    guard let v else { return nil }
    return PORTFOLIO_DOMAINS.first { $0.value == v }?.label ?? v
}
private func todayString() -> String {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
}

@MainActor
final class PortfoliosViewModel: ObservableObject {
    @Published var children: [Child] = []
    @Published var entries: [PortfolioEntryItem] = []
    @Published var isLoading = false
    @Published var posting = false
    @Published var errorMessage: String?

    func loadChildren() async {
        do { children = try await APIClient.shared.getChildren() }
        catch { errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load children." }
    }

    func loadEntries(childId: String) async {
        guard !childId.isEmpty else { entries = []; return }
        isLoading = true
        defer { isLoading = false }
        entries = (try? await APIClient.shared.getPortfolio(childId: childId)) ?? []
    }

    func add(childId: String, title: String, observation: String, domain: String) async -> Bool {
        posting = true
        defer { posting = false }
        do {
            try await APIClient.shared.createPortfolioEntry(
                childId: childId, title: title,
                observation: observation.isEmpty ? nil : observation,
                domain: domain.isEmpty ? nil : domain,
                observedAt: todayString()
            )
            await loadEntries(childId: childId)
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't save observation."
            return false
        }
    }
}

struct PortfoliosView: View {
    @StateObject private var vm = PortfoliosViewModel()
    @State private var childId = ""
    @State private var showAdd = false

    var body: some View {
        List {
            Section {
                Picker("Child", selection: $childId) {
                    Text("Select a child…").tag("")
                    ForEach(vm.children) { c in Text("\(c.firstName) \(c.lastName)").tag(c.id) }
                }
            }

            if childId.isEmpty {
                Text("Choose a child to view their developmental portfolio.")
                    .font(.cfSubheadline).foregroundColor(.cfTextSecondary)
            } else if vm.entries.isEmpty && !vm.isLoading {
                Text("No observations yet. Tap + to add the first one.")
                    .font(.cfSubheadline).foregroundColor(.cfTextSecondary)
            } else {
                Section("Observations") {
                    ForEach(vm.entries) { e in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(e.title).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                            if !e.observation.isEmpty {
                                Text(e.observation).font(.cfCaption).foregroundColor(.cfTextSecondary)
                            }
                            HStack(spacing: 8) {
                                if let d = domainLabel(e.domain) {
                                    Text(d).font(.system(size: 10, weight: .bold))
                                        .padding(.horizontal, 7).padding(.vertical, 2)
                                        .background(Color.cfPrimary.opacity(0.12)).foregroundColor(.cfPrimary).clipShape(Capsule())
                                }
                                if let date = e.observedAt { Text(date).font(.cfCaption2).foregroundColor(.cfTextSecondary) }
                                if let a = e.authorName { Text("· \(a)").font(.cfCaption2).foregroundColor(.cfTextSecondary) }
                            }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("Portfolios")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showAdd = true } label: { Image(systemName: "plus") }.disabled(childId.isEmpty)
            }
        }
        .task { await vm.loadChildren() }
        .onChange(of: childId) { _, newValue in Task { await vm.loadEntries(childId: newValue) } }
        .sheet(isPresented: $showAdd) { AddObservationSheet(vm: vm, childId: childId, isPresented: $showAdd) }
        .alert("Portfolios", isPresented: .constant(vm.errorMessage != nil)) {
            Button("OK") { vm.errorMessage = nil }
        } message: { Text(vm.errorMessage ?? "") }
    }
}

private struct AddObservationSheet: View {
    @ObservedObject var vm: PortfoliosViewModel
    let childId: String
    @Binding var isPresented: Bool
    @State private var title = ""
    @State private var observation = ""
    @State private var domain = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Observation") {
                    TextField("Title (e.g. Counted to 20)", text: $title)
                    TextField("What did you observe?", text: $observation, axis: .vertical).lineLimit(2...5)
                    Picker("Domain", selection: $domain) {
                        Text("None").tag("")
                        ForEach(PORTFOLIO_DOMAINS, id: \.value) { d in Text(d.label).tag(d.value) }
                    }
                }
            }
            .navigationTitle("Add Observation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { if await vm.add(childId: childId, title: title, observation: observation, domain: domain) { isPresented = false } }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || vm.posting)
                }
            }
        }
    }
}
