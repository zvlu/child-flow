import SwiftUI

struct FamilyHomeView: View {
    @EnvironmentObject var appState: FamilyAppState
    @StateObject private var viewModel = FamilyHomeViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
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
                        .padding(.top, 8)
                    }

                    // Child cards
                    if viewModel.isLoading {
                        ProgressView().padding(.top, 40)
                    } else {
                        ForEach(viewModel.children) { child in
                            FamilyChildCard(child: child)
                                .padding(.horizontal)
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

struct FamilyEvent: Identifiable {
    let id: String
    let title: String
    let date: Date
    let type: String

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
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            let profile = try await APIClient.shared.getFamilyProfile()
            children = profile.children
            upcomingEvents = try await APIClient.shared.getFamilyEvents()
        } catch {}
        isLoading = false
    }
}
