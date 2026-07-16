import SwiftUI

// MARK: - Disability Services (IEP/IFSP, §1302.60-63)
// iOS mirror of the web's Disability Services page, backed by
// /api/disability-services. Head Start module feature — reserves at least
// 10% of enrollment for children with disabilities and tracks their plans,
// annual-review deadlines, LEA coordination, and transition planning.

@MainActor
final class DisabilityServicesViewModel: ObservableObject {
    @Published var summary: DisabilityServiceSummary?
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            summary = try await APIClient.shared.getDisabilityServices()
        } catch {
            #if DEBUG
            summary = MockData.disabilityServices
            #endif
        }
    }

    /// Returns `true` only when the notification was actually recorded (either
    /// via the API, or via the DEBUG-only local demo fallback). The caller
    /// (ParentRightsSheet) uses this to decide whether it's safe to dismiss —
    /// previously it dismissed unconditionally, so a failed save looked
    /// identical to a real one.
    @discardableResult
    func markParentRights(id: String, language: String) async -> Bool {
        guard var s = summary, let i = s.records.firstIndex(where: { $0.id == id }) else { return false }
        do {
            try await APIClient.shared.markDisabilityParentRights(id: id, language: language)
        } catch {
            #if DEBUG
            // Demo mode: no server — record locally so the flow is testable.
            #else
            errorMessage = "This notification wasn't saved. Check your connection and try again."
            return false
            #endif
        }
        s.records[i].parentRightsNotifiedAt = ISO8601DateFormatter().string(from: Date())
        s.records[i].parentRightsLanguage = language
        summary = s
        return true
    }

    func setTransitionChecklist(id: String, steps: [String]) async {
        guard var s = summary, let i = s.records.firstIndex(where: { $0.id == id }) else { return }
        do {
            try await APIClient.shared.setDisabilityTransitionChecklist(id: id, steps: steps)
        } catch {
            #if DEBUG
            #else
            return
            #endif
        }
        s.records[i].transitionChecklist = steps
        summary = s
    }
}

struct DisabilityServicesView: View {
    @StateObject private var viewModel = DisabilityServicesViewModel()

    var body: some View {
        HeadStartGate(featureDescription: "IEP/IFSP disability services tracking") {
            List {
                if viewModel.isLoading && viewModel.summary == nil {
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .listRowBackground(Color.clear)
                } else if let summary = viewModel.summary {
                    Section {
                        DisabilitySummaryCard(summary: summary)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                    }

                    if summary.records.isEmpty {
                        Text("No IEP/IFSP records yet.")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 24)
                            .listRowBackground(Color.clear)
                    } else {
                        Section("Plans") {
                            ForEach(summary.records) { record in
                                NavigationLink(destination: DisabilityRecordDetailView(record: record, viewModel: viewModel)) {
                                    DisabilityRecordRow(record: record)
                                }
                            }
                        }
                    }
                } else {
                    Text("Couldn't load disability services data.")
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 24)
                        .listRowBackground(Color.clear)
                }
            }
            .listStyle(.insetGrouped)
            .background(Color.cfBackground)
            .navigationTitle("Disability Services")
            .navigationBarTitleDisplayMode(.inline)
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}

// MARK: - Summary Card

private struct DisabilitySummaryCard: View {
    let summary: DisabilityServiceSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: summary.meetsTenPercent ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .foregroundColor(summary.meetsTenPercent ? .cfAttendance : .orange)
                Text("\(summary.pctOfEnrollment)% of enrollment has an active plan")
                    .font(.cfSubheadline.bold())
                    .foregroundColor(.cfTextPrimary)
            }
            Text(summary.meetsTenPercent
                 ? "Meets the federal 10% minimum (§1302.60)."
                 : "Below the federal 10% minimum (§1302.60) — \(summary.childrenWithPlans) of \(summary.activeEnrollment) enrolled children have a plan.")
                .font(.cfCaption)
                .foregroundColor(.cfTextSecondary)

            HStack(spacing: 16) {
                DisabilityStatPill(value: "\(summary.expiringSoon)", label: "Expiring within 30 days", color: .orange)
                DisabilityStatPill(value: "\(summary.parentRightsPending)", label: "Parent rights pending", color: .cfHealth)
            }
        }
        .padding(16)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }
}

private struct DisabilityStatPill: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.cfHeadline.bold()).foregroundColor(color)
            Text(label).font(.cfCaption2).foregroundColor(.cfTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Row

struct DisabilityRecordRow: View {
    let record: DisabilityRecord

    private var statusColor: Color {
        switch record.status {
        case "active":              return .cfAttendance
        case "expired":             return .cfHealth
        case "pending_evaluation":  return .orange
        default:                    return .cfTextSecondary
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "figure.roll")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(statusColor)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(disabilityPlanTypeLabel(record.planType)) — \(record.childName)")
                    .font(.cfSubheadline)
                    .foregroundColor(.cfTextPrimary)
                Text(disabilityStatusLabel(record.status))
                    .font(.cfCaption)
                    .foregroundColor(statusColor)
            }
            Spacer()
            if record.parentRightsNotifiedAt == nil {
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundColor(.cfHealth)
                    .help("Parent rights not yet acknowledged")
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Detail

struct DisabilityRecordDetailView: View {
    let record: DisabilityRecord
    @ObservedObject var viewModel: DisabilityServicesViewModel

    @State private var showParentRightsSheet = false
    @State private var language = "English"
    @State private var checklistSteps: [String]

    init(record: DisabilityRecord, viewModel: DisabilityServicesViewModel) {
        self.record = record
        self.viewModel = viewModel
        _checklistSteps = State(initialValue: record.transitionChecklist)
    }

    private var currentRecord: DisabilityRecord {
        viewModel.summary?.records.first(where: { $0.id == record.id }) ?? record
    }

    var body: some View {
        List {
            Section("Plan") {
                LabeledContent("Type", value: disabilityPlanTypeLabel(currentRecord.planType))
                LabeledContent("Status", value: disabilityStatusLabel(currentRecord.status))
                if let d = currentRecord.primaryDisability { LabeledContent("Primary Disability", value: d) }
                if let d = currentRecord.effectiveDate { LabeledContent("Effective", value: d) }
                if let d = currentRecord.expirationDate { LabeledContent("Expires", value: d) }
            }

            if currentRecord.leaAgency != nil || currentRecord.leaContact != nil {
                Section("LEA Coordination") {
                    if let a = currentRecord.leaAgency { LabeledContent("Agency", value: a) }
                    if let c = currentRecord.leaContact { LabeledContent("Contact", value: c) }
                }
            }

            Section("Parent Rights Notification") {
                if let notifiedAt = currentRecord.parentRightsNotifiedAt {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.seal.fill").foregroundColor(.cfAttendance)
                        VStack(alignment: .leading) {
                            Text("Notified").font(.cfSubheadline)
                            Text("\(currentRecord.parentRightsLanguage ?? "—") · \(notifiedAt.prefix(10))")
                                .font(.cfCaption2).foregroundColor(.cfTextSecondary)
                        }
                    }
                } else {
                    Button {
                        showParentRightsSheet = true
                    } label: {
                        Label("Record Parent Rights Notification", systemImage: "signature")
                    }
                }
            }

            Section("Kindergarten Transition Checklist") {
                if checklistSteps.isEmpty {
                    Text("No transition steps recorded yet.")
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                } else {
                    ForEach(checklistSteps, id: \.self) { step in
                        Label(step, systemImage: "checkmark.circle.fill")
                            .foregroundColor(.cfAttendance)
                            .font(.cfCaption)
                    }
                }
            }

            if let notes = currentRecord.notes, !notes.isEmpty {
                Section("Notes") {
                    Text(notes).font(.cfCaption)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("\(disabilityPlanTypeLabel(currentRecord.planType)) — \(currentRecord.childName)")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showParentRightsSheet) {
            ParentRightsSheet(language: $language) {
                await viewModel.markParentRights(id: record.id, language: language)
            }
        }
    }
}

private struct ParentRightsSheet: View {
    @Binding var language: String
    let onConfirm: () async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var isSaving = false
    @State private var errorMessage: String?

    let languages = ["English", "Spanish", "Vietnamese", "Chinese (Simplified)", "Arabic", "Haitian Creole"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Notification language") {
                    Picker("Language", selection: $language) {
                        ForEach(languages, id: \.self) { Text($0) }
                    }
                }
                Button(isSaving ? "Saving…" : "Confirm Notification Given") {
                    isSaving = true
                    Task {
                        let success = await onConfirm()
                        isSaving = false
                        if success {
                            dismiss()
                        } else {
                            errorMessage = "This notification wasn't saved. Check your connection and try again."
                        }
                    }
                }
                .disabled(isSaving)
            }
            .navigationTitle("Parent Rights")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .alert("Couldn't Save", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
    }
}
