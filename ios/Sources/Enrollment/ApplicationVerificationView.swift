import SwiftUI

// MARK: - Application Verification Checklist

struct ApplicationVerificationView: View {
    @StateObject private var viewModel = VerificationViewModel()
    @State private var filterStatus: ApplicationVerification.VerificationStatus? = nil

    var filtered: [ApplicationVerification] {
        guard let status = filterStatus else { return viewModel.verifications }
        return viewModel.verifications.filter { $0.status == status }
    }

    var body: some View {
        List {
            // Status summary bar
            if !viewModel.verifications.isEmpty {
                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            VerificationStatusChip(
                                label: "All",
                                count: viewModel.verifications.count,
                                color: .accentColor,
                                isSelected: filterStatus == nil
                            ) { filterStatus = nil }

                            ForEach([
                                ApplicationVerification.VerificationStatus.pending,
                                .inProgress, .needsInfo, .complete
                            ], id: \.self) { status in
                                let count = viewModel.verifications.filter { $0.status == status }.count
                                if count > 0 {
                                    VerificationStatusChip(
                                        label: status.rawValue,
                                        count: count,
                                        color: status.color,
                                        isSelected: filterStatus == status
                                    ) { filterStatus = filterStatus == status ? nil : status }
                                }
                            }
                        }
                        .padding(.horizontal, 2)
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(.init(top: 8, leading: 0, bottom: 0, trailing: 0))
            }

            if filtered.isEmpty && !viewModel.isLoading {
                ContentUnavailableView(
                    "No Applications",
                    systemImage: "doc.badge.plus",
                    description: Text("Verification checklists appear here when new applications are received.")
                )
                .listRowBackground(Color.clear)
            } else {
                ForEach(filtered) { verification in
                    NavigationLink(destination: VerificationDetailView(verification: verification, onSave: { updated in
                        viewModel.update(updated)
                    })) {
                        VerificationRow(verification: verification)
                    }
                }
            }
        }
        .navigationTitle("Application Verification")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: viewModel.addSample) {
                    Image(systemName: "plus")
                }
            }
        }
        .task { await viewModel.load() }
        .overlay { if viewModel.isLoading { ProgressView() } }
        .alert("Not Saved", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") { viewModel.errorMessage = nil }
        } message: { Text(viewModel.errorMessage ?? "") }
    }
}

struct VerificationStatusChip: View {
    let label: String
    let count: Int
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(label)
                Text("\(count)")
                    .font(.caption2.bold())
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background(isSelected ? Color.white.opacity(0.3) : color.opacity(0.2))
                    .clipShape(Capsule())
            }
            .font(.caption.weight(isSelected ? .semibold : .regular))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? color : color.opacity(0.1))
            .foregroundColor(isSelected ? .white : color)
            .clipShape(Capsule())
        }
    }
}

struct VerificationRow: View {
    let verification: ApplicationVerification

    var totalCompleted: Int {
        verification.primaryAdult.completedCount
            + (verification.secondaryAdult?.completedCount ?? 0)
            + verification.childChecklist.completedCount
    }
    var totalItems: Int {
        verification.primaryAdult.totalCount
            + (verification.secondaryAdult != nil ? verification.secondaryAdult!.totalCount : 0)
            + verification.childChecklist.totalCount
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(verification.childName)
                    .font(.subheadline.weight(.medium))
                Spacer()
                Text(verification.status.rawValue)
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(verification.status.color.opacity(0.12))
                    .foregroundColor(verification.status.color)
                    .clipShape(Capsule())
            }
            HStack(spacing: 8) {
                Text("Applied: \(verification.applicationDate.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text("\(totalCompleted)/\(totalItems) items verified")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            ProgressView(value: totalItems > 0 ? Double(totalCompleted) / Double(totalItems) : 0)
                .tint(verification.status.color)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Verification Detail

struct VerificationDetailView: View {
    @State var verification: ApplicationVerification
    let onSave: (ApplicationVerification) -> Void
    @State private var selectedSection = 0

    var sectionLabels: [String] {
        var labels = ["Primary Adult", "Child Info"]
        if verification.secondaryAdult != nil { labels.insert("Secondary Adult", at: 1) }
        return labels
    }

    var body: some View {
        List {
            Section("Application") {
                LabeledContent("Child", value: verification.childName)
                LabeledContent("Applied") { Text(verification.applicationDate, style: .date) }
                LabeledContent("Status", value: verification.status.rawValue)
                if let verifiedDate = verification.verifiedDate {
                    LabeledContent("Verified") { Text(verifiedDate, style: .date) }
                }
            }

            Section {
                Picker("Section", selection: $selectedSection) {
                    ForEach(sectionLabels.indices, id: \.self) { i in
                        Text(sectionLabels[i]).tag(i)
                    }
                }
                .pickerStyle(.segmented)
            }
            .listRowBackground(Color.clear)

            if selectedSection == 0 {
                AdultVerificationSection(
                    title: "Primary Adult",
                    adult: $verification.primaryAdult
                ) { onSave(verification) }
            } else if selectedSection == 1 && verification.secondaryAdult != nil {
                AdultVerificationSection(
                    title: "Secondary Adult",
                    adult: Binding(
                        get: { verification.secondaryAdult ?? AdultVerification() },
                        set: { verification.secondaryAdult = $0 }
                    )
                ) { onSave(verification) }
            } else {
                ChildVerificationSection(
                    child: $verification.childChecklist
                ) { onSave(verification) }
            }

            Section("Notes") {
                TextEditor(text: $verification.notes)
                    .frame(minHeight: 80)
                    .onChange(of: verification.notes) { _, _ in onSave(verification) }
            }
        }
        .navigationTitle("Verification")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AdultVerificationSection: View {
    let title: String
    @Binding var adult: AdultVerification
    let onChange: () -> Void

    var items: [(String, Binding<Bool>)] {
        [
            ("First Name", $adult.firstName),
            ("Last Name", $adult.lastName),
            ("Date of Birth", $adult.dateOfBirth),
            ("Gender", $adult.gender),
            ("Race", $adult.race),
            ("Ethnicity", $adult.ethnicity),
            ("Relationship to Child", $adult.relationship),
            ("Education Level", $adult.educationLevel),
            ("Employment Status", $adult.employmentStatus),
            ("Address", $adult.address),
            ("Phone Number", $adult.phone),
            ("Email Address", $adult.email)
        ]
    }

    var body: some View {
        Section {
            HStack {
                Text("\(adult.completedCount)/\(adult.totalCount) verified")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                ProgressView(value: Double(adult.completedCount) / Double(adult.totalCount))
                    .frame(width: 80)
            }
            ForEach(items, id: \.0) { label, binding in
                Toggle(isOn: binding) {
                    Label(label, systemImage: binding.wrappedValue ? "checkmark.circle.fill" : "circle")
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(binding.wrappedValue ? Color.green : Color.secondary)
                }
                .toggleStyle(.checkmark)
                .onChange(of: binding.wrappedValue) { _, _ in onChange() }
            }
        } header: {
            Text(title)
        }
    }
}

struct ChildVerificationSection: View {
    @Binding var child: ChildDocVerification
    let onChange: () -> Void

    var items: [(String, Binding<Bool>)] {
        [
            ("First Name", $child.firstName),
            ("Last Name", $child.lastName),
            ("Date of Birth", $child.dateOfBirth),
            ("Gender", $child.gender),
            ("Race", $child.race),
            ("Ethnicity", $child.ethnicity),
            ("Primary Language", $child.primaryLanguage),
            ("Birth Certificate", $child.birthCertificate),
            ("Proof of Income", $child.proofOfIncome),
            ("Immunization Records", $child.immunizationRecords),
            ("Physical Exam", $child.physicalExam)
        ]
    }

    var body: some View {
        Section {
            HStack {
                Text("\(child.completedCount)/\(child.totalCount) verified")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                ProgressView(value: Double(child.completedCount) / Double(child.totalCount))
                    .frame(width: 80)
            }
            ForEach(items, id: \.0) { label, binding in
                Toggle(isOn: binding) {
                    Label(label, systemImage: binding.wrappedValue ? "checkmark.circle.fill" : "circle")
                        .symbolRenderingMode(.hierarchical)
                        .foregroundStyle(binding.wrappedValue ? Color.green : Color.secondary)
                }
                .toggleStyle(.checkmark)
                .onChange(of: binding.wrappedValue) { _, _ in onChange() }
            }
        } header: {
            Text("Child Information & Documents")
        }
    }
}

// Custom toggle style for checklist items
struct CheckmarkToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button(action: { configuration.isOn.toggle() }) {
            configuration.label
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
        }
        .foregroundColor(.primary)
        .buttonStyle(.plain)
    }
}

extension ToggleStyle where Self == CheckmarkToggleStyle {
    static var checkmark: CheckmarkToggleStyle { CheckmarkToggleStyle() }
}

@MainActor
class VerificationViewModel: ObservableObject {
    @Published var verifications: [ApplicationVerification] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        do {
            verifications = try await APIClient.shared.getApplicationVerifications()
        } catch {
            #if DEBUG
            verifications = MockData.applicationVerifications
            #endif
        }
        isLoading = false
    }

    func update(_ verification: ApplicationVerification) {
        if let idx = verifications.firstIndex(where: { $0.id == verification.id }) {
            verifications[idx] = verification
        }
        Task {
            do {
                _ = try await APIClient.shared.saveVerification(verification: verification)
            } catch {
                // NOTE: there is currently no backend route for
                // /api/enrollment/verifications — this call always fails.
                // Surfacing the error (instead of swallowing it) at least stops
                // the checklist from silently lying about being saved; the
                // underlying feature still needs a real server-side endpoint.
                errorMessage = "This checklist isn't connected to the server yet — changes aren't saved."
            }
        }
    }

    func addSample() {
        let sample = ApplicationVerification(
            id: UUID().uuidString,
            childName: "New Applicant",
            applicationDate: Date(),
            verifiedBy: "Admin",
            verifiedDate: nil,
            primaryAdult: AdultVerification(),
            secondaryAdult: AdultVerification(),
            childChecklist: ChildDocVerification(),
            status: .pending,
            notes: ""
        )
        verifications.insert(sample, at: 0)
    }
}
