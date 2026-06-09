import SwiftUI

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    MetricCard(title: "Enrolled", value: "\(viewModel.stats.totalEnrolled)", icon: "person.2.fill", color: .blue)
                    MetricCard(title: "Attendance", value: "\(viewModel.stats.attendanceRate)%", icon: "checkmark.circle.fill", color: .green)
                    MetricCard(title: "Health Due", value: "\(viewModel.stats.healthDue)", icon: "heart.fill", color: .orange)
                    MetricCard(title: "Compliance", value: "\(viewModel.stats.complianceScore)%", icon: "checkmark.seal.fill", color: .purple)
                }
                .padding()

                if !viewModel.alerts.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Alerts")
                            .font(.headline)
                            .padding(.horizontal)
                        ForEach(viewModel.alerts) { alert in
                            AlertRow(alert: alert)
                                .padding(.horizontal)
                        }
                    }
                }
            }
            .navigationTitle("Dashboard")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { viewModel.refresh() }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .task { await viewModel.load() }
            .overlay {
                if viewModel.isLoading {
                    ProgressView()
                }
            }
        }
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Spacer()
            }
            Text(value)
                .font(.title.bold())
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct AlertRow: View {
    let alert: ProgramAlert

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: alert.icon)
                .foregroundColor(alert.color)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(alert.title)
                    .font(.subheadline.weight(.medium))
                Text(alert.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

@MainActor
class DashboardViewModel: ObservableObject {
    @Published var stats = ProgramStats()
    @Published var alerts: [ProgramAlert] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            let data = try await APIClient.shared.getDashboardStats()
            stats = data.stats
            alerts = data.alerts
        } catch {
            // Handle error
        }
        isLoading = false
    }

    func refresh() {
        Task { await load() }
    }
}
