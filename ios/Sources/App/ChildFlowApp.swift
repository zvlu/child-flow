import SwiftUI
import UIKit

@main
struct ChildFlowApp: App {
    @StateObject private var appState = AppState()

    init() {
        let teal = UIColor(red: 0.000, green: 0.427, blue: 0.467, alpha: 1)
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        for layout in [appearance.stackedLayoutAppearance,
                       appearance.inlineLayoutAppearance,
                       appearance.compactInlineLayoutAppearance] {
            layout.normal.iconColor = .secondaryLabel
            layout.normal.titleTextAttributes = [.foregroundColor: UIColor.secondaryLabel]
            layout.selected.iconColor = teal
            layout.selected.titleTextAttributes = [.foregroundColor: teal]
        }
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
        UITabBar.appearance().tintColor = teal
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if appState.isAuthenticated {
                    MainTabView()
                } else {
                    LoginView()
                }
            }
            .environmentObject(appState)
        }
    }
}
