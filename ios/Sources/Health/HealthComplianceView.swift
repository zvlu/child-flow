import SwiftUI

// MARK: - Health Compliance Deadline Tracker
// Head Start Performance Standards §1302.42 — 45-day health / 90-day dental
// Also covers safety drills and mental health consultation logs.

struct HealthComplianceView: View {
    @StateObject private var vm = HealthComplianceViewModel()
    @State private var selectedFilter: FilterMode = .all
    @State private var showLogDrill = false
    @State private var showLogConsult = false
    @State private var showMarkScreening: ChildHealthCompliance? = nil

    enum FilterMode: String, CaseIterable {
        case all = "All"
        case urgent = "Urgent"
        case pending = "Pending"
        case done = "Done"
    }

    var filteredChildren: [ChildHealthCompliance] {
        switch selectedFilter {
        case .all: return vm.children
        case .urgent:
            return vm.children.filter {
                $0.healthStatus == .overdue || $0.healthStatus == .critical ||
                $0.dentalStatus == .overdue || $0.dentalStatus == .critical
            }
        case .pending:
            return vm.children.filter {
                $0.healthScreeningDate == nil || $0.dentalScreeningDate == nil
            }
        case .done:
            return vm.children.filter {
                $0.healthScreeningDate != nil && $0.dentalScreeningDate != nil
            }
        }
    }

    var body: some View {
        List {
            // ── Program compliance summary ──────────────────────────
            Section {
                HealthComplianceSummaryCard(children: vm.children)
            }
            .listRowInsets(.init())
            .listRowBackground(Color.clear)

            // ── Filter pills ────────────────────────────────────────
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(FilterMode.allCases, id: \.self) { mode in
                            ComplianceFilterPill(label: mode.rawValue,
                                       count: countFor(mode),
                                       isSelected: selectedFilter == mode) {
                                selectedFilter = mode
                            }
                        }
                    }
                    .padding(.horizontal, 4)
                }
            }
            .listRowInsets(.init(.init(top: 0, leading: 12, bottom: 0, trailing: 12)))
            .listRowBackground(Color.clear)

            // ── Per-child rows ──────────────────────────────────────
            Section {
                if filteredChildren.isEmpty {
                    Text("No children match this filter")
                        .font(.subheadline)
                        .foregroundColor(.cfTextSecondary)
                } else {
                    ForEach(filteredChildren.sorted {
                        min($0.healthStatus.priority, $0.dentalStatus.priority) <
                        min($1.healthStatus.priority, $1.dentalStatus.priority)
                    }) { child in
                        NavigationLink(destination: ChildComplianceDetailView(child: child, onUpdate: {
                            Task { await vm.load() }
                        })) {
                            ChildComplianceRow(child: child)
                        }
                    }
                }
            } header: {
                Text("Children (\(filteredChildren.count))")
            }

            // ── Safety Drills ───────────────────────────────────────
            Section {
                ForEach(vm.drills.prefix(4)) { drill in
                    NavigationLink(destination: DrillDetailView(drill: drill)) {
                        DrillRow(drill: drill)
                    }
                }
                if vm.drills.count > 4 {
                    NavigationLink("See all \(vm.drills.count) drills") {
                        AllDrillsView(drills: vm.drills)
                    }
                    .font(.subheadline)
                    .foregroundColor(.cfPrimary)
                }
            } header: {
                HStack {
                    Label("Safety Drills", systemImage: "flame.fill")
                        .foregroundColor(.orange)
                    Spacer()
                    Button { showLogDrill = true } label: {
                        Image(systemName: "plus.circle.fill").foregroundColor(.orange)
                    }
                }
            } footer: {
                let lastDrill = vm.drills.max { $0.drillDate < $1.drillDate }
                if let d = lastDrill {
                    Text("Last drill: \(d.drillDate.formatted(date: .abbreviated, time: .omitted)) (\(d.drillType.rawValue))")
                        .font(.caption)
                }
            }

            // ── Mental Health Consults ──────────────────────────────
            Section {
                ForEach(vm.consults.prefix(4)) { consult in
                    NavigationLink(destination: ConsultDetailView(consult: consult)) {
                        ConsultRow(consult: consult)
                    }
                }
                if vm.consults.count > 4 {
                    NavigationLink("See all \(vm.consults.count) consults") {
                        AllConsultsView(consults: vm.consults)
                    }
                    .font(.subheadline)
                    .foregroundColor(.cfPrimary)
                }
            } header: {
                HStack {
                    Label("Mental Health Consults", systemImage: "brain.head.profile")
                        .foregroundColor(.cfPrimary)
                    Spacer()
                    Button { showLogConsult = true } label: {
                        Image(systemName: "plus.circle.fill").foregroundColor(.cfPrimary)
                    }
                }
            } footer: {
                // Head Start requires minimum 1 MH consult per month
                let thisMonth = vm.consults.filter {
                    Calendar.current.isDate($0.consultDate, equalTo: Date(), toGranularity: .month)
                }.count
                Text("\(thisMonth) consult\(thisMonth == 1 ? "" : "s") this month (minimum 1 required)")
                    .font(.caption)
                    .foregroundColor(thisMonth == 0 ? .cfHealth : .cfTextSecondary)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Health Compliance")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showLogDrill) {
            LogDrillSheet { drill in vm.drills.insert(drill, at: 0) }
        }
        .sheet(isPresented: $showLogConsult) {
            LogConsultSheet { consult in vm.consults.insert(consult, at: 0) }
        }
        .task { await vm.load() }
        .overlay { if vm.isLoading { ProgressView() } }
    }

    private func countFor(_ mode: FilterMode) -> Int {
        switch mode {
        case .all: return vm.children.count
        case .urgent:
            return vm.children.filter {
                $0.healthStatus == .overdue || $0.healthStatus == .critical ||
                $0.dentalStatus == .overdue || $0.dentalStatus == .critical
            }.count
        case .pending:
            return vm.children.filter {
                $0.healthScreeningDate == nil || $0.dentalScreeningDate == nil
            }.count
        case .done:
            return vm.children.filter {
                $0.healthScreeningDate != nil && $0.dentalScreeningDate != nil
            }.count
        }
    }
}

// MARK: - Summary Card

private struct HealthComplianceSummaryCard: View {
    let children: [ChildHealthCompliance]

    var healthDone: Int { children.filter { $0.healthScreeningDate != nil }.count }
    var dentalDone: Int { children.filter { $0.dentalScreeningDate != nil }.count }
    var overdue: Int {
        children.filter {
            $0.healthStatus == .overdue || $0.dentalStatus == .overdue
        }.count
    }
    var urgent: Int {
        children.filter {
            $0.healthStatus == .critical || $0.dentalStatus == .critical
        }.count
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ComplianceStat(value: "\(healthDone)/\(children.count)",
                               label: "Health Done", color: .cfAttendance,
                               icon: "heart.text.square.fill")
                Divider().frame(height: 48)
                ComplianceStat(value: "\(dentalDone)/\(children.count)",
                               label: "Dental Done", color: .cfPrimary,
                               icon: "tooth.fill")
                Divider().frame(height: 48)
                ComplianceStat(value: "\(overdue + urgent)",
                               label: "Need Action",
                               color: overdue > 0 ? .cfHealth : (urgent > 0 ? .orange : .cfAttendance),
                               icon: overdue > 0 ? "xmark.circle.fill" : "exclamationmark.circle.fill")
            }
            .padding(.vertical, 14)
            .background(Color.cfSurface)

            // Compliance bar
            ComplianceProgressBar(healthDone: healthDone, dentalDone: dentalDone, total: children.count)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color.cfPrimary.opacity(0.05))
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .cfCardShadow()
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

private struct ComplianceStat: View {
    let value: String; let label: String; let color: Color; let icon: String
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundColor(color)
            Text(value).font(.title2.weight(.bold)).foregroundColor(.cfTextPrimary)
            Text(label).font(.caption2).foregroundColor(.cfTextSecondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct ComplianceProgressBar: View {
    let healthDone: Int; let dentalDone: Int; let total: Int
    var healthPct: Double { total > 0 ? Double(healthDone) / Double(total) : 0 }
    var dentalPct: Double { total > 0 ? Double(dentalDone) / Double(total) : 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label("45-Day Health", systemImage: "heart.fill").font(.caption2).foregroundColor(.cfAttendance)
                Spacer()
                Text("\(Int(healthPct * 100))%").font(.caption2.weight(.bold)).foregroundColor(.cfAttendance)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3).fill(Color.cfBorder).frame(height: 6)
                    RoundedRectangle(cornerRadius: 3).fill(Color.cfAttendance).frame(width: geo.size.width * healthPct, height: 6)
                }
            }
            .frame(height: 6)

            HStack {
                Label("90-Day Dental", systemImage: "tooth.fill").font(.caption2).foregroundColor(.cfPrimary)
                Spacer()
                Text("\(Int(dentalPct * 100))%").font(.caption2.weight(.bold)).foregroundColor(.cfPrimary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3).fill(Color.cfBorder).frame(height: 6)
                    RoundedRectangle(cornerRadius: 3).fill(Color.cfPrimary).frame(width: geo.size.width * dentalPct, height: 6)
                }
            }
            .frame(height: 6)
        }
    }
}

// MARK: - Child Row

struct ChildComplianceRow: View {
    let child: ChildHealthCompliance

    var worstStatus: ChildHealthCompliance.ComplianceStatus {
        [child.healthStatus, child.dentalStatus].min { $0.priority < $1.priority } ?? .onTrack
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(child.childName)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                ComplianceBadge(status: worstStatus)
            }

            HStack(spacing: 12) {
                // Health countdown
                ScreeningChip(
                    label: "Health",
                    icon: "heart.fill",
                    status: child.healthStatus,
                    daysRemaining: child.healthScreeningDate != nil ? nil : child.healthDaysRemaining,
                    isCompleted: child.healthScreeningDate != nil
                )
                // Dental countdown
                ScreeningChip(
                    label: "Dental",
                    icon: "tooth.fill",
                    status: child.dentalStatus,
                    daysRemaining: child.dentalScreeningDate != nil ? nil : child.dentalDaysRemaining,
                    isCompleted: child.dentalScreeningDate != nil
                )
            }
        }
        .padding(.vertical, 4)
    }
}

private struct ScreeningChip: View {
    let label: String
    let icon: String
    let status: ChildHealthCompliance.ComplianceStatus
    let daysRemaining: Int?
    let isCompleted: Bool

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: isCompleted ? "checkmark.circle.fill" : icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(status.color)
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.caption2.weight(.medium))
                    .foregroundColor(status.color)
                if isCompleted {
                    Text("Done").font(.caption2).foregroundColor(.cfTextSecondary)
                } else if let d = daysRemaining {
                    Text(d < 0 ? "\(abs(d))d overdue" : "\(d)d left")
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(status.color)
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(status.color.opacity(0.1))
        .clipShape(Capsule())
    }
}

private struct ComplianceBadge: View {
    let status: ChildHealthCompliance.ComplianceStatus
    var body: some View {
        Label(status.rawValue, systemImage: status.icon)
            .font(.caption2.weight(.semibold))
            .foregroundColor(status.color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(status.color.opacity(0.1))
            .clipShape(Capsule())
    }
}

// MARK: - Filter Pill

private struct ComplianceFilterPill: View {
    let label: String
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(label)
                if count > 0 {
                    Text("\(count)")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(isSelected ? Color.white.opacity(0.3) : Color.cfPrimary.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
            .font(.caption.weight(.medium))
            .foregroundColor(isSelected ? .white : .cfPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(isSelected ? Color.cfPrimary : Color.cfPrimary.opacity(0.1))
            .clipShape(Capsule())
        }
    }
}

// MARK: - Child Compliance Detail View

struct ChildComplianceDetailView: View {
    @State var child: ChildHealthCompliance
    let onUpdate: () -> Void
    @State private var showMarkHealth = false
    @State private var showMarkDental = false
    @State private var showMarkVision = false
    @State private var showMarkHearing = false
    @State private var showMarkDevelopmental = false

    var body: some View {
        List {
            // ── Screening Status Cards ─────────────────────────────
            Section("Screenings") {
                ScreeningDetailRow(
                    label: "45-Day Health Screening",
                    icon: "heart.fill",
                    deadline: child.healthDeadline,
                    completedDate: child.healthScreeningDate,
                    status: child.healthStatus
                ) { showMarkHealth = true }

                ScreeningDetailRow(
                    label: "90-Day Dental Screening",
                    icon: "tooth.fill",
                    deadline: child.dentalDeadline,
                    completedDate: child.dentalScreeningDate,
                    status: child.dentalStatus
                ) { showMarkDental = true }

                ScreeningDetailRow(
                    label: "Vision Screening",
                    icon: "eye.fill",
                    deadline: child.healthDeadline,
                    completedDate: child.visionScreeningDate,
                    status: child.visionScreeningDate != nil ? .completed : .onTrack
                ) { showMarkVision = true }

                ScreeningDetailRow(
                    label: "Hearing Screening",
                    icon: "ear.fill",
                    deadline: child.healthDeadline,
                    completedDate: child.hearingScreeningDate,
                    status: child.hearingScreeningDate != nil ? .completed : .onTrack
                ) { showMarkHearing = true }

                ScreeningDetailRow(
                    label: "Developmental Screening",
                    icon: "figure.child",
                    deadline: child.healthDeadline,
                    completedDate: child.developmentalScreeningDate,
                    status: child.developmentalScreeningDate != nil ? .completed : .onTrack
                ) { showMarkDevelopmental = true }
            }

            // ── Enrollment info ─────────────────────────────────────
            Section("Enrollment") {
                LabeledContent("Enrolled",
                               value: child.enrollmentDate.formatted(date: .abbreviated, time: .omitted))
                LabeledContent("45-Day Health Deadline",
                               value: child.healthDeadline.formatted(date: .abbreviated, time: .omitted))
                LabeledContent("90-Day Dental Deadline",
                               value: child.dentalDeadline.formatted(date: .abbreviated, time: .omitted))
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(child.childName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showMarkHealth) {
            MarkScreeningSheet(label: "45-Day Health Screening") { date in
                child.healthScreeningDate = date
                Task { try? await APIClient.shared.updateHealthCompliance(child); onUpdate() }
            }
        }
        .sheet(isPresented: $showMarkDental) {
            MarkScreeningSheet(label: "90-Day Dental Screening") { date in
                child.dentalScreeningDate = date
                Task { try? await APIClient.shared.updateHealthCompliance(child); onUpdate() }
            }
        }
        .sheet(isPresented: $showMarkVision) {
            MarkScreeningSheet(label: "Vision Screening") { date in
                child.visionScreeningDate = date
                Task { try? await APIClient.shared.updateHealthCompliance(child); onUpdate() }
            }
        }
        .sheet(isPresented: $showMarkHearing) {
            MarkScreeningSheet(label: "Hearing Screening") { date in
                child.hearingScreeningDate = date
                Task { try? await APIClient.shared.updateHealthCompliance(child); onUpdate() }
            }
        }
        .sheet(isPresented: $showMarkDevelopmental) {
            MarkScreeningSheet(label: "Developmental Screening") { date in
                child.developmentalScreeningDate = date
                Task { try? await APIClient.shared.updateHealthCompliance(child); onUpdate() }
            }
        }
    }
}

private struct ScreeningDetailRow: View {
    let label: String
    let icon: String
    let deadline: Date
    let completedDate: Date?
    let status: ChildHealthCompliance.ComplianceStatus
    let onMark: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label(label, systemImage: icon)
                    .font(.subheadline.weight(.medium))
                Spacer()
                ComplianceBadge(status: status)
            }
            if let done = completedDate {
                Text("Completed \(done.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundColor(.cfAttendance)
            } else {
                HStack {
                    Text("Deadline: \(deadline.formatted(date: .abbreviated, time: .omitted))")
                        .font(.caption)
                        .foregroundColor(status.color)
                    Spacer()
                    Button("Mark Complete") { onMark() }
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.cfPrimary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Mark Screening Sheet

private struct MarkScreeningSheet: View {
    let label: String
    let onSave: (Date) -> Void
    @State private var date = Date()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section(label) {
                    DatePicker("Screening Date", selection: $date,
                               in: ...Date(), displayedComponents: .date)
                }
            }
            .navigationTitle("Mark as Completed")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { onSave(date); dismiss() }
                }
            }
        }
    }
}

// MARK: - Safety Drill Views

private struct DrillRow: View {
    let drill: SafetyDrillLog
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(Color.orange.opacity(0.12)).frame(width: 34, height: 34)
                Image(systemName: drill.drillType.icon).font(.system(size: 14, weight: .semibold)).foregroundColor(.orange)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(drill.drillType.rawValue).font(.subheadline.weight(.medium))
                Text(drill.drillDate.formatted(date: .abbreviated, time: .omitted)).font(.caption).foregroundColor(.cfTextSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(drill.durationMinutes) min").font(.caption.weight(.semibold)).foregroundColor(.cfTextPrimary)
                Text("\(drill.participantCount) people").font(.caption2).foregroundColor(.cfTextSecondary)
            }
        }
    }
}

struct DrillDetailView: View {
    let drill: SafetyDrillLog
    var body: some View {
        List {
            Section("Drill Details") {
                LabeledContent("Type", value: drill.drillType.rawValue)
                LabeledContent("Date", value: drill.drillDate.formatted(date: .long, time: .omitted))
                LabeledContent("Duration", value: "\(drill.durationMinutes) minutes")
                LabeledContent("Participants", value: "\(drill.participantCount) people")
                LabeledContent("Led by", value: drill.conductedBy)
            }
            if !drill.notes.isEmpty {
                Section("Notes") { Text(drill.notes).font(.subheadline) }
            }
            if !drill.issuesFound.isEmpty {
                Section("Issues Found") {
                    VStack(alignment: .leading) {
                        Text(drill.issuesFound).font(.subheadline)
                        if let resolved = drill.resolvedDate {
                            Label("Resolved \(resolved.formatted(date: .abbreviated, time: .omitted))",
                                  systemImage: "checkmark.circle.fill")
                                .foregroundColor(.cfAttendance).font(.caption)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(drill.drillType.rawValue)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AllDrillsView: View {
    let drills: [SafetyDrillLog]
    var body: some View {
        List {
            ForEach(drills) { drill in
                NavigationLink(destination: DrillDetailView(drill: drill)) {
                    DrillRow(drill: drill)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("All Safety Drills")
    }
}

// MARK: - Log Drill Sheet

struct LogDrillSheet: View {
    let onSave: (SafetyDrillLog) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var drillType = SafetyDrillLog.DrillType.fireEvacuation
    @State private var drillDate = Date()
    @State private var durationMinutes = 5
    @State private var participantCount = 60
    @State private var notes = ""
    @State private var issuesFound = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Drill") {
                    Picker("Drill Type", selection: $drillType) {
                        ForEach(SafetyDrillLog.DrillType.allCases, id: \.self) { t in
                            Label(t.rawValue, systemImage: t.icon).tag(t)
                        }
                    }
                    DatePicker("Date", selection: $drillDate, in: ...Date(), displayedComponents: .date)
                }
                Section("Details") {
                    Stepper("Duration: \(durationMinutes) min",
                            value: $durationMinutes, in: 1...60)
                    Stepper("Participants: \(participantCount)",
                            value: $participantCount, in: 1...200)
                }
                Section("Notes") {
                    TextEditor(text: $notes).frame(minHeight: 60)
                }
                Section("Issues Found") {
                    TextEditor(text: $issuesFound).frame(minHeight: 60)
                }
            }
            .navigationTitle("Log Safety Drill")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let drill = SafetyDrillLog(
                            id: UUID().uuidString, drillType: drillType, drillDate: drillDate,
                            conductedBy: "Current User", durationMinutes: durationMinutes,
                            participantCount: participantCount, notes: notes,
                            issuesFound: issuesFound, resolvedDate: nil
                        )
                        Task { try? await APIClient.shared.logSafetyDrill(drill) }
                        onSave(drill)
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Mental Health Consult Views

private struct ConsultRow: View {
    let consult: MentalHealthConsult
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(Color.cfPrimary.opacity(0.1)).frame(width: 34, height: 34)
                Image(systemName: consult.consultType.icon).font(.system(size: 13, weight: .semibold)).foregroundColor(.cfPrimary)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(consult.consultType.rawValue).font(.subheadline.weight(.medium))
                if let name = consult.childName {
                    Text(name).font(.caption).foregroundColor(.cfTextSecondary)
                } else {
                    Text("Program-level").font(.caption).foregroundColor(.cfTextSecondary)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(consult.consultDate.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption).foregroundColor(.cfTextSecondary)
                if let fu = consult.followUpDate, fu > Date() {
                    Text("Follow-up \(fu.formatted(date: .abbreviated, time: .omitted))")
                        .font(.caption2).foregroundColor(.orange)
                }
            }
        }
    }
}

struct ConsultDetailView: View {
    let consult: MentalHealthConsult
    var body: some View {
        List {
            Section("Consult") {
                LabeledContent("Type", value: consult.consultType.rawValue)
                LabeledContent("Date", value: consult.consultDate.formatted(date: .long, time: .omitted))
                LabeledContent("Consultant", value: consult.consultantName)
                if let name = consult.childName {
                    LabeledContent("Child", value: name)
                }
            }
            Section("Summary") { Text(consult.summary).font(.subheadline) }
            if let fu = consult.followUpDate {
                Section("Follow-up") {
                    LabeledContent("Date", value: fu.formatted(date: .abbreviated, time: .omitted))
                    if !consult.followUpNotes.isEmpty {
                        Text(consult.followUpNotes).font(.subheadline)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(consult.consultType.rawValue)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AllConsultsView: View {
    let consults: [MentalHealthConsult]
    var body: some View {
        List {
            ForEach(consults) { consult in
                NavigationLink(destination: ConsultDetailView(consult: consult)) {
                    ConsultRow(consult: consult)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Mental Health Consults")
    }
}

// MARK: - Log Consult Sheet

struct LogConsultSheet: View {
    let onSave: (MentalHealthConsult) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var consultType = MentalHealthConsult.ConsultType.behaviorSupport
    @State private var consultDate = Date()
    @State private var consultantName = "Dr. Sarah Okafor"
    @State private var childName = ""
    @State private var summary = ""
    @State private var hasFollowUp = false
    @State private var followUpDate = Calendar.current.date(byAdding: .day, value: 14, to: Date())!
    @State private var isChildLevel = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Consult") {
                    Picker("Type", selection: $consultType) {
                        ForEach(MentalHealthConsult.ConsultType.allCases, id: \.self) { t in
                            Label(t.rawValue, systemImage: t.icon).tag(t)
                        }
                    }
                    DatePicker("Date", selection: $consultDate, in: ...Date(), displayedComponents: .date)
                    TextField("Consultant Name", text: $consultantName)
                }
                Section {
                    Toggle("Child-specific consult", isOn: $isChildLevel)
                    if isChildLevel {
                        TextField("Child name", text: $childName)
                    }
                }
                Section("Summary") {
                    TextEditor(text: $summary).frame(minHeight: 80)
                }
                Section {
                    Toggle("Schedule follow-up", isOn: $hasFollowUp)
                    if hasFollowUp {
                        DatePicker("Follow-up Date", selection: $followUpDate,
                                   in: Date()..., displayedComponents: .date)
                    }
                }
            }
            .navigationTitle("Log Consult")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let consult = MentalHealthConsult(
                            id: UUID().uuidString,
                            childId: isChildLevel ? UUID().uuidString : nil,
                            childName: isChildLevel && !childName.isEmpty ? childName : nil,
                            consultDate: consultDate,
                            consultantName: consultantName,
                            consultType: consultType,
                            summary: summary,
                            followUpDate: hasFollowUp ? followUpDate : nil,
                            followUpNotes: ""
                        )
                        Task { try? await APIClient.shared.logMentalHealthConsult(consult) }
                        onSave(consult)
                        dismiss()
                    }
                    .disabled(summary.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

// MARK: - ViewModel

@MainActor
final class HealthComplianceViewModel: ObservableObject {
    @Published var children: [ChildHealthCompliance] = []
    @Published var drills: [SafetyDrillLog] = []
    @Published var consults: [MentalHealthConsult] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        async let c = loadChildren()
        async let d = loadDrills()
        async let m = loadConsults()
        (children, drills, consults) = await (c, d, m)
        isLoading = false
    }

    private func loadChildren() async -> [ChildHealthCompliance] {
        do { return try await APIClient.shared.getHealthCompliance() }
        catch {
            #if DEBUG
            return MockData.healthCompliance()
            #else
            return []
            #endif
        }
    }

    private func loadDrills() async -> [SafetyDrillLog] {
        do { return try await APIClient.shared.getSafetyDrills() }
        catch {
            #if DEBUG
            return MockData.safetyDrills()
            #else
            return []
            #endif
        }
    }

    private func loadConsults() async -> [MentalHealthConsult] {
        do { return try await APIClient.shared.getMentalHealthConsults() }
        catch {
            #if DEBUG
            return MockData.mentalHealthConsults()
            #else
            return []
            #endif
        }
    }
}
