import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = SettingsViewModel()
    @State private var showingLogoutConfirmation = false

    var body: some View {
        List {
            Section("Program") {
                LabeledContent("Program Name", value: viewModel.programName)
                LabeledContent("Region", value: viewModel.region)
                LabeledContent("Fiscal Year", value: viewModel.fiscalYear)
            }

            Section("Account") {
                if let user = appState.currentUser {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(Color.accentColor.opacity(0.2))
                            .frame(width: 44, height: 44)
                            .overlay {
                                Text(user.initials)
                                    .font(.headline)
                                    .foregroundColor(.accentColor)
                            }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.fullName)
                                .font(.subheadline.weight(.medium))
                            Text(user.role)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                NavigationLink("Change Password") {
                    ChangePasswordView()
                }
            }

            Section("Notifications") {
                Toggle("Attendance Reminders", isOn: $viewModel.attendanceReminders)
                Toggle("Health Due Alerts", isOn: $viewModel.healthAlerts)
                Toggle("Compliance Alerts", isOn: $viewModel.complianceAlerts)
            }

            Section("App") {
                NavigationLink("About Sprout") {
                    AboutView()
                }
                NavigationLink("Privacy & Security") {
                    PrivacyPolicyView()
                }
                LabeledContent("Version", value: viewModel.appVersion)
            }

            Section {
                Button("Sign Out", role: .destructive) {
                    showingLogoutConfirmation = true
                }
            }
        }
        .navigationTitle("Settings")
        .confirmationDialog("Sign out?", isPresented: $showingLogoutConfirmation, titleVisibility: .visible) {
            Button("Sign Out", role: .destructive) {
                appState.logout()
            }
        }
        .task { await viewModel.load() }
    }
}

struct ChangePasswordView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var current = ""
    @State private var newPassword = ""
    @State private var confirm = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showSuccess = false

    var body: some View {
        List {
            Section {
                SecureField("Current Password", text: $current)
                SecureField("New Password", text: $newPassword)
                SecureField("Confirm New Password", text: $confirm)
            } footer: {
                Text("Password must be at least 8 characters.")
            }
            Section {
                Button {
                    update()
                } label: {
                    if isSaving {
                        HStack { Spacer(); ProgressView(); Spacer() }
                    } else {
                        Text("Update Password")
                    }
                }
                .disabled(newPassword.count < 8 || newPassword != confirm || isSaving)
            }
        }
        .navigationTitle("Change Password")
        .alert("Couldn't Update Password", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: { Text(errorMessage ?? "") }
        .alert("Password Updated", isPresented: $showSuccess) {
            Button("OK") { dismiss() }
        } message: { Text("Your password has been changed.") }
    }

    private func update() {
        isSaving = true
        Task {
            do {
                try await APIClient.shared.changePassword(
                    currentPassword: current.isEmpty ? nil : current,
                    newPassword: newPassword
                )
                showSuccess = true
            } catch {
                // This button used to be a no-op `{}` — tapping it did nothing
                // at all, with no way to tell whether a password was ever set.
                errorMessage = "Check that your current password is correct, then try again."
            }
            isSaving = false
        }
    }
}

struct AboutView: View {
    var body: some View {
        List {
            Section {
                LabeledContent("App", value: "Sprout")
                LabeledContent("Purpose", value: "Head Start Management")
            }
            Section("Contact") {
                Link("support@sprout.org", destination: URL(string: "mailto:support@sprout.org")!)
            }
        }
        .navigationTitle("About")
    }
}

@MainActor
class SettingsViewModel: ObservableObject {
    @Published var programName = ""
    @Published var region = ""
    @Published var fiscalYear = ""
    @Published var attendanceReminders = true
    @Published var healthAlerts = true
    @Published var complianceAlerts = true

    var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    func load() async {
        do {
            let settings = try await APIClient.shared.getSettings()
            programName = settings.programName
            region = settings.region
            fiscalYear = settings.fiscalYear
        } catch {
            // Read-only info display — worth noting the failure without an
            // intrusive alert, since there's nothing actionable for the user
            // to retry beyond pulling to refresh.
            print("SettingsViewModel.load failed: \(error)")
        }
    }
}
