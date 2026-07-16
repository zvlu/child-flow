import SwiftUI

/// Defense-in-depth wrapper for screens that only make sense for Head Start
/// -funded programs (§1302 compliance: PIR, Family Services, Chronic Absence,
/// Disability Services, Attendance Plans, Staff Activity, ERSEA, Compliance).
///
/// The hamburger menu already hides every one of these behind
/// `appState.hasModule(.headStart)`, and the server independently rejects
/// non-HS orgs on every one of these procedures — this is a third, purely
/// presentational layer so a stale deep link, tab restoration, or a future
/// alert/task destination can never render federal-compliance UI chrome
/// (section headers, form fields, jargon) for a core-only daycare, even
/// with no real data behind it.
struct HeadStartGate<Content: View>: View {
    @EnvironmentObject var appState: AppState
    let featureDescription: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        if appState.hasModule(.headStart) {
            content()
        } else {
            VStack(spacing: 10) {
                Image(systemName: "lock.fill")
                    .font(.largeTitle)
                    .foregroundColor(.secondary)
                Text("Head Start Module Required")
                    .font(.headline)
                Text("\(featureDescription) applies to Head Start-funded programs only.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding()
        }
    }
}
