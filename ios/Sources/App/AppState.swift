import SwiftUI
import Combine

class AppState: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User?

    init() {
        // Restore a previously stored session from the Keychain on launch.
        Task { await checkAuth() }
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
}
