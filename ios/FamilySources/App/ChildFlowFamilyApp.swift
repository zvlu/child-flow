import SwiftUI

@main
struct ChildFlowFamilyApp: App {
    @StateObject private var appState = FamilyAppState()

    var body: some Scene {
        WindowGroup {
            switch appState.phase {
            case .onboarding:
                FamilyOnboardingView()
                    .environmentObject(appState)
            case .authenticated:
                FamilyTabView()
                    .environmentObject(appState)
            }
        }
    }
}
