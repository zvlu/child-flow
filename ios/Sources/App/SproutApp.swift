import SwiftUI
import UIKit

@main
struct SproutApp: App {
    @StateObject private var appState = AppState()
    @UIApplicationDelegateAdaptor(PushAppDelegate.self) private var pushDelegate
    @Environment(\.scenePhase) private var scenePhase

    init() {
        let accent = UIColor(red: 0.310, green: 0.486, blue: 0.365, alpha: 1)
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        for layout in [appearance.stackedLayoutAppearance,
                       appearance.inlineLayoutAppearance,
                       appearance.compactInlineLayoutAppearance] {
            layout.normal.iconColor = .secondaryLabel
            layout.normal.titleTextAttributes = [.foregroundColor: UIColor.secondaryLabel]
            layout.selected.iconColor = accent
            layout.selected.titleTextAttributes = [.foregroundColor: accent]
        }
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
        UITabBar.appearance().tintColor = accent
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
            .onChange(of: appState.isAuthenticated) { _, isAuth in
                if isAuth { requestPushAuthorization() }
            }
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .background: appState.noteBackgrounded()
                case .active: appState.relockIfNeeded()
                default: break
                }
            }
        }
    }
}
