import Foundation

// MARK: - MockData
// Only used in DEBUG builds. Every ViewModel falls back to this when the API is unreachable.

#if DEBUG
enum MockData {

    // MARK: - Helpers
    private static func daysAgo(_ n: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: -n, to: Date()) ?? Date()
    }
    private static func daysFromNow(_ n: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: n, to: Date()) ?? Date()
    }
    private static func weeksAgo(_ n: Int) -> Date { daysAgo(n * 7) }

    // MARK: - Families

    static let families: [Family] = [
        Family(
            id: "family-1",
            name: "Johnson Family",
            phone: "(213) 555-0142",
            email: "maria.johnson@email.com",
            address: "1247 Maple Ave, Los Angeles, CA 90001",
            childrenCount: 1,
            lastContact: "June 3, 2026",
            nextHomeVisit: "June 18, 2026",
            goals: ["Complete GED program", "Find stable housing"]
        ),
        Family(
            id: "family-2",
            name: "Williams Family",
            phone: "(310) 555-0287",
            email: "keisha.williams@email.com",
            address: "834 Oak Street, Compton, CA 90220",
            childrenCount: 2,
            lastContact: "May 28, 2026",
            nextHomeVisit: "June 20, 2026",
            goals: ["Enroll in ESL classes", "Driver's license"]
        ),
        Family(
            id: "family-3",
            name: "Rodriguez Family",
            phone: "(323) 555-0391",
            email: "ana.rodriguez@email.com",
            address: "556 Pine Blvd, Inglewood, CA 90301",
            childrenCount: 2,
            lastContact: "June 5, 2026",
            nextHomeVisit: "June 25, 2026",
            goals: ["Connect with WIC services", "Potty training for Emma"]
        ),
        Family(
            id: "family-4",
            name: "Chen Family",
            phone: "(626) 555-0458",
            email: "linda.chen@email.com",
            address: "902 Elm Drive, Alhambra, CA 91801",
            childrenCount: 1,
            lastContact: "May 15, 2026",
            nextHomeVisit: "June 16, 2026",
            goals: ["Improve Jason's attendance"]
        ),
        Family(
            id: "family-5",
            name: "Thompson Family",
            phone: "(818) 555-0523",
            email: "jasmine.thompson@email.com",
            address: "218 Cedar Lane, Van Nuys, CA 91401",
            childrenCount: 1,
            lastContact: "June 1, 2026",
            nextHomeVisit: "June 22, 2026",
            goals: ["Job readiness training", "Consistent bedtime routine"]
        )
    ]

    // MARK: - Children

    static let children: [Child] = [
        Child(id: "child-1", firstName: "Sofia", lastName: "Johnson",
              dateOfBirth: "March 14, 2022", gender: "Female", primaryLanguage: "English",
              classroom: "Room 2A", teacher: "Ms. Davis",
              enrollmentStatus: "Active", healthStatus: "Current",
              attendanceRate: 94, parentName: "Maria Johnson",
              parentPhone: "(213) 555-0142", allergies: ["Peanuts"]),
        Child(id: "child-2", firstName: "Marcus", lastName: "Williams",
              dateOfBirth: "July 22, 2022", gender: "Male", primaryLanguage: "English",
              classroom: "Room 1B", teacher: "Mr. Thompson",
              enrollmentStatus: "Active", healthStatus: "Due Soon",
              attendanceRate: 72, parentName: "Keisha Williams",
              parentPhone: "(310) 555-0287", allergies: []),
        Child(id: "child-3", firstName: "Emma", lastName: "Rodriguez",
              dateOfBirth: "January 8, 2022", gender: "Female", primaryLanguage: "Spanish",
              classroom: "Room 2B", teacher: "Ms. Reyes",
              enrollmentStatus: "Active", healthStatus: "Current",
              attendanceRate: 89, parentName: "Ana Rodriguez",
              parentPhone: "(323) 555-0391", allergies: ["Dairy"]),
        Child(id: "child-4", firstName: "Diego", lastName: "Rodriguez",
              dateOfBirth: "October 3, 2022", gender: "Male", primaryLanguage: "Spanish",
              classroom: "Room 1A", teacher: "Ms. Kim",
              enrollmentStatus: "Active", healthStatus: "Overdue",
              attendanceRate: 81, parentName: "Ana Rodriguez",
              parentPhone: "(323) 555-0391", allergies: []),
        Child(id: "child-5", firstName: "Jason", lastName: "Chen",
              dateOfBirth: "May 19, 2022", gender: "Male", primaryLanguage: "Mandarin",
              classroom: "Room 2A", teacher: "Ms. Davis",
              enrollmentStatus: "Active", healthStatus: "Current",
              attendanceRate: 51, parentName: "Linda Chen",
              parentPhone: "(626) 555-0458", allergies: []),
        Child(id: "child-6", firstName: "Aaliyah", lastName: "Thompson",
              dateOfBirth: "August 30, 2022", gender: "Female", primaryLanguage: "English",
              classroom: "Room 1B", teacher: "Mr. Thompson",
              enrollmentStatus: "Active", healthStatus: "Current",
              attendanceRate: 88, parentName: "Jasmine Thompson",
              parentPhone: "(818) 555-0523", allergies: ["Tree Nuts"])
    ]

    // MARK: - Monthly Contacts

    static func contacts(for familyId: String) -> [MonthlyContact] {
        switch familyId {
        case "family-1":
            return [
                MonthlyContact(id: "c1-1", familyId: familyId, familyName: "Johnson Family",
                               date: daysAgo(6), contactType: .phone,
                               contactedBy: "Rosa Martinez",
                               notes: "Discussed Sofia's upcoming dental appointment. Maria confirmed she has transportation. Follow up on GED enrollment.",
                               followUpNeeded: true, followUpDate: daysFromNow(14)),
                MonthlyContact(id: "c1-2", familyId: familyId, familyName: "Johnson Family",
                               date: daysAgo(34), contactType: .homeVisit,
                               contactedBy: "Rosa Martinez",
                               notes: "Home visit completed. Reviewed FPA goals. Maria started GED prep classes at the community center. Housing situation stable.",
                               followUpNeeded: false, followUpDate: nil),
                MonthlyContact(id: "c1-3", familyId: familyId, familyName: "Johnson Family",
                               date: daysAgo(67), contactType: .inPerson,
                               contactedBy: "Rosa Martinez",
                               notes: "Met at pickup. Updated emergency contact. Gave resource list for housing assistance programs.",
                               followUpNeeded: false, followUpDate: nil)
            ]
        case "family-2":
            return [
                MonthlyContact(id: "c2-1", familyId: familyId, familyName: "Williams Family",
                               date: daysAgo(12), contactType: .phone,
                               contactedBy: "David Okafor",
                               notes: "Called regarding Marcus's attendance — he's been absent 4 times this month. Keisha mentioned transportation issues on Tuesdays and Thursdays.",
                               followUpNeeded: true, followUpDate: daysFromNow(7)),
                MonthlyContact(id: "c2-2", familyId: familyId, familyName: "Williams Family",
                               date: daysAgo(18), contactType: .voicemail,
                               contactedBy: "David Okafor",
                               notes: "Left voicemail regarding attendance concern. No response yet.",
                               followUpNeeded: true, followUpDate: daysAgo(15))
            ]
        case "family-3":
            return [
                MonthlyContact(id: "c3-1", familyId: familyId, familyName: "Rodriguez Family",
                               date: daysAgo(4), contactType: .inPerson,
                               contactedBy: "Rosa Martinez",
                               notes: "Met at parent meeting. Ana is interested in the cooking workshop next month. Discussed potty training progress for Emma — going well!",
                               followUpNeeded: false, followUpDate: nil),
                MonthlyContact(id: "c3-2", familyId: familyId, familyName: "Rodriguez Family",
                               date: daysAgo(40), contactType: .zoom,
                               contactedBy: "Rosa Martinez",
                               notes: "Video call to review FPA goals. Discussed WIC referral — Ana has an appointment scheduled for next week.",
                               followUpNeeded: false, followUpDate: nil)
            ]
        case "family-4":
            return [
                MonthlyContact(id: "c4-1", familyId: familyId, familyName: "Chen Family",
                               date: daysAgo(25), contactType: .phone,
                               contactedBy: "David Okafor",
                               notes: "Discussed Jason's chronic absenteeism (51%). Linda says family work schedule makes morning drop-off difficult. Created attendance success plan.",
                               followUpNeeded: true, followUpDate: daysAgo(10))
            ]
        case "family-5":
            return [
                MonthlyContact(id: "c5-1", familyId: familyId, familyName: "Thompson Family",
                               date: daysAgo(8), contactType: .text,
                               contactedBy: "Rosa Martinez",
                               notes: "Texted to confirm upcoming home visit. Jasmine confirmed June 22nd works.",
                               followUpNeeded: false, followUpDate: nil)
            ]
        default:
            return []
        }
    }

    // MARK: - Family Goals

    static func goals(for familyId: String) -> [FamilyGoal] {
        switch familyId {
        case "family-1":
            return [
                FamilyGoal(
                    id: "g1-1", familyId: familyId,
                    title: "Complete GED Program",
                    description: "Maria will complete her GED to open job opportunities and set a positive educational example for Sofia.",
                    category: .education,
                    status: .inProgress,
                    targetDate: daysFromNow(180),
                    completedDate: nil,
                    steps: [
                        GoalStep(id: "s1", title: "Register at community college GED program", isCompleted: true, dueDate: daysAgo(30), notes: "Enrolled at East LA College"),
                        GoalStep(id: "s2", title: "Attend orientation session", isCompleted: true, dueDate: daysAgo(20), notes: nil),
                        GoalStep(id: "s3", title: "Complete Math prep module", isCompleted: false, dueDate: daysFromNow(45), notes: nil),
                        GoalStep(id: "s4", title: "Take GED practice test", isCompleted: false, dueDate: daysFromNow(90), notes: nil),
                        GoalStep(id: "s5", title: "Schedule official GED exam", isCompleted: false, dueDate: daysFromNow(150), notes: nil)
                    ],
                    createdDate: daysAgo(60)
                ),
                FamilyGoal(
                    id: "g1-2", familyId: familyId,
                    title: "Stable Housing",
                    description: "Connect with housing assistance programs to secure long-term stable housing.",
                    category: .housing,
                    status: .inProgress,
                    targetDate: daysFromNow(90),
                    completedDate: nil,
                    steps: [
                        GoalStep(id: "s6", title: "Get referral to Section 8 housing list", isCompleted: true, dueDate: daysAgo(45), notes: "Referral submitted"),
                        GoalStep(id: "s7", title: "Meet with housing counselor", isCompleted: false, dueDate: daysFromNow(14), notes: nil),
                        GoalStep(id: "s8", title: "Submit housing application", isCompleted: false, dueDate: daysFromNow(30), notes: nil)
                    ],
                    createdDate: daysAgo(60)
                )
            ]
        case "family-2":
            return [
                FamilyGoal(
                    id: "g2-1", familyId: familyId,
                    title: "Enroll in ESL Classes",
                    description: "Keisha will improve her English language skills to help with employment and school communication.",
                    category: .education,
                    status: .notStarted,
                    targetDate: daysFromNow(60),
                    completedDate: nil,
                    steps: [
                        GoalStep(id: "s9", title: "Find nearby ESL program", isCompleted: false, dueDate: daysFromNow(14), notes: nil),
                        GoalStep(id: "s10", title: "Complete enrollment paperwork", isCompleted: false, dueDate: daysFromNow(21), notes: nil)
                    ],
                    createdDate: daysAgo(14)
                ),
                FamilyGoal(
                    id: "g2-2", familyId: familyId,
                    title: "Get California Driver's License",
                    description: "Will help with transportation to school and job interviews.",
                    category: .employment,
                    status: .inProgress,
                    targetDate: daysFromNow(120),
                    completedDate: nil,
                    steps: [
                        GoalStep(id: "s11", title: "Study CA driver handbook", isCompleted: true, dueDate: daysAgo(7), notes: nil),
                        GoalStep(id: "s12", title: "Pass written test at DMV", isCompleted: false, dueDate: daysFromNow(21), notes: nil),
                        GoalStep(id: "s13", title: "Complete 6 hours practice driving", isCompleted: false, dueDate: daysFromNow(60), notes: nil)
                    ],
                    createdDate: daysAgo(30)
                )
            ]
        case "family-3":
            return [
                FamilyGoal(
                    id: "g3-1", familyId: familyId,
                    title: "Potty Training for Emma",
                    description: "Emma will be fully potty trained before the school year ends.",
                    category: .childDevelopment,
                    status: .inProgress,
                    targetDate: daysFromNow(30),
                    completedDate: nil,
                    steps: [
                        GoalStep(id: "s14", title: "Consistent potty schedule at home (every 2 hrs)", isCompleted: true, dueDate: daysAgo(21), notes: "Going well!"),
                        GoalStep(id: "s15", title: "Introduce training pants", isCompleted: true, dueDate: daysAgo(14), notes: nil),
                        GoalStep(id: "s16", title: "Accident-free for 2 weeks", isCompleted: false, dueDate: daysFromNow(14), notes: nil)
                    ],
                    createdDate: daysAgo(45)
                ),
                FamilyGoal(
                    id: "g3-2", familyId: familyId,
                    title: "Connect with WIC Services",
                    description: "Enroll family in WIC nutrition program for continued support after Head Start.",
                    category: .health,
                    status: .completed,
                    targetDate: daysAgo(7),
                    completedDate: daysAgo(10),
                    steps: [
                        GoalStep(id: "s17", title: "Get WIC referral from program", isCompleted: true, dueDate: daysAgo(30), notes: nil),
                        GoalStep(id: "s18", title: "Attend WIC appointment", isCompleted: true, dueDate: daysAgo(10), notes: "Enrolled successfully!")
                    ],
                    createdDate: daysAgo(45)
                ),
                FamilyGoal(
                    id: "g3-3", familyId: familyId,
                    title: "Community Connections",
                    description: "Connect Ana with Spanish-speaking parent support group in the area.",
                    category: .communitySupport,
                    status: .notStarted,
                    targetDate: daysFromNow(45),
                    completedDate: nil,
                    steps: [
                        GoalStep(id: "s19", title: "Identify local parent support groups", isCompleted: false, dueDate: daysFromNow(7), notes: nil),
                        GoalStep(id: "s20", title: "Attend first group meeting", isCompleted: false, dueDate: daysFromNow(21), notes: nil)
                    ],
                    createdDate: daysAgo(5)
                )
            ]
        case "family-4":
            return [
                FamilyGoal(
                    id: "g4-1", familyId: familyId,
                    title: "Improve Jason's School Attendance",
                    description: "Bring Jason's attendance from 51% up to 85% or higher.",
                    category: .childDevelopment,
                    status: .inProgress,
                    targetDate: daysFromNow(60),
                    completedDate: nil,
                    steps: [
                        GoalStep(id: "s21", title: "Identify transportation barriers", isCompleted: true, dueDate: daysAgo(14), notes: "Work schedule conflict on M/W"),
                        GoalStep(id: "s22", title: "Connect with carpool network", isCompleted: false, dueDate: daysFromNow(14), notes: nil),
                        GoalStep(id: "s23", title: "Establish consistent morning routine", isCompleted: false, dueDate: daysFromNow(21), notes: nil)
                    ],
                    createdDate: daysAgo(25)
                )
            ]
        case "family-5":
            return [
                FamilyGoal(
                    id: "g5-1", familyId: familyId,
                    title: "Job Readiness Training",
                    description: "Jasmine will complete the workforce development program at the local career center.",
                    category: .employment,
                    status: .inProgress,
                    targetDate: daysFromNow(90),
                    completedDate: nil,
                    steps: [
                        GoalStep(id: "s24", title: "Enroll in career center program", isCompleted: true, dueDate: daysAgo(20), notes: nil),
                        GoalStep(id: "s25", title: "Complete resume workshop", isCompleted: true, dueDate: daysAgo(10), notes: nil),
                        GoalStep(id: "s26", title: "Attend mock interview session", isCompleted: false, dueDate: daysFromNow(14), notes: nil),
                        GoalStep(id: "s27", title: "Apply to 3 jobs", isCompleted: false, dueDate: daysFromNow(45), notes: nil)
                    ],
                    createdDate: daysAgo(25)
                )
            ]
        default:
            return []
        }
    }

    // MARK: - FPA Status

    static func fpaStatus(for familyId: String) -> FamilyPartnershipAgreement.FPAStatus {
        switch familyId {
        case "family-1": return .active
        case "family-2": return .inProgress
        case "family-3": return .active
        case "family-4": return .notStarted
        case "family-5": return .active
        default: return .notStarted
        }
    }

    static func fpa(for familyId: String) -> FamilyPartnershipAgreement {
        FamilyPartnershipAgreement(
            id: "fpa-\(familyId)",
            familyId: familyId,
            familyName: families.first { $0.id == familyId }?.name ?? "",
            completedDate: familyId == "family-4" ? nil : daysAgo(45),
            reviewDate: familyId == "family-4" ? nil : daysFromNow(135),
            familyAdvocate: ["family-1", "family-3", "family-5"].contains(familyId) ? "Rosa Martinez" : "David Okafor",
            status: fpaStatus(for: familyId),
            parentSigned: familyId != "family-4",
            staffSigned: familyId != "family-4"
        )
    }

    // MARK: - Family Referrals
    static func referrals(for familyId: String) -> [FamilyReferral] {
        switch familyId {
        case "family-1":
            return [
                FamilyReferral(id: "ref-1a", familyId: familyId, agencyName: "Community Housing Alliance",
                               serviceType: .housing, referredBy: "Rosa Martinez",
                               referralDate: daysAgo(60), followUpDate: daysAgo(30),
                               status: .enrolled, notes: "Family applied for Section 8 waitlist",
                               outcomeNotes: "Accepted onto waitlist — estimated 6 month wait"),
                FamilyReferral(id: "ref-1b", familyId: familyId, agencyName: "Adult Learning Center",
                               serviceType: .adultEducation, referredBy: "Rosa Martinez",
                               referralDate: daysAgo(45), followUpDate: daysFromNow(14),
                               status: .contacted, notes: "Maria interested in GED program",
                               outcomeNotes: ""),
                FamilyReferral(id: "ref-1c", familyId: familyId, agencyName: "County Food Bank",
                               serviceType: .foodAssistance, referredBy: "Rosa Martinez",
                               referralDate: daysAgo(90), followUpDate: daysAgo(60),
                               status: .enrolled, notes: "Monthly SNAP supplement distribution",
                               outcomeNotes: "Family picks up monthly")
            ]
        case "family-2":
            return [
                FamilyReferral(id: "ref-2a", familyId: familyId, agencyName: "Safe Harbor Counseling",
                               serviceType: .mentalHealth, referredBy: "David Okafor",
                               referralDate: daysAgo(30), followUpDate: daysFromNow(7),
                               status: .pending, notes: "Father requested counseling support after job loss",
                               outcomeNotes: ""),
                FamilyReferral(id: "ref-2b", familyId: familyId, agencyName: "WorkForce Solutions",
                               serviceType: .employment, referredBy: "David Okafor",
                               referralDate: daysAgo(20), followUpDate: daysFromNow(10),
                               status: .contacted, notes: "Resume assistance and job placement",
                               outcomeNotes: "First appointment scheduled")
            ]
        case "family-3":
            return [
                FamilyReferral(id: "ref-3a", familyId: familyId, agencyName: "City Dental Clinic",
                               serviceType: .dentalCare, referredBy: "Rosa Martinez",
                               referralDate: daysAgo(14), followUpDate: daysFromNow(21),
                               status: .pending, notes: "Children need dental follow-up",
                               outcomeNotes: ""),
                FamilyReferral(id: "ref-3b", familyId: familyId, agencyName: "Legal Aid Society",
                               serviceType: .legalAid, referredBy: "Rosa Martinez",
                               referralDate: daysAgo(5), followUpDate: daysFromNow(30),
                               status: .pending, notes: "Immigration documentation assistance",
                               outcomeNotes: "")
            ]
        case "family-4":
            return []
        case "family-5":
            return [
                FamilyReferral(id: "ref-5a", familyId: familyId, agencyName: "Utility Assistance Program",
                               serviceType: .utilityAssistance, referredBy: "Rosa Martinez",
                               referralDate: daysAgo(21), followUpDate: daysFromNow(9),
                               status: .enrolled, notes: "Heating assistance for winter",
                               outcomeNotes: "Approved — $400 credit applied"),
                FamilyReferral(id: "ref-5b", familyId: familyId, agencyName: "Family Counseling Center",
                               serviceType: .mentalHealth, referredBy: "Rosa Martinez",
                               referralDate: daysAgo(60), followUpDate: daysAgo(30),
                               status: .completed, notes: "Grief counseling after family loss",
                               outcomeNotes: "6-session program completed successfully")
            ]
        default:
            return []
        }
    }

    // MARK: - Home Visit Logs
    static func visitLogs(for familyId: String) -> [HomeVisitLog] {
        switch familyId {
        case "family-1":
            return [
                HomeVisitLog(id: "visit-1a", familyId: familyId, visitDate: daysAgo(7),
                             visitType: .homeVisit, durationMinutes: 90,
                             conductedBy: "Rosa Martinez",
                             topicsCovered: [.familyGoals, .childDevelopment, .communityResources],
                             notes: "Great visit. Maria discussed GED progress. Children were engaged in play activities. Reviewed housing referral status.",
                             goalsMentioned: ["goal-1-edu"], locationVerified: true),
                HomeVisitLog(id: "visit-1b", familyId: familyId, visitDate: daysAgo(21),
                             visitType: .homeVisit, durationMinutes: 95,
                             conductedBy: "Rosa Martinez",
                             topicsCovered: [.parentingSkills, .schoolReadiness, .healthWellness],
                             notes: "Discussed kindergarten readiness activities. Provided literacy materials. Mother expressed concern about Sofia's speech.",
                             goalsMentioned: [], locationVerified: true),
                HomeVisitLog(id: "visit-1c", familyId: familyId, visitDate: daysAgo(42),
                             visitType: .phoneCall, durationMinutes: 20,
                             conductedBy: "Rosa Martinez",
                             topicsCovered: [.familyGoals, .housingStability],
                             notes: "Follow-up on housing referral. Family confirmed they submitted Section 8 application.",
                             goalsMentioned: [], locationVerified: false)
            ]
        case "family-2":
            return [
                HomeVisitLog(id: "visit-2a", familyId: familyId, visitDate: daysAgo(14),
                             visitType: .homeVisit, durationMinutes: 85,
                             conductedBy: "David Okafor",
                             topicsCovered: [.employment, .childBehavior, .parentingSkills],
                             notes: "Father James attended this visit. Discussed job search strategies. Emma's behavior at school was reviewed.",
                             goalsMentioned: [], locationVerified: true),
                HomeVisitLog(id: "visit-2b", familyId: familyId, visitDate: daysAgo(35),
                             visitType: .homeVisit, durationMinutes: 90,
                             conductedBy: "David Okafor",
                             topicsCovered: [.familyGoals, .crisisSupport],
                             notes: "Family experiencing stress due to job loss. Discussed mental health referral. Both parents participated.",
                             goalsMentioned: [], locationVerified: true)
            ]
        case "family-3":
            return [
                HomeVisitLog(id: "visit-3a", familyId: familyId, visitDate: daysAgo(10),
                             visitType: .homeVisit, durationMinutes: 100,
                             conductedBy: "Rosa Martinez",
                             topicsCovered: [.childDevelopment, .schoolReadiness, .communityResources],
                             notes: "Visited crowded apartment. Three families sharing space. Reviewed immigration legal aid referral.",
                             goalsMentioned: [], locationVerified: true)
            ]
        case "family-5":
            return [
                HomeVisitLog(id: "visit-5a", familyId: familyId, visitDate: daysAgo(5),
                             visitType: .homeVisit, durationMinutes: 95,
                             conductedBy: "Rosa Martinez",
                             topicsCovered: [.familyGoals, .childDevelopment, .healthWellness],
                             notes: "Alicia is doing very well. Marcus's speech therapy is showing progress. Reviewed family wellness goals.",
                             goalsMentioned: [], locationVerified: true),
                HomeVisitLog(id: "visit-5b", familyId: familyId, visitDate: daysAgo(26),
                             visitType: .groupSocial, durationMinutes: 120,
                             conductedBy: "Rosa Martinez",
                             topicsCovered: [.parentingSkills, .schoolReadiness],
                             notes: "Attended Saturday family socialization event. Alicia connected with other parents.",
                             goalsMentioned: [], locationVerified: false)
            ]
        default:
            return []
        }
    }

    // MARK: - Family Needs Assessments

    static func fna(for familyId: String) -> FamilyNeedsAssessment? {
        guard familyId != "family-4" else { return nil } // Chen family has no FNA yet

        let ratings: [FNADomainRating]
        let notes: String

        switch familyId {
        case "family-1":
            ratings = [
                FNADomainRating(id: UUID().uuidString, domain: .familySafety, level: .strength, notes: "Stable home environment"),
                FNADomainRating(id: UUID().uuidString, domain: .familyHealth, level: .needsMet, notes: "All children current on health exams"),
                FNADomainRating(id: UUID().uuidString, domain: .familyLearning, level: .someNeed, notes: "Maria working toward GED"),
                FNADomainRating(id: UUID().uuidString, domain: .familyEngagement, level: .strength, notes: "Very engaged — attends all events"),
                FNADomainRating(id: UUID().uuidString, domain: .familyWellbeing, level: .needsMet, notes: ""),
                FNADomainRating(id: UUID().uuidString, domain: .communityConnections, level: .someNeed, notes: "Limited social network, working on this")
            ]
            notes = "Maria is making excellent progress on her education goals. Family is engaged and stable."
        case "family-2":
            ratings = [
                FNADomainRating(id: UUID().uuidString, domain: .familySafety, level: .needsMet, notes: ""),
                FNADomainRating(id: UUID().uuidString, domain: .familyHealth, level: .someNeed, notes: "Marcus overdue for dental"),
                FNADomainRating(id: UUID().uuidString, domain: .familyLearning, level: .someNeed, notes: "Keisha working on English"),
                FNADomainRating(id: UUID().uuidString, domain: .familyEngagement, level: .needsMet, notes: "Participates when transportation is available"),
                FNADomainRating(id: UUID().uuidString, domain: .familyWellbeing, level: .someNeed, notes: "Transportation is main stressor"),
                FNADomainRating(id: UUID().uuidString, domain: .communityConnections, level: .significantNeed, notes: "Isolated — language barrier")
            ]
            notes = "Transportation and language access are primary barriers. Connecting with ESL and community resources."
        case "family-3":
            ratings = [
                FNADomainRating(id: UUID().uuidString, domain: .familySafety, level: .strength, notes: ""),
                FNADomainRating(id: UUID().uuidString, domain: .familyHealth, level: .someNeed, notes: "Diego overdue for physical"),
                FNADomainRating(id: UUID().uuidString, domain: .familyLearning, level: .needsMet, notes: ""),
                FNADomainRating(id: UUID().uuidString, domain: .familyEngagement, level: .strength, notes: "Ana volunteers regularly"),
                FNADomainRating(id: UUID().uuidString, domain: .familyWellbeing, level: .needsMet, notes: ""),
                FNADomainRating(id: UUID().uuidString, domain: .communityConnections, level: .someNeed, notes: "Building community connections")
            ]
            notes = "Strong, engaged family. Primary needs are around health follow-ups and expanding community network."
        default:
            ratings = FNADomainRating.FNADomain.allCases.map {
                FNADomainRating(id: UUID().uuidString, domain: $0, level: .needsMet, notes: "")
            }
            notes = ""
        }

        return FamilyNeedsAssessment(
            id: "fna-\(familyId)",
            familyId: familyId,
            familyName: families.first { $0.id == familyId }?.name ?? "",
            conductedBy: "Rosa Martinez",
            conductedDate: daysAgo(42),
            reviewDate: daysFromNow(138),
            ratings: ratings,
            notes: notes,
            isComplete: true
        )
    }

    // MARK: - CFCR Records

    static func cfcrRecords(for familyId: String) -> [CFCRRecord] {
        switch familyId {
        case "family-1":
            return [
                CFCRRecord(
                    id: "cfcr-1-1",
                    childId: "child-1",
                    childName: "Sofia Johnson",
                    classroom: "Room 2A",
                    meetingDate: daysAgo(14),
                    participants: [
                        CFCRParticipant(id: "p1", name: "Ms. Davis", role: "Teacher", attended: true),
                        CFCRParticipant(id: "p2", name: "Rosa Martinez", role: "Family Advocate", attended: true),
                        CFCRParticipant(id: "p3", name: "James Holloway", role: "Education Coordinator", attended: true),
                        CFCRParticipant(id: "p4", name: "Dr. Priya Nair", role: "Health Specialist", attended: false)
                    ],
                    attendanceNotes: "Sofia has 94% attendance this month — excellent. No concerns. Family uses public transit reliably.",
                    healthNotes: "Physical exam current. Peanut allergy noted on file, EpiPen on site. Next dental due in August.",
                    behaviorNotes: "Sofia is thriving socially. Very kind to peers. No behavioral concerns. Loves circle time and dramatic play.",
                    developmentalNotes: "ASQ-3 screening completed — all areas on track. Language development is strong (bilingual English/Spanish at home).",
                    familyGoalNotes: "Maria enrolled in GED program — great progress! Housing application submitted. FA to follow up in 2 weeks.",
                    actionItems: [
                        CFCRActionItem(id: "a1", description: "Schedule August dental appointment reminder", assignedTo: "Rosa Martinez", dueDate: daysFromNow(45), isCompleted: false),
                        CFCRActionItem(id: "a2", description: "Follow up on housing application status", assignedTo: "Rosa Martinez", dueDate: daysFromNow(14), isCompleted: false)
                    ],
                    conductedBy: "Rosa Martinez"
                ),
                CFCRRecord(
                    id: "cfcr-1-2",
                    childId: "child-1",
                    childName: "Sofia Johnson",
                    classroom: "Room 2A",
                    meetingDate: daysAgo(45),
                    participants: [
                        CFCRParticipant(id: "p5", name: "Ms. Davis", role: "Teacher", attended: true),
                        CFCRParticipant(id: "p6", name: "Rosa Martinez", role: "Family Advocate", attended: true),
                        CFCRParticipant(id: "p7", name: "James Holloway", role: "Education Coordinator", attended: false),
                        CFCRParticipant(id: "p8", name: "Dr. Priya Nair", role: "Health Specialist", attended: true)
                    ],
                    attendanceNotes: "90% attendance. One absence due to illness — excused.",
                    healthNotes: "Vision screening completed — within normal range. No concerns.",
                    behaviorNotes: "Initial adjustment period — Sofia was shy at first but is now fully integrated with her peer group.",
                    developmentalNotes: "Gross motor and fine motor skills on track. Pencil grip improving.",
                    familyGoalNotes: "FPA completed at parent orientation. Maria identified GED and housing as top goals. Referrals provided.",
                    actionItems: [
                        CFCRActionItem(id: "a3", description: "Provide GED program resource list to Maria", assignedTo: "Rosa Martinez", dueDate: daysAgo(35), isCompleted: true)
                    ],
                    conductedBy: "Rosa Martinez"
                )
            ]
        case "family-2":
            return [
                CFCRRecord(
                    id: "cfcr-2-1",
                    childId: "child-2",
                    childName: "Marcus Williams",
                    classroom: "Room 1B",
                    meetingDate: daysAgo(10),
                    participants: [
                        CFCRParticipant(id: "p9", name: "Mr. Thompson", role: "Teacher", attended: true),
                        CFCRParticipant(id: "p10", name: "David Okafor", role: "Family Advocate", attended: true),
                        CFCRParticipant(id: "p11", name: "James Holloway", role: "Education Coordinator", attended: true),
                        CFCRParticipant(id: "p12", name: "Dr. Priya Nair", role: "Health Specialist", attended: false)
                    ],
                    attendanceNotes: "CONCERN: Marcus at 72% attendance this month — below 85% threshold. Attendance success plan created. Transportation on Tuesdays/Thursdays is primary barrier.",
                    healthNotes: "Dental exam is overdue. FA to contact family to schedule. No other health concerns.",
                    behaviorNotes: "Marcus is playful and engaged when present. Has formed good friendships. Teacher notes he picks up concepts quickly.",
                    developmentalNotes: "Developmental screening due next month. Pre-literacy showing strength — recognizes most letters.",
                    familyGoalNotes: "FPA in progress. Keisha interested in ESL classes. Driver's license added as a goal — will help with transportation.",
                    actionItems: [
                        CFCRActionItem(id: "a4", description: "Follow up on dental appointment", assignedTo: "David Okafor", dueDate: daysFromNow(7), isCompleted: false),
                        CFCRActionItem(id: "a5", description: "Explore carpool options for Tues/Thurs", assignedTo: "David Okafor", dueDate: daysFromNow(10), isCompleted: false),
                        CFCRActionItem(id: "a6", description: "Provide ESL enrollment info to Keisha", assignedTo: "David Okafor", dueDate: daysFromNow(5), isCompleted: false)
                    ],
                    conductedBy: "David Okafor"
                )
            ]
        case "family-4":
            return [
                CFCRRecord(
                    id: "cfcr-4-1",
                    childId: "child-5",
                    childName: "Jason Chen",
                    classroom: "Room 2A",
                    meetingDate: daysAgo(20),
                    participants: [
                        CFCRParticipant(id: "p13", name: "Ms. Davis", role: "Teacher", attended: true),
                        CFCRParticipant(id: "p14", name: "David Okafor", role: "Family Advocate", attended: true),
                        CFCRParticipant(id: "p15", name: "James Holloway", role: "Education Coordinator", attended: true),
                        CFCRParticipant(id: "p16", name: "Dr. Priya Nair", role: "Health Specialist", attended: true)
                    ],
                    attendanceNotes: "CRITICAL CONCERN: Jason at 51% attendance. Attendance success plan created and active. Linda confirmed work schedule makes morning drop-off impossible on Monday and Wednesday.",
                    healthNotes: "Physical exam current. No health concerns noted. Jason appears healthy and well-nourished when present.",
                    behaviorNotes: "When present, Jason is engaged and happy. Teacher notes he has no problem re-integrating after absences, which is positive.",
                    developmentalNotes: "ASQ-3 not completed due to insufficient attendance. Will attempt on next visit. Teacher observations suggest age-appropriate development.",
                    familyGoalNotes: "FPA not yet completed — scheduling appointment with Linda. Attendance improvement is the primary goal.",
                    actionItems: [
                        CFCRActionItem(id: "a7", description: "Schedule FPA meeting with Linda Chen", assignedTo: "David Okafor", dueDate: daysFromNow(7), isCompleted: false),
                        CFCRActionItem(id: "a8", description: "Research alternate drop-off options / carpool network", assignedTo: "David Okafor", dueDate: daysFromNow(5), isCompleted: false),
                        CFCRActionItem(id: "a9", description: "Weekly attendance check-in call", assignedTo: "David Okafor", dueDate: daysFromNow(7), isCompleted: false)
                    ],
                    conductedBy: "David Okafor"
                )
            ]
        default:
            return []
        }
    }

    // MARK: - Attendance Success Plans

    static let attendancePlans: [AttendanceSuccessPlan] = [
        AttendanceSuccessPlan(
            id: "asp-1",
            childId: "child-5",
            childName: "Jason Chen",
            classroom: "Room 2A",
            currentAttendanceRate: 51,
            createdDate: daysAgo(20),
            reviewDate: daysFromNow(10),
            familyAdvocate: "David Okafor",
            barriers: [
                "Parent work schedule conflicts (Monday & Wednesday mornings)",
                "Limited English proficiency — communication challenges",
                "No reliable transportation on specific days"
            ],
            strategies: [
                AttendancePlanStrategy(id: "st1", description: "Weekly phone check-in with Linda Chen every Friday", isImplemented: true, targetDate: daysAgo(14)),
                AttendancePlanStrategy(id: "st2", description: "Connect family with school carpool network", isImplemented: false, targetDate: daysFromNow(7)),
                AttendancePlanStrategy(id: "st3", description: "Provide bilingual (Mandarin) attendance importance materials", isImplemented: true, targetDate: daysAgo(10)),
                AttendancePlanStrategy(id: "st4", description: "Explore flexible drop-off window with site director", isImplemented: false, targetDate: daysFromNow(5))
            ],
            status: .active
        ),
        AttendanceSuccessPlan(
            id: "asp-2",
            childId: "child-2",
            childName: "Marcus Williams",
            classroom: "Room 1B",
            currentAttendanceRate: 72,
            createdDate: daysAgo(10),
            reviewDate: daysFromNow(20),
            familyAdvocate: "David Okafor",
            barriers: [
                "Transportation issues on Tuesday and Thursday",
                "Sibling childcare conflict on some mornings"
            ],
            strategies: [
                AttendancePlanStrategy(id: "st5", description: "Identify Tuesday/Thursday carpool partners near family", isImplemented: false, targetDate: daysFromNow(10)),
                AttendancePlanStrategy(id: "st6", description: "Discuss attendance importance at next home visit", isImplemented: false, targetDate: daysFromNow(14)),
                AttendancePlanStrategy(id: "st7", description: "Provide attendance tracking chart for home (visual reward system)", isImplemented: false, targetDate: daysFromNow(7))
            ],
            status: .active
        )
    ]

    // MARK: - Application Verifications

    static let applicationVerifications: [ApplicationVerification] = [
        ApplicationVerification(
            id: "av-1",
            childName: "Destiny Brown",
            applicationDate: daysAgo(3),
            verifiedBy: "Sandra López",
            verifiedDate: nil,
            primaryAdult: AdultVerification(firstName: true, lastName: true, dateOfBirth: true, gender: true, race: true, ethnicity: true, relationship: true, educationLevel: false, employmentStatus: false, address: true, phone: true, email: false),
            secondaryAdult: AdultVerification(),
            childChecklist: ChildDocVerification(firstName: true, lastName: true, dateOfBirth: true, gender: true, race: false, ethnicity: false, primaryLanguage: true, birthCertificate: true, proofOfIncome: false, immunizationRecords: false, physicalExam: false),
            status: .inProgress,
            notes: "Missing proof of income and immunization records. Parent notified via phone 6/6."
        ),
        ApplicationVerification(
            id: "av-2",
            childName: "Eli Nakamura",
            applicationDate: daysAgo(8),
            verifiedBy: "Sandra López",
            verifiedDate: daysAgo(1),
            primaryAdult: AdultVerification(firstName: true, lastName: true, dateOfBirth: true, gender: true, race: true, ethnicity: true, relationship: true, educationLevel: true, employmentStatus: true, address: true, phone: true, email: true),
            secondaryAdult: nil,
            childChecklist: ChildDocVerification(firstName: true, lastName: true, dateOfBirth: true, gender: true, race: true, ethnicity: true, primaryLanguage: true, birthCertificate: true, proofOfIncome: true, immunizationRecords: true, physicalExam: true),
            status: .complete,
            notes: "All documents received and verified. Ready for selection committee."
        ),
        ApplicationVerification(
            id: "av-3",
            childName: "Amara Diallo",
            applicationDate: daysAgo(1),
            verifiedBy: "",
            verifiedDate: nil,
            primaryAdult: AdultVerification(),
            secondaryAdult: nil,
            childChecklist: ChildDocVerification(),
            status: .pending,
            notes: ""
        ),
        ApplicationVerification(
            id: "av-4",
            childName: "Tyler Greene",
            applicationDate: daysAgo(5),
            verifiedBy: "Sandra López",
            verifiedDate: nil,
            primaryAdult: AdultVerification(firstName: true, lastName: true, dateOfBirth: true, gender: true, race: true, ethnicity: true, relationship: true, educationLevel: true, employmentStatus: true, address: false, phone: true, email: true),
            secondaryAdult: AdultVerification(firstName: true, lastName: true, dateOfBirth: false, gender: false, race: false, ethnicity: false, relationship: true, educationLevel: false, employmentStatus: false, address: false, phone: true, email: false),
            childChecklist: ChildDocVerification(firstName: true, lastName: true, dateOfBirth: true, gender: true, race: true, ethnicity: true, primaryLanguage: true, birthCertificate: false, proofOfIncome: false, immunizationRecords: true, physicalExam: false),
            status: .needsInfo,
            notes: "Missing birth certificate and proof of income. Second adult DOB/address needed."
        )
    ]

    // MARK: - Nutrition Forms

    static let nutritionPreferenceForms: [NutritionalPreferenceForm] = [
        NutritionalPreferenceForm(
            id: "np-1", childId: "child-1",
            childName: "Sofia Johnson", classroom: "Room 2A",
            completedDate: daysAgo(30), parentName: "Maria Johnson",
            preferences: [
                FoodPreferenceEntry(id: "f1", foodGroup: "Fruits", item: "Apples", preference: .likes),
                FoodPreferenceEntry(id: "f2", foodGroup: "Fruits", item: "Bananas", preference: .likes),
                FoodPreferenceEntry(id: "f3", foodGroup: "Fruits", item: "Oranges", preference: .dislikes),
                FoodPreferenceEntry(id: "f4", foodGroup: "Vegetables", item: "Broccoli", preference: .dislikes),
                FoodPreferenceEntry(id: "f5", foodGroup: "Vegetables", item: "Carrots", preference: .likes),
                FoodPreferenceEntry(id: "f6", foodGroup: "Proteins", item: "Chicken", preference: .likes),
                FoodPreferenceEntry(id: "f7", foodGroup: "Proteins", item: "Peanut Butter", preference: .allergy),
                FoodPreferenceEntry(id: "f8", foodGroup: "Grains", item: "Rice", preference: .likes),
                FoodPreferenceEntry(id: "f9", foodGroup: "Dairy", item: "Milk", preference: .likes)
            ],
            notes: "ALLERGY: Peanuts — EpiPen on file. Avoid all peanut products."
        ),
        NutritionalPreferenceForm(
            id: "np-2", childId: "child-3",
            childName: "Emma Rodriguez", classroom: "Room 2B",
            completedDate: daysAgo(25), parentName: "Ana Rodriguez",
            preferences: [
                FoodPreferenceEntry(id: "f10", foodGroup: "Fruits", item: "Apples", preference: .likes),
                FoodPreferenceEntry(id: "f11", foodGroup: "Fruits", item: "Strawberries", preference: .likes),
                FoodPreferenceEntry(id: "f12", foodGroup: "Dairy", item: "Milk", preference: .allergy),
                FoodPreferenceEntry(id: "f13", foodGroup: "Dairy", item: "Cheese", preference: .allergy),
                FoodPreferenceEntry(id: "f14", foodGroup: "Dairy", item: "Yogurt", preference: .allergy),
                FoodPreferenceEntry(id: "f15", foodGroup: "Proteins", item: "Beans", preference: .likes),
                FoodPreferenceEntry(id: "f16", foodGroup: "Vegetables", item: "Corn", preference: .likes),
                FoodPreferenceEntry(id: "f17", foodGroup: "Grains", item: "Tortillas", preference: .likes)
            ],
            notes: "Dairy allergy — provide non-dairy alternative (oat milk per parent request)."
        )
    ]

    static let infantFormulaForms: [CACFPInfantFormulaForm] = [
        CACFPInfantFormulaForm(
            id: "if-1", childId: "child-infant-1",
            childName: "Baby Torres", classroom: "Infant Room",
            completedDate: daysAgo(14), parentName: "Carmen Torres",
            formulaBrand: "Enfamil",
            formulaType: "Gentlease (Sensitive)",
            preparationInstructions: "Mix 1 scoop of powder with 2 oz of warm (not hot) water. Shake well. Discard unused formula after 1 hour at room temperature.",
            feedingSchedule: "Every 3 hours — approximately 4 oz per feeding. Last feeding no later than 3:30pm for pickup at 4pm.",
            notes: "Baby has reflux — keep upright for 20 minutes after feeding."
        )
    ]

    static let medicalStatements: [MedicalStatementCACFP] = [
        MedicalStatementCACFP(
            id: "ms-1", childId: "child-3",
            childName: "Emma Rodriguez", classroom: "Room 2B",
            physicianName: "Dr. Sarah Kim",
            physicianPhone: "(323) 555-7890",
            diagnosis: "Lactose Intolerance / Dairy Allergy",
            foodsToAvoid: ["Milk", "Cheese", "Yogurt", "Butter", "Cream", "Ice Cream"],
            substitutions: "Substitute with oat milk (unsweetened, fortified) for all dairy servings. Ensure nutrition equivalency per CACFP requirements.",
            signedDate: daysAgo(28),
            notes: "Parent provided physician note. Copy on file in Emma's health folder."
        )
    ]

    // MARK: - Family Engagement Events

    static let events: [FamilyEngagementEvent] = [
        FamilyEngagementEvent(
            id: "ev-1",
            title: "End of Year Family Night",
            eventType: .familyNight,
            plannedDate: daysFromNow(21),
            actualDate: nil,
            location: "Program Cafeteria & Gym",
            createdBy: "Rosa Martinez",
            objectives: [
                "Celebrate children's progress and accomplishments",
                "Share developmental milestone information with families",
                "Connect families with summer learning resources"
            ],
            preEventChecklist: [
                EventChecklistItem(id: "ec1", title: "Reserve cafeteria and gym", isComplete: true, notes: "Confirmed with director"),
                EventChecklistItem(id: "ec2", title: "Send invitations to all families", isComplete: true, notes: "Flyers sent home 5/28"),
                EventChecklistItem(id: "ec3", title: "Order food / refreshments", isComplete: false, notes: ""),
                EventChecklistItem(id: "ec4", title: "Prepare children's portfolio displays", isComplete: false, notes: ""),
                EventChecklistItem(id: "ec5", title: "Arrange childcare for younger siblings", isComplete: false, notes: ""),
                EventChecklistItem(id: "ec6", title: "Confirm RSVP count", isComplete: false, notes: ""),
                EventChecklistItem(id: "ec7", title: "Prepare summer resource packets", isComplete: true, notes: "")
            ],
            dayOfChecklist: [
                EventChecklistItem(id: "ec8", title: "Set up room", isComplete: false, notes: ""),
                EventChecklistItem(id: "ec9", title: "Sign-in sheet ready", isComplete: false, notes: ""),
                EventChecklistItem(id: "ec10", title: "Childcare area set up", isComplete: false, notes: ""),
                EventChecklistItem(id: "ec11", title: "Food / refreshments set up", isComplete: false, notes: "")
            ],
            postEventChecklist: [
                EventChecklistItem(id: "ec12", title: "Record attendance count", isComplete: false, notes: ""),
                EventChecklistItem(id: "ec13", title: "Document event in Sprout", isComplete: false, notes: ""),
                EventChecklistItem(id: "ec14", title: "Collect feedback forms", isComplete: false, notes: "")
            ],
            expectedAttendance: 45,
            actualAttendance: nil,
            notes: "",
            status: .planning
        ),
        FamilyEngagementEvent(
            id: "ev-2",
            title: "SMART Goals Parent Workshop",
            eventType: .workshop,
            plannedDate: daysFromNow(7),
            actualDate: nil,
            location: "Conference Room B",
            createdBy: "David Okafor",
            objectives: [
                "Help families understand SMART goal framework",
                "Complete or update Family Partnership Agreements",
                "Connect families with community resources"
            ],
            preEventChecklist: [
                EventChecklistItem(id: "ew1", title: "Book conference room", isComplete: true, notes: ""),
                EventChecklistItem(id: "ew2", title: "Send invitations to families with open FPAs", isComplete: true, notes: "5 families invited"),
                EventChecklistItem(id: "ew3", title: "Prepare SMART goals workbooks", isComplete: true, notes: ""),
                EventChecklistItem(id: "ew4", title: "Confirm facilitator", isComplete: true, notes: "David presenting"),
                EventChecklistItem(id: "ew5", title: "Prepare community resource binders", isComplete: false, notes: ""),
                EventChecklistItem(id: "ew6", title: "Confirm RSVPs", isComplete: false, notes: "3 confirmed so far")
            ],
            dayOfChecklist: [
                EventChecklistItem(id: "ew7", title: "Set up room with tables and chairs", isComplete: false, notes: ""),
                EventChecklistItem(id: "ew8", title: "Sign-in sheet ready", isComplete: false, notes: ""),
                EventChecklistItem(id: "ew9", title: "Workbooks distributed", isComplete: false, notes: "")
            ],
            postEventChecklist: [
                EventChecklistItem(id: "ew10", title: "Record attendance", isComplete: false, notes: ""),
                EventChecklistItem(id: "ew11", title: "Document completed FPAs", isComplete: false, notes: ""),
                EventChecklistItem(id: "ew12", title: "Follow up with families who didn't attend", isComplete: false, notes: "")
            ],
            expectedAttendance: 12,
            actualAttendance: nil,
            notes: "Bilingual (Spanish) materials needed — Ana Rodriguez has requested Spanish workbook.",
            status: .ready
        ),
        FamilyEngagementEvent(
            id: "ev-3",
            title: "Spring Health Fair",
            eventType: .healthFair,
            plannedDate: daysAgo(30),
            actualDate: daysAgo(30),
            location: "Program Parking Lot",
            createdBy: "Dr. Priya Nair",
            objectives: [
                "Connect families with health and dental resources",
                "Provide free vision and hearing screenings",
                "Distribute health education materials"
            ],
            preEventChecklist: [
                EventChecklistItem(id: "eh1", title: "Coordinate with community health partners", isComplete: true, notes: "3 organizations confirmed"),
                EventChecklistItem(id: "eh2", title: "Send invitations to all families", isComplete: true, notes: ""),
                EventChecklistItem(id: "eh3", title: "Reserve parking lot space", isComplete: true, notes: ""),
                EventChecklistItem(id: "eh4", title: "Order health materials and giveaways", isComplete: true, notes: ""),
                EventChecklistItem(id: "eh5", title: "Arrange tables and canopy tents", isComplete: true, notes: ""),
                EventChecklistItem(id: "eh6", title: "Confirm RSVP count", isComplete: true, notes: "28 confirmed")
            ],
            dayOfChecklist: [
                EventChecklistItem(id: "eh7", title: "Set up booths", isComplete: true, notes: ""),
                EventChecklistItem(id: "eh8", title: "Sign-in sheet ready", isComplete: true, notes: ""),
                EventChecklistItem(id: "eh9", title: "Screening stations set up", isComplete: true, notes: "")
            ],
            postEventChecklist: [
                EventChecklistItem(id: "eh10", title: "Record attendance (38 families attended)", isComplete: true, notes: ""),
                EventChecklistItem(id: "eh11", title: "Document event in Sprout", isComplete: true, notes: ""),
                EventChecklistItem(id: "eh12", title: "Follow up with families needing dental referrals (6 families)", isComplete: false, notes: "In progress")
            ],
            expectedAttendance: 30,
            actualAttendance: 38,
            notes: "Huge success — 38 families attended, exceeded expectations. 6 families received dental referrals.",
            status: .completed
        )
    ]

    // MARK: - Conversations (Messaging)

    static let conversations: [Conversation] = [
        Conversation(
            id: "conv-1",
            familyName: "Johnson Family",
            childName: "Sofia Johnson",
            participantNames: ["Maria Johnson", "Rosa Martinez"],
            lastMessage: "Thank you for the GED resource list! I'll start looking into East LA College.",
            lastMessageDate: daysAgo(1),
            unreadCount: 0,
            isActive: true
        ),
        Conversation(
            id: "conv-2",
            familyName: "Williams Family",
            childName: "Marcus Williams",
            participantNames: ["Keisha Williams", "David Okafor"],
            lastMessage: "I understand. I'll try to find someone to help with drop off on Tuesdays.",
            lastMessageDate: daysAgo(2),
            unreadCount: 2,
            isActive: true
        ),
        Conversation(
            id: "conv-3",
            familyName: "Rodriguez Family",
            childName: "Emma Rodriguez",
            participantNames: ["Ana Rodriguez", "Rosa Martinez"],
            lastMessage: "Emma did great with potty training today! Only one accident all morning 🎉",
            lastMessageDate: daysAgo(3),
            unreadCount: 1,
            isActive: true
        ),
        Conversation(
            id: "conv-4",
            familyName: "Chen Family",
            childName: "Jason Chen",
            participantNames: ["Linda Chen", "David Okafor"],
            lastMessage: "We will try to get Jason here on Monday. His grandma can help.",
            lastMessageDate: daysAgo(5),
            unreadCount: 0,
            isActive: true
        )
    ]

    static let messages: [String: [Message]] = [
        "conv-1": [
            Message(id: "m1", conversationId: "conv-1", senderId: "staff-1", senderName: "Rosa Martinez",
                    senderRole: .staff, body: "Hi Maria! I wanted to share some GED program resources with you. East LA College has a great program that fits your schedule.",
                    sentAt: daysAgo(3), isRead: true),
            Message(id: "m2", conversationId: "conv-1", senderId: "family-1", senderName: "Maria Johnson",
                    senderRole: .family, body: "Oh wow, thank you so much! What are the hours for that program?",
                    sentAt: daysAgo(2), isRead: true),
            Message(id: "m3", conversationId: "conv-1", senderId: "staff-1", senderName: "Rosa Martinez",
                    senderRole: .staff, body: "They have evening classes Mon-Thurs 6pm-9pm and Saturday mornings 9am-12pm. Perfect for parents!",
                    sentAt: daysAgo(2), isRead: true),
            Message(id: "m4", conversationId: "conv-1", senderId: "family-1", senderName: "Maria Johnson",
                    senderRole: .family, body: "Thank you for the GED resource list! I'll start looking into East LA College.",
                    sentAt: daysAgo(1), isRead: true)
        ],
        "conv-2": [
            Message(id: "m5", conversationId: "conv-2", senderId: "staff-2", senderName: "David Okafor",
                    senderRole: .staff, body: "Hi Keisha, I wanted to check in about Marcus's attendance. We've noticed he's been absent several times this month. Is everything okay?",
                    sentAt: daysAgo(4), isRead: true),
            Message(id: "m6", conversationId: "conv-2", senderId: "family-2", senderName: "Keisha Williams",
                    senderRole: .family, body: "I'm sorry, we've been having trouble getting there on Tuesdays and Thursdays. My work starts early those days.",
                    sentAt: daysAgo(3), isRead: true),
            Message(id: "m7", conversationId: "conv-2", senderId: "staff-2", senderName: "David Okafor",
                    senderRole: .staff, body: "I completely understand. Let's see if we can find a carpool option near your home. I'll reach out to some other families in your area.",
                    sentAt: daysAgo(3), isRead: true),
            Message(id: "m8", conversationId: "conv-2", senderId: "family-2", senderName: "Keisha Williams",
                    senderRole: .family, body: "I understand. I'll try to find someone to help with drop off on Tuesdays.",
                    sentAt: daysAgo(2), isRead: false),
            Message(id: "m9", conversationId: "conv-2", senderId: "family-2", senderName: "Keisha Williams",
                    senderRole: .family, body: "My neighbor might be able to help. Can you send me the school address again?",
                    sentAt: daysAgo(2), isRead: false)
        ]
    ]

    // MARK: - Case Notes

    static func caseNotes(for familyId: String) -> [CaseNote] {
        switch familyId {
        case "family-1": // Johnson
            return [
                CaseNote(id: "cn-1-1", familyId: familyId,
                         authorId: "staff-1", authorName: "Ms. Rivera",
                         type: .homeVisit, confidentiality: .standard,
                         body: "Completed scheduled home visit with Maria Johnson. Home environment is warm and nurturing. Sofia is engaged with books and toys. Discussed school readiness activities — family is reading 20 min nightly. Reviewed IEP goals; no concerns at this time. Mom expressed interest in the PFCE parent leadership group.",
                         createdAt: weeksAgo(2), followUpRequired: true,
                         followUpDue: daysFromNow(14), followUpCompleted: false),
                CaseNote(id: "cn-1-2", familyId: familyId,
                         authorId: "staff-1", authorName: "Ms. Rivera",
                         type: .phoneCall, confidentiality: .standard,
                         body: "Called to remind family of upcoming dental appointment. Maria confirmed she has transportation. Sofia has been eating well at home — no new allergy concerns. Maria asked about summer program options; sent her the enrollment link via text.",
                         createdAt: weeksAgo(5), followUpRequired: false,
                         followUpDue: nil, followUpCompleted: false),
                CaseNote(id: "cn-1-3", familyId: familyId,
                         authorId: "staff-2", authorName: "Mr. Thompson",
                         type: .officeVisit, confidentiality: .standard,
                         body: "Family came in to complete FPA review. Went over goals from last quarter — GED enrollment goal is on track, Maria starts classes next month. Discussed child development milestones; Sofia is meeting all benchmarks. Signed updated FPA.",
                         createdAt: weeksAgo(8), followUpRequired: false,
                         followUpDue: nil, followUpCompleted: false)
            ]

        case "family-2": // Williams
            return [
                CaseNote(id: "cn-2-1", familyId: familyId,
                         authorId: "staff-1", authorName: "Ms. Rivera",
                         type: .homeVisit, confidentiality: .sensitive,
                         body: "Home visit conducted. Observed some tension in the household. Keisha mentioned financial stress related to a recent job loss. Home is clean and safe. Marcus appeared happy and engaged. Discussed available community resources — provided info on emergency rental assistance and food pantry. Will follow up in two weeks.",
                         createdAt: weeksAgo(1), followUpRequired: true,
                         followUpDue: daysFromNow(7), followUpCompleted: false),
                CaseNote(id: "cn-2-2", familyId: familyId,
                         authorId: "staff-1", authorName: "Ms. Rivera",
                         type: .phoneCall, confidentiality: .standard,
                         body: "Called to address attendance concern — Marcus has missed 4 days this month. Keisha explained transportation issues since car broke down. Discussed district bus route options and carpool with another family (Johnson). Attendance plan in place.",
                         createdAt: weeksAgo(3), followUpRequired: false,
                         followUpDue: nil, followUpCompleted: false)
            ]

        case "family-3": // Rodriguez
            return [
                CaseNote(id: "cn-3-1", familyId: familyId,
                         authorId: "staff-2", authorName: "Mr. Thompson",
                         type: .homeVisit, confidentiality: .standard,
                         body: "First home visit of the year. Met with Ana and her husband Carlos. Emma Rodriguez is thriving — verbal, curious, loves puzzles. Home language is Spanish; family is bilingual. Reviewed dual-language learning resources. Emma's dairy allergy management at home is excellent — family has adapted recipes well.",
                         createdAt: weeksAgo(3), followUpRequired: false,
                         followUpDue: nil, followUpCompleted: false),
                CaseNote(id: "cn-3-2", familyId: familyId,
                         authorId: "staff-1", authorName: "Ms. Rivera",
                         type: .incident, confidentiality: .sensitive,
                         body: "Emma had an allergic reaction at school during snack time. A substitute was unaware of the dairy allergy restriction. EpiPen was not needed — reaction was mild (hives on arms). Parents notified immediately. Incident report filed. Review of allergy protocol with all subs is scheduled. Parent meeting set for Thursday.",
                         createdAt: weeksAgo(6), followUpRequired: true,
                         followUpDue: daysFromNow(-1), followUpCompleted: true)
            ]

        case "family-4": // Chen
            return [
                CaseNote(id: "cn-4-1", familyId: familyId,
                         authorId: "staff-1", authorName: "Ms. Rivera",
                         type: .homeVisit, confidentiality: .standard,
                         body: "Home visit with Wei Chen. Father David Chen also present — appreciated his involvement. Jason has been struggling with morning routines; family reports he resists getting ready. Discussed visual schedule strategies; provided printed routine chart. Language note: family prefers English but Wei is more comfortable in Mandarin for emotional topics — interpreter available on request.",
                         createdAt: weeksAgo(2), followUpRequired: true,
                         followUpDue: daysFromNow(21), followUpCompleted: false),
                CaseNote(id: "cn-4-2", familyId: familyId,
                         authorId: "staff-3", authorName: "Dr. Patel",
                         type: .general, confidentiality: .sensitive,
                         body: "Developmental screening flagged possible speech delay. Referred to county early intervention program. Parent consent obtained. Evaluation appointment scheduled for next month. Shared resources on supporting language development at home in bilingual households.",
                         createdAt: weeksAgo(4), followUpRequired: true,
                         followUpDue: daysFromNow(30), followUpCompleted: false)
            ]

        case "family-5": // Thompson
            return [
                CaseNote(id: "cn-5-1", familyId: familyId,
                         authorId: "staff-2", authorName: "Mr. Thompson",
                         type: .phoneCall, confidentiality: .standard,
                         body: "Welcome call to new family. Destiny Thompson was warm and engaged. Discussed program expectations, pickup/dropoff procedures, and the family portal app. She has two older children and is very familiar with Head Start. Asked about volunteering opportunities — pointed her to the Policy Council.",
                         createdAt: weeksAgo(1), followUpRequired: false,
                         followUpDue: nil, followUpCompleted: false)
            ]

        default:
            return []
        }
    }
    // MARK: - Timesheets

    static func hoursAgo(_ h: Double) -> Date {
        Date().addingTimeInterval(-h * 3600)
    }

    static func todayAt(_ hour: Int, _ minute: Int = 0) -> Date {
        Calendar.current.date(
            bySettingHour: hour, minute: minute, second: 0, of: Date()
        ) ?? Date()
    }

    static func dateAt(_ daysAgo: Int, hour: Int, minute: Int = 0) -> Date {
        let base = Calendar.current.date(byAdding: .day, value: -daysAgo, to: Date()) ?? Date()
        return Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: base) ?? base
    }

    // Active entry for the currently signed-in staff member (Ms. Rivera)
    static var activeTimeEntry: TimeEntry? {
        TimeEntry(
            id: "te-active-1",
            staffId: "staff-1",
            staffName: "Ms. Rivera",
            clockIn: todayAt(8, 02),
            clockOut: nil,
            breaks: [
                ShiftBreak(id: "brk-1", startTime: todayAt(10, 30), endTime: todayAt(10, 45))
            ],
            status: .active,
            adminNote: nil
        )
    }

    static let timesheetWeeks: [TimesheetWeek] = [
        // Ms. Rivera — current week (active today)
        TimesheetWeek(
            id: "tw-1", staffId: "staff-1", staffName: "Ms. Rivera",
            weekStart: dateAt(6, hour: 0),
            entries: [
                TimeEntry(id: "te-1-1", staffId: "staff-1", staffName: "Ms. Rivera",
                          clockIn: dateAt(6, hour: 8, minute: 0),
                          clockOut: dateAt(6, hour: 16, minute: 5),
                          breaks: [ShiftBreak(id: "b1", startTime: dateAt(6, hour: 12), endTime: dateAt(6, hour: 12, minute: 30))],
                          status: .approved, adminNote: nil),
                TimeEntry(id: "te-1-2", staffId: "staff-1", staffName: "Ms. Rivera",
                          clockIn: dateAt(5, hour: 7, minute: 58),
                          clockOut: dateAt(5, hour: 16, minute: 10),
                          breaks: [ShiftBreak(id: "b2", startTime: dateAt(5, hour: 12), endTime: dateAt(5, hour: 12, minute: 30))],
                          status: .approved, adminNote: nil),
                TimeEntry(id: "te-1-3", staffId: "staff-1", staffName: "Ms. Rivera",
                          clockIn: dateAt(4, hour: 8, minute: 5),
                          clockOut: dateAt(4, hour: 16, minute: 0),
                          breaks: [ShiftBreak(id: "b3", startTime: dateAt(4, hour: 12), endTime: dateAt(4, hour: 12, minute: 30))],
                          status: .approved, adminNote: nil),
                TimeEntry(id: "te-1-4", staffId: "staff-1", staffName: "Ms. Rivera",
                          clockIn: dateAt(3, hour: 8, minute: 0),
                          clockOut: dateAt(3, hour: 16, minute: 3),
                          breaks: [ShiftBreak(id: "b4", startTime: dateAt(3, hour: 12), endTime: dateAt(3, hour: 12, minute: 30))],
                          status: .pending, adminNote: nil),
                TimeEntry(id: "te-1-5", staffId: "staff-1", staffName: "Ms. Rivera",
                          clockIn: dateAt(2, hour: 8, minute: 12),
                          clockOut: dateAt(2, hour: 16, minute: 8),
                          breaks: [ShiftBreak(id: "b5", startTime: dateAt(2, hour: 12), endTime: dateAt(2, hour: 12, minute: 30))],
                          status: .pending, adminNote: nil),
            ]
        ),
        // Mr. Thompson — missed clock-out yesterday
        TimesheetWeek(
            id: "tw-2", staffId: "staff-2", staffName: "Mr. Thompson",
            weekStart: dateAt(6, hour: 0),
            entries: [
                TimeEntry(id: "te-2-1", staffId: "staff-2", staffName: "Mr. Thompson",
                          clockIn: dateAt(6, hour: 8, minute: 15),
                          clockOut: dateAt(6, hour: 16, minute: 0),
                          breaks: [ShiftBreak(id: "b6", startTime: dateAt(6, hour: 12), endTime: dateAt(6, hour: 12, minute: 30))],
                          status: .approved, adminNote: nil),
                TimeEntry(id: "te-2-2", staffId: "staff-2", staffName: "Mr. Thompson",
                          clockIn: dateAt(5, hour: 8, minute: 0),
                          clockOut: dateAt(5, hour: 16, minute: 0),
                          breaks: [],
                          status: .approved, adminNote: nil),
                TimeEntry(id: "te-2-3", staffId: "staff-2", staffName: "Mr. Thompson",
                          clockIn: dateAt(4, hour: 8, minute: 0),
                          clockOut: dateAt(4, hour: 16, minute: 0),
                          breaks: [ShiftBreak(id: "b7", startTime: dateAt(4, hour: 12), endTime: dateAt(4, hour: 12, minute: 30))],
                          status: .approved, adminNote: nil),
                TimeEntry(id: "te-2-4", staffId: "staff-2", staffName: "Mr. Thompson",
                          clockIn: dateAt(3, hour: 8, minute: 5),
                          clockOut: dateAt(3, hour: 16, minute: 0),
                          breaks: [],
                          status: .approved, adminNote: nil),
                TimeEntry(id: "te-2-5", staffId: "staff-2", staffName: "Mr. Thompson",
                          clockIn: dateAt(2, hour: 8, minute: 0),
                          clockOut: nil,
                          breaks: [],
                          status: .missedOut,
                          adminNote: "Staff did not clock out. Estimated 8hr shift applied."),
            ]
        ),
        // Dr. Patel — flagged overtime
        TimesheetWeek(
            id: "tw-3", staffId: "staff-3", staffName: "Dr. Patel",
            weekStart: dateAt(6, hour: 0),
            entries: [
                TimeEntry(id: "te-3-1", staffId: "staff-3", staffName: "Dr. Patel",
                          clockIn: dateAt(6, hour: 7, minute: 30),
                          clockOut: dateAt(6, hour: 18, minute: 0),
                          breaks: [ShiftBreak(id: "b8", startTime: dateAt(6, hour: 12), endTime: dateAt(6, hour: 12, minute: 30))],
                          status: .approved, adminNote: nil),
                TimeEntry(id: "te-3-2", staffId: "staff-3", staffName: "Dr. Patel",
                          clockIn: dateAt(5, hour: 7, minute: 45),
                          clockOut: dateAt(5, hour: 17, minute: 30),
                          breaks: [ShiftBreak(id: "b9", startTime: dateAt(5, hour: 12), endTime: dateAt(5, hour: 12, minute: 30))],
                          status: .approved, adminNote: nil),
                TimeEntry(id: "te-3-3", staffId: "staff-3", staffName: "Dr. Patel",
                          clockIn: dateAt(4, hour: 7, minute: 30),
                          clockOut: dateAt(4, hour: 18, minute: 15),
                          breaks: [],
                          status: .flagged,
                          adminNote: "10.75 hr shift — please confirm no break taken."),
                TimeEntry(id: "te-3-4", staffId: "staff-3", staffName: "Dr. Patel",
                          clockIn: dateAt(3, hour: 7, minute: 50),
                          clockOut: dateAt(3, hour: 17, minute: 45),
                          breaks: [ShiftBreak(id: "b10", startTime: dateAt(3, hour: 12), endTime: dateAt(3, hour: 12, minute: 30))],
                          status: .pending, adminNote: nil),
                TimeEntry(id: "te-3-5", staffId: "staff-3", staffName: "Dr. Patel",
                          clockIn: dateAt(2, hour: 8, minute: 0),
                          clockOut: dateAt(2, hour: 17, minute: 0),
                          breaks: [ShiftBreak(id: "b11", startTime: dateAt(2, hour: 12), endTime: dateAt(2, hour: 12, minute: 30))],
                          status: .pending, adminNote: nil),
            ]
        )
    ]

    // MARK: - Chronic Absence Alerts

    static func chronicAbsenceAlerts() -> [ChronicAbsenceAlert] {
        let cal = Calendar.current
        let today = Date()
        func daysAgo(_ n: Int) -> Date { cal.date(byAdding: .day, value: -n, to: today)! }

        return [
            // Severe — 51% attendance
            ChronicAbsenceAlert(
                childId: "child-att-1", childName: "Jason Chen", familyId: "family-3",
                classroom: "Room A", familyAdvocate: "Maria Garcia",
                totalDaysEnrolled: 90, totalDaysPresent: 46, totalDaysAbsent: 44,
                unexcusedAbsences: 28, excusedAbsences: 16,
                weeklyRates: [0.40, 0.60, 0.50, 0.60],
                hasAIP: true, lastOutreachDate: daysAgo(7), consecutiveAbsences: 3,
                notes: "Family experiencing transportation issues. AIP in place."
            ),
            // High — 72%
            ChronicAbsenceAlert(
                childId: "child-att-2", childName: "Marcus Williams", familyId: "family-2",
                classroom: "Room B", familyAdvocate: "James Wilson",
                totalDaysEnrolled: 90, totalDaysPresent: 65, totalDaysAbsent: 25,
                unexcusedAbsences: 12, excusedAbsences: 13,
                weeklyRates: [0.80, 0.60, 0.80, 0.60],
                hasAIP: true, lastOutreachDate: daysAgo(14), consecutiveAbsences: 0,
                notes: "Illness-related absences, family made aware of impact."
            ),
            // At-risk — 81%
            ChronicAbsenceAlert(
                childId: "child-att-3", childName: "Aaliyah Thompson", familyId: "family-4",
                classroom: "Room C", familyAdvocate: "Maria Garcia",
                totalDaysEnrolled: 90, totalDaysPresent: 73, totalDaysAbsent: 17,
                unexcusedAbsences: 9, excusedAbsences: 8,
                weeklyRates: [0.80, 0.80, 1.00, 0.80],
                hasAIP: false, lastOutreachDate: daysAgo(3), consecutiveAbsences: 0,
                notes: ""
            ),
            // Watch — 88%
            ChronicAbsenceAlert(
                childId: "child-att-4", childName: "Priya Patel", familyId: "family-5",
                classroom: "Room A", familyAdvocate: "Dr. Patel",
                totalDaysEnrolled: 90, totalDaysPresent: 79, totalDaysAbsent: 11,
                unexcusedAbsences: 4, excusedAbsences: 7,
                weeklyRates: [0.80, 1.00, 0.80, 1.00],
                hasAIP: false, lastOutreachDate: nil, consecutiveAbsences: 0,
                notes: ""
            ),
        ]
    }

    // MARK: - ERSEA Eligibility

    static func eligibilityRecords() -> [EligibilityRecord] {
        let cal = Calendar.current
        let today = Date()
        func daysAgo(_ n: Int) -> Date { cal.date(byAdding: .day, value: -n, to: today)! }
        func dob(_ years: Int, months: Int = 0) -> Date {
            cal.date(byAdding: .month, value: -(years * 12 + months), to: today)!
        }

        return [
            // 1 — Enrolled, income eligible (68% FPL)
            EligibilityRecord(
                id: "er-1", childName: "Liam Rivera", childDateOfBirth: dob(4, months: 2),
                familyId: "family-1", applicationDate: daysAgo(90),
                householdSize: 4, annualIncome: 21250, incomeSource: "Employment",
                categoricalEligibility: .none,
                priorityScore: 14, riskFactors: [.singleParent, .limitedEnglish],
                status: .enrolled, enrolledDate: daysAgo(60), classroom: "Room A",
                waitlistPosition: nil, notes: "Family engaged, on track."
            ),
            // 2 — Enrolled, categorical (McKinney-Vento homeless)
            EligibilityRecord(
                id: "er-2", childName: "Amara Johnson", childDateOfBirth: dob(3, months: 8),
                familyId: "family-2", applicationDate: daysAgo(75),
                householdSize: 3, annualIncome: 18000, incomeSource: "SNAP + Part-time",
                categoricalEligibility: .homeless,
                priorityScore: 27, riskFactors: [.homeless, .singleParent, .limitedEnglish],
                status: .enrolled, enrolledDate: daysAgo(50), classroom: "Room B",
                waitlistPosition: nil, notes: "Placed in shelter. Transportation arranged."
            ),
            // 3 — Waitlist #1, income eligible (91% FPL)
            EligibilityRecord(
                id: "er-3", childName: "Ethan Morales", childDateOfBirth: dob(4, months: 5),
                familyId: nil, applicationDate: daysAgo(30),
                householdSize: 5, annualIncome: 33200, incomeSource: "Employment",
                categoricalEligibility: .none,
                priorityScore: 21, riskFactors: [.singleParent, .childHasIEP],
                status: .eligible, enrolledDate: nil, classroom: nil,
                waitlistPosition: 1, notes: "Referral from school district, IEP in progress."
            ),
            // 4 — Waitlist #2, IEP categorical
            EligibilityRecord(
                id: "er-4", childName: "Priya Sharma", childDateOfBirth: dob(3, months: 11),
                familyId: nil, applicationDate: daysAgo(22),
                householdSize: 4, annualIncome: 42000, incomeSource: "Employment",
                categoricalEligibility: .iepIfsp,
                priorityScore: 17, riskFactors: [.childHasIEP, .parentWithDisability],
                status: .eligible, enrolledDate: nil, classroom: nil,
                waitlistPosition: 2, notes: "IFSP completed. Family awaiting slot."
            ),
            // 5 — Pending review
            EligibilityRecord(
                id: "er-5", childName: "Jaylen Brooks", childDateOfBirth: dob(4, months: 1),
                familyId: nil, applicationDate: daysAgo(5),
                householdSize: 6, annualIncome: 38000, incomeSource: "Employment + TANF",
                categoricalEligibility: .publicAssistance,
                priorityScore: 13, riskFactors: [.domesticViolence],
                status: .pending, enrolledDate: nil, classroom: nil,
                waitlistPosition: nil, notes: "Application received. DV documentation pending."
            ),
            // 6 — Denied (over income limit, no categorical)
            EligibilityRecord(
                id: "er-6", childName: "Chloe Warren", childDateOfBirth: dob(4, months: 7),
                familyId: nil, applicationDate: daysAgo(14),
                householdSize: 3, annualIncome: 42000, incomeSource: "Employment",
                categoricalEligibility: .none,
                priorityScore: 0, riskFactors: [],
                status: .denied, enrolledDate: nil, classroom: nil,
                waitlistPosition: nil, notes: "Income at 205% FPL. Referred to community pre-K."
            ),
        ]
    }

    static func suspensionLogs() -> [SuspensionExpulsionLog] {
        let cal = Calendar.current
        let today = Date()
        func daysAgo(_ n: Int) -> Date { cal.date(byAdding: .day, value: -n, to: today)! }

        return [
            SuspensionExpulsionLog(
                id: "sl-1", childId: "child-1", childName: "Liam Rivera",
                incidentDate: daysAgo(30), incidentType: .internalReview,
                behaviorDescription: "Repeated hitting during free play. 3 incidents in 1 week.",
                mentalHealthConsultRequested: true, mentalHealthConsultDate: daysAgo(28),
                familyMeetingHeld: true, familyMeetingDate: daysAgo(25),
                behaviourSupportPlanCreated: true, behaviourSupportPlanDate: daysAgo(20),
                stateAgencyNotified: false, stateNotificationDate: nil,
                outcome: .behaviourSupport, resolutionDate: daysAgo(20),
                notes: "Behavior support plan in place. Significant improvement observed."
            ),
            SuspensionExpulsionLog(
                id: "sl-2", childId: "child-3", childName: "Sofia Chen",
                incidentDate: daysAgo(10), incidentType: .suspensionShort,
                behaviorDescription: "Biting incident resulting in injury to peer. Second occurrence.",
                mentalHealthConsultRequested: true, mentalHealthConsultDate: daysAgo(8),
                familyMeetingHeld: true, familyMeetingDate: daysAgo(7),
                behaviourSupportPlanCreated: false, behaviourSupportPlanDate: nil,
                stateAgencyNotified: false, stateNotificationDate: nil,
                outcome: .pending, resolutionDate: nil,
                notes: "MH consultant observed classroom 11/14. BSP drafting in progress."
            ),
        ]
    }

    // MARK: - Health Compliance

    static func healthCompliance() -> [ChildHealthCompliance] {
        let cal = Calendar.current
        let today = Date()
        func daysAgo(_ n: Int) -> Date { cal.date(byAdding: .day, value: -n, to: today)! }
        func dob(_ years: Int) -> Date { cal.date(byAdding: .year, value: -years, to: today)! }

        return [
            // Child 1 — overdue on both health & dental
            ChildHealthCompliance(
                childId: "child-1", childName: "Liam Rivera", familyId: "family-1",
                enrollmentDate: daysAgo(60), dateOfBirth: dob(4),
                healthScreeningDate: nil,     // 45-day deadline passed
                dentalScreeningDate: nil,     // 90-day still has 30 days
                visionScreeningDate: daysAgo(20),
                hearingScreeningDate: nil,
                developmentalScreeningDate: daysAgo(10)
            ),
            // Child 2 — health done, dental due in 8 days (critical)
            ChildHealthCompliance(
                childId: "child-2", childName: "Amara Johnson", familyId: "family-2",
                enrollmentDate: daysAgo(82), dateOfBirth: dob(3),
                healthScreeningDate: daysAgo(30),
                dentalScreeningDate: nil,
                visionScreeningDate: daysAgo(30),
                hearingScreeningDate: daysAgo(30),
                developmentalScreeningDate: daysAgo(30)
            ),
            // Child 3 — health due in 5 days (critical), dental on track
            ChildHealthCompliance(
                childId: "child-3", childName: "Sofia Chen", familyId: "family-3",
                enrollmentDate: daysAgo(40), dateOfBirth: dob(4),
                healthScreeningDate: nil,
                dentalScreeningDate: nil,
                visionScreeningDate: nil,
                hearingScreeningDate: nil,
                developmentalScreeningDate: nil
            ),
            // Child 4 — all complete
            ChildHealthCompliance(
                childId: "child-4", childName: "Marcus Thompson", familyId: "family-2",
                enrollmentDate: daysAgo(120), dateOfBirth: dob(5),
                healthScreeningDate: daysAgo(100),
                dentalScreeningDate: daysAgo(60),
                visionScreeningDate: daysAgo(100),
                hearingScreeningDate: daysAgo(100),
                developmentalScreeningDate: daysAgo(90)
            ),
            // Child 5 — new enrollment, both on track
            ChildHealthCompliance(
                childId: "child-5", childName: "Zara Williams", familyId: "family-4",
                enrollmentDate: daysAgo(10), dateOfBirth: dob(3),
                healthScreeningDate: nil,
                dentalScreeningDate: nil,
                visionScreeningDate: nil,
                hearingScreeningDate: nil,
                developmentalScreeningDate: nil
            ),
            // Child 6 — health due in 12 days (warning)
            ChildHealthCompliance(
                childId: "child-6", childName: "Kai Nguyen", familyId: "family-5",
                enrollmentDate: daysAgo(33), dateOfBirth: dob(4),
                healthScreeningDate: nil,
                dentalScreeningDate: nil,
                visionScreeningDate: nil,
                hearingScreeningDate: nil,
                developmentalScreeningDate: nil
            ),
        ]
    }

    // MARK: - Safety Drills

    static func safetyDrills() -> [SafetyDrillLog] {
        let cal = Calendar.current
        let today = Date()
        func daysAgo(_ n: Int) -> Date { cal.date(byAdding: .day, value: -n, to: today)! }

        return [
            SafetyDrillLog(id: "drill-1", drillType: .fireEvacuation,
                           drillDate: daysAgo(45), conductedBy: "Maria Garcia",
                           durationMinutes: 4, participantCount: 62,
                           notes: "All classrooms evacuated within 4 minutes. Children calm.", issuesFound: "",
                           resolvedDate: nil),
            SafetyDrillLog(id: "drill-2", drillType: .lockdown,
                           drillDate: daysAgo(30), conductedBy: "James Wilson",
                           durationMinutes: 6, participantCount: 58,
                           notes: "Practiced lockdown with local PD coordination.",
                           issuesFound: "One classroom door lock was slow — maintenance notified.",
                           resolvedDate: daysAgo(25)),
            SafetyDrillLog(id: "drill-3", drillType: .fireEvacuation,
                           drillDate: daysAgo(120), conductedBy: "Maria Garcia",
                           durationMinutes: 5, participantCount: 60,
                           notes: "Quarterly fire drill. Used alternate exit route.", issuesFound: "",
                           resolvedDate: nil),
            SafetyDrillLog(id: "drill-4", drillType: .tornadoShelter,
                           drillDate: daysAgo(15), conductedBy: "Dr. Patel",
                           durationMinutes: 3, participantCount: 65,
                           notes: "All children to interior hallway. Excellent response time.", issuesFound: "",
                           resolvedDate: nil),
        ]
    }

    // MARK: - Mental Health Consults

    static func mentalHealthConsults() -> [MentalHealthConsult] {
        let cal = Calendar.current
        let today = Date()
        func daysAgo(_ n: Int) -> Date { cal.date(byAdding: .day, value: -n, to: today)! }

        return [
            MentalHealthConsult(
                id: "mhc-1", childId: "child-1", childName: "Liam Rivera",
                consultDate: daysAgo(20), consultantName: "Dr. Sarah Okafor",
                consultType: .behaviorSupport,
                summary: "Discussed strategies for transition difficulties. Implemented visual schedule and 5-minute warnings.",
                followUpDate: daysAgo(6), followUpNotes: "Significant improvement noted. Continue current strategies."
            ),
            MentalHealthConsult(
                id: "mhc-2", childId: nil, childName: nil,
                consultDate: daysAgo(45), consultantName: "Dr. Sarah Okafor",
                consultType: .staffCoaching,
                summary: "Program-wide trauma-informed care training. All classrooms attended.",
                followUpDate: nil, followUpNotes: ""
            ),
            MentalHealthConsult(
                id: "mhc-3", childId: "child-3", childName: "Sofia Chen",
                consultDate: daysAgo(10), consultantName: "Dr. Sarah Okafor",
                consultType: .familySupport,
                summary: "Met with parent to discuss separation anxiety. Provided home routine strategies.",
                followUpDate: cal.date(byAdding: .day, value: 14, to: today),
                followUpNotes: ""
            ),
            MentalHealthConsult(
                id: "mhc-4", childId: nil, childName: nil,
                consultDate: daysAgo(5), consultantName: "Dr. Sarah Okafor",
                consultType: .classroomStrategy,
                summary: "Reviewed Room 3 classroom management. Introduced calm-down corner and emotion cards.",
                followUpDate: cal.date(byAdding: .day, value: 7, to: today),
                followUpNotes: ""
            ),
        ]
    }

    // MARK: - Staff
    static func staff() -> [StaffMember] {
        [
            StaffMember(id:"s1", fullName:"Dr. Patricia Hayes",    role:"Program Director",     roleKey:"director",          email:"p.hayes@sprout.org",  phone:"(555) 200-1001", trainingHours:24, classroom:nil),
            StaffMember(id:"s2", fullName:"Ms. Carmen Rivera",     role:"Lead Teacher",          roleKey:"teacher",           email:"c.rivera@sprout.org", phone:"(555) 200-1002", trainingHours:18, classroom:"Room 1A"),
            StaffMember(id:"s3", fullName:"Mr. James Carter",      role:"Lead Teacher",          roleKey:"teacher",           email:"j.carter@sprout.org", phone:"(555) 200-1003", trainingHours:12, classroom:"Room 2B"),
            StaffMember(id:"s4", fullName:"Ms. Destiny Moore",     role:"Teacher Assistant",     roleKey:"assistant",         email:"d.moore@sprout.org",  phone:"(555) 200-1004", trainingHours:8,  classroom:"Room 1A"),
            StaffMember(id:"s5", fullName:"Mr. Tyrell Washington", role:"Teacher Assistant",     roleKey:"assistant",         email:"t.wash@sprout.org",   phone:"(555) 200-1005", trainingHours:5,  classroom:"Room 2B"),
            StaffMember(id:"s6", fullName:"Ms. Sandra Thompson",   role:"Family Service Worker", roleKey:"familyWorker",      email:"s.thomp@sprout.org",  phone:"(555) 200-1006", trainingHours:20, classroom:nil),
            StaffMember(id:"s7", fullName:"Ms. Angela Kim",        role:"Family Service Worker", roleKey:"familyWorker",      email:"a.kim@sprout.org",    phone:"(555) 200-1007", trainingHours:16, classroom:nil),
            StaffMember(id:"s8", fullName:"Dr. Marcus Ellis",      role:"Health Coordinator",    roleKey:"healthCoordinator", email:"m.ellis@sprout.org",  phone:"(555) 200-1008", trainingHours:22, classroom:nil),
        ]
    }
}
#endif
