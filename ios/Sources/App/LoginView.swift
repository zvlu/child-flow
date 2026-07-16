import SwiftUI
import LocalAuthentication

struct LoginView: View {
    @EnvironmentObject var appState: AppState
    @State private var email = ""
    @State private var password = ""
    @State private var isPasswordVisible = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showForgotPassword = false
    @FocusState private var focusedField: Field?

    enum Field { case email, password }

    var biometricType: LABiometryType {
        LAContext().biometryType
    }

    var biometricIcon: String {
        biometricType == .faceID ? "faceid" : "touchid"
    }

    var canUseBiometrics: Bool {
        let ctx = LAContext()
        return ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Spacer().frame(height: 80)

                // Logo
                VStack(spacing: 8) {
                    Image(systemName: "figure.2.and.child.holdinghands")
                        .font(.system(size: 60))
                        .foregroundColor(.accentColor)
                    Text("Sprout")
                        .font(.largeTitle.bold())
                    Text("Head Start Management")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer().frame(height: 48)

                // Fields
                VStack(spacing: 16) {
                    // Email
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .submitLabel(.next)
                        .focused($focusedField, equals: .email)
                        .onSubmit { focusedField = .password }

                    // Password with show/hide toggle
                    HStack {
                        Group {
                            if isPasswordVisible {
                                TextField("Password", text: $password)
                            } else {
                                SecureField("Password", text: $password)
                            }
                        }
                        .submitLabel(.go)
                        .focused($focusedField, equals: .password)
                        .onSubmit { if !email.isEmpty && !password.isEmpty { login() } }

                        Button(action: { isPasswordVisible.toggle() }) {
                            Image(systemName: isPasswordVisible ? "eye.slash" : "eye")
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color(.systemBackground))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(Color(.systemGray4), lineWidth: 1)
                    )

                    // Forgot password
                    HStack {
                        Spacer()
                        Button("Forgot Password?") { showForgotPassword = true }
                            .font(.footnote)
                            .foregroundColor(.accentColor)
                    }

                    // Error
                    if let error = errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(error)
                        }
                        .foregroundColor(.cfHealth)
                        .font(.caption)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    // Sign In button
                    Button(action: login) {
                        Group {
                            if isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Text("Sign In").fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(email.isEmpty || password.isEmpty ? Color.cfPrimary.opacity(0.4) : Color.cfPrimary)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(isLoading || email.isEmpty || password.isEmpty)

                    // Biometric sign-in
                    if canUseBiometrics {
                        Button(action: loginWithBiometrics) {
                            HStack(spacing: 8) {
                                Image(systemName: biometricIcon)
                                Text("Sign in with \(biometricType == .faceID ? "Face ID" : "Touch ID")")
                                    .fontWeight(.medium)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color(.secondarySystemBackground))
                            .foregroundColor(.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                }
                .padding(.horizontal, 32)

                Spacer().frame(height: 48)

                // Footer
                VStack(spacing: 4) {
                    Text("Need access?")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Link("Contact your program administrator",
                         destination: URL(string: "mailto:support@sprout.org")!)
                        .font(.caption)
                        .foregroundColor(.accentColor)
                }

                Spacer().frame(height: 32)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .sheet(isPresented: $showForgotPassword) {
            ForgotPasswordSheet()
        }
    }

    // MARK: - Actions
    private func login() {
        focusedField = nil
        isLoading = true
        errorMessage = nil
        Task {
            do {
                let token = try await APIClient.shared.login(email: email, password: password)
                await MainActor.run {
                    appState.login(token: token)
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }

    private func loginWithBiometrics() {
        // Biometrics only unlock an EXISTING stored session — they are not a
        // credential on their own. If no token is stored (e.g. first launch or
        // after logout), the user must sign in with email/password first.
        let context = LAContext()
        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Sign in to Sprout"
        ) { success, error in
            Task { @MainActor in
                guard success else {
                    errorMessage = error?.localizedDescription
                    return
                }
                let hasToken = await APIClient.shared.loadStoredToken()
                if hasToken {
                    appState.isAuthenticated = true
                } else {
                    errorMessage = "No saved sign-in found. Please sign in with your email and password."
                }
            }
        }
    }
}

// MARK: - Forgot Password Sheet
//
// There is no password-reset endpoint anywhere in this client or on the
// server — this used to fake a network call and show a "check your email"
// success screen even though no email was ever sent. Rather than build a
// full email-based reset flow (out of scope here), this is now honest about
// what's actually available: self-service reset isn't implemented yet, so
// direct the user to their program administrator instead of pretending to
// have sent something.
struct ForgotPasswordSheet: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                VStack(spacing: 16) {
                    Image(systemName: "person.crop.circle.badge.questionmark")
                        .font(.system(size: 52))
                        .foregroundColor(.secondary)
                    Text("Password Reset Isn't Available Yet")
                        .font(.title2.bold())
                        .multilineTextAlignment(.center)
                    Text("Self-service password reset isn't set up for this app yet. Contact your program administrator and they can reset your password for you.")
                        .multilineTextAlignment(.center)
                        .foregroundColor(.secondary)
                    Button("Done") { dismiss() }
                        .buttonStyle(.borderedProminent)
                }
                .padding()
                Spacer()
            }
            .navigationTitle("Reset Password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
