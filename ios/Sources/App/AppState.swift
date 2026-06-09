import SwiftUI
import Combine

class AppState: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User?

    func login(token: String) {
        APIClient.shared.setToken(token)
        isAuthenticated = true
    }

    func logout() {
        APIClient.shared.clearToken()
        currentUser = nil
        isAuthenticated = false
    }
}
