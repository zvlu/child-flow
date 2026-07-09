import SwiftUI

// MARK: - User
struct User: Codable, Identifiable {
    let id: String
    let fullName: String
    let email: String
    let role: String
    /// Optional feature modules enabled for this user's org, e.g. ["head_start"].
    /// Absent in older/mocked payloads, so default to empty rather than fail decoding.
    var enabledModules: [String] = []

    var initials: String {
        fullName.split(separator: " ").compactMap { $0.first }.map(String.init).joined()
    }

    private enum CodingKeys: String, CodingKey {
        case id, fullName, email, role, enabledModules
    }

    init(id: String, fullName: String, email: String, role: String, enabledModules: [String] = []) {
        self.id = id
        self.fullName = fullName
        self.email = email
        self.role = role
        self.enabledModules = enabledModules
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        fullName = try c.decode(String.self, forKey: .fullName)
        email = try c.decode(String.self, forKey: .email)
        role = try c.decode(String.self, forKey: .role)
        enabledModules = try c.decodeIfPresent([String].self, forKey: .enabledModules) ?? []
    }
}

/// Head Start compliance and other optional feature modules — mirrors shared/modules.ts on the server.
enum FeatureModule: String {
    case headStart = "head_start"
}

// MARK: - Child
struct Child: Codable, Identifiable {
    let id: String
    /// Groups siblings; nil in older payloads/mocks.
    var familyId: String? = nil
    let firstName: String
    let lastName: String
    let dateOfBirth: String
    let gender: String
    let primaryLanguage: String
    let classroom: String
    let teacher: String
    let enrollmentStatus: String
    let healthStatus: String
    let attendanceRate: Int
    let parentName: String
    let parentPhone: String
    let allergies: [String]
    /// Color-coded safety flags (allergy / dietary / disability / special).
    var flags: [ChildFlag] = []

    var fullName: String { "\(firstName) \(lastName)" }
    var initials: String { "\(firstName.prefix(1))\(lastName.prefix(1))" }
}

/// Today's drop-off / pickup state for a child (parent check-in/out).
struct FamilyAttendanceToday: Codable, Identifiable {
    let childId: String
    let childName: String
    let status: String
    let checkInTime: Date?
    let checkOutTime: Date?

    var id: String { childId }
    var isCheckedIn: Bool { checkInTime != nil }
    var isCheckedOut: Bool { checkOutTime != nil }
}

/// A color-coded safety flag shown on a child wherever they appear.
struct ChildFlag: Codable, Identifiable {
    let id: String
    let type: String   // allergy | dietary | disability | special
    let label: String

    var color: Color {
        switch type {
        case "allergy":    return .cfFlagAllergy
        case "dietary":    return .cfFlagDietary
        case "disability": return .cfFlagDisability
        default:           return .cfFlagSpecial
        }
    }
    var bgColor: Color {
        switch type {
        case "allergy":    return .cfFlagAllergyBg
        case "dietary":    return .cfFlagDietaryBg
        case "disability": return .cfFlagDisabilityBg
        default:           return .cfFlagSpecialBg
        }
    }
    var icon: String {
        switch type {
        case "allergy":    return "exclamationmark.triangle.fill"
        case "dietary":    return "fork.knife"
        case "disability": return "figure.roll"
        default:           return "star.fill"
        }
    }
}

/// A classroom with live enrollment, used to organize children by room.
struct ClassroomSummary: Codable, Identifiable {
    let id: String
    let name: String
    let ageGroup: String
    let capacity: Int
    let enrolledCount: Int
    let teacherName: String
    let assistantName: String
    let color: String

    var isFull: Bool { capacity > 0 && enrolledCount >= capacity }
}

// MARK: - Attendance
struct AttendanceRecord: Codable, Identifiable {
    let id: String
    let childId: String
    let childName: String
    let classroom: String
    var status: AttendanceStatus
    let date: Date
}

enum AttendanceStatus: String, Codable, CaseIterable {
    case present, absent, excused, halfDay

    var color: Color {
        switch self {
        case .present:  return .cfAttendance
        case .absent:   return .cfHealth
        case .excused:  return .cfFamily
        case .halfDay:  return .cfChildren
        }
    }

    var displayName: String {
        switch self {
        case .present: return "Present"
        case .absent: return "Absent"
        case .excused: return "Excused"
        case .halfDay: return "Half Day"
        }
    }
}

// MARK: - Health
struct HealthRecord: Codable, Identifiable {
    let id: String
    let childId: String
    let childName: String
    let category: String
    let status: String
    let dueDate: Date?
    let completedDate: Date?
}

// MARK: - Family
struct Family: Codable, Identifiable {
    let id: String
    let name: String
    let phone: String
    let email: String
    let address: String
    let childrenCount: Int
    let lastContact: String
    let nextHomeVisit: String
    let goals: [String]
}

// MARK: - Staff
struct StaffMember: Codable, Identifiable {
    let id: String
    let fullName: String
    let role: String
    let roleKey: String
    let email: String
    let phone: String
    let trainingHours: Int
    let classroom: String?

    var initials: String {
        fullName.split(separator: " ").compactMap { $0.first }.map(String.init).joined()
    }
}

// MARK: - Enrollment
struct EnrollmentApplication: Codable, Identifiable {
    let id: String
    let childName: String
    let status: String
    let applicationDate: Date
    let priority: String
    let classroom: String?
}

// MARK: - ERSEA (Eligibility / Recruitment / Selection / Enrollment / Attendance)

/// 2024 Federal Poverty Level guidelines — household size → annual income limit (100% FPL)
/// Source: HHS 2024 FPL guidelines. Head Start income limit = 100% FPL.
struct FederalPovertyLevel {
    static let limits2024: [Int: Int] = [
        1: 15060, 2: 20440, 3: 25820, 4: 31200, 5: 36580,
        6: 41960, 7: 47340, 8: 52720
    ]
    /// Returns annual income limit for household size (adds $5,380 per person beyond 8)
    static func limit(for householdSize: Int) -> Int {
        if householdSize <= 8 { return limits2024[householdSize] ?? 52720 }
        return 52720 + (householdSize - 8) * 5380
    }
    /// Returns percentage of FPL (e.g. 85 for 85% FPL)
    static func percentage(income: Int, householdSize: Int) -> Double {
        let lim = Double(limit(for: householdSize))
        return (Double(income) / lim) * 100
    }
}

/// Categorical eligibility bypasses income testing — child is automatically eligible
enum CategoricalEligibility: String, Codable, CaseIterable {
    case homeless           = "Experiencing Homelessness (McKinney-Vento)"
    case fosterCare         = "Foster Care"
    case publicAssistance   = "Receiving Public Assistance (SNAP/TANF/SSI)"
    case iepIfsp            = "Has IEP or IFSP"
    case none               = "None (income-based)"

    var icon: String {
        switch self {
        case .homeless:         return "house.slash.fill"
        case .fosterCare:       return "figure.2.and.child.holdinghands"
        case .publicAssistance: return "creditcard.fill"
        case .iepIfsp:          return "doc.badge.plus"
        case .none:             return "dollarsign.circle"
        }
    }
    var color: Color {
        switch self {
        case .homeless:         return .cfHealth
        case .fosterCare:       return .cfFamily
        case .publicAssistance: return .cfPrimary
        case .iepIfsp:          return .cfGoals
        case .none:             return .cfTextSecondary
        }
    }
    var isAutoEligible: Bool { self != .none }
}

/// Full ERSEA eligibility record for one applicant
struct EligibilityRecord: Codable, Identifiable {
    let id: String
    let childName: String
    let childDateOfBirth: Date
    let familyId: String?
    let applicationDate: Date

    // Income eligibility
    var householdSize: Int
    var annualIncome: Int                       // total household
    var incomeSource: String                    // e.g. "Employment + SNAP"

    // Categorical
    var categoricalEligibility: CategoricalEligibility

    // Selection priority score (higher = selected first)
    // Head Start grantees must document selection criteria per §1302.14
    var priorityScore: Int                      // computed from risk factors below
    var riskFactors: [EligibilityRiskFactor]

    // Status
    var status: EligibilityStatus
    var enrolledDate: Date?
    var classroom: String?
    var waitlistPosition: Int?                  // nil if enrolled/withdrawn
    var notes: String

    // MARK: Computed
    var isIncomeEligible: Bool {
        annualIncome <= FederalPovertyLevel.limit(for: householdSize)
    }
    var isEligible: Bool {
        categoricalEligibility.isAutoEligible || isIncomeEligible
    }
    var fplPercentage: Double {
        FederalPovertyLevel.percentage(income: annualIncome, householdSize: householdSize)
    }
    var childAge: Int {
        Calendar.current.dateComponents([.year], from: childDateOfBirth, to: Date()).year ?? 0
    }

    enum EligibilityStatus: String, Codable, CaseIterable {
        case pending   = "Pending Review"
        case eligible  = "Eligible — Waitlist"
        case enrolled  = "Enrolled"
        case denied    = "Ineligible"
        case withdrawn = "Withdrawn"

        var color: Color {
            switch self {
            case .pending:   return .orange
            case .eligible:  return .cfPrimary
            case .enrolled:  return .cfAttendance
            case .denied:    return .cfHealth
            case .withdrawn: return .cfTextSecondary
            }
        }
        var icon: String {
            switch self {
            case .pending:   return "clock.fill"
            case .eligible:  return "list.number"
            case .enrolled:  return "checkmark.circle.fill"
            case .denied:    return "xmark.circle.fill"
            case .withdrawn: return "minus.circle.fill"
            }
        }
    }
}

/// Risk factors that increase selection priority score
enum EligibilityRiskFactor: String, Codable, CaseIterable {
    case singleParent        = "Single Parent Household"
    case childInFosterCare   = "Child in Foster Care"
    case domesticViolence    = "Domestic Violence"
    case parentWithDisability = "Parent with Disability"
    case homeless            = "Experiencing Homelessness"
    case limitedEnglish      = "Limited English Proficiency"
    case childHasIEP         = "Child Has IEP/IFSP"
    case refugeeAsylum       = "Refugee or Asylum Seeker"
    case substanceUse        = "Substance Use in Home"
    case incarceratedParent  = "Incarcerated Parent"

    var pointValue: Int {
        switch self {
        case .homeless, .childInFosterCare, .domesticViolence: return 10
        case .childHasIEP, .singleParent: return 7
        case .limitedEnglish, .parentWithDisability: return 5
        default: return 3
        }
    }
    var icon: String { "exclamationmark.shield.fill" }
}

// MARK: - Suspension / Expulsion Log (Performance Standards §1302.17)
// Programs may NOT expel or suspend children without following specific steps

struct SuspensionExpulsionLog: Codable, Identifiable {
    let id: String
    let childId: String
    let childName: String
    let incidentDate: Date
    let incidentType: IncidentType
    var behaviorDescription: String

    // Required steps before any suspension/expulsion
    var mentalHealthConsultRequested: Bool
    var mentalHealthConsultDate: Date?
    var familyMeetingHeld: Bool
    var familyMeetingDate: Date?
    var behaviourSupportPlanCreated: Bool
    var behaviourSupportPlanDate: Date?
    var stateAgencyNotified: Bool          // required before expulsion
    var stateNotificationDate: Date?
    var outcome: Outcome
    var resolutionDate: Date?
    var notes: String

    var allStepsComplete: Bool {
        mentalHealthConsultRequested && familyMeetingHeld && behaviourSupportPlanCreated
    }

    enum IncidentType: String, Codable, CaseIterable {
        case suspensionShort = "Short-term Suspension (<10 days)"
        case suspensionLong  = "Long-term Suspension (10+ days)"
        case expulsion       = "Expulsion"
        case internalReview  = "Internal Review Only"
    }

    enum Outcome: String, Codable, CaseIterable {
        case returned         = "Child Returned"
        case transferred      = "Transferred to Another Program"
        case behaviourSupport = "Behavior Support Plan Active"
        case expelledByParent = "Family Withdrew Child"
        case pending          = "Pending Resolution"
    }
}

// MARK: - Dashboard
struct ProgramStats: Codable {
    var totalEnrolled: Int = 0
    var attendanceRate: Int = 0
    var healthDue: Int = 0
    var complianceScore: Int = 0
}

struct ProgramAlert: Codable, Identifiable {
    let id: String
    let title: String
    let description: String
    let type: String
    /// Optional hint for the destination screen (e.g. a health status filter
    /// like "Overdue" or "Due Soon"). Sent by the server; nil in older payloads.
    var filter: String? = nil

    var icon: String {
        switch type {
        case "health": return "heart.fill"
        case "attendance": return "exclamationmark.circle"
        case "compliance": return "checkmark.seal"
        case "message": return "envelope.badge.fill"
        case "document": return "doc.text.fill"
        case "absence": return "calendar.badge.minus"
        default: return "bell"
        }
    }

    var color: Color {
        switch type {
        case "health":     return .cfHealth
        case "attendance": return .cfAttendance
        case "compliance": return .cfCompliance
        case "message":    return .cfChildren
        case "document":   return .cfFamily
        case "absence":    return .cfAttendance
        default:           return .cfPrimary
        }
    }
}

/// Wire format for one "My Caseload" child. `attendanceStatus` is a raw string
/// ("present" | "absent" | "unknown") mapped to `CaseloadChild.AttendanceStatus`
/// by the dashboard view model.
struct DashboardCaseloadItem: Codable, Identifiable {
    let id: String
    let firstName: String
    let lastName: String
    let attendanceStatus: String
}

/// Wire format for one pending task. `type` + the optional fields map to a
/// `DashboardTask.TaskDestination` case client-side:
///   "documentSign" -> familyName, documentType
///   "healthRecord" -> childName, category
///   "family"       -> familyName, tab
///   "attendance"   -> (no extra fields)
struct DashboardTaskItemDTO: Codable, Identifiable {
    let id: String
    let title: String
    let dueLabel: String
    let urgency: String
    let type: String
    var familyName: String? = nil
    var documentType: String? = nil
    var childName: String? = nil
    var category: String? = nil
    var tab: String? = nil
}

/// Wire format for one today's-agenda item. `type` is "messages" or
/// "familyServices", matching the destination convention above.
struct DashboardAgendaItemDTO: Codable, Identifiable {
    let id: String
    let timeLabel: String
    let title: String
    var subtitle: String? = nil
    let colorType: String
    let type: String
}

struct DashboardInbox: Codable {
    var unreadMessageCount: Int = 0
    var lastMessagePreview: String = ""
}

struct DashboardDocumentsSummary: Codable {
    var totalDocumentCount: Int = 0
    var pendingDocumentCount: Int = 0
}

struct DashboardData: Codable {
    let stats: ProgramStats
    let alerts: [ProgramAlert]
    var caseload: [DashboardCaseloadItem] = []
    var tasks: [DashboardTaskItemDTO] = []
    var agenda: [DashboardAgendaItemDTO] = []
    var inbox: DashboardInbox? = nil
    var documents: DashboardDocumentsSummary? = nil

    // Custom init so older/partial payloads (or a server that hasn't deployed
    // the newer fields yet) decode safely instead of crashing the whole
    // dashboard load — same convention as User.enabledModules.
    enum CodingKeys: String, CodingKey {
        case stats, alerts, caseload, tasks, agenda, inbox, documents
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        stats = try c.decode(ProgramStats.self, forKey: .stats)
        alerts = try c.decode([ProgramAlert].self, forKey: .alerts)
        caseload = try c.decodeIfPresent([DashboardCaseloadItem].self, forKey: .caseload) ?? []
        tasks = try c.decodeIfPresent([DashboardTaskItemDTO].self, forKey: .tasks) ?? []
        agenda = try c.decodeIfPresent([DashboardAgendaItemDTO].self, forKey: .agenda) ?? []
        inbox = try c.decodeIfPresent(DashboardInbox.self, forKey: .inbox)
        documents = try c.decodeIfPresent(DashboardDocumentsSummary.self, forKey: .documents)
    }
}

// MARK: - Documents (staff file library)
/// Wire format for GET/POST /api/documents. `documentType` is the raw server
/// enum value (e.g. "birth_certificate") — see StaffDocument.DocumentType in
/// DocumentsView.swift for the display-facing mapping.
struct StaffDocumentDTO: Codable, Identifiable {
    let id: String
    let name: String
    let documentType: String
    let fileUrl: String
    var mimeType: String? = nil
    var fileSize: Int? = nil
    var assignedChildId: String? = nil
    var assignedChildName: String? = nil
    var expiryDate: String? = nil
    let uploadedAt: Date
}

// MARK: - Compliance
struct PIRSection: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let completionRate: Int
}

struct ComplianceChecklistItem: Codable, Identifiable {
    let id: String
    let title: String
    var isCompliant: Bool
    let note: String?
}

struct ComplianceData: Codable {
    let overallScore: Int
    let pirSections: [PIRSection]
    let checklistItems: [ComplianceChecklistItem]
}

// MARK: - PIR (Program Information Report) — federal annual report (OMB 0970-0427)

/// One catalog field plus (in a report context) its saved value.
struct PIRQuestion: Codable, Identifiable {
    var id: String { code }
    let code: String
    let section: String
    let subsection: String?
    let label: String
    /// "integer" | "percent" | "boolean" | "enum" | "text"
    let valueType: String
    let options: [String]?
    /// "enrollment" | "eoy" | nil — fields reported at both points in time.
    let paired: String?
    /// Stored value (nil/"" when unanswered). Present on report fetches.
    var value: String?
}

/// Full report for one program year: envelope + catalog ⋈ values.
struct PIRReportDetail: Codable {
    let year: String
    /// "draft" | "submitted" | "accepted"
    let status: String
    let submittedAt: Date?
    let totalQuestions: Int
    let answeredQuestions: Int
    var questions: [PIRQuestion]
}

/// A row in the report history list.
struct PIRReportSummary: Codable, Identifiable {
    let id: String
    let year: String
    let status: String
    let submittedAt: Date?
    let total: Int
    let answered: Int
}

// MARK: - Daily Reports / Moments (real-time activity feed)

/// One logged moment: meal, nap, diaper, activity, note, or photo.
struct ActivityLogItem: Codable, Identifiable {
    let id: String
    let childId: String
    /// "meal" | "nap" | "diaper" | "activity" | "note" | "photo"
    let activityType: String
    let description: String
    let timestamp: Date
    let childName: String
    let staffName: String
    /// Optional image/video URL (real storage URL, or an image data URL in dev).
    var mediaUrl: String? = nil
    /// "image" | "video" | nil
    var mediaType: String? = nil
}

// MARK: - Lesson Planning

struct LessonPlanSummary: Codable, Identifiable {
    let id: String
    let classroomId: String
    let classroomName: String
    let weekStartDate: String?
    let title: String
    let theme: String
    let status: String
}

struct LessonActivityItem: Codable, Identifiable {
    let id: String
    let dayOfWeek: String
    let title: String
    let description: String
    let domain: String?
}

struct LessonPlanDetail: Codable {
    let id: String
    let classroomName: String
    let weekStartDate: String?
    let title: String
    let theme: String
    let status: String
    let activities: [LessonActivityItem]
}

// MARK: - Child Portfolios

struct PortfolioEntryItem: Codable, Identifiable {
    let id: String
    let childId: String
    let title: String
    let observation: String
    let domain: String?
    let authorName: String?
    let observedAt: String?
}

// MARK: - Assessments (education records)

struct AssessmentItem: Codable, Identifiable {
    let id: String
    let childId: String
    /// "assessment" | "parent_conference" | "home_visit" | "individual_plan"
    let type: String
    let title: String
    let description: String
    let score: String
    let domain: String
    let assessmentDate: String?   // YYYY-MM-DD (kept as string; date-only)
}

// MARK: - Calendar

struct CalendarEventItem: Codable, Identifiable {
    let id: String
    let title: String
    let description: String
    let eventType: String
    let startDate: String   // ISO datetime (kept as string)
    let endDate: String?
    let location: String
    let allDay: Int
}

// MARK: - Meal plans

struct MealPlanItem: Codable, Identifiable {
    let id: String
    let classroomName: String
    let weekStartDate: String?
    let status: String
}

struct MealItemRow: Codable, Identifiable {
    let id: String
    let dayOfWeek: String
    let mealType: String
    let description: String
    let servings: Int?
}

// MARK: - Subsidies

struct SubsidyItem: Codable, Identifiable {
    let id: String
    let familyId: String
    let familyName: String
    let agencyName: String
    let caseNumber: String
    let authorizedAmount: String?
    let copayAmount: String?
    let status: String
    let startDate: String?
    let endDate: String?
    let notes: String
}

// MARK: - Reports
struct GeneratedReport: Codable, Identifiable {
    let id: String
    let title: String
    let content: String
    let generatedAt: Date
}

// MARK: - Settings
struct ProgramSettings: Codable {
    let programName: String
    let region: String
    let fiscalYear: String
}

// MARK: - Attendance response
struct AttendanceData: Codable {
    let records: [AttendanceRecord]
    let classrooms: [String]
}

// MARK: - Messaging
struct Conversation: Codable, Identifiable {
    let id: String
    let familyName: String
    let childName: String
    let participantNames: [String]
    let lastMessage: String
    let lastMessageDate: Date
    let unreadCount: Int
    let isActive: Bool
}

struct Message: Codable, Identifiable {
    let id: String
    let conversationId: String
    let senderId: String
    let senderName: String
    let senderRole: SenderRole
    let body: String
    let sentAt: Date
    let isRead: Bool
    /// Original text when `body` was auto-translated into the viewer's language.
    var bodyOriginal: String?
    /// True when `body` is an AI translation of `bodyOriginal`.
    var isTranslated: Bool?

    enum SenderRole: String, Codable {
        case staff, family
    }
}

struct SendMessageRequest: Codable {
    let conversationId: String
    let body: String
}

struct NewConversationRequest: Codable {
    let familyId: String
    let recipientIds: [String]
    let body: String
}

// MARK: - Family Invitations
struct FamilyInvitation: Codable, Identifiable {
    let id: String
    let childName: String
    let adultName: String
    let adultEmail: String
    let adultStatus: String        // "Primary" / "Secondary"
    let accountStatus: AccountStatus
    let statusDate: Date
    let missingInfo: [String]

    enum AccountStatus: String, Codable {
        case accountCreated = "Account created"
        case invitationSent = "Invitation sent"
        case noInvitationSent = "No invitation sent"

        var color: Color {
            switch self {
            case .accountCreated:    return .cfAttendance
            case .invitationSent:    return .cfFamily
            case .noInvitationSent:  return .cfHealth
            }
        }

        var icon: String {
            switch self {
            case .accountCreated: return "checkmark.circle.fill"
            case .invitationSent: return "envelope.fill"
            case .noInvitationSent: return "envelope.badge.fill"
            }
        }
    }
}

struct InvitationFilterCriteria: Codable {
    var programTerm: String
    var location: String
    var enrollmentStatus: String
    var excludeWithAccounts: Bool
    var excludeOneOfTwoParents: Bool
}

struct SendInvitationsRequest: Codable {
    let recipientIds: [String]
}

struct InvitationsResponse: Codable {
    let invitations: [FamilyInvitation]
    let locations: [String]
    let programTerms: [String]
}

struct InvitationStats: Codable {
    let accountCreated: Int
    let invitationSent: Int
    let noInvitationSent: Int
    var total: Int { accountCreated + invitationSent + noInvitationSent }
}

// MARK: - Family Auth
struct VerifiedInvitation: Codable {
    let code: String
    let childName: String
    let programName: String
    let adultEmail: String
}

struct FamilyProfile: Codable, Identifiable {
    let id: String
    let fullName: String
    let email: String
    let children: [FamilyChild]
}

struct FamilyChild: Codable, Identifiable {
    let id: String
    let firstName: String
    let lastName: String
    let classroom: String
    let teacher: String
    let dateOfBirth: String
    let enrollmentStatus: String
    let attendanceRate: Int
    let healthStatus: String
    let nextEvent: String?

    var fullName: String { "\(firstName) \(lastName)" }
}

struct FamilyEvent: Codable, Identifiable {
    let id: String
    let title: String
    let date: Date
    let type: String
}

struct FamilyAuthResult: Codable {
    let token: String
    let profile: FamilyProfile
}

// MARK: - Absence Reports

/// A parent's "my child is not coming" report, reviewed by a family advocate.
struct AbsenceReport: Codable, Identifiable {
    let id: String
    let childId: String
    let childName: String
    let familyName: String
    let date: Date
    let reason: String
    let reasonLabel: String
    let note: String
    let status: String   // pending | approved | denied
    let reportedAt: Date
}

/// In-app notification for a family (absence decisions, announcements, …).
struct ParentNotification: Codable, Identifiable {
    let id: String
    let message: String
    let type: String
    let isRead: Bool
    let createdAt: Date
}

/// Whether the program is open today, plus the next planned closure.
struct SchoolStatus: Codable {
    let isOpen: Bool
    let label: String
    let nextClosureTitle: String?
    let nextClosureDate: Date?
}

// MARK: - Family Progress (graphs)

struct FamilyProgress: Codable {
    let attendance: [ChildAttendanceSeries]
    let goals: [GoalProgressItem]
}

struct ChildAttendanceSeries: Codable, Identifiable {
    let childId: String
    let childName: String
    let weeks: [WeekRate]
    var id: String { childId }
}

struct WeekRate: Codable, Identifiable {
    let weekStart: String
    let label: String
    let rate: Int
    var id: String { weekStart }
}

struct GoalProgressItem: Codable, Identifiable {
    let id: String
    let title: String
    let progress: Int
    let status: String
}

// MARK: - Monthly Contact
struct MonthlyContact: Codable, Identifiable {
    let id: String
    let familyId: String
    let familyName: String
    let date: Date
    let contactType: ContactType
    let contactedBy: String
    let notes: String
    let followUpNeeded: Bool
    let followUpDate: Date?

    enum ContactType: String, Codable, CaseIterable {
        case phone       = "Phone Call"
        case inPerson    = "In Person"
        case text        = "Text Message"
        case zoom        = "Zoom/Video"
        case voicemail   = "Voicemail Attempt"
        case homeVisit   = "Home Visit"
        case email       = "Email"
        case coordinatedServices = "Coordinated Services"

        var icon: String {
            switch self {
            case .phone:      return "phone.fill"
            case .inPerson:   return "person.fill"
            case .text:       return "message.fill"
            case .zoom:       return "video.fill"
            case .voicemail:  return "phone.badge.waveform.fill"
            case .homeVisit:  return "house.fill"
            case .email:      return "envelope.fill"
            case .coordinatedServices: return "person.2.fill"
            }
        }
    }
}

struct NewContactRequest: Codable {
    let familyId: String
    let date: String
    let contactType: String
    let notes: String
    let followUpNeeded: Bool
    let followUpDate: String?
}

// MARK: - Family Partnership Agreement (FPA)
struct FamilyPartnershipAgreement: Codable, Identifiable {
    let id: String
    let familyId: String
    let familyName: String
    let completedDate: Date?
    let reviewDate: Date?
    let familyAdvocate: String
    let status: FPAStatus
    let parentSigned: Bool
    let staffSigned: Bool

    enum FPAStatus: String, Codable {
        case notStarted   = "Not Started"
        case inProgress   = "In Progress"
        case active       = "Active"
        case needsReview  = "Needs Review"

        var color: Color {
            switch self {
            case .notStarted:  return .cfTextSecondary
            case .inProgress:  return .cfFamily
            case .active:      return .cfAttendance
            case .needsReview: return .cfHealth
            }
        }
    }
}

// MARK: - Family Referral (community service referrals tracked in FPA)
struct FamilyReferral: Codable, Identifiable {
    let id: String
    let familyId: String
    let agencyName: String
    let serviceType: ReferralService
    let referredBy: String
    let referralDate: Date
    var followUpDate: Date?
    var status: ReferralStatus
    var notes: String
    var outcomeNotes: String

    enum ReferralService: String, Codable, CaseIterable {
        case housing            = "Housing Assistance"
        case foodAssistance     = "Food Assistance"
        case mentalHealth       = "Mental Health Services"
        case substanceUse       = "Substance Use Support"
        case domesticViolence   = "Domestic Violence Services"
        case legalAid           = "Legal Aid"
        case employment         = "Employment Services"
        case adultEducation     = "Adult Education / GED"
        case childcare          = "Additional Childcare"
        case medicalCare        = "Medical Care"
        case dentalCare         = "Dental Care"
        case visionCare         = "Vision Care"
        case transportation     = "Transportation"
        case utilityAssistance  = "Utility Assistance"
        case financialCounseling = "Financial Counseling"
        case other              = "Other"

        var icon: String {
            switch self {
            case .housing:            return "house.fill"
            case .foodAssistance:     return "cart.fill"
            case .mentalHealth:       return "brain.head.profile"
            case .substanceUse:       return "cross.case.fill"
            case .domesticViolence:   return "shield.fill"
            case .legalAid:           return "building.columns.fill"
            case .employment:         return "briefcase.fill"
            case .adultEducation:     return "graduationcap.fill"
            case .childcare:          return "figure.child"
            case .medicalCare:        return "stethoscope"
            case .dentalCare:         return "tooth.fill"
            case .visionCare:         return "eye.fill"
            case .transportation:     return "car.fill"
            case .utilityAssistance:  return "bolt.fill"
            case .financialCounseling: return "dollarsign.circle.fill"
            case .other:              return "star.fill"
            }
        }
    }

    enum ReferralStatus: String, Codable, CaseIterable {
        case pending    = "Pending"
        case contacted  = "Contacted"
        case enrolled   = "Enrolled / Receiving"
        case declined   = "Declined by Family"
        case unavailable = "Service Unavailable"
        case completed  = "Completed"

        var color: Color {
            switch self {
            case .pending:     return .orange
            case .contacted:   return .cfPrimary
            case .enrolled:    return .cfAttendance
            case .declined:    return .cfTextSecondary
            case .unavailable: return .cfHealth
            case .completed:   return .cfAttendance
            }
        }
        var icon: String {
            switch self {
            case .pending:     return "clock.fill"
            case .contacted:   return "phone.fill"
            case .enrolled:    return "checkmark.circle.fill"
            case .declined:    return "xmark.circle.fill"
            case .unavailable: return "nosign"
            case .completed:   return "checkmark.seal.fill"
            }
        }
    }
}

// MARK: - Home Visit Log
struct HomeVisitLog: Codable, Identifiable {
    let id: String
    let familyId: String
    let visitDate: Date
    let visitType: VisitType
    let durationMinutes: Int
    let conductedBy: String
    let topicsCovered: [VisitTopic]
    var notes: String
    var goalsMentioned: [String]   // goal IDs referenced in visit
    let locationVerified: Bool     // GPS stamp captured

    var durationLabel: String {
        let h = durationMinutes / 60
        let m = durationMinutes % 60
        if h > 0 { return m > 0 ? "\(h)h \(m)m" : "\(h)h" }
        return "\(m)m"
    }

    enum VisitType: String, Codable, CaseIterable {
        case homeVisit      = "Home Visit"
        case officeVisit    = "Office Visit"
        case phoneCall      = "Phone Call"
        case groupSocial    = "Group Socialization"
        case communityEvent = "Community Event"

        var icon: String {
            switch self {
            case .homeVisit:      return "house.fill"
            case .officeVisit:    return "building.2.fill"
            case .phoneCall:      return "phone.fill"
            case .groupSocial:    return "person.3.fill"
            case .communityEvent: return "mappin.circle.fill"
            }
        }
    }

    enum VisitTopic: String, Codable, CaseIterable {
        case childDevelopment   = "Child Development"
        case familyGoals        = "Family Goals"
        case healthWellness     = "Health & Wellness"
        case housingStability   = "Housing Stability"
        case employment         = "Employment"
        case education          = "Adult Education"
        case parentingSkills    = "Parenting Skills"
        case communityResources = "Community Resources"
        case childBehavior      = "Child Behavior"
        case schoolReadiness    = "School Readiness"
        case crisisSupport      = "Crisis Support"
        case other              = "Other"
    }
}

// MARK: - Family Goals (SMART Goals)
struct FamilyGoal: Codable, Identifiable {
    let id: String
    let familyId: String
    let title: String
    let description: String
    let category: GoalCategory
    var status: GoalStatus
    let targetDate: Date?
    let completedDate: Date?
    var steps: [GoalStep]
    let createdDate: Date

    enum GoalCategory: String, Codable, CaseIterable {
        case education         = "Education"
        case employment        = "Employment"
        case housing           = "Housing"
        case health            = "Health"
        case childDevelopment  = "Child Development"
        case familyWellbeing   = "Family Well-Being"
        case communitySupport  = "Community Support"
        case other             = "Other"

        var icon: String {
            switch self {
            case .education:        return "graduationcap.fill"
            case .employment:       return "briefcase.fill"
            case .housing:          return "house.fill"
            case .health:           return "heart.fill"
            case .childDevelopment: return "figure.child"
            case .familyWellbeing:  return "person.2.fill"
            case .communitySupport: return "person.3.fill"
            case .other:            return "star.fill"
            }
        }
    }

    enum GoalStatus: String, Codable, CaseIterable {
        case notStarted = "Not Started"
        case inProgress = "In Progress"
        case completed  = "Completed"
        case onHold     = "On Hold"

        var color: Color {
            switch self {
            case .notStarted: return .cfTextSecondary
            case .inProgress: return .cfChildren
            case .completed:  return .cfAttendance
            case .onHold:     return .cfFamily
            }
        }
    }
}

struct GoalStep: Codable, Identifiable {
    let id: String
    let title: String
    var isCompleted: Bool
    let dueDate: Date?
    let notes: String?
}

struct NewGoalRequest: Codable {
    let familyId: String
    let title: String
    let description: String
    let category: String
    let targetDate: String?
    let steps: [String]
}

// MARK: - Family Needs Assessment (FNA)
struct FamilyNeedsAssessment: Codable, Identifiable {
    let id: String
    let familyId: String
    let familyName: String
    let conductedBy: String
    let conductedDate: Date
    let reviewDate: Date?
    let ratings: [FNADomainRating]
    let notes: String
    let isComplete: Bool
}

struct FNADomainRating: Codable, Identifiable {
    let id: String
    let domain: FNADomain
    var level: FNALevel
    var notes: String

    enum FNADomain: String, Codable, CaseIterable {
        case familySafety          = "Family Safety"
        case familyHealth          = "Family Health"
        case familyLearning        = "Family Learning"
        case familyEngagement      = "Family Engagement"
        case familyWellbeing       = "Family Well-Being"
        case communityConnections  = "Community Connections"

        var icon: String {
            switch self {
            case .familySafety:         return "shield.fill"
            case .familyHealth:         return "heart.fill"
            case .familyLearning:       return "book.fill"
            case .familyEngagement:     return "person.2.fill"
            case .familyWellbeing:      return "sparkles"
            case .communityConnections: return "globe.americas.fill"
            }
        }
    }

    enum FNALevel: Int, Codable, CaseIterable {
        case significantNeed = 1
        case someNeed        = 2
        case needsMet        = 3
        case strength        = 4

        var label: String {
            switch self {
            case .significantNeed: return "Significant Need"
            case .someNeed:        return "Some Need"
            case .needsMet:        return "Needs Met"
            case .strength:        return "Strength"
            }
        }

        var color: Color {
            switch self {
            case .significantNeed: return .cfHealth
            case .someNeed:        return .cfFamily
            case .needsMet:        return .cfChildren
            case .strength:        return .cfAttendance
            }
        }
    }
}

// MARK: - CFCR (Child & Family Case Review)
struct CFCRRecord: Codable, Identifiable {
    let id: String
    let childId: String
    let childName: String
    let classroom: String
    let meetingDate: Date
    var participants: [CFCRParticipant]
    var attendanceNotes: String
    var healthNotes: String
    var behaviorNotes: String
    var developmentalNotes: String
    var familyGoalNotes: String
    var actionItems: [CFCRActionItem]
    let conductedBy: String
}

struct CFCRParticipant: Codable, Identifiable {
    let id: String
    let name: String
    let role: String
    var attended: Bool
}

struct CFCRActionItem: Codable, Identifiable {
    let id: String
    var description: String
    var assignedTo: String
    var dueDate: Date?
    var isCompleted: Bool
}

struct NewCFCRRequest: Codable {
    let childId: String
    let meetingDate: String
    let attendanceNotes: String
    let healthNotes: String
    let behaviorNotes: String
    let developmentalNotes: String
    let familyGoalNotes: String
}

// MARK: - Chronic Absence Alert System
// Head Start requires 85% attendance — below = chronic absence (>10% absent days)
// Performance Standards §1302.21

struct ChronicAbsenceAlert: Identifiable, Codable {
    let childId: String
    let childName: String
    let familyId: String
    let classroom: String
    let familyAdvocate: String

    // Attendance stats for current program year
    let totalDaysEnrolled: Int
    let totalDaysPresent: Int
    let totalDaysAbsent: Int
    let unexcusedAbsences: Int
    let excusedAbsences: Int

    var id: String { childId }

    // Trend: last 4 weeks rates (0.0–1.0)
    var weeklyRates: [Double]          // most recent last

    // Risk categorization
    var riskLevel: RiskLevel {
        if attendanceRate < 0.60 { return .severe }
        if attendanceRate < 0.75 { return .high }
        if attendanceRate < 0.85 { return .at_risk }
        if attendanceRate < 0.90 { return .watch }
        return .onTrack
    }

    var attendanceRate: Double {
        totalDaysEnrolled > 0 ? Double(totalDaysPresent) / Double(totalDaysEnrolled) : 1.0
    }

    var absenceRate: Double { 1.0 - attendanceRate }

    var hasAIP: Bool                   // Attendance Improvement Plan exists
    var lastOutreachDate: Date?
    var consecutiveAbsences: Int       // current streak
    var notes: String

    enum RiskLevel: String, CaseIterable {
        case severe  = "Severe (<60%)"
        case high    = "High (<75%)"
        case at_risk = "At Risk (<85%)"
        case watch   = "Needs Monitoring"
        case onTrack = "On Track"

        var color: Color {
            switch self {
            case .severe:  return Color(red: 0.85, green: 0.1, blue: 0.1)
            case .high:    return .cfHealth
            case .at_risk: return Color(red: 0.9, green: 0.4, blue: 0.1)
            case .watch:   return .orange
            case .onTrack: return .cfAttendance
            }
        }

        var icon: String {
            switch self {
            case .severe:  return "exclamationmark.octagon.fill"
            case .high:    return "xmark.circle.fill"
            case .at_risk: return "exclamationmark.triangle.fill"
            case .watch:   return "eye.fill"
            case .onTrack: return "checkmark.circle.fill"
            }
        }

        var priority: Int {
            switch self {
            case .severe: return 0; case .high: return 1; case .at_risk: return 2
            case .watch: return 3; case .onTrack: return 4
            }
        }

        var needsAIP: Bool { self == .severe || self == .high || self == .at_risk }
    }

    /// Auto-generate outreach message text
    func outreachMessage(advocateName: String) -> String {
        let pct = Int(attendanceRate * 100)
        return """
Hello, this is \(advocateName) from the Head Start program.

We're reaching out because \(childName)'s attendance is currently \(pct)%, which is below our 85% requirement for program participation.

We want to make sure your family has all the support needed to attend consistently. Could we schedule a time to talk about any barriers you're experiencing?

Please reply to this message or call us at your convenience.

Warm regards,
\(advocateName)
"""
    }
}

// MARK: - Attendance Success Plan
struct AttendanceSuccessPlan: Codable, Identifiable {
    let id: String
    let childId: String
    let childName: String
    let classroom: String
    let currentAttendanceRate: Double
    let createdDate: Date
    var reviewDate: Date?
    let familyAdvocate: String
    var barriers: [String]
    var strategies: [AttendancePlanStrategy]
    var status: PlanStatus

    enum PlanStatus: String, Codable {
        case active   = "Active"
        case resolved = "Resolved"
        case closed   = "Closed"

        var color: Color {
            switch self {
            case .active:   return .cfFamily
            case .resolved: return .cfAttendance
            case .closed:   return .cfTextSecondary
            }
        }
    }
}

struct AttendancePlanStrategy: Codable, Identifiable {
    let id: String
    var description: String
    var isImplemented: Bool
    var targetDate: Date?
}

// MARK: - Application Verification Checklist
struct ApplicationVerification: Codable, Identifiable {
    let id: String
    let childName: String
    let applicationDate: Date
    var verifiedBy: String
    var verifiedDate: Date?
    var primaryAdult: AdultVerification
    var secondaryAdult: AdultVerification?
    var childChecklist: ChildDocVerification
    var status: VerificationStatus
    var notes: String

    enum VerificationStatus: String, Codable {
        case pending    = "Pending"
        case inProgress = "In Progress"
        case complete   = "Complete"
        case needsInfo  = "Needs Info"

        var color: Color {
            switch self {
            case .pending:    return .cfTextSecondary
            case .inProgress: return .cfFamily
            case .complete:   return .cfAttendance
            case .needsInfo:  return .cfHealth
            }
        }
    }
}

struct AdultVerification: Codable {
    var firstName: Bool = false
    var lastName: Bool = false
    var dateOfBirth: Bool = false
    var gender: Bool = false
    var race: Bool = false
    var ethnicity: Bool = false
    var relationship: Bool = false
    var educationLevel: Bool = false
    var employmentStatus: Bool = false
    var address: Bool = false
    var phone: Bool = false
    var email: Bool = false

    var completedCount: Int {
        [firstName, lastName, dateOfBirth, gender, race, ethnicity,
         relationship, educationLevel, employmentStatus, address, phone, email]
            .filter { $0 }.count
    }
    var totalCount: Int { 12 }
}

struct ChildDocVerification: Codable {
    var firstName: Bool = false
    var lastName: Bool = false
    var dateOfBirth: Bool = false
    var gender: Bool = false
    var race: Bool = false
    var ethnicity: Bool = false
    var primaryLanguage: Bool = false
    var birthCertificate: Bool = false
    var proofOfIncome: Bool = false
    var immunizationRecords: Bool = false
    var physicalExam: Bool = false

    var completedCount: Int {
        [firstName, lastName, dateOfBirth, gender, race, ethnicity,
         primaryLanguage, birthCertificate, proofOfIncome, immunizationRecords, physicalExam]
            .filter { $0 }.count
    }
    var totalCount: Int { 11 }
}

// MARK: - CACFP Nutrition Forms
struct NutritionalPreferenceForm: Codable, Identifiable {
    let id: String
    let childId: String
    let childName: String
    let classroom: String
    let completedDate: Date
    let parentName: String
    var preferences: [FoodPreferenceEntry]
    var notes: String
}

struct FoodPreferenceEntry: Codable, Identifiable {
    let id: String
    let foodGroup: String
    let item: String
    var preference: FoodPreference

    enum FoodPreference: String, Codable, CaseIterable {
        case likes       = "Likes"
        case dislikes    = "Dislikes"
        case allergy     = "Allergy/Intolerance"
        case notExposed  = "Not Exposed"

        var color: Color {
            switch self {
            case .likes:      return .cfAttendance
            case .dislikes:   return .cfFamily
            case .allergy:    return .cfHealth
            case .notExposed: return .cfTextSecondary
            }
        }
    }
}

struct CACFPInfantFormulaForm: Codable, Identifiable {
    let id: String
    let childId: String
    let childName: String
    let classroom: String
    let completedDate: Date
    let parentName: String
    let formulaBrand: String
    let formulaType: String
    let preparationInstructions: String
    let feedingSchedule: String
    let notes: String
}

struct MedicalStatementCACFP: Codable, Identifiable {
    let id: String
    let childId: String
    let childName: String
    let classroom: String
    let physicianName: String
    let physicianPhone: String
    let diagnosis: String
    let foodsToAvoid: [String]
    let substitutions: String
    let signedDate: Date
    let notes: String
}

// MARK: - Family Engagement Events
struct FamilyEngagementEvent: Codable, Identifiable {
    let id: String
    let title: String
    let eventType: EventType
    var plannedDate: Date
    var actualDate: Date?
    var location: String
    let createdBy: String
    var objectives: [String]
    var preEventChecklist: [EventChecklistItem]
    var dayOfChecklist: [EventChecklistItem]
    var postEventChecklist: [EventChecklistItem]
    var expectedAttendance: Int
    var actualAttendance: Int?
    var notes: String
    var status: EventStatus

    enum EventType: String, Codable, CaseIterable {
        case parentOrientation = "Parent Orientation"
        case familyNight       = "Family Night"
        case workshop          = "Workshop"
        case healthFair        = "Health Fair"
        case graduationCeremony = "Graduation Ceremony"
        case fieldTrip         = "Field Trip"
        case communityEvent    = "Community Event"
        case other             = "Other"
    }

    enum EventStatus: String, Codable {
        case planning   = "Planning"
        case ready      = "Ready"
        case completed  = "Completed"
        case cancelled  = "Cancelled"

        var color: Color {
            switch self {
            case .planning:   return .cfFamily
            case .ready:      return .cfChildren
            case .completed:  return .cfAttendance
            case .cancelled:  return .cfHealth
            }
        }
    }
}

struct EventChecklistItem: Codable, Identifiable {
    let id: String
    let title: String
    var isComplete: Bool
    var notes: String
}

// MARK: - Case Notes

struct CaseNote: Codable, Identifiable {
    let id: String
    let familyId: String
    let authorId: String
    let authorName: String
    let type: NoteType
    let confidentiality: NoteConfidentiality
    let body: String
    let createdAt: Date
    let followUpRequired: Bool
    let followUpDue: Date?
    var followUpCompleted: Bool

    enum NoteType: String, Codable, CaseIterable {
        case homeVisit      = "Home Visit"
        case phoneCall      = "Phone Call"
        case officeVisit    = "Office Visit"
        case incident       = "Incident"
        case general        = "General"

        var icon: String {
            switch self {
            case .homeVisit:   return "house.fill"
            case .phoneCall:   return "phone.fill"
            case .officeVisit: return "building.2.fill"
            case .incident:    return "exclamationmark.triangle.fill"
            case .general:     return "note.text"
            }
        }

        var color: Color {
            switch self {
            case .homeVisit:   return .cfPrimary
            case .phoneCall:   return .cfChildren
            case .officeVisit: return .cfGoals
            case .incident:    return .cfHealth
            case .general:     return .cfTextSecondary
            }
        }
    }

    enum NoteConfidentiality: String, Codable, CaseIterable {
        case standard  = "Standard"
        case sensitive = "Sensitive"

        var color: Color {
            switch self {
            case .standard:  return .cfAttendance
            case .sensitive: return .cfHealth
            }
        }

        var icon: String {
            switch self {
            case .standard:  return "lock.open.fill"
            case .sensitive: return "lock.fill"
            }
        }
    }
}

struct NewCaseNoteRequest: Codable {
    let familyId: String
    let type: CaseNote.NoteType
    let confidentiality: CaseNote.NoteConfidentiality
    let body: String
    let followUpRequired: Bool
    let followUpDue: Date?
}

// MARK: - Timesheets & Clock In/Out

struct TimeEntry: Codable, Identifiable {
    let id: String
    let staffId: String
    let staffName: String
    let clockIn: Date
    var clockOut: Date?
    var breaks: [ShiftBreak]
    var status: EntryStatus
    var adminNote: String?

    var isActive: Bool { clockOut == nil }

    var totalMinutes: Int {
        let end = clockOut ?? Date()
        let raw = Int(end.timeIntervalSince(clockIn) / 60)
        let breakMins = breaks.reduce(0) { $0 + $1.durationMinutes }
        return max(0, raw - breakMins)
    }

    var totalHoursString: String {
        let h = totalMinutes / 60
        let m = totalMinutes % 60
        return String(format: "%d:%02d", h, m)
    }

    var isOnBreak: Bool {
        breaks.last?.endTime == nil
    }

    enum EntryStatus: String, Codable, CaseIterable {
        case active      = "Active"
        case pending     = "Pending Review"
        case approved    = "Approved"
        case flagged     = "Flagged"
        case missedOut   = "Missed Clock-Out"

        var color: Color {
            switch self {
            case .active:    return .cfAttendance
            case .pending:   return .cfFamily
            case .approved:  return .cfAttendance
            case .flagged:   return .cfHealth
            case .missedOut: return .cfHealth
            }
        }

        var icon: String {
            switch self {
            case .active:    return "clock.fill"
            case .pending:   return "clock.badge.questionmark"
            case .approved:  return "checkmark.circle.fill"
            case .flagged:   return "exclamationmark.triangle.fill"
            case .missedOut: return "clock.badge.exclamationmark.fill"
            }
        }
    }
}

struct ShiftBreak: Codable, Identifiable {
    let id: String
    let startTime: Date
    var endTime: Date?

    var durationMinutes: Int {
        guard let end = endTime else { return 0 }
        return max(0, Int(end.timeIntervalSince(startTime) / 60))
    }

    var isActive: Bool { endTime == nil }
}

struct TimesheetWeek: Codable, Identifiable {
    let id: String
    let staffId: String
    let staffName: String
    let weekStart: Date
    var entries: [TimeEntry]

    var totalMinutes: Int { entries.reduce(0) { $0 + $1.totalMinutes } }
    var regularMinutes: Int { min(totalMinutes, 40 * 60) }
    var overtimeMinutes: Int { max(0, totalMinutes - 40 * 60) }
    var pendingCount: Int { entries.filter { $0.status == .pending }.count }
    var flaggedCount: Int { entries.filter { $0.status == .flagged || $0.status == .missedOut }.count }

    var totalHoursString: String {
        let h = totalMinutes / 60
        let m = totalMinutes % 60
        return String(format: "%d:%02d", h, m)
    }
}

struct ClockInRequest: Codable {
    let staffId: String
    let timestamp: Date
    let locationNote: String?
}

struct ClockOutRequest: Codable {
    let entryId: String
    let timestamp: Date
}

// MARK: - Staff Activity Report (family-advocate workload)

/// Per-staff workload over a date range. Mirrors `/api/reports/staff-activity`.
struct StaffActivityReport: Decodable {
    let types: [String]
    let totals: StaffActivityTotals
    let staff: [StaffActivityRow]
    let detail: [StaffContactDetail]
}

struct StaffActivityTotals: Decodable {
    let total: Int
    let byType: [String: Int]
}

struct StaffActivityRow: Decodable, Identifiable {
    let staffId: String?
    let name: String
    let position: String
    let total: Int
    let byType: [String: Int]
    let lastActivity: String?
    var id: String { staffId ?? name }
}

struct StaffContactDetail: Decodable, Identifiable {
    let id: String
    let type: String
    let serviceDate: String
    let familyName: String
    let description: String
    let followUpRequired: Bool
}

// MARK: - Health Compliance (Head Start 45-day health / 90-day dental deadlines)

/// Per-child compliance status for a single health screening type.
struct ChildHealthCompliance: Identifiable, Codable {
    let childId: String
    let childName: String
    let familyId: String
    let enrollmentDate: Date           // clock starts here
    let dateOfBirth: Date

    // Screenings
    var healthScreeningDate: Date?     // must complete within 45 days of enrollment
    var dentalScreeningDate: Date?     // must complete within 90 days
    var visionScreeningDate: Date?     // recommended within 45 days
    var hearingScreeningDate: Date?    // recommended within 45 days
    var developmentalScreeningDate: Date? // ASQ or similar

    var id: String { childId }

    // MARK: Deadlines
    var healthDeadline: Date { Calendar.current.date(byAdding: .day, value: 45, to: enrollmentDate)! }
    var dentalDeadline: Date { Calendar.current.date(byAdding: .day, value: 90, to: enrollmentDate)! }

    // MARK: Days remaining (negative = overdue)
    var healthDaysRemaining: Int { Calendar.current.dateComponents([.day], from: Date(), to: healthDeadline).day ?? 0 }
    var dentalDaysRemaining: Int { Calendar.current.dateComponents([.day], from: Date(), to: dentalDeadline).day ?? 0 }

    var healthStatus: ComplianceStatus {
        if healthScreeningDate != nil { return .completed }
        let d = healthDaysRemaining
        if d < 0 { return .overdue }
        if d <= 7 { return .critical }
        if d <= 14 { return .warning }
        return .onTrack
    }

    var dentalStatus: ComplianceStatus {
        if dentalScreeningDate != nil { return .completed }
        let d = dentalDaysRemaining
        if d < 0 { return .overdue }
        if d <= 7 { return .critical }
        if d <= 14 { return .warning }
        return .onTrack
    }

    enum ComplianceStatus: String {
        case completed = "Completed"
        case onTrack   = "On Track"
        case warning   = "Due Soon"
        case critical  = "Urgent"
        case overdue   = "Overdue"

        var color: Color {
            switch self {
            case .completed: return .cfAttendance
            case .onTrack:   return .cfPrimary
            case .warning:   return .orange
            case .critical:  return Color(red: 0.9, green: 0.4, blue: 0.1)
            case .overdue:   return .cfHealth
            }
        }

        var icon: String {
            switch self {
            case .completed: return "checkmark.circle.fill"
            case .onTrack:   return "clock.fill"
            case .warning:   return "exclamationmark.circle"
            case .critical:  return "exclamationmark.triangle.fill"
            case .overdue:   return "xmark.circle.fill"
            }
        }

        var priority: Int {
            switch self {
            case .overdue: return 0; case .critical: return 1
            case .warning: return 2; case .onTrack: return 3; case .completed: return 4
            }
        }
    }
}

// MARK: - Safety Drill Log

struct SafetyDrillLog: Codable, Identifiable {
    let id: String
    let drillType: DrillType
    let drillDate: Date
    let conductedBy: String
    let durationMinutes: Int
    let participantCount: Int
    var notes: String
    var issuesFound: String
    var resolvedDate: Date?

    enum DrillType: String, Codable, CaseIterable {
        case fireEvacuation     = "Fire Evacuation"
        case lockdown           = "Lockdown"
        case tornadoShelter     = "Tornado / Severe Weather"
        case busEvacuation      = "Bus Evacuation"
        case firstAid           = "First Aid / Emergency"
        case other              = "Other"

        var icon: String {
            switch self {
            case .fireEvacuation: return "flame.fill"
            case .lockdown:       return "lock.shield.fill"
            case .tornadoShelter: return "tornado"
            case .busEvacuation:  return "bus.fill"
            case .firstAid:       return "cross.fill"
            case .other:          return "exclamationmark.triangle.fill"
            }
        }
    }
}

// MARK: - Mental Health Consult Log

struct MentalHealthConsult: Codable, Identifiable {
    let id: String
    let childId: String?               // nil = program-level consult
    let childName: String?
    let consultDate: Date
    let consultantName: String
    let consultType: ConsultType
    var summary: String
    var followUpDate: Date?
    var followUpNotes: String

    enum ConsultType: String, Codable, CaseIterable {
        case behaviorSupport    = "Behavior Support"
        case familySupport      = "Family Support"
        case staffCoaching      = "Staff Coaching"
        case classroomStrategy  = "Classroom Strategy"
        case referralReview     = "Referral Review"
        case programwide        = "Program-wide Planning"

        var icon: String {
            switch self {
            case .behaviorSupport:   return "brain.head.profile"
            case .familySupport:     return "house.and.flag.fill"
            case .staffCoaching:     return "person.badge.shield.checkmark"
            case .classroomStrategy: return "rectangle.on.rectangle.fill"
            case .referralReview:    return "arrow.turn.up.right"
            case .programwide:       return "building.2.fill"
            }
        }
    }
}

/// Display label for a family-contact type key (shared by web + iOS).
func contactTypeLabel(_ key: String) -> String {
    switch key {
    case "home_visit": return "Home Visit"
    case "office_visit": return "Office Visit"
    case "phone_call": return "Phone Call"
    case "email": return "Email"
    case "referral": return "Referral"
    case "coordinated_services": return "Coordinated Services"
    case "monthly_contact": return "Monthly Contact"
    default: return "Other"
    }
}

// MARK: - Digital Documents (E-Sign)

struct DigitalDocumentItem: Codable, Identifiable {
    let id: String
    let familyId: String
    let familyName: String
    let documentType: String
    let documentUrl: String
    var status: String
    var signedBy: String?
    var signedAt: String?
    let expiresAt: String?
    let createdAt: String
}

func digitalDocumentTypeLabel(_ type: String) -> String {
    switch type {
    case "enrollment":  return "Enrollment Packet"
    case "consent":     return "Consent Form"
    case "waiver":      return "Waiver"
    case "health_form": return "Health Form"
    case "iep":         return "IEP"
    default:            return "Document"
    }
}

// MARK: - Disability Services (IEP/IFSP, §1302.60-63)

struct DisabilityServiceSummary: Codable {
    let activeEnrollment: Int
    let childrenWithPlans: Int
    let pctOfEnrollment: Int
    let meetsTenPercent: Bool
    let expiringSoon: Int
    let parentRightsPending: Int
    var records: [DisabilityRecord]
}

struct DisabilityRecord: Codable, Identifiable {
    let id: String
    let childId: String
    let childName: String
    let planType: String
    var status: String
    var primaryDisability: String?
    var effectiveDate: String?
    var expirationDate: String?
    var leaAgency: String?
    var leaContact: String?
    var parentRightsNotifiedAt: String?
    var parentRightsLanguage: String?
    var transitionChecklist: [String]
    var notes: String?
}

func disabilityPlanTypeLabel(_ type: String) -> String {
    switch type {
    case "iep":         return "IEP"
    case "ifsp":        return "IFSP"
    case "section_504": return "Section 504"
    default:            return type
    }
}

func disabilityStatusLabel(_ status: String) -> String {
    switch status {
    case "pending_evaluation": return "Pending Evaluation"
    case "active":              return "Active"
    case "expired":             return "Expired"
    case "exited":               return "Exited"
    default:                    return status
    }
}
