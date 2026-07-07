import SwiftUI

struct FamilyProfileView: View {
    @EnvironmentObject var appState: FamilyAppState
    @State private var showSignOutConfirmation = false
    @ObservedObject private var l10n = FamilyL10n.shared

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

                    Section(L(.myChildren)) {
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

                // #50 Multilingual: in-app language switcher.
                LanguagePickerSection()

                Section(L(.support)) {
                    Link(destination: URL(string: "mailto:support@sprout.org")!) {
                        Label(L(.contactSupport), systemImage: "envelope")
                    }
                    NavigationLink(destination: FamilyAboutView()) {
                        Label(L(.aboutSprout), systemImage: "info.circle")
                    }
                }

                Section {
                    Button(L(.signOut), role: .destructive) {
                        showSignOutConfirmation = true
                    }
                }
            }
            .navigationTitle(L(.tabProfile))
            .confirmationDialog(L(.signOutConfirm), isPresented: $showSignOutConfirmation, titleVisibility: .visible) {
                Button(L(.signOut), role: .destructive) {
                    appState.signOut()
                }
            }
        }
    }
}

struct FamilyAboutView: View {
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        List {
            Section {
                LabeledContent(L(.appWord), value: "Sprout")
                LabeledContent(L(.forWord), value: L(.headStartFamilies))
                LabeledContent(L(.versionWord), value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
            }
            Section {
                Link("support@sprout.org", destination: URL(string: "mailto:support@sprout.org")!)
            }
        }
        .navigationTitle(L(.about))
    }
}
