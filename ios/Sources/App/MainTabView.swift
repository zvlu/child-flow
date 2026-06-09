import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar.fill")
                }

            ChildrenView()
                .tabItem {
                    Label("Children", systemImage: "person.2.fill")
                }

            AttendanceView()
                .tabItem {
                    Label("Attendance", systemImage: "checkmark.circle.fill")
                }

            HealthView()
                .tabItem {
                    Label("Health", systemImage: "heart.fill")
                }

            MoreView()
                .tabItem {
                    Label("More", systemImage: "ellipsis.circle.fill")
                }
        }
        .tint(Color("AccentColor"))
    }
}

/// Secondary modules accessible from the "More" tab
struct MoreView: View {
    var body: some View {
        NavigationStack {
            List {
                NavigationLink(destination: FamilyServicesView()) {
                    Label("Family Services", systemImage: "house.fill")
                }
                NavigationLink(destination: StaffView()) {
                    Label("Staff", systemImage: "person.badge.key.fill")
                }
                NavigationLink(destination: EnrollmentView()) {
                    Label("Enrollment", systemImage: "doc.badge.plus")
                }
                NavigationLink(destination: ReportsView()) {
                    Label("Reports", systemImage: "chart.pie.fill")
                }
                NavigationLink(destination: ComplianceView()) {
                    Label("Compliance", systemImage: "checkmark.seal.fill")
                }
                NavigationLink(destination: SettingsView()) {
                    Label("Settings", systemImage: "gear")
                }
            }
            .navigationTitle("More")
        }
    }
}
