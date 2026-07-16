import UIKit
import UserNotifications

/// App delegate that forwards the APNs device token to the backend so the
/// server can push to this device. Attach with `@UIApplicationDelegateAdaptor`.
final class PushAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { try? await APIClient.shared.registerDeviceToken(hex) }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("[Push] registration failed: \(error.localizedDescription)")
    }
}

/// Ask for notification permission once signed in, then register for remote
/// pushes (which triggers the delegate callback above). Safe to call repeatedly.
@MainActor
func requestPushAuthorization() {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
        guard granted else { return }
        DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() }
    }
}
