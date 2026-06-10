import SwiftUI
import Combine

class AppState: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User?

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

    /// Restore the session if a token is present in the Keychain.
    /// Note: `currentUser` is left nil until a profile endpoint is wired up;
    /// the UI degrades gracefully (see DashboardView / SettingsView).
    func checkAuth() async {
        let hasToken = await APIClient.shared.loadStoredToken()
        await MainActor.run { isAuthenticated = hasToken }
    }

    func login(token: String) {
        Task {
            await APIClient.shared.setToken(token)
            await MainActor.run { isAuthenticated = true }
        }
    }

    func logout() {
        Task {
            await APIClient.shared.clearToken()
            await MainActor.run {
                currentUser = nil
                isAuthenticated = false
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
