import SwiftUI

// MARK: - Reports View

struct ReportsView: View {
    @StateObject private var viewModel = ReportsViewModel()

    var body: some View {
        List {
            Section {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Generate reports for your program records.")
                            .font(.cfSubheadline)
                            .foregroundColor(.cfTextPrimary)
                        Text("Tap any report to preview and share.")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    }
                    Spacer()
                    Image(systemName: "chart.bar.doc.horizontal.fill")
                        .font(.system(size: 28))
                        .foregroundColor(.cfPrimary.opacity(0.4))
                }
                .listRowBackground(Color.cfPrimaryLight)
            }

            ForEach(ReportCategory.allCases, id: \.self) { category in
                let types = ReportType.allCases.filter { $0.category == category }
                if !types.isEmpty {
                    Section(category.displayName) {
                        ForEach(types, id: \.self) { type in
                            ReportTypeRow(type: type, isGenerating: viewModel.generatingType == type) {
                                viewModel.generate(type)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Reports")
        .sheet(item: $viewModel.activeReport) { report in
            ReportPreviewSheet(report: report)
        }
        .alert("Couldn't Generate Report", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") { viewModel.errorMessage = nil }
        } message: { Text(viewModel.errorMessage ?? "") }
        .overlay {
            if viewModel.isGenerating {
                ZStack {
                    Color.black.opacity(0.25).ignoresSafeArea()
                    VStack(spacing: 14) {
                        ProgressView()
                            .scaleEffect(1.3)
                        Text("Generating report…")
                            .font(.cfSubheadline)
                    }
                    .padding(28)
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .cfCardShadow()
                }
            }
        }
    }
}

// MARK: - Report Type Row

struct ReportTypeRow: View {
    let type: ReportType
    let isGenerating: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(type.color.opacity(0.12))
                        .frame(width: 40, height: 40)
                    if isGenerating {
                        ProgressView().tint(type.color)
                    } else {
                        Image(systemName: type.icon)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(type.color)
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(type.displayName)
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(.cfTextPrimary)
                    Text(type.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.secondary)
            }
        }
        .disabled(isGenerating)
    }
}

// MARK: - Report Preview Sheet

struct ReportPreviewSheet: View {
    let report: GeneratedReport
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(report.title)
                                .font(.cfTitle2)
                                .foregroundColor(.cfTextPrimary)
                            Text("Generated \(report.generatedAt.formatted(.dateTime.month().day().year().hour().minute()))")
                                .font(.cfCaption)
                                .foregroundColor(.cfTextSecondary)
                        }
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.top, 4)

                    Divider()

                    Text(report.content)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(.cfTextPrimary)
                        .padding(.horizontal)
                        .padding(.bottom, 32)
                }
            }
            .background(Color.cfBackground.ignoresSafeArea())
            .navigationTitle(report.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    ShareLink(item: report.content, subject: Text(report.title)) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
    }
}

// MARK: - Enums

enum ReportCategory: String, CaseIterable {
    case children, program, staff, finance

    var displayName: String {
        switch self {
        case .children: return "Children & Families"
        case .program:  return "Program"
        case .staff:    return "Staff"
        case .finance:  return "Compliance & Fiscal"
        }
    }
}

enum ReportType: String, CaseIterable {
    case attendance, enrollment, health, demographics
    case familyServices, pir
    case staffTraining
    case compliance

    var category: ReportCategory {
        switch self {
        case .attendance, .enrollment, .health, .demographics: return .children
        case .familyServices, .pir:                             return .program
        case .staffTraining:                                    return .staff
        case .compliance:                                       return .finance
        }
    }

    var displayName: String {
        switch self {
        case .attendance:    return "Attendance Report"
        case .enrollment:    return "Enrollment Report"
        case .health:        return "Health Compliance"
        case .demographics:  return "Demographics"
        case .familyServices:return "Family Services"
        case .pir:           return "PIR Report"
        case .staffTraining: return "Staff Training"
        case .compliance:    return "Compliance Summary"
        }
    }

    var description: String {
        switch self {
        case .attendance:    return "Daily and monthly attendance rates"
        case .enrollment:    return "Current enrollment by classroom"
        case .health:        return "Health screening compliance overview"
        case .demographics:  return "Enrollment demographics breakdown"
        case .familyServices:return "Family goals and home visit activity"
        case .pir:           return "Program Information Report sections"
        case .staffTraining: return "Training hours and certification status"
        case .compliance:    return "Monitoring checklist and PIR readiness"
        }
    }

    var icon: String {
        switch self {
        case .attendance:    return "checkmark.circle"
        case .enrollment:    return "person.badge.plus"
        case .health:        return "heart.text.square"
        case .demographics:  return "chart.pie"
        case .familyServices:return "house"
        case .pir:           return "doc.text"
        case .staffTraining: return "graduationcap"
        case .compliance:    return "checkmark.seal"
        }
    }

    var color: Color {
        switch self {
        case .attendance:    return .cfAttendance
        case .enrollment:    return .cfChildren
        case .health:        return .cfHealth
        case .demographics:  return .cfGoals
        case .familyServices:return .cfFamily
        case .pir:           return .cfPrimary
        case .staffTraining: return .cfCompliance
        case .compliance:    return .cfAccent
        }
    }

    func mockContent(date: Date) -> String {
        let dateStr = date.formatted(.dateTime.month().day().year())
        switch self {
        case .attendance:
            return """
CHILDFLOW HEAD START — ATTENDANCE REPORT
Generated: \(dateStr)
──────────────────────────────────────────

SUMMARY
  Total Enrolled:        24 children
  Present Today:         21 (87.5%)
  Absent:                 3 (12.5%)
  Average (This Month):  89.2%
  Average (YTD):         91.0%

BY CLASSROOM
  Room 1A (Rivera):   12/12 present (100%)
  Room 2B (Carter):    9/12 present (75%)

CHRONIC ABSENCE (≥20% absences)
  Marcus Williams      — 4 absences (22%)
  Tyler Greene         — 5 absences (28%)

ACTION: Follow up with families for chronic absentees.
"""
        case .enrollment:
            return """
CHILDFLOW HEAD START — ENROLLMENT REPORT
Generated: \(dateStr)
──────────────────────────────────────────

CURRENT ENROLLMENT
  Total Capacity:    24
  Enrolled:          22 (91.7%)
  Open Slots:         2

BY CLASSROOM
  Room 1A (ages 3–4): 12/12 filled
  Room 2B (ages 4–5): 10/12 filled

PENDING APPLICATIONS
  Under Review:    2
  Pending:         3
  Approved:        5 (awaiting placement)

PRIORITY CATEGORIES
  Income-Eligible:  18 (81.8%)
  Foster Child:      2 ( 9.1%)
  Disability:        1 ( 4.5%)
  Homeless:          1 ( 4.5%)
"""
        case .health:
            return """
CHILDFLOW HEAD START — HEALTH COMPLIANCE REPORT
Generated: \(dateStr)
──────────────────────────────────────────

COMPLIANCE RATES
  Physical Exams:    4/4  (100%) ✓
  Dental Exams:      2/3  (67%)  ⚠
  Vision Screening:  2/2  (100%) ✓
  Hearing Screening: 2/2  (100%) ✓
  Immunizations:     2/3  (67%)  ⚠

OVERDUE ITEMS (Require Follow-Up)
  Diego Rodriguez   — Dental Exam  (overdue 15 days)
  Marcus Williams   — Dental Exam  (overdue 15 days)
  Emma Rodriguez    — Immunizations (overdue 15 days)

ACTIONS REQUIRED
  • Schedule dental appointments for 2 children
  • Obtain updated immunization records for 1 child
"""
        case .pir:
            return """
CHILDFLOW HEAD START — PIR REPORT SUMMARY
Generated: \(dateStr)
──────────────────────────────────────────

PROGRAM INFORMATION REPORT — FY 2025–26

SECTION COMPLETION RATES
  Child Dev & Education:     92% ✓
  Family & Community Eng:    78% ⚠
  Health & Disabilities:     65% ⚠
  Program Design & Mgmt:     88% ✓
  Fiscal & Governance:       95% ✓

  Overall Score:             84%

REQUIRED ACTIONS BEFORE SUBMISSION
  • Complete 3 pending developmental screenings
  • Update 5 family partnership agreements
  • Schedule remaining dental/vision exams
  • Document 2 outstanding home visits

SUBMISSION DEADLINE: June 30, 2026
"""
        case .staffTraining:
            return """
CHILDFLOW HEAD START — STAFF TRAINING REPORT
Generated: \(dateStr)
──────────────────────────────────────────

TRAINING HOURS SUMMARY (Required: 15/year)
  Dr. Patricia Hayes      24h ✓  (Director)
  Ms. Carmen Rivera       18h ✓  (Teacher)
  Dr. Marcus Ellis        22h ✓  (Health)
  Ms. Sandra Thompson     20h ✓  (Family)
  Ms. Angela Kim          16h ✓  (Family)
  Mr. James Carter        12h ⚠  (Teacher  — 3h needed)
  Ms. Destiny Moore        8h ⚠  (Assistant — 7h needed)
  Mr. Tyrell Washington    5h ⚠  (Assistant — 10h needed)

STAFF MEETING REQUIREMENT (15h/year)
  Met:          5 staff  (62.5%)
  Not Met:      3 staff  (37.5%)

CERTIFICATIONS
  CPR/First Aid:   8/8 current ✓
  Food Handler:    4/4 current ✓
"""
        default:
            return """
CHILDFLOW HEAD START — \(displayName.uppercased())
Generated: \(dateStr)
──────────────────────────────────────────

Report data for \(displayName).
This report is generated from program records.
Contact your program director for the full export.
"""
        }
    }
}

// MARK: - ViewModel

@MainActor
class ReportsViewModel: ObservableObject {
    @Published var activeReport: GeneratedReport? = nil
    @Published var isGenerating = false
    @Published var generatingType: ReportType? = nil
    @Published var errorMessage: String?

    func generate(_ type: ReportType) {
        guard !isGenerating else { return }
        isGenerating = true
        generatingType = type
        Task {
            do {
                activeReport = try await APIClient.shared.generateReport(type: type.rawValue)
            } catch {
                // This used to silently swap in a fabricated "offline mock"
                // report whose own template text claimed it was "generated
                // from program records" — completely fake data presented as
                // real, with no visual difference from an actual report.
                // NOTE: there is currently no backend route for
                // /api/reports/generate at all, so this always fails; report
                // generation needs a real server-side implementation per type.
                #if DEBUG
                activeReport = GeneratedReport(
                    id: UUID().uuidString,
                    title: type.displayName,
                    content: type.mockContent(date: Date()),
                    generatedAt: Date()
                )
                #else
                errorMessage = "Report generation isn't available yet. Check back soon."
                #endif
            }
            isGenerating = false
            generatingType = nil
        }
    }
}
