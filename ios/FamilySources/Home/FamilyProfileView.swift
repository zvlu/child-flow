import SwiftUI

struct FamilyProfileView: View {
    @EnvironmentObject var appState: FamilyAppState
    @State private var showSignOutConfirmation = false

    var body: some View {
        NavigationStack {
            List {
                if let profile = appState.familyProfile {
                    Section {
                        HStack(spacing: 14) {
                            Circle()
                                .fill(Color.accentColor.opacity(0.15))
                                .frame(width: 56, height: 56)
                                .overlay {
                                    Text(profile.initials)
                                        .font(.title2.weight(.semibold))
                                        .foregroundColor(.accentColor)
                                }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(profile.fullName)
                                    .font(.headline)
                                Text(profile.email)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Section("My Children") {
                        ForEach(profile.children) { child in
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(Color.accentColor.opacity(0.1))
                                    .frame(width: 36, height: 36)
                                    .overlay {
                                        Text(child.initials)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundColor(.accentColor)
                                    }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(child.fullName)
                                        .font(.subheadline.weight(.medium))
                                    Text("\(child.classroom) · \(child.teacher)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }

                Section("Support") {
                    Link(destination: URL(string: "mailto:support@childflow.org")!) {
                        Label("Contact Support", systemImage: "envelope")
                    }
                    NavigationLink(destination: FamilyAboutView()) {
                        Label("About ChildFlow", systemImage: "info.circle")
                    }
                }

                Section {
                    Button("Sign Out", role: .destructive) {
                        showSignOutConfirmation = true
                    }
                }
            }
            .navigationTitle("My Profile")
            .confirmationDialog("Sign out?", isPresented: $showSignOutConfirmation, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) {
                    appState.signOut()
                }
            }
        }
    }
}

struct FamilyAboutView: View {
    var body: some View {
        List {
            Section {
                LabeledContent("App", value: "ChildFlow")
                LabeledContent("For", value: "Head Start Families")
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
            }
            Section("Contact") {
                Link("support@childflow.org", destination: URL(string: "mailto:support@childflow.org")!)
            }
        }
        .navigationTitle("About")
    }
}
