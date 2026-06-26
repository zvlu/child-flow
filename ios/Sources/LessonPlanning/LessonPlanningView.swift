import SwiftUI

private let LESSON_DAYS: [(value: String, label: String)] = [
    ("monday", "Monday"), ("tuesday", "Tuesday"), ("wednesday", "Wednesday"),
    ("thursday", "Thursday"), ("friday", "Friday"),
]
private func ymd(_ d: Date) -> String {
    let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: d)
}

// MARK: - List

@MainActor
final class LessonPlansViewModel: ObservableObject {
    @Published var plans: [LessonPlanSummary] = []
    @Published var classrooms: [ClassroomSummary] = []
    @Published var isLoading = false
    @Published var posting = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let p = APIClient.shared.getLessonPlans()
            async let c = APIClient.shared.getClassrooms()
            plans = try await p
            classrooms = try await c
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load lesson plans."
        }
    }

    func create(classroomId: String, week: String, theme: String) async -> Bool {
        posting = true
        defer { posting = false }
        do {
            try await APIClient.shared.createLessonPlan(classroomId: classroomId, weekStartDate: week, title: nil, theme: theme.isEmpty ? nil : theme)
            plans = (try? await APIClient.shared.getLessonPlans()) ?? plans
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't create plan."
            return false
        }
    }
}

struct LessonPlanningView: View {
    @StateObject private var vm = LessonPlansViewModel()
    @State private var showNew = false

    var body: some View {
        List {
            if vm.plans.isEmpty && !vm.isLoading {
                Text("No lesson plans yet. Tap + to plan a classroom's week.")
                    .font(.cfSubheadline).foregroundColor(.cfTextSecondary)
            }
            ForEach(vm.plans) { p in
                NavigationLink(destination: LessonPlanDetailView(planId: p.id)) {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(p.classroomName).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                            Spacer()
                            Text(p.status.capitalized).font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 8).padding(.vertical, 2)
                                .background((p.status == "published" ? Color.cfAttendance : Color.cfTextSecondary).opacity(0.15))
                                .foregroundColor(p.status == "published" ? .cfAttendance : .cfTextSecondary).clipShape(Capsule())
                        }
                        if let w = p.weekStartDate { Text("Week of \(w)").font(.cfCaption).foregroundColor(.cfTextSecondary) }
                        if !p.theme.isEmpty { Text("Theme: \(p.theme)").font(.cfCaption).foregroundColor(.cfTextSecondary) }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("Lesson Planning")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) { Button { showNew = true } label: { Image(systemName: "plus") } }
        }
        .task { await vm.load() }
        .sheet(isPresented: $showNew) { NewLessonPlanSheet(vm: vm, isPresented: $showNew) }
        .overlay { if vm.isLoading { ProgressView() } }
        .alert("Lesson Planning", isPresented: .constant(vm.errorMessage != nil)) {
            Button("OK") { vm.errorMessage = nil }
        } message: { Text(vm.errorMessage ?? "") }
    }
}

private struct NewLessonPlanSheet: View {
    @ObservedObject var vm: LessonPlansViewModel
    @Binding var isPresented: Bool
    @State private var classroomId = ""
    @State private var week = Date()
    @State private var theme = ""

    var body: some View {
        NavigationStack {
            Form {
                Picker("Classroom", selection: $classroomId) {
                    Text("Select…").tag("")
                    ForEach(vm.classrooms) { c in Text(c.name).tag(c.id) }
                }
                DatePicker("Week starting", selection: $week, displayedComponents: .date)
                TextField("Theme (optional)", text: $theme)
            }
            .navigationTitle("New Lesson Plan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { if await vm.create(classroomId: classroomId, week: ymd(week), theme: theme) { isPresented = false } }
                    }
                    .disabled(classroomId.isEmpty || vm.posting)
                }
            }
        }
    }
}

// MARK: - Detail

@MainActor
final class LessonPlanDetailViewModel: ObservableObject {
    @Published var detail: LessonPlanDetail?
    @Published var isLoading = false
    @Published var posting = false
    @Published var errorMessage: String?

    func load(_ id: String) async {
        isLoading = true
        defer { isLoading = false }
        detail = try? await APIClient.shared.getLessonPlan(id: id)
    }

    func addActivity(planId: String, day: String, title: String, desc: String, domain: String) async -> Bool {
        posting = true
        defer { posting = false }
        do {
            try await APIClient.shared.addLessonActivity(planId: planId, dayOfWeek: day, title: title, description: desc.isEmpty ? nil : desc, domain: domain.isEmpty ? nil : domain)
            await load(planId)
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't add activity."
            return false
        }
    }

    func togglePublish(planId: String) async {
        let publish = detail?.status != "published"
        try? await APIClient.shared.publishLessonPlan(id: planId, published: publish)
        await load(planId)
    }
}

struct LessonPlanDetailView: View {
    let planId: String
    @StateObject private var vm = LessonPlanDetailViewModel()
    @State private var showAdd = false

    var body: some View {
        List {
            if let d = vm.detail {
                ForEach(LESSON_DAYS, id: \.value) { day in
                    let acts = d.activities.filter { $0.dayOfWeek == day.value }
                    Section(day.label) {
                        if acts.isEmpty {
                            Text("No activities").font(.cfCaption).foregroundColor(.cfTextSecondary)
                        }
                        ForEach(acts) { a in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(a.title).font(.cfSubheadline).foregroundColor(.cfTextPrimary)
                                if !a.description.isEmpty { Text(a.description).font(.cfCaption).foregroundColor(.cfTextSecondary) }
                                if let dl = domainLabel(a.domain) {
                                    Text(dl).font(.system(size: 10, weight: .bold))
                                        .padding(.horizontal, 7).padding(.vertical, 2)
                                        .background(Color.cfPrimary.opacity(0.12)).foregroundColor(.cfPrimary).clipShape(Capsule())
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
            }
        }
        .navigationTitle(vm.detail?.classroomName ?? "Lesson Plan")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) { Button { showAdd = true } label: { Image(systemName: "plus") } }
            ToolbarItem(placement: .bottomBar) {
                if let d = vm.detail {
                    Button(d.status == "published" ? "Unpublish" : "Publish") { Task { await vm.togglePublish(planId: planId) } }
                }
            }
        }
        .task { await vm.load(planId) }
        .sheet(isPresented: $showAdd) { AddLessonActivitySheet(vm: vm, planId: planId, isPresented: $showAdd) }
        .alert("Lesson Plan", isPresented: .constant(vm.errorMessage != nil)) {
            Button("OK") { vm.errorMessage = nil }
        } message: { Text(vm.errorMessage ?? "") }
    }
}

private struct AddLessonActivitySheet: View {
    @ObservedObject var vm: LessonPlanDetailViewModel
    let planId: String
    @Binding var isPresented: Bool
    @State private var day = "monday"
    @State private var title = ""
    @State private var desc = ""
    @State private var domain = ""

    var body: some View {
        NavigationStack {
            Form {
                Picker("Day", selection: $day) {
                    ForEach(LESSON_DAYS, id: \.value) { d in Text(d.label).tag(d.value) }
                }
                TextField("Activity title", text: $title)
                TextField("Description", text: $desc, axis: .vertical).lineLimit(1...4)
                Picker("Domain", selection: $domain) {
                    Text("None").tag("")
                    ForEach(PORTFOLIO_DOMAINS, id: \.value) { d in Text(d.label).tag(d.value) }
                }
            }
            .navigationTitle("Add Activity")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task { if await vm.addActivity(planId: planId, day: day, title: title, desc: desc, domain: domain) { isPresented = false } }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || vm.posting)
                }
            }
        }
    }
}
