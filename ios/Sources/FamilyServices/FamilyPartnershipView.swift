import SwiftUI

// MARK: - Family Partnership Agreement — Full Builder
// The #1 daily tool for family service workers.
// Replaces paper FPA forms — works offline, captures digital signatures.

struct FamilyPartnershipView: View {
    let family: Family
    @StateObject private var vm: FPAViewModel
    @State private var showAddReferral = false
    @State private var showLogVisit = false
    @State private var showSignatureSheet = false
    @State private var showEditStrengths = false
    @State private var editingReferral: FamilyReferral?

    init(family: Family) {
        self.family = family
        _vm = StateObject(wrappedValue: FPAViewModel(family: family))
    }

    var body: some View {
        List {
            // ── FPA Status Header ──────────────────────────────────
            Section {
                FPAHeaderCard(fpa: vm.fpa, visitCount: vm.visits.count,
                              referralCount: vm.referrals.count,
                              activeGoalCount: vm.activeGoalCount)
            }
            .listRowInsets(.init())
            .listRowBackground(Color.clear)

            // ── Visit Progress ─────────────────────────────────────
            Section {
                FPAVisitProgressBar(completed: vm.visits.count,
                                    required: vm.requiredVisits,
                                    programType: vm.programType)
            }
            .listRowBackground(Color.cfPrimary.opacity(0.05))

            // ── Family Strengths ───────────────────────────────────
            Section {
                if vm.strengths.isEmpty {
                    Button {
                        showEditStrengths = true
                    } label: {
                        Label("Add family strengths", systemImage: "plus.circle")
                            .foregroundColor(.cfPrimary)
                            .font(.subheadline)
                    }
                } else {
                    ForEach(vm.strengths, id: \.self) { s in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: "star.fill")
                                .font(.caption)
                                .foregroundColor(.cfGoals)
                                .padding(.top, 2)
                            Text(s)
                                .font(.subheadline)
                        }
                    }
                    Button("Edit Strengths") { showEditStrengths = true }
                        .font(.caption)
                        .foregroundColor(.cfPrimary)
                }
            } header: {
                Label("Family Strengths", systemImage: "star.circle.fill")
                    .foregroundColor(.cfGoals)
            }

            // ── SMART Goals Summary ───────────────────────────────
            Section {
                FPAGoalsSummaryRow(activeCount: vm.activeGoalCount,
                                   completedCount: vm.completedGoalCount,
                                   totalCount: vm.goals.count)
                ForEach(vm.goals.prefix(3)) { goal in
                    FPAGoalMiniRow(goal: goal)
                }
                if vm.goals.count > 3 {
                    Text("+ \(vm.goals.count - 3) more goals")
                        .font(.caption)
                        .foregroundColor(.cfTextSecondary)
                }
            } header: {
                Label("SMART Goals (\(vm.goals.count))", systemImage: "target")
                    .foregroundColor(.cfPrimary)
            }

            // ── Community Referrals ───────────────────────────────
            Section {
                if vm.referrals.isEmpty {
                    Text("No referrals yet")
                        .font(.subheadline)
                        .foregroundColor(.cfTextSecondary)
                } else {
                    ForEach(vm.referrals) { ref in
                        NavigationLink(destination: ReferralDetailView(referral: ref, onUpdate: {
                            Task { await vm.load() }
                        })) {
                            ReferralRow(referral: ref)
                        }
                    }
                }
            } header: {
                HStack {
                    Label("Referrals (\(vm.referrals.count))", systemImage: "arrow.turn.up.right")
                        .foregroundColor(.cfFamily)
                    Spacer()
                    Button { showAddReferral = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.cfFamily)
                    }
                }
            } footer: {
                let overdue = vm.referrals.filter {
                    guard $0.status == .pending, let fu = $0.followUpDate else { return false }
                    return fu < Date()
                }.count
                if overdue > 0 {
                    Label("\(overdue) referral follow-up\(overdue == 1 ? "" : "s") overdue",
                          systemImage: "exclamationmark.triangle.fill")
                        .foregroundColor(.cfHealth)
                        .font(.caption)
                }
            }

            // ── Visit Log ─────────────────────────────────────────
            Section {
                if vm.visits.isEmpty {
                    Text("No visits logged yet")
                        .font(.subheadline)
                        .foregroundColor(.cfTextSecondary)
                } else {
                    ForEach(vm.visits) { visit in
                        NavigationLink(destination: VisitDetailView(visit: visit)) {
                            VisitLogRow(visit: visit)
                        }
                    }
                }
            } header: {
                HStack {
                    Label("Visit Log (\(vm.visits.count))", systemImage: "mappin.and.ellipse")
                        .foregroundColor(.cfAttendance)
                    Spacer()
                    Button { showLogVisit = true } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.cfAttendance)
                    }
                }
            }

            // ── Signatures ────────────────────────────────────────
            Section {
                FPASignatureRow(label: "Parent / Guardian Signature",
                                signed: vm.fpa?.parentSigned ?? false,
                                icon: "person.fill")
                FPASignatureRow(label: "Family Worker Signature",
                                signed: vm.fpa?.staffSigned ?? false,
                                icon: "person.badge.key.fill")
                if !(vm.fpa?.parentSigned ?? false) || !(vm.fpa?.staffSigned ?? false) {
                    Button {
                        showSignatureSheet = true
                    } label: {
                        Label("Collect Signatures", systemImage: "signature")
                            .foregroundColor(.cfPrimary)
                            .font(.subheadline.weight(.medium))
                    }
                }
            } header: {
                Label("Signatures", systemImage: "signature")
            }

            // ── FPA Metadata ──────────────────────────────────────
            if let fpa = vm.fpa {
                Section("Agreement Details") {
                    LabeledContent("Family Advocate", value: fpa.familyAdvocate)
                    if let completed = fpa.completedDate {
                        LabeledContent("Agreement Date",
                                       value: completed.formatted(date: .abbreviated, time: .omitted))
                    }
                    if let review = fpa.reviewDate {
                        LabeledContent("Next Review",
                                       value: review.formatted(date: .abbreviated, time: .omitted))
                    }
                    LabeledContent("Status") {
                        Text(fpa.status.rawValue)
                            .font(.caption.weight(.semibold))
                            .foregroundColor(fpa.status.color)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Partnership Agreement")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button("Log Visit", systemImage: "mappin.and.ellipse") {
                        showLogVisit = true
                    }
                    Button("Add Referral", systemImage: "arrow.turn.up.right") {
                        showAddReferral = true
                    }
                    Button("Collect Signatures", systemImage: "signature") {
                        showSignatureSheet = true
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showAddReferral) {
            AddReferralSheet(familyId: family.id) { newRef in
                vm.referrals.append(newRef)
            }
        }
        .sheet(isPresented: $showLogVisit) {
            LogVisitSheet(family: family) { visit in
                vm.visits.insert(visit, at: 0)
            }
        }
        .sheet(isPresented: $showSignatureSheet) {
            FPASignatureSheet(fpa: vm.fpa, familyName: family.name) { parentSig, staffSig in
                vm.updateSignatures(parent: parentSig, staff: staffSig)
            }
        }
        .alert("Couldn't Save Signatures", isPresented: .constant(vm.errorMessage != nil)) {
            Button("OK") { vm.errorMessage = nil }
        } message: { Text(vm.errorMessage ?? "") }
        .sheet(isPresented: $showEditStrengths) {
            EditStrengthsSheet(strengths: vm.strengths) { updated in
                vm.strengths = updated
            }
        }
        .task { await vm.load() }
    }
}

// MARK: - FPA Header Card

private struct FPAHeaderCard: View {
    let fpa: FamilyPartnershipAgreement?
    let visitCount: Int
    let referralCount: Int
    let activeGoalCount: Int

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                FPAStatCell(value: "\(activeGoalCount)", label: "Active Goals",
                            color: .cfPrimary, icon: "target")
                Divider().frame(height: 48)
                FPAStatCell(value: "\(visitCount)", label: "Visits Logged",
                            color: .cfAttendance, icon: "mappin.circle.fill")
                Divider().frame(height: 48)
                FPAStatCell(value: "\(referralCount)", label: "Referrals",
                            color: .cfFamily, icon: "arrow.turn.up.right")
            }
            .padding(.vertical, 14)
            .background(Color.cfSurface)

            if let fpa {
                HStack {
                    Image(systemName: "circle.fill")
                        .font(.system(size: 8))
                        .foregroundColor(fpa.status.color)
                    Text(fpa.status.rawValue)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(fpa.status.color)
                    Spacer()
                    if let review = fpa.reviewDate {
                        Text("Review: \(review.formatted(date: .abbreviated, time: .omitted))")
                            .font(.caption)
                            .foregroundColor(.cfTextSecondary)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(fpa.status.color.opacity(0.07))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .cfCardShadow()
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

private struct FPAStatCell: View {
    let value: String
    let label: String
    let color: Color
    let icon: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(color)
            Text(value)
                .font(.title2.weight(.bold))
                .foregroundColor(.cfTextPrimary)
            Text(label)
                .font(.caption2)
                .foregroundColor(.cfTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Visit Progress Bar

private struct FPAVisitProgressBar: View {
    let completed: Int
    let required: Int
    let programType: String

    var progress: Double { required > 0 ? min(Double(completed) / Double(required), 1.0) : 0 }
    var isOnTrack: Bool { completed >= Int(Double(required) * 0.5) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(programType) Visit Requirement")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.cfTextSecondary)
                Spacer()
                Text("\(completed) / \(required) visits")
                    .font(.caption.weight(.bold))
                    .foregroundColor(progress >= 1.0 ? .cfAttendance : .cfTextPrimary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.cfBorder)
                        .frame(height: 8)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(progress >= 1.0 ? Color.cfAttendance : Color.cfPrimary)
                        .frame(width: geo.size.width * progress, height: 8)
                }
            }
            .frame(height: 8)
            Text(progress >= 1.0
                 ? "✓ Requirement met for this program year"
                 : "\(required - completed) more visit\(required - completed == 1 ? "" : "s") needed this year")
                .font(.caption)
                .foregroundColor(progress >= 1.0 ? .cfAttendance : (isOnTrack ? .cfTextSecondary : .orange))
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Goals Summary Row

private struct FPAGoalsSummaryRow: View {
    let activeCount: Int
    let completedCount: Int
    let totalCount: Int

    var body: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(activeCount) Active")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.cfPrimary)
                Text("goals in progress")
                    .font(.caption)
                    .foregroundColor(.cfTextSecondary)
            }
            Spacer()
            if completedCount > 0 {
                Label("\(completedCount) completed", systemImage: "checkmark.seal.fill")
                    .font(.caption.weight(.medium))
                    .foregroundColor(.cfAttendance)
            }
        }
    }
}

private struct FPAGoalMiniRow: View {
    let goal: FamilyGoal

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: goal.category.icon)
                .font(.caption)
                .foregroundColor(.cfPrimary)
                .frame(width: 20)
            Text(goal.title)
                .font(.subheadline)
                .lineLimit(1)
            Spacer()
            Text(goal.status.rawValue)
                .font(.caption2.weight(.semibold))
                .foregroundColor(goal.status.color)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(goal.status.color.opacity(0.1))
                .clipShape(Capsule())
        }
    }
}

// MARK: - Referral Row

struct ReferralRow: View {
    let referral: FamilyReferral

    var isFollowUpOverdue: Bool {
        guard referral.status == .pending || referral.status == .contacted,
              let fu = referral.followUpDate else { return false }
        return fu < Date()
    }

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9)
                    .fill(referral.status.color.opacity(0.12))
                    .frame(width: 36, height: 36)
                Image(systemName: referral.serviceType.icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(referral.status.color)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(referral.agencyName)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(referral.serviceType.rawValue)
                    .font(.caption)
                    .foregroundColor(.cfTextSecondary)
                if let fu = referral.followUpDate {
                    HStack(spacing: 4) {
                        Image(systemName: isFollowUpOverdue ? "exclamationmark.circle.fill" : "calendar")
                            .font(.caption2)
                            .foregroundColor(isFollowUpOverdue ? .cfHealth : .cfTextSecondary)
                        Text("Follow-up: \(fu.formatted(date: .abbreviated, time: .omitted))")
                            .font(.caption2)
                            .foregroundColor(isFollowUpOverdue ? .cfHealth : .cfTextSecondary)
                    }
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Image(systemName: referral.status.icon)
                    .font(.system(size: 14))
                    .foregroundColor(referral.status.color)
                Text(referral.status.rawValue)
                    .font(.caption2)
                    .foregroundColor(referral.status.color)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Referral Detail View

struct ReferralDetailView: View {
    @State var referral: FamilyReferral
    let onUpdate: () -> Void
    @State private var showStatusPicker = false
    @State private var editNotes = ""
    @State private var editOutcome = ""
    @State private var isEditing = false
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            Section("Referral") {
                LabeledContent("Agency", value: referral.agencyName)
                LabeledContent("Service", value: referral.serviceType.rawValue)
                LabeledContent("Referred By", value: referral.referredBy)
                LabeledContent("Date",
                               value: referral.referralDate.formatted(date: .abbreviated, time: .omitted))
                if let fu = referral.followUpDate {
                    LabeledContent("Follow-up",
                                   value: fu.formatted(date: .abbreviated, time: .omitted))
                }
            }

            Section("Status") {
                Picker("Status", selection: $referral.status) {
                    ForEach(FamilyReferral.ReferralStatus.allCases, id: \.self) { s in
                        Label(s.rawValue, systemImage: s.icon).tag(s)
                    }
                }
                .onChange(of: referral.status) { _, _ in save() }
            }

            Section("Notes") {
                if referral.notes.isEmpty {
                    Text("No notes").foregroundColor(.secondary).font(.subheadline)
                } else {
                    Text(referral.notes).font(.subheadline)
                }
            }

            Section("Outcome Notes") {
                TextField("What happened with this referral?", text: $referral.outcomeNotes, axis: .vertical)
                    .font(.subheadline)
                    .lineLimit(3...6)
                    .onChange(of: referral.outcomeNotes) { _, _ in save() }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(referral.serviceType.rawValue)
        .navigationBarTitleDisplayMode(.inline)
        .alert("Couldn't Save Change", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: { Text(errorMessage ?? "") }
    }

    private func save() {
        Task {
            do {
                try await APIClient.shared.updateReferral(referral)
                onUpdate()
            } catch {
                // Previously swallowed via `try?` — the status/notes edit looked
                // saved even when it never reached the server. Surface it instead.
                errorMessage = "This change wasn't saved. Check your connection and try again."
            }
        }
    }
}

// MARK: - Visit Log Row

struct VisitLogRow: View {
    let visit: HomeVisitLog

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9)
                    .fill(Color.cfAttendance.opacity(0.12))
                    .frame(width: 36, height: 36)
                Image(systemName: visit.visitType.icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.cfAttendance)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(visit.visitType.rawValue)
                    .font(.subheadline.weight(.medium))
                Text(visit.visitDate.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.cfTextSecondary)
                HStack(spacing: 6) {
                    Label(visit.durationLabel, systemImage: "clock")
                        .font(.caption2)
                        .foregroundColor(.cfTextSecondary)
                    if visit.locationVerified {
                        Label("GPS", systemImage: "location.fill")
                            .font(.caption2)
                            .foregroundColor(.cfPrimary)
                    }
                }
            }
            Spacer()
            if !visit.topicsCovered.isEmpty {
                Text("\(visit.topicsCovered.count) topics")
                    .font(.caption2)
                    .foregroundColor(.cfPrimary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.cfPrimary.opacity(0.1))
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Visit Detail View

struct VisitDetailView: View {
    let visit: HomeVisitLog

    var body: some View {
        List {
            Section("Visit Summary") {
                LabeledContent("Type", value: visit.visitType.rawValue)
                LabeledContent("Date",
                               value: visit.visitDate.formatted(date: .long, time: .omitted))
                LabeledContent("Duration", value: visit.durationLabel)
                LabeledContent("Conducted By", value: visit.conductedBy)
                if visit.locationVerified {
                    LabeledContent("Location") {
                        Label("GPS Verified", systemImage: "location.fill")
                            .foregroundColor(.cfPrimary)
                            .font(.caption)
                    }
                }
            }

            Section("Topics Covered") {
                if visit.topicsCovered.isEmpty {
                    Text("None recorded").foregroundColor(.secondary)
                } else {
                    ForEach(visit.topicsCovered, id: \.self) { topic in
                        Label(topic.rawValue, systemImage: "checkmark.circle.fill")
                            .font(.subheadline)
                            .foregroundColor(.cfPrimary)
                    }
                }
            }

            if !visit.notes.isEmpty {
                Section("Notes") {
                    Text(visit.notes)
                        .font(.subheadline)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(visit.visitType.rawValue)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Signature Row

private struct FPASignatureRow: View {
    let label: String
    let signed: Bool
    let icon: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(signed ? .cfAttendance : .cfTextSecondary)
                .frame(width: 24)
            Text(label)
                .font(.subheadline)
            Spacer()
            if signed {
                Label("Signed", systemImage: "checkmark.circle.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.cfAttendance)
            } else {
                Text("Pending")
                    .font(.caption)
                    .foregroundColor(.orange)
            }
        }
    }
}

// MARK: - Add Referral Sheet

struct AddReferralSheet: View {
    let familyId: String
    let onAdd: (FamilyReferral) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var agencyName = ""
    @State private var serviceType = FamilyReferral.ReferralService.housing
    @State private var notes = ""
    @State private var followUpDate = Date().addingTimeInterval(14 * 24 * 3600)
    @State private var hasFollowUp = true
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Agency") {
                    TextField("Agency name", text: $agencyName)
                    Picker("Service Type", selection: $serviceType) {
                        ForEach(FamilyReferral.ReferralService.allCases, id: \.self) { s in
                            Label(s.rawValue, systemImage: s.icon).tag(s)
                        }
                    }
                }
                Section("Follow-up") {
                    Toggle("Set follow-up date", isOn: $hasFollowUp)
                    if hasFollowUp {
                        DatePicker("Follow-up Date", selection: $followUpDate,
                                   displayedComponents: .date)
                    }
                }
                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                        .overlay(alignment: .topLeading) {
                            if notes.isEmpty {
                                Text("Reason for referral, context…")
                                    .foregroundColor(.secondary)
                                    .padding(4)
                                    .allowsHitTesting(false)
                            }
                        }
                }
            }
            .navigationTitle("Add Referral")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .disabled(agencyName.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
            .alert("Couldn't Add Referral", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
    }

    private func save() {
        isSaving = true
        let ref = FamilyReferral(
            id: UUID().uuidString, familyId: familyId,
            agencyName: agencyName.trimmingCharacters(in: .whitespaces),
            serviceType: serviceType, referredBy: "Current User",
            referralDate: Date(),
            followUpDate: hasFollowUp ? followUpDate : nil,
            status: .pending, notes: notes, outcomeNotes: ""
        )
        Task {
            do {
                try await APIClient.shared.addReferral(ref)
                await MainActor.run {
                    onAdd(ref)
                    dismiss()
                }
            } catch {
                // `try?` used to swallow this — the referral looked added even
                // when it never reached the server. Keep the form open instead.
                await MainActor.run {
                    errorMessage = "This referral wasn't added. Check your connection and try again."
                }
            }
            isSaving = false
        }
    }
}

// MARK: - Log Visit Sheet

struct LogVisitSheet: View {
    let family: Family
    let onSave: (HomeVisitLog) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var visitType = HomeVisitLog.VisitType.homeVisit
    @State private var visitDate = Date()
    @State private var durationHours = 1
    @State private var durationMinutes = 30
    @State private var selectedTopics: Set<HomeVisitLog.VisitTopic> = []
    @State private var notes = ""
    @State private var captureGPS = true
    @State private var isSaving = false
    @State private var errorMessage: String?

    var totalMinutes: Int { durationHours * 60 + durationMinutes }

    var body: some View {
        NavigationStack {
            Form {
                Section("Visit Details") {
                    Picker("Type", selection: $visitType) {
                        ForEach(HomeVisitLog.VisitType.allCases, id: \.self) { t in
                            Label(t.rawValue, systemImage: t.icon).tag(t)
                        }
                    }
                    DatePicker("Date", selection: $visitDate, displayedComponents: .date)
                }

                Section("Duration") {
                    HStack {
                        Picker("Hours", selection: $durationHours) {
                            ForEach(0...4, id: \.self) { h in
                                Text("\(h)h").tag(h)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(maxWidth: .infinity)
                        Picker("Minutes", selection: $durationMinutes) {
                            ForEach([0, 15, 30, 45], id: \.self) { m in
                                Text("\(m)m").tag(m)
                            }
                        }
                        .pickerStyle(.wheel)
                        .frame(maxWidth: .infinity)
                    }
                    .frame(height: 100)
                }

                Section("Topics Covered") {
                    ForEach(HomeVisitLog.VisitTopic.allCases, id: \.self) { topic in
                        Button {
                            if selectedTopics.contains(topic) {
                                selectedTopics.remove(topic)
                            } else {
                                selectedTopics.insert(topic)
                            }
                        } label: {
                            HStack {
                                Text(topic.rawValue)
                                    .foregroundColor(.primary)
                                Spacer()
                                if selectedTopics.contains(topic) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.cfPrimary)
                                }
                            }
                        }
                    }
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 100)
                        .overlay(alignment: .topLeading) {
                            if notes.isEmpty {
                                Text("Summary of visit, observations, next steps…")
                                    .foregroundColor(.secondary)
                                    .padding(4)
                                    .allowsHitTesting(false)
                            }
                        }
                }

                if visitType == .homeVisit {
                    Section {
                        Toggle("Verify location (GPS timestamp)", isOn: $captureGPS)
                    } footer: {
                        Text("GPS verification documents that the visit occurred at the family's home address.")
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Log \(visitType.rawValue)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(totalMinutes < 15 || isSaving)
                }
            }
            .alert("Couldn't Save Visit Log", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
    }

    private func save() {
        isSaving = true
        let visit = HomeVisitLog(
            id: UUID().uuidString, familyId: family.id,
            visitDate: visitDate, visitType: visitType,
            durationMinutes: totalMinutes,
            conductedBy: "Current User",
            topicsCovered: Array(selectedTopics),
            notes: notes, goalsMentioned: [],
            locationVerified: visitType == .homeVisit && captureGPS
        )
        Task {
            do {
                try await APIClient.shared.logHomeVisit(visit)
                await MainActor.run {
                    onSave(visit)
                    dismiss()
                }
            } catch {
                // A home-visit log documents required contact hours — losing it
                // silently (the old `try?` behavior) is a compliance risk.
                await MainActor.run {
                    errorMessage = "This visit log wasn't saved. Check your connection and try again."
                }
            }
            isSaving = false
        }
    }
}

// MARK: - Signature Sheet

struct FPASignatureSheet: View {
    let fpa: FamilyPartnershipAgreement?
    let familyName: String
    let onSign: (Bool, Bool) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var parentSigned: Bool
    @State private var staffSigned: Bool

    init(fpa: FamilyPartnershipAgreement?, familyName: String, onSign: @escaping (Bool, Bool) -> Void) {
        self.fpa = fpa
        self.familyName = familyName
        self.onSign = onSign
        _parentSigned = State(initialValue: fpa?.parentSigned ?? false)
        _staffSigned = State(initialValue: fpa?.staffSigned ?? false)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("By signing this Family Partnership Agreement, both parties acknowledge the goals, services, and commitments outlined in this agreement for the \(familyName) family.")
                        .font(.subheadline)
                        .foregroundColor(.cfTextSecondary)
                        .padding(.vertical, 4)
                }

                Section("Signatures") {
                    Toggle("Parent / Guardian has signed", isOn: $parentSigned)
                    Toggle("Family Worker has signed", isOn: $staffSigned)
                }

                if parentSigned && staffSigned {
                    Section {
                        Label("Agreement is fully signed and active",
                              systemImage: "checkmark.seal.fill")
                            .foregroundColor(.cfAttendance)
                            .font(.subheadline.weight(.medium))
                    }
                }
            }
            .navigationTitle("Collect Signatures")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSign(parentSigned, staffSigned)
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Edit Strengths Sheet

struct EditStrengthsSheet: View {
    @State var strengths: [String]
    let onSave: ([String]) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var newStrength = ""

    let suggestions = [
        "Strong family bonds", "Consistent attendance", "Active parent participation",
        "Community connections", "Multilingual household", "Resilience through challenges",
        "Supportive extended family", "Strong work ethic", "Positive attitude toward learning"
    ]

    var body: some View {
        NavigationStack {
            List {
                Section("Current Strengths") {
                    if strengths.isEmpty {
                        Text("No strengths added yet")
                            .foregroundColor(.secondary)
                            .font(.subheadline)
                    } else {
                        ForEach(strengths, id: \.self) { s in
                            HStack {
                                Image(systemName: "star.fill")
                                    .foregroundColor(.cfGoals)
                                    .font(.caption)
                                Text(s)
                                    .font(.subheadline)
                            }
                        }
                        .onDelete { idx in strengths.remove(atOffsets: idx) }
                    }
                }

                Section("Add a Strength") {
                    HStack {
                        TextField("Type a strength…", text: $newStrength)
                        Button("Add") {
                            let s = newStrength.trimmingCharacters(in: .whitespaces)
                            if !s.isEmpty && !strengths.contains(s) {
                                strengths.append(s)
                                newStrength = ""
                            }
                        }
                        .disabled(newStrength.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }

                Section("Suggested Strengths") {
                    ForEach(suggestions.filter { !strengths.contains($0) }, id: \.self) { s in
                        Button {
                            strengths.append(s)
                        } label: {
                            Label(s, systemImage: "plus.circle")
                                .font(.subheadline)
                                .foregroundColor(.cfPrimary)
                        }
                    }
                }
            }
            .navigationTitle("Family Strengths")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(strengths)
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    EditButton()
                }
            }
        }
    }
}

// MARK: - FPA View Model

@MainActor
final class FPAViewModel: ObservableObject {
    let family: Family
    @Published var fpa: FamilyPartnershipAgreement?
    @Published var referrals: [FamilyReferral] = []
    @Published var visits: [HomeVisitLog] = []
    @Published var goals: [FamilyGoal] = []
    @Published var strengths: [String] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    // Head Start visit requirements by program type
    var programType: String { "Center-Based" }
    var requiredVisits: Int { 2 } // center-based minimum; home-based = 32–46

    var activeGoalCount: Int { goals.filter { $0.status == .inProgress }.count }
    var completedGoalCount: Int { goals.filter { $0.status == .completed }.count }

    init(family: Family) { self.family = family }

    func load() async {
        isLoading = true
        async let fpaResult = loadFPA()
        async let referralsResult = loadReferrals()
        async let visitsResult = loadVisits()
        async let goalsResult = loadGoals()
        (fpa, referrals, visits, goals) = await (fpaResult, referralsResult, visitsResult, goalsResult)

        // Default strengths from FNA if available
        if strengths.isEmpty {
            strengths = family.goals.isEmpty ? [] : ["Consistent program participation"]
        }
        isLoading = false
    }

    func updateSignatures(parent: Bool, staff: Bool) {
        guard let existing = fpa else { return }
        let previous = fpa
        let newStatus: FamilyPartnershipAgreement.FPAStatus = (parent && staff) ? .active : .inProgress
        let updated = FamilyPartnershipAgreement(
            id: existing.id, familyId: existing.familyId,
            familyName: existing.familyName,
            completedDate: (parent && staff) ? Date() : existing.completedDate,
            reviewDate: existing.reviewDate,
            familyAdvocate: existing.familyAdvocate,
            status: newStatus, parentSigned: parent, staffSigned: staff
        )
        fpa = updated
        Task {
            do {
                try await APIClient.shared.updateFPA(updated)
            } catch {
                // This used to be a fire-and-forget `try?` — the sheet would show
                // "fully signed" even if the signature never reached the server.
                // A signature is a legal record; revert and tell the user.
                await MainActor.run {
                    self.fpa = previous
                    self.errorMessage = "Signatures weren't saved. Check your connection and try again."
                }
            }
        }
    }

    // MARK: private loaders
    private func loadFPA() async -> FamilyPartnershipAgreement? {
        do { return try await APIClient.shared.getFPA(familyId: family.id) }
        catch {
            #if DEBUG
            return MockData.fpa(for: family.id)
            #else
            return nil
            #endif
        }
    }

    private func loadReferrals() async -> [FamilyReferral] {
        do { return try await APIClient.shared.getReferrals(familyId: family.id) }
        catch {
            #if DEBUG
            return MockData.referrals(for: family.id)
            #else
            return []
            #endif
        }
    }

    private func loadVisits() async -> [HomeVisitLog] {
        do { return try await APIClient.shared.getVisitLogs(familyId: family.id) }
        catch {
            #if DEBUG
            return MockData.visitLogs(for: family.id)
            #else
            return []
            #endif
        }
    }

    private func loadGoals() async -> [FamilyGoal] {
        do { return try await APIClient.shared.getGoals(familyId: family.id) }
        catch {
            #if DEBUG
            return MockData.goals(for: family.id)
            #else
            return []
            #endif
        }
    }
}
