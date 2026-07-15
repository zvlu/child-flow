import SwiftUI

// MARK: - Bulk Action Center
//
// Mirrors client/src/pages/BulkActionCenter.tsx for the native staff app.
// Backed by server/bulkActionsRest.ts, which reuses the existing business
// logic in server/moduleDb.ts (getBulkActionLogs / createBulkActionLog /
// resolveStaffId / getClassroomRoster / saveAttendanceForDate).
//
// IMPORTANT: unlike most of the compliance-heavy screens in this app, this
// feature is NOT Head-Start-gated. It's generic and works for any org type,
// so this file must not use HeadStartGate or check `hasModule(.headStart)`
// anywhere. The one access rule that does apply: bulk attendance is
// admin-only (the web tRPC procedure is `orgAdminProcedure`), so a non-admin
// staff member can see the card but tapping it explains why it's blocked
// rather than silently doing nothing.

// MARK: - Wire model (mirrors server/bulkActionsRest.ts JSON exactly)

struct BulkActionLogItem: Decodable, Identifiable {
    let id: String
    let organizationId: Int
    let classroomId: String
    let classroomName: String
    let actionType: String
    let description: String?
    let recordCount: Int
    let status: String?
    let performedBy: String
    let performedByName: String
    let actionDate: Date?
    let completedAt: Date?
}

// MARK: - Attendance status (mirrors the mysqlEnum in drizzle/schema.ts)

enum BulkAttendanceStatusOption: String, CaseIterable, Identifiable {
    case present
    case absent
    case excused
    case halfDay = "half_day"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .present: return "Present"
        case .absent: return "Absent"
        case .excused: return "Excused"
        case .halfDay: return "Half Day"
        }
    }
}

private func bulkActionTypeLabel(_ raw: String) -> String {
    switch raw {
    case "bulk_attendance": return "Bulk Attendance"
    case "bulk_health_screening": return "Bulk Health Screening"
    case "bulk_notes": return "Bulk Notes"
    case "bulk_enrollment": return "Bulk Enrollment"
    default: return raw.capitalized
    }
}

private func bulkStatusColor(_ status: String?) -> Color {
    switch status {
    case "completed": return .cfAttendance
    case "pending": return .orange
    case "failed": return .cfHealth
    default: return .cfTextSecondary
    }
}

// MARK: - APIClient extension
//
// getBulkActionLogs / postBulkAttendance follow the same call ergonomics as
// every other APIClient method (`try await APIClient.shared.foo(...)`), but
// this feature must not modify the shared
// ios/Sources/Networking/APIClient.swift file. APIClient's `get`/`post`
// helpers are `private` to that file (Swift's `private` is file-scoped, so
// an extension declared here cannot call them) — so these methods do their
// own minimal request/response cycle instead, using the same base URL, auth
// header, and date encode/decode conventions as APIClient.swift, just
// duplicated locally. If APIClient.swift's base URL or date handling ever
// changes, keep this block in sync.
extension APIClient {
    func getBulkActionLogs() async throws -> [BulkActionLogItem] {
        try await bulkActionsGet("bulk-actions/logs")
    }

    struct BulkAttendanceResponse: Decodable {
        let success: Bool
        let affected: Int
    }

    func postBulkAttendance(classroomId: String, date: Date, status: String) async throws -> BulkAttendanceResponse {
        struct Body: Encodable {
            let classroomId: String
            let date: Date
            let status: String
        }
        return try await bulkActionsPost(
            "bulk-actions/attendance",
            body: Body(classroomId: classroomId, date: date, status: status)
        )
    }

    // MARK: Self-contained networking (see note above)

    private static let bulkActionsBaseURL = URL(string: "http://localhost:3000/api")!
    private static let bulkActionsTokenAccount = "auth_token"

    private static let bulkActionsDecoder: JSONDecoder = {
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

    private static let bulkActionsEncoder: JSONEncoder = {
        let e = JSONEncoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(fractional.string(from: date))
        }
        return e
    }()

    private func bulkActionsMakeURL(_ path: String) -> URL {
        let base = Self.bulkActionsBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.bulkActionsBaseURL.appendingPathComponent(path)
    }

    private func bulkActionsAddAuthHeader(_ request: inout URLRequest) {
        if let token = KeychainHelper.get(Self.bulkActionsTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func bulkActionsValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func bulkActionsGet<T: Decodable>(_ path: String) async throws -> T {
        let url = bulkActionsMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        bulkActionsAddAuthHeader(&request)
        let (data, response) = try await URLSession.shared.data(for: request)
        try bulkActionsValidate(response)
        return try Self.bulkActionsDecoder.decode(T.self, from: data)
    }

    private func bulkActionsPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = bulkActionsMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        bulkActionsAddAuthHeader(&request)
        request.httpBody = try Self.bulkActionsEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try bulkActionsValidate(response)
        return try Self.bulkActionsDecoder.decode(T.self, from: data)
    }
}

// MARK: - View Model

@MainActor
final class BulkActionCenterViewModel: ObservableObject {
    @Published var logs: [BulkActionLogItem] = []
    @Published var classrooms: [ClassroomSummary] = []
    @Published var isLoading = false
    @Published var isApplying = false
    @Published var errorMessage: String?

    var totalActions: Int { logs.count }
    var completedCount: Int { logs.filter { $0.status == "completed" }.count }
    var childrenProcessed: Int { logs.reduce(0) { $0 + $1.recordCount } }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        async let logsResult: Result<[BulkActionLogItem], Error> = fetchLogs()
        async let classroomsResult: Result<[ClassroomSummary], Error> = fetchClassrooms()
        let (l, c) = await (logsResult, classroomsResult)

        switch l {
        case .success(let value): logs = value
        case .failure(let error):
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load bulk action history. Check your connection and try again."
        }
        switch c {
        case .success(let value):
            classrooms = value
            if case .success = l { errorMessage = nil }
        case .failure(let error):
            if errorMessage == nil {
                errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load classrooms. Check your connection and try again."
            }
        }
    }

    private func fetchLogs() async -> Result<[BulkActionLogItem], Error> {
        do { return .success(try await APIClient.shared.getBulkActionLogs()) }
        catch { return .failure(error) }
    }

    private func fetchClassrooms() async -> Result<[ClassroomSummary], Error> {
        do { return .success(try await APIClient.shared.getClassrooms()) }
        catch { return .failure(error) }
    }

    @discardableResult
    func applyBulkAttendance(classroomId: String, status: BulkAttendanceStatusOption) async -> Bool {
        isApplying = true
        defer { isApplying = false }
        do {
            _ = try await APIClient.shared.postBulkAttendance(classroomId: classroomId, date: Date(), status: status.rawValue)
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't apply bulk attendance. Check your connection and try again."
            return false
        }
    }
}

// MARK: - Quick Action model

private struct BulkQuickAction: Identifiable {
    let id: String
    let label: String
    let icon: String
    let color: Color
    let ready: Bool

    static let attendance = BulkQuickAction(id: "attendance", label: "Bulk Attendance", icon: "checkmark.circle.fill", color: .cfAttendance, ready: true)
    static let health = BulkQuickAction(id: "health", label: "Bulk Health Screening", icon: "exclamationmark.triangle.fill", color: .cfHealth, ready: false)
    static let notes = BulkQuickAction(id: "notes", label: "Bulk Notes", icon: "note.text", color: .cfFamily, ready: false)
    static let enrollment = BulkQuickAction(id: "enrollment", label: "Bulk Enrollment", icon: "bolt.fill", color: .cfChildren, ready: false)

    static let all: [BulkQuickAction] = [.attendance, .health, .notes, .enrollment]
}

// MARK: - Main View

struct BulkActionCenterView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = BulkActionCenterViewModel()
    @State private var showAttendanceSheet = false
    @State private var showAdminOnlyAlert = false
    @State private var showComingSoonAlert = false
    @State private var comingSoonLabel = ""

    var body: some View {
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

            // ── Quick stats ─────────────────────────────────────────
            Section {
                HStack(spacing: 12) {
                    BulkStatCard(title: "Total Actions", value: "\(viewModel.totalActions)", color: .cfPrimary)
                    BulkStatCard(title: "Completed", value: "\(viewModel.completedCount)", color: .cfAttendance)
                    BulkStatCard(title: "Children Processed", value: "\(viewModel.childrenProcessed)", color: .cfFamily)
                }
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))

            // ── Quick actions ───────────────────────────────────────
            Section("Quick Actions") {
                ForEach(BulkQuickAction.all) { action in
                    Button {
                        handleQuickActionTap(action)
                    } label: {
                        BulkQuickActionRow(action: action, isAdmin: appState.isAdmin)
                    }
                    .buttonStyle(.plain)
                }
            }

            // ── Action history ──────────────────────────────────────
            Section("Action History") {
                if viewModel.logs.isEmpty {
                    Text(viewModel.isLoading ? "Loading…" : "No bulk actions yet. Run a Quick Action above and it'll be logged here.")
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                } else {
                    ForEach(viewModel.logs) { log in
                        BulkActionLogRow(log: log)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Bulk Action Center")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .overlay {
            if viewModel.isLoading && viewModel.logs.isEmpty {
                ProgressView()
            }
        }
        .sheet(isPresented: $showAttendanceSheet) {
            BulkAttendanceSheet(classrooms: viewModel.classrooms, isSaving: viewModel.isApplying) { classroomId, status in
                Task {
                    if await viewModel.applyBulkAttendance(classroomId: classroomId, status: status) {
                        showAttendanceSheet = false
                    }
                }
            }
        }
        .alert("Admin Only", isPresented: $showAdminOnlyAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Bulk Attendance requires an admin account. Ask a program administrator to run this action.")
        }
        .alert("Coming Soon", isPresented: $showComingSoonAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("\(comingSoonLabel) is coming soon.")
        }
    }

    private func handleQuickActionTap(_ action: BulkQuickAction) {
        guard action.ready else {
            comingSoonLabel = action.label
            showComingSoonAlert = true
            return
        }
        guard appState.isAdmin else {
            showAdminOnlyAlert = true
            return
        }
        showAttendanceSheet = true
    }
}

// MARK: - Stat Card

private struct BulkStatCard: View {
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.cfCaption2)
                .foregroundColor(.cfTextSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
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

// MARK: - Quick Action Row

private struct BulkQuickActionRow: View {
    let action: BulkQuickAction
    let isAdmin: Bool

    /// Only the live, admin-eligible attendance card looks fully active;
    /// the other three are visibly muted so nobody mistakes them for
    /// working functionality.
    private var isMuted: Bool { !action.ready }

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(action.color.opacity(isMuted ? 0.05 : 0.12))
                    .frame(width: 40, height: 40)
                Image(systemName: action.icon)
                    .foregroundColor(isMuted ? action.color.opacity(0.4) : action.color)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(action.label)
                    .font(.cfSubheadline.weight(.semibold))
                    .foregroundColor(isMuted ? .cfTextSecondary : .cfTextPrimary)
                if action.ready {
                    Text(isAdmin ? "Apply to entire classroom" : "Admin only")
                        .font(.cfCaption2)
                        .foregroundColor(.cfTextSecondary)
                } else {
                    Text("Coming soon")
                        .font(.cfCaption2.weight(.medium))
                        .foregroundColor(.orange)
                }
            }
            Spacer()
            if action.ready && !isAdmin {
                Image(systemName: "lock.fill")
                    .font(.caption)
                    .foregroundColor(.cfTextSecondary)
            }
        }
        .padding(.vertical, 4)
        .opacity(isMuted ? 0.55 : 1.0)
    }
}

// MARK: - Action History Row

private struct BulkActionLogRow: View {
    let log: BulkActionLogItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(bulkActionTypeLabel(log.actionType))
                    .font(.cfSubheadline.weight(.semibold))
                Spacer()
                Text((log.status ?? "pending").capitalized)
                    .font(.cfCaption2.weight(.semibold))
                    .foregroundColor(bulkStatusColor(log.status))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(bulkStatusColor(log.status).opacity(0.1))
                    .clipShape(Capsule())
            }
            Text(log.classroomName)
                .font(.cfCaption)
                .foregroundColor(.cfTextSecondary)
            HStack(spacing: 6) {
                Text("\(log.recordCount) children")
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
                Text("\u{00B7}")
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
                Text(log.performedByName)
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
                if let date = log.actionDate {
                    Text("\u{00B7}")
                        .font(.cfCaption2)
                        .foregroundColor(.cfTextSecondary)
                    Text(date, style: .date)
                        .font(.cfCaption2)
                        .foregroundColor(.cfTextSecondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Bulk Attendance Sheet

private struct BulkAttendanceSheet: View {
    let classrooms: [ClassroomSummary]
    let isSaving: Bool
    let onApply: (String, BulkAttendanceStatusOption) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedClassroomId: String = ""
    @State private var status: BulkAttendanceStatusOption = .present

    var body: some View {
        NavigationStack {
            Form {
                Section("Classroom") {
                    Picker("Classroom", selection: $selectedClassroomId) {
                        Text("Choose a classroom…").tag("")
                        ForEach(classrooms) { classroom in
                            Text(classroom.name).tag(classroom.id)
                        }
                    }
                }

                Section("Attendance Status") {
                    Picker("Status", selection: $status) {
                        ForEach(BulkAttendanceStatusOption.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "info.circle.fill")
                            .foregroundColor(.blue)
                        Text("This marks every child in the selected classroom for today.")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    }
                }
            }
            .navigationTitle("Bulk Attendance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        onApply(selectedClassroomId, status)
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Apply to Classroom")
                        }
                    }
                    .disabled(selectedClassroomId.isEmpty || isSaving)
                }
            }
        }
    }
}
