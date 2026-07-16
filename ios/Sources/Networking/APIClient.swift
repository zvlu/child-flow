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

    // Matches `decoder`'s expected format. Without this, `post()` used to fall
    // back to JSONEncoder's default .deferredToDate strategy, which encodes
    // Date as a raw number of seconds since 2001 — the server's `new Date(x)`
    // then reads that number as *milliseconds since 1970*, silently landing on
    // a date in January 1970 for every Date field sent in a POST body (visit
    // dates, referral dates, meeting dates, etc.). This never showed up in
    // testing because the test scripts construct their own ISO-string JSON
    // bodies directly and never actually exercise this Swift encoder.
    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(fractional.string(from: date))
        }
        return e
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

    // MARK: - Health Compliance (45-day / 90-day deadlines)
    func getHealthCompliance() async throws -> [ChildHealthCompliance] {
        try await get("health/compliance")
    }

    func updateHealthCompliance(_ record: ChildHealthCompliance) async throws {
        let _: EmptyResponse = try await post("health/compliance/\(record.childId)", body: record)
    }

    // MARK: - Safety Drills
    func getSafetyDrills() async throws -> [SafetyDrillLog] {
        try await get("health/drills")
    }

    func logSafetyDrill(_ drill: SafetyDrillLog) async throws {
        let _: EmptyResponse = try await post("health/drills", body: drill)
    }

    // MARK: - Mental Health Consults
    func getMentalHealthConsults() async throws -> [MentalHealthConsult] {
        try await get("health/consults")
    }

    func logMentalHealthConsult(_ consult: MentalHealthConsult) async throws {
        let _: EmptyResponse = try await post("health/consults", body: consult)
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

    /// Approve/deny/set-priority for an application. Pass only the fields that changed.
    struct EnrollmentStatusUpdateRequest: Encodable { var status: String?; var priority: String? }
    func updateEnrollmentStatus(id: String, status: String? = nil, priority: String? = nil) async throws {
        let _: SuccessResponse = try await post("enrollment/\(id)/status", body: EnrollmentStatusUpdateRequest(status: status, priority: priority))
    }

    /// Approve & enroll: materializes an application into real family + child records.
    /// Throws `APIError.serverMessage` with a human-readable reason (e.g. capacity limit reached) on failure.
    struct EnrollApplicationResponse: Decodable { let childId: Int; let familyId: Int?; let alreadyEnrolled: Bool? }
    func enrollApplication(id: String) async throws -> EnrollApplicationResponse {
        try await post("enrollment/\(id)/enroll", body: EmptyBody())
    }

    // MARK: - ERSEA
    func getEligibilityRecords() async throws -> [EligibilityRecord] {
        try await get("ersea/eligibility")
    }

    func createEligibilityRecord(_ record: EligibilityRecord) async throws {
        let _: EmptyResponse = try await post("ersea/eligibility", body: record)
    }

    func updateEligibilityRecord(_ record: EligibilityRecord) async throws {
        let _: EmptyResponse = try await post("ersea/eligibility/\(record.id)", body: record)
    }

    func getSuspensionLogs() async throws -> [SuspensionExpulsionLog] {
        try await get("ersea/suspensions")
    }

    func createSuspensionLog(_ log: SuspensionExpulsionLog) async throws {
        let _: EmptyResponse = try await post("ersea/suspensions", body: log)
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

    // MARK: - Digital Documents (E-Sign)
    func getDigitalDocuments() async throws -> [DigitalDocumentItem] {
        try await get("digital-documents")
    }
    func signDigitalDocument(id: String, signedBy: String) async throws {
        struct Req: Encodable { let signedBy: String }
        let _: SuccessResponse = try await post("digital-documents/\(id)/sign", body: Req(signedBy: signedBy))
    }

    // MARK: - Disability Services (IEP/IFSP)
    func getDisabilityServices() async throws -> DisabilityServiceSummary {
        try await get("disability-services")
    }
    func upsertDisabilityRecord(id: String?, childId: String, planType: String, status: String?, primaryDisability: String?, effectiveDate: String?, expirationDate: String?, leaAgency: String?, leaContact: String?, notes: String?) async throws {
        struct Req: Encodable {
            let id: String?; let childId: String; let planType: String; let status: String?
            let primaryDisability: String?; let effectiveDate: String?; let expirationDate: String?
            let leaAgency: String?; let leaContact: String?; let notes: String?
        }
        let _: SuccessResponse = try await post("disability-services", body: Req(id: id, childId: childId, planType: planType, status: status, primaryDisability: primaryDisability, effectiveDate: effectiveDate, expirationDate: expirationDate, leaAgency: leaAgency, leaContact: leaContact, notes: notes))
    }
    func markDisabilityParentRights(id: String, language: String) async throws {
        struct Req: Encodable { let language: String }
        let _: SuccessResponse = try await post("disability-services/\(id)/parent-rights", body: Req(language: language))
    }
    func setDisabilityTransitionChecklist(id: String, steps: [String]) async throws {
        struct Req: Encodable { let steps: [String] }
        let _: SuccessResponse = try await post("disability-services/\(id)/transition", body: Req(steps: steps))
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

    struct ChangePasswordRequest: Codable { let currentPassword: String?; let newPassword: String }
    struct ChangePasswordResponse: Codable { let success: Bool }
    @discardableResult
    func changePassword(currentPassword: String?, newPassword: String) async throws -> ChangePasswordResponse {
        try await post("settings/password", body: ChangePasswordRequest(currentPassword: currentPassword, newPassword: newPassword))
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

    /// Drops one announcement into every target family's message thread —
    /// this is an in-app broadcast, not SMS/email (see BroadcastAnnouncementSheet).
    struct BroadcastRequest: Codable { let body: String; let audience: String }
    struct BroadcastResponse: Codable { let ok: Bool; let sentCount: Int; let audience: String }
    @discardableResult
    func sendBroadcast(body: String, audience: String) async throws -> BroadcastResponse {
        try await post("messaging/broadcast", body: BroadcastRequest(body: body, audience: audience))
    }

    /// Sync the user's preferred message language — the server then auto-
    /// translates incoming messages into it (real-time translation).
    struct LanguagePreferenceRequest: Codable { let language: String }
    struct LanguagePreferenceResponse: Codable { let ok: Bool; let language: String }
    @discardableResult
    func setPreferredLanguage(_ code: String) async throws -> LanguagePreferenceResponse {
        try await post("messaging/language", body: LanguagePreferenceRequest(language: code))
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

    func updateFPA(_ fpa: FamilyPartnershipAgreement) async throws {
        let _: EmptyResponse = try await post("families/\(fpa.familyId)/fpa/update", body: fpa)
    }

    // MARK: - Referrals
    func getReferrals(familyId: String) async throws -> [FamilyReferral] {
        try await get("families/\(familyId)/referrals")
    }

    func addReferral(_ referral: FamilyReferral) async throws {
        let _: EmptyResponse = try await post("families/\(referral.familyId)/referrals", body: referral)
    }

    func updateReferral(_ referral: FamilyReferral) async throws {
        let _: EmptyResponse = try await post("families/\(referral.familyId)/referrals/\(referral.id)", body: referral)
    }

    // MARK: - Home Visit Logs
    func getVisitLogs(familyId: String) async throws -> [HomeVisitLog] {
        try await get("families/\(familyId)/visits")
    }

    func logHomeVisit(_ visit: HomeVisitLog) async throws {
        let _: EmptyResponse = try await post("families/\(visit.familyId)/visits", body: visit)
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

    func createAttendancePlan(_ plan: AttendanceSuccessPlan) async throws {
        let _: EmptyResponse = try await post("attendance/plans", body: plan)
    }

    /// Patch a plan — pass only the fields you're changing. `strategies` should be
    /// the full updated array (the server replaces it wholesale, it doesn't merge).
    struct UpdateAttendancePlanRequest: Encodable {
        var strategies: [AttendancePlanStrategy]?
        var barriers: [String]?
        var status: String?
        var reviewDate: Date?
        var notes: String?
    }
    func updateAttendancePlan(id: String, strategies: [AttendancePlanStrategy]? = nil, barriers: [String]? = nil,
                              status: String? = nil, reviewDate: Date? = nil, notes: String? = nil) async throws {
        let _: SuccessResponse = try await post("attendance/plans/\(id)",
                                                 body: UpdateAttendancePlanRequest(strategies: strategies, barriers: barriers,
                                                                                   status: status, reviewDate: reviewDate, notes: notes))
    }

    // MARK: - Chronic Absence Alerts
    func getChronicAbsenceAlerts() async throws -> [ChronicAbsenceAlert] {
        try await get("attendance/chronic-absence")
    }

    // MARK: - Documents (staff file library)
    func getDocuments() async throws -> [StaffDocumentDTO] {
        try await get("documents")
    }

    /// `fileBase64` may be a raw base64 string or a `data:<mime>;base64,...` URL — the server accepts either.
    func uploadDocument(name: String, documentType: String, fileBase64: String, mimeType: String?, childId: String?) async throws -> StaffDocumentDTO {
        struct Req: Encodable { let name: String; let documentType: String; let fileBase64: String; var mimeType: String?; var childId: String? }
        return try await post("documents", body: Req(name: name, documentType: documentType, fileBase64: fileBase64, mimeType: mimeType, childId: childId))
    }

    func assignDocument(id: String, childId: String) async throws {
        struct Req: Encodable { let childId: String }
        let _: EmptyResponse = try await post("documents/\(id)/assign", body: Req(childId: childId))
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
        try validate(response, data: data)
        return try decoder.decode(T.self, from: data)
    }

    private func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = makeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthHeader(&request)
        request.httpBody = try encoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response, data: data)
        return try decoder.decode(T.self, from: data)
    }

    private func addAuthHeader(_ request: inout URLRequest) {
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    /// Struct matching the `{ error: string }` shape nearly every REST route
    /// returns on failure (e.g. the enrollment-capacity-limit message).
    private struct ServerErrorBody: Decodable { let error: String }

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                // Token rejected/expired server-side. Broadcast so app state can
                // clear the dead session and return to sign-in.
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            // Surface the server's actual error message when present (e.g. "Enrollment
            // limit reached — your Growth plan allows 40 children") instead of a bare
            // status code, so callers can show something a user can act on.
            if let body = try? JSONDecoder().decode(ServerErrorBody.self, from: data) {
                throw APIError.serverMessage(body.error)
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
    /// A server-provided human-readable failure reason (from a `{ error: string }` body).
    case serverMessage(String)
    case unauthorized
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .httpError(let code): return "Server error (\(code))"
        case .serverMessage(let message): return message
        case .unauthorized: return "Please sign in again"
        case .decodingFailed: return "Unexpected server response"
        }
    }
}

struct EmptyBody: Encodable {}
