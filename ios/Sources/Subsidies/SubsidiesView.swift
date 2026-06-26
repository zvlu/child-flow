import SwiftUI

private func money(_ v: String?) -> String {
    guard let v, !v.isEmpty, let n = Double(v) else { return "—" }
    return "$" + String(format: "%.2f", n)
}

private func subsidyStatusColor(_ s: String) -> Color {
    switch s { case "active": return .cfAttendance; case "pending": return .orange; default: return .cfHealth }
}

@MainActor
final class SubsidiesViewModel: ObservableObject {
    @Published var subsidies: [SubsidyItem] = []
    @Published var families: [Family] = []
    @Published var isLoading = false
    @Published var posting = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let s = APIClient.shared.getSubsidies()
            async let f = APIClient.shared.getFamilies()
            subsidies = try await s
            families = try await f
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load subsidies."
        }
    }

    func add(familyId: String, agency: String, authorized: String, copay: String, status: String, notes: String) async -> Bool {
        posting = true
        defer { posting = false }
        do {
            try await APIClient.shared.createSubsidy(
                familyId: familyId, agencyName: agency,
                authorizedAmount: authorized.isEmpty ? nil : authorized,
                copayAmount: copay.isEmpty ? nil : copay,
                status: status, notes: notes.isEmpty ? nil : notes
            )
            subsidies = (try? await APIClient.shared.getSubsidies()) ?? subsidies
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't save subsidy."
            return false
        }
    }
}

struct SubsidiesView: View {
    @StateObject private var vm = SubsidiesViewModel()
    @State private var showAdd = false

    var body: some View {
        List {
            if vm.subsidies.isEmpty && !vm.isLoading {
                Text("No subsidies tracked yet. Tap + to add one.")
                    .font(.cfSubheadline).foregroundColor(.cfTextSecondary)
            }
            ForEach(vm.subsidies) { s in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(s.familyName).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                        Spacer()
                        Text(s.status.capitalized).font(.system(size: 10, weight: .bold))
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(subsidyStatusColor(s.status).opacity(0.15))
                            .foregroundColor(subsidyStatusColor(s.status)).clipShape(Capsule())
                    }
                    Text(s.agencyName + (s.caseNumber.isEmpty ? "" : " · Case \(s.caseNumber)"))
                        .font(.cfCaption).foregroundColor(.cfTextSecondary)
                    HStack(spacing: 16) {
                        Text("Authorized: \(money(s.authorizedAmount))").font(.cfCaption).foregroundColor(.cfTextPrimary)
                        Text("Co-pay: \(money(s.copayAmount))").font(.cfCaption).foregroundColor(.cfTextPrimary)
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .navigationTitle("Subsidies")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .task { await vm.load() }
        .sheet(isPresented: $showAdd) { AddSubsidySheet(vm: vm, isPresented: $showAdd) }
        .overlay { if vm.isLoading { ProgressView() } }
        .alert("Subsidies", isPresented: .constant(vm.errorMessage != nil)) {
            Button("OK") { vm.errorMessage = nil }
        } message: { Text(vm.errorMessage ?? "") }
    }
}

private struct AddSubsidySheet: View {
    @ObservedObject var vm: SubsidiesViewModel
    @Binding var isPresented: Bool
    @State private var familyId = ""
    @State private var agency = ""
    @State private var authorized = ""
    @State private var copay = ""
    @State private var status = "active"
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Family") {
                    Picker("Family", selection: $familyId) {
                        Text("Select…").tag("")
                        ForEach(vm.families) { f in Text(f.name).tag(f.id) }
                    }
                    Picker("Status", selection: $status) {
                        Text("Active").tag("active"); Text("Pending").tag("pending"); Text("Expired").tag("expired")
                    }
                }
                Section("Subsidy") {
                    TextField("Agency (e.g. CT Care 4 Kids)", text: $agency)
                    TextField("Authorized amount", text: $authorized).keyboardType(.decimalPad)
                    TextField("Co-pay amount", text: $copay).keyboardType(.decimalPad)
                    TextField("Notes", text: $notes, axis: .vertical).lineLimit(1...3)
                }
            }
            .navigationTitle("Add Subsidy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { if await vm.add(familyId: familyId, agency: agency, authorized: authorized, copay: copay, status: status, notes: notes) { isPresented = false } }
                    }
                    .disabled(familyId.isEmpty || agency.trimmingCharacters(in: .whitespaces).isEmpty || vm.posting)
                }
            }
        }
    }
}
