import Foundation

/// Central API client for all ChildFlow backend requests.
/// Configure `baseURL` to point at your deployed server.
actor APIClient {
    static let shared = APIClient()

    // MARK: - Configuration
    /// Change this to your production URL before deploying
    private var baseURL = URL(string: "http://localhost:3000/api")!
    private var authToken: String?

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    // MARK: - Auth
    func setToken(_ token: String) {
        authToken = token
        UserDefaults.standard.set(token, forKey: "auth_token")
    }

    func clearToken() {
        authToken = nil
        UserDefaults.standard.removeObject(forKey: "auth_token")
    }

    func loadStoredToken() {
        authToken = UserDefaults.standard.string(forKey: "auth_token")
    }

    // MARK: - Auth Endpoints
    func login(email: String, password: String) async throws -> String {
        struct LoginBody: Encodable { let email, password: String }
        struct LoginResponse: Decodable { let token: String }
        let response: LoginResponse = try await post("auth/login", body: LoginBody(email: email, password: password))
        return response.token
    }

    // MARK: - Dashboard
    func getDashboardStats() async throws -> DashboardData {
        try await get("dashboard/stats")
    }

    // MARK: - Children
    func getChildren() async throws -> [Child] {
        try await get("children")
    }

    func getChild(id: String) async throws -> Child {
        try await get("children/\(id)")
    }

    // MARK: - Attendance
    func getAttendance(date: Date, classroom: String?) async throws -> AttendanceData {
        let dateStr = ISO8601DateFormatter().string(from: date)
        var path = "attendance?date=\(dateStr)"
        if let classroom { path += "&classroom=\(classroom)" }
        return try await get(path)
    }

    func saveAttendance(records: [AttendanceRecord]) async throws {
        struct SaveBody: Encodable { let records: [AttendanceRecord] }
        let _: EmptyResponse = try await post("attendance/bulk", body: SaveBody(records: records))
    }

    // MARK: - Health
    func getHealthRecords() async throws -> [HealthRecord] {
        try await get("health")
    }

    // MARK: - Family Services
    func getFamilies() async throws -> [Family] {
        try await get("families")
    }

    // MARK: - Staff
    func getStaff() async throws -> [StaffMember] {
        try await get("staff")
    }

    // MARK: - Enrollment
    func getEnrollmentApplications() async throws -> [EnrollmentApplication] {
        try await get("enrollment")
    }

    // MARK: - Reports
    func generateReport(type: String) async throws -> GeneratedReport {
        struct ReportRequest: Encodable { let type: String }
        return try await post("reports/generate", body: ReportRequest(type: type))
    }

    // MARK: - Compliance
    func getComplianceData() async throws -> ComplianceData {
        try await get("compliance")
    }

    // MARK: - Settings
    func getSettings() async throws -> ProgramSettings {
        try await get("settings")
    }

    // MARK: - Messaging
    func getConversations() async throws -> [Conversation] {
        try await get("messaging/conversations")
    }

    func getMessages(conversationId: String) async throws -> [Message] {
        try await get("messaging/conversations/\(conversationId)/messages")
    }

    func sendMessage(conversationId: String, body: String) async throws -> Message {
        let req = SendMessageRequest(conversationId: conversationId, body: body)
        return try await post("messaging/messages", body: req)
    }

    func newConversation(familyId: String, body: String) async throws -> Conversation {
        let req = NewConversationRequest(familyId: familyId, recipientIds: [], body: body)
        return try await post("messaging/conversations", body: req)
    }

    // MARK: - Family Invitations (Staff-side)
    func getInvitationStatus(criteria: InvitationFilterCriteria) async throws -> InvitationsResponse {
        try await post("messaging/invitations/search", body: criteria)
    }

    func sendInvitations(recipientIds: [String]) async throws {
        let req = SendInvitationsRequest(recipientIds: recipientIds)
        let _: EmptyResponse = try await post("messaging/invitations/send", body: req)
    }

    // MARK: - Monthly Contacts
    func getContacts(familyId: String) async throws -> [MonthlyContact] {
        try await get("families/\(familyId)/contacts")
    }

    func logContact(request: NewContactRequest) async throws -> MonthlyContact {
        try await post("families/contacts", body: request)
    }

    // MARK: - Family Partnership Agreement
    func getFPA(familyId: String) async throws -> FamilyPartnershipAgreement {
        try await get("families/\(familyId)/fpa")
    }

    func createFPA(familyId: String) async throws -> FamilyPartnershipAgreement {
        struct Req: Encodable { let familyId: String }
        return try await post("families/fpa", body: Req(familyId: familyId))
    }

    // MARK: - Family Goals
    func getGoals(familyId: String) async throws -> [FamilyGoal] {
        try await get("families/\(familyId)/goals")
    }

    func createGoal(request: NewGoalRequest) async throws -> FamilyGoal {
        try await post("families/goals", body: request)
    }

    func updateGoalStep(goalId: String, stepId: String, completed: Bool) async throws {
        struct Req: Encodable { let completed: Bool }
        let _: EmptyResponse = try await post("families/goals/\(goalId)/steps/\(stepId)", body: Req(completed: completed))
    }

    // MARK: - Family Needs Assessment
    func getFNA(familyId: String) async throws -> FamilyNeedsAssessment {
        try await get("families/\(familyId)/fna")
    }

    func saveFNA(familyId: String, ratings: [FNADomainRating], notes: String) async throws -> FamilyNeedsAssessment {
        struct Req: Encodable {
            let familyId: String
            let ratings: [FNADomainRating]
            let notes: String
        }
        return try await post("families/fna", body: Req(familyId: familyId, ratings: ratings, notes: notes))
    }

    // MARK: - CFCR
    func getCFCRRecords(childId: String) async throws -> [CFCRRecord] {
        try await get("children/\(childId)/cfcr")
    }

    func createCFCR(request: NewCFCRRequest) async throws -> CFCRRecord {
        try await post("children/cfcr", body: request)
    }

    // MARK: - Attendance Success Plans
    func getAttendancePlans() async throws -> [AttendanceSuccessPlan] {
        try await get("attendance/plans")
    }

    func createAttendancePlan(childId: String, barriers: [String]) async throws -> AttendanceSuccessPlan {
        struct Req: Encodable { let childId: String; let barriers: [String] }
        return try await post("attendance/plans", body: Req(childId: childId, barriers: barriers))
    }

    // MARK: - Application Verification
    func getApplicationVerifications() async throws -> [ApplicationVerification] {
        try await get("enrollment/verifications")
    }

    func saveVerification(verification: ApplicationVerification) async throws -> ApplicationVerification {
        try await post("enrollment/verifications/\(verification.id)", body: verification)
    }

    // MARK: - Nutrition Forms
    func getNutritionForms(childId: String) async throws -> [NutritionalPreferenceForm] {
        try await get("nutrition/preferences?childId=\(childId)")
    }

    func getCACFPForms(childId: String) async throws -> [CACFPInfantFormulaForm] {
        try await get("nutrition/infant-formula?childId=\(childId)")
    }

    func getMedicalStatements(childId: String) async throws -> [MedicalStatementCACFP] {
        try await get("nutrition/medical-statements?childId=\(childId)")
    }

    // MARK: - Family Engagement Events
    func getFamilyEngagementEvents() async throws -> [FamilyEngagementEvent] {
        try await get("events")
    }

    func createEvent(event: FamilyEngagementEvent) async throws -> FamilyEngagementEvent {
        try await post("events", body: event)
    }

    func updateEvent(event: FamilyEngagementEvent) async throws -> FamilyEngagementEvent {
        try await post("events/\(event.id)", body: event)
    }

    // MARK: - Case Notes
    func getCaseNotes(familyId: String) async throws -> [CaseNote] {
        try await get("families/\(familyId)/notes")
    }

    func createCaseNote(request: NewCaseNoteRequest) async throws -> CaseNote {
        try await post("families/\(request.familyId)/notes", body: request)
    }

    func updateCaseNote(noteId: String, followUpCompleted: Bool) async throws -> CaseNote {
        try await post("notes/\(noteId)/followup", body: ["completed": followUpCompleted])
    }

    // MARK: - Timesheets
    func clockIn(request: ClockInRequest) async throws -> TimeEntry {
        try await post("timesheet/clock-in", body: request)
    }

    func clockOut(request: ClockOutRequest) async throws -> TimeEntry {
        try await post("timesheet/clock-out", body: request)
    }

    func startBreak(entryId: String) async throws -> TimeEntry {
        try await post("timesheet/\(entryId)/break-start", body: EmptyBody())
    }

    func endBreak(entryId: String) async throws -> TimeEntry {
        try await post("timesheet/\(entryId)/break-end", body: EmptyBody())
    }

    func getMyTimesheet(staffId: String) async throws -> [TimesheetWeek] {
        try await get("timesheet/staff/\(staffId)")
    }

    func getAllTimesheets() async throws -> [TimesheetWeek] {
        try await get("timesheet/all")
    }

    func getActiveEntry(staffId: String) async throws -> TimeEntry? {
        try await get("timesheet/staff/\(staffId)/active")
    }

    func approveEntry(entryId: String) async throws -> TimeEntry {
        try await post("timesheet/\(entryId)/approve", body: EmptyBody())
    }

    func flagEntry(entryId: String, note: String) async throws -> TimeEntry {
        struct Req: Encodable { let note: String }
        return try await post("timesheet/\(entryId)/flag", body: Req(note: note))
    }

    // MARK: - Family App Auth
    func verifyInvitationCode(_ code: String) async throws -> VerifiedInvitation {
        struct Req: Encodable { let code: String }
        return try await post("family/auth/verify-code", body: Req(code: code))
    }

    func familyRegister(code: String, email: String, dateOfBirth: Date, password: String) async throws -> FamilyAuthResult {
        struct Req: Encodable {
            let code: String
            let email: String
            let dateOfBirth: String
            let password: String
        }
        let dob = ISO8601DateFormatter().string(from: dateOfBirth)
        return try await post("family/auth/register", body: Req(code: code, email: email, dateOfBirth: dob, password: password))
    }

    func familyLogin(email: String, password: String) async throws -> FamilyAuthResult {
        struct Req: Encodable { let email: String; let password: String }
        return try await post("family/auth/login", body: Req(email: email, password: password))
    }

    // MARK: - Family App Data
    func getFamilyProfile() async throws -> FamilyProfile {
        try await get("family/profile")
    }

    func getFamilyEvents() async throws -> [FamilyEvent] {
        try await get("family/events")
    }

    // MARK: - Private helpers
    private func get<T: Decodable>(_ path: String) async throws -> T {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        addAuthHeader(&request)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    private func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthHeader(&request)
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    private func addAuthHeader(_ request: inout URLRequest) {
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.httpError(http.statusCode)
        }
    }
}

struct EmptyResponse: Decodable {}

enum APIError: LocalizedError {
    case httpError(Int)
    case unauthorized
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .httpError(let code): return "Server error (\(code))"
        case .unauthorized: return "Please sign in again"
        case .decodingFailed: return "Unexpected server response"
        }
    }
}

struct EmptyBody: Encodable {}
