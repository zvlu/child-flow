import SwiftUI

// MARK: - Grant & Budget (Head Start §75.306 non-federal match / burn rate)
//
// Mirrors client/src/pages/GrantBudget.tsx for the native staff app. Backed
// by server/grantBudgetRest.ts, which reuses the existing business logic in
// server/grantBudget.ts (getGrantSummary / setBudgetLine / addExpense).
//
// Money convention: every `*Cents` field below is an integer number of
// cents, exactly matching what grantBudgetRest.ts sends — division by 100
// happens only at render time (see `currencyString`).

// MARK: - Wire models (mirror server/grantBudgetRest.ts JSON exactly)

struct GrantCategorySummary: Decodable, Identifiable {
    let category: String
    let budgetedCents: Int
    let spentCents: Int
    let pct: Int

    var id: String { category }
}

struct GrantRecentExpense: Decodable, Identifiable {
    let id: String
    let fiscalYear: String
    let category: String
    let description: String
    let amountCents: Int
    let expenseDate: Date
    let nonFederalShare: Bool
}

struct GrantSummary: Decodable {
    let fiscalYear: String
    let totalBudgetCents: Int
    let totalSpentCents: Int
    let burnPct: Int
    let federalSpendCents: Int
    let nonFederalShareCents: Int
    let matchPct: Int
    let carryoverEstimateCents: Int
    let categories: [GrantCategorySummary]
    let recentExpenses: [GrantRecentExpense]
}

// MARK: - Grant cost categories (mirrors GRANT_CATEGORIES in server/grantBudget.ts)

enum GrantCategoryOption: String, CaseIterable, Identifiable {
    case education
    case health
    case disabilityServices = "disability_services"
    case familyServices = "family_services"
    case programManagement = "program_management"
    case transportation
    case facilities
    case tta
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .education: return "Education"
        case .health: return "Health"
        case .disabilityServices: return "Disability Services"
        case .familyServices: return "Family Services"
        case .programManagement: return "Program Management"
        case .transportation: return "Transportation"
        case .facilities: return "Facilities"
        case .tta: return "Training & Technical Assistance"
        case .other: return "Other"
        }
    }
}

private func categoryLabel(_ raw: String) -> String {
    GrantCategoryOption(rawValue: raw)?.label ?? raw.capitalized
}

private func currencyString(_ cents: Int) -> String {
    (Double(cents) / 100).formatted(.currency(code: "USD"))
}

private func centsFromDollarString(_ text: String) -> Int {
    guard let dollars = Double(text) else { return 0 }
    return Int((dollars * 100).rounded())
}

// MARK: - APIClient extension
//
// getGrantSummary / setGrantBudgetLine / addGrantExpense follow the same
// call ergonomics as every other APIClient method (`try await
// APIClient.shared.foo(...)`), but this feature must not modify the shared
// ios/Sources/Networking/APIClient.swift file. APIClient's `get`/`post`
// helpers are `private` to that file (Swift's `private` is file-scoped, so
// an extension declared here cannot call them), so these three methods do
// their own minimal request/response cycle instead — same base URL, auth
// header, and date encode/decode conventions as APIClient.swift, just
// duplicated locally. If APIClient.swift's base URL or date handling ever
// changes, keep this block in sync.
extension APIClient {
    func getGrantSummary(fiscalYear: String) async throws -> GrantSummary {
        try await grantBudgetGet("grants/summary?fiscalYear=\(fiscalYear)")
    }

    func setGrantBudgetLine(fiscalYear: String, category: String, budgetedCents: Int) async throws {
        struct Body: Encodable {
            let fiscalYear: String
            let category: String
            let budgetedCents: Int
        }
        let _: SuccessResponse = try await grantBudgetPost(
            "grants/budget-line",
            body: Body(fiscalYear: fiscalYear, category: category, budgetedCents: budgetedCents)
        )
    }

    func addGrantExpense(
        fiscalYear: String,
        category: String,
        description: String,
        amountCents: Int,
        expenseDate: Date,
        nonFederalShare: Bool
    ) async throws {
        struct Body: Encodable {
            let fiscalYear: String
            let category: String
            let description: String
            let amountCents: Int
            let expenseDate: Date
            let nonFederalShare: Bool
        }
        let _: SuccessResponse = try await grantBudgetPost(
            "grants/expenses",
            body: Body(
                fiscalYear: fiscalYear,
                category: category,
                description: description,
                amountCents: amountCents,
                expenseDate: expenseDate,
                nonFederalShare: nonFederalShare
            )
        )
    }

    // MARK: Self-contained networking (see note above)

    private static let grantBudgetBaseURL = URL(string: "http://localhost:3000/api")!
    private static let grantBudgetTokenAccount = "auth_token"

    private static let grantBudgetDecoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            if let date = fractional.date(from: value) ?? plain.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unrecognized date format: \(value)")
        }
        return d
    }()

    private static let grantBudgetEncoder: JSONEncoder = {
        let e = JSONEncoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(fractional.string(from: date))
        }
        return e
    }()

    private func grantBudgetMakeURL(_ path: String) -> URL {
        let base = Self.grantBudgetBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.grantBudgetBaseURL.appendingPathComponent(path)
    }

    private func grantBudgetValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func grantBudgetGet<T: Decodable>(_ path: String) async throws -> T {
        let url = grantBudgetMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = KeychainHelper.get(Self.grantBudgetTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        try grantBudgetValidate(response)
        return try Self.grantBudgetDecoder.decode(T.self, from: data)
    }

    private func grantBudgetPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = grantBudgetMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = KeychainHelper.get(Self.grantBudgetTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try Self.grantBudgetEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try grantBudgetValidate(response)
        return try Self.grantBudgetDecoder.decode(T.self, from: data)
    }
}

// MARK: - View Model

@MainActor
final class GrantBudgetViewModel: ObservableObject {
    @Published var fiscalYear: String
    @Published var summary: GrantSummary?
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?

    let availableFiscalYears: [String]

    init(referenceDate: Date = Date()) {
        availableFiscalYears = GrantBudgetViewModel.programYearOptions(from: referenceDate)
        fiscalYear = GrantBudgetViewModel.currentProgramYear(from: referenceDate)
    }

    /// Head Start program years run Sep 1 – Aug 31, labeled "startYear-endYear".
    static func currentProgramYear(from date: Date) -> String {
        let comps = Calendar.current.dateComponents([.year, .month], from: date)
        let year = comps.year ?? 2026
        let month = comps.month ?? 1
        let startYear = month >= 9 ? year : year - 1
        return "\(startYear)-\(startYear + 1)"
    }

    /// Previous, current, and next program year, for the picker.
    static func programYearOptions(from date: Date) -> [String] {
        let comps = Calendar.current.dateComponents([.year, .month], from: date)
        let year = comps.year ?? 2026
        let month = comps.month ?? 1
        let currentStart = month >= 9 ? year : year - 1
        return [currentStart - 1, currentStart, currentStart + 1].map { "\($0)-\($0 + 1)" }
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            summary = try await APIClient.shared.getGrantSummary(fiscalYear: fiscalYear)
            errorMessage = nil
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load the grant budget summary. Check your connection and try again."
        }
    }

    func changeFiscalYear(to year: String) async {
        guard year != fiscalYear else { return }
        fiscalYear = year
        await load()
    }

    @discardableResult
    func saveBudgetLine(category: String, budgetedCents: Int) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            try await APIClient.shared.setGrantBudgetLine(fiscalYear: fiscalYear, category: category, budgetedCents: budgetedCents)
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't save that budget line. Check your connection and try again."
            return false
        }
    }

    @discardableResult
    func addExpense(category: String, description: String, amountCents: Int, expenseDate: Date, nonFederalShare: Bool) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            try await APIClient.shared.addGrantExpense(
                fiscalYear: fiscalYear,
                category: category,
                description: description,
                amountCents: amountCents,
                expenseDate: expenseDate,
                nonFederalShare: nonFederalShare
            )
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't record that expense. Check your connection and try again."
            return false
        }
    }
}

// MARK: - Main View

struct GrantBudgetView: View {
    @StateObject private var viewModel = GrantBudgetViewModel()
    @State private var showSetBudgetLine = false
    @State private var showAddExpense = false

    var body: some View {
        HeadStartGate(featureDescription: "Grant & Budget tracking") {
            List {
                if let errorMessage = viewModel.errorMessage {
                    Section {
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.cfError)
                            Text(errorMessage)
                                .font(.cfSubheadline)
                                .foregroundColor(.cfTextPrimary)
                        }
                        .padding(.vertical, 4)
                    }
                    .listRowBackground(Color.cfHealthBg)
                }

                Section {
                    Picker("Fiscal Year", selection: $viewModel.fiscalYear) {
                        ForEach(viewModel.availableFiscalYears, id: \.self) { year in
                            Text(year).tag(year)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: viewModel.fiscalYear) { _, newValue in
                        Task { await viewModel.changeFiscalYear(to: newValue) }
                    }
                }
                .listRowBackground(Color.clear)

                if let summary = viewModel.summary {
                    Section {
                        VStack(spacing: 12) {
                            HStack(spacing: 12) {
                                GrantStatCard(title: "Approved Budget", value: currencyString(summary.totalBudgetCents), color: .cfPrimary)
                                GrantStatCard(
                                    title: "Spent (\(summary.burnPct)%)",
                                    value: currencyString(summary.totalSpentCents),
                                    color: burnColor(summary.burnPct)
                                )
                            }
                            HStack(spacing: 12) {
                                GrantStatCard(
                                    title: "Non-Federal Match",
                                    value: "\(summary.matchPct)%",
                                    subtitle: "target ≥ 20%",
                                    color: matchColor(summary.matchPct)
                                )
                                GrantStatCard(title: "Carryover Est.", value: currencyString(summary.carryoverEstimateCents), color: .cfGoals)
                            }
                        }
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))

                    Section {
                        if summary.categories.isEmpty {
                            Text("No budget lines set for this fiscal year yet.")
                                .font(.cfCaption)
                                .foregroundColor(.cfTextSecondary)
                        } else {
                            ForEach(summary.categories) { category in
                                GrantCategoryRow(category: category)
                            }
                        }
                    } header: {
                        HStack {
                            Text("By Category")
                            Spacer()
                            Button("Set Budget") { showSetBudgetLine = true }
                                .font(.cfCaption)
                        }
                    }

                    Section {
                        if summary.recentExpenses.isEmpty {
                            Text("No expenses recorded yet.")
                                .font(.cfCaption)
                                .foregroundColor(.cfTextSecondary)
                        } else {
                            ForEach(summary.recentExpenses) { expense in
                                GrantExpenseRow(expense: expense)
                            }
                        }
                    } header: {
                        HStack {
                            Text("Recent Expenses")
                            Spacer()
                            Button("Add") { showAddExpense = true }
                                .font(.cfCaption)
                        }
                    }
                } else if !viewModel.isLoading {
                    Section {
                        Text("No data to show yet.")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Grant & Budget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button {
                            showSetBudgetLine = true
                        } label: {
                            Label("Set Budget Line", systemImage: "slider.horizontal.3")
                        }
                        Button {
                            showAddExpense = true
                        } label: {
                            Label("Add Expense", systemImage: "plus")
                        }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showSetBudgetLine) {
                SetBudgetLineSheet(fiscalYear: viewModel.fiscalYear) { category, budgetedCents in
                    Task { await viewModel.saveBudgetLine(category: category, budgetedCents: budgetedCents) }
                }
            }
            .sheet(isPresented: $showAddExpense) {
                AddGrantExpenseSheet(fiscalYear: viewModel.fiscalYear) { category, description, amountCents, expenseDate, nonFederalShare in
                    Task {
                        await viewModel.addExpense(
                            category: category,
                            description: description,
                            amountCents: amountCents,
                            expenseDate: expenseDate,
                            nonFederalShare: nonFederalShare
                        )
                    }
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
            .overlay {
                if viewModel.isLoading && viewModel.summary == nil {
                    ProgressView()
                }
            }
        }
    }

    private func burnColor(_ pct: Int) -> Color {
        pct >= 100 ? .cfError : pct >= 85 ? .cfWarning : .cfAttendance
    }

    private func matchColor(_ pct: Int) -> Color {
        pct >= 20 ? .cfAttendance : .cfError
    }
}

// MARK: - Summary Stat Card

private struct GrantStatCard: View {
    let title: String
    let value: String
    var subtitle: String? = nil
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.cfCaption2)
                .foregroundColor(.cfTextSecondary)
            Text(value)
                .font(.cfTitle2)
                .foregroundColor(color)
            if let subtitle {
                Text(subtitle)
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .cfSubtleShadow()
    }
}

// MARK: - Category Row

private struct GrantCategoryRow: View {
    let category: GrantCategorySummary

    private var progress: Double {
        guard category.budgetedCents > 0 else { return category.spentCents > 0 ? 1 : 0 }
        return min(Double(category.spentCents) / Double(category.budgetedCents), 1.0)
    }

    private var barColor: Color {
        category.pct >= 100 ? .cfError : category.pct >= 85 ? .cfWarning : .cfAttendance
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(categoryLabel(category.category))
                    .font(.cfSubheadline)
                Spacer()
                Text("\(category.pct)%")
                    .font(.cfCaption)
                    .foregroundColor(barColor)
            }
            ProgressView(value: progress)
                .tint(barColor)
            HStack {
                Text("\(currencyString(category.spentCents)) spent")
                Spacer()
                Text("\(currencyString(category.budgetedCents)) budgeted")
            }
            .font(.cfCaption2)
            .foregroundColor(.cfTextSecondary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Expense Row

private struct GrantExpenseRow: View {
    let expense: GrantRecentExpense

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(expense.description)
                    .font(.cfSubheadline)
                Spacer()
                Text(currencyString(expense.amountCents))
                    .font(.cfSubheadline.weight(.semibold))
            }
            HStack(spacing: 6) {
                Text(categoryLabel(expense.category))
                Text("\u{00B7}")
                Text(expense.expenseDate, style: .date)
                if expense.nonFederalShare {
                    Text("\u{00B7}")
                    Text("Non-Federal Match")
                        .foregroundColor(.cfAttendance)
                }
            }
            .font(.cfCaption2)
            .foregroundColor(.cfTextSecondary)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Set Budget Line Sheet

private struct SetBudgetLineSheet: View {
    let fiscalYear: String
    let onSave: (String, Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var category: GrantCategoryOption = .education
    @State private var amountText: String = ""

    private var isValid: Bool {
        guard let dollars = Double(amountText) else { return false }
        return dollars >= 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Fiscal Year") {
                    Text(fiscalYear).foregroundColor(.cfTextSecondary)
                }
                Section("Category") {
                    Picker("Category", selection: $category) {
                        ForEach(GrantCategoryOption.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                }
                Section("Approved Budget") {
                    TextField("Amount (e.g. 25000.00)", text: $amountText)
                        .keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Set Budget Line")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(category.rawValue, centsFromDollarString(amountText))
                        dismiss()
                    }
                    .disabled(!isValid)
                }
            }
        }
    }
}

// MARK: - Add Expense Sheet

private struct AddGrantExpenseSheet: View {
    let fiscalYear: String
    let onSave: (String, String, Int, Date, Bool) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var category: GrantCategoryOption = .education
    @State private var description: String = ""
    @State private var amountText: String = ""
    @State private var expenseDate: Date = Date()
    @State private var nonFederalShare: Bool = false

    private var isValid: Bool {
        guard !description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        guard let dollars = Double(amountText) else { return false }
        return dollars > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Fiscal Year") {
                    Text(fiscalYear).foregroundColor(.cfTextSecondary)
                }
                Section("Category") {
                    Picker("Category", selection: $category) {
                        ForEach(GrantCategoryOption.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                }
                Section("Details") {
                    TextField("Description", text: $description)
                    TextField("Amount (e.g. 250.00)", text: $amountText)
                        .keyboardType(.decimalPad)
                    DatePicker("Date", selection: $expenseDate, displayedComponents: .date)
                    Toggle("Counts toward non-federal match", isOn: $nonFederalShare)
                }
            }
            .navigationTitle("Add Expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(category.rawValue, description, centsFromDollarString(amountText), expenseDate, nonFederalShare)
                        dismiss()
                    }
                    .disabled(!isValid)
                }
            }
        }
    }
}
