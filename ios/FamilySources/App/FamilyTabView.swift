import SwiftUI

struct FamilyTabView: View {
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        TabView {
            FamilyTodayView()
                .tabItem {
                    Label(L(.tabToday), systemImage: "sparkles")
                }

            FamilyHomeView()
                .tabItem {
                    Label(L(.tabHome), systemImage: "house.fill")
                }

            FamilyMessagesView()
                .tabItem {
                    Label(L(.tabMessages), systemImage: "bubble.left.and.bubble.right.fill")
                }

            FamilyProgressView()
                .tabItem {
                    Label(L(.tabProgress), systemImage: "chart.bar.fill")
                }

            FamilyProfileView()
                .tabItem {
                    Label(L(.tabProfile), systemImage: "person.fill")
                }
        }
        .tint(Color("AccentColor"))
    }
}
