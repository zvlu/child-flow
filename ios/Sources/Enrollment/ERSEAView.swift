import SwiftUI

// MARK: - ERSEA Eligibility Engine
// Covers: Eligibility determination, recruitment, selection scoring,
// waitlist management, and suspension/expulsion tracking.
// Head Start Performance Standards §1302.11–§1302.17

struct ERSEAView: View {
    @StateObject private var vm = ERSEAViewModel()
    @State private var selectedSegment = 0 // 0=Waitlist, 1=Enrolled, 2=Pending, 3=Denied
    @State private var showAddApplicant = false
    @State private var showIncomeCalc = false
    @State private var showSuspensionLog = false

    private let segments = ["Waitlist", "Enrolled", "Pending", "Denied"]

    var displayedRecords: [EligibilityRecord] {
        switch selectedSegment {
        case 0: return vm.records.filter { $0.status == .eligible }.sorted { ($0.priorityScore) > ($1.priorityScore) }
        case 1: return vm.records.filter { $0.status == .enrolled }
        case 2: return vm.records.filter { $0.status == .pending }
        case 3: return vm.records.filter { $0.status == .denied || $0.status == .withdrawn }
        default: return vm.records
        }
    }

    var body: some View {
        List {
            // ── Summary stats ──────────────────────────────────────
            Section {
                ERSEASummaryCard(records: vm.records)
            }
            .listRowInsets(.init())
            .listRowBackground(Color.clear)

            // ── Quick actions ──────────────────────────────────────
            Section {
                HStack(spacing: 12) {
                    QuickActionButton(label: "Income Calculator",
                                      icon: "dollarsign.circle.fill",
                                      color: .cfPrimary) { showIncomeCalc = true }
                    QuickActionButton(label: "Add Applicant",
                                      icon: "person.badge.plus",
                                      color: .cfAttendance) { showAddApplicant = true }
                    QuickActionButton(label: "Suspension Log",
                                      icon: "exclamationmark.shield.fill",
                                      color: .cfHealth) { showSuspensionLog = true }
                }
            }
            .listRowBackground(Color.clear)
            .listRowInsets(.init(.init(top: 0, leading: 12, bottom: 0, trailing: 12)))

            // ── Segment picker ─────────────────────────────────────
            Section {
                Picker("View", selection: $selectedSegment) {
                    ForEach(segments.indices, id: \.self) { i in
                        Text(segments[i]).tag(i)
                    }
                }
                .pickerStyle(.segmented)
            }
            .listRowBackground(Color.clear)
            .listRowInsets(.init(.init(top: 0, leading: 12, bottom: 8, trailing: 12)))

            // ── Records list ───────────────────────────────────────
            Section {
                if displayedRecords.isEmpty {
                    Text("No records in this category")
                        .font(.subheadline)
                        .foregroundColor(.cfTextSecondary)
                } else {
                    ForEach(displayedRecords) { record in
                        NavigationLink(destination: EligibilityDetailView(record: record, onUpdate: {
                            Task { await vm.load() }
                        })) {
                            EligibilityRow(record: record)
                        }
                    }
                }
            } header: {
                HStack {
                    Text(segments[selectedSegment])
                    Spacer()
                    Text("\(displayedRecords.count) applicants")
                        .font(.caption)
                        .foregroundColor(.cfTextSecondary)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("ERSEA")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showAddApplicant) {
            AddApplicantSheet { record in vm.records.append(record) }
        }
        .sheet(isPresented: $showIncomeCalc) {
            IncomeEligibilityCalculator()
        }
        .sheet(isPresented: $showSuspensionLog) {
            SuspensionLogView(logs: vm.suspensionLogs)
        }
        .task { await vm.load() }
        .overlay { if vm.isLoading { ProgressView() } }
    }
}

// MARK: - Summary Card

private struct ERSEASummaryCard: View {
    let records: [EligibilityRecord]

    var enrolled: Int  { records.filter { $0.status == .enrolled }.count }
    var waitlist: Int  { records.filter { $0.status == .eligible }.count }
    var pending: Int   { records.filter { $0.status == .pending  }.count }
    var categorical: Int { records.filter { $0.categoricalEligibility.isAutoEligible }.count }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ERSEAStat(value: "\(enrolled)", label: "Enrolled",
                          color: .cfAttendance, icon: "checkmark.circle.fill")
                Divider().frame(height: 48)
                ERSEAStat(value: "\(waitlist)", label: "Waitlist",
                          color: .cfPrimary, icon: "list.number")
                Divider().frame(height: 48)
                ERSEAStat(value: "\(pending)", label: "Pending",
                          color: .orange, icon: "clock.fill")
                Divider().frame(height: 48)
                ERSEAStat(value: "\(categorical)", label: "Categorical",
                          color: .cfFamily, icon: "shield.fill")
            }
            .padding(.vertical, 14)
            .background(Color.cfSurface)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .cfCardShadow()
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

private struct ERSEAStat: View {
    let value: String; let label: String; let color: Color; let icon: String
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 13, weight: .semibold)).foregroundColor(color)
            Text(value).font(.title2.weight(.bold)).foregroundColor(.cfTextPrimary)
            Text(label).font(.caption2).foregroundColor(.cfTextSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Quick Action Button

private struct QuickActionButton: View {
    let label: String; let icon: String; let color: Color; let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(color)
                Text(label)
                    .font(.caption2.weight(.medium))
                    .foregroundColor(.cfTextPrimary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(color.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }
}

// MARK: - Eligibility Row

private struct EligibilityRow: View {
    let record: EligibilityRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(record.childName)
                        .font(.subheadline.weight(.semibold))
                    Text("Age \(record.childAge) · Applied \(record.applicationDate.formatted(date: .abbreviated, time: .omitted))")
                        .font(.caption)
                        .foregroundColor(.cfTextSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    EligibilityStatusBadge(status: record.status)
                    if let pos = record.waitlistPosition {
                        Text("#\(pos) on waitlist")
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(.cfPrimary)
                    }
                }
            }

            HStack(spacing: 8) {
                // Categorical or income badge
                if record.categoricalEligibility.isAutoEligible {
                    Label(record.categoricalEligibility.rawValue,
                          systemImage: record.categoricalEligibility.icon)
                        .font(.caption2.weight(.medium))
                        .foregroundColor(record.categoricalEligibility.color)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(record.categoricalEligibility.color.opacity(0.1))
                        .clipShape(Capsule())
                        .lineLimit(1)
                } else {
                    let pct = record.fplPercentage
                    Label("\(Int(pct))% FPL", systemImage: "dollarsign.circle")
                        .font(.caption2.weight(.medium))
                        .foregroundColor(pct <= 100 ? .cfAttendance : .cfHealth)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background((pct <= 100 ? Color.cfAttendance : Color.cfHealth).opacity(0.1))
                        .clipShape(Capsule())
                }

                // Priority score
                if record.status == .eligible {
                    Label("Score: \(record.priorityScore)", systemImage: "star.fill")
                        .font(.caption2.weight(.medium))
                        .foregroundColor(.cfGoals)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.cfGoals.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.vertical, 2)
    }
}

private struct EligibilityStatusBadge: View {
    let status: EligibilityRecord.EligibilityStatus
    var body: some View {
        Label(status.rawValue, systemImage: status.icon)
            .font(.caption2.weight(.semibold))
            .foregroundColor(status.color)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(status.color.opacity(0.1))
            .clipShape(Capsule())
    }
}

// MARK: - Eligibility Detail View

struct EligibilityDetailView: View {
    @State var record: EligibilityRecord
    let onUpdate: () -> Void
    @State private var showEnroll = false
    @State private var showDeny = false

    var body: some View {
        List {
            // ── Determination ──────────────────────────────────────
            Section("Eligibility Determination") {
                HStack {
                    Image(systemName: record.isEligible ? "checkmark.shield.fill" : "xmark.shield.fill")
                        .foregroundColor(record.isEligible ? .cfAttendance : .cfHealth)
                        .font(.title2)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(record.isEligible ? "Eligible" : "Not Eligible")
                            .font(.headline.weight(.bold))
                            .foregroundColor(record.isEligible ? .cfAttendance : .cfHealth)
                        Text(record.categoricalEligibility.isAutoEligible
                             ? record.categoricalEligibility.rawValue
                             : "\(Int(record.fplPercentage))% of Federal Poverty Level (limit: 100%)")
                            .font(.caption)
                            .foregroundColor(.cfTextSecondary)
                    }
                }
                .padding(.vertical, 4)
            }

            // ── Income ─────────────────────────────────────────────
            if !record.categoricalEligibility.isAutoEligible {
                Section("Income Information") {
                    LabeledContent("Annual Income", value: record.annualIncome.formatted(.currency(code: "USD").precision(.fractionLength(0))))
                    LabeledContent("Household Size", value: "\(record.householdSize) people")
                    LabeledContent("Income Source", value: record.incomeSource)
                    LabeledContent("FPL Limit", value: FederalPovertyLevel.limit(for: record.householdSize).formatted(.currency(code: "USD").precision(.fractionLength(0))))
                    LabeledContent("FPL Percentage") {
                        Text("\(Int(record.fplPercentage))%")
                            .foregroundColor(record.isIncomeEligible ? .cfAttendance : .cfHealth)
                            .font(.subheadline.weight(.semibold))
                    }
                }
            } else {
                Section("Categorical Eligibility") {
                    Label(record.categoricalEligibility.rawValue,
                          systemImage: record.categoricalEligibility.icon)
                        .foregroundColor(record.categoricalEligibility.color)
                        .font(.subheadline)
                }
            }

            // ── Priority Score ─────────────────────────────────────
            Section("Selection Priority Score") {
                HStack {
                    Text("Total Score")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text("\(record.priorityScore) pts")
                        .font(.title3.weight(.bold))
                        .foregroundColor(.cfPrimary)
                }
                if record.riskFactors.isEmpty {
                    Text("No additional risk factors recorded")
                        .font(.caption)
                        .foregroundColor(.cfTextSecondary)
                } else {
                    ForEach(record.riskFactors, id: \.self) { factor in
                        HStack {
                            Text(factor.rawValue)
                                .font(.subheadline)
                            Spacer()
                            Text("+\(factor.pointValue) pts")
                                .font(.caption.weight(.semibold))
                                .foregroundColor(.cfGoals)
                        }
                    }
                }
            }

            // ── Status ─────────────────────────────────────────────
            Section("Status") {
                LabeledContent("Current Status") {
                    EligibilityStatusBadge(status: record.status)
                }
                if let enrolled = record.enrolledDate {
                    LabeledContent("Enrolled",
                                   value: enrolled.formatted(date: .abbreviated, time: .omitted))
                }
                if let room = record.classroom {
                    LabeledContent("Classroom", value: room)
                }
                if let pos = record.waitlistPosition {
                    LabeledContent("Waitlist Position", value: "#\(pos)")
                }
                if !record.notes.isEmpty {
                    Text(record.notes)
                        .font(.subheadline)
                        .foregroundColor(.cfTextSecondary)
                }
            }

            // ── Actions ────────────────────────────────────────────
            if record.status == .eligible || record.status == .pending {
                Section {
                    if record.isEligible {
                        Button {
                            showEnroll = true
                        } label: {
                            Label("Enroll This Child", systemImage: "checkmark.circle.fill")
                                .foregroundColor(.cfAttendance)
                                .font(.subheadline.weight(.semibold))
                        }
                    }
                    if !record.isEligible {
                        Button {
                            showDeny = true
                        } label: {
                            Label("Mark as Ineligible", systemImage: "xmark.circle")
                                .foregroundColor(.cfHealth)
                                .font(.subheadline)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(record.childName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showEnroll) {
            EnrollChildSheet(childName: record.childName) { classroom in
                record.status = .enrolled
                record.enrolledDate = Date()
                record.classroom = classroom
                record.waitlistPosition = nil
                Task { try? await APIClient.shared.updateEligibilityRecord(record); onUpdate() }
            }
        }
    }
}

// MARK: - Enroll Child Sheet

private struct EnrollChildSheet: View {
    let childName: String
    let onEnroll: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var classroom = "Room A"
    let classrooms = ["Room A", "Room B", "Room C", "Room D"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Enroll \(childName)") {
                    Picker("Assign to Classroom", selection: $classroom) {
                        ForEach(classrooms, id: \.self) { Text($0).tag($0) }
                    }
                }
            }
            .navigationTitle("Enroll Child")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Enroll") { onEnroll(classroom); dismiss() }
                }
            }
        }
    }
}

// MARK: - Income Eligibility Calculator

struct IncomeEligibilityCalculator: View {
    @Environment(\.dismiss) private var dismiss
    @State private var householdSize = 4
    @State private var annualIncome = 28000

    var fplLimit: Int { FederalPovertyLevel.limit(for: householdSize) }
    var fplPct: Double { FederalPovertyLevel.percentage(income: annualIncome, householdSize: householdSize) }
    var isEligible: Bool { annualIncome <= fplLimit }

    var body: some View {
        NavigationStack {
            Form {
                Section("Household Information") {
                    Stepper("Household Size: \(householdSize)",
                            value: $householdSize, in: 1...12)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Annual Household Income")
                            .font(.caption)
                            .foregroundColor(.cfTextSecondary)
                        HStack {
                            Text("$").foregroundColor(.cfTextSecondary)
                            TextField("Annual income", value: $annualIncome, format: .number)
                                .keyboardType(.numberPad)
                        }
                    }
                }

                Section("Result") {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(isEligible ? "Income Eligible" : "Over Income Limit")
                                .font(.headline.weight(.bold))
                                .foregroundColor(isEligible ? .cfAttendance : .cfHealth)
                            Text("100% FPL for \(householdSize)-person household = \(fplLimit.formatted(.currency(code: "USD").precision(.fractionLength(0))))")
                                .font(.caption)
                                .foregroundColor(.cfTextSecondary)
                        }
                        Spacer()
                        Image(systemName: isEligible ? "checkmark.shield.fill" : "xmark.shield.fill")
                            .font(.title)
                            .foregroundColor(isEligible ? .cfAttendance : .cfHealth)
                    }
                    .padding(.vertical, 4)

                    LabeledContent("Income Entered",
                                   value: annualIncome.formatted(.currency(code: "USD").precision(.fractionLength(0))))
                    LabeledContent("FPL Limit",
                                   value: fplLimit.formatted(.currency(code: "USD").precision(.fractionLength(0))))
                    LabeledContent("Percentage of FPL") {
                        Text("\(String(format: "%.1f", fplPct))%")
                            .foregroundColor(isEligible ? .cfAttendance : .cfHealth)
                            .font(.subheadline.weight(.semibold))
                    }
                }

                Section("Categorical Auto-Eligibility") {
                    Text("The following situations make a child automatically eligible regardless of income:")
                        .font(.caption)
                        .foregroundColor(.cfTextSecondary)
                    ForEach(CategoricalEligibility.allCases.filter { $0 != .none }, id: \.self) { cat in
                        Label(cat.rawValue, systemImage: cat.icon)
                            .font(.subheadline)
                            .foregroundColor(cat.color)
                    }
                }

                Section("FPL Reference Table") {
                    ForEach(1...8, id: \.self) { size in
                        HStack {
                            Text("\(size) person\(size == 1 ? "" : "s")")
                                .font(.subheadline)
                            Spacer()
                            Text(FederalPovertyLevel.limit(for: size).formatted(.currency(code: "USD").precision(.fractionLength(0))))
                                .font(.subheadline.weight(.medium))
                                .foregroundColor(householdSize == size ? .cfPrimary : .cfTextPrimary)
                        }
                        .background(householdSize == size ? Color.cfPrimary.opacity(0.05) : Color.clear)
                    }
                }
            }
            .navigationTitle("Income Calculator")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Add Applicant Sheet

struct AddApplicantSheet: View {
    let onSave: (EligibilityRecord) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var childName = ""
    @State private var dob = Calendar.current.date(byAdding: .year, value: -4, to: Date())!
    @State private var householdSize = 4
    @State private var annualIncome = 28000
    @State private var incomeSource = ""
    @State private var categorical = CategoricalEligibility.none
    @State private var selectedFactors: Set<EligibilityRiskFactor> = []
    @State private var notes = ""

    var priorityScore: Int {
        selectedFactors.reduce(0) { $0 + $1.pointValue }
    }

    var isIncomeEligible: Bool {
        annualIncome <= FederalPovertyLevel.limit(for: householdSize)
    }

    var isEligible: Bool {
        categorical.isAutoEligible || isIncomeEligible
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Child Information") {
                    TextField("Child full name", text: $childName)
                    DatePicker("Date of Birth", selection: $dob,
                               in: ...Date(), displayedComponents: .date)
                }

                Section("Eligibility") {
                    Picker("Categorical Eligibility", selection: $categorical) {
                        ForEach(CategoricalEligibility.allCases, id: \.self) { c in
                            Label(c.rawValue, systemImage: c.icon).tag(c)
                        }
                    }
                    if categorical == .none {
                        Stepper("Household Size: \(householdSize)", value: $householdSize, in: 1...12)
                        TextField("Annual income ($)", value: $annualIncome, format: .number)
                            .keyboardType(.numberPad)
                        TextField("Income source (employment, SNAP, etc.)", text: $incomeSource)
                        let pct = FederalPovertyLevel.percentage(income: annualIncome, householdSize: householdSize)
                        Label("\(String(format: "%.0f", pct))% FPL — \(isIncomeEligible ? "Eligible" : "Not Eligible")",
                              systemImage: isIncomeEligible ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(isIncomeEligible ? .cfAttendance : .cfHealth)
                            .font(.caption)
                    }
                }

                Section("Risk Factors (Selection Priority)") {
                    ForEach(EligibilityRiskFactor.allCases, id: \.self) { factor in
                        Button {
                            if selectedFactors.contains(factor) { selectedFactors.remove(factor) }
                            else { selectedFactors.insert(factor) }
                        } label: {
                            HStack {
                                Text(factor.rawValue).foregroundColor(.primary)
                                Spacer()
                                Text("+\(factor.pointValue)").font(.caption).foregroundColor(.cfGoals)
                                if selectedFactors.contains(factor) {
                                    Image(systemName: "checkmark.circle.fill").foregroundColor(.cfPrimary)
                                }
                            }
                        }
                    }
                    Text("Priority Score: \(priorityScore) pts")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.cfGoals)
                }

                Section("Notes") {
                    TextEditor(text: $notes).frame(minHeight: 60)
                }
            }
            .navigationTitle("Add Applicant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let record = EligibilityRecord(
                            id: UUID().uuidString, childName: childName.trimmingCharacters(in: .whitespaces),
                            childDateOfBirth: dob, familyId: nil, applicationDate: Date(),
                            householdSize: householdSize, annualIncome: annualIncome,
                            incomeSource: incomeSource, categoricalEligibility: categorical,
                            priorityScore: priorityScore, riskFactors: Array(selectedFactors),
                            status: isEligible ? .eligible : .pending,
                            enrolledDate: nil, classroom: nil, waitlistPosition: nil, notes: notes
                        )
                        Task { try? await APIClient.shared.createEligibilityRecord(record) }
                        onSave(record)
                        dismiss()
                    }
                    .disabled(childName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

// MARK: - Suspension Log View

struct SuspensionLogView: View {
    let logs: [SuspensionExpulsionLog]
    @State private var showAddLog = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Head Start Performance Standards §1302.17 prohibits suspension and expulsion and requires specific steps before any disciplinary removal.")
                            .font(.caption)
                            .foregroundColor(.cfTextSecondary)
                    }
                }

                Section("Incidents (\(logs.count))") {
                    if logs.isEmpty {
                        Text("No incidents logged")
                            .foregroundColor(.secondary)
                            .font(.subheadline)
                    } else {
                        ForEach(logs) { log in
                            NavigationLink(destination: SuspensionDetailView(log: log)) {
                                SuspensionLogRow(log: log)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Suspension / Expulsion Log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showAddLog = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddLog) {
                AddSuspensionLogSheet { _ in }
            }
        }
    }
}

private struct SuspensionLogRow: View {
    let log: SuspensionExpulsionLog
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(log.childName).font(.subheadline.weight(.semibold))
                Spacer()
                Text(log.incidentType.rawValue)
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(.cfHealth)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.cfHealth.opacity(0.1))
                    .clipShape(Capsule())
            }
            Text(log.incidentDate.formatted(date: .abbreviated, time: .omitted))
                .font(.caption)
                .foregroundColor(.cfTextSecondary)
            // Steps checklist
            HStack(spacing: 8) {
                StepDot(done: log.mentalHealthConsultRequested, label: "MH Consult")
                StepDot(done: log.familyMeetingHeld, label: "Family Mtg")
                StepDot(done: log.behaviourSupportPlanCreated, label: "BSP")
            }
        }
        .padding(.vertical, 2)
    }
}

private struct StepDot: View {
    let done: Bool; let label: String
    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 10))
                .foregroundColor(done ? .cfAttendance : .cfBorder)
            Text(label).font(.caption2).foregroundColor(done ? .cfTextPrimary : .cfTextSecondary)
        }
    }
}

struct SuspensionDetailView: View {
    let log: SuspensionExpulsionLog
    var body: some View {
        List {
            Section("Incident") {
                LabeledContent("Child", value: log.childName)
                LabeledContent("Date", value: log.incidentDate.formatted(date: .long, time: .omitted))
                LabeledContent("Type", value: log.incidentType.rawValue)
            }
            Section("Description") { Text(log.behaviorDescription).font(.subheadline) }
            Section("Required Steps (§1302.17)") {
                StepRow(done: log.mentalHealthConsultRequested, label: "MH Consultation Requested",
                        date: log.mentalHealthConsultDate)
                StepRow(done: log.familyMeetingHeld, label: "Family Meeting Held",
                        date: log.familyMeetingDate)
                StepRow(done: log.behaviourSupportPlanCreated, label: "Behavior Support Plan Created",
                        date: log.behaviourSupportPlanDate)
                StepRow(done: log.stateAgencyNotified, label: "State Agency Notified",
                        date: log.stateNotificationDate)
            }
            Section("Outcome") {
                LabeledContent("Outcome", value: log.outcome.rawValue)
                if let r = log.resolutionDate {
                    LabeledContent("Resolved", value: r.formatted(date: .abbreviated, time: .omitted))
                }
                if !log.notes.isEmpty {
                    Text(log.notes).font(.subheadline)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(log.childName)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct StepRow: View {
    let done: Bool; let label: String; let date: Date?
    var body: some View {
        HStack {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .foregroundColor(done ? .cfAttendance : .cfBorder)
            Text(label).font(.subheadline)
            Spacer()
            if let d = date {
                Text(d.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.cfTextSecondary)
            } else if !done {
                Text("Needed").font(.caption2).foregroundColor(.cfHealth)
            }
        }
    }
}

struct AddSuspensionLogSheet: View {
    let onSave: (SuspensionExpulsionLog) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var childName = ""
    @State private var incidentType = SuspensionExpulsionLog.IncidentType.internalReview
    @State private var description = ""
    @State private var incidentDate = Date()
    @State private var mhConsult = false
    @State private var familyMeeting = false
    @State private var bsp = false
    @State private var stateNotified = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Incident") {
                    TextField("Child name", text: $childName)
                    DatePicker("Date", selection: $incidentDate, in: ...Date(), displayedComponents: .date)
                    Picker("Type", selection: $incidentType) {
                        ForEach(SuspensionExpulsionLog.IncidentType.allCases, id: \.self) { t in
                            Text(t.rawValue).tag(t)
                        }
                    }
                }
                Section("Description") {
                    TextEditor(text: $description).frame(minHeight: 80)
                }
                Section("Required Steps (§1302.17)") {
                    Toggle("MH Consultation Requested", isOn: $mhConsult)
                    Toggle("Family Meeting Held", isOn: $familyMeeting)
                    Toggle("Behavior Support Plan Created", isOn: $bsp)
                    Toggle("State Agency Notified", isOn: $stateNotified)
                }
            }
            .navigationTitle("Log Incident")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let log = SuspensionExpulsionLog(
                            id: UUID().uuidString, childId: UUID().uuidString,
                            childName: childName, incidentDate: incidentDate,
                            incidentType: incidentType, behaviorDescription: description,
                            mentalHealthConsultRequested: mhConsult, mentalHealthConsultDate: mhConsult ? Date() : nil,
                            familyMeetingHeld: familyMeeting, familyMeetingDate: familyMeeting ? Date() : nil,
                            behaviourSupportPlanCreated: bsp, behaviourSupportPlanDate: bsp ? Date() : nil,
                            stateAgencyNotified: stateNotified, stateNotificationDate: stateNotified ? Date() : nil,
                            outcome: .pending, resolutionDate: nil, notes: ""
                        )
                        onSave(log)
                        dismiss()
                    }
                    .disabled(childName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

// MARK: - ViewModel

@MainActor
final class ERSEAViewModel: ObservableObject {
    @Published var records: [EligibilityRecord] = []
    @Published var suspensionLogs: [SuspensionExpulsionLog] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        async let r = loadRecords()
        async let s = loadSuspensions()
        (records, suspensionLogs) = await (r, s)
        isLoading = false
    }

    private func loadRecords() async -> [EligibilityRecord] {
        do { return try await APIClient.shared.getEligibilityRecords() }
        catch {
            #if DEBUG
            return MockData.eligibilityRecords()
            #else
            return []
            #endif
        }
    }

    private func loadSuspensions() async -> [SuspensionExpulsionLog] {
        do { return try await APIClient.shared.getSuspensionLogs() }
        catch {
            #if DEBUG
            return MockData.suspensionLogs()
            #else
            return []
            #endif
        }
    }
}
