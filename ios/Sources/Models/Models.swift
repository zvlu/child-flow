import SwiftUI

// MARK: - User
struct User: Codable, Identifiable {
    let id: String
    let fullName: String
    let email: String
    let role: String

    var initials: String {
        fullName.split(separator: " ").compactMap { $0.first }.map(String.init).joined()
    }
}

// MARK: - Child
struct Child: Codable, Identifiable {
    let id: String
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

    var fullName: String { "\(firstName) \(lastName)" }
    var initials: String { "\(firstName.prefix(1))\(lastName.prefix(1))" }
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
        default:           return .cfPrimary
        }
    }
}

struct DashboardData: Codable {
    let stats: ProgramStats
    let alerts: [ProgramAlert]
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

        var icon: String {
            switch self {
            case .phone:      return "phone.fill"
            case .inPerson:   return "person.fill"
            case .text:       return "message.fill"
            case .zoom:       return "video.fill"
            case .voicemail:  return "phone.badge.waveform.fill"
            case .homeVisit:  return "house.fill"
            case .email:      return "envelope.fill"
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
