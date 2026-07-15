import SwiftUI

// MARK: - Policy Council (Head Start §1302.50–51)
//
// Mirrors client/src/pages/PolicyCouncil.tsx for the native staff app. Backed
// by server/policyCouncilRest.ts, which reuses the existing business logic in
// server/policyCouncil.ts (listMembers / addMember / updateMember /
// listMeetings / addMeeting).
//
// Head Start requires the Policy Council to be parent-majority — that ratio
// is surfaced front-and-center in the summary stats below.

// MARK: - Wire models (mirror server/policyCouncilRest.ts JSON exactly)

struct PCMember: Decodable, Identifiable {
    let id: String
    let name: String
    let memberType: String // "parent" | "community_rep"
    let councilRole: String // "chair" | "vice_chair" | "secretary" | "treasurer" | "member"
    let familyId: String?
    let termStart: Date?
    let termEnd: Date?
    let status: String // "active" | "ended"
}

struct PCMeeting: Decodable, Identifiable {
    let id: String
    let meetingDate: Date
    let title: String
    let minutes: String
    let attendeeCount: Int
    let quorumMet: Bool
    let actionItems: [String]
}

// MARK: - Display helpers

enum PCMemberType {
    static func label(_ raw: String) -> String {
        raw == "parent" ? "Parent" : "Community Rep"
    }
}

enum PCCouncilRole: String, CaseIterable, Identifiable {
    case chair, vice_chair, secretary, treasurer, member

    var id: String { rawValue }

    var label: String {
        switch self {
        case .chair: return "Chair"
        case .vice_chair: return "Vice Chair"
        case .secretary: return "Secretary"
        case .treasurer: return "Treasurer"
        case .member: return "Member"
        }
    }
}

// MARK: - Self-contained networking
//
// APIClient's `get`/`post` helpers are `private` (file-scoped in Swift), so
// they can't be called from an extension declared in a different file. This
// block duplicates just enough of APIClient's networking (base URL, auth
// header from Keychain, ISO8601-with-fractional-seconds date en/decoding) to
// stay self-sufficient. If APIClient.swift's base URL or date handling ever
// changes, keep this block in sync.
extension APIClient {
    func getPolicyCouncilMembers() async throws -> [PCMember] {
        try await policyCouncilGet("policy-council/members")
    }

    func addPolicyCouncilMember(
        name: String,
        memberType: String,
        councilRole: String?,
        familyId: String?,
        termStart: Date?,
        termEnd: Date?
    ) async throws {
        struct Body: Encodable {
            let name: String
            let memberType: String
            let councilRole: String?
            let familyId: String?
            let termStart: Date?
            let termEnd: Date?
        }
        let _: SuccessResponse = try await policyCouncilPost(
            "policy-council/members",
            body: Body(name: name, memberType: memberType, councilRole: councilRole, familyId: familyId, termStart: termStart, termEnd: termEnd)
        )
    }

    func updatePolicyCouncilMember(id: String, councilRole: String?, status: String?) async throws {
        struct Body: Encodable {
            let councilRole: String?
            let status: String?
        }
        let _: SuccessResponse = try await policyCouncilPost(
            "policy-council/members/\(id)",
            body: Body(councilRole: councilRole, status: status)
        )
    }

    func getPolicyCouncilMeetings() async throws -> [PCMeeting] {
        try await policyCouncilGet("policy-council/meetings")
    }

    func addPolicyCouncilMeeting(
        title: String,
        meetingDate: Date,
        minutes: String?,
        attendeeCount: Int,
        quorumMet: Bool,
        actionItems: [String]
    ) async throws {
        struct Body: Encodable {
            let title: String
            let meetingDate: Date
            let minutes: String?
            let attendeeCount: Int
            let quorumMet: Bool
            let actionItems: [String]
        }
        let _: SuccessResponse = try await policyCouncilPost(
            "policy-council/meetings",
            body: Body(title: title, meetingDate: meetingDate, minutes: minutes, attendeeCount: attendeeCount, quorumMet: quorumMet, actionItems: actionItems)
        )
    }

    // MARK: Self-contained networking internals (see note above)

    private static let policyCouncilBaseURL = URL(string: "http://localhost:3000/api")!
    private static let policyCouncilTokenAccount = "auth_token"

    private static let policyCouncilDecoder: JSONDecoder = {
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

    private static let policyCouncilEncoder: JSONEncoder = {
        let e = JSONEncoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(fractional.string(from: date))
        }
        return e
    }()

    private func policyCouncilMakeURL(_ path: String) -> URL {
        let base = Self.policyCouncilBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.policyCouncilBaseURL.appendingPathComponent(path)
    }

    private func policyCouncilValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func policyCouncilGet<T: Decodable>(_ path: String) async throws -> T {
        let url = policyCouncilMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = KeychainHelper.get(Self.policyCouncilTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        try policyCouncilValidate(response)
        return try Self.policyCouncilDecoder.decode(T.self, from: data)
    }

    private func policyCouncilPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = policyCouncilMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = KeychainHelper.get(Self.policyCouncilTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try Self.policyCouncilEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try policyCouncilValidate(response)
        return try Self.policyCouncilDecoder.decode(T.self, from: data)
    }
}

// MARK: - View Model

@MainActor
final class PolicyCouncilViewModel: ObservableObject {
    @Published var members: [PCMember] = []
    @Published var meetings: [PCMeeting] = []
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?

    var activeMembers: [PCMember] { members.filter { $0.status == "active" } }
    var activeParentCount: Int { activeMembers.filter { $0.memberType == "parent" }.count }
    var activeCommunityRepCount: Int { activeMembers.filter { $0.memberType == "community_rep" }.count }

    /// Head Start requires parents to hold the majority of Policy Council seats.
    var parentMajorityPct: Double {
        guard !activeMembers.isEmpty else { return 0 }
        return Double(activeParentCount) / Double(activeMembers.count) * 100
    }
    var isParentMajority: Bool { parentMajorityPct > 50 }

    var meetingsThisYear: Int {
        let year = Calendar.current.component(.year, from: Date())
        return meetings.filter { Calendar.current.component(.year, from: $0.meetingDate) == year }.count
    }

    var totalOpenActionItems: Int {
        meetings.reduce(0) { $0 + $1.actionItems.count }
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let m = APIClient.shared.getPolicyCouncilMembers()
            async let mt = APIClient.shared.getPolicyCouncilMeetings()
            (members, meetings) = try await (m, mt)
            errorMessage = nil
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load Policy Council data. Check your connection and try again."
        }
    }

    @discardableResult
    func addMember(name: String, memberType: String, councilRole: String, familyId: String?, termStart: Date?, termEnd: Date?) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            try await APIClient.shared.addPolicyCouncilMember(
                name: name, memberType: memberType, councilRole: councilRole,
                familyId: familyId, termStart: termStart, termEnd: termEnd
            )
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't add that member. Check your connection and try again."
            return false
        }
    }

    @discardableResult
    func updateRole(memberId: String, councilRole: String) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            try await APIClient.shared.updatePolicyCouncilMember(id: memberId, councilRole: councilRole, status: nil)
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't update that member's role. Check your connection and try again."
            return false
        }
    }

    @discardableResult
    func endTerm(memberId: String) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            try await APIClient.shared.updatePolicyCouncilMember(id: memberId, councilRole: nil, status: "ended")
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't end that member's term. Check your connection and try again."
            return false
        }
    }

    @discardableResult
    func addMeeting(title: String, meetingDate: Date, minutes: String, attendeeCount: Int, quorumMet: Bool, actionItems: [String]) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            try await APIClient.shared.addPolicyCouncilMeeting(
                title: title, meetingDate: meetingDate,
                minutes: minutes.isEmpty ? nil : minutes,
                attendeeCount: attendeeCount, quorumMet: quorumMet, actionItems: actionItems
            )
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't save that meeting. Check your connection and try again."
            return false
        }
    }
}

// MARK: - Main View

struct PolicyCouncilView: View {
    @StateObject private var viewModel = PolicyCouncilViewModel()
    @State private var selectedTab = 0 // 0=Members, 1=Meetings & Minutes
    @State private var showAddMember = false
    @State private var showAddMeeting = false

    var body: some View {
        HeadStartGate(featureDescription: "Policy Council") {
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

                // ── Summary stats ───────────────────────────────────
                Section {
                    VStack(spacing: 12) {
                        HStack(spacing: 12) {
                            PCStatCard(
                                title: "Active Members",
                                value: "\(viewModel.activeMembers.count)",
                                subtitle: "\(viewModel.activeParentCount) parent · \(viewModel.activeCommunityRepCount) community",
                                color: .cfPrimary
                            )
                            PCStatCard(
                                title: "Parent Majority",
                                value: "\(Int(viewModel.parentMajorityPct.rounded()))%",
                                subtitle: viewModel.isParentMajority ? "✓ requirement met" : "⚠ below 50%",
                                color: viewModel.isParentMajority ? .cfAttendance : .cfError
                            )
                        }
                        HStack(spacing: 12) {
                            PCStatCard(title: "Meetings This Year", value: "\(viewModel.meetingsThisYear)", color: .cfGoals)
                            PCStatCard(title: "Open Action Items", value: "\(viewModel.totalOpenActionItems)", color: .cfWarning)
                        }
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))

                // ── Segment picker ──────────────────────────────────
                Section {
                    Picker("View", selection: $selectedTab) {
                        Text("Members").tag(0)
                        Text("Meetings & Minutes").tag(1)
                    }
                    .pickerStyle(.segmented)
                }
                .listRowBackground(Color.clear)

                if selectedTab == 0 {
                    membersSection
                } else {
                    meetingsSection
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Policy Council")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        if selectedTab == 0 { showAddMember = true } else { showAddMeeting = true }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showAddMember) {
                AddPolicyCouncilMemberSheet { name, memberType, councilRole, familyId, termStart, termEnd in
                    Task { await viewModel.addMember(name: name, memberType: memberType, councilRole: councilRole, familyId: familyId, termStart: termStart, termEnd: termEnd) }
                }
            }
            .sheet(isPresented: $showAddMeeting) {
                AddPolicyCouncilMeetingSheet { title, date, minutes, attendeeCount, quorumMet, actionItems in
                    Task { await viewModel.addMeeting(title: title, meetingDate: date, minutes: minutes, attendeeCount: attendeeCount, quorumMet: quorumMet, actionItems: actionItems) }
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
            .overlay {
                if viewModel.isLoading && viewModel.members.isEmpty && viewModel.meetings.isEmpty {
                    ProgressView()
                }
            }
        }
    }

    @ViewBuilder
    private var membersSection: some View {
        Section {
            if viewModel.members.isEmpty {
                Text("No Policy Council members yet.")
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
            } else {
                ForEach(viewModel.members) { member in
                    PCMemberRow(member: member) { newRole in
                        Task { await viewModel.updateRole(memberId: member.id, councilRole: newRole) }
                    } onEndTerm: {
                        Task { await viewModel.endTerm(memberId: member.id) }
                    }
                }
            }
        } header: {
            Text("Roster (\(viewModel.members.count))")
        }
    }

    @ViewBuilder
    private var meetingsSection: some View {
        Section {
            if viewModel.meetings.isEmpty {
                Text("No meetings logged yet.")
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
            } else {
                ForEach(viewModel.meetings) { meeting in
                    PCMeetingCard(meeting: meeting)
                }
            }
        } header: {
            Text("Meetings (\(viewModel.meetings.count))")
        }
    }
}

// MARK: - Stat Card

private struct PCStatCard: View {
    let title: String
    var value: String
    var subtitle: String? = nil
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.cfCaption2)
                .foregroundColor(.cfTextSecondary)
            Text(value)
                .font(.cfTitle)
                .foregroundColor(color)
            if let subtitle {
                Text(subtitle)
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .cfCardShadow()
    }
}

// MARK: - Member Row

private struct PCMemberRow: View {
    let member: PCMember
    let onRoleChange: (String) -> Void
    let onEndTerm: () -> Void

    @State private var role: PCCouncilRole

    init(member: PCMember, onRoleChange: @escaping (String) -> Void, onEndTerm: @escaping () -> Void) {
        self.member = member
        self.onRoleChange = onRoleChange
        self.onEndTerm = onEndTerm
        _role = State(initialValue: PCCouncilRole(rawValue: member.councilRole) ?? .member)
    }

    var isActive: Bool { member.status == "active" }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(member.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(isActive ? .cfTextPrimary : .cfTextSecondary)
                    Text(PCMemberType.label(member.memberType))
                        .font(.caption)
                        .foregroundColor(member.memberType == "parent" ? .cfPrimary : .cfCompliance)
                }
                Spacer()
                if !isActive {
                    Text("Ended")
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(.cfTextSecondary)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.cfBorder.opacity(0.5))
                        .clipShape(Capsule())
                }
            }

            HStack {
                if isActive {
                    Picker("Role", selection: $role) {
                        ForEach(PCCouncilRole.allCases) { r in
                            Text(r.label).tag(r)
                        }
                    }
                    .pickerStyle(.menu)
                    .font(.caption)
                    .onChange(of: role) { _, newValue in
                        onRoleChange(newValue.rawValue)
                    }
                } else {
                    Text(PCCouncilRole(rawValue: member.councilRole)?.label ?? member.councilRole)
                        .font(.caption)
                        .foregroundColor(.cfTextSecondary)
                }
                Spacer()
                if isActive {
                    Button(role: .destructive) {
                        onEndTerm()
                    } label: {
                        Text("End Term")
                            .font(.caption.weight(.medium))
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Meeting Card

private struct PCMeetingCard: View {
    let meeting: PCMeeting

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(meeting.title)
                        .font(.subheadline.weight(.semibold))
                    Text(meeting.meetingDate.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption)
                        .foregroundColor(.cfTextSecondary)
                }
                Spacer()
                Label(meeting.quorumMet ? "Quorum Met" : "No Quorum", systemImage: meeting.quorumMet ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(meeting.quorumMet ? .cfAttendance : .cfError)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background((meeting.quorumMet ? Color.cfAttendance : Color.cfError).opacity(0.1))
                    .clipShape(Capsule())
            }

            Label("\(meeting.attendeeCount) attendees", systemImage: "person.2.fill")
                .font(.caption)
                .foregroundColor(.cfTextSecondary)

            if !meeting.minutes.isEmpty {
                Text(meeting.minutes)
                    .font(.caption)
                    .foregroundColor(.cfTextPrimary)
                    .lineLimit(3)
            }

            if !meeting.actionItems.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Action Items")
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(.cfTextSecondary)
                    ForEach(meeting.actionItems, id: \.self) { item in
                        HStack(alignment: .top, spacing: 6) {
                            Image(systemName: "circle")
                                .font(.system(size: 8))
                                .foregroundColor(.cfWarning)
                                .padding(.top, 3)
                            Text(item)
                                .font(.caption)
                                .foregroundColor(.cfTextPrimary)
                        }
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Add Member Sheet

struct AddPolicyCouncilMemberSheet: View {
    let onSave: (String, String, String, String?, Date?, Date?) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var memberType = "parent"
    @State private var councilRole = PCCouncilRole.member
    @State private var familyId = ""
    @State private var hasTermDates = false
    @State private var termStart = Date()
    @State private var termEnd = Calendar.current.date(byAdding: .year, value: 1, to: Date()) ?? Date()

    var body: some View {
        NavigationStack {
            Form {
                Section("Member Information") {
                    TextField("Full name", text: $name)
                    Picker("Member Type", selection: $memberType) {
                        Text("Parent").tag("parent")
                        Text("Community Representative").tag("community_rep")
                    }
                    Picker("Role", selection: $councilRole) {
                        ForEach(PCCouncilRole.allCases) { r in
                            Text(r.label).tag(r)
                        }
                    }
                    if memberType == "parent" {
                        TextField("Linked family ID (optional)", text: $familyId)
                            .keyboardType(.numberPad)
                    }
                }

                Section("Term") {
                    Toggle("Set term dates", isOn: $hasTermDates)
                    if hasTermDates {
                        DatePicker("Term Start", selection: $termStart, displayedComponents: .date)
                        DatePicker("Term End", selection: $termEnd, in: termStart..., displayedComponents: .date)
                    }
                }
            }
            .navigationTitle("Add Member")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let trimmedFamilyId = familyId.trimmingCharacters(in: .whitespaces)
                        onSave(
                            name.trimmingCharacters(in: .whitespaces),
                            memberType,
                            councilRole.rawValue,
                            trimmedFamilyId.isEmpty ? nil : trimmedFamilyId,
                            hasTermDates ? termStart : nil,
                            hasTermDates ? termEnd : nil
                        )
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

// MARK: - Add Meeting Sheet

struct AddPolicyCouncilMeetingSheet: View {
    let onSave: (String, Date, String, Int, Bool, [String]) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var meetingDate = Date()
    @State private var minutes = ""
    @State private var attendeeCount = 0
    @State private var quorumMet = false
    @State private var actionItems: [String] = []
    @State private var newActionItem = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Meeting") {
                    TextField("Meeting title", text: $title)
                    DatePicker("Date", selection: $meetingDate, in: ...Date(), displayedComponents: .date)
                    Stepper("Attendees: \(attendeeCount)", value: $attendeeCount, in: 0...100)
                    Toggle("Quorum Met", isOn: $quorumMet)
                }

                Section("Minutes") {
                    TextEditor(text: $minutes).frame(minHeight: 80)
                }

                Section("Action Items") {
                    ForEach(actionItems, id: \.self) { item in
                        Text(item).font(.subheadline)
                    }
                    .onDelete { indices in
                        actionItems.remove(atOffsets: indices)
                    }
                    HStack {
                        TextField("New action item", text: $newActionItem)
                        Button {
                            let trimmed = newActionItem.trimmingCharacters(in: .whitespaces)
                            guard !trimmed.isEmpty else { return }
                            actionItems.append(trimmed)
                            newActionItem = ""
                        } label: {
                            Image(systemName: "plus.circle.fill")
                        }
                        .disabled(newActionItem.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
            .navigationTitle("Add Meeting")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(
                            title.trimmingCharacters(in: .whitespaces),
                            meetingDate,
                            minutes,
                            attendeeCount,
                            quorumMet,
                            actionItems
                        )
                        dismiss()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
