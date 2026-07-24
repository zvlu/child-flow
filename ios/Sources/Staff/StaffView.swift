import SwiftUI

// MARK: - Staff Directory

struct StaffView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = StaffViewModel()
    @State private var showAddStaff = false

    var body: some View {
        List {
            ForEach(StaffRole.allCases, id: \.self) { role in
                let members = viewModel.filtered(for: role)
                if !members.isEmpty {
                    Section(role.displayName) {
                        ForEach(members) { member in
                            NavigationLink(destination: StaffDetailView(member: member, viewModel: viewModel)) {
                                StaffRow(member: member)
                            }
                        }
                    }
                }
            }
            if !viewModel.unmatched.isEmpty {
                Section("Other") {
                    ForEach(viewModel.unmatched) { member in
                        NavigationLink(destination: StaffDetailView(member: member, viewModel: viewModel)) {
                            StaffRow(member: member)
                        }
                    }
                }
            }
        }
        .navigationTitle("Staff")
        .searchable(text: $viewModel.searchText, prompt: "Search staff")
        .toolbar {
            // Managing staff accounts is admin-only (the server enforces this
            // on staff.create too).
            if appState.canManageStaff {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showAddStaff = true } label: {
                        Image(systemName: "person.badge.plus")
                    }
                }
            }
        }
        .sheet(isPresented: $showAddStaff) {
            AddStaffSheet { firstName, lastName, email, phone, role in
                Task { await viewModel.createStaff(firstName: firstName, lastName: lastName, email: email, phone: phone, role: role) }
            }
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .overlay {
            if viewModel.isLoading { ProgressView() }
        }
        .alert("Notice", isPresented: Binding(
            get: { viewModel.alertMessage != nil },
            set: { if !$0 { viewModel.alertMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.alertMessage ?? "")
        }
    }
}

// MARK: - Staff Row

struct StaffRow: View {
    let member: StaffMember

    var roleColor: Color { StaffRole(rawValue: member.roleKey)?.color ?? .cfTextSecondary }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(roleColor.opacity(0.15))
                .frame(width: 44, height: 44)
                .overlay {
                    Text(member.initials)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(roleColor)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(member.fullName)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.cfTextPrimary)
                HStack(spacing: 6) {
                    Text(member.role)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    if let classroom = member.classroom {
                        Text("·")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(classroom)
                            .font(.caption)
                            .foregroundColor(.cfPrimary)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text("\(member.trainingHours)h")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(member.trainingHours >= 15 ? .cfAttendance : .cfHealth)
                Text("training")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Staff Detail View

struct StaffDetailView: View {
    let member: StaffMember
    @ObservedObject var viewModel: StaffViewModel
    @EnvironmentObject var appState: AppState
    @State private var showLogTraining = false
    @State private var showEditClassroom = false
    // App-activity oversight: hidden entirely unless the server (reporting-line
    // guard) returns it. A 403 means this viewer isn't above the employee.
    @State private var activity: [StaffActivityItem] = []
    @State private var activityDenied = false
    @State private var activityLoaded = false

    var roleColor: Color { StaffRole(rawValue: member.roleKey)?.color ?? .cfTextSecondary }

    private static func formatActivityDate(_ iso: String) -> String {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        guard let date = fractional.date(from: iso) ?? plain.date(from: iso) else { return iso }
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .short
        return out.string(from: date)
    }

    // Pull the live version of this member from the viewModel
    var liveMember: StaffMember {
        viewModel.allStaff.first(where: { $0.id == member.id }) ?? member
    }

    var body: some View {
        List {
            Section {
                HStack(spacing: 16) {
                    Circle()
                        .fill(roleColor.opacity(0.15))
                        .frame(width: 64, height: 64)
                        .overlay {
                            Text(liveMember.initials)
                                .font(.title2.weight(.bold))
                                .foregroundColor(roleColor)
                        }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(liveMember.fullName)
                            .font(.cfTitle2)
                            .foregroundColor(.cfTextPrimary)
                        Text(liveMember.role)
                            .font(.cfSubheadline)
                            .foregroundColor(.secondary)
                        if let classroom = liveMember.classroom {
                            Label(classroom, systemImage: "door.left.hand.closed")
                                .font(.cfCaption)
                                .foregroundColor(.cfPrimary)
                        }
                    }
                }
                .padding(.vertical, 4)
            }

            Section("Contact") {
                LabeledContent {
                    Text(liveMember.email).foregroundColor(.cfPrimary)
                } label: {
                    Label("Email", systemImage: "envelope")
                }
                LabeledContent {
                    Text(liveMember.phone)
                } label: {
                    Label("Phone", systemImage: "phone")
                }
            }

            Section("Training Hours") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .lastTextBaseline, spacing: 4) {
                        Text("\(liveMember.trainingHours)")
                            .font(.system(size: 36, weight: .bold))
                            .foregroundColor(liveMember.trainingHours >= 15 ? .cfAttendance : .cfHealth)
                        Text("/ 15 required")
                            .font(.cfCaption)
                            .foregroundColor(.secondary)
                    }
                    ProgressView(value: Double(min(liveMember.trainingHours, 15)), total: 15)
                        .tint(liveMember.trainingHours >= 15 ? .cfAttendance : .cfHealth)
                    if liveMember.trainingHours >= 15 {
                        Label("Requirement met", systemImage: "checkmark.circle.fill")
                            .font(.cfCaption)
                            .foregroundColor(.cfAttendance)
                    } else {
                        Text("\(15 - liveMember.trainingHours) hours remaining")
                            .font(.cfCaption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, 4)

                Button {
                    showLogTraining = true
                } label: {
                    Label("Log Training Hours", systemImage: "plus.circle.fill")
                        .foregroundColor(.cfPrimary)
                }
            }

            // Classroom (re)assignment is admin-only (the server enforces
            // this on assign-staff too).
            Section("Assignment") {
                if let classroom = liveMember.classroom {
                    LabeledContent("Classroom", value: classroom)
                    if appState.canManageStaff {
                        Button("Change Assignment") { showEditClassroom = true }
                            .foregroundColor(.cfPrimary)
                    }
                } else {
                    HStack {
                        Text("No classroom assigned")
                            .foregroundColor(.secondary)
                        Spacer()
                        if appState.canManageStaff {
                            Button("Assign") { showEditClassroom = true }
                                .font(.cfCaption.bold())
                                .foregroundColor(.cfPrimary)
                        }
                    }
                }
            }

            if !activityDenied {
                Section("App Activity") {
                    if !activityLoaded {
                        HStack { Spacer(); ProgressView(); Spacer() }
                    } else if activity.isEmpty {
                        Text("No recent activity recorded.")
                            .font(.cfCaption)
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(activity.prefix(50)) { item in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.label)
                                    .font(.cfSubheadline)
                                    .foregroundColor(.cfTextPrimary)
                                if let at = item.at {
                                    Text(Self.formatActivityDate(at))
                                        .font(.cfCaption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
            }

            Section("Actions") {
                NavigationLink(destination: MessagingView()) {
                    Label("Send Message", systemImage: "bubble.left.fill")
                        .foregroundColor(.cfPrimary)
                }
                // Timesheet review is admin-only.
                if appState.canManageStaff {
                    NavigationLink(destination: TimesheetView()) {
                        Label("View Timesheet", systemImage: "clock.fill")
                            .foregroundColor(.cfChildren)
                    }
                }
            }
        }
        .navigationTitle(liveMember.fullName)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do {
                activity = try await APIClient.shared.getStaffActivity(staffId: member.id)
            } catch {
                // 403 = not in this employee's reporting line → hide the section.
                if case APIError.httpError(403) = error { activityDenied = true }
            }
            activityLoaded = true
        }
        .sheet(isPresented: $showLogTraining) {
            LogTrainingSheet(member: liveMember) { hours, trainingType, date, notes in
                Task { await viewModel.logTraining(member: liveMember, trainingName: trainingType, hours: hours, date: date, notes: notes) }
            }
        }
        .sheet(isPresented: $showEditClassroom) {
            AssignClassroomSheet(member: liveMember, classrooms: viewModel.classrooms) { newClassroom in
                Task { await viewModel.assignClassroom(member: liveMember, to: newClassroom) }
            }
        }
    }
}

// MARK: - Log Training Sheet

struct LogTrainingSheet: View {
    let member: StaffMember
    /// hours, trainingType, date, notes
    let onSave: (Int, String, Date, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var hours = 1
    @State private var trainingType = "Professional Development"
    @State private var date = Date()
    @State private var notes = ""

    let trainingTypes = ["Professional Development", "Health & Safety", "Child Development",
                         "Family Engagement", "Program Management", "Other"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Training Details") {
                    Stepper("Hours: \(hours)", value: $hours, in: 1...40)
                    Picker("Type", selection: $trainingType) {
                        ForEach(trainingTypes, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.navigationLink)
                    DatePicker("Date", selection: $date, in: ...Date(), displayedComponents: .date)
                }
                Section("Notes (Optional)") {
                    TextField("Provider, course name, location…", text: $notes, axis: .vertical)
                        .lineLimit(2...4)
                }
                Section {
                    Button("Save") {
                        onSave(hours, trainingType, date, notes.trimmingCharacters(in: .whitespacesAndNewlines))
                        dismiss()
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .foregroundColor(.cfPrimary)
                    .fontWeight(.semibold)
                }
            }
            .navigationTitle("Log Training")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }
}

// MARK: - Assign Classroom Sheet

struct AssignClassroomSheet: View {
    let member: StaffMember
    /// Real classrooms loaded from the server (GET /api/classrooms) — this
    /// used to be a hardcoded, made-up room list disconnected from any real
    /// classroom record, so "assigning" a room here couldn't possibly persist.
    let classrooms: [ClassroomSummary]
    /// nil means "unassign".
    let onSave: (ClassroomSummary?) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if member.classroom != nil {
                    Section {
                        Button(role: .destructive) {
                            onSave(nil)
                            dismiss()
                        } label: {
                            Label("Unassign from \(member.classroom ?? "current classroom")", systemImage: "xmark.circle")
                        }
                    }
                }
                Section {
                    if classrooms.isEmpty {
                        Text("No classrooms available.")
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(classrooms) { room in
                            Button {
                                onSave(room)
                                dismiss()
                            } label: {
                                HStack {
                                    Text(room.name).foregroundColor(.cfTextPrimary)
                                    Spacer()
                                    if member.classroom == room.name {
                                        Image(systemName: "checkmark").foregroundColor(.cfPrimary)
                                    }
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
        }
    }
}

// MARK: - Add Staff Sheet

struct AddStaffSheet: View {
    /// firstName, lastName, email, phone, role — the server (POST /api/staff)
    /// only requires firstName/lastName; email/phone are optional.
    let onSave: (String, String, String, String, StaffRole) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var selectedRole: StaffRole = .teacher

    var canSave: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !lastName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Personal Info") {
                    TextField("First Name", text: $firstName)
                    TextField("Last Name", text: $lastName)
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    TextField("Phone", text: $phone)
                        .keyboardType(.phonePad)
                }
                Section("Role") {
                    Picker("Role", selection: $selectedRole) {
                        ForEach(StaffRole.allCases, id: \.self) { role in
                            Text(role.singleName).tag(role)
                        }
                    }
                    .pickerStyle(.navigationLink)
                }
                Section {
                    Button("Add Staff Member") {
                        onSave(
                            firstName.trimmingCharacters(in: .whitespaces),
                            lastName.trimmingCharacters(in: .whitespaces),
                            email.trimmingCharacters(in: .whitespaces),
                            phone.trimmingCharacters(in: .whitespaces),
                            selectedRole
                        )
                        dismiss()
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .foregroundColor(canSave ? .cfPrimary : .secondary)
                    .fontWeight(.semibold)
                    .disabled(!canSave)
                }
            }
            .navigationTitle("Add Staff Member")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }
}

// MARK: - Enums & ViewModel

/// Mirrors the full §1302.91 staff taxonomy used server-side (see
/// `server/routers.ts` staff.create's `role` enum). This used to only
/// recognize 5 legacy keys (director/teacher/assistant/familyWorker/
/// healthCoordinator), so any staff member seeded with a real role like
/// "nurse", "nutritionist", or "family_advocate" simply never showed up
/// in this list — no error, they just silently vanished from the directory.
enum StaffRole: String, CaseIterable {
    case director
    case fiscalOfficer = "fiscal_officer"
    case educationCoordinator = "education_coordinator"
    case coach
    case healthCoordinator = "health_coordinator"
    case nurse
    case nutritionist
    case mentalHealthConsultant = "mental_health_consultant"
    case disabilitiesCoordinator = "disabilities_coordinator"
    case familyServicesManager = "family_services_manager"
    case familyAdvocate = "family_advocate"
    case homeVisitor = "home_visitor"
    case erseaCoordinator = "ersea_coordinator"
    case teacher
    case assistant
    case cook
    case busDriver = "bus_driver"
    case coordinator
    case admin
    // Standard center positions added later (mirror server STAFF_ROLE_VALUES).
    case assistantDirector = "assistant_director"
    case centerDirector = "center_director"
    case dataManager = "data_manager"
    case leadTeacher = "lead_teacher"
    case officeManager = "office_manager"
    case enrollmentSpecialist = "enrollment_specialist"
    case custodian
    case busMonitor = "bus_monitor"
    case kitchenAssistant = "kitchen_assistant"
    case substitute

    var displayName: String {
        switch self {
        case .director:                return "Program Directors"
        case .fiscalOfficer:            return "Fiscal Officers"
        case .educationCoordinator:     return "Education Coordinators"
        case .coach:                    return "Coaches"
        case .healthCoordinator:        return "Health Coordinators"
        case .nurse:                    return "Nurses"
        case .nutritionist:             return "Nutritionists"
        case .mentalHealthConsultant:   return "Mental Health Consultants"
        case .disabilitiesCoordinator:  return "Disabilities Coordinators"
        case .familyServicesManager:    return "Family Services Managers"
        case .familyAdvocate:           return "Family Advocates"
        case .homeVisitor:              return "Home Visitors"
        case .erseaCoordinator:         return "ERSEA Coordinators"
        case .teacher:                  return "Teachers"
        case .assistant:                return "Teacher Assistants"
        case .cook:                     return "Cooks"
        case .busDriver:                return "Bus Drivers"
        case .coordinator:              return "Coordinators"
        case .admin:                    return "Administrators"
        case .assistantDirector:        return "Assistant Directors"
        case .centerDirector:           return "Center Directors"
        case .dataManager:              return "Data Managers"
        case .leadTeacher:              return "Lead Teachers"
        case .officeManager:            return "Office Managers"
        case .enrollmentSpecialist:     return "Enrollment Specialists"
        case .custodian:                return "Custodians / Maintenance"
        case .busMonitor:               return "Bus Monitors"
        case .kitchenAssistant:         return "Kitchen Assistants"
        case .substitute:               return "Substitutes / Floaters"
        }
    }

    var singleName: String {
        switch self {
        case .director:                return "Program Director"
        case .fiscalOfficer:            return "Fiscal Officer"
        case .educationCoordinator:     return "Education Coordinator"
        case .coach:                    return "Coach"
        case .healthCoordinator:        return "Health Coordinator"
        case .nurse:                    return "Nurse"
        case .nutritionist:             return "Nutritionist"
        case .mentalHealthConsultant:   return "Mental Health Consultant"
        case .disabilitiesCoordinator:  return "Disabilities Coordinator"
        case .familyServicesManager:    return "Family Services Manager"
        case .familyAdvocate:           return "Family Advocate"
        case .homeVisitor:              return "Home Visitor"
        case .erseaCoordinator:         return "ERSEA Coordinator"
        case .teacher:                  return "Teacher"
        case .assistant:                return "Teacher Assistant"
        case .cook:                     return "Cook"
        case .busDriver:                return "Bus Driver"
        case .coordinator:              return "Coordinator"
        case .admin:                    return "Administrator"
        case .assistantDirector:        return "Assistant Director"
        case .centerDirector:           return "Center Director"
        case .dataManager:              return "Data Manager"
        case .leadTeacher:              return "Lead Teacher"
        case .officeManager:            return "Office Manager"
        case .enrollmentSpecialist:     return "Enrollment Specialist"
        case .custodian:                return "Custodian / Maintenance"
        case .busMonitor:               return "Bus Monitor"
        case .kitchenAssistant:         return "Kitchen Assistant"
        case .substitute:               return "Substitute / Floater"
        }
    }

    var color: Color {
        switch self {
        case .director, .admin, .assistantDirector, .centerDirector:  return .cfPrimary
        case .fiscalOfficer, .coordinator, .dataManager, .officeManager: return .cfCompliance
        case .educationCoordinator, .coach:                         return .cfGoals
        case .healthCoordinator, .nurse, .nutritionist,
             .mentalHealthConsultant, .disabilitiesCoordinator:      return .cfHealth
        case .familyServicesManager, .familyAdvocate, .homeVisitor:  return .cfFamily
        case .erseaCoordinator, .enrollmentSpecialist:               return .cfAttendance
        case .teacher, .assistant, .leadTeacher, .substitute:        return .cfChildren
        case .cook, .busDriver, .busMonitor, .kitchenAssistant, .custodian: return .cfAccent
        }
    }
}

@MainActor
class StaffViewModel: ObservableObject {
    @Published var allStaff: [StaffMember] = []
    @Published var classrooms: [ClassroomSummary] = []
    @Published var searchText = ""
    @Published var isLoading = false
    /// Set when a save fails (including admin-only 403s); shown as an alert.
    @Published var alertMessage: String?

    func filtered(for role: StaffRole) -> [StaffMember] {
        let byRole = allStaff.filter { $0.roleKey == role.rawValue }
        guard !searchText.isEmpty else { return byRole }
        return byRole.filter { $0.fullName.localizedCaseInsensitiveContains(searchText) }
    }

    /// Anyone whose roleKey doesn't match a known case — shown under "Other"
    /// instead of silently disappearing if the taxonomy drifts again.
    var unmatched: [StaffMember] {
        let known = Set(StaffRole.allCases.map { $0.rawValue })
        let rest = allStaff.filter { !known.contains($0.roleKey) }
        guard !searchText.isEmpty else { return rest }
        return rest.filter { $0.fullName.localizedCaseInsensitiveContains(searchText) }
    }

    /// Creates the staff member server-side and reloads so the directory
    /// reflects the persisted record. Admins create directly; a manager's hire
    /// is parked as a pending approval (we surface that so they know it's not
    /// live yet).
    @discardableResult
    func createStaff(firstName: String, lastName: String, email: String, phone: String, role: StaffRole) async -> Bool {
        do {
            let result = try await APIClient.shared.createStaffMember(
                firstName: firstName,
                lastName: lastName,
                email: email.isEmpty ? nil : email,
                phone: phone.isEmpty ? nil : phone,
                position: nil,
                role: role.rawValue
            )
            await load()
            if result.pendingApproval == true {
                alertMessage = "Submitted for approval — an administrator will review this hire before it takes effect."
            }
            return true
        } catch {
            alertMessage = friendlyMessage(for: error, action: "add that staff member")
            return false
        }
    }

    /// Logs training hours server-side and reloads so the running total
    /// (summed server-side from all logged training) stays accurate.
    @discardableResult
    func logTraining(member: StaffMember, trainingName: String, hours: Int, date: Date, notes: String) async -> Bool {
        guard let staffId = Int(member.id) else {
            alertMessage = "Couldn't identify that staff member."
            return false
        }
        do {
            try await APIClient.shared.logTrainingHours(
                staffId: staffId,
                trainingName: trainingName,
                hours: Double(hours),
                trainingDate: date,
                notes: notes.isEmpty ? nil : notes
            )
            await load()
            return true
        } catch {
            alertMessage = friendlyMessage(for: error, action: "log those training hours")
            return false
        }
    }

    /// Reassigns (or unassigns, if `newClassroom` is nil) a staff member's
    /// classroom (admin-only). If they're currently assigned elsewhere, that
    /// slot is cleared first so they never appear in two rooms at once.
    /// Classrooms only track a single teacherId/assistantId, so the role
    /// written is inferred from the member's own role (assistant vs. teacher).
    @discardableResult
    func assignClassroom(member: StaffMember, to newClassroom: ClassroomSummary?) async -> Bool {
        guard let staffId = Int(member.id) else {
            alertMessage = "Couldn't identify that staff member."
            return false
        }
        let role = member.roleKey == "assistant" ? "assistant" : "teacher"
        do {
            if let currentName = member.classroom,
               currentName != newClassroom?.name,
               let previous = classrooms.first(where: { $0.name == currentName }),
               let previousId = Int(previous.id) {
                try await APIClient.shared.assignClassroomStaff(classroomId: previousId, role: role, staffId: nil)
            }
            if let newClassroom, let newId = Int(newClassroom.id) {
                try await APIClient.shared.assignClassroomStaff(classroomId: newId, role: role, staffId: staffId)
            }
            await load()
            return true
        } catch {
            alertMessage = friendlyMessage(for: error, action: "update that classroom assignment")
            return false
        }
    }

    private func friendlyMessage(for error: Error, action: String) -> String {
        if case APIError.httpError(403) = error {
            return "Admin access required."
        }
        if let apiError = error as? APIError {
            return apiError.errorDescription ?? "Couldn't \(action). Check your connection and try again."
        }
        return "Couldn't \(action). Check your connection and try again."
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        async let staffTask = APIClient.shared.getStaff()
        async let classroomsTask = APIClient.shared.getClassrooms()
        do {
            allStaff = try await staffTask
        } catch {
            #if DEBUG
            allStaff = [
                StaffMember(id:"s1", fullName:"Dr. Patricia Hayes",    role:"Program Director",     roleKey:"director",          email:"p.hayes@sprout.org",  phone:"(555) 200-1001", trainingHours:24, classroom:nil),
                StaffMember(id:"s2", fullName:"Ms. Carmen Rivera",     role:"Lead Teacher",          roleKey:"teacher",           email:"c.rivera@sprout.org", phone:"(555) 200-1002", trainingHours:18, classroom:"Room 1A"),
                StaffMember(id:"s3", fullName:"Mr. James Carter",      role:"Lead Teacher",          roleKey:"teacher",           email:"j.carter@sprout.org", phone:"(555) 200-1003", trainingHours:12, classroom:"Room 2B"),
                StaffMember(id:"s4", fullName:"Ms. Destiny Moore",     role:"Teacher Assistant",     roleKey:"assistant",         email:"d.moore@sprout.org",  phone:"(555) 200-1004", trainingHours:8,  classroom:"Room 1A"),
                StaffMember(id:"s5", fullName:"Mr. Tyrell Washington", role:"Teacher Assistant",     roleKey:"assistant",         email:"t.wash@sprout.org",   phone:"(555) 200-1005", trainingHours:5,  classroom:"Room 2B"),
                StaffMember(id:"s6", fullName:"Ms. Sandra Thompson",   role:"Family Service Worker", roleKey:"familyWorker",      email:"s.thomp@sprout.org",  phone:"(555) 200-1006", trainingHours:20, classroom:nil),
                StaffMember(id:"s7", fullName:"Ms. Angela Kim",        role:"Family Service Worker", roleKey:"familyWorker",      email:"a.kim@sprout.org",    phone:"(555) 200-1007", trainingHours:16, classroom:nil),
                StaffMember(id:"s8", fullName:"Dr. Marcus Ellis",      role:"Health Coordinator",    roleKey:"healthCoordinator", email:"m.ellis@sprout.org",  phone:"(555) 200-1008", trainingHours:22, classroom:nil),
            ]
            #endif
        }
        do {
            classrooms = try await classroomsTask
        } catch {
            // Non-fatal: the assign-classroom sheet just shows no rooms.
        }
    }
}
