import SwiftUI

enum FamilyAppPhase {
    case onboarding
    case authenticated
}

/// App-level state for the family (parent) app.
/// `FamilyProfile` / `FamilyChild` live in Sources/Models/Models.swift, which
/// is compiled into this target too — don't redeclare them here.
class FamilyAppState: ObservableObject {
    @Published var phase: FamilyAppPhase = .onboarding
    @Published var familyProfile: FamilyProfile?

    init() {
        // One-time cleanup of the legacy plaintext token location.
        UserDefaults.standard.removeObject(forKey: "family_auth_token")

        // If a token is stored in the Keychain, skip onboarding.
        Task {
            let hasToken = await APIClient.shared.loadStoredToken()
            if hasToken {
                await MainActor.run { phase = .authenticated }
            }
        }
    }

    func completeOnboarding(profile: FamilyProfile, token: String) {
        // APIClient stores the token in the hardware-backed Keychain.
        Task { await APIClient.shared.setToken(token) }
        familyProfile = profile
        phase = .authenticated
    }

    func signOut() {
        Task { await APIClient.shared.clearToken() }
        familyProfile = nil
        phase = .onboarding
    }
}

// Convenience accessors used by the family views.
extension FamilyProfile {
    var primaryChild: FamilyChild? { children.first }

    var initials: String {
        fullName.split(separator: " ").compactMap { $0.first }.map(String.init).joined()
    }
}

extension FamilyChild {
    var initials: String { "\(firstName.prefix(1))\(lastName.prefix(1))" }
}
