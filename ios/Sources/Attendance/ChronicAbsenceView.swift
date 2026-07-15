import SwiftUI

// MARK: - Chronic Absence Alert System
// Head Start Performance Standards §1302.21 — programs must have written attendance
// policies and support children at risk of chronic absence (below 85% threshold).

struct ChronicAbsenceView: View {
    @StateObject private var vm = ChronicAbsenceViewModel()
    @State private var selectedFilter: RiskFilter = .all
    @State private var showOutreachSheet: ChronicAbsenceAlert? = nil
    @State private var showGenerateAIP: ChronicAbsenceAlert? = nil

    enum RiskFilter: String, CaseIterable {
        case all = "All"
        case severe = "Severe"
        case high = "High"
        case atRisk = "At Risk"
        case watch = "Watch"
    }

    var filteredAlerts: [ChronicAbsenceAlert] {
        let sorted = vm.alerts.sorted { $0.riskLevel.priority < $1.riskLevel.priority }
        switch selectedFilter {
        case .all:    return sorted
        case .severe: return sorted.filter { $0.riskLevel == .severe }
        case .high:   return sorted.filter { $0.riskLevel == .high }
        case .atRisk: return sorted.filter { $0.riskLevel == .at_risk }
        case .watch:  return sorted.filter { $0.riskLevel == .watch }
        }
    }

    var body: some View {
        HeadStartGate(featureDescription: "Chronic absence tracking") {
        List {
            // ── Program summary ────────────────────────────────────
            Section {
                ChronicAbsenceSummaryCard(alerts: vm.alerts)
            }
            .listRowInsets(.init())
            .listRowBackground(Color.clear)

            // ── Filter pills ───────────────────────────────────────
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(RiskFilter.allCases, id: \.self) { filter in
                            AbsenceFilterPill(
                                label: filter.rawValue,
                                count: countFor(filter),
                                color: colorFor(filter),
                                isSelected: selectedFilter == filter
                            ) { selectedFilter = filter }
                        }
                    }
                    .padding(.horizontal, 4)
                }
            }
            .listRowInsets(.init(.init(top: 0, leading: 12, bottom: 0, trailing: 12)))
            .listRowBackground(Color.clear)

            // ── Child alert rows ───────────────────────────────────
            Section {
                if filteredAlerts.isEmpty {
                    Text("No children in this category")
                        .font(.subheadline)
                        .foregroundColor(.cfTextSecondary)
                } else {
                    ForEach(filteredAlerts) { alert in
                        NavigationLink(destination: ChronicAbsenceDetailView(
                            alert: alert,
                            onOutreach: { showOutreachSheet = alert },
                            onGenerateAIP: { showGenerateAIP = alert },
                            onUpdate: { Task { await vm.load() } }
                        )) {
                            ChronicAbsenceRow(alert: alert)
                        }
                    }
                }
            } header: {
                HStack {
                    Text("Children (\(filteredAlerts.count))")
                    Spacer()
                    if !filteredAlerts.filter({ !$0.hasAIP && $0.riskLevel.needsAIP }).isEmpty {
                        Text("\(filteredAlerts.filter { !$0.hasAIP && $0.riskLevel.needsAIP }.count) need AIP")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.cfHealth)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Chronic Absence")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $showOutreachSheet) { alert in
            OutreachMessageSheet(alert: alert)
        }
        .sheet(item: $showGenerateAIP) { alert in
            GenerateAIPSheet(alert: alert) { plan in
                vm.aipPlans.append(plan)
            }
        }
        .task { await vm.load() }
        .refreshable { await vm.load() }
        .overlay { if vm.isLoading { ProgressView() } }
        }
    }

    private func countFor(_ filter: RiskFilter) -> Int {
        switch filter {
        case .all:    return vm.alerts.count
        case .severe: return vm.alerts.filter { $0.riskLevel == .severe }.count
        case .high:   return vm.alerts.filter { $0.riskLevel == .high }.count
        case .atRisk: return vm.alerts.filter { $0.riskLevel == .at_risk }.count
        case .watch:  return vm.alerts.filter { $0.riskLevel == .watch }.count
        }
    }

    private func colorFor(_ filter: RiskFilter) -> Color {
        switch filter {
        case .all: return .cfPrimary
        case .severe: return Color(red: 0.85, green: 0.1, blue: 0.1)
        case .high: return .cfHealth
        case .atRisk: return Color(red: 0.9, green: 0.4, blue: 0.1)
        case .watch: return .orange
        }
    }
}

// MARK: - Summary Card

private struct ChronicAbsenceSummaryCard: View {
    let alerts: [ChronicAbsenceAlert]

    var avgRate: Double {
        guard !alerts.isEmpty else { return 1.0 }
        return alerts.reduce(0) { $0 + $1.attendanceRate } / Double(alerts.count)
    }

    var severeCount: Int { alerts.filter { $0.riskLevel == .severe || $0.riskLevel == .high }.count }
    var needAIP: Int { alerts.filter { !$0.hasAIP && $0.riskLevel.needsAIP }.count }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                AbsenceStat(value: "\(alerts.count)",
                            label: "At Risk",
                            color: .cfHealth, icon: "person.badge.exclamationmark.fill")
                Divider().frame(height: 48)
                AbsenceStat(value: "\(severeCount)",
                            label: "Severe/High",
                            color: Color(red: 0.85, green: 0.1, blue: 0.1),
                            icon: "exclamationmark.octagon.fill")
                Divider().frame(height: 48)
                AbsenceStat(value: "\(needAIP)",
                            label: "Need AIP",
                            color: needAIP > 0 ? .cfHealth : .cfAttendance,
                            icon: "doc.badge.plus")
                Divider().frame(height: 48)
                AbsenceStat(value: "\(Int(avgRate * 100))%",
                            label: "Avg Rate",
                            color: avgRate >= 0.85 ? .cfAttendance : .cfHealth,
                            icon: "chart.bar.fill")
            }
            .padding(.vertical, 14)
            .background(Color.cfSurface)

            // 85% threshold bar
            HStack {
                Image(systemName: "85.percent")
                    .font(.caption2)
                    .foregroundColor(.cfTextSecondary)
                Text("Head Start minimum attendance threshold")
                    .font(.caption2)
                    .foregroundColor(.cfTextSecondary)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color.cfHealth.opacity(0.05))
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .cfCardShadow()
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

private struct AbsenceStat: View {
    let value: String; let label: String; let color: Color; let icon: String
    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 13, weight: .semibold)).foregroundColor(color)
            Text(value).font(.title2.weight(.bold)).foregroundColor(.cfTextPrimary)
            Text(label).font(.caption2).foregroundColor(.cfTextSecondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Filter Pill

private struct AbsenceFilterPill: View {
    let label: String; let count: Int; let color: Color
    let isSelected: Bool; let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(label)
                if count > 0 {
                    Text("\(count)")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(isSelected ? Color.white.opacity(0.3) : color.opacity(0.2))
                        .clipShape(Capsule())
                }
            }
            .font(.caption.weight(.medium))
            .foregroundColor(isSelected ? .white : color)
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(isSelected ? color : color.opacity(0.1))
            .clipShape(Capsule())
        }
    }
}

// MARK: - Alert Row

private struct ChronicAbsenceRow: View {
    let alert: ChronicAbsenceAlert

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(alert.childName).font(.subheadline.weight(.semibold))
                    Text(alert.classroom).font(.caption).foregroundColor(.cfTextSecondary)
                }
                Spacer()
                RiskBadge(level: alert.riskLevel)
            }

            HStack(spacing: 12) {
                // Attendance gauge
                AttendanceGauge(rate: alert.attendanceRate, size: 36)

                VStack(alignment: .leading, spacing: 3) {
                    Text("\(alert.totalDaysPresent)/\(alert.totalDaysEnrolled) days present")
                        .font(.caption.weight(.medium))
                    Text("\(alert.totalDaysAbsent) absent (\(alert.unexcusedAbsences) unexcused)")
                        .font(.caption2).foregroundColor(.cfTextSecondary)
                    if alert.consecutiveAbsences > 0 {
                        Label("\(alert.consecutiveAbsences) consecutive absences",
                              systemImage: "exclamationmark.circle.fill")
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(alert.consecutiveAbsences >= 3 ? .cfHealth : .orange)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 3) {
                    if alert.hasAIP {
                        Label("AIP Active", systemImage: "doc.fill")
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(.cfPrimary)
                    } else if alert.riskLevel.needsAIP {
                        Text("Needs AIP")
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(.cfHealth)
                    }
                    if let last = alert.lastOutreachDate {
                        Text("Contacted \(last.formatted(date: .abbreviated, time: .omitted))")
                            .font(.caption2).foregroundColor(.cfTextSecondary)
                    }
                }
            }

            // Mini trend sparkline
            AttendanceTrendBar(weeklyRates: alert.weeklyRates)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Attendance Gauge (circular)

struct AttendanceGauge: View {
    let rate: Double
    let size: CGFloat

    var color: Color {
        if rate < 0.75 { return .cfHealth }
        if rate < 0.85 { return .orange }
        return .cfAttendance
    }

    var body: some View {
        ZStack {
            Circle().stroke(Color.cfBorder, lineWidth: 4)
            Circle().trim(from: 0, to: rate)
                .stroke(color, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int(rate * 100))%")
                .font(.system(size: size * 0.28, weight: .bold))
                .foregroundColor(color)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Mini trend bar

struct AttendanceTrendBar: View {
    let weeklyRates: [Double]

    var body: some View {
        HStack(spacing: 4) {
            Text("4-week trend:").font(.caption2).foregroundColor(.cfTextSecondary)
            ForEach(weeklyRates.indices, id: \.self) { i in
                let rate = weeklyRates[i]
                let color: Color = rate >= 0.85 ? .cfAttendance : rate >= 0.75 ? .orange : .cfHealth
                RoundedRectangle(cornerRadius: 2)
                    .fill(color)
                    .frame(width: 18, height: 10)
                    .overlay(
                        Text("\(Int(rate * 100))")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundColor(.white)
                    )
            }
        }
    }
}

// MARK: - Risk Badge

struct RiskBadge: View {
    let level: ChronicAbsenceAlert.RiskLevel
    var body: some View {
        Label(level.rawValue, systemImage: level.icon)
            .font(.caption2.weight(.semibold))
            .foregroundColor(level.color)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(level.color.opacity(0.1))
            .clipShape(Capsule())
            .lineLimit(1)
    }
}

// MARK: - Chronic Absence Detail View

struct ChronicAbsenceDetailView: View {
    let alert: ChronicAbsenceAlert
    let onOutreach: () -> Void
    let onGenerateAIP: () -> Void
    let onUpdate: () -> Void

    var body: some View {
        List {
            // ── Risk summary ───────────────────────────────────────
            Section {
                HStack(spacing: 16) {
                    AttendanceGauge(rate: alert.attendanceRate, size: 64)
                    VStack(alignment: .leading, spacing: 6) {
                        RiskBadge(level: alert.riskLevel)
                        Text("\(alert.totalDaysPresent) of \(alert.totalDaysEnrolled) days")
                            .font(.subheadline.weight(.semibold))
                        Text("\(alert.totalDaysAbsent) absences — \(alert.unexcusedAbsences) unexcused")
                            .font(.caption).foregroundColor(.cfTextSecondary)
                        AttendanceTrendBar(weeklyRates: alert.weeklyRates)
                    }
                }
                .padding(.vertical, 6)
            }

            // ── Actions ────────────────────────────────────────────
            Section("Quick Actions") {
                Button {
                    onOutreach()
                } label: {
                    Label("Draft Outreach Message", systemImage: "envelope.fill")
                        .foregroundColor(.cfPrimary)
                        .font(.subheadline.weight(.medium))
                }

                if !alert.hasAIP && alert.riskLevel.needsAIP {
                    Button {
                        onGenerateAIP()
                    } label: {
                        Label("Generate Attendance Improvement Plan",
                              systemImage: "doc.badge.plus")
                            .foregroundColor(.cfAttendance)
                            .font(.subheadline.weight(.medium))
                    }
                } else if alert.hasAIP {
                    Label("AIP Already Active", systemImage: "doc.fill")
                        .foregroundColor(.cfPrimary)
                        .font(.subheadline)
                    NavigationLink("View Attendance Plans") {
                        AttendancePlansView()
                    }
                    .font(.caption)
                    .foregroundColor(.cfPrimary)
                }
            }

            // ── Absence breakdown ──────────────────────────────────
            Section("Absence Breakdown") {
                LabeledContent("Unexcused Absences", value: "\(alert.unexcusedAbsences) days")
                LabeledContent("Excused Absences", value: "\(alert.excusedAbsences) days")
                if alert.consecutiveAbsences > 0 {
                    LabeledContent("Current Streak") {
                        Text("\(alert.consecutiveAbsences) consecutive absent")
                            .foregroundColor(alert.consecutiveAbsences >= 3 ? .cfHealth : .orange)
                            .font(.subheadline.weight(.semibold))
                    }
                }
            }

            // ── Staff info ─────────────────────────────────────────
            Section("Assigned Staff") {
                LabeledContent("Family Advocate", value: alert.familyAdvocate)
                LabeledContent("Classroom", value: alert.classroom)
                if let last = alert.lastOutreachDate {
                    LabeledContent("Last Contact",
                                   value: last.formatted(date: .abbreviated, time: .omitted))
                } else {
                    LabeledContent("Last Contact") {
                        Text("No outreach yet").foregroundColor(.cfHealth)
                    }
                }
            }

            if !alert.notes.isEmpty {
                Section("Notes") { Text(alert.notes).font(.subheadline) }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(alert.childName)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Outreach Message Sheet

struct OutreachMessageSheet: View {
    let alert: ChronicAbsenceAlert
    @State private var message: String = ""
    @State private var showCopied = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Channel picker
                HStack(spacing: 12) {
                    ForEach(["Text", "Email", "In-App"], id: \.self) { ch in
                        Text(ch)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(Color.cfPrimary.opacity(0.1))
                            .clipShape(Capsule())
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color.cfSurface)
                Divider()

                TextEditor(text: $message)
                    .padding()
                    .font(.subheadline)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .navigationTitle("Outreach to \(alert.childName.components(separatedBy: " ").last ?? "Family")")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(showCopied ? "Copied!" : "Copy & Send") {
                        UIPasteboard.general.string = message
                        showCopied = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { dismiss() }
                    }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Reset") {
                        message = alert.outreachMessage(advocateName: alert.familyAdvocate)
                    }
                }
            }
            .onAppear {
                message = alert.outreachMessage(advocateName: alert.familyAdvocate)
            }
        }
    }
}

// MARK: - Generate AIP Sheet

struct GenerateAIPSheet: View {
    let alert: ChronicAbsenceAlert
    let onSave: (AttendanceSuccessPlan) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var selectedBarriers: Set<String> = []
    @State private var selectedStrategies: Set<String> = []
    @State private var customBarrier = ""
    @State private var reviewDate = Calendar.current.date(byAdding: .day, value: 30, to: Date())!

    let commonBarriers = [
        "Transportation difficulty",
        "Illness (child)",
        "Parent work schedule conflict",
        "Housing instability",
        "Childcare for siblings",
        "Lack of alarm/wake-up routine",
        "Weather / distance",
        "Family emergency",
        "Language barrier",
    ]

    let suggestedStrategies = [
        "Connect family to transportation assistance",
        "Establish morning routine check-in",
        "Home visit to assess barriers",
        "Flexible drop-off arrangement",
        "Daily attendance phone call",
        "Weekly attendance report to family",
        "Peer buddy program",
        "Family attendance contract",
        "Incentive program (certificates, recognition)",
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Child", value: alert.childName)
                    LabeledContent("Current Rate", value: "\(Int(alert.attendanceRate * 100))%")
                    DatePicker("Review Date", selection: $reviewDate,
                               in: Date()..., displayedComponents: .date)
                } header: {
                    Text("Attendance Improvement Plan")
                }

                Section("Barriers to Attendance") {
                    ForEach(commonBarriers, id: \.self) { barrier in
                        Button {
                            if selectedBarriers.contains(barrier) { selectedBarriers.remove(barrier) }
                            else { selectedBarriers.insert(barrier) }
                        } label: {
                            HStack {
                                Text(barrier).foregroundColor(.primary)
                                Spacer()
                                if selectedBarriers.contains(barrier) {
                                    Image(systemName: "checkmark.circle.fill").foregroundColor(.cfPrimary)
                                }
                            }
                        }
                    }
                    HStack {
                        TextField("Add custom barrier…", text: $customBarrier)
                        Button("Add") {
                            if !customBarrier.isEmpty {
                                selectedBarriers.insert(customBarrier)
                                customBarrier = ""
                            }
                        }
                        .disabled(customBarrier.isEmpty)
                    }
                }

                Section("Strategies") {
                    ForEach(suggestedStrategies, id: \.self) { strategy in
                        Button {
                            if selectedStrategies.contains(strategy) { selectedStrategies.remove(strategy) }
                            else { selectedStrategies.insert(strategy) }
                        } label: {
                            HStack {
                                Text(strategy).foregroundColor(.primary)
                                Spacer()
                                if selectedStrategies.contains(strategy) {
                                    Image(systemName: "checkmark.circle.fill").foregroundColor(.cfAttendance)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Generate AIP")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create AIP") {
                        let plan = AttendanceSuccessPlan(
                            id: UUID().uuidString,
                            childId: alert.childId,
                            childName: alert.childName,
                            classroom: alert.classroom,
                            currentAttendanceRate: alert.attendanceRate,
                            createdDate: Date(),
                            reviewDate: reviewDate,
                            familyAdvocate: alert.familyAdvocate,
                            barriers: Array(selectedBarriers),
                            strategies: selectedStrategies.map {
                                AttendancePlanStrategy(id: UUID().uuidString, description: $0,
                                                       isImplemented: false, targetDate: nil)
                            },
                            status: .active
                        )
                        Task { try? await APIClient.shared.createAttendancePlan(plan) }
                        onSave(plan)
                        dismiss()
                    }
                    .disabled(selectedBarriers.isEmpty && selectedStrategies.isEmpty)
                }
            }
        }
    }
}

// MARK: - ViewModel

@MainActor
final class ChronicAbsenceViewModel: ObservableObject {
    @Published var alerts: [ChronicAbsenceAlert] = []
    @Published var aipPlans: [AttendanceSuccessPlan] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        async let a = loadAlerts()
        async let p = loadPlans()
        (alerts, aipPlans) = await (a, p)
        isLoading = false
    }

    private func loadAlerts() async -> [ChronicAbsenceAlert] {
        do { return try await APIClient.shared.getChronicAbsenceAlerts() }
        catch {
            #if DEBUG
            return MockData.chronicAbsenceAlerts()
            #else
            return []
            #endif
        }
    }

    private func loadPlans() async -> [AttendanceSuccessPlan] {
        do { return try await APIClient.shared.getAttendancePlans() }
        catch { return [] }
    }
}
