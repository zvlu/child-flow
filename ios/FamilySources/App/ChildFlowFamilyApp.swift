import SwiftUI

@main
struct ChildFlowFamilyApp: App {
    @StateObject private var appState = FamilyAppState()
    @UIApplicationDelegateAdaptor(PushAppDelegate.self) private var pushDelegate

    var body: some Scene {
        WindowGroup {
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
    }
}
