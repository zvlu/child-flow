import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Dashboard", systemImage: "chart.bar.fill") }

            ChildrenView()
                .tabItem { Label("Children", systemImage: "person.2.fill") }

            AttendanceView()
                .tabItem { Label("Attendance", systemImage: "checkmark.circle.fill") }

            HealthView()
                .tabItem { Label("Health", systemImage: "heart.fill") }

            MessagingView()
                .tabItem { Label("Messages", systemImage: "message.fill") }
        }
        .tint(Color.cfPrimary)
    }
}

// MARK: - App Menu Sheet (hamburger ≡)

struct AppMenuSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {

                    // Daily Reports / Moments
                    MenuSection(title: "Daily") {
                        ModuleCard(
                            label: "Daily Reports",
                            subtitle: "Log meals, naps & moments",
                            icon: "sparkles",
                            color: .cfPrimary,
                            bgColor: .cfPrimaryLight,
                            destination: AnyView(DailyReportsView())
                        )
                    }

                    // Curriculum & Funding
                    MenuSection(title: "Curriculum & Funding") {
                        ModuleCard(
                            label: "Lesson Planning",
                            subtitle: "Weekly plans by classroom",
                            icon: "book.fill",
                            color: .cfPrimary,
                            bgColor: .cfPrimaryLight,
                            destination: AnyView(LessonPlanningView())
                        )
                        ModuleCard(
                            label: "Assessments",
                            subtitle: "Screenings & developmental records",
                            icon: "checklist",
                            color: .cfChildren,
                            bgColor: .cfChildrenBg,
                            destination: AnyView(AssessmentsView())
                        )
                        ModuleCard(
                            label: "Portfolios",
                            subtitle: "Each child's growth over time",
                            icon: "folder.fill",
                            color: .cfGoals,
                            bgColor: Color(hex: "ECFEFF"),
                            destination: AnyView(PortfoliosView())
                        )
                        ModuleCard(
                            label: "Subsidies",
                            subtitle: "Agency funding & co-pays",
                            icon: "building.columns.fill",
                            color: .cfAccent,
                            bgColor: .cfAccentLight,
                            destination: AnyView(SubsidiesView())
                        )
                    }

                    // Families & Engagement
                    MenuSection(title: "Families") {
                        ModuleCard(
                            label: "Family Services",
                            subtitle: "Records, goals & case notes",
                            icon: "house.fill",
                            color: .cfPrimary,
                            bgColor: .cfPrimaryLight,
                            destination: AnyView(FamilyServicesView())
                        )
                        ModuleCard(
                            label: "Family Events",
                            subtitle: "Plan & track engagement",
                            icon: "person.3.fill",
                            color: .cfGoals,
                            bgColor: Color(hex: "ECFEFF"),
                            destination: AnyView(FamilyEngagementEventView())
                        )
                    }

                    // Communication
                    MenuSection(title: "Communication") {
                        ModuleCard(
                            label: "Program Story",
                            subtitle: "Share photos & updates",
                            icon: "photo.on.rectangle.angled",
                            color: .cfAccent,
                            bgColor: .cfAccentLight,
                            destination: AnyView(ProgramStoryView())
                        )
                        ModuleCard(
                            label: "Documents",
                            subtitle: "Upload & assign files",
                            icon: "folder.fill",
                            color: .cfFamily,
                            bgColor: .cfFamilyBg,
                            destination: AnyView(DocumentsView())
                        )
                    }

                    // Enrollment
                    MenuSection(title: "Enrollment") {
                        ModuleCard(
                            label: "Applications",
                            subtitle: "Review & manage applicants",
                            icon: "doc.badge.plus",
                            color: .cfFamily,
                            bgColor: .cfFamilyBg,
                            destination: AnyView(EnrollmentView())
                        )
                        ModuleCard(
                            label: "Verification",
                            subtitle: "Document checklists",
                            icon: "checkmark.rectangle.fill",
                            color: .cfChildren,
                            bgColor: .cfChildrenBg,
                            destination: AnyView(ApplicationVerificationView())
                        )
                        ModuleCard(
                            label: "Attendance Plans",
                            subtitle: "Chronic absence support",
                            icon: "chart.line.uptrend.xyaxis",
                            color: .cfAttendance,
                            bgColor: .cfAttendanceBg,
                            destination: AnyView(AttendancePlansView())
                        )
                    }

                    // Health & Nutrition
                    MenuSection(title: "Health & Nutrition") {
                        ModuleCard(
                            label: "CACFP & Nutrition Forms",
                            subtitle: "Meal preferences, infant formula, medical statements",
                            icon: "fork.knife",
                            color: .cfAccent,
                            bgColor: .cfAccentLight,
                            destination: AnyView(NutritionFormsView())
                        )
                        ModuleCard(
                            label: "Meal Plans",
                            subtitle: "Weekly menus by classroom",
                            icon: "carrot.fill",
                            color: .cfAccent,
                            bgColor: .cfAccentLight,
                            destination: AnyView(MealsView())
                        )
                    }

                    // My Time
                    MenuSection(title: "My Time") {
                        ModuleCard(
                            label: "My Timesheet",
                            subtitle: "Clock in, breaks & hours",
                            icon: "clock.fill",
                            color: .cfAttendance,
                            bgColor: .cfAttendanceBg,
                            destination: AnyView(ClockInView())
                        )
                        // Reviewing/approving staff hours is admin-only.
                        if appState.isAdmin {
                            ModuleCard(
                                label: "All Timesheets",
                                subtitle: "Review & approve staff hours",
                                icon: "person.text.rectangle.fill",
                                color: .cfChildren,
                                bgColor: .cfChildrenBg,
                                destination: AnyView(TimesheetView())
                            )
                        }
                    }

                    // Program Operations
                    MenuSection(title: "Program") {
                        ModuleCard(
                            label: "Staff",
                            subtitle: "Roles & training hours",
                            icon: "person.badge.key.fill",
                            color: .cfPrimary,
                            bgColor: .cfPrimaryLight,
                            destination: AnyView(StaffView())
                        )
                        ModuleCard(
                            label: "Calendar",
                            subtitle: "Program events & holidays",
                            icon: "calendar",
                            color: .cfChildren,
                            bgColor: .cfChildrenBg,
                            destination: AnyView(CalendarView())
                        )
                        ModuleCard(
                            label: "Compliance",
                            subtitle: "PIR & checklists",
                            icon: "checkmark.seal.fill",
                            color: .cfCompliance,
                            bgColor: .cfComplianceBg,
                            destination: AnyView(ComplianceView())
                        )
                        ModuleCard(
                            label: "Reports",
                            subtitle: "Exports & summaries",
                            icon: "chart.pie.fill",
                            color: .cfCompliance,
                            bgColor: .cfComplianceBg,
                            destination: AnyView(ReportsView())
                        )
                        ModuleCard(
                            label: "Staff Activity",
                            subtitle: "Advocate workload & contacts",
                            icon: "person.2.badge.gearshape.fill",
                            color: .cfPrimary,
                            bgColor: .cfPrimaryLight,
                            destination: AnyView(StaffActivityView())
                        )
                    }

                    // Settings
                    NavigationLink(destination: SettingsView()) {
                        HStack(spacing: 14) {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color(.systemGray5))
                                .frame(width: 40, height: 40)
                                .overlay {
                                    Image(systemName: "gear")
                                        .font(.system(size: 18, weight: .semibold))
                                        .foregroundColor(.cfTextSecondary)
                                }
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Settings")
                                    .font(.cfHeadline)
                                    .foregroundColor(.cfTextPrimary)
                                Text("Program preferences & account")
                                    .font(.cfCaption)
                                    .foregroundColor(.cfTextSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.cfTextSecondary)
                        }
                        .padding(14)
                        .background(Color.cfSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .cfCardShadow()
                        .padding(.horizontal, 16)
                    }

                    Spacer(minLength: 32)
                }
                .padding(.top, 12)
            }
            .background(Color.cfBackground.ignoresSafeArea())
            .navigationTitle("Menu")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
    }
}

// MARK: - Menu Section (used inside AppMenuSheet)

private struct MenuSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.cfCaption2)
                .fontWeight(.semibold)
                .foregroundColor(.cfTextSecondary)
                .padding(.horizontal, 20)

            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible())],
                spacing: 12
            ) {
                content()
            }
            .padding(.horizontal, 16)
        }
    }
}

// MARK: - Module Section (kept for external use)

struct ModuleSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.cfCaption2)
                .fontWeight(.semibold)
                .foregroundColor(.cfTextSecondary)
                .padding(.horizontal, 20)

            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible())],
                spacing: 12
            ) {
                content()
            }
            .padding(.horizontal, 16)
        }
    }
}

// MARK: - Module Card (half-width)

struct ModuleCard: View {
    let label: String
    let subtitle: String
    let icon: String
    let color: Color
    let bgColor: Color
    let destination: AnyView

    var body: some View {
        NavigationLink(destination: destination) {
            VStack(alignment: .leading, spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(color.opacity(0.15))
                        .frame(width: 48, height: 48)
                    Image(systemName: icon)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(color)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(label)
                        .font(.cfSubheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.cfTextPrimary)
                        .lineLimit(2)
                    Text(subtitle)
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                        .lineLimit(2)
                }

                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 130, alignment: .topLeading)
            .background(Color.cfSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(color.opacity(0.12), lineWidth: 1)
            }
            .cfCardShadow()
        }
    }
}

// MARK: - Module Card Wide (full-width)

struct ModuleCardWide: View {
    let label: String
    let subtitle: String
    let icon: String
    let color: Color
    let bgColor: Color
    let destination: AnyView

    var body: some View {
        NavigationLink(destination: destination) {
            HStack(spacing: 16) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(color.opacity(0.15))
                        .frame(width: 56, height: 56)
                    Image(systemName: icon)
                        .font(.system(size: 26, weight: .semibold))
                        .foregroundColor(color)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(label)
                        .font(.cfHeadline)
                        .foregroundColor(.cfTextPrimary)
                    Text(subtitle)
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                        .lineLimit(2)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.cfTextSecondary)
            }
            .padding(16)
            .frame(maxWidth: .infinity)
            .background(Color.cfSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay {
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(color.opacity(0.12), lineWidth: 1)
            }
            .cfCardShadow()
            .padding(.horizontal, 16)
        }
    }
}
