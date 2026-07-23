import SwiftUI
import Combine

class AppState: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User?

    /// Non-nil when the signed-in account is a FAMILY (parent) account.
    /// The same login screen serves every role; parents get the family
    /// experience, staff get the staff experience.
    @Published var familyState: FamilyAppState?

    /// Persisted so a cold launch knows which kind of session the stored
    /// Keychain token belongs to ("staff" or "family").
    private static let sessionKindKey = "cf_session_kind"

    /// Lock the UI after this long in the background. The Keychain token is
    /// kept, so Face ID / Touch ID re-unlocks without re-entering a password.
    static let autoLockAfter: TimeInterval = 15 * 60

    private var backgroundedAt: Date?
    private var sessionExpiredObserver: NSObjectProtocol?

    init() {
        // Restore a previously stored session from the Keychain on launch.
        Task { await checkAuth() }

        // If the server rejects the token (expired 12h JWT, revoked session),
        // drop it and return to sign-in rather than surfacing endless errors.
        sessionExpiredObserver = NotificationCenter.default.addObserver(
            forName: .cfSessionExpired,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.logout()
        }
    }

    deinit {
        if let observer = sessionExpiredObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    /// True only for administrator accounts; gates admin-only UI like
    /// timesheet approval. The server enforces every permission regardless.
    var isAdmin: Bool { currentUser?.role == "admin" }

    /// Groups the §1302.91 functional roles into the experience each one
    /// should lead with. Presentation only — the server enforces access.
    enum RoleGroup {
        case leadership      // directors, fiscal, ERSEA, admins
        case teaching        // teachers, assistants, education staff
        case health          // nurses, nutritionists, health/disability staff
        case familyServices  // advocates, home visitors, family services
        case operations      // cooks, bus drivers, everyone else
    }

    /// Admins, plus supervisory functional roles, may manage staff. The
    /// server enforces the exact boundary (admins org-wide; managers only
    /// their reporting subtree) — this just reveals the management UI.
    var canManageStaff: Bool {
        if isAdmin { return true }
        switch currentUser?.staffRole {
        case "director", "education_coordinator", "health_coordinator",
             "disabilities_coordinator", "ersea_coordinator",
             "family_services_manager":
            return true
        default:
            return false
        }
    }

    var roleGroup: RoleGroup {
        if isAdmin { return .leadership }
        switch currentUser?.staffRole {
        case "director", "fiscal_officer", "ersea_coordinator", "coordinator":
            return .leadership
        case "teacher", "assistant", "education_coordinator", "coach":
            return .teaching
        case "health_coordinator", "nurse", "nutritionist",
             "mental_health_consultant", "disabilities_coordinator":
            return .health
        case "family_services_manager", "family_advocate", "home_visitor":
            return .familyServices
        case "cook", "bus_driver":
            return .operations
        default:
            // No staff record / unknown role: teachers are the most common
            // default (matches the schema default).
            return .teaching
        }
    }

    /// Whether the signed-in user's org has a feature module enabled (e.g.
    /// Head Start compliance). Presentation only — the server enforces access
    /// independently on every gated route.
    func hasModule(_ module: FeatureModule) -> Bool {
        currentUser?.enabledModules.contains(module.rawValue) ?? false
    }

    /// Restore the session if a token is present in the Keychain, then load
    /// the user's profile (name + role) so the UI can gate admin functions.
    func checkAuth() async {
        let hasToken = await APIClient.shared.loadStoredToken()
        let kind = UserDefaults.standard.string(forKey: Self.sessionKindKey)

        if hasToken && kind == "family" {
            // The stored token belongs to a parent account — restore the
            // family experience instead of treating it as a staff session.
            await MainActor.run {
                let fam = FamilyAppState()
                fam.phase = .authenticated
                familyState = fam
            }
            return
        }

        await MainActor.run { isAuthenticated = hasToken }
        if hasToken { await loadProfile() }
    }

    func login(token: String) {
        UserDefaults.standard.set("staff", forKey: Self.sessionKindKey)
        Task {
            await APIClient.shared.setToken(token)
            await MainActor.run { isAuthenticated = true }
            await loadProfile()
        }
    }

    /// Sign-in resolved to a FAMILY (parent) account.
    func loginFamily(profile: FamilyProfile, token: String) {
        UserDefaults.standard.set("family", forKey: Self.sessionKindKey)
        let fam = FamilyAppState()
        fam.completeOnboarding(profile: profile, token: token)
        familyState = fam
    }

    /// Called when the family experience signs out (its phase returns to
    /// .onboarding) so the container falls back to the shared login screen.
    func endFamilySession() {
        UserDefaults.standard.removeObject(forKey: Self.sessionKindKey)
        familyState = nil
    }

    private func loadProfile() async {
        if let me = try? await APIClient.shared.getMe() {
            await MainActor.run { currentUser = me }
        }
    }

    func logout() {
        UserDefaults.standard.removeObject(forKey: Self.sessionKindKey)
        Task {
            await APIClient.shared.clearToken()
            await MainActor.run {
                currentUser = nil
                isAuthenticated = false
                familyState = nil
            }
        }
    }

    // MARK: - Auto-lock on inactivity

    func noteBackgrounded() {
        backgroundedAt = Date()
    }

    /// Called when the app returns to the foreground. If it sat in the
    /// background past the auto-lock window, lock the UI — but keep the
    /// Keychain token so biometrics can unlock the existing session.
    func relockIfNeeded() {
        defer { backgroundedAt = nil }
        guard isAuthenticated, let since = backgroundedAt else { return }
        if Date().timeIntervalSince(since) >= Self.autoLockAfter {
            isAuthenticated = false
        }
    }
}
