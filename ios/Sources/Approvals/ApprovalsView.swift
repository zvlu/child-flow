import SwiftUI

/// Higher-up sign-off inbox. Admins see the org's queue and can approve/deny;
/// managers see the status of what they submitted. Backed by ApprovalsAPI
/// (GET /api/approvals, POST /api/approvals/:id/review). Reachable from the
/// app menu's "Program" section (admin-gated).
struct ApprovalsView: View {
    @EnvironmentObject var appState: AppState
    @State private var status = "pending"
    @State private var items: [ApprovalItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var workingId: String?

    private var isAdmin: Bool { appState.isAdmin }

    var body: some View {
        List {
            Picker("Status", selection: $status) {
                Text("Pending").tag("pending")
                Text("Approved").tag("approved")
                Text("Denied").tag("denied")
            }
            .pickerStyle(.segmented)

            if isLoading && items.isEmpty {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if items.isEmpty {
                Text("No \(status) requests.")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 24)
            } else {
                ForEach(items) { item in
                    ApprovalRow(
                        item: item,
                        isAdmin: isAdmin,
                        working: workingId == item.id,
                        onApprove: { review(item, approve: true) },
                        onDeny: { review(item, approve: false) }
                    )
                }
            }
        }
        .navigationTitle("Approvals")
        .onChange(of: status) { _, _ in Task { await load() } }
        .task { await load() }
        .refreshable { await load() }
        .alert("Notice", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            items = try await APIClient.shared.getApprovals(status: status)
        } catch {
            errorMessage = friendly(error)
        }
    }

    private func review(_ item: ApprovalItem, approve: Bool) {
        workingId = item.id
        Task {
            defer { workingId = nil }
            do {
                _ = try await APIClient.shared.reviewApproval(id: item.id, approve: approve, note: nil)
                await load()
            } catch {
                errorMessage = friendly(error)
            }
        }
    }

    private func friendly(_ error: Error) -> String {
        if case APIError.httpError(403) = error {
            return "Only administrators can review approvals."
        }
        return "Couldn't complete that. Check your connection and try again."
    }
}

private struct ApprovalRow: View {
    let item: ApprovalItem
    let isAdmin: Bool
    let working: Bool
    let onApprove: () -> Void
    let onDeny: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.cfPrimary)
                Text(item.title)
                    .font(.headline)
                Spacer()
                statusBadge
            }
            Text(item.detail)
                .font(.subheadline)
                .foregroundColor(.secondary)
            if let reason = item.requestReason, !reason.isEmpty {
                Text("“\(reason)”")
                    .font(.caption)
                    .italic()
                    .foregroundColor(.secondary)
            }
            if item.status != "pending", let note = item.decisionNote, !note.isEmpty {
                Text("Note: \(note)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            if isAdmin && item.status == "pending" {
                HStack(spacing: 12) {
                    Button(role: .destructive, action: onDeny) {
                        Label("Deny", systemImage: "xmark.circle")
                    }
                    .buttonStyle(.bordered)
                    Button(action: onApprove) {
                        Label("Approve", systemImage: "checkmark.circle")
                    }
                    .buttonStyle(.borderedProminent)
                    if working { ProgressView() }
                }
                .disabled(working)
                .padding(.top, 4)
            }
        }
        .padding(.vertical, 4)
    }

    private var icon: String {
        switch item.type {
        case "staff_hire":         return "person.badge.plus"
        case "custom_role":        return "person.badge.key.fill"
        case "staff_role_change":  return "person.crop.circle.badge.exclamationmark"
        default:                   return "tray.full"
        }
    }

    private var statusColor: Color {
        switch item.status {
        case "approved": return .green
        case "denied":   return .red
        default:         return .orange
        }
    }

    private var statusBadge: some View {
        Text(item.status.capitalized)
            .font(.caption2).bold()
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(statusColor.opacity(0.15))
            .foregroundColor(statusColor)
            .clipShape(Capsule())
    }
}
