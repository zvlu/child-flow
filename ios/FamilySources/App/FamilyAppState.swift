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

    private var sessionExpiredObserver: NSObjectProtocol?

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

        // The staff app signs out on a rejected/expired session token (see
        // AppState.swift); this target shares the same APIClient and posts
        // the same notification on any 401, but had no listener at all — a
        // parent whose session expired stayed on FamilyTabView forever,
        // just hitting silent 401s on every screen instead of being
        // returned to sign-in like every other account type in the app.
        sessionExpiredObserver = NotificationCenter.default.addObserver(
            forName: .cfSessionExpired,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.signOut()
        }
    }

    deinit {
        if let observer = sessionExpiredObserver {
            NotificationCenter.default.removeObserver(observer)
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
