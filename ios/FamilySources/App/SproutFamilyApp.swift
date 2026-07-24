import SwiftUI

@main
struct SproutFamilyApp: App {
    @StateObject private var appState = FamilyAppState()
    @UIApplicationDelegateAdaptor(PushAppDelegate.self) private var pushDelegate

    @StateObject private var l10n = FamilyL10n.shared

    var body: some Scene {
        WindowGroup {
            Group {
                switch appState.phase {
                case .onboarding:
                    FamilyOnboardingView()
                        .environmentObject(appState)
                case .authenticated:
                    FamilyTabView()
                        .environmentObject(appState)
                        .onAppear { requestPushAuthorization() }
                }
            }
            // Brand: sage green everywhere .accentColor / tint is used.
            // (The AccentColor asset exists but the generated project never
            // set ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME, so SwiftUI
            // was falling back to system blue.)
            .tint(.cfPrimary)
            // #50 Multilingual: drive locale-aware formatting (dates, relative
            // times) and right-to-left layout (Arabic) from the in-app language.
            .environment(\.locale, l10n.locale)
            .environment(\.layoutDirection, l10n.layoutDirection)
            .id(l10n.language) // rebuild the view tree when the language changes
        }
    }
}
