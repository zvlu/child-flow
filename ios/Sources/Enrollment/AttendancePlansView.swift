import SwiftUI

// MARK: - Attendance Success Plans

struct AttendancePlansView: View {
    @StateObject private var viewModel = AttendancePlansViewModel()
    @State private var showNewPlan = false

    var body: some View {
        List {
            if !viewModel.plans.isEmpty {
                Section {
                    HStack(spacing: 16) {
                        AttendancePlanStatCell(
                            label: "Active Plans",
                            value: "\(viewModel.plans.filter { $0.status == .active }.count)",
                            color: .orange
                        )
                        Divider().frame(height: 40)
                        AttendancePlanStatCell(
                            label: "Resolved",
                            value: "\(viewModel.plans.filter { $0.status == .resolved }.count)",
                            color: .green
                        )
                    }
                    .padding(.vertical, 4)
                }
            }

            if viewModel.plans.isEmpty && !viewModel.isLoading {
                ContentUnavailableView(
                    "No Attendance Plans",
                    systemImage: "checkmark.seal",
                    description: Text("Plans are created for children with attendance below 85%.")
                )
                .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.plans) { plan in
                    NavigationLink(destination: AttendancePlanDetailView(plan: plan)) {
                        AttendancePlanRow(plan: plan)
                    }
                }
            }
        }
        .navigationTitle("Attendance Plans")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showNewPlan = true }) {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showNewPlan) {
            NewAttendancePlanSheet { _ in
                Task { await viewModel.load() }
            }
        }
        .task { await viewModel.load() }
        .overlay { if viewModel.isLoading { ProgressView() } }
    }
}

struct AttendancePlanStatCell: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2.bold())
                .foregroundColor(color)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct AttendancePlanRow: View {
    let plan: AttendanceSuccessPlan

    var body: some View {
        HStack(spacing: 12) {
            // Attendance rate ring
            ZStack {
                Circle()
                    .stroke(Color(.systemGray5), lineWidth: 4)
                Circle()
                    .trim(from: 0, to: plan.currentAttendanceRate / 100)
                    .stroke(attendanceColor, lineWidth: 4)
                    .rotationEffect(.degrees(-90))
                Text("\(Int(plan.currentAttendanceRate))%")
                    .font(.caption2.bold())
                    .foregroundColor(attendanceColor)
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 3) {
                Text(plan.childName)
                    .font(.subheadline.weight(.medium))
                HStack(spacing: 8) {
                    Text(plan.classroom)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("FA: \(plan.familyAdvocate)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            Text(plan.status.rawValue)
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(plan.status.color.opacity(0.12))
                .foregroundColor(plan.status.color)
                .clipShape(Capsule())
        }
        .padding(.vertical, 2)
    }

    var attendanceColor: Color {
        plan.currentAttendanceRate >= 85 ? .green
            : plan.currentAttendanceRate >= 70 ? .orange : .red
    }
}

// MARK: - Plan Detail

struct AttendancePlanDetailView: View {
    @State var plan: AttendanceSuccessPlan

    var body: some View {
        List {
            Section("Student") {
                LabeledContent("Name", value: plan.childName)
                LabeledContent("Classroom", value: plan.classroom)
                LabeledContent("Current Attendance", value: "\(Int(plan.currentAttendanceRate))%")
                LabeledContent("Family Advocate", value: plan.familyAdvocate)
                LabeledContent("Status", value: plan.status.rawValue)
                LabeledContent("Created") { Text(plan.createdDate, style: .date) }
                if let review = plan.reviewDate {
                    LabeledContent("Review Date") { Text(review, style: .date) }
                }
            }

            Section("Identified Barriers") {
                if plan.barriers.isEmpty {
                    Text("No barriers identified yet.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                } else {
                    ForEach(plan.barriers, id: \.self) { barrier in
                        Label(barrier, systemImage: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                            .font(.subheadline)
                    }
                }
            }

            Section("Intervention Strategies") {
                if plan.strategies.isEmpty {
                    Text("No strategies added yet.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                } else {
                    ForEach($plan.strategies) { $strategy in
                        HStack(alignment: .top, spacing: 10) {
                            Button(action: { strategy.isImplemented.toggle() }) {
                                Image(systemName: strategy.isImplemented
                                    ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(strategy.isImplemented ? .green : .secondary)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(strategy.description)
                                    .font(.subheadline)
                                    .strikethrough(strategy.isImplemented)
                                if let date = strategy.targetDate {
                                    Text(date, style: .date)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Attendance Plan")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - New Plan Sheet

struct NewAttendancePlanSheet: View {
    let onSave: (AttendanceSuccessPlan) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var childName = ""
    @State private var classroom = ""
    @State private var attendanceRate = 75.0
    @State private var familyAdvocate = ""
    @State private var reviewDate = Date().addingTimeInterval(30 * 24 * 3600)
    @State private var barriers: [String] = [""]
    @State private var strategies: [String] = [""]
    @State private var isSaving = false

    let commonBarriers = [
        "Transportation issues",
        "Illness (child)",
        "Illness (family)",
        "Family emergency",
        "Parent work schedule conflicts",
        "Lack of understanding of program importance",
        "Housing instability",
        "Childcare for siblings"
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Student Information") {
                    TextField("Child Name", text: $childName)
                    TextField("Classroom", text: $classroom)
                    TextField("Family Advocate", text: $familyAdvocate)
                    LabeledContent("Current Attendance Rate") {
                        Text("\(Int(attendanceRate))%")
                            .foregroundColor(attendanceRate >= 85 ? .green : .red)
                    }
                    Slider(value: $attendanceRate, in: 0...100, step: 1)
                    DatePicker("Review Date", selection: $reviewDate, displayedComponents: .date)
                }

                Section {
                    ForEach(barriers.indices, id: \.self) { i in
                        HStack {
                            TextField("Barrier \(i + 1)", text: $barriers[i])
                            if barriers.count > 1 {
                                Button(action: { barriers.remove(at: i) }) {
                                    Image(systemName: "minus.circle.fill").foregroundColor(.red)
                                }
                            }
                        }
                    }
                    Button(action: { barriers.append("") }) {
                        Label("Add Barrier", systemImage: "plus.circle")
                    }
                    DisclosureGroup("Common Barriers") {
                        ForEach(commonBarriers, id: \.self) { barrier in
                            Button(action: {
                                if barriers.last?.isEmpty == true {
                                    barriers[barriers.count - 1] = barrier
                                } else {
                                    barriers.append(barrier)
                                }
                            }) {
                                Label(barrier, systemImage: "plus")
                                    .font(.subheadline)
                            }
                        }
                    }
                } header: {
                    Text("Identified Barriers")
                }

                Section {
                    ForEach(strategies.indices, id: \.self) { i in
                        HStack {
                            TextField("Strategy \(i + 1)", text: $strategies[i])
                            if strategies.count > 1 {
                                Button(action: { strategies.remove(at: i) }) {
                                    Image(systemName: "minus.circle.fill").foregroundColor(.red)
                                }
                            }
                        }
                    }
                    Button(action: { strategies.append("") }) {
                        Label("Add Strategy", systemImage: "plus.circle")
                    }
                } header: {
                    Text("Intervention Strategies")
                }
            }
            .navigationTitle("New Attendance Plan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(childName.isEmpty || isSaving)
                }
            }
        }
    }

    private func save() {
        isSaving = true
        Task {
            do {
                let plan = try await APIClient.shared.createAttendancePlan(
                    childId: UUID().uuidString,
                    barriers: barriers.filter { !$0.isEmpty }
                )
                await MainActor.run { onSave(plan); dismiss() }
            } catch {
                let mock = AttendanceSuccessPlan(
                    id: UUID().uuidString,
                    childId: UUID().uuidString,
                    childName: childName,
                    classroom: classroom,
                    currentAttendanceRate: attendanceRate,
                    createdDate: Date(),
                    reviewDate: reviewDate,
                    familyAdvocate: familyAdvocate,
                    barriers: barriers.filter { !$0.isEmpty },
                    strategies: strategies.filter { !$0.isEmpty }.map { s in
                        AttendancePlanStrategy(id: UUID().uuidString, description: s, isImplemented: false, targetDate: nil)
                    },
                    status: .active
                )
                await MainActor.run { onSave(mock); dismiss() }
            }
            isSaving = false
        }
    }
}

@MainActor
class AttendancePlansViewModel: ObservableObject {
    @Published var plans: [AttendanceSuccessPlan] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            plans = try await APIClient.shared.getAttendancePlans()
        } catch {
            #if DEBUG
            plans = MockData.attendancePlans
            #endif
        }
        isLoading = false
    }
}
