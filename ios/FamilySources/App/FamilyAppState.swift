import SwiftUI

enum FamilyAppPhase {
    case onboarding
    case authenticated
}

class FamilyAppState: ObservableObject {
    @Published var phase: FamilyAppPhase = .onboarding
    @Published var familyProfile: FamilyProfile?

    init() {
        // If a token is stored, skip onboarding
        if UserDefaults.standard.string(forKey: "family_auth_token") != nil {
            phase = .authenticated
        }
    }

    func completeOnboarding(profile: FamilyProfile, token: String) {
        UserDefaults.standard.set(token, forKey: "family_auth_token")
        Task { await APIClient.shared.setToken(token) }
        familyProfile = profile
        phase = .authenticated
    }

    func signOut() {
        UserDefaults.standard.removeObject(forKey: "family_auth_token")
        Task { await APIClient.shared.clearToken() }
        familyProfile = nil
        phase = .onboarding
    }
}

// Family-specific profile (lighter than Staff User)
struct FamilyProfile: Codable, Identifiable {
    let id: String
    let fullName: String
    let email: String
    let children: [FamilyChild]

    var primaryChild: FamilyChild? { children.first }

    var initials: String {
        fullName.split(separator: " ").compactMap { $0.first }.map(String.init).joined()
    }
}

struct FamilyChild: Codable, Identifiable {
    let id: String
    let firstName: String
    let lastName: String
    let classroom: String
    let teacher: String
    let dateOfBirth: String
    let enrollmentStatus: String
    let attendanceRate: Int
    let healthStatus: String
    let nextEvent: String?

    var fullName: String { "\(firstName) \(lastName)" }
    var initials: String { "\(firstName.prefix(1))\(lastName.prefix(1))" }
}
