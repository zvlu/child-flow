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

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 16) {
                Image(systemName: "figure.2.and.child.holdinghands")
                    .font(.system(size: 72))
                    .foregroundColor(.accentColor)

                Text("ChildFlow")
                    .font(.largeTitle.bold())

                Text("Stay connected with your child's\nHead Start program")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            VStack(spacing: 12) {
                Button(action: onSignUp) {
                    Text("Get Started")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                Button(action: onSignIn) {
                    Text("I already have an account")
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(.secondarySystemBackground))
                        .foregroundColor(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                Text("You need an invitation from your program to sign up.")
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

struct VerifiedInvitation: Codable {
    let code: String
    let childName: String
    let programName: String
    let adultEmail: String
}

struct InviteCodeView: View {
    let onVerified: (VerifiedInvitation) -> Void
    let onBack: () -> Void

    @State private var code = ""
    @State private var isVerifying = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                VStack(spacing: 8) {
                    Image(systemName: "envelope.open.fill")
                        .font(.system(size: 52))
                        .foregroundColor(.accentColor)
                    Text("Enter Your Invitation Code")
                        .font(.title2.bold())
                    Text("Check the email sent to you by your child's program. It contains a unique code.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 32)

                VStack(spacing: 16) {
                    TextField("Unique Code", text: $code)
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
                            else { Text("Continue").fontWeight(.semibold) }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(code.isEmpty ? Color.accentColor.opacity(0.4) : Color.accentColor)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(code.isEmpty || isVerifying)

                    Button("Where do I find this?") {
                        // Link to help
                    }
                    .font(.footnote)
                    .foregroundColor(.accentColor)
                }
                .padding(.horizontal, 32)
            }
        }
        .navigationTitle("Sign Up")
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
                    errorMessage = "Invalid code. Please check and try again."
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
                            Text("Code verified!")
                                .font(.subheadline.weight(.semibold))
                            Text("Program: \(inv.programName)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("Child: \(inv.childName)")
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
                    Text("Create Your Account")
                        .font(.title2.bold())
                    Text("Use the email your invitation was sent to and your date of birth.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24)

                VStack(spacing: 14) {
                    TextField("Email address", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    DatePicker("Date of Birth", selection: $dateOfBirth,
                               in: ...Calendar.current.date(byAdding: .year, value: -18, to: Date())!,
                               displayedComponents: .date)
                        .datePickerStyle(.compact)

                    Divider()

                    HStack {
                        Group {
                            if isPasswordVisible {
                                TextField("Create password", text: $password)
                            } else {
                                SecureField("Create password", text: $password)
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

                    SecureField("Confirm password", text: $confirmPassword)
                        .textFieldStyle(.roundedBorder)

                    if !confirmPassword.isEmpty && !passwordsMatch {
                        Text("Passwords don't match")
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
                            else { Text("Create Account").fontWeight(.semibold) }
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
        .navigationTitle("Create Account")
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
                    errorMessage = "Registration failed. Check your email and date of birth match your records."
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

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                VStack(spacing: 8) {
                    Image(systemName: "figure.2.and.child.holdinghands")
                        .font(.system(size: 60))
                        .foregroundColor(.accentColor)
                    Text("Welcome Back")
                        .font(.title2.bold())
                }
                .padding(.top, 32)

                VStack(spacing: 14) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    HStack {
                        Group {
                            if isPasswordVisible {
                                TextField("Password", text: $password)
                            } else {
                                SecureField("Password", text: $password)
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
                            else { Text("Sign In").fontWeight(.semibold) }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(email.isEmpty || password.isEmpty ? Color.accentColor.opacity(0.4) : Color.accentColor)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(email.isEmpty || password.isEmpty || isLoading)

                    Button("Don't have an account? Sign up") { onBack() }
                        .font(.footnote)
                        .foregroundColor(.accentColor)
                }
                .padding(.horizontal, 32)
            }
        }
        .navigationTitle("Sign In")
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
                    errorMessage = "Incorrect email or password."
                    isLoading = false
                }
            }
        }
    }
}
