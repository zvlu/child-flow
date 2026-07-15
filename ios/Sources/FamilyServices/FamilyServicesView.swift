import SwiftUI

// MARK: - Family Services Hub

struct FamilyServicesView: View {
    @StateObject private var viewModel = FamilyServicesViewModel()

    var body: some View {
        HeadStartGate(featureDescription: "Family services case management") {
            List {
                ForEach(viewModel.filteredFamilies) { family in
                    NavigationLink(destination: FamilyDetailView(family: family)) {
                        FamilyRow(family: family)
                    }
                }
            }
            .navigationTitle("Family Services")
            .searchable(text: $viewModel.searchText, prompt: "Search families")
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
            .overlay {
                if viewModel.isLoading { ProgressView() }
                else if viewModel.filteredFamilies.isEmpty && !viewModel.searchText.isEmpty {
                    ContentUnavailableView.search
                }
            }
        }
    }
}

struct FamilyRow: View {
    let family: Family

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(family.name)
                .font(.subheadline.weight(.medium))
            HStack(spacing: 12) {
                Label("\(family.childrenCount) child\(family.childrenCount == 1 ? "" : "ren")",
                      systemImage: "person.2")
                Label(family.lastContact, systemImage: "calendar")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Family Detail (tabbed hub)

/// Named tab indices for FamilyDetailView, used by dashboard task deep links.
enum FamilyDetailTab: Int {
    case overview = 0, contacts = 1, goals = 2, fna = 3, cfcr = 4, notes = 5, moments = 6
}

struct FamilyDetailView: View {
    let family: Family
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: Int

    init(family: Family, initialTab: FamilyDetailTab = .overview) {
        self.family = family
        _selectedTab = State(initialValue: initialTab.rawValue)
    }

    /// Contacts/Goals/FNA/CFCR/Notes are all Head Start case-management
    /// features (§1302 family services). This view is reached from Children,
    /// global search, and dashboard task links — all core, ungated screens —
    /// so unlike the rest of Family Services, this can't just be gated as a
    /// whole; only the HS-only tabs are hidden for a core-only org.
    private static let allTabs: [(title: String, tab: FamilyDetailTab)] = [
        ("Overview", .overview), ("Contacts", .contacts), ("Goals", .goals),
        ("FNA", .fna), ("CFCR", .cfcr), ("Notes", .notes), ("Moments", .moments),
    ]
    private static let headStartOnlyTabs: Set<FamilyDetailTab> = [.contacts, .goals, .fna, .cfcr, .notes]

    private var visibleTabs: [(title: String, tab: FamilyDetailTab)] {
        let hasHeadStart = appState.hasModule(.headStart)
        return Self.allTabs.filter { hasHeadStart || !Self.headStartOnlyTabs.contains($0.tab) }
    }

    var body: some View {
        let tabs = visibleTabs
        // If we launched on a tab that just got filtered out (e.g. a stale
        // deep link to .goals for a core-only org), fall back to Overview.
        let activeTab = tabs.first { $0.tab.rawValue == selectedTab }?.tab ?? .overview

        VStack(spacing: 0) {
            // Family header card
            VStack(spacing: 4) {
                Circle()
                    .fill(Color.accentColor.opacity(0.15))
                    .frame(width: 56, height: 56)
                    .overlay {
                        Text(family.name.prefix(2).uppercased())
                            .font(.title3.weight(.semibold))
                            .foregroundColor(.accentColor)
                    }
                Text(family.name)
                    .font(.title3.bold())
                HStack(spacing: 16) {
                    Label(family.phone, systemImage: "phone.fill")
                    Label("\(family.childrenCount) children", systemImage: "person.2.fill")
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color(.secondarySystemBackground))

            // Tab picker
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(tabs, id: \.tab) { entry in
                        Button(action: { withAnimation { selectedTab = entry.tab.rawValue } }) {
                            Text(entry.title)
                                .font(.subheadline.weight(activeTab == entry.tab ? .semibold : .regular))
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .foregroundColor(activeTab == entry.tab ? .accentColor : .secondary)
                                .overlay(alignment: .bottom) {
                                    if activeTab == entry.tab {
                                        Rectangle().fill(Color.accentColor).frame(height: 2)
                                    }
                                }
                        }
                    }
                }
            }
            .background(Color(.secondarySystemBackground))

            Divider()

            // Tab content — plain Group avoids TabView/NavigationStack conflicts
            Group {
                switch activeTab {
                case .overview: FamilyOverviewTab(family: family)
                case .contacts: MonthlyContactsTab(familyId: family.id)
                case .goals:    FamilyGoalsTab(family: family)
                case .fna:      FNATab(familyId: family.id, familyName: family.name)
                case .cfcr:     CFCRTab(familyId: family.id)
                case .notes:    CaseNotesTab(familyId: family.id)
                case .moments:  ChildMomentsTab(familyId: family.id, familyName: family.name)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationTitle(family.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Overview Tab

struct FamilyOverviewTab: View {
    @EnvironmentObject var appState: AppState
    let family: Family

    var body: some View {
        // Home visits and family goals are Head Start case-management
        // concepts (§1302 Family Services) — hidden here too for core-only
        // orgs, same as the Contacts/Goals/FNA/CFCR/Notes tabs above.
        let hasHeadStart = appState.hasModule(.headStart)

        List {
            if hasHeadStart {
                // Home Visit Mode — top of every family's Overview tab
                Section {
                    StartHomeVisitButton(family: family)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(.init(.init(top: 4, leading: 16, bottom: 4, trailing: 16)))
            }

            Section("Contact Information") {
                LabeledContent("Phone", value: family.phone)
                LabeledContent("Email", value: family.email)
                LabeledContent("Address", value: family.address)
            }
            Section("Schedule") {
                LabeledContent("Last Contact", value: family.lastContact)
                if hasHeadStart {
                    LabeledContent("Next Home Visit", value: family.nextHomeVisit)
                }
            }
            if hasHeadStart && !family.goals.isEmpty {
                Section("Active Goals") {
                    ForEach(family.goals, id: \.self) { goal in
                        Label(goal, systemImage: "target")
                            .font(.subheadline)
                    }
                }
            }
        }
    }
}

// MARK: - Monthly Contacts Tab

struct MonthlyContactsTab: View {
    let familyId: String
    @StateObject private var viewModel: ContactsViewModel
    @State private var showLogContact = false

    init(familyId: String) {
        self.familyId = familyId
        _viewModel = StateObject(wrappedValue: ContactsViewModel(familyId: familyId))
    }

    var body: some View {
        List {
            if viewModel.contacts.isEmpty && !viewModel.isLoading {
                ContentUnavailableView(
                    "No Contacts Logged",
                    systemImage: "phone.badge.plus",
                    description: Text("Tap + to log a contact.")
                )
                .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.contacts) { contact in
                    ContactLogRow(contact: contact)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showLogContact = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showLogContact) {
            LogContactSheet(familyId: familyId) { _ in
                Task { await viewModel.load() }
            }
        }
        .task { await viewModel.load() }
        .overlay { if viewModel.isLoading { ProgressView() } }
    }
}

struct ContactLogRow: View {
    let contact: MonthlyContact

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.accentColor.opacity(0.12))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: contact.contactType.icon)
                        .foregroundColor(.accentColor)
                        .font(.subheadline)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(contact.contactType.rawValue)
                    .font(.subheadline.weight(.medium))
                Text(contact.date, style: .date)
                    .font(.caption)
                    .foregroundColor(.secondary)
                if !contact.notes.isEmpty {
                    Text(contact.notes)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }
            Spacer()
            if contact.followUpNeeded {
                Image(systemName: "flag.fill")
                    .foregroundColor(.orange)
                    .font(.caption)
            }
        }
        .padding(.vertical, 4)
    }
}

struct LogContactSheet: View {
    let familyId: String
    let onSave: (MonthlyContact) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var contactType: MonthlyContact.ContactType = .phone
    @State private var contactDate = Date()
    @State private var notes = ""
    @State private var followUpNeeded = false
    @State private var followUpDate = Date().addingTimeInterval(7 * 24 * 3600)
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Contact Details") {
                    Picker("Type", selection: $contactType) {
                        ForEach(MonthlyContact.ContactType.allCases, id: \.self) { type in
                            Label(type.rawValue, systemImage: type.icon).tag(type)
                        }
                    }
                    DatePicker("Date", selection: $contactDate, displayedComponents: .date)
                }
                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 100)
                        .overlay(alignment: .topLeading) {
                            if notes.isEmpty {
                                Text("What was discussed…")
                                    .foregroundColor(.secondary)
                                    .padding(.top, 8)
                                    .padding(.leading, 4)
                                    .allowsHitTesting(false)
                            }
                        }
                }
                Section {
                    Toggle("Follow-up Needed", isOn: $followUpNeeded)
                    if followUpNeeded {
                        DatePicker("Follow-up Date", selection: $followUpDate, displayedComponents: .date)
                    }
                }
            }
            .navigationTitle("Log Contact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isSaving)
                }
            }
            .alert("Couldn't Save Contact", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
    }

    private func save() {
        isSaving = true
        let iso = ISO8601DateFormatter()
        let request = NewContactRequest(
            familyId: familyId,
            date: iso.string(from: contactDate),
            contactType: contactType.rawValue,
            notes: notes,
            followUpNeeded: followUpNeeded,
            followUpDate: followUpNeeded ? iso.string(from: followUpDate) : nil
        )
        Task {
            do {
                let saved = try await APIClient.shared.logContact(request: request)
                await MainActor.run {
                    onSave(saved)
                    dismiss()
                }
            } catch {
                // Do NOT fabricate a fake success — a network/server failure here
                // must not look like a saved contact. Surface the error and let
                // the user retry or cancel without losing what they typed.
                await MainActor.run {
                    errorMessage = "This contact wasn't saved. Check your connection and try again."
                }
            }
            isSaving = false
        }
    }
}

@MainActor
class ContactsViewModel: ObservableObject {
    let familyId: String
    @Published var contacts: [MonthlyContact] = []
    @Published var isLoading = false

    init(familyId: String) { self.familyId = familyId }

    func load() async {
        isLoading = true
        do {
            contacts = try await APIClient.shared.getContacts(familyId: familyId)
        } catch {
            #if DEBUG
            contacts = MockData.contacts(for: familyId)
            #endif
        }
        isLoading = false
    }
}

// MARK: - Goals Tab (FPA + SMART Goals)

struct FamilyGoalsTab: View {
    let family: Family
    var familyId: String { family.id }
    var familyName: String { family.name }
    @StateObject private var viewModel: GoalsViewModel
    @State private var showAddGoal = false

    init(family: Family) {
        self.family = family
        _viewModel = StateObject(wrappedValue: GoalsViewModel(familyId: family.id))
    }

    var body: some View {
        List {
            // FPA Status banner → taps into full FPA Builder
            Section {
                NavigationLink(destination: FamilyPartnershipView(family: family)) {
                    FPAStatusBanner(status: viewModel.fpaStatus)
                }
            }

            // Goals
            Section {
                if viewModel.goals.isEmpty {
                    Text("No goals yet. Tap + to add a goal.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                } else {
                    ForEach(viewModel.goals) { goal in
                        NavigationLink(destination: GoalDetailView(goal: goal, onUpdate: {
                            Task { await viewModel.load() }
                        })) {
                            GoalRow(goal: goal)
                        }
                    }
                }
            } header: {
                HStack {
                    Text("SMART Goals")
                    Spacer()
                    Button(action: { showAddGoal = true }) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.accentColor)
                    }
                }
            }
        }
        .sheet(isPresented: $showAddGoal) {
            AddGoalSheet(familyId: familyId) { _ in
                Task { await viewModel.load() }
            }
        }
        .task { await viewModel.load() }
        .overlay { if viewModel.isLoading { ProgressView() } }
    }
}

struct FPAStatusBanner: View {
    let status: FamilyPartnershipAgreement.FPAStatus

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "doc.text.fill")
                .foregroundColor(status.color)
                .font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text("Family Partnership Agreement")
                    .font(.subheadline.weight(.medium))
                Text(status.rawValue)
                    .font(.caption)
                    .foregroundColor(status.color)
            }
            Spacer()
            Circle()
                .fill(status.color)
                .frame(width: 10, height: 10)
        }
        .padding(.vertical, 4)
    }
}

struct GoalRow: View {
    let goal: FamilyGoal

    var completedSteps: Int { goal.steps.filter(\.isCompleted).count }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: goal.category.icon)
                .foregroundColor(.accentColor)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(goal.title)
                    .font(.subheadline.weight(.medium))
                HStack(spacing: 8) {
                    Text(goal.category.rawValue)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.accentColor.opacity(0.1))
                        .foregroundColor(.accentColor)
                        .clipShape(Capsule())
                    if !goal.steps.isEmpty {
                        Text("\(completedSteps)/\(goal.steps.count) steps")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            Spacer()
            Text(goal.status.rawValue)
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(goal.status.color.opacity(0.12))
                .foregroundColor(goal.status.color)
                .clipShape(Capsule())
        }
        .padding(.vertical, 2)
    }
}

struct GoalDetailView: View {
    let goal: FamilyGoal
    let onUpdate: () -> Void
    @State private var steps: [GoalStep]

    init(goal: FamilyGoal, onUpdate: @escaping () -> Void) {
        self.goal = goal
        self.onUpdate = onUpdate
        _steps = State(initialValue: goal.steps)
    }

    var body: some View {
        List {
            Section("Goal") {
                Text(goal.title)
                    .font(.headline)
                if !goal.description.isEmpty {
                    Text(goal.description)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                LabeledContent("Category", value: goal.category.rawValue)
                LabeledContent("Status", value: goal.status.rawValue)
                if let target = goal.targetDate {
                    LabeledContent("Target Date") {
                        Text(target, style: .date)
                    }
                }
            }
            if !steps.isEmpty {
                Section("Steps") {
                    ForEach($steps) { $step in
                        HStack {
                            Button(action: {
                                step.isCompleted.toggle()
                                updateStep(step)
                            }) {
                                Image(systemName: step.isCompleted
                                    ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(step.isCompleted ? .green : .secondary)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(step.title)
                                    .font(.subheadline)
                                    .strikethrough(step.isCompleted)
                                    .foregroundColor(step.isCompleted ? .secondary : .primary)
                                if let due = step.dueDate {
                                    Text(due, style: .date)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Goal Details")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func updateStep(_ step: GoalStep) {
        Task {
            try? await APIClient.shared.updateGoalStep(
                goalId: goal.id,
                stepId: step.id,
                completed: step.isCompleted
            )
            onUpdate()
        }
    }
}

struct AddGoalSheet: View {
    let familyId: String
    let onSave: (FamilyGoal) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var description = ""
    @State private var category: FamilyGoal.GoalCategory = .education
    @State private var targetDate = Date().addingTimeInterval(90 * 24 * 3600)
    @State private var hasTargetDate = false
    @State private var steps: [String] = [""]
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Goal") {
                    TextField("Goal title", text: $title)
                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(2...4)
                    Picker("Category", selection: $category) {
                        ForEach(FamilyGoal.GoalCategory.allCases, id: \.self) { cat in
                            Label(cat.rawValue, systemImage: cat.icon).tag(cat)
                        }
                    }
                    Toggle("Set Target Date", isOn: $hasTargetDate)
                    if hasTargetDate {
                        DatePicker("Target Date", selection: $targetDate, displayedComponents: .date)
                    }
                }
                Section {
                    ForEach(steps.indices, id: \.self) { i in
                        HStack {
                            TextField("Step \(i + 1)", text: $steps[i])
                            if steps.count > 1 {
                                Button(action: { steps.remove(at: i) }) {
                                    Image(systemName: "minus.circle.fill")
                                        .foregroundColor(.red)
                                }
                            }
                        }
                    }
                    Button(action: { steps.append("") }) {
                        Label("Add Step", systemImage: "plus.circle")
                    }
                } header: {
                    Text("Action Steps")
                }
            }
            .navigationTitle("New Goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(title.isEmpty || isSaving)
                }
            }
            .alert("Couldn't Save Goal", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
    }

    private func save() {
        isSaving = true
        let iso = ISO8601DateFormatter()
        let request = NewGoalRequest(
            familyId: familyId,
            title: title,
            description: description,
            category: category.rawValue,
            targetDate: hasTargetDate ? iso.string(from: targetDate) : nil,
            steps: steps.filter { !$0.isEmpty }
        )
        Task {
            do {
                let saved = try await APIClient.shared.createGoal(request: request)
                await MainActor.run { onSave(saved); dismiss() }
            } catch {
                // Do NOT fabricate a fake success — see LogContactSheet.save().
                await MainActor.run {
                    errorMessage = "This goal wasn't saved. Check your connection and try again."
                }
            }
            isSaving = false
        }
    }
}

@MainActor
class GoalsViewModel: ObservableObject {
    let familyId: String
    @Published var goals: [FamilyGoal] = []
    @Published var fpaStatus: FamilyPartnershipAgreement.FPAStatus = .notStarted
    @Published var isLoading = false

    init(familyId: String) { self.familyId = familyId }

    func load() async {
        isLoading = true
        do {
            goals = try await APIClient.shared.getGoals(familyId: familyId)
        } catch {
            #if DEBUG
            goals = MockData.goals(for: familyId)
            #endif
        }
        do {
            let fpa = try await APIClient.shared.getFPA(familyId: familyId)
            fpaStatus = fpa.status
        } catch {
            #if DEBUG
            fpaStatus = MockData.fpaStatus(for: familyId)
            #endif
        }
        isLoading = false
    }
}

// MARK: - FNA Tab

struct FNATab: View {
    let familyId: String
    let familyName: String
    @StateObject private var viewModel: FNAViewModel
    @State private var showAssessment = false

    init(familyId: String, familyName: String) {
        self.familyId = familyId
        self.familyName = familyName
        _viewModel = StateObject(wrappedValue: FNAViewModel(familyId: familyId))
    }

    var body: some View {
        List {
            if let fna = viewModel.assessment {
                Section {
                    LabeledContent("Conducted By", value: fna.conductedBy)
                    LabeledContent("Date") { Text(fna.conductedDate, style: .date) }
                    if let review = fna.reviewDate {
                        LabeledContent("Review Date") { Text(review, style: .date) }
                    }
                }
                Section("Domain Ratings") {
                    ForEach(fna.ratings) { rating in
                        HStack {
                            Image(systemName: rating.domain.icon)
                                .foregroundColor(rating.level.color)
                                .frame(width: 24)
                            Text(rating.domain.rawValue)
                                .font(.subheadline)
                            Spacer()
                            Text(rating.level.label)
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(rating.level.color.opacity(0.12))
                                .foregroundColor(rating.level.color)
                                .clipShape(Capsule())
                        }
                    }
                }
                if !fna.notes.isEmpty {
                    Section("Notes") {
                        Text(fna.notes)
                            .font(.subheadline)
                    }
                }
                Section {
                    Button("Update Assessment") { showAssessment = true }
                }
            } else {
                Section {
                    VStack(spacing: 16) {
                        Image(systemName: "checklist")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("No FNA on file")
                            .font(.headline)
                        Text("Complete a Family Needs Assessment to identify strengths and areas of support.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                        Button("Start Assessment") { showAssessment = true }
                            .buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                }
                .listRowBackground(Color.clear)
            }
        }
        .sheet(isPresented: $showAssessment) {
            FNAFormSheet(familyId: familyId, familyName: familyName, existing: viewModel.assessment) { saved in
                viewModel.assessment = saved
            }
        }
        .task { await viewModel.load() }
        .overlay { if viewModel.isLoading { ProgressView() } }
    }
}

struct FNAFormSheet: View {
    let familyId: String
    let familyName: String
    let existing: FamilyNeedsAssessment?
    let onSave: (FamilyNeedsAssessment) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var ratings: [FNADomainRating]
    @State private var notes = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(familyId: String, familyName: String, existing: FamilyNeedsAssessment?, onSave: @escaping (FamilyNeedsAssessment) -> Void) {
        self.familyId = familyId
        self.familyName = familyName
        self.existing = existing
        self.onSave = onSave
        if let e = existing {
            _ratings = State(initialValue: e.ratings)
            _notes = State(initialValue: e.notes)
        } else {
            _ratings = State(initialValue: FNADomainRating.FNADomain.allCases.map { domain in
                FNADomainRating(id: UUID().uuidString, domain: domain, level: .needsMet, notes: "")
            })
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Rate each domain based on the family's current situation. This assessment is confidential and staff-administered only.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                ForEach($ratings) { $rating in
                    Section {
                        HStack {
                            Image(systemName: rating.domain.icon)
                                .foregroundColor(.accentColor)
                                .frame(width: 28)
                            Text(rating.domain.rawValue)
                                .font(.subheadline.weight(.medium))
                        }
                        Picker("Level", selection: $rating.level) {
                            ForEach(FNADomainRating.FNALevel.allCases, id: \.self) { level in
                                Text(level.label).tag(level)
                            }
                        }
                        .pickerStyle(.segmented)
                        TextField("Notes (optional)", text: $rating.notes)
                            .font(.caption)
                    }
                }
                Section("Overall Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Family Needs Assessment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(isSaving)
                }
            }
            .alert("Couldn't Save Assessment", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
    }

    private func save() {
        isSaving = true
        Task {
            do {
                let saved = try await APIClient.shared.saveFNA(familyId: familyId, ratings: ratings, notes: notes)
                await MainActor.run { onSave(saved); dismiss() }
            } catch {
                // Do NOT fabricate a fake success — see LogContactSheet.save().
                // An FNA is confidential case documentation; losing it silently
                // is worse than making the user retry.
                await MainActor.run {
                    errorMessage = "This assessment wasn't saved. Check your connection and try again."
                }
            }
            isSaving = false
        }
    }
}

@MainActor
class FNAViewModel: ObservableObject {
    let familyId: String
    @Published var assessment: FamilyNeedsAssessment?
    @Published var isLoading = false

    init(familyId: String) { self.familyId = familyId }

    func load() async {
        isLoading = true
        do {
            assessment = try await APIClient.shared.getFNA(familyId: familyId)
        } catch {
            #if DEBUG
            assessment = MockData.fna(for: familyId)
            #endif
        }
        isLoading = false
    }
}

// MARK: - CFCR Tab

struct CFCRTab: View {
    let familyId: String
    @StateObject private var viewModel: CFCRViewModel
    @State private var showNewCFCR = false

    init(familyId: String) {
        self.familyId = familyId
        _viewModel = StateObject(wrappedValue: CFCRViewModel(familyId: familyId))
    }

    var body: some View {
        List {
            if viewModel.records.isEmpty && !viewModel.isLoading {
                Section {
                    VStack(spacing: 12) {
                        Image(systemName: "person.3.fill")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("No Case Reviews")
                            .font(.headline)
                        Text("CFCR meetings are held monthly with the full service team.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                        Button("Document CFCR") { showNewCFCR = true }
                            .buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                }
                .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.records) { record in
                    NavigationLink(destination: CFCRDetailView(record: record)) {
                        CFCRRow(record: record)
                    }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showNewCFCR = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showNewCFCR) {
            NewCFCRSheet(familyId: familyId) { _ in
                Task { await viewModel.load() }
            }
        }
        .task { await viewModel.load() }
        .overlay { if viewModel.isLoading { ProgressView() } }
    }
}

struct CFCRRow: View {
    let record: CFCRRecord

    var attendeeCount: Int { record.participants.filter(\.attended).count }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(record.childName)
                    .font(.subheadline.weight(.medium))
                Spacer()
                Text(record.meetingDate, style: .date)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            HStack(spacing: 8) {
                Label(record.classroom, systemImage: "door.left.hand.closed")
                Label("\(attendeeCount) attendees", systemImage: "person.3")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 2)
    }
}

struct CFCRDetailView: View {
    let record: CFCRRecord

    var body: some View {
        List {
            Section("Meeting Info") {
                LabeledContent("Child", value: record.childName)
                LabeledContent("Classroom", value: record.classroom)
                LabeledContent("Date") { Text(record.meetingDate, style: .date) }
                LabeledContent("Facilitated By", value: record.conductedBy)
            }
            Section("Participants") {
                ForEach(record.participants) { p in
                    HStack {
                        Image(systemName: p.attended ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(p.attended ? .green : .secondary)
                        Text(p.name)
                        Spacer()
                        Text(p.role)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            if !record.attendanceNotes.isEmpty {
                Section("Attendance") { Text(record.attendanceNotes) }
            }
            if !record.healthNotes.isEmpty {
                Section("Health & Nutrition") { Text(record.healthNotes) }
            }
            if !record.behaviorNotes.isEmpty {
                Section("Behavior & Social-Emotional") { Text(record.behaviorNotes) }
            }
            if !record.developmentalNotes.isEmpty {
                Section("Developmental / Screenings") { Text(record.developmentalNotes) }
            }
            if !record.familyGoalNotes.isEmpty {
                Section("Family Goals Progress") { Text(record.familyGoalNotes) }
            }
            if !record.actionItems.isEmpty {
                Section("Action Items") {
                    ForEach(record.actionItems) { item in
                        HStack {
                            Image(systemName: item.isCompleted ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(item.isCompleted ? .green : .secondary)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.description)
                                    .font(.subheadline)
                                Text("→ \(item.assignedTo)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("CFCR")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct NewCFCRSheet: View {
    let familyId: String
    let onSave: (CFCRRecord) -> Void
    @Environment(\.dismiss) private var dismiss

    // Picked from this family's real children — a free-typed name has no real
    // childId to attach the review to, which used to make every CFCR silently
    // fail server-side (see save()).
    @State private var familyChildren: [Child] = []
    @State private var selectedChildId: String?
    @State private var isLoadingChildren = true
    @State private var classroom = ""
    @State private var meetingDate = Date()
    @State private var attendanceNotes = ""
    @State private var healthNotes = ""
    @State private var behaviorNotes = ""
    @State private var developmentalNotes = ""
    @State private var familyGoalNotes = ""
    @State private var participants: [(name: String, role: String, attended: Bool)] = [
        ("", "Teacher", true),
        ("", "Family Advocate", true),
        ("", "Education Coordinator", false),
        ("", "Health Specialist", false)
    ]
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var selectedChild: Child? {
        familyChildren.first { $0.id == selectedChildId }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Child & Meeting") {
                    if isLoadingChildren {
                        ProgressView()
                    } else if familyChildren.isEmpty {
                        Text("No children found for this family.")
                            .foregroundColor(.secondary)
                    } else {
                        Picker("Child", selection: $selectedChildId) {
                            Text("Select a child").tag(String?.none)
                            ForEach(familyChildren) { child in
                                Text("\(child.firstName) \(child.lastName)").tag(Optional(child.id))
                            }
                        }
                    }
                    TextField("Classroom", text: $classroom)
                    DatePicker("Meeting Date", selection: $meetingDate, displayedComponents: .date)
                }
                Section("Participants") {
                    ForEach($participants.indices, id: \.self) { i in
                        HStack {
                            Toggle("", isOn: $participants[i].attended)
                                .labelsHidden()
                            TextField(participants[i].role, text: $participants[i].name)
                            Text(participants[i].role)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                Section("Attendance Notes") {
                    TextEditor(text: $attendanceNotes).frame(minHeight: 70)
                }
                Section("Health & Nutrition Notes") {
                    TextEditor(text: $healthNotes).frame(minHeight: 70)
                }
                Section("Behavior / Social-Emotional Notes") {
                    TextEditor(text: $behaviorNotes).frame(minHeight: 70)
                }
                Section("Developmental / Screening Notes") {
                    TextEditor(text: $developmentalNotes).frame(minHeight: 70)
                }
                Section("Family Goals Progress") {
                    TextEditor(text: $familyGoalNotes).frame(minHeight: 70)
                }
            }
            .navigationTitle("New CFCR")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(selectedChildId == nil || isSaving)
                }
            }
            .alert("Couldn't Save CFCR", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
            .task {
                do {
                    let all = try await APIClient.shared.getChildren()
                    familyChildren = all.filter { $0.familyId == familyId }
                    if familyChildren.count == 1 { selectedChildId = familyChildren.first?.id }
                } catch {
                    #if DEBUG
                    familyChildren = MockData.children.filter { $0.familyId == familyId }
                    #endif
                }
                isLoadingChildren = false
            }
        }
    }

    private func save() {
        guard let child = selectedChild else { return }
        isSaving = true
        let iso = ISO8601DateFormatter()
        let request = NewCFCRRequest(
            childId: child.id,
            meetingDate: iso.string(from: meetingDate),
            attendanceNotes: attendanceNotes,
            healthNotes: healthNotes,
            behaviorNotes: behaviorNotes,
            developmentalNotes: developmentalNotes,
            familyGoalNotes: familyGoalNotes
        )
        Task {
            do {
                let saved = try await APIClient.shared.createCFCR(request: request)
                await MainActor.run { onSave(saved); dismiss() }
            } catch {
                // Do NOT fabricate a fake success — see LogContactSheet.save().
                await MainActor.run {
                    errorMessage = "This review wasn't saved. Check your connection and try again."
                }
            }
            isSaving = false
        }
    }
}

@MainActor
class CFCRViewModel: ObservableObject {
    let familyId: String
    @Published var records: [CFCRRecord] = []
    @Published var isLoading = false

    init(familyId: String) { self.familyId = familyId }

    func load() async {
        isLoading = true
        do {
            records = try await APIClient.shared.getCFCRRecords(childId: familyId)
        } catch {
            #if DEBUG
            records = MockData.cfcrRecords(for: familyId)
            #endif
        }
        isLoading = false
    }
}

// MARK: - Root ViewModel

@MainActor
class FamilyServicesViewModel: ObservableObject {
    @Published var families: [Family] = []
    @Published var searchText = ""
    @Published var isLoading = false

    var filteredFamilies: [Family] {
        guard !searchText.isEmpty else { return families }
        return families.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    func load() async {
        isLoading = true
        do {
            families = try await APIClient.shared.getFamilies()
        } catch {
            #if DEBUG
            families = MockData.families
            #endif
        }
        isLoading = false
    }
}

// MARK: - Case Notes Tab

struct CaseNotesTab: View {
    let familyId: String
    @StateObject private var viewModel: CaseNotesViewModel

    init(familyId: String) {
        self.familyId = familyId
        _viewModel = StateObject(wrappedValue: CaseNotesViewModel(familyId: familyId))
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.notes.isEmpty {
                    CFEmptyState(
                        icon: "note.text",
                        title: "No Case Notes",
                        message: "Document home visits, calls, and significant events here."
                    )
                } else {
                    // Follow-up banner
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            if viewModel.overdueFollowUps > 0 {
                                HStack(spacing: 10) {
                                    Image(systemName: "clock.badge.exclamationmark.fill")
                                        .foregroundColor(.cfHealth)
                                    Text("\(viewModel.overdueFollowUps) overdue follow-up\(viewModel.overdueFollowUps == 1 ? "" : "s")")
                                        .font(.cfSubheadline)
                                        .foregroundColor(.cfHealth)
                                    Spacer()
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(Color.cfHealthBg)
                            }

                            ForEach(viewModel.notes) { note in
                                CaseNoteRow(note: note) {
                                    viewModel.toggleFollowUp(note)
                                }
                                Divider().padding(.leading, 56)
                            }
                        }
                    }
                }
            }

            // Add button
            Button {
                viewModel.showAddSheet = true
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 52, height: 52)
                    .background(Color.cfPrimary)
                    .clipShape(Circle())
                    .shadow(color: Color.cfPrimary.opacity(0.35), radius: 8, y: 4)
            }
            .padding(20)
        }
        .task { await viewModel.load() }
        .sheet(isPresented: $viewModel.showAddSheet) {
            NewCaseNoteSheet(familyId: familyId) { note in
                viewModel.notes.insert(note, at: 0)
            }
        }
    }
}

struct CaseNoteRow: View {
    let note: CaseNote
    let onFollowUpToggle: () -> Void
    @State private var isExpanded = false

    var isFollowUpOverdue: Bool {
        guard note.followUpRequired, !note.followUpCompleted, let due = note.followUpDue else { return false }
        return due < Date()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    // Type icon circle
                    ZStack {
                        Circle()
                            .fill(note.type.color.opacity(0.12))
                            .frame(width: 36, height: 36)
                        Image(systemName: note.type.icon)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(note.type.color)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            CFBadge(label: note.type.rawValue, color: note.type.color)
                            if note.confidentiality == .sensitive {
                                CFBadge(label: "Sensitive", color: .cfHealth)
                            }
                            Spacer()
                            Text(note.createdAt.formatted(.dateTime.month(.abbreviated).day().year()))
                                .font(.cfCaption)
                                .foregroundColor(.cfTextSecondary)
                        }

                        Text(note.body)
                            .font(.cfBody)
                            .foregroundColor(.cfTextPrimary)
                            .lineLimit(isExpanded ? nil : 2)
                            .multilineTextAlignment(.leading)

                        HStack(spacing: 4) {
                            Image(systemName: "person.fill")
                                .font(.cfCaption)
                            Text(note.authorName)
                                .font(.cfCaption)
                        }
                        .foregroundColor(.cfTextSecondary)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .buttonStyle(.plain)

            // Follow-up row (shown when expanded or overdue)
            if note.followUpRequired && (isExpanded || isFollowUpOverdue) {
                HStack(spacing: 8) {
                    Image(systemName: note.followUpCompleted
                          ? "checkmark.circle.fill"
                          : (isFollowUpOverdue ? "clock.badge.exclamationmark.fill" : "clock.fill"))
                        .foregroundColor(note.followUpCompleted ? .cfAttendance : (isFollowUpOverdue ? .cfHealth : .cfFamily))
                        .font(.system(size: 14))

                    if let due = note.followUpDue {
                        Text("Follow-up \(note.followUpCompleted ? "completed" : "due") \(due.formatted(.dateTime.month(.abbreviated).day()))")
                            .font(.cfCaption)
                            .foregroundColor(isFollowUpOverdue && !note.followUpCompleted ? .cfHealth : .cfTextSecondary)
                    }

                    Spacer()

                    if !note.followUpCompleted {
                        Button("Mark Done") { onFollowUpToggle() }
                            .font(.cfCaption2)
                            .fontWeight(.semibold)
                            .foregroundColor(.cfPrimary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.cfPrimaryLight)
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
                .padding(.leading, 48)
            }
        }
    }
}

// MARK: - Case Note Template Engine

struct CaseNoteTemplate: Identifiable {
    let id: String
    let title: String
    let description: String
    let icon: String
    let body: String
    let suggestsFollowUp: Bool
    let recommendedConfidentiality: CaseNote.NoteConfidentiality
}

struct CaseNoteTemplateEngine {

    static let dateStamp: String = {
        let f = DateFormatter()
        f.dateStyle = .long
        return f.string(from: Date())
    }()

    // MARK: Template catalogue
    static func templates(for type: CaseNote.NoteType, familyName: String = "Family") -> [CaseNoteTemplate] {
        switch type {

        case .homeVisit:
            return [
                CaseNoteTemplate(
                    id: "hv-standard", title: "Standard Home Visit",
                    description: "Full structured visit note with observations and next steps",
                    icon: "house.fill",
                    body: """
[HOME VISIT — \(dateStamp)]

PURPOSE OF VISIT:
•\u{0020}

CHILD OBSERVATIONS:
•\u{0020}

FAMILY STRENGTHS NOTED:
•\u{0020}

CONCERNS / NEEDS IDENTIFIED:
•\u{0020}

REFERRALS MADE:
• None

ACTION STEPS:
•\u{0020}

NEXT CONTACT:
""",
                    suggestsFollowUp: true,
                    recommendedConfidentiality: .standard
                ),
                CaseNoteTemplate(
                    id: "hv-attendance", title: "Attendance Focused Visit",
                    description: "For visits where chronic absence is the primary concern",
                    icon: "calendar.badge.exclamationmark",
                    body: """
[HOME VISIT — ATTENDANCE CONCERN — \(dateStamp)]

REASON FOR VISIT:
• Chronic absence follow-up (attendance below 85% threshold)

BARRIERS IDENTIFIED:
•\u{0020}

FAMILY RESPONSE / PLAN:
•\u{0020}

ATTENDANCE IMPROVEMENT PLAN DISCUSSION:
•\u{0020}

NEXT CHECK-IN DATE:
""",
                    suggestsFollowUp: true,
                    recommendedConfidentiality: .standard
                ),
                CaseNoteTemplate(
                    id: "hv-fpa", title: "FPA Review Visit",
                    description: "Family Partnership Agreement goal progress check",
                    icon: "checkmark.seal.fill",
                    body: """
[FPA REVIEW VISIT — \(dateStamp)]

GOALS REVIEWED:
•\u{0020}

PROGRESS SINCE LAST VISIT:
•\u{0020}

BARRIERS TO GOAL COMPLETION:
•\u{0020}

UPDATED GOALS / NEW GOALS:
•\u{0020}

COMMUNITY RESOURCES DISCUSSED:
•\u{0020}

NEXT VISIT:
""",
                    suggestsFollowUp: true,
                    recommendedConfidentiality: .standard
                ),
            ]

        case .phoneCall:
            return [
                CaseNoteTemplate(
                    id: "ph-outreach", title: "Outreach Call",
                    description: "Documenting a family outreach or check-in call",
                    icon: "phone.fill",
                    body: """
[PHONE CONTACT — \(dateStamp)]

CALL INITIATED BY:
•\u{0020}

FAMILY MEMBER REACHED:
•\u{0020}

REASON FOR CONTACT:
•\u{0020}

FAMILY RESPONSE:
•\u{0020}

ACTION ITEMS:
•\u{0020}

FOLLOW-UP NEEDED:
""",
                    suggestsFollowUp: false,
                    recommendedConfidentiality: .standard
                ),
                CaseNoteTemplate(
                    id: "ph-absence", title: "Absence Follow-Up Call",
                    description: "Calling to address missed days or verify wellbeing",
                    icon: "phone.badge.exclamationmark.fill",
                    body: """
[ABSENCE FOLLOW-UP CALL — \(dateStamp)]

DAYS ABSENT LEADING TO CALL:
•\u{0020}

CONTACT REACHED: ☐ Yes  ☐ No — Left voicemail

REASON FOR ABSENCE GIVEN:
•\u{0020}

CHILD WELLBEING:
•\u{0020}

PLAN FOR RETURN:
•\u{0020}

NEXT CONTACT DATE:
""",
                    suggestsFollowUp: true,
                    recommendedConfidentiality: .standard
                ),
            ]

        case .officeVisit:
            return [
                CaseNoteTemplate(
                    id: "ov-meeting", title: "Office Meeting",
                    description: "Family meeting at the Head Start center",
                    icon: "building.2.fill",
                    body: """
[OFFICE VISIT — \(dateStamp)]

FAMILY MEMBERS PRESENT:
•\u{0020}

PURPOSE OF MEETING:
•\u{0020}

KEY DISCUSSION POINTS:
•\u{0020}

AGREEMENTS MADE:
•\u{0020}

REFERRALS PROVIDED:
• None

NEXT STEPS:
""",
                    suggestsFollowUp: false,
                    recommendedConfidentiality: .standard
                ),
                CaseNoteTemplate(
                    id: "ov-enrollment", title: "Enrollment / Re-enrollment Meeting",
                    description: "For enrollment paperwork and eligibility review meetings",
                    icon: "doc.badge.plus",
                    body: """
[ENROLLMENT MEETING — \(dateStamp)]

DOCUMENTS REVIEWED:
• ☐ Income verification  ☐ Birth certificate  ☐ Immunization records  ☐ Custody docs

ELIGIBILITY STATUS:
•\u{0020}

FAMILY QUESTIONS / CONCERNS:
•\u{0020}

NEXT ENROLLMENT STEPS:
""",
                    suggestsFollowUp: true,
                    recommendedConfidentiality: .standard
                ),
            ]

        case .incident:
            return [
                CaseNoteTemplate(
                    id: "inc-standard", title: "Incident Report",
                    description: "Document any incident involving a child or family",
                    icon: "exclamationmark.triangle.fill",
                    body: """
[INCIDENT REPORT — \(dateStamp)]

DATE / TIME OF INCIDENT:
•\u{0020}

LOCATION:
•\u{0020}

PERSONS INVOLVED:
•\u{0020}

DESCRIPTION OF INCIDENT:
•\u{0020}

IMMEDIATE RESPONSE / ACTIONS TAKEN:
•\u{0020}

SUPERVISOR NOTIFIED: ☐ Yes  ☐ No
MANDATED REPORT FILED: ☐ Yes  ☐ No  ☐ N/A

FOLLOW-UP REQUIRED:
""",
                    suggestsFollowUp: true,
                    recommendedConfidentiality: .sensitive
                ),
                CaseNoteTemplate(
                    id: "inc-behavior", title: "Behavior / Suspension Note",
                    description: "§1302.17 — Document behavior incidents and interventions",
                    icon: "person.badge.shield.checkmark.fill",
                    body: """
[BEHAVIOR INCIDENT — \(dateStamp)]

CHILD:
•\u{0020}

BEHAVIOR OBSERVED (antecedent → behavior → consequence):
•\u{0020}

DURATION / INTENSITY:
•\u{0020}

INTERVENTION USED:
•\u{0020}

MENTAL HEALTH CONSULTANT NOTIFIED: ☐ Yes  ☐ No
FAMILY NOTIFIED: ☐ Yes  ☐ No

BEHAVIOR SUPPORT PLAN STATUS:
•\u{0020}

NEXT STEPS:
""",
                    suggestsFollowUp: true,
                    recommendedConfidentiality: .sensitive
                ),
            ]

        case .general:
            return [
                CaseNoteTemplate(
                    id: "gen-summary", title: "General Summary Note",
                    description: "Flexible format for any contact or observation",
                    icon: "note.text",
                    body: """
[NOTE — \(dateStamp)]

SUMMARY:
•\u{0020}

KEY POINTS:
•\u{0020}

ACTION ITEMS:
• None

NEXT STEPS:
""",
                    suggestsFollowUp: false,
                    recommendedConfidentiality: .standard
                ),
                CaseNoteTemplate(
                    id: "gen-health", title: "Health Concern Note",
                    description: "Document a health issue or referral for a child",
                    icon: "heart.text.square.fill",
                    body: """
[HEALTH CONCERN — \(dateStamp)]

CONCERN IDENTIFIED:
•\u{0020}

DATE REPORTED BY FAMILY:
•\u{0020}

PARENT NOTIFICATION: ☐ Completed  ☐ Pending

ACTIONS TAKEN:
•\u{0020}

PROVIDER / SPECIALIST REFERRAL:
•\u{0020}

FOLLOW-UP APPOINTMENT DATE:
""",
                    suggestsFollowUp: true,
                    recommendedConfidentiality: .standard
                ),
            ]
        }
    }

    // MARK: Generate from visit log
    static func fromVisitLog(_ log: HomeVisitLog) -> CaseNoteTemplate {
        let df = DateFormatter()
        df.dateStyle = .long
        let dateStr = df.string(from: log.visitDate)
        let topicsText = log.topicsCovered.map { "• \($0.rawValue)" }.joined(separator: "\n")
        let notesText = log.notes.isEmpty ? "• (None recorded)" : "• \(log.notes)"
        return CaseNoteTemplate(
            id: "from-visit-\(log.id)", title: "From Visit Log",
            description: "Pre-filled from your most recent recorded visit",
            icon: "house.fill",
            body: """
[HOME VISIT — \(dateStr)]

CONDUCTED BY: \(log.conductedBy)
DURATION: \(log.durationMinutes) minutes

PURPOSE / TOPICS COVERED:
\(topicsText)

NOTES FROM VISIT:
\(notesText)

CHILD OBSERVATIONS:
•\u{0020}

FAMILY STRENGTHS NOTED:
•\u{0020}

CONCERNS / NEEDS IDENTIFIED:
•\u{0020}

ACTION STEPS:
•\u{0020}

NEXT VISIT:
""",
            suggestsFollowUp: true,
            recommendedConfidentiality: .standard
        )
    }

    // MARK: Quick-insert phrases by Head Start domain
    static var quickPhrases: [(label: String, text: String)] {
        [
            ("Strength 💪", "Family demonstrated strong support and engagement with the program."),
            ("Goal Progress ✅", "Family made measurable progress toward the goal of "),
            ("Barrier 🚧", "Identified barrier: transportation / childcare / work schedule."),
            ("Referral 📋", "Referred family to [agency] for assistance with "),
            ("Safe Home 🏠", "Home environment observed to be safe, clean, and nurturing."),
            ("Child Dev 🌱", "Child showed age-appropriate development in the area of "),
            ("Health ❤️", "Health concern identified — parent to follow up with pediatrician by "),
            ("Attendance 📅", "Discussed attendance expectations. Family committed to daily attendance."),
            ("Next Contact 📞", "Next contact scheduled for "),
            ("No Concerns ✓", "No immediate safety or wellbeing concerns noted at this time."),
        ]
    }
}

// MARK: - Template Picker Sheet

private struct TemplatePickerSheet: View {
    let noteType: CaseNote.NoteType
    let familyId: String
    let onSelect: (CaseNoteTemplate) -> Void
    @Environment(\.dismiss) private var dismiss

    // Was: computed straight from MockData with no network call at all, and
    // labeled "Live Data" in the UI even though it could never be anything
    // but the fixture. Now loaded for real, and the section just doesn't
    // appear if there's no actual recent visit to import from.
    @State private var recentVisit: HomeVisitLog?

    var body: some View {
        NavigationStack {
            List {
                // "From visit log" shortcut for home visit type
                if noteType == .homeVisit, let visit = recentVisit {
                    Section("From Your Records") {
                        Button {
                            onSelect(CaseNoteTemplateEngine.fromVisitLog(visit))
                            dismiss()
                        } label: {
                            TemplateCard(
                                icon: "clock.arrow.circlepath",
                                title: "Import from Recent Visit",
                                description: "Pre-fill from visit on \(visit.visitDate.formatted(.dateTime.month(.abbreviated).day()))",
                                badge: "Live Data",
                                badgeColor: .cfAttendance
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }

                Section("Smart Templates") {
                    ForEach(CaseNoteTemplateEngine.templates(for: noteType)) { template in
                        Button {
                            onSelect(template)
                            dismiss()
                        } label: {
                            TemplateCard(
                                icon: template.icon,
                                title: template.title,
                                description: template.description,
                                badge: template.recommendedConfidentiality == .sensitive ? "Sensitive" : nil,
                                badgeColor: .cfHealth
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }

                Section {
                    Button("Start with blank note") {
                        dismiss()
                    }
                    .foregroundColor(.cfTextSecondary)
                    .font(.subheadline)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Choose a Template")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task {
                do {
                    let visits = try await APIClient.shared.getVisitLogs(familyId: familyId)
                    recentVisit = visits
                        .filter { $0.visitType == .homeVisit }
                        .sorted { $0.visitDate > $1.visitDate }
                        .first
                } catch {
                    #if DEBUG
                    recentVisit = MockData.visitLogs(for: familyId)
                        .filter { $0.visitType == .homeVisit }
                        .sorted { $0.visitDate > $1.visitDate }
                        .first
                    #endif
                }
            }
        }
    }
}

private struct TemplateCard: View {
    let icon: String
    let title: String
    let description: String
    let badge: String?
    let badgeColor: Color

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.cfPrimary.opacity(0.1))
                    .frame(width: 44, height: 44)
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.cfPrimary)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.cfTextPrimary)
                    if let badge {
                        Text(badge)
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 5).padding(.vertical, 2)
                            .background(badgeColor.opacity(0.12))
                            .foregroundColor(badgeColor)
                            .clipShape(Capsule())
                    }
                }
                Text(description)
                    .font(.caption)
                    .foregroundColor(.cfTextSecondary)
                    .lineLimit(2)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.cfBorder)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - New Case Note Sheet (AI-Assisted)

struct NewCaseNoteSheet: View {
    let familyId: String
    let onSave: (CaseNote) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var noteType: CaseNote.NoteType = .general
    @State private var confidentiality: CaseNote.NoteConfidentiality = .standard
    @State private var noteBody = ""
    @State private var followUpRequired = false
    @State private var followUpDue = Date().addingTimeInterval(7 * 86400)
    @State private var isSaving = false
    @State private var showTemplatePicker = true    // open template picker immediately
    @State private var appliedTemplate: String? = nil
    @State private var errorMessage: String?
    @FocusState private var editorFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                // Smart template status banner
                if let applied = appliedTemplate {
                    Section {
                        HStack(spacing: 10) {
                            Image(systemName: "wand.and.stars")
                                .foregroundColor(.cfPrimary)
                            Text("Template: \(applied)")
                                .font(.caption.weight(.medium))
                                .foregroundColor(.cfPrimary)
                            Spacer()
                            Button("Change") { showTemplatePicker = true }
                                .font(.caption)
                                .foregroundColor(.cfPrimary)
                        }
                    }
                    .listRowBackground(Color.cfPrimary.opacity(0.06))
                }

                Section("Note Type") {
                    Picker("Type", selection: $noteType) {
                        ForEach(CaseNote.NoteType.allCases, id: \.self) { type in
                            Label(type.rawValue, systemImage: type.icon).tag(type)
                        }
                    }
                    .pickerStyle(.navigationLink)
                    .onChange(of: noteType) { _ in
                        if noteBody.isEmpty { showTemplatePicker = true }
                    }
                }

                Section("Confidentiality") {
                    Picker("Level", selection: $confidentiality) {
                        ForEach(CaseNote.NoteConfidentiality.allCases, id: \.self) { level in
                            Label(level.rawValue, systemImage: level.icon).tag(level)
                        }
                    }
                    .pickerStyle(.segmented)
                    if confidentiality == .sensitive {
                        Label("Only visible to authorized staff", systemImage: "info.circle")
                            .font(.cfCaption).foregroundColor(.cfTextSecondary)
                    }
                }

                Section {
                    TextEditor(text: $noteBody)
                        .frame(minHeight: 200)
                        .font(.system(.body, design: .monospaced))
                        .focused($editorFocused)
                } header: {
                    HStack {
                        Text("Note")
                        Spacer()
                        Button {
                            showTemplatePicker = true
                        } label: {
                            Label("Smart Template", systemImage: "wand.and.stars")
                                .font(.caption.weight(.semibold))
                                .foregroundColor(.cfPrimary)
                        }
                    }
                }

                // Quick-insert phrase chips
                Section("Quick Insert") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(CaseNoteTemplateEngine.quickPhrases, id: \.label) { phrase in
                                Button {
                                    let trimmed = noteBody.trimmingCharacters(in: .newlines)
                                    noteBody = trimmed.isEmpty
                                        ? phrase.text
                                        : trimmed + "\n" + phrase.text
                                    editorFocused = true
                                } label: {
                                    Text(phrase.label)
                                        .font(.caption.weight(.medium))
                                        .foregroundColor(.cfPrimary)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(Color.cfPrimary.opacity(0.08))
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section("Follow-up") {
                    Toggle("Follow-up required", isOn: $followUpRequired)
                    if followUpRequired {
                        DatePicker("Due date", selection: $followUpDue, displayedComponents: .date)
                    }
                }
            }
            .navigationTitle("New Case Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .fontWeight(.semibold)
                        .disabled(noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                }
            }
            .sheet(isPresented: $showTemplatePicker) {
                TemplatePickerSheet(noteType: noteType, familyId: familyId) { template in
                    noteBody = template.body
                    confidentiality = template.recommendedConfidentiality
                    if template.suggestsFollowUp { followUpRequired = true }
                    appliedTemplate = template.title
                }
            }
            .alert("Couldn't Save Note", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: { Text(errorMessage ?? "") }
        }
    }

    private func save() {
        isSaving = true
        let request = NewCaseNoteRequest(
            familyId: familyId,
            type: noteType,
            confidentiality: confidentiality,
            body: noteBody,
            followUpRequired: followUpRequired,
            followUpDue: followUpRequired ? followUpDue : nil
        )
        Task {
            do {
                let saved = try await APIClient.shared.createCaseNote(request: request)
                await MainActor.run { onSave(saved); dismiss() }
            } catch {
                // A case note is confidential case documentation — fabricating a
                // fake local success used to make a failed save look identical to
                // a real one, silently losing the record. Surface the error and
                // keep the user's text so they can retry instead.
                await MainActor.run {
                    errorMessage = "This note wasn't saved. Check your connection and try again."
                }
            }
            isSaving = false
        }
    }
}

// MARK: - Child Moments Tab (Portfolio)

struct ChildMomentsTab: View {
    let familyId: String
    let familyName: String
    @StateObject private var viewModel: MomentsViewModel
    @State private var showCompose = false

    init(familyId: String, familyName: String) {
        self.familyId = familyId
        self.familyName = familyName
        _viewModel = StateObject(wrappedValue: MomentsViewModel(familyId: familyId))
    }

    let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.moments.isEmpty {
                CFEmptyState(
                    icon: "photo.on.rectangle.angled",
                    title: "No Moments Yet",
                    message: "Document milestones and activities for the \(familyName) children.",
                    buttonLabel: "Add Moment",
                    buttonAction: { showCompose = true }
                )
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(viewModel.moments) { moment in
                            MomentCard(moment: moment)
                        }
                    }
                    .padding(16)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showCompose = true
                } label: {
                    Label("Add", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showCompose) {
            AddMomentSheet(familyId: familyId) { moment in
                viewModel.add(moment)
            }
        }
        .task { await viewModel.load() }
    }
}

struct MomentCard: View {
    let moment: ChildMoment

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(
                        LinearGradient(
                            colors: [moment.color.opacity(0.25), moment.color.opacity(0.1)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 100)
                Image(systemName: moment.icon)
                    .font(.system(size: 32))
                    .foregroundColor(moment.color.opacity(0.7))
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(moment.title)
                    .font(.cfCaption.bold())
                    .foregroundColor(.cfTextPrimary)
                    .lineLimit(2)
                HStack(spacing: 4) {
                    Text(moment.childName)
                        .font(.cfCaption2)
                        .foregroundColor(.cfChildren)
                    Spacer()
                    Text(moment.dateLabel)
                        .font(.cfCaption2)
                        .foregroundColor(.cfTextSecondary)
                }
                if !moment.category.isEmpty {
                    Text(moment.category)
                        .font(.cfCaption2)
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(moment.color)
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 8)
        }
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .cfCardShadow()
    }
}

struct AddMomentSheet: View {
    let familyId: String
    let onSave: (ChildMoment) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var childName = ""
    @State private var category: ChildMoment.Category = .learning
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Child") {
                    TextField("Child's name", text: $childName)
                }
                Section("Moment") {
                    TextField("What happened?", text: $title)
                    Picker("Category", selection: $category) {
                        ForEach(ChildMoment.Category.allCases, id: \.self) { cat in
                            Label(cat.rawValue, systemImage: cat.icon).tag(cat)
                        }
                    }
                    .pickerStyle(.navigationLink)
                }
            }
            .navigationTitle("Add Moment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let m = ChildMoment(
                            id: UUID().uuidString,
                            familyId: familyId,
                            childName: childName.isEmpty ? "Child" : childName,
                            title: title,
                            category: category.rawValue,
                            icon: category.icon,
                            color: category.color,
                            recordedAt: Date()
                        )
                        onSave(m)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(title.isEmpty)
                }
            }
        }
    }
}

struct ChildMoment: Identifiable {
    let id: String
    let familyId: String
    let childName: String
    let title: String
    let category: String
    let icon: String
    let color: Color
    let recordedAt: Date

    var dateLabel: String {
        recordedAt.formatted(.dateTime.month(.abbreviated).day())
    }

    enum Category: String, CaseIterable {
        case learning     = "Learning"
        case social       = "Social"
        case milestone    = "Milestone"
        case health       = "Health"
        case art          = "Art & Play"
        case language     = "Language"

        var icon: String {
            switch self {
            case .learning:  return "book.fill"
            case .social:    return "person.2.fill"
            case .milestone: return "star.fill"
            case .health:    return "heart.fill"
            case .art:       return "paintbrush.fill"
            case .language:  return "text.bubble.fill"
            }
        }

        var color: Color {
            switch self {
            case .learning:  return .cfChildren
            case .social:    return .cfGoals
            case .milestone: return .cfAccent
            case .health:    return .cfHealth
            case .art:       return .cfFamily
            case .language:  return .cfPrimary
            }
        }
    }
}

@MainActor
class MomentsViewModel: ObservableObject {
    let familyId: String
    @Published var moments: [ChildMoment] = []

    init(familyId: String) { self.familyId = familyId }

    func load() async {
        moments = [
            ChildMoment(id: "m1", familyId: familyId, childName: "Sofia",
                        title: "Counted to 20 independently!", category: "Learning",
                        icon: "book.fill", color: .cfChildren,
                        recordedAt: Date().addingTimeInterval(-86400)),
            ChildMoment(id: "m2", familyId: familyId, childName: "Sofia",
                        title: "Helped a friend who was upset at circle time",
                        category: "Social", icon: "person.2.fill", color: .cfGoals,
                        recordedAt: Date().addingTimeInterval(-86400 * 3)),
            ChildMoment(id: "m3", familyId: familyId, childName: "Sofia",
                        title: "First full sentence in English!", category: "Language",
                        icon: "text.bubble.fill", color: .cfPrimary,
                        recordedAt: Date().addingTimeInterval(-86400 * 7)),
            ChildMoment(id: "m4", familyId: familyId, childName: "Sofia",
                        title: "Painted a family portrait during art time 🎨",
                        category: "Art & Play", icon: "paintbrush.fill", color: .cfFamily,
                        recordedAt: Date().addingTimeInterval(-86400 * 10)),
        ]
    }

    func add(_ moment: ChildMoment) {
        moments.insert(moment, at: 0)
    }
}

@MainActor
class CaseNotesViewModel: ObservableObject {
    let familyId: String
    @Published var notes: [CaseNote] = []
    @Published var isLoading = false
    @Published var showAddSheet = false

    var overdueFollowUps: Int {
        notes.filter { n in
            n.followUpRequired && !n.followUpCompleted &&
            (n.followUpDue.map { $0 < Date() } ?? false)
        }.count
    }

    init(familyId: String) {
        self.familyId = familyId
    }

    func load() async {
        isLoading = true
        do {
            notes = try await APIClient.shared.getCaseNotes(familyId: familyId)
        } catch {
            #if DEBUG
            notes = MockData.caseNotes(for: familyId)
            #endif
        }
        isLoading = false
    }

    func toggleFollowUp(_ note: CaseNote) {
        guard let idx = notes.firstIndex(where: { $0.id == note.id }) else { return }
        notes[idx].followUpCompleted = true
        Task {
            _ = try? await APIClient.shared.updateCaseNote(noteId: note.id, followUpCompleted: true)
        }
    }
}
