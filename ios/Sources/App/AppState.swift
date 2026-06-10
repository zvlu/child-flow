import SwiftUI
import Combine

class AppState: ObservableObject {
    #if DEBUG
    @Published var isAuthenticated: Bool = true
    @Published var currentUser: User? = User(
        id: "dev-test-user",
        fullName: "Test Administrator",
        email: "admin@childflow.org",
        role: "admin"
    )
    #else
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User?
    #endif

    init() {
        #if DEBUG
        Task { await APIClient.shared.setToken("dev-test-token") }
        #endif
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
