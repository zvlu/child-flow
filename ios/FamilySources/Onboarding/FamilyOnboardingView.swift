import SwiftUI

// MARK: - Onboarding Container

struct FamilyOnboardingView: View {
    @EnvironmentObject var appState: FamilyAppState
    @State private var step: OnboardingStep = .welcome
    @State private var invitationCode = ""
    @State private var verifiedCode: VerifiedInvitation?

    enum OnboardingStep {
        case welcome, inviteCode, registration, signIn
    }

    var body: some View {
        NavigationStack {
            switch step {
            case .welcome:
                WelcomeView(
                    onSignUp: { step = .inviteCode },
                    onSignIn: { step = .signIn }
                )
            case .inviteCode:
                InviteCodeView(
                    onVerified: { verified in
                        verifiedCode = verified
                        step = .registration
                    },
                    onBack: { step = .welcome }
                )
            case .registration:
                FamilyRegistrationView(
                    invitation: verifiedCode,
                    onComplete: { profile, token in
                        appState.completeOnboarding(profile: profile, token: token)
                    },
                    onBack: { step = .inviteCode }
                )
            case .signIn:
                FamilySignInView(
                    onComplete: { profile, token in
                        appState.completeOnboarding(profile: profile, token: token)
                    },
                    onBack: { step = .welcome }
                )
            }
        }
    }
}

// MARK: - Welcome Screen

struct WelcomeView: View {
    let onSignUp: () -> Void
    let onSignIn: () -> Void
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        VStack(spacing: 0) {
            // #50 Multilingual: language is the FIRST choice a family makes.
            HStack {
                Spacer()
                LanguageMenuButton()
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)

            Spacer()

            VStack(spacing: 16) {
                Image(systemName: "figure.2.and.child.holdinghands")
                    .font(.system(size: 72))
                    .foregroundColor(.accentColor)

                Text("Sprout")
                    .font(.largeTitle.bold())

                Text(L(.appTagline))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            VStack(spacing: 12) {
                Button(action: onSignUp) {
                    Text(L(.getStarted))
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                Button(action: onSignIn) {
                    Text(L(.haveAccount))
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(.secondarySystemBackground))
                        .foregroundColor(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                Text(L(.inviteNeeded))
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
        }
        .navigationBarHidden(true)
    }
}

// MARK: - Invite Code Entry
// `VerifiedInvitation` is defined in Sources/Models/Models.swift, which is also
// compiled into the SproutFamily target. Don't redeclare it here.

struct InviteCodeView: View {
    let onVerified: (VerifiedInvitation) -> Void
    let onBack: () -> Void

    @State private var code = ""
    @State private var isVerifying = false
    @State private var errorMessage: String?
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                VStack(spacing: 8) {
                    Image(systemName: "envelope.open.fill")
                        .font(.system(size: 52))
                        .foregroundColor(.accentColor)
                    Text(L(.enterInviteTitle))
                        .font(.title2.bold())
                    Text(L(.enterInviteSubtitle))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 32)

                VStack(spacing: 16) {
                    TextField(L(.uniqueCode), text: $code)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.characters)
                        .font(.title3.monospaced())
                        .multilineTextAlignment(.center)
                        .onChange(of: code) { _, val in code = val.uppercased() }

                    if let error = errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(error)
                        }
                        .foregroundColor(.red)
                        .font(.caption)
                    }

                    Button(action: verify) {
                        Group {
                            if isVerifying { ProgressView().tint(.white) }
                            else { Text(L(.continueBtn)).fontWeight(.semibold) }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(code.isEmpty ? Color.accentColor.opacity(0.4) : Color.accentColor)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(code.isEmpty || isVerifying)

                    Button(L(.whereFind)) {
                        // Link to help
                    }
                    .font(.footnote)
                    .foregroundColor(.accentColor)
                }
                .padding(.horizontal, 32)
            }
        }
        .navigationTitle(L(.signUpTitle))
        .navigationBarBackButtonHidden()
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                }
            }
        }
    }

    private func verify() {
        isVerifying = true
        errorMessage = nil
        Task {
            do {
                let verified = try await APIClient.shared.verifyInvitationCode(code)
                await MainActor.run {
                    onVerified(verified)
                    isVerifying = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = L(.invalidCode)
                    isVerifying = false
                }
            }
        }
    }
}

// MARK: - Registration Screen

struct FamilyRegistrationView: View {
    let invitation: VerifiedInvitation?
    let onComplete: (FamilyProfile, String) -> Void
    let onBack: () -> Void

    @State private var email = ""
    @State private var dateOfBirth = Date()
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isPasswordVisible = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    @ObservedObject private var l10n = FamilyL10n.shared

    var passwordsMatch: Bool { password == confirmPassword && !password.isEmpty }
    var canSubmit: Bool { !email.isEmpty && passwordsMatch && !isLoading }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                if let inv = invitation {
                    // Confirmation card
                    HStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(L(.codeVerified))
                                .font(.subheadline.weight(.semibold))
                            Text("\(L(.programLabel)): \(inv.programName)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("\(L(.childLabel)): \(inv.childName)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                    }
                    .padding()
                    .background(Color.green.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 24)
                    .padding(.top, 16)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(L(.createAccountTitle))
                        .font(.title2.bold())
                    Text(L(.createAccountSubtitle))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24)

                VStack(spacing: 14) {
                    TextField(L(.emailAddress), text: $email)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    DatePicker(L(.dateOfBirth), selection: $dateOfBirth,
                               in: ...Calendar.current.date(byAdding: .year, value: -18, to: Date())!,
                               displayedComponents: .date)
                        .datePickerStyle(.compact)

                    Divider()

                    HStack {
                        Group {
                            if isPasswordVisible {
                                TextField(L(.createPassword), text: $password)
                            } else {
                                SecureField(L(.createPassword), text: $password)
                            }
                        }
                        Button(action: { isPasswordVisible.toggle() }) {
                            Image(systemName: isPasswordVisible ? "eye.slash" : "eye")
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(10)
                    .background(Color(.systemBackground))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.systemGray4)))

                    SecureField(L(.confirmPassword), text: $confirmPassword)
                        .textFieldStyle(.roundedBorder)

                    if !confirmPassword.isEmpty && !passwordsMatch {
                        Text(L(.passwordsDontMatch))
                            .font(.caption)
                            .foregroundColor(.red)
                    }

                    if let error = errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(error)
                        }
                        .foregroundColor(.red)
                        .font(.caption)
                    }

                    Button(action: register) {
                        Group {
                            if isLoading { ProgressView().tint(.white) }
                            else { Text(L(.createAccountBtn)).fontWeight(.semibold) }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(canSubmit ? Color.accentColor : Color.accentColor.opacity(0.4))
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(!canSubmit)
                }
                .padding(.horizontal, 24)
            }
            .padding(.bottom, 32)
        }
        .navigationTitle(L(.createAccountBtn))
        .navigationBarBackButtonHidden()
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onBack) { Image(systemName: "chevron.left") }
            }
        }
    }

    private func register() {
        isLoading = true
        errorMessage = nil
        Task {
            do {
                let result = try await APIClient.shared.familyRegister(
                    code: invitation?.code ?? "",
                    email: email,
                    dateOfBirth: dateOfBirth,
                    password: password
                )
                await MainActor.run {
                    onComplete(result.profile, result.token)
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = L(.registrationFailed)
                    isLoading = false
                }
            }
        }
    }
}

// MARK: - Sign In Screen (returning families)

struct FamilySignInView: View {
    let onComplete: (FamilyProfile, String) -> Void
    let onBack: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var isPasswordVisible = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                VStack(spacing: 8) {
                    Image(systemName: "figure.2.and.child.holdinghands")
                        .font(.system(size: 60))
                        .foregroundColor(.accentColor)
                    Text(L(.welcomeBack))
                        .font(.title2.bold())
                }
                .padding(.top, 32)

                VStack(spacing: 14) {
                    TextField(L(.email), text: $email)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    HStack {
                        Group {
                            if isPasswordVisible {
                                TextField(L(.password), text: $password)
                            } else {
                                SecureField(L(.password), text: $password)
                            }
                        }
                        Button(action: { isPasswordVisible.toggle() }) {
                            Image(systemName: isPasswordVisible ? "eye.slash" : "eye")
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(10)
                    .background(Color(.systemBackground))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(.systemGray4)))

                    if let error = errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(error)
                        }
                        .foregroundColor(.red)
                        .font(.caption)
                    }

                    Button(action: signIn) {
                        Group {
                            if isLoading { ProgressView().tint(.white) }
                            else { Text(L(.signIn)).fontWeight(.semibold) }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(email.isEmpty || password.isEmpty ? Color.accentColor.opacity(0.4) : Color.accentColor)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(email.isEmpty || password.isEmpty || isLoading)

                    Button(L(.noAccountSignUp)) { onBack() }
                        .font(.footnote)
                        .foregroundColor(.accentColor)
                }
                .padding(.horizontal, 32)
            }
        }
        .navigationTitle(L(.signIn))
        .navigationBarBackButtonHidden()
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button(action: onBack) { Image(systemName: "chevron.left") }
            }
        }
    }

    private func signIn() {
        isLoading = true
        errorMessage = nil
        Task {
            do {
                let result = try await APIClient.shared.familyLogin(email: email, password: password)
                await MainActor.run {
                    onComplete(result.profile, result.token)
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = L(.incorrectCredentials)
                    isLoading = false
                }
            }
        }
    }
}
