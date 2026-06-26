import SwiftUI

let ASSESSMENT_TYPES: [(value: String, label: String)] = [
    ("assessment", "Assessment"),
    ("parent_conference", "Parent Conference"),
    ("home_visit", "Home Visit"),
    ("individual_plan", "Individual Plan"),
]
private func assessmentTypeLabel(_ t: String) -> String {
    ASSESSMENT_TYPES.first { $0.value == t }?.label ?? "Assessment"
}

@MainActor
final class AssessmentsViewModel: ObservableObject {
    @Published var children: [Child] = []
    @Published var items: [AssessmentItem] = []
    @Published var isLoading = false
    @Published var posting = false
    @Published var errorMessage: String?

    func loadChildren() async {
        do { children = try await APIClient.shared.getChildren() }
        catch { errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load children." }
    }
    func load(childId: String) async {
        guard !childId.isEmpty else { items = []; return }
        isLoading = true
        defer { isLoading = false }
        items = (try? await APIClient.shared.getAssessments(childId: childId)) ?? []
    }
    func add(childId: String, type: String, title: String, domain: String, score: String) async -> Bool {
        posting = true
        defer { posting = false }
        do {
            try await APIClient.shared.createAssessment(childId: childId, type: type, title: title, description: nil,
                                                         score: score.isEmpty ? nil : score, domain: domain.isEmpty ? nil : domain)
            await load(childId: childId)
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't save assessment."
            return false
        }
    }
}

struct AssessmentsView: View {
    @StateObject private var vm = AssessmentsViewModel()
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
                Text("Choose a child to view their assessments and developmental records.")
                    .font(.cfSubheadline).foregroundColor(.cfTextSecondary)
            } else if vm.items.isEmpty && !vm.isLoading {
                Text("No records yet. Tap + to add an assessment.")
                    .font(.cfSubheadline).foregroundColor(.cfTextSecondary)
            } else {
                Section("Records") {
                    ForEach(vm.items) { a in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(a.title).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                                Spacer()
                                if let d = a.assessmentDate { Text(d).font(.cfCaption2).foregroundColor(.cfTextSecondary) }
                            }
                            HStack(spacing: 8) {
                                Text(assessmentTypeLabel(a.type)).font(.system(size: 10, weight: .bold))
                                    .padding(.horizontal, 7).padding(.vertical, 2)
                                    .background(Color.cfPrimary.opacity(0.12)).foregroundColor(.cfPrimary).clipShape(Capsule())
                                if !a.domain.isEmpty { Text(a.domain).font(.cfCaption).foregroundColor(.cfTextSecondary) }
                                if !a.score.isEmpty { Text("· \(a.score)").font(.cfCaption).foregroundColor(.cfTextSecondary) }
                            }
                            if !a.description.isEmpty { Text(a.description).font(.cfCaption).foregroundColor(.cfTextSecondary) }
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("Assessments")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showAdd = true } label: { Image(systemName: "plus") }.disabled(childId.isEmpty)
            }
        }
        .task { await vm.loadChildren() }
        .onChange(of: childId) { _, v in Task { await vm.load(childId: v) } }
        .sheet(isPresented: $showAdd) { AddAssessmentSheet(vm: vm, childId: childId, isPresented: $showAdd) }
        .alert("Assessments", isPresented: .constant(vm.errorMessage != nil)) {
            Button("OK") { vm.errorMessage = nil }
        } message: { Text(vm.errorMessage ?? "") }
    }
}

private struct AddAssessmentSheet: View {
    @ObservedObject var vm: AssessmentsViewModel
    let childId: String
    @Binding var isPresented: Bool
    @State private var type = "assessment"
    @State private var title = ""
    @State private var domain = ""
    @State private var score = ""

    var body: some View {
        NavigationStack {
            Form {
                Picker("Type", selection: $type) {
                    ForEach(ASSESSMENT_TYPES, id: \.value) { t in Text(t.label).tag(t.value) }
                }
                TextField("Title (e.g. DRDP Fall Assessment)", text: $title)
                TextField("Domain (e.g. Language & Literacy)", text: $domain)
                TextField("Score / rating", text: $score)
            }
            .navigationTitle("Add Assessment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { if await vm.add(childId: childId, type: type, title: title, domain: domain, score: score) { isPresented = false } }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || vm.posting)
                }
            }
        }
    }
}
