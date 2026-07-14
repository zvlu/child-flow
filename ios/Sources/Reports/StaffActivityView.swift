import SwiftUI

/// Family-contact types in display order (matches the web report).
private let orderedContactTypes = [
    "home_visit", "office_visit", "phone_call", "email",
    "referral", "coordinated_services", "monthly_contact", "other",
]

private let activityPresets: [(key: String, label: String)] = [
    ("month", "This Month"), ("lastMonth", "Last Month"), ("90d", "90 Days"), ("year", "Year"),
]

private func staffInitials(_ name: String) -> String {
    String(name.split(separator: " ").compactMap { $0.first }.prefix(2)).uppercased()
}

@MainActor
final class StaffActivityViewModel: ObservableObject {
    @Published var report: StaffActivityReport?
    @Published var preset: String = "month" { didSet { if oldValue != preset { Task { await load() } } } }
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            report = try await APIClient.shared.fetchStaffActivity(preset: preset)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load staff activity."
        }
    }
}

struct StaffActivityView: View {
    @StateObject private var vm = StaffActivityViewModel()

    var body: some View {
        HeadStartGate(featureDescription: "Family advocate workload reporting") {
            List {
                Section {
                    Picker("Period", selection: $vm.preset) {
                        ForEach(activityPresets, id: \.key) { Text($0.label).tag($0.key) }
                    }
                    .pickerStyle(.segmented)
                }

                if let r = vm.report {
                    Section {
                        HStack(spacing: 10) {
                            ActivityStatPill(value: "\(r.totals.total)", label: "Contacts", color: .cfPrimary)
                            ActivityStatPill(value: "\(r.staff.filter { $0.total > 0 }.count)/\(r.staff.count)", label: "Active", color: .cfGoals)
                            ActivityStatPill(value: "\(r.totals.byType["monthly_contact"] ?? 0)", label: "Monthly", color: .cfAttendance)
                        }
                        .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    }

                    Section {
                        if r.staff.isEmpty {
                            Text("No staff found for this organization.")
                                .font(.cfCaption).foregroundColor(.cfTextSecondary)
                        }
                        ForEach(r.staff) { s in
                            if let id = s.staffId, s.total > 0 {
                                NavigationLink(destination: StaffContactLogView(staffId: id, name: s.name, position: s.position, preset: vm.preset)) {
                                    StaffActivityRowView(row: s)
                                }
                            } else {
                                StaffActivityRowView(row: s)
                            }
                        }
                    } header: {
                        Text("Workload by Staff")
                    } footer: {
                        Text("Tap a staff member to see their full contact log.")
                    }
                }
            }
            .navigationTitle("Staff Activity")
            .navigationBarTitleDisplayMode(.inline)
            .task { if vm.report == nil { await vm.load() } }
            .overlay { if vm.isLoading && vm.report == nil { ProgressView() } }
            .alert("Staff Activity", isPresented: .constant(vm.errorMessage != nil)) {
                Button("OK") { vm.errorMessage = nil }
            } message: { Text(vm.errorMessage ?? "") }
        }
    }
}

private struct ActivityStatPill: View {
    let value: String
    let label: String
    let color: Color
    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.system(size: 22, weight: .bold)).foregroundColor(color)
            Text(label).font(.cfCaption).foregroundColor(.cfTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

private struct StaffActivityRowView: View {
    let row: StaffActivityRow

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Color.cfPrimary.opacity(0.12)).frame(width: 36, height: 36)
                Text(staffInitials(row.name)).font(.system(size: 12, weight: .bold)).foregroundColor(.cfPrimary)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(row.name).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                if !row.position.isEmpty {
                    Text(row.position).font(.cfCaption).foregroundColor(.cfTextSecondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(row.total)").font(.system(size: 18, weight: .bold))
                    .foregroundColor(row.total > 0 ? .cfTextPrimary : .cfTextSecondary.opacity(0.5))
                Text("contacts").font(.system(size: 10)).foregroundColor(.cfTextSecondary)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Single advocate's contact log

struct StaffContactLogView: View {
    let staffId: String
    let name: String
    let position: String
    let preset: String

    @State private var detail: [StaffContactDetail] = []
    @State private var byType: [String: Int] = [:]
    @State private var total = 0
    @State private var isLoading = true

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(position.isEmpty ? "Staff" : position).font(.cfCaption).foregroundColor(.cfTextSecondary)
                        Spacer()
                        Text("\(total) contacts").font(.cfSubheadline.weight(.bold)).foregroundColor(.cfPrimary)
                    }
                    let active = orderedContactTypes.filter { (byType[$0] ?? 0) > 0 }
                    if !active.isEmpty {
                        FlowChips(items: active.map { "\(contactTypeLabel($0)): \(byType[$0] ?? 0)" })
                    }
                }
                .listRowBackground(Color.cfPrimaryLight)
            }

            Section("Contact log") {
                if detail.isEmpty && !isLoading {
                    Text("No contacts logged in this period.")
                        .font(.cfCaption).foregroundColor(.cfTextSecondary)
                }
                ForEach(detail) { d in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(d.familyName).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                            Spacer()
                            Text(d.serviceDate).font(.cfCaption).foregroundColor(.cfTextSecondary)
                        }
                        HStack(spacing: 6) {
                            Text(contactTypeLabel(d.type))
                                .font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 8).padding(.vertical, 2)
                                .background(Color.cfPrimary.opacity(0.12))
                                .foregroundColor(.cfPrimary).clipShape(Capsule())
                            if d.followUpRequired {
                                Text("Follow-up")
                                    .font(.system(size: 10, weight: .bold))
                                    .padding(.horizontal, 8).padding(.vertical, 2)
                                    .background(Color.orange.opacity(0.15))
                                    .foregroundColor(.orange).clipShape(Capsule())
                            }
                        }
                        if !d.description.isEmpty {
                            Text(d.description).font(.cfCaption).foregroundColor(.cfTextSecondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle(name)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .overlay { if isLoading { ProgressView() } }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        if let r = try? await APIClient.shared.fetchStaffActivity(preset: preset, staffId: staffId) {
            detail = r.detail
            let row = r.staff.first { $0.staffId == staffId }
            byType = row?.byType ?? [:]
            total = row?.total ?? detail.count
        }
    }
}

/// Simple wrapping row of capsule chips.
private struct FlowChips: View {
    let items: [String]
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(items, id: \.self) { item in
                Text(item)
                    .font(.system(size: 11, weight: .medium))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Color.white.opacity(0.6))
                    .foregroundColor(.cfTextPrimary)
                    .clipShape(Capsule())
            }
        }
    }
}
