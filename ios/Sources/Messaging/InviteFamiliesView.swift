import SwiftUI

// MARK: - Invite Families (Staff-facing, mirrors ChildPlus invitation flow)

struct InviteFamiliesView: View {
    @StateObject private var viewModel = InviteFamiliesViewModel()

    var body: some View {
        List {
            // Stats summary (like Report 4701)
            Section {
                InvitationStatsRow(stats: viewModel.stats)
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init())
            }

            // Filters
            Section("Filter Participants") {
                Picker("Program Term", selection: $viewModel.criteria.programTerm) {
                    ForEach(viewModel.programTerms, id: \.self) { Text($0).tag($0) }
                }
                Picker("Location", selection: $viewModel.criteria.location) {
                    Text("All Locations").tag("all")
                    ForEach(viewModel.locations, id: \.self) { Text($0).tag($0) }
                }
                Picker("Enrollment Status", selection: $viewModel.criteria.enrollmentStatus) {
                    Text("All").tag("all")
                    Text("Active").tag("active")
                    Text("Waitlist").tag("waitlist")
                }
                Toggle("Exclude families with accounts", isOn: $viewModel.criteria.excludeWithAccounts)
                Toggle("Exclude if one parent has account", isOn: $viewModel.criteria.excludeOneOfTwoParents)
            }

            // Participant list
            if !viewModel.invitations.isEmpty {
                Section {
                    HStack {
                        Button(viewModel.allSelected ? "Deselect All" : "Select All") {
                            viewModel.toggleAll()
                        }
                        .font(.subheadline)
                        Spacer()
                        Text("\(viewModel.selectedIds.count) selected")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Text("Step 2 — Select Individuals")
                }

                ForEach(viewModel.invitations) { invitation in
                    InvitationRow(
                        invitation: invitation,
                        isSelected: viewModel.selectedIds.contains(invitation.id)
                    ) {
                        viewModel.toggle(invitation.id)
                    }
                }
            }
        }
        .navigationTitle("Invite Families")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Load") { viewModel.applyFilter() }
                    .fontWeight(.semibold)
            }
            if !viewModel.selectedIds.isEmpty {
                ToolbarItem(placement: .bottomBar) {
                    Button(action: { viewModel.showConfirmation = true }) {
                        Label("Send Invitations (\(viewModel.selectedIds.count))", systemImage: "envelope.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
        .task { await viewModel.load() }
        .confirmationDialog(
            "Send \(viewModel.selectedIds.count) invitation\(viewModel.selectedIds.count == 1 ? "" : "s")?",
            isPresented: $viewModel.showConfirmation,
            titleVisibility: .visible
        ) {
            Button("Send") { viewModel.sendInvitations() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Families will receive an email with a unique code to set up their Sprout account.")
        }
        .alert("Invitations Sent", isPresented: $viewModel.showSuccess) {
            Button("OK") {}
        } message: {
            Text("\(viewModel.lastSentCount) invitation\(viewModel.lastSentCount == 1 ? "" : "s") sent successfully.")
        }
        .overlay {
            if viewModel.isLoading { ProgressView() }
        }
    }
}

// MARK: - Invitation Stats (Report 4701 equivalent)

struct InvitationStatsRow: View {
    let stats: InvitationStats

    var body: some View {
        HStack(spacing: 0) {
            StatPill(label: "Registered", count: stats.accountCreated, color: .green)
            Divider().frame(height: 40)
            StatPill(label: "Invited", count: stats.invitationSent, color: .orange)
            Divider().frame(height: 40)
            StatPill(label: "Not Invited", count: stats.noInvitationSent, color: .red)
        }
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
        .padding(.vertical, 4)
    }
}

struct StatPill: View {
    let label: String
    let count: Int
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text("\(count)")
                .font(.title2.bold())
                .foregroundColor(color)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
    }
}

// MARK: - Invitation Row

struct InvitationRow: View {
    let invitation: FamilyInvitation
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: 12) {
                // Checkbox
                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                    .foregroundColor(isSelected ? .accentColor : .secondary)
                    .font(.title3)

                VStack(alignment: .leading, spacing: 2) {
                    Text(invitation.childName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.primary)
                    HStack(spacing: 6) {
                        Text(invitation.adultName)
                            .font(.caption)
                            .foregroundColor(.primary)
                        Text("·")
                            .foregroundColor(.secondary)
                        Text(invitation.adultStatus)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Text(invitation.adultEmail)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    if !invitation.missingInfo.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.caption2)
                            Text("Missing: \(invitation.missingInfo.joined(separator: ", "))")
                                .font(.caption2)
                        }
                        .foregroundColor(.orange)
                    }
                }

                Spacer()

                // Account status badge
                VStack(spacing: 2) {
                    Image(systemName: invitation.accountStatus.icon)
                        .font(.caption)
                    Text(invitation.accountStatus.rawValue)
                        .font(.caption2)
                        .multilineTextAlignment(.center)
                        .frame(width: 60)
                }
                .foregroundColor(invitation.accountStatus.color)
            }
            .padding(.vertical, 4)
        }
        .disabled(!invitation.missingInfo.isEmpty)
        .opacity(invitation.missingInfo.isEmpty ? 1 : 0.5)
    }
}

// MARK: - ViewModel

@MainActor
class InviteFamiliesViewModel: ObservableObject {
    @Published var invitations: [FamilyInvitation] = []
    @Published var stats = InvitationStats(accountCreated: 0, invitationSent: 0, noInvitationSent: 0)
    @Published var selectedIds: Set<String> = []
    @Published var criteria = InvitationFilterCriteria(
        programTerm: "current",
        location: "all",
        enrollmentStatus: "all",
        excludeWithAccounts: false,
        excludeOneOfTwoParents: false
    )
    @Published var locations: [String] = []
    @Published var programTerms: [String] = ["current", "previous"]
    @Published var isLoading = false
    @Published var showConfirmation = false
    @Published var showSuccess = false
    @Published var lastSentCount = 0

    var allSelected: Bool {
        let eligible = invitations.filter { $0.missingInfo.isEmpty }.map(\.id)
        return !eligible.isEmpty && eligible.allSatisfy { selectedIds.contains($0) }
    }

    func load() async {
        isLoading = true
        do {
            let response = try await APIClient.shared.getInvitationStatus(criteria: criteria)
            invitations = response.invitations
            locations = response.locations
            programTerms = response.programTerms.isEmpty ? programTerms : response.programTerms
            recalcStats()
        } catch {}
        isLoading = false
    }

    func applyFilter() {
        selectedIds.removeAll()
        Task { await load() }
    }

    func toggle(_ id: String) {
        if selectedIds.contains(id) { selectedIds.remove(id) }
        else { selectedIds.insert(id) }
    }

    func toggleAll() {
        let eligible = invitations.filter { $0.missingInfo.isEmpty }.map(\.id)
        if allSelected { selectedIds.removeAll() }
        else { selectedIds = Set(eligible) }
    }

    func sendInvitations() {
        let ids = Array(selectedIds)
        lastSentCount = ids.count
        Task {
            do {
                try await APIClient.shared.sendInvitations(recipientIds: ids)
                selectedIds.removeAll()
                showSuccess = true
                await load()
            } catch {}
        }
    }

    private func recalcStats() {
        stats = InvitationStats(
            accountCreated: invitations.filter { $0.accountStatus == .accountCreated }.count,
            invitationSent: invitations.filter { $0.accountStatus == .invitationSent }.count,
            noInvitationSent: invitations.filter { $0.accountStatus == .noInvitationSent }.count
        )
    }
}
