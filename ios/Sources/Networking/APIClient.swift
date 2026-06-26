import Foundation

/// Central API client for all Sprout backend requests.
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
        // Server timestamps are ISO8601 WITH fractional seconds ("….000Z"),
        // which the plain .iso8601 strategy rejects. Accept both forms.
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            if let date = fractional.date(from: value) ?? plain.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unrecognized date format: \(value)"
            )
        }
        return d
    }()

    // MARK: - Auth
    private let tokenAccount = "auth_token"

    func setToken(_ token: String) {
        authToken = token
        KeychainHelper.set(token, for: tokenAccount)
    }

    func clearToken() {
        authToken = nil
        KeychainHelper.delete(tokenAccount)
    }

    /// Load a previously stored token from the Keychain into memory.
    /// Returns true if a token was found.
    @discardableResult
    func loadStoredToken() -> Bool {
        authToken = KeychainHelper.get(tokenAccount)
        return authToken != nil
    }

    /// Whether a session token is currently available (in memory or Keychain).
    func hasStoredToken() -> Bool {
        if authToken != nil { return true }
        return KeychainHelper.get(tokenAccount) != nil
    }

    // MARK: - Auth Endpoints
    func login(email: String, password: String) async throws -> String {
        struct LoginBody: Encodable { let email, password: String }
        struct LoginResponse: Decodable { let token: String }
        let response: LoginResponse = try await post("auth/login", body: LoginBody(email: email, password: password))
        return response.token
    }

    /// The signed-in user (including their role, for gating admin-only UI).
    func getMe() async throws -> User {
        try await get("auth/me")
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

    // MARK: - Classrooms
    func getClassrooms() async throws -> [ClassroomSummary] {
        try await get("classrooms")
    }

    /// Move a child to a classroom; nil unassigns them.
    func assignChild(childId: String, classroomId: String?) async throws {
        struct Req: Encodable { let classroomId: String? }
        let _: SuccessResponse = try await post("children/\(childId)/assign", body: Req(classroomId: classroomId))
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

    /// Quick note on a child (teacher one-screen flow).
    func addQuickNote(childId: String, content: String) async throws {
        struct Req: Encodable { let content: String }
        let _: SuccessResponse = try await post("children/\(childId)/notes", body: Req(content: content))
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

    // MARK: - PIR (Program Information Report)
    func getPIRQuestions() async throws -> [PIRQuestion] {
        try await get("pir/questions")
    }

    func listPIRReports() async throws -> [PIRReportSummary] {
        try await get("pir/reports")
    }

    func getPIRReport(year: String) async throws -> PIRReportDetail {
        try await get("pir/report?year=\(year)")
    }

    func setPIRValue(year: String, code: String, value: String) async throws {
        struct Req: Encodable { let year, code, value: String }
        let _: SuccessResponse = try await post("pir/value", body: Req(year: year, code: code, value: value))
    }

    func submitPIR(year: String) async throws {
        struct Req: Encodable { let year: String }
        let _: SuccessResponse = try await post("pir/submit", body: Req(year: year))
    }

    func reopenPIR(year: String) async throws {
        struct Req: Encodable { let year: String }
        let _: SuccessResponse = try await post("pir/reopen", body: Req(year: year))
    }

    // MARK: - Daily Reports / Moments
    func getActivityLogs(childId: String? = nil) async throws -> [ActivityLogItem] {
        var path = "activity"
        if let childId { path += "?childId=\(childId)" }
        return try await get(path)
    }

    func logActivity(childId: String, activityType: String, description: String) async throws {
        struct Req: Encodable { let childId: String; let activityType: String; let description: String }
        let _: SuccessResponse = try await post("activity", body: Req(childId: childId, activityType: activityType, description: description))
    }

    // MARK: - Lesson Planning
    func getLessonPlans() async throws -> [LessonPlanSummary] {
        try await get("lesson-plans")
    }
    func getLessonPlan(id: String) async throws -> LessonPlanDetail {
        try await get("lesson-plans/\(id)")
    }
    func createLessonPlan(classroomId: String, weekStartDate: String, title: String?, theme: String?) async throws {
        struct Req: Encodable { let classroomId: String; let weekStartDate: String; let title: String?; let theme: String? }
        let _: SuccessResponse = try await post("lesson-plans", body: Req(classroomId: classroomId, weekStartDate: weekStartDate, title: title, theme: theme))
    }
    func addLessonActivity(planId: String, dayOfWeek: String, title: String, description: String?, domain: String?) async throws {
        struct Req: Encodable { let dayOfWeek: String; let title: String; let description: String?; let domain: String? }
        let _: SuccessResponse = try await post("lesson-plans/\(planId)/activities", body: Req(dayOfWeek: dayOfWeek, title: title, description: description, domain: domain))
    }
    func publishLessonPlan(id: String, published: Bool) async throws {
        struct Req: Encodable { let published: Bool }
        let _: SuccessResponse = try await post("lesson-plans/\(id)/publish", body: Req(published: published))
    }

    // MARK: - Child Portfolios
    func getPortfolio(childId: String) async throws -> [PortfolioEntryItem] {
        try await get("portfolio?childId=\(childId)")
    }
    func createPortfolioEntry(childId: String, title: String, observation: String?, domain: String?, observedAt: String?) async throws {
        struct Req: Encodable { let childId: String; let title: String; let observation: String?; let domain: String?; let observedAt: String? }
        let _: SuccessResponse = try await post("portfolio", body: Req(childId: childId, title: title, observation: observation, domain: domain, observedAt: observedAt))
    }

    // MARK: - Subsidies
    func getSubsidies() async throws -> [SubsidyItem] {
        try await get("subsidies")
    }
    func createSubsidy(familyId: String, agencyName: String, authorizedAmount: String?, copayAmount: String?, status: String, notes: String?) async throws {
        struct Req: Encodable { let familyId: String; let agencyName: String; let authorizedAmount: String?; let copayAmount: String?; let status: String; let notes: String? }
        let _: SuccessResponse = try await post("subsidies", body: Req(familyId: familyId, agencyName: agencyName, authorizedAmount: authorizedAmount, copayAmount: copayAmount, status: status, notes: notes))
    }

    // MARK: - Assessments
    func getAssessments(childId: String? = nil) async throws -> [AssessmentItem] {
        var path = "assessments"
        if let childId { path += "?childId=\(childId)" }
        return try await get(path)
    }
    func createAssessment(childId: String, type: String, title: String, description: String?, score: String?, domain: String?) async throws {
        struct Req: Encodable { let childId: String; let type: String; let title: String; let description: String?; let score: String?; let domain: String? }
        let _: SuccessResponse = try await post("assessments", body: Req(childId: childId, type: type, title: title, description: description, score: score, domain: domain))
    }

    // MARK: - Calendar
    func getCalendar() async throws -> [CalendarEventItem] {
        try await get("calendar")
    }
    func createCalendarEvent(title: String, eventType: String, startDate: String, location: String?) async throws {
        struct Req: Encodable { let title: String; let eventType: String; let startDate: String; let location: String? }
        let _: SuccessResponse = try await post("calendar", body: Req(title: title, eventType: eventType, startDate: startDate, location: location))
    }

    // MARK: - Meal plans
    func getMealPlans() async throws -> [MealPlanItem] {
        try await get("meals")
    }
    func getMealItems(planId: String) async throws -> [MealItemRow] {
        try await get("meals/\(planId)/items")
    }

    // MARK: - Push notifications
    func registerDeviceToken(_ token: String, platform: String = "ios") async throws {
        struct Req: Encodable { let token: String; let platform: String }
        let _: SuccessResponse = try await post("push/register", body: Req(token: token, platform: platform))
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

    func getFamilyNotifications() async throws -> [ParentNotification] {
        try await get("family/notifications")
    }

    /// The family's live Daily Reports feed (their children's moments).
    func getFamilyActivity() async throws -> [ActivityLogItem] {
        try await get("family/activity")
    }

    func getSchoolStatus() async throws -> SchoolStatus {
        try await get("family/school-status")
    }

    func getFamilyProgress() async throws -> FamilyProgress {
        try await get("family/progress")
    }

    // MARK: - Parent check-in / check-out
    func getFamilyAttendanceToday() async throws -> [FamilyAttendanceToday] {
        try await get("family/attendance-today")
    }

    func checkInChild(childId: String) async throws {
        struct Req: Encodable { let childId: String }
        let _: SuccessResponse = try await post("family/check-in", body: Req(childId: childId))
    }

    func checkOutChild(childId: String) async throws {
        struct Req: Encodable { let childId: String }
        let _: SuccessResponse = try await post("family/check-out", body: Req(childId: childId))
    }

    // MARK: - Absence Reports
    func reportAbsence(childId: String, date: Date, reason: String, note: String) async throws -> AbsenceReport {
        struct Req: Encodable {
            let childId: String
            let date: String
            let reason: String
            let note: String
        }
        let iso = ISO8601DateFormatter().string(from: date)
        return try await post("family/absences", body: Req(childId: childId, date: iso, reason: reason, note: note))
    }

    func getFamilyAbsences() async throws -> [AbsenceReport] {
        try await get("family/absences")
    }

    /// Staff: absence reports awaiting review.
    func getAbsenceReports() async throws -> [AbsenceReport] {
        try await get("absences")
    }

    /// Staff: approve or deny a parent-reported absence.
    func reviewAbsence(id: String, approve: Bool) async throws {
        struct Req: Encodable { let approve: Bool }
        let _: SuccessResponse = try await post("absences/\(id)/review", body: Req(approve: approve))
    }

    // MARK: - Staff Activity report
    /// `preset` ∈ month | lastMonth | 90d | year. Pass `staffId` to get that
    /// advocate's contact log in `detail`.
    func fetchStaffActivity(preset: String, staffId: String? = nil) async throws -> StaffActivityReport {
        var path = "reports/staff-activity?preset=\(preset)"
        if let staffId { path += "&staffId=\(staffId)" }
        return try await get(path)
    }

    // MARK: - Private helpers

    /// Joins `path` onto `baseURL` while preserving any query string. We can't use
    /// `appendingPathComponent` here: it treats the whole string as one path segment
    /// and percent-encodes the `?` (e.g. `attendance%3Fdate=…`), which breaks routing
    /// and query parsing server-side. Current paths use only URL-safe query values.
    private func makeURL(_ path: String) -> URL {
        let base = baseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? baseURL.appendingPathComponent(path)
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let url = makeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        addAuthHeader(&request)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    private func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = makeURL(path)
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
            if http.statusCode == 401 {
                // Token rejected/expired server-side. Broadcast so app state can
                // clear the dead session and return to sign-in.
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }
}

extension Notification.Name {
    /// Posted when the server rejects the session token (HTTP 401).
    static let cfSessionExpired = Notification.Name("cfSessionExpired")
}

struct EmptyResponse: Decodable {}

struct SuccessResponse: Decodable { let success: Bool }

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
