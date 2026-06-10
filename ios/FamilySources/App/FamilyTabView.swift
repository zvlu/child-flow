import SwiftUI

struct FamilyTabView: View {
    var body: some View {
        TabView {
            FamilyHomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }

            FamilyMessagesView()
                .tabItem {
                    Label("Messages", systemImage: "bubble.left.and.bubble.right.fill")
                }

            FamilyProfileView()
                .tabItem {
                    Label("My Profile", systemImage: "person.fill")
                }
        }
        .tint(Color("AccentColor"))
    }
}
