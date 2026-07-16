import SwiftUI

// MARK: - Health Records Hub

struct HealthView: View {
    @StateObject private var viewModel: HealthViewModel
    @State private var showMenu = false
    @State private var showAddRecord = false

    /// Pass a status ("Overdue" / "Due Soon" / "Current") to open with that
    /// filter pill pre-selected — used by dashboard alert deep links.
    init(initialStatusFilter: String? = nil) {
        let vm = HealthViewModel()
        vm.statusFilter = initialStatusFilter
        _viewModel = StateObject(wrappedValue: vm)
    }

    var body: some View {
        NavigationStack {
            List {
                // Tappable status summary pills
                Section {
                    HStack(spacing: 12) {
                        FilterPill(
                            label: "Current",
                            count: viewModel.currentCount,
                            color: .cfAttendance,
                            isSelected: viewModel.statusFilter == "Current"
                        ) {
                            viewModel.toggleFilter("Current")
                        }
                        FilterPill(
                            label: "Due Soon",
                            count: viewModel.dueSoonCount,
                            color: .orange,
                            isSelected: viewModel.statusFilter == "Due Soon"
                        ) {
                            viewModel.toggleFilter("Due Soon")
                        }
                        FilterPill(
                            label: "Overdue",
                            count: viewModel.overdueCount,
                            color: .cfHealth,
                            isSelected: viewModel.statusFilter == "Overdue"
                        ) {
                            viewModel.toggleFilter("Overdue")
                        }
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(.init())
                    .padding(.vertical, 4)
                }

                // Compliance deadline tracker — 45-day health / 90-day dental
                Section {
                    NavigationLink(destination: HealthComplianceView()) {
                        HStack(spacing: 14) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(Color.cfHealth.opacity(0.12))
                                    .frame(width: 40, height: 40)
                                Image(systemName: "calendar.badge.exclamationmark")
                                    .font(.system(size: 17, weight: .semibold))
                                    .foregroundColor(.cfHealth)
                            }
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Compliance Deadlines")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(.cfTextPrimary)
                                Text("45-day health · 90-day dental · Drills · MH consults")
                                    .font(.caption)
                                    .foregroundColor(.cfTextSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundColor(.cfTextSecondary)
                        }
                        .padding(.vertical, 4)
                    }
                }

                // Category rows — each navigates to its record list
                Section("Records") {
                    ForEach(HealthCategory.allCases, id: \.self) { category in
                        let records = viewModel.filteredRecords(for: category)
                        let allRecords = viewModel.records(for: category)
                        let overdue = allRecords.filter { $0.status == "Overdue" }.count
                        let dueSoon = allRecords.filter { $0.status == "Due Soon" }.count

                        NavigationLink(destination: HealthCategoryDetailView(category: category, viewModel: viewModel)) {
                            HStack(spacing: 14) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 10)
                                        .fill(category.color.opacity(0.12))
                                        .frame(width: 40, height: 40)
                                    Image(systemName: category.icon)
                                        .font(.system(size: 17, weight: .semibold))
                                        .foregroundColor(category.color)
                                }

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(category.displayName)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundColor(.cfTextPrimary)
                                    Text(childCountLabel(allRecords.count))
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                Spacer()

                                if overdue > 0 {
                                    StatusBadge(text: "\(overdue) overdue", color: .cfHealth)
                                } else if dueSoon > 0 {
                                    StatusBadge(text: "\(dueSoon) due soon", color: .orange)
                                } else if !allRecords.isEmpty {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.cfAttendance)
                                        .font(.system(size: 16))
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Health Records")
            .searchable(text: $viewModel.searchText, prompt: "Search by child name")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { showMenu = true } label: {
                        Image(systemName: "line.3.horizontal")
                            .foregroundColor(.cfPrimary)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showAddRecord = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showMenu) { AppMenuSheet() }
            .sheet(isPresented: $showAddRecord) {
                AddHealthRecordSheet(viewModel: viewModel)
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }

    private func childCountLabel(_ count: Int) -> String {
        count == 0 ? "No records" : count == 1 ? "1 child" : "\(count) children"
    }
}

// MARK: - Category Detail View

struct HealthCategoryDetailView: View {
    let category: HealthCategory
    @ObservedObject var viewModel: HealthViewModel
    @State private var showAddRecord = false

    var records: [HealthRecord] { viewModel.records(for: category) }

    var body: some View {
        List {
            if records.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: category.icon)
                        .font(.system(size: 40))
                        .foregroundColor(category.color.opacity(0.4))
                    Text("No \(category.displayName) records")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Button("Add First Record") { showAddRecord = true }
                        .foregroundColor(category.color)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
                .listRowBackground(Color.clear)
            } else {
                // Group by status
                let overdue = records.filter { $0.status == "Overdue" }
                let dueSoon = records.filter { $0.status == "Due Soon" }
                let current = records.filter { $0.status == "Current" }

                if !overdue.isEmpty {
                    Section {
                        ForEach(overdue) { record in
                            NavigationLink(destination: HealthRecordDetailView(record: record, viewModel: viewModel)) {
                                HealthRecordRow(record: record)
                            }
                        }
                    } header: {
                        Label("Overdue", systemImage: "exclamationmark.circle.fill")
                            .foregroundColor(.cfHealth)
                    }
                }

                if !dueSoon.isEmpty {
                    Section {
                        ForEach(dueSoon) { record in
                            NavigationLink(destination: HealthRecordDetailView(record: record, viewModel: viewModel)) {
                                HealthRecordRow(record: record)
                            }
                        }
                    } header: {
                        Label("Due Soon", systemImage: "clock.fill")
                            .foregroundColor(.orange)
                    }
                }

                if !current.isEmpty {
                    Section {
                        ForEach(current) { record in
                            NavigationLink(destination: HealthRecordDetailView(record: record, viewModel: viewModel)) {
                                HealthRecordRow(record: record)
                            }
                        }
                    } header: {
                        Label("Current", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.cfAttendance)
                    }
                }
            }
        }
        .navigationTitle(category.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAddRecord = true } label: {
                    Label("Add Record", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddRecord) {
            AddHealthRecordSheet(defaultCategory: category, viewModel: viewModel)
        }
    }
}

// MARK: - Health Record Detail View

struct HealthRecordDetailView: View {
    let record: HealthRecord
    @ObservedObject var viewModel: HealthViewModel
    @State private var showMarkComplete = false
    @State private var nextDueDate = Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date()
    @State private var showReschedule = false

    var body: some View {
        List {
            Section {
                HStack(spacing: 14) {
                    Circle()
                        .fill(Color.cfPrimary.opacity(0.12))
                        .frame(width: 50, height: 50)
                        .overlay {
                            Text(record.childName.prefix(2).uppercased())
                                .font(.cfSubheadline.bold())
                                .foregroundColor(.cfPrimary)
                        }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(record.childName)
                            .font(.cfHeadline)
                            .foregroundColor(.cfTextPrimary)
                        HealthStatusBadge(status: record.status)
                    }
                }
                .padding(.vertical, 4)
            }

            Section("Record Details") {
                LabeledContent("Type", value: record.category.capitalized)
                if let due = record.dueDate {
                    LabeledContent("Due Date") {
                        Text(due, style: .date)
                            .foregroundColor(record.status == "Overdue" ? .cfHealth : .primary)
                    }
                }
                if let completed = record.completedDate {
                    LabeledContent("Completed") {
                        Text(completed, style: .date)
                            .foregroundColor(.cfAttendance)
                    }
                }
            }

            Section("Actions") {
                if record.status != "Current" {
                    Button {
                        showMarkComplete = true
                    } label: {
                        Label("Mark as Completed", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.cfAttendance)
                    }
                }

                Button {
                    showReschedule = true
                } label: {
                    Label("Reschedule Next Visit", systemImage: "calendar.badge.plus")
                        .foregroundColor(.cfPrimary)
                }
            }
        }
        .navigationTitle(record.childName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showMarkComplete) {
            MarkCompleteSheet(record: record, viewModel: viewModel)
        }
        .sheet(isPresented: $showReschedule) {
            RescheduleSheet(record: record, viewModel: viewModel)
        }
    }
}

// MARK: - Mark Complete Sheet

struct MarkCompleteSheet: View {
    let record: HealthRecord
    @ObservedObject var viewModel: HealthViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var completedDate = Date()
    @State private var scheduleNext = true
    @State private var nextDueDate = Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date()
    @State private var notes = ""
    @State private var isSaving = false
    @State private var showError = false
    @State private var errorText = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Completed") {
                    DatePicker("Completion Date", selection: $completedDate, displayedComponents: .date)
                }

                Section {
                    Toggle("Schedule Next Visit", isOn: $scheduleNext)
                    if scheduleNext {
                        DatePicker("Next Due Date", selection: $nextDueDate, displayedComponents: .date)
                    }
                }

                Section("Notes (Optional)") {
                    TextField("Provider, location, or notes…", text: $notes, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section {
                    Button {
                        save()
                    } label: {
                        HStack {
                            if isSaving { ProgressView().padding(.trailing, 4) }
                            Text("Save")
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                    }
                    .foregroundColor(.cfAttendance)
                    .fontWeight(.semibold)
                    .disabled(isSaving)
                }
            }
            .navigationTitle("Mark as Complete")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .alert("Couldn't Save", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorText)
            }
        }
    }

    private func save() {
        isSaving = true
        Task {
            let ok = await viewModel.markComplete(record, completedDate: completedDate, nextDue: scheduleNext ? nextDueDate : nil)
            isSaving = false
            if ok {
                dismiss()
            } else {
                errorText = viewModel.errorMessage ?? "Couldn't mark that record as completed. Check your connection and try again."
                showError = true
            }
        }
    }
}

// MARK: - Reschedule Sheet

struct RescheduleSheet: View {
    let record: HealthRecord
    @ObservedObject var viewModel: HealthViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var newDate = Calendar.current.date(byAdding: .month, value: 6, to: Date()) ?? Date()
    @State private var isSaving = false
    @State private var showError = false
    @State private var errorText = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("New Due Date") {
                    DatePicker("Due Date", selection: $newDate, displayedComponents: .date)
                }

                Section {
                    HStack(spacing: 12) {
                        ForEach([3, 6, 12], id: \.self) { months in
                            Button {
                                newDate = Calendar.current.date(byAdding: .month, value: months, to: Date()) ?? Date()
                            } label: {
                                Text("+\(months)mo")
                                    .font(.cfCaption.bold())
                                    .foregroundColor(.cfPrimary)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(Color.cfPrimaryLight)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .listRowBackground(Color.clear)
                }

                Section {
                    Button {
                        save()
                    } label: {
                        HStack {
                            if isSaving { ProgressView().padding(.trailing, 4) }
                            Text("Save")
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                    }
                    .foregroundColor(.cfPrimary)
                    .fontWeight(.semibold)
                    .disabled(isSaving)
                }
            }
            .navigationTitle("Reschedule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .alert("Couldn't Save", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorText)
            }
        }
    }

    private func save() {
        isSaving = true
        Task {
            let ok = await viewModel.reschedule(record, nextDue: newDate)
            isSaving = false
            if ok {
                dismiss()
            } else {
                errorText = viewModel.errorMessage ?? "Couldn't reschedule that visit. Check your connection and try again."
                showError = true
            }
        }
    }
}

// MARK: - Add Health Record Sheet

struct AddHealthRecordSheet: View {
    var defaultCategory: HealthCategory? = nil
    @ObservedObject var viewModel: HealthViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var children: [Child] = []
    @State private var selectedChildId = ""
    @State private var selectedCategory: HealthCategory = .physical
    @State private var dueDate = Calendar.current.date(byAdding: .month, value: 3, to: Date()) ?? Date()
    @State private var isCompleted = false
    @State private var completedDate = Date()
    @State private var isSaving = false
    @State private var showError = false
    @State private var errorText = ""

    private var selectedChildName: String {
        children.first { $0.id == selectedChildId }?.fullName ?? ""
    }

    var canSave: Bool { !selectedChildId.isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section("Child") {
                    Menu {
                        ForEach(children) { child in
                            Button(child.fullName) { selectedChildId = child.id }
                        }
                    } label: {
                        HStack {
                            Text("Child").foregroundColor(.cfTextPrimary)
                            Spacer()
                            Text(selectedChildName.isEmpty ? "Select…" : selectedChildName)
                                .foregroundColor(selectedChildName.isEmpty ? .secondary : .cfPrimary)
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .disabled(children.isEmpty)
                }

                Section("Record Type") {
                    Picker("Category", selection: $selectedCategory) {
                        ForEach(HealthCategory.allCases, id: \.self) { cat in
                            Text(cat.displayName).tag(cat)
                        }
                    }
                    .pickerStyle(.navigationLink)
                }

                Section("Dates") {
                    DatePicker("Due Date", selection: $dueDate, displayedComponents: .date)

                    Toggle("Already Completed", isOn: $isCompleted)
                    if isCompleted {
                        DatePicker("Completion Date", selection: $completedDate, in: ...Date(), displayedComponents: .date)
                    }
                }

                Section {
                    Button {
                        save()
                    } label: {
                        HStack {
                            if isSaving { ProgressView().padding(.trailing, 4) }
                            Text("Add Record")
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                    }
                    .foregroundColor(canSave ? .cfPrimary : .secondary)
                    .fontWeight(.semibold)
                    .disabled(!canSave || isSaving)
                }
            }
            .navigationTitle("Add Record")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .alert("Couldn't Save", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorText)
            }
        }
        .onAppear {
            if let cat = defaultCategory { selectedCategory = cat }
        }
        .task {
            children = (try? await APIClient.shared.getChildren()) ?? []
        }
    }

    private func save() {
        isSaving = true
        Task {
            let ok = await viewModel.add(
                childId: selectedChildId,
                category: selectedCategory,
                dueDate: dueDate,
                completedDate: isCompleted ? completedDate : nil
            )
            isSaving = false
            if ok {
                dismiss()
            } else {
                errorText = viewModel.errorMessage ?? "Couldn't save that health record. Check your connection and try again."
                showError = true
            }
        }
    }
}

// MARK: - Supporting Views

struct FilterPill: View {
    let label: String
    let count: Int
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Text("\(count)")
                    .font(.title2.bold())
                    .foregroundColor(isSelected ? .white : color)
                Text(label)
                    .font(.caption)
                    .foregroundColor(isSelected ? .white.opacity(0.9) : .secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(isSelected ? color : color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(color, lineWidth: 1.5)
                }
            }
            .animation(.easeInOut(duration: 0.15), value: isSelected)
        }
        .buttonStyle(.plain)
    }
}

struct StatusBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.bold())
            .foregroundColor(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color)
            .clipShape(Capsule())
    }
}

struct HealthSummaryPill: View {
    let label: String
    let count: Int
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text("\(count)")
                .font(.title2.bold())
                .foregroundColor(color)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

struct HealthRecordRow: View {
    let record: HealthRecord

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(record.childName)
                    .font(.subheadline.weight(.medium))
                if let date = record.dueDate {
                    Text(record.status == "Current" ? "Due: " : "Was due: ")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    + Text(date, style: .date)
                        .font(.caption)
                        .foregroundColor(record.status == "Overdue" ? .cfHealth : .secondary)
                }
            }
            Spacer()
            HealthStatusBadge(status: record.status)
        }
        .padding(.vertical, 2)
    }
}

struct HealthStatusBadge: View {
    let status: String

    var color: Color {
        switch status {
        case "Current": return .cfAttendance
        case "Due Soon": return .orange
        case "Overdue": return .cfHealth
        default: return .secondary
        }
    }

    var icon: String {
        switch status {
        case "Current": return "checkmark.circle.fill"
        case "Due Soon": return "clock.fill"
        case "Overdue": return "exclamationmark.circle.fill"
        default: return "questionmark.circle"
        }
    }

    var body: some View {
        Label(status, systemImage: icon)
            .font(.caption.weight(.semibold))
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}

// MARK: - HealthCategory

enum HealthCategory: String, CaseIterable {
    case physical      = "physical"
    case dental        = "dental"
    case vision        = "vision"
    case hearing       = "hearing"
    case immunizations = "immunizations"

    var displayName: String {
        switch self {
        case .physical:      return "Physical Exams"
        case .dental:        return "Dental Exams"
        case .vision:        return "Vision Screening"
        case .hearing:       return "Hearing Screening"
        case .immunizations: return "Immunizations"
        }
    }

    var icon: String {
        switch self {
        case .physical:      return "stethoscope"
        case .dental:        return "mouth.fill"
        case .vision:        return "eye.fill"
        case .hearing:       return "ear.fill"
        case .immunizations: return "syringe.fill"
        }
    }

    var color: Color {
        switch self {
        case .physical:      return .cfPrimary
        case .dental:        return .cfChildren
        case .vision:        return .cfGoals
        case .hearing:       return .cfAttendance
        case .immunizations: return .cfHealth
        }
    }
}

// MARK: - ViewModel

@MainActor
class HealthViewModel: ObservableObject {
    @Published var allRecords: [HealthRecord] = []
    @Published var searchText = ""
    @Published var statusFilter: String? = nil
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?

    var currentCount: Int  { allRecords.filter { $0.status == "Current" }.count }
    var dueSoonCount: Int  { allRecords.filter { $0.status == "Due Soon" }.count }
    var overdueCount: Int  { allRecords.filter { $0.status == "Overdue" }.count }

    func toggleFilter(_ status: String) {
        statusFilter = statusFilter == status ? nil : status
    }

    func records(for category: HealthCategory) -> [HealthRecord] {
        allRecords.filter { $0.category == category.rawValue }
    }

    func filteredRecords(for category: HealthCategory) -> [HealthRecord] {
        var base = records(for: category)
        if let f = statusFilter { base = base.filter { $0.status == f } }
        if !searchText.isEmpty { base = base.filter { $0.childName.localizedCaseInsensitiveContains(searchText) } }
        return base
    }

    /// Creates the record on the server, then refreshes `allRecords` from
    /// the server so status/derived fields match the backend exactly.
    @discardableResult
    func add(childId: String, category: HealthCategory, dueDate: Date?, completedDate: Date?) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await APIClient.shared.createHealthRecord(
                childId: childId,
                category: category.rawValue,
                completedDate: completedDate,
                dueDate: dueDate
            )
            await load()
            errorMessage = nil
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't save that health record. Check your connection and try again."
            return false
        }
    }

    /// "Mark as Completed": sends completedDate (server derives status =
    /// current) and, if the caller scheduled a follow-up, the new dueDate.
    @discardableResult
    func markComplete(_ record: HealthRecord, completedDate: Date, nextDue: Date?) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await APIClient.shared.updateHealthRecord(id: record.id, completedDate: completedDate, dueDate: nextDue)
            await load()
            errorMessage = nil
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't mark that record as completed. Check your connection and try again."
            return false
        }
    }

    /// "Reschedule Next Visit": updates dueDate only; server recomputes status.
    @discardableResult
    func reschedule(_ record: HealthRecord, nextDue: Date) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await APIClient.shared.updateHealthRecord(id: record.id, dueDate: nextDue)
            await load()
            errorMessage = nil
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't reschedule that visit. Check your connection and try again."
            return false
        }
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            allRecords = try await APIClient.shared.getHealthRecords()
            errorMessage = nil
        } catch {
            #if DEBUG
            let now = Date()
            let soon  = Calendar.current.date(byAdding: .day, value: 25, to: now)!
            let past  = Calendar.current.date(byAdding: .day, value: -90, to: now)!
            let overdue = Calendar.current.date(byAdding: .day, value: -15, to: now)!
            allRecords = [
                // Physical Exams
                HealthRecord(id: "h1",  childId: "c1", childName: "Sofia Martinez",    category: "physical",      status: "Current",  dueDate: Calendar.current.date(byAdding: .month, value: 8, to: now), completedDate: past),
                HealthRecord(id: "h5",  childId: "c3", childName: "Emma Rodriguez",    category: "physical",      status: "Current",  dueDate: Calendar.current.date(byAdding: .month, value: 6, to: now), completedDate: past),
                HealthRecord(id: "h6",  childId: "c4", childName: "Diego Rodriguez",   category: "physical",      status: "Overdue",  dueDate: overdue, completedDate: nil),
                HealthRecord(id: "h8",  childId: "c5", childName: "Jason Chen",        category: "physical",      status: "Current",  dueDate: Calendar.current.date(byAdding: .month, value: 9, to: now), completedDate: past),
                // Dental Exams
                HealthRecord(id: "h2",  childId: "c1", childName: "Sofia Martinez",    category: "dental",        status: "Due Soon", dueDate: soon, completedDate: nil),
                HealthRecord(id: "h3",  childId: "c2", childName: "Marcus Williams",   category: "dental",        status: "Overdue",  dueDate: overdue, completedDate: nil),
                HealthRecord(id: "h9",  childId: "c6", childName: "Aaliyah Thompson",  category: "dental",        status: "Current",  dueDate: Calendar.current.date(byAdding: .month, value: 3, to: now), completedDate: past),
                HealthRecord(id: "h15", childId: "c5", childName: "Jason Chen",        category: "dental",        status: "Overdue",  dueDate: overdue, completedDate: nil),
                // Vision
                HealthRecord(id: "h4",  childId: "c2", childName: "Marcus Williams",   category: "vision",        status: "Current",  dueDate: Calendar.current.date(byAdding: .month, value: 5, to: now), completedDate: past),
                HealthRecord(id: "h10", childId: "c4", childName: "Diego Rodriguez",   category: "vision",        status: "Due Soon", dueDate: soon, completedDate: nil),
                // Hearing
                HealthRecord(id: "h7",  childId: "c4", childName: "Diego Rodriguez",   category: "hearing",       status: "Due Soon", dueDate: soon, completedDate: nil),
                HealthRecord(id: "h11", childId: "c5", childName: "Jason Chen",        category: "hearing",       status: "Current",  dueDate: Calendar.current.date(byAdding: .month, value: 7, to: now), completedDate: past),
                // Immunizations
                HealthRecord(id: "h12", childId: "c1", childName: "Sofia Martinez",    category: "immunizations", status: "Current",  dueDate: Calendar.current.date(byAdding: .month, value: 10, to: now), completedDate: past),
                HealthRecord(id: "h13", childId: "c3", childName: "Emma Rodriguez",    category: "immunizations", status: "Overdue",  dueDate: overdue, completedDate: nil),
                HealthRecord(id: "h14", childId: "c6", childName: "Aaliyah Thompson",  category: "immunizations", status: "Due Soon", dueDate: soon, completedDate: nil),
            ]
            #else
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load health records. Check your connection and try again."
            #endif
        }
    }
}
