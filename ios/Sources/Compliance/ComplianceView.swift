import SwiftUI

// MARK: - Helpers

/// Recent PIR program years, current first. The PIR year starts in the fall.
func recentProgramYears() -> [String] {
    let cal = Calendar.current
    let comps = cal.dateComponents([.year, .month], from: Date())
    let y = comps.year ?? 2026
    let m = comps.month ?? 1
    let start = m >= 9 ? y : y - 1
    return (0..<4).map { "\(start - $0)-\(start - $0 + 1)" }
}

struct PIRSubGroup: Identifiable { let id: String; let title: String; let items: [PIRQuestion] }
struct PIRGroup: Identifiable { let id: String; let section: String; let subs: [PIRSubGroup] }

/// Group catalog questions by section → subsection, preserving catalog order.
func pirGroupBySection(_ questions: [PIRQuestion]) -> [PIRGroup] {
    var order: [String] = []
    var subOrder: [String: [String]] = [:]
    var map: [String: [String: [PIRQuestion]]] = [:]
    for q in questions {
        if map[q.section] == nil { map[q.section] = [:]; subOrder[q.section] = []; order.append(q.section) }
        let sub = q.subsection ?? "General"
        if map[q.section]![sub] == nil { map[q.section]![sub] = []; subOrder[q.section]!.append(sub) }
        map[q.section]![sub]!.append(q)
    }
    return order.map { sec in
        PIRGroup(id: sec, section: sec, subs: subOrder[sec]!.map { s in PIRSubGroup(id: "\(sec)/\(s)", title: s, items: map[sec]![s]!) })
    }
}

/// Render a stored value for reading. nil = unanswered.
func pirDisplay(_ q: PIRQuestion) -> String? {
    guard let v = q.value, !v.isEmpty else { return nil }
    switch q.valueType {
    case "boolean": return v == "true" ? "Yes" : "No"
    case "percent": return "\(v)%"
    default: return v
    }
}

func pirStatusColor(_ status: String) -> Color {
    switch status {
    case "submitted": return .cfPrimary
    case "accepted": return .cfAttendance
    default: return .cfTextSecondary
    }
}

func pirStatusLabel(_ status: String) -> String { status.prefix(1).uppercased() + status.dropFirst() }

// MARK: - Compliance host (tabs mirror the web: PIR Report / Monitoring / History)

struct ComplianceView: View {
    @State private var tab = 0

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $tab) {
                Text("PIR Report").tag(0)
                Text("Monitoring").tag(1)
                Text("History").tag(2)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 8)

            switch tab {
            case 0: PIRReportEditorView()
            case 1: MonitoringChecklistView()
            default: PIRHistoryView()
            }
        }
        .navigationTitle("Compliance & PIR")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - PIR Report editor

@MainActor
final class PIRReportViewModel: ObservableObject {
    @Published var detail: PIRReportDetail?
    @Published var edits: [String: String] = [:]
    @Published var isLoading = false
    @Published var savingCount = 0
    @Published var errorMessage: String?
    @Published var year: String

    init(year: String) { self.year = year }

    var status: String { detail?.status ?? "draft" }
    var locked: Bool { status != "draft" }
    var total: Int { detail?.totalQuestions ?? 0 }
    var answered: Int {
        (detail?.questions ?? []).filter { !(edits[$0.code] ?? $0.value ?? "").isEmpty }.count
    }
    var percent: Int { total > 0 ? Int((Double(answered) / Double(total)) * 100) : 0 }

    func value(for q: PIRQuestion) -> String { edits[q.code] ?? q.value ?? "" }

    func binding(for q: PIRQuestion) -> Binding<String> {
        Binding(get: { self.edits[q.code] ?? q.value ?? "" }, set: { self.edits[q.code] = $0 })
    }

    func changeYear(_ y: String) {
        year = y
        Task { await load() }
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            detail = try await APIClient.shared.getPIRReport(year: year)
            edits = [:]
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load the PIR report."
        }
    }

    /// Persist one field if it differs from the loaded value.
    func flush(code: String) {
        guard let v = edits[code] else { return }
        if let q = detail?.questions.first(where: { $0.code == code }), (q.value ?? "") == v { return }
        Task { await save(code: code, value: v) }
    }

    /// Local + immediate network save (for toggles / pickers).
    func commitNow(_ code: String, _ value: String) {
        edits[code] = value
        Task { await save(code: code, value: value) }
    }

    private func save(code: String, value: String) async {
        savingCount += 1
        defer { savingCount -= 1 }
        do {
            try await APIClient.shared.setPIRValue(year: year, code: code, value: value)
            if let i = detail?.questions.firstIndex(where: { $0.code == code }) {
                detail?.questions[i].value = value
            }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't save that value."
        }
    }

    private func flushAll() async {
        for (code, v) in edits {
            if let q = detail?.questions.first(where: { $0.code == code }), (q.value ?? "") != v {
                await save(code: code, value: v)
            }
        }
    }

    func submit() async {
        await flushAll()
        do { try await APIClient.shared.submitPIR(year: year); await load() }
        catch { errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't submit." }
    }

    func reopen() async {
        do { try await APIClient.shared.reopenPIR(year: year); await load() }
        catch { errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't reopen." }
    }
}

struct PIRReportEditorView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var vm = PIRReportViewModel(year: recentProgramYears().first ?? "2025-2026")
    @State private var search = ""
    @State private var onlyUnanswered = false
    @FocusState private var focusedCode: String?
    private let years = recentProgramYears()

    private var canEdit: Bool { appState.isAdmin && !vm.locked }

    private func matches(_ q: PIRQuestion) -> Bool {
        let t = search.trimmingCharacters(in: .whitespaces).lowercased()
        let textOK = t.isEmpty || q.label.lowercased().contains(t) || (q.subsection ?? "").lowercased().contains(t)
        let ansOK = !onlyUnanswered || vm.value(for: q).isEmpty
        return textOK && ansOK
    }

    private var saveStatus: (String, Color) {
        if vm.savingCount > 0 { return ("Saving…", .cfTextSecondary) }
        if !vm.edits.isEmpty { return ("All changes saved", .cfSuccess) }
        return ("Autosaves as you type", .cfTextSecondary)
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14) {
                header
                controls
                if vm.isLoading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 30)
                } else if vm.total == 0 {
                    Text("No PIR questions found. Seed the catalog on the server first.")
                        .font(.cfSubheadline).foregroundColor(.cfTextSecondary).padding()
                } else {
                    sections
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 32)
        }
        .searchable(text: $search, prompt: "Search fields (e.g. dental, enrollment)")
        .task { if vm.detail == nil { await vm.load() } }
        .alert("PIR", isPresented: .constant(vm.errorMessage != nil), actions: {
            Button("OK") { vm.errorMessage = nil }
        }, message: { Text(vm.errorMessage ?? "") })
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text("PIR Completion").font(.cfSubheadline).foregroundColor(.cfTextSecondary)
                        Text(pirStatusLabel(vm.status))
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(pirStatusColor(vm.status).opacity(0.15))
                            .foregroundColor(pirStatusColor(vm.status))
                            .clipShape(Capsule())
                    }
                    Text("\(vm.percent)%").font(.system(size: 36, weight: .bold)).foregroundColor(.cfPrimary)
                    Text("\(vm.answered) of \(vm.total) fields entered").font(.cfCaption).foregroundColor(.cfTextSecondary)
                }
                Spacer()
                Menu {
                    ForEach(years, id: \.self) { y in
                        Button(y) { vm.changeYear(y) }
                    }
                } label: {
                    HStack(spacing: 4) { Text(vm.year); Image(systemName: "chevron.down") }
                        .font(.cfSubheadline).foregroundColor(.cfPrimary)
                }
            }
            ProgressView(value: Double(vm.percent), total: 100).tint(.cfPrimary)
            if appState.isAdmin {
                if vm.locked {
                    Button { Task { await vm.reopen() } } label: {
                        Label("Reopen for edits", systemImage: "arrow.uturn.backward").font(.cfSubheadline)
                    }.buttonStyle(.bordered).tint(.cfPrimary)
                } else {
                    Button { Task { await vm.submit() } } label: {
                        Label("Submit PIR", systemImage: "paperplane.fill").font(.cfSubheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }.buttonStyle(.borderedProminent).tint(.cfPrimary)
                }
            } else {
                Label("Read-only — PIR edits require an admin account.", systemImage: "lock.fill")
                    .font(.cfCaption).foregroundColor(.cfTextSecondary)
            }
        }
        .padding(16)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var controls: some View {
        HStack {
            Toggle(isOn: $onlyUnanswered) { Text("Only unanswered").font(.cfCaption) }
                .toggleStyle(.switch).tint(.cfPrimary).fixedSize()
            Spacer()
            Text(saveStatus.0).font(.cfCaption).foregroundColor(saveStatus.1)
        }
    }

    private var sections: some View {
        ForEach(pirGroupBySection(vm.detail?.questions ?? [])) { group in
            let visibleSubs = group.subs.compactMap { sub -> PIRSubGroup? in
                let items = sub.items.filter(matches)
                return items.isEmpty ? nil : PIRSubGroup(id: sub.id, title: sub.title, items: items)
            }
            if !visibleSubs.isEmpty {
                let done = group.subs.flatMap { $0.items }.filter { !vm.value(for: $0).isEmpty }.count
                let count = group.subs.flatMap { $0.items }.count
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(group.section).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                        Spacer()
                        Text("\(done)/\(count)").font(.cfCaption).foregroundColor(.cfTextSecondary)
                    }
                    ForEach(visibleSubs) { sub in
                        Text(sub.title.uppercased()).font(.cfCaption2).foregroundColor(.cfTextSecondary)
                        ForEach(sub.items) { q in
                            fieldRow(q)
                            Divider()
                        }
                    }
                }
                .padding(14)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private func fieldRow(_ q: PIRQuestion) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(q.label).font(.cfSubheadline).foregroundColor(.cfTextPrimary)
                if let paired = q.paired {
                    Text(paired == "eoy" ? "end of year" : "at enrollment")
                        .font(.cfCaption2).foregroundColor(.cfTextSecondary)
                }
            }
            Spacer(minLength: 8)
            fieldInput(q)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func fieldInput(_ q: PIRQuestion) -> some View {
        switch q.valueType {
        case "boolean":
            Toggle("", isOn: Binding(
                get: { vm.value(for: q) == "true" },
                set: { vm.commitNow(q.code, $0 ? "true" : "false") }
            )).labelsHidden().tint(.cfPrimary).disabled(!canEdit)
        case "enum":
            Menu {
                ForEach(q.options ?? [], id: \.self) { opt in
                    Button(opt) { vm.commitNow(q.code, opt) }
                }
            } label: {
                Text(vm.value(for: q).isEmpty ? "Select…" : vm.value(for: q))
                    .font(.cfCaption)
                    .foregroundColor(vm.value(for: q).isEmpty ? .cfTextSecondary : .cfTextPrimary)
                    .lineLimit(1)
            }.disabled(!canEdit)
        case "text":
            TextField("—", text: vm.binding(for: q), axis: .vertical)
                .font(.cfCaption).multilineTextAlignment(.trailing)
                .frame(maxWidth: 160)
                .focused($focusedCode, equals: q.code)
                .disabled(!canEdit)
                .onChange(of: focusedCode) { old, _ in if old == q.code { vm.flush(code: q.code) } }
        default: // integer | percent
            HStack(spacing: 4) {
                TextField("0", text: vm.binding(for: q))
                    .keyboardType(.numberPad).multilineTextAlignment(.trailing)
                    .frame(width: 72)
                    .textFieldStyle(.roundedBorder)
                    .focused($focusedCode, equals: q.code)
                    .disabled(!canEdit)
                    .onChange(of: focusedCode) { old, _ in if old == q.code { vm.flush(code: q.code) } }
                if q.valueType == "percent" { Text("%").font(.cfCaption).foregroundColor(.cfTextSecondary) }
            }
        }
    }
}

// MARK: - Report history (tap a year → read it inline, no download)

@MainActor
final class PIRHistoryViewModel: ObservableObject {
    @Published var reports: [PIRReportSummary] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        defer { isLoading = false }
        reports = (try? await APIClient.shared.listPIRReports()) ?? []
    }
}

struct PIRHistoryView: View {
    @StateObject private var vm = PIRHistoryViewModel()
    @State private var openYear: String?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if vm.isLoading {
                    ProgressView().padding(.top, 30)
                } else if vm.reports.isEmpty {
                    Text("No PIR reports yet. Start one in the PIR Report tab.")
                        .font(.cfSubheadline).foregroundColor(.cfTextSecondary).padding()
                }
                ForEach(vm.reports) { r in
                    VStack(spacing: 0) {
                        Button { withAnimation { openYear = (openYear == r.year ? nil : r.year) } } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "chevron.right")
                                    .font(.caption.weight(.semibold)).foregroundColor(.cfTextSecondary)
                                    .rotationEffect(.degrees(openYear == r.year ? 90 : 0))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("Program Year \(r.year)").font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                                    Text("\(r.answered) of \(r.total) fields • \(r.total > 0 ? Int(Double(r.answered)/Double(r.total)*100) : 0)%")
                                        .font(.cfCaption).foregroundColor(.cfTextSecondary)
                                }
                                Spacer()
                                Text(pirStatusLabel(r.status))
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 8).padding(.vertical, 2)
                                    .background(pirStatusColor(r.status).opacity(0.15))
                                    .foregroundColor(pirStatusColor(r.status))
                                    .clipShape(Capsule())
                            }
                            .padding(14)
                        }
                        .buttonStyle(.plain)
                        if openYear == r.year {
                            Divider()
                            PIRReportReadOnlyView(year: r.year).padding(14)
                        }
                    }
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 32)
        }
        .task { await vm.load() }
    }
}

// MARK: - Read-only report document

@MainActor
final class PIRReadOnlyViewModel: ObservableObject {
    @Published var detail: PIRReportDetail?
    @Published var isLoading = false

    func load(year: String) async {
        isLoading = true
        defer { isLoading = false }
        detail = try? await APIClient.shared.getPIRReport(year: year)
    }
}

struct PIRReportReadOnlyView: View {
    let year: String
    @StateObject private var vm = PIRReadOnlyViewModel()
    @State private var showEmpty = false

    private var shareText: String {
        guard let d = vm.detail else { return "" }
        var lines = ["Program Information Report — \(year) (\(d.status))", ""]
        for g in pirGroupBySection(d.questions) {
            lines.append(g.section)
            for sub in g.subs {
                for q in sub.items where (pirDisplay(q) != nil) {
                    lines.append("  \(q.label): \(pirDisplay(q) ?? "")")
                }
            }
            lines.append("")
        }
        return lines.joined(separator: "\n")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if vm.isLoading {
                ProgressView()
            } else if let d = vm.detail {
                HStack {
                    Toggle(isOn: $showEmpty) { Text("Show empty fields").font(.cfCaption) }
                        .toggleStyle(.switch).tint(.cfPrimary).fixedSize()
                    Spacer()
                    ShareLink(item: shareText) {
                        Label("Export", systemImage: "square.and.arrow.up").font(.cfCaption)
                    }
                }
                ForEach(pirGroupBySection(d.questions)) { group in
                    let subs = group.subs.compactMap { sub -> PIRSubGroup? in
                        let items = sub.items.filter { showEmpty || pirDisplay($0) != nil }
                        return items.isEmpty ? nil : PIRSubGroup(id: sub.id, title: sub.title, items: items)
                    }
                    if !subs.isEmpty {
                        Text(group.section).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                        ForEach(subs) { sub in
                            Text(sub.title.uppercased()).font(.cfCaption2).foregroundColor(.cfTextSecondary)
                            ForEach(sub.items) { q in
                                HStack(alignment: .top) {
                                    Text(q.label).font(.cfCaption).foregroundColor(.cfTextSecondary)
                                    Spacer(minLength: 8)
                                    Text(pirDisplay(q) ?? "—")
                                        .font(.cfCaption.weight(.medium))
                                        .foregroundColor(pirDisplay(q) == nil ? .cfTextSecondary.opacity(0.5) : .cfTextPrimary)
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                }
            }
        }
        .task { await vm.load(year: year) }
    }
}

// MARK: - Program monitoring checklist (program-level compliance, mock parity with web)

struct MonitoringChecklistView: View {
    @State private var items: [ComplianceChecklistItem] = [
        ComplianceChecklistItem(id: "c1", title: "Child-to-staff ratios maintained", isCompliant: true, note: "All classrooms within required ratios"),
        ComplianceChecklistItem(id: "c2", title: "Health & safety checks", isCompliant: true, note: "Monthly safety inspections completed"),
        ComplianceChecklistItem(id: "c3", title: "Fiscal management", isCompliant: true, note: "Budget on track, no findings"),
        ComplianceChecklistItem(id: "c4", title: "Program governance", isCompliant: true, note: "Policy council meetings held monthly"),
        ComplianceChecklistItem(id: "c5", title: "Transportation safety", isCompliant: false, note: "2 buses due for safety inspection"),
        ComplianceChecklistItem(id: "c6", title: "Food service (CACFP)", isCompliant: true, note: "Records up to date"),
    ]

    var body: some View {
        List {
            Section("Program Monitoring") {
                ForEach($items) { $item in
                    HStack(spacing: 12) {
                        Image(systemName: item.isCompliant ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                            .foregroundColor(item.isCompliant ? .cfAttendance : .cfHealth)
                            .font(.system(size: 18))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title).font(.cfSubheadline).foregroundColor(.cfTextPrimary)
                            if let note = item.note {
                                Text(note).font(.cfCaption).foregroundColor(.cfTextSecondary)
                            }
                        }
                        Spacer()
                        Toggle("", isOn: $item.isCompliant).labelsHidden().tint(.cfPrimary)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }
}
