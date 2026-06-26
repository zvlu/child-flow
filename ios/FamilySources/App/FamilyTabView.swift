import SwiftUI

struct FamilyTabView: View {
    var body: some View {
        TabView {
            FamilyTodayView()
                .tabItem {
                    Label("Today", systemImage: "sparkles")
                }

            FamilyHomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }

            FamilyMessagesView()
                .tabItem {
                    Label("Messages", systemImage: "bubble.left.and.bubble.right.fill")
                }

            FamilyProgressView()
                .tabItem {
                    Label("Progress", systemImage: "chart.bar.fill")
                }

            FamilyProfileView()
                .tabItem {
                    Label("My Profile", systemImage: "person.fill")
                }
        }
        .tint(Color("AccentColor"))
    }
}
