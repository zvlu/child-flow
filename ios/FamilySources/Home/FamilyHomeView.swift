import SwiftUI

struct FamilyHomeView: View {
    @EnvironmentObject var appState: FamilyAppState
    @StateObject private var viewModel = FamilyHomeViewModel()
    @State private var showReportAbsence = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // School open/closed today
                    if let status = viewModel.schoolStatus {
                        SchoolStatusBanner(status: status)
                            .padding(.horizontal)
                            .padding(.top, 8)
                    }

                    // Greeting
                    if let profile = appState.familyProfile {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Hello, \(profile.fullName.split(separator: " ").first.map(String.init) ?? profile.fullName) 👋")
                                    .font(.title2.bold())
                                Text("Here's an update on your child.")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                        .padding(.horizontal)
                    }

                    // Report an absence — the most common reason a parent
                    // opens this app on a school morning.
                    Button {
                        showReportAbsence = true
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "calendar.badge.minus")
                                .font(.system(size: 18, weight: .semibold))
                            VStack(alignment: .leading, spacing: 1) {
                                Text("My child isn't coming")
                                    .font(.subheadline.weight(.semibold))
                                Text("Report an absence — your family advocate will confirm")
                                    .font(.caption2)
                                    .opacity(0.85)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundColor(.white)
                        .padding(14)
                        .background(Color.accentColor)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .padding(.horizontal)

                    // Child cards
                    if viewModel.isLoading {
                        ProgressView().padding(.top, 40)
                    } else {
                        ForEach(viewModel.children) { child in
                            FamilyChildCard(child: child)
                                .padding(.horizontal)
                        }
                    }

                    // Recent absence reports + their review status
                    if !viewModel.absences.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Absence Reports")
                                .font(.headline)
                                .padding(.horizontal)
                            ForEach(viewModel.absences.prefix(3)) { report in
                                AbsenceReportRow(report: report)
                                    .padding(.horizontal)
                            }
                        }
                    }

                    // Notifications
                    if !viewModel.notifications.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Notifications")
                                .font(.headline)
                                .padding(.horizontal)
                            ForEach(viewModel.notifications.prefix(5)) { note in
                                NotificationRow(notification: note)
                                    .padding(.horizontal)
                            }
                        }
                    }

                    // Upcoming events
                    if !viewModel.upcomingEvents.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Upcoming")
                                .font(.headline)
                                .padding(.horizontal)

                            ForEach(viewModel.upcomingEvents) { event in
                                UpcomingEventRow(event: event)
                                    .padding(.horizontal)
                            }
                        }
                    }
                }
                .padding(.bottom, 24)
            }
            .navigationTitle("Home")
            .refreshable { await viewModel.load() }
            .task { await viewModel.load() }
            .sheet(isPresented: $showReportAbsence) {
                ReportAbsenceSheet(children: appState.familyProfile?.children ?? viewModel.profileChildren) {
                    await viewModel.load()
                }
            }
        }
    }
}

// MARK: - School Status Banner

struct SchoolStatusBanner: View {
    let status: SchoolStatus

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: status.isOpen ? "checkmark.circle.fill" : "xmark.octagon.fill")
                .font(.system(size: 20))
            VStack(alignment: .leading, spacing: 1) {
                Text(status.label)
                    .font(.subheadline.weight(.semibold))
                if let title = status.nextClosureTitle, let date = status.nextClosureDate {
                    Text("Next closure: \(title) · \(date.formatted(.dateTime.month(.abbreviated).day()))")
                        .font(.caption2)
                        .opacity(0.8)
                }
            }
            Spacer()
        }
        .foregroundColor(status.isOpen ? .green : .red)
        .padding(12)
        .background((status.isOpen ? Color.green : Color.red).opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Absence Report Row

struct AbsenceReportRow: View {
    let report: AbsenceReport

    var statusColor: Color {
        switch report.status {
        case "approved": return .green
        case "denied":   return .red
        default:         return .orange
        }
    }

    var statusLabel: String {
        switch report.status {
        case "approved": return "Approved"
        case "denied":   return "See advocate"
        default:         return "Pending review"
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar.badge.minus")
                .foregroundColor(.secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(report.childName) · \(report.date.formatted(.dateTime.month(.abbreviated).day()))")
                    .font(.subheadline.weight(.medium))
                Text(report.reasonLabel + (report.note.isEmpty ? "" : " — \(report.note)"))
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Text(statusLabel)
                .font(.caption2.weight(.semibold))
                .foregroundColor(statusColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(statusColor.opacity(0.12))
                .clipShape(Capsule())
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Notification Row

struct NotificationRow: View {
    let notification: ParentNotification

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "bell.fill")
                    .foregroundColor(.accentColor)
                if !notification.isRead {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                        .offset(x: 4, y: -3)
                }
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(notification.message)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
                Text(notification.createdAt, style: .relative)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Report Absence Sheet

struct ReportAbsenceSheet: View {
    let children: [FamilyChild]
    let onSubmitted: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedChildId: String = ""
    @State private var date = Date()
    @State private var reason = "sick"
    @State private var note = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private let reasons: [(String, String)] = [
        ("sick", "Illness"),
        ("appointment", "Appointment"),
        ("family_emergency", "Family emergency"),
        ("transportation", "Transportation"),
        ("travel", "Travel"),
        ("other", "Other"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Who is staying home?") {
                    Picker("Child", selection: $selectedChildId) {
                        ForEach(children) { child in
                            Text(child.fullName).tag(child.id)
                        }
                    }
                }
                Section("When and why") {
                    DatePicker("Date", selection: $date, in: Date()..., displayedComponents: .date)
                    Picker("Reason", selection: $reason) {
                        ForEach(reasons, id: \.0) { value, label in
                            Text(label).tag(value)
                        }
                    }
                    TextField("Add a note (optional)", text: $note, axis: .vertical)
                        .lineLimit(2...4)
                }
                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
                Section {
                    Button {
                        submit()
                    } label: {
                        if isSubmitting {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Send to Family Advocate")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isSubmitting || selectedChildId.isEmpty)
                } footer: {
                    Text("Your family advocate will review this. Once approved, the day is marked as an excused absence.")
                }
            }
            .navigationTitle("Report Absence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear {
                if selectedChildId.isEmpty { selectedChildId = children.first?.id ?? "" }
            }
        }
    }

    private func submit() {
        isSubmitting = true
        errorMessage = nil
        Task {
            do {
                _ = try await APIClient.shared.reportAbsence(
                    childId: selectedChildId, date: date, reason: reason, note: note
                )
                await onSubmitted()
                await MainActor.run { dismiss() }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isSubmitting = false
                }
            }
        }
    }
}

// MARK: - Child Card

struct FamilyChildCard: View {
    let child: FamilyChild
    @State private var expanded = true

    var body: some View {
        VStack(spacing: 0) {
            // Header
            Button(action: { withAnimation { expanded.toggle() } }) {
                HStack(spacing: 12) {
                    Circle()
                        .fill(Color.accentColor.opacity(0.15))
                        .frame(width: 48, height: 48)
                        .overlay {
                            Text(child.initials)
                                .font(.headline)
                                .foregroundColor(.accentColor)
                        }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(child.fullName)
                            .font(.headline)
                            .foregroundColor(.primary)
                        Text(child.classroom)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
            }

            if expanded {
                Divider()

                // Stats row
                HStack(spacing: 0) {
                    ChildStatCell(label: "Attendance", value: "\(child.attendanceRate)%",
                                  color: child.attendanceRate >= 90 ? .green : .orange)
                    Divider().frame(height: 44)
                    ChildStatCell(label: "Health", value: child.healthStatus,
                                  color: healthColor(child.healthStatus))
                    Divider().frame(height: 44)
                    ChildStatCell(label: "Status", value: child.enrollmentStatus, color: .blue)
                }

                Divider()

                // Teacher info
                HStack(spacing: 8) {
                    Image(systemName: "person.fill")
                        .foregroundColor(.secondary)
                        .font(.caption)
                    Text("Teacher: \(child.teacher)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 10)

                if let nextEvent = child.nextEvent {
                    Divider()
                    HStack(spacing: 8) {
                        Image(systemName: "calendar.badge.clock")
                            .foregroundColor(.accentColor)
                            .font(.caption)
                        Text("Next: \(nextEvent)")
                            .font(.subheadline)
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 10)
                }
            }
        }
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
    }

    private func healthColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "current": return .green
        case "due soon": return .orange
        case "overdue": return .red
        default: return .gray
        }
    }
}

struct ChildStatCell: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(color)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
    }
}

// MARK: - Upcoming Event
// `FamilyEvent` is defined in Sources/Models/Models.swift (shared with the
// APIClient); only the display helpers live here.

extension FamilyEvent {
    var icon: String {
        switch type {
        case "homeVisit": return "house.fill"
        case "meeting": return "person.2.fill"
        case "health": return "heart.fill"
        default: return "calendar"
        }
    }

    var color: Color {
        switch type {
        case "homeVisit": return .blue
        case "meeting": return .purple
        case "health": return .red
        default: return .gray
        }
    }
}

struct UpcomingEventRow: View {
    let event: FamilyEvent

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8)
                .fill(event.color.opacity(0.12))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: event.icon)
                        .foregroundColor(event.color)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                    .font(.subheadline.weight(.medium))
                Text(event.date, style: .date)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Text(event.date, style: .relative)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - ViewModel

@MainActor
class FamilyHomeViewModel: ObservableObject {
    @Published var children: [FamilyChild] = []
    @Published var upcomingEvents: [FamilyEvent] = []
    @Published var schoolStatus: SchoolStatus?
    @Published var absences: [AbsenceReport] = []
    @Published var notifications: [ParentNotification] = []
    @Published var isLoading = false

    /// Children for the report-absence sheet when the profile isn't cached.
    var profileChildren: [FamilyChild] { children }

    func load() async {
        isLoading = true
        // Each section loads independently; one failure shouldn't blank the rest.
        if let profile = try? await APIClient.shared.getFamilyProfile() {
            children = profile.children
        }
        upcomingEvents = (try? await APIClient.shared.getFamilyEvents()) ?? upcomingEvents
        schoolStatus = (try? await APIClient.shared.getSchoolStatus()) ?? schoolStatus
        absences = (try? await APIClient.shared.getFamilyAbsences()) ?? absences
        notifications = (try? await APIClient.shared.getFamilyNotifications()) ?? notifications
        isLoading = false
    }
}
