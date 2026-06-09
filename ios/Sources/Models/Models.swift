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
        case .present: return .green
        case .absent: return .red
        case .excused: return .orange
        case .halfDay: return .blue
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

    var icon: String {
        switch type {
        case "health": return "heart.fill"
        case "attendance": return "exclamationmark.circle"
        case "compliance": return "checkmark.seal"
        default: return "bell"
        }
    }

    var color: Color {
        switch type {
        case "health": return .red
        case "attendance": return .orange
        case "compliance": return .purple
        default: return .blue
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
