import SwiftUI

// MARK: - In-Kind Contributions (Head Start §1301.20 non-federal 20% match)
//
// Mirrors client/src/pages/InKind.tsx for the native staff app. Backed by
// server/inKindRest.ts, which reuses the existing business logic in
// server/moduleDb.ts (getInKindContributions / createInKindContribution /
// deleteInKindContribution).

// MARK: - Wire model (mirrors server/inKindRest.ts JSON exactly)

struct InKindContributionItem: Decodable, Identifiable {
    let id: String
    let type: String
    let contributor: String
    let description: String
    let date: Date
    let hours: Double?
    let value: Double
    let recordedBy: String?
}

// MARK: - Contribution type (mirrors the mysqlEnum in drizzle/schema.ts)

enum InKindTypeOption: String, CaseIterable, Identifiable {
    case volunteer
    case goods
    case services
    case facility
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .volunteer: return "Volunteer Time"
        case .goods: return "Donated Goods"
        case .services: return "Services"
        case .facility: return "Facility / Space"
        case .other: return "Other"
        }
    }

    var color: Color {
        switch self {
        case .volunteer: return .blue
        case .goods: return .orange
        case .services: return .purple
        case .facility: return .cfAttendance
        case .other: return .cfTextSecondary
        }
    }
}

private func inKindTypeLabel(_ raw: String) -> String {
    InKindTypeOption(rawValue: raw)?.label ?? raw.capitalized
}

private func inKindTypeColor(_ raw: String) -> Color {
    InKindTypeOption(rawValue: raw)?.color ?? .cfTextSecondary
}

private func currencyString(_ value: Double) -> String {
    value.formatted(.currency(code: "USD").precision(.fractionLength(0)))
}

// MARK: - APIClient extension
//
// getInKindContributions / createInKindContribution / deleteInKindContribution
// follow the same call ergonomics as every other APIClient method (`try
// await APIClient.shared.foo(...)`), but this feature must not modify the
// shared ios/Sources/Networking/APIClient.swift file. APIClient's
// `get`/`post` helpers are `private` to that file (Swift's `private` is
// file-scoped, so an extension declared here cannot call them), and there's
// no `delete` helper at all yet — so these methods do their own minimal
// request/response cycle instead, using the same base URL, auth header, and
// date encode/decode conventions as APIClient.swift, just duplicated
// locally. If APIClient.swift's base URL or date handling ever changes,
// keep this block in sync.
extension APIClient {
    func getInKindContributions() async throws -> [InKindContributionItem] {
        try await inKindGet("in-kind")
    }

    func createInKindContribution(
        type: String,
        contributor: String,
        description: String?,
        date: Date,
        hours: Double?,
        value: Double
    ) async throws {
        struct Body: Encodable {
            let type: String
            let contributor: String
            let description: String?
            let date: Date
            let hours: Double?
            let value: Double
        }
        let _: SuccessResponse = try await inKindPost(
            "in-kind",
            body: Body(type: type, contributor: contributor, description: description, date: date, hours: hours, value: value)
        )
    }

    func deleteInKindContribution(id: String) async throws {
        let _: SuccessResponse = try await inKindDelete("in-kind/\(id)")
    }

    // MARK: Self-contained networking (see note above)

    private static let inKindBaseURL = URL(string: "http://localhost:3000/api")!
    private static let inKindTokenAccount = "auth_token"

    private static let inKindDecoder: JSONDecoder = {
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

    private static let inKindEncoder: JSONEncoder = {
        let e = JSONEncoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(fractional.string(from: date))
        }
        return e
    }()

    private func inKindMakeURL(_ path: String) -> URL {
        let base = Self.inKindBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.inKindBaseURL.appendingPathComponent(path)
    }

    private func inKindAddAuthHeader(_ request: inout URLRequest) {
        if let token = KeychainHelper.get(Self.inKindTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func inKindValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func inKindGet<T: Decodable>(_ path: String) async throws -> T {
        let url = inKindMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        inKindAddAuthHeader(&request)
        let (data, response) = try await URLSession.shared.data(for: request)
        try inKindValidate(response)
        return try Self.inKindDecoder.decode(T.self, from: data)
    }

    private func inKindPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = inKindMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        inKindAddAuthHeader(&request)
        request.httpBody = try Self.inKindEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try inKindValidate(response)
        return try Self.inKindDecoder.decode(T.self, from: data)
    }

    private func inKindDelete<T: Decodable>(_ path: String) async throws -> T {
        let url = inKindMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        inKindAddAuthHeader(&request)
        let (data, response) = try await URLSession.shared.data(for: request)
        try inKindValidate(response)
        return try Self.inKindDecoder.decode(T.self, from: data)
    }
}

// MARK: - View Model

@MainActor
final class InKindViewModel: ObservableObject {
    @Published var contributions: [InKindContributionItem] = []
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?

    var totalValue: Double {
        contributions.reduce(0) { $0 + $1.value }
    }

    var thisMonthValue: Double {
        let cal = Calendar.current
        let now = Date()
        return contributions.filter {
            cal.isDate($0.date, equalTo: now, toGranularity: .month) &&
            cal.isDate($0.date, equalTo: now, toGranularity: .year)
        }.reduce(0) { $0 + $1.value }
    }

    var totalVolunteerHours: Double {
        contributions.reduce(0) { $0 + ($1.hours ?? 0) }
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            contributions = try await APIClient.shared.getInKindContributions()
            errorMessage = nil
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load in-kind contributions. Check your connection and try again."
        }
    }

    @discardableResult
    func addContribution(
        type: String,
        contributor: String,
        description: String?,
        date: Date,
        hours: Double?,
        value: Double
    ) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            try await APIClient.shared.createInKindContribution(
                type: type,
                contributor: contributor,
                description: description,
                date: date,
                hours: hours,
                value: value
            )
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't save that contribution. Check your connection and try again."
            return false
        }
    }

    /// Optimistic removal: the row disappears immediately; on failure we
    /// reload from the server so the list doesn't drift from reality.
    func delete(_ item: InKindContributionItem) async {
        let previous = contributions
        contributions.removeAll { $0.id == item.id }
        do {
            try await APIClient.shared.deleteInKindContribution(id: item.id)
        } catch {
            contributions = previous
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't remove that contribution. Check your connection and try again."
        }
    }
}

// MARK: - Main View

struct InKindView: View {
    @StateObject private var viewModel = InKindViewModel()
    @State private var showLogContribution = false

    var body: some View {
        HeadStartGate(featureDescription: "In-Kind Contribution tracking") {
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
                    VStack(spacing: 12) {
                        HStack(spacing: 12) {
                            InKindStatCard(title: "Total In-Kind Value", value: currencyString(viewModel.totalValue), color: .cfPrimary)
                            InKindStatCard(title: "This Month", value: currencyString(viewModel.thisMonthValue), color: .cfAttendance)
                        }
                        HStack(spacing: 12) {
                            InKindStatCard(title: "Volunteer Hours", value: String(format: "%.1f", viewModel.totalVolunteerHours), color: .blue)
                            InKindStatCard(title: "Contributions", value: "\(viewModel.contributions.count)", color: .cfGoals)
                        }
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))

                Section {
                    if viewModel.contributions.isEmpty {
                        Text(viewModel.isLoading ? "Loading…" : "No contributions logged yet.")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    } else {
                        ForEach(viewModel.contributions) { item in
                            InKindRow(item: item)
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        Task { await viewModel.delete(item) }
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                        }
                    }
                } header: {
                    HStack {
                        Text("Contribution Log")
                        Spacer()
                        Button("Log Contribution") { showLogContribution = true }
                            .font(.cfCaption)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("In-Kind Contributions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showLogContribution = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showLogContribution) {
                LogInKindContributionSheet { type, contributor, description, date, hours, value in
                    Task {
                        await viewModel.addContribution(
                            type: type,
                            contributor: contributor,
                            description: description,
                            date: date,
                            hours: hours,
                            value: value
                        )
                    }
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
            .overlay {
                if viewModel.isLoading && viewModel.contributions.isEmpty {
                    ProgressView()
                }
            }
        }
    }
}

// MARK: - Stat Card

private struct InKindStatCard: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.cfCaption2)
                .foregroundColor(.cfTextSecondary)
            Text(value)
                .font(.cfTitle2)
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .cfSubtleShadow()
    }
}

// MARK: - Contribution Row

private struct InKindRow: View {
    let item: InKindContributionItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(item.contributor)
                    .font(.cfSubheadline.weight(.semibold))
                Spacer()
                Text(currencyString(item.value))
                    .font(.cfSubheadline.weight(.semibold))
                    .foregroundColor(.cfPrimary)
            }
            if !item.description.isEmpty {
                Text(item.description)
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
            }
            HStack(spacing: 6) {
                Text(inKindTypeLabel(item.type))
                    .font(.cfCaption2.weight(.medium))
                    .foregroundColor(inKindTypeColor(item.type))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(inKindTypeColor(item.type).opacity(0.1))
                    .clipShape(Capsule())
                Text(item.date, style: .date)
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
                if item.type == "volunteer", let hours = item.hours {
                    Text("\u{00B7}")
                        .font(.cfCaption2)
                        .foregroundColor(.cfTextSecondary)
                    Text("\(String(format: "%.1f", hours)) hrs")
                        .font(.cfCaption2)
                        .foregroundColor(.cfTextSecondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Log Contribution Sheet

private struct LogInKindContributionSheet: View {
    let onSave: (String, String, String?, Date, Double?, Double) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var type: InKindTypeOption = .volunteer
    @State private var date: Date = Date()
    @State private var contributor: String = ""
    @State private var description: String = ""
    @State private var hoursText: String = ""
    @State private var valueText: String = ""

    private var isValid: Bool {
        guard !contributor.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        guard let value = Double(valueText), value >= 0 else { return false }
        if type == .volunteer, !hoursText.isEmpty, Double(hoursText) == nil { return false }
        return true
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Type") {
                    Picker("Type", selection: $type) {
                        ForEach(InKindTypeOption.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                }
                Section("Details") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("Contributor (name or organization)", text: $contributor)
                    TextField("Description", text: $description)
                }
                if type == .volunteer {
                    Section("Hours") {
                        TextField("Volunteer hours (e.g. 4.5)", text: $hoursText)
                            .keyboardType(.decimalPad)
                    }
                }
                Section("Dollar Value") {
                    TextField("Value (e.g. 150.00)", text: $valueText)
                        .keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Log Contribution")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let value = Double(valueText) ?? 0
                        let hours: Double? = type == .volunteer ? Double(hoursText) : nil
                        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
                        onSave(
                            type.rawValue,
                            contributor.trimmingCharacters(in: .whitespacesAndNewlines),
                            trimmedDescription.isEmpty ? nil : trimmedDescription,
                            date,
                            hours,
                            value
                        )
                        dismiss()
                    }
                    .disabled(!isValid)
                }
            }
        }
    }
}
