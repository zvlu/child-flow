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
                if let familyState = appState.familyState {
                    // Parent account: the same login screen serves every
                    // role, and family accounts land in the family
                    // experience (multilingual, RTL-aware).
                    FamilyExperienceContainer(familyState: familyState)
                } else if appState.isAuthenticated {
                    MainTabView()
                } else {
                    LoginView()
                }
            }
            // Brand: sage green everywhere .accentColor / tint is used (the
            // generated project never set a global accent, so SwiftUI was
            // falling back to system blue).
            .tint(.cfPrimary)
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

/// Hosts the family (parent) experience inside the unified app: applies the
/// family app's language environment and returns to the shared login screen
/// when the family session signs out.
private struct FamilyExperienceContainer: View {
    @EnvironmentObject var appState: AppState
    @ObservedObject var familyState: FamilyAppState
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        FamilyTabView()
            .environmentObject(familyState)
            .environment(\.locale, l10n.locale)
            .environment(\.layoutDirection, l10n.layoutDirection)
            .id(l10n.language)
            .onChange(of: familyState.phase) { _, phase in
                // FamilyAppState.signOut() (and session expiry) return the
                // phase to .onboarding — fall back to the login screen.
                if phase == .onboarding { appState.endFamilySession() }
            }
    }
}
