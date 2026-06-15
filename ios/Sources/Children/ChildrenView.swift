import SwiftUI

struct ChildrenView: View {
    @StateObject private var viewModel = ChildrenViewModel()
    @State private var showMenu = false

    var body: some View {
        NavigationStack {
            List {
                // Grouping toggle lives in the list so it scrolls naturally.
                Section {
                    Picker("Organize", selection: $viewModel.grouping) {
                        Text("By Room").tag(ChildrenViewModel.Grouping.byRoom)
                        Text("By Family").tag(ChildrenViewModel.Grouping.byFamily)
                        Text("All").tag(ChildrenViewModel.Grouping.all)
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                if viewModel.grouping == .byRoom {
                    // Unassigned children come first — they're the ones that
                    // need action, so they must be impossible to miss.
                    let unassigned = viewModel.children(inRoom: "")
                    if !unassigned.isEmpty {
                        Section {
                            ForEach(unassigned) { child in
                                childRow(child)
                            }
                        } header: {
                            Label("Needs Room Assignment (\(unassigned.count))", systemImage: "exclamationmark.triangle.fill")
                                .foregroundColor(.cfAccent)
                        }
                    }

                    ForEach(viewModel.classrooms) { room in
                        let kids = viewModel.children(inRoom: room.name)
                        if !(viewModel.isSearching && kids.isEmpty) {
                            Section {
                                ForEach(kids) { child in
                                    childRow(child)
                                }
                                if kids.isEmpty {
                                    Text("No children assigned")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            } header: {
                                RoomSectionHeader(room: room, visibleCount: kids.count)
                            }
                        }
                    }
                } else if viewModel.grouping == .byFamily {
                    // Parent + their children (siblings) as one unit.
                    ForEach(viewModel.familyGroups) { group in
                        Section {
                            ForEach(group.children) { child in
                                childRow(child)
                            }
                        } header: {
                            HStack(spacing: 8) {
                                Image(systemName: "person.2.fill")
                                Text(group.parentName)
                                Text("· \(group.children.count) \(group.children.count == 1 ? "child" : "children")")
                                    .foregroundColor(.secondary)
                                Spacer()
                                if !group.parentPhone.isEmpty {
                                    Label(group.parentPhone, systemImage: "phone.fill")
                                }
                            }
                            .font(.caption)
                        }
                    }
                } else {
                    ForEach(viewModel.filteredChildren) { child in
                        childRow(child)
                    }
                }
            }
            .searchable(text: $viewModel.searchText, prompt: "Search children")
            .navigationTitle("Children")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { showMenu = true } label: {
                        Image(systemName: "line.3.horizontal")
                            .foregroundColor(.cfPrimary)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Picker("Status", selection: $viewModel.statusFilter) {
                            Text("All").tag(String?.none)
                            Text("Active").tag(String?.some("active"))
                            Text("Inactive").tag(String?.some("inactive"))
                        }
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                    }
                }
            }
            .sheet(isPresented: $showMenu) { AppMenuSheet() }
            .task { await viewModel.load() }
            .overlay {
                if viewModel.isLoading {
                    ProgressView()
                } else if viewModel.filteredChildren.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "person.2")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("No Children Found")
                            .font(.headline)
                        Text("Try adjusting your search or filters.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }

    /// Row + navigation + long-press "Move to room" menu.
    @ViewBuilder
    private func childRow(_ child: Child) -> some View {
        NavigationLink(destination: ChildDetailView(child: child)) {
            ChildRow(child: child, showRoom: viewModel.grouping == .all)
        }
        .contextMenu {
            Menu {
                ForEach(viewModel.classrooms.filter { $0.name != child.classroom }) { room in
                    Button {
                        Task { await viewModel.move(child, toRoom: room) }
                    } label: {
                        Label(
                            room.isFull ? "\(room.name) (full)" : "\(room.name) · \(room.enrolledCount)/\(room.capacity)",
                            systemImage: "door.left.hand.open"
                        )
                    }
                    .disabled(room.isFull)
                }
            } label: {
                Label("Move to Room", systemImage: "arrow.right.square")
            }
            if !child.classroom.isEmpty {
                Button(role: .destructive) {
                    Task { await viewModel.move(child, toRoom: nil) }
                } label: {
                    Label("Remove from \(child.classroom)", systemImage: "minus.circle")
                }
            }
        }
    }
}

/// Room name, live capacity (X/Y), and teacher — at a glance.
struct RoomSectionHeader: View {
    let room: ClassroomSummary
    let visibleCount: Int

    var capacityColor: Color {
        if room.isFull { return .cfHealth }
        if room.capacity > 0 && Double(room.enrolledCount) / Double(room.capacity) >= 0.85 { return .orange }
        return .cfAttendance
    }

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color(hex: room.color))
                .frame(width: 10, height: 10)
            Text(room.name)
            Text("\(room.enrolledCount)/\(room.capacity)")
                .foregroundColor(capacityColor)
                .fontWeight(.semibold)
            if !room.ageGroup.isEmpty {
                Text("· \(room.ageGroup)")
            }
            Spacer()
            if !room.teacherName.isEmpty {
                Label(room.teacherName, systemImage: "person.fill")
                    .labelStyle(.titleAndIcon)
            }
        }
        .font(.caption)
    }
}

struct ChildRow: View {
    let child: Child
    var showRoom: Bool = true

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.accentColor.opacity(0.2))
                .frame(width: 44, height: 44)
                .overlay {
                    Text(child.initials)
                        .font(.headline)
                        .foregroundColor(.accentColor)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(child.fullName)
                    .font(.subheadline.weight(.medium))
                if showRoom {
                    Text(child.classroom.isEmpty ? "No room assigned" : child.classroom)
                        .font(.caption)
                        .foregroundColor(child.classroom.isEmpty ? .cfAccent : .secondary)
                } else if !child.teacher.isEmpty {
                    Text(child.teacher)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
            HealthStatusBadge(status: child.healthStatus)
        }
        .padding(.vertical, 4)
    }
}

struct ChildDetailView: View {
    let child: Child
    @State private var selectedTab = 0

    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(spacing: 8) {
                Circle()
                    .fill(Color.accentColor.opacity(0.2))
                    .frame(width: 72, height: 72)
                    .overlay {
                        Text(child.initials)
                            .font(.title)
                            .foregroundColor(.accentColor)
                    }
                Text(child.fullName)
                    .font(.title2.bold())
                Text(child.classroom)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding()

            Picker("Section", selection: $selectedTab) {
                Text("Profile").tag(0)
                Text("Health").tag(1)
                Text("Attendance").tag(2)
                Text("Family").tag(3)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)

            TabView(selection: $selectedTab) {
                ChildProfileTab(child: child).tag(0)
                ChildHealthTab(child: child).tag(1)
                ChildAttendanceTab(child: child).tag(2)
                ChildFamilyTab(child: child).tag(3)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .navigationTitle(child.firstName)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ChildProfileTab: View {
    let child: Child
    var body: some View {
        List {
            Section("Personal") {
                LabeledContent("Date of Birth", value: child.dateOfBirth)
                LabeledContent("Gender", value: child.gender)
                LabeledContent("Language", value: child.primaryLanguage)
            }
            Section("Enrollment") {
                LabeledContent("Status", value: child.enrollmentStatus)
                LabeledContent("Classroom", value: child.classroom)
                LabeledContent("Teacher", value: child.teacher)
            }
        }
    }
}

struct ChildHealthTab: View {
    let child: Child
    @State private var records: [HealthRecord] = []
    @State private var isLoading = true

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "Overdue":  return .cfHealth
        case "Due Soon": return .orange
        default:         return .cfAttendance
        }
    }

    var body: some View {
        List {
            if isLoading {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if records.isEmpty {
                Section {
                    Text("No health records on file yet.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else {
                Section("Health Records") {
                    ForEach(records) { record in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(record.category.capitalized)
                                    .font(.subheadline.weight(.medium))
                                if let due = record.dueDate {
                                    Text("Due \(due.formatted(.dateTime.month(.abbreviated).day().year()))")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                            Spacer()
                            Text(record.status)
                                .font(.caption.weight(.semibold))
                                .foregroundColor(statusColor(record.status))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(statusColor(record.status).opacity(0.12))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
            if !child.allergies.isEmpty {
                Section("Allergies") {
                    ForEach(child.allergies, id: \.self) { allergy in
                        Text(allergy)
                    }
                }
            }
        }
        .task {
            // The child's own records, freshly loaded — not placeholder values.
            let all = (try? await APIClient.shared.getHealthRecords()) ?? []
            records = all.filter { $0.childId == child.id }
            isLoading = false
        }
    }
}

struct ChildAttendanceTab: View {
    let child: Child
    var body: some View {
        List {
            Section {
                LabeledContent("Attendance Rate", value: "\(child.attendanceRate)%")
            }
        }
    }
}

struct ChildFamilyTab: View {
    let child: Child
    @State private var family: Family?
    @State private var isLoading = true

    var body: some View {
        List {
            Section("Primary Contact") {
                LabeledContent("Name", value: child.parentName.isEmpty ? "—" : child.parentName)
                if !child.parentPhone.isEmpty {
                    LabeledContent("Phone", value: child.parentPhone)
                }
            }

            Section {
                if let family {
                    // Tap through to the full family hub (siblings, contacts,
                    // goals, case notes, FNA, CFCR…).
                    NavigationLink(destination: FamilyDetailView(family: family)) {
                        Label("Open Family Record", systemImage: "house.fill")
                            .foregroundColor(.cfPrimary)
                    }
                    NavigationLink(destination: FamilyDetailView(family: family, initialTab: .notes)) {
                        Label("Case Notes", systemImage: "note.text")
                    }
                    NavigationLink(destination: FamilyDetailView(family: family, initialTab: .goals)) {
                        Label("Family Goals", systemImage: "target")
                    }
                } else if isLoading {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else {
                    Text("No linked family record.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } header: {
                Text("Family Record")
            } footer: {
                if let family, family.childrenCount > 1 {
                    Text("\(family.childrenCount) children in this family.")
                }
            }
        }
        .task {
            let families = (try? await APIClient.shared.getFamilies()) ?? MockData.families
            family = families.first { f in
                if let fid = child.familyId, !fid.isEmpty { return f.id == fid }
                // Demo fallback when the child carries no familyId.
                return f.name == child.parentName || f.name.contains(child.lastName)
            }
            isLoading = false
        }
    }
}

/// One family's children shown together: the parent contact plus siblings.
struct FamilyGroup: Identifiable {
    let id: String
    let parentName: String
    let parentPhone: String
    let children: [Child]
}

@MainActor
class ChildrenViewModel: ObservableObject {
    enum Grouping { case byRoom, byFamily, all }

    @Published var children: [Child] = []
    @Published var classrooms: [ClassroomSummary] = []
    @Published var grouping: Grouping = .byRoom
    @Published var searchText = ""
    @Published var statusFilter: String? = nil
    @Published var isLoading = false

    var isSearching: Bool { !searchText.isEmpty }

    var filteredChildren: [Child] {
        children
            .filter { child in
                let matchesSearch = searchText.isEmpty ||
                    child.fullName.localizedCaseInsensitiveContains(searchText)
                let matchesStatus = statusFilter == nil ||
                    child.enrollmentStatus.lowercased() == statusFilter
                return matchesSearch && matchesStatus
            }
            .sorted { ($0.lastName, $0.firstName) < ($1.lastName, $1.firstName) }
    }

    /// Children in a room by name; "" means unassigned.
    func children(inRoom roomName: String) -> [Child] {
        filteredChildren.filter { $0.classroom == roomName }
    }

    /// Siblings grouped under their parent, sorted by family name.
    var familyGroups: [FamilyGroup] {
        var byKey: [String: [Child]] = [:]
        for child in filteredChildren {
            // familyId when the server provides it; parent name as a demo-data fallback.
            let key = child.familyId ?? "name:\(child.parentName)"
            byKey[key, default: []].append(child)
        }
        return byKey
            .map { key, kids in
                FamilyGroup(
                    id: key,
                    parentName: kids.first?.parentName.isEmpty == false ? kids.first!.parentName : "Family",
                    parentPhone: kids.first?.parentPhone ?? "",
                    children: kids
                )
            }
            .sorted { $0.parentName < $1.parentName }
    }

    /// Move a child to a room (nil = unassign), then refresh so capacity
    /// counts and section membership update everywhere at once.
    func move(_ child: Child, toRoom room: ClassroomSummary?) async {
        do {
            try await APIClient.shared.assignChild(childId: child.id, classroomId: room?.id)
            await load()
        } catch {
            // Demo mode (no server): update locally so the interaction still works.
            #if DEBUG
            children = children.map {
                guard $0.id == child.id else { return $0 }
                return Child(
                    id: $0.id, firstName: $0.firstName, lastName: $0.lastName,
                    dateOfBirth: $0.dateOfBirth, gender: $0.gender,
                    primaryLanguage: $0.primaryLanguage,
                    classroom: room?.name ?? "", teacher: room?.teacherName ?? "",
                    enrollmentStatus: $0.enrollmentStatus, healthStatus: $0.healthStatus,
                    attendanceRate: $0.attendanceRate,
                    parentName: $0.parentName, parentPhone: $0.parentPhone,
                    allergies: $0.allergies
                )
            }
            rebuildMockClassroomCounts()
            #endif
        }
    }

    func load() async {
        isLoading = true
        do {
            async let kids = APIClient.shared.getChildren()
            async let rooms = APIClient.shared.getClassrooms()
            children = try await kids
            classrooms = try await rooms
        } catch {
            #if DEBUG
            children = MockData.children
            rebuildMockClassroomCounts()
            #endif
        }
        isLoading = false
    }

    /// Demo fallback: derive room summaries from the mock children.
    private func rebuildMockClassroomCounts() {
        let roomNames = Set(children.map(\.classroom).filter { !$0.isEmpty })
        classrooms = roomNames.sorted().enumerated().map { index, name in
            let kids = children.filter { $0.classroom == name }
            return ClassroomSummary(
                id: "mock-\(index)",
                name: name,
                ageGroup: "",
                capacity: 18,
                enrolledCount: kids.count,
                teacherName: kids.first?.teacher ?? "",
                assistantName: "",
                color: "#3b82f6"
            )
        }
    }
}
