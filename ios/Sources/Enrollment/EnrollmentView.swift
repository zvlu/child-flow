import SwiftUI

// MARK: - Enrollment View

struct EnrollmentView: View {
    @StateObject private var viewModel = EnrollmentViewModel()
    @State private var showAddApplication = false

    var body: some View {
        List {
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        EnrollmentStatusChip(label: "All", count: viewModel.applications.count,
                                             color: .cfPrimary, isSelected: viewModel.selectedStatus == nil) {
                            viewModel.selectedStatus = nil
                        }
                        ForEach(EnrollmentStatus.allCases, id: \.self) { status in
                            EnrollmentStatusChip(label: status.displayName,
                                                 count: viewModel.count(for: status),
                                                 color: status.color,
                                                 isSelected: viewModel.selectedStatus == status) {
                                viewModel.selectedStatus = viewModel.selectedStatus == status ? nil : status
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(.init())
            }

            if viewModel.filteredApplications.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "tray")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("No applications")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 30)
                .listRowBackground(Color.clear)
            } else {
                ForEach(viewModel.filteredApplications) { application in
                    NavigationLink(destination: ApplicationDetailView(application: application,
                                                                       viewModel: viewModel)) {
                        ApplicationRow(application: application)
                    }
                }
            }
        }
        .navigationTitle("Enrollment")
        .searchable(text: $viewModel.searchText, prompt: "Search applicants")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                HStack(spacing: 14) {
                    Button { showAddApplication = true } label: {
                        Image(systemName: "plus")
                    }
                    Menu {
                        NavigationLink(destination: ERSEAView()) {
                            Label("ERSEA — Eligibility & Waitlist", systemImage: "list.number")
                        }
                        NavigationLink(destination: ApplicationVerificationView()) {
                            Label("Verification Checklists", systemImage: "checkmark.rectangle.fill")
                        }
                        NavigationLink(destination: AttendancePlansView()) {
                            Label("Attendance Plans", systemImage: "chart.line.uptrend.xyaxis")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .sheet(isPresented: $showAddApplication) {
            AddApplicationSheet { app in viewModel.add(app) }
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .alert("Action Failed", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") { viewModel.errorMessage = nil }
        } message: { Text(viewModel.errorMessage ?? "") }
    }
}

// MARK: - Application Row

struct ApplicationRow: View {
    let application: EnrollmentApplication

    var statusColor: Color { EnrollmentStatus.color(for: application.status) }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(statusColor.opacity(0.12))
                .frame(width: 42, height: 42)
                .overlay {
                    Text(application.childName.prefix(1).uppercased())
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(statusColor)
                }

            VStack(alignment: .leading, spacing: 3) {
                Text(application.childName)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.cfTextPrimary)
                HStack(spacing: 6) {
                    Text(application.applicationDate, style: .date)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("·")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(application.priority)
                        .font(.caption)
                        .foregroundColor(.cfPrimary)
                }
            }

            Spacer()
            ApplicationStatusBadge(status: application.status)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Application Detail View

struct ApplicationDetailView: View {
    let application: EnrollmentApplication
    @ObservedObject var viewModel: EnrollmentViewModel
    @State private var showAssignClassroom = false

    var live: EnrollmentApplication {
        viewModel.applications.first(where: { $0.id == application.id }) ?? application
    }

    var body: some View {
        List {
            Section {
                HStack(spacing: 14) {
                    Circle()
                        .fill(Color.cfPrimary.opacity(0.12))
                        .frame(width: 56, height: 56)
                        .overlay {
                            Text(live.childName.prefix(2).uppercased())
                                .font(.title3.weight(.bold))
                                .foregroundColor(.cfPrimary)
                        }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(live.childName)
                            .font(.cfTitle2)
                            .foregroundColor(.cfTextPrimary)
                        ApplicationStatusBadge(status: live.status)
                    }
                }
                .padding(.vertical, 4)
            }

            Section("Details") {
                LabeledContent("Applied", value: live.applicationDate.formatted(.dateTime.month(.wide).day().year()))
                LabeledContent("Priority", value: live.priority)
                if let classroom = live.classroom {
                    LabeledContent("Classroom", value: classroom)
                    Button("Change Classroom") { showAssignClassroom = true }
                        .foregroundColor(.cfPrimary)
                } else {
                    HStack {
                        Text("No classroom assigned").foregroundColor(.secondary)
                        Spacer()
                        Button("Assign") { showAssignClassroom = true }
                            .font(.cfCaption.bold())
                            .foregroundColor(.cfPrimary)
                    }
                }
            }

            Section("Update Status") {
                ForEach(EnrollmentStatus.allCases, id: \.self) { status in
                    let isCurrent = status.matches(live.status)
                    Button {
                        Task { await viewModel.updateStatus(live, to: status) }
                    } label: {
                        HStack {
                            Label(status.actionLabel, systemImage: status.icon)
                                .foregroundColor(isCurrent ? .secondary : status.color)
                            Spacer()
                            if isCurrent {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(status.color)
                            }
                        }
                    }
                    .disabled(isCurrent || viewModel.isUpdating(live.id))
                }
            }

            Section("Actions") {
                NavigationLink(destination: ApplicationVerificationView()) {
                    Label("Review Documents", systemImage: "doc.text.magnifyingglass")
                        .foregroundColor(.cfPrimary)
                }
                NavigationLink(destination: FamilyServicesView()) {
                    Label("View Family Record", systemImage: "house.fill")
                        .foregroundColor(.cfFamily)
                }
            }
        }
        .navigationTitle(live.childName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showAssignClassroom) {
            EnrollmentClassroomPickerSheet(currentClassroomName: live.classroom) { room in
                Task { await viewModel.assignClassroom(live, classroomId: room.id, classroomName: room.name) }
            }
        }
    }
}

// MARK: - Classroom Picker (real classrooms, for assigning a newly-enrolled child)

struct EnrollmentClassroomPickerSheet: View {
    let currentClassroomName: String?
    let onSave: (ClassroomSummary) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var classrooms: [ClassroomSummary] = []
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                } else if classrooms.isEmpty {
                    ContentUnavailableView("No Classrooms", systemImage: "door.left.hand.closed",
                                           description: Text("Add classrooms first from the Children tab."))
                } else {
                    List(classrooms) { room in
                        Button {
                            onSave(room)
                            dismiss()
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(room.name).foregroundColor(.cfTextPrimary)
                                    Text("\(room.enrolledCount)/\(room.capacity) enrolled")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                if currentClassroomName == room.name {
                                    Image(systemName: "checkmark").foregroundColor(.cfPrimary)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Assign Classroom")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .task {
                isLoading = true
                classrooms = (try? await APIClient.shared.getClassrooms()) ?? []
                isLoading = false
            }
        }
    }
}

// MARK: - Add Application Sheet

struct AddApplicationSheet: View {
    let onSave: (EnrollmentApplication) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var childName = ""
    @State private var priority = "Income-Eligible"
    @State private var applicationDate = Date()
    let priorities = ["Income-Eligible", "Foster Child", "Disability", "Homeless", "Other"]

    var canSave: Bool { !childName.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section("Child Information") {
                    TextField("Child's full name", text: $childName)
                    Picker("Priority", selection: $priority) {
                        ForEach(priorities, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.navigationLink)
                    DatePicker("Application Date", selection: $applicationDate, in: ...Date(), displayedComponents: .date)
                }
                Section {
                    Button("Submit Application") {
                        onSave(EnrollmentApplication(id: UUID().uuidString,
                                                     childName: childName.trimmingCharacters(in: .whitespaces),
                                                     status: "Pending",
                                                     applicationDate: applicationDate,
                                                     priority: priority,
                                                     classroom: nil))
                        dismiss()
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .foregroundColor(canSave ? .cfPrimary : .secondary)
                    .fontWeight(.semibold)
                    .disabled(!canSave)
                }
            }
            .navigationTitle("New Application")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }
}

// MARK: - Supporting Views

struct ApplicationStatusBadge: View {
    let status: String
    var color: Color { EnrollmentStatus.color(for: status) }
    var body: some View {
        Text(status)
            .font(.caption2.weight(.semibold))
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}

struct EnrollmentStatusChip: View {
    let label: String
    let count: Int
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(label).font(.cfCaption.weight(.medium))
                Text("\(count)")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(isSelected ? Color.white.opacity(0.3) : color.opacity(0.15))
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(isSelected ? color : Color(.secondarySystemBackground))
            .foregroundColor(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
        .animation(.easeInOut(duration: 0.15), value: isSelected)
    }
}

// MARK: - Enums

enum EnrollmentStatus: String, CaseIterable {
    case pending, underReview, approved, denied

    var displayName: String {
        switch self {
        case .pending:     return "Pending"
        case .underReview: return "Under Review"
        case .approved:    return "Approved"
        case .denied:      return "Denied"
        }
    }
    var actionLabel: String {
        switch self {
        case .pending:     return "Mark as Pending"
        case .underReview: return "Move to Under Review"
        case .approved:    return "Approve Application"
        case .denied:      return "Deny Application"
        }
    }
    var icon: String {
        switch self {
        case .pending:     return "clock"
        case .underReview: return "magnifyingglass"
        case .approved:    return "checkmark.circle.fill"
        case .denied:      return "xmark.circle.fill"
        }
    }
    var color: Color {
        switch self {
        case .pending:     return .orange
        case .underReview: return .cfPrimary
        case .approved:    return .cfAttendance
        case .denied:      return .cfHealth
        }
    }

    /// Whether a raw status string from the server matches this case. The server's
    /// enrollment-application status enum also has an "enrolled" state (surfaced as
    /// "Enrolled") once approve-and-enroll runs — that's the same real-world outcome
    /// as `.approved`, just a later stage of the same record, so treat it as a match.
    func matches(_ rawStatus: String) -> Bool {
        if rawStatus == displayName { return true }
        if self == .approved && rawStatus == "Enrolled" { return true }
        return false
    }

    /// Shared status -> color mapping for badges/rows, including the "Enrolled" state
    /// (see `matches(_:)`) which has no corresponding `EnrollmentStatus` case of its own.
    static func color(for rawStatus: String) -> Color {
        switch rawStatus {
        case "Approved", "Enrolled": return .cfAttendance
        case "Under Review":         return .cfPrimary
        case "Pending":              return .orange
        case "Denied":               return .cfHealth
        default:                     return .secondary
        }
    }
}

// MARK: - ViewModel

@MainActor
class EnrollmentViewModel: ObservableObject {
    @Published var applications: [EnrollmentApplication] = []
    @Published var searchText = ""
    @Published var selectedStatus: EnrollmentStatus? = nil
    @Published var isLoading = false
    @Published var errorMessage: String?

    /// Application id -> in-flight status/enroll request, so buttons for that
    /// row can disable themselves and avoid duplicate taps mid-request.
    @Published private var updatingIds: Set<String> = []

    /// Application id -> real DB child id, known once approve-and-enroll succeeds
    /// this session. GET /api/enrollment doesn't return the enrolled child id, so
    /// this is the only way "Assign Classroom" can know which real child to target.
    private var enrolledChildIds: [String: String] = [:]

    /// Application id -> classroom name assigned this session. GET /api/enrollment
    /// always returns `classroom: null` (not tracked there yet), so this local cache
    /// is reapplied after every reload to avoid the UI losing the assignment the
    /// user just made.
    private var assignedClassrooms: [String: String] = [:]

    var filteredApplications: [EnrollmentApplication] {
        applications.filter { app in
            let matchesSearch = searchText.isEmpty || app.childName.localizedCaseInsensitiveContains(searchText)
            let matchesStatus = selectedStatus == nil || selectedStatus!.matches(app.status)
            return matchesSearch && matchesStatus
        }
    }

    func count(for status: EnrollmentStatus) -> Int {
        applications.filter { status.matches($0.status) }.count
    }

    func isUpdating(_ id: String) -> Bool { updatingIds.contains(id) }

    func add(_ app: EnrollmentApplication) { applications.insert(app, at: 0) }

    /// Approve => approve-and-enroll (materializes a real family + child record);
    /// pending/under-review/denied => a plain status change. Both are real server
    /// calls now — this used to just mutate the local `applications` array.
    func updateStatus(_ app: EnrollmentApplication, to status: EnrollmentStatus) async {
        errorMessage = nil
        updatingIds.insert(app.id)
        defer { updatingIds.remove(app.id) }
        do {
            if status == .approved {
                let result = try await APIClient.shared.enrollApplication(id: app.id)
                enrolledChildIds[app.id] = String(result.childId)
            } else {
                let serverStatus: String
                switch status {
                case .pending:     serverStatus = "pending"
                case .underReview: serverStatus = "reviewing"
                case .denied:      serverStatus = "denied"
                case .approved:    serverStatus = "approved" // unreachable, handled above
                }
                try await APIClient.shared.updateEnrollmentStatus(id: app.id, status: serverStatus)
            }
            await load()
        } catch {
            // Surface real server errors (e.g. "Enrollment limit reached…") instead
            // of silently updating local state.
            errorMessage = Self.message(for: error)
        }
    }

    /// Assign a real classroom to a child that's already been approved & enrolled
    /// this session — reuses the existing `POST /api/children/:id/assign` endpoint
    /// rather than a new one, since this is really "assign the newly-enrolled child
    /// to a classroom," not an enrollment-specific action.
    func assignClassroom(_ app: EnrollmentApplication, classroomId: String, classroomName: String) async {
        errorMessage = nil
        guard let childId = enrolledChildIds[app.id] else {
            errorMessage = "Approve this application before assigning a classroom."
            return
        }
        do {
            try await APIClient.shared.assignChild(childId: childId, classroomId: classroomId)
            assignedClassrooms[app.id] = classroomName
            await load()
        } catch {
            errorMessage = Self.message(for: error)
        }
    }

    func load() async {
        isLoading = true
        do {
            let fetched = try await APIClient.shared.getEnrollmentApplications()
            // Reapply this session's classroom assignments — the server doesn't
            // return `classroom` for enrollment applications yet.
            applications = fetched.map { app in
                guard app.classroom == nil, let override = assignedClassrooms[app.id] else { return app }
                return EnrollmentApplication(id: app.id, childName: app.childName, status: app.status,
                                             applicationDate: app.applicationDate, priority: app.priority,
                                             classroom: override)
            }
        } catch {
            #if DEBUG
            let now = Date()
            applications = [
                EnrollmentApplication(id:"ea1", childName:"Destiny Brown",  status:"Under Review", applicationDate:now.addingTimeInterval(-86400*3),  priority:"Income-Eligible", classroom:nil),
                EnrollmentApplication(id:"ea2", childName:"Eli Nakamura",   status:"Approved",     applicationDate:now.addingTimeInterval(-86400*8),  priority:"Income-Eligible", classroom:"Room 1A"),
                EnrollmentApplication(id:"ea3", childName:"Amara Diallo",   status:"Pending",      applicationDate:now.addingTimeInterval(-86400*1),  priority:"Foster Child",    classroom:nil),
                EnrollmentApplication(id:"ea4", childName:"Tyler Greene",   status:"Under Review", applicationDate:now.addingTimeInterval(-86400*5),  priority:"Disability",      classroom:nil),
                EnrollmentApplication(id:"ea5", childName:"Zoe Martinez",   status:"Approved",     applicationDate:now.addingTimeInterval(-86400*12), priority:"Income-Eligible", classroom:"Room 2B"),
                EnrollmentApplication(id:"ea6", childName:"Noah Patel",     status:"Denied",       applicationDate:now.addingTimeInterval(-86400*15), priority:"Over Income",     classroom:nil),
                EnrollmentApplication(id:"ea7", childName:"Maya Johnson",   status:"Pending",      applicationDate:now.addingTimeInterval(-86400*2),  priority:"Homeless",        classroom:nil),
            ]
            #endif
        }
        isLoading = false
    }

    private static func message(for error: Error) -> String {
        (error as? LocalizedError)?.errorDescription ?? "Something went wrong. Please try again."
    }
}
