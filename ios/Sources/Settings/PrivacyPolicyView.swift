import SwiftUI

/// In-app privacy & security summary.
///
/// IMPORTANT: The wording here intentionally describes only the safeguards that
/// are actually implemented in the app today. Do not add claims (e.g. specific
/// at-rest cipher suites, multi-factor authentication, third-party audits)
/// unless the corresponding control is real and verifiable. This text is a
/// starting point and should be reviewed by your program's privacy officer and
/// legal counsel before being treated as your published policy.
struct PrivacyPolicyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header

                section(
                    "How we protect your data",
                    bullets: [
                        "In transit: network requests use HTTPS. App Transport Security is enforced, so connections to program servers must be encrypted.",
                        "On this device: your sign-in token is stored in the iOS Keychain (hardware-protected, device-only, excluded from backups) — not in plain storage.",
                        "Access control: every request requires authentication. Administrative actions (managing staff, bulk record changes) are restricted to admin accounts.",
                        "Audit logging: access to and changes of child and health records are recorded with the acting user and time.",
                        "Sign-in: email and password, with optional Face ID / Touch ID to unlock an existing session on this device.",
                        "Session limits: the app locks after 15 minutes in the background, sign-ins expire after 12 hours, and web sessions time out after 30 minutes of inactivity.",
                    ]
                )

                section(
                    "Information in the app",
                    bullets: [
                        "Child records: name, date of birth, enrollment status.",
                        "Health information: screenings, immunizations, allergies.",
                        "Family information: contacts and home-visit logs.",
                        "Staff information: role, contact details, training hours.",
                    ]
                )

                section(
                    "Your rights",
                    bullets: [
                        "Under FERPA and Head Start standards, parents may inspect and review their child's education and health records.",
                        "Parents may request corrections to inaccurate information.",
                        "Parents may provide or revoke consent for disclosures, except where disclosure is required by law or to protect health and safety.",
                    ]
                )

                section(
                    "A note on compliance",
                    bullets: [
                        "These technical safeguards support HIPAA and FERPA requirements but do not by themselves make a program compliant. Compliance also depends on organizational policies, business-associate agreements, staff training, and infrastructure controls (including at-rest database encryption) configured by your program.",
                    ]
                )

                VStack(alignment: .leading, spacing: 4) {
                    Text("Questions")
                        .font(.headline)
                    Text("Contact our Privacy Officer:")
                        .foregroundColor(.secondary)
                    Link("privacy@sprout.org", destination: URL(string: "mailto:privacy@sprout.org")!)
                    Text("Sprout\n47 Lovell Ave\nWindsor, CT 06096")
                        .foregroundColor(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .font(.subheadline)
            }
            .padding()
        }
        .navigationTitle("Privacy & Security")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Privacy & Security")
                .font(.title2.bold())
            Text("How Sprout handles the data of the children, families, and staff you serve.")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    private func section(_ title: String, bullets: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            ForEach(bullets, id: \.self) { bullet in
                HStack(alignment: .top, spacing: 8) {
                    Text("•").foregroundColor(.accentColor)
                    Text(bullet)
                        .font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}
