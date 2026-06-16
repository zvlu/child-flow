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
        }
        .navigationTitle("Staff")
        .searchable(text: $viewModel.searchText, prompt: "Search staff")
        .toolbar {
            // Managing staff accounts is admin-only (the server enforces this
            // on staff.create too).
            if appState.isAdmin {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showAddStaff = true } label: {
                        Image(systemName: "person.badge.plus")
                    }
                }
            }
        }
        .sheet(isPresented: $showAddStaff) {
            AddStaffSheet { newMember in
                viewModel.add(newMember)
            }
        }
        .task { await viewModel.load() }
        .overlay {
            if viewModel.isLoading { ProgressView() }
        }
    }
}

// MARK: - Staff Row

struct StaffRow: View {
    let member: StaffMember

    var roleColor: Color {
        switch member.roleKey {
        case "director":          return .cfPrimary
        case "teacher":           return .cfChildren
        case "assistant":         return .cfGoals
        case "familyWorker":      return .cfFamily
        case "healthCoordinator": return .cfHealth
        default:                  return .cfTextSecondary
        }
    }

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

    var roleColor: Color {
        switch member.roleKey {
        case "director":          return .cfPrimary
        case "teacher":           return .cfChildren
        case "assistant":         return .cfGoals
        case "familyWorker":      return .cfFamily
        case "healthCoordinator": return .cfHealth
        default:                  return .cfTextSecondary
        }
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

            Section("Assignment") {
                if let classroom = liveMember.classroom {
                    LabeledContent("Classroom", value: classroom)
                    Button("Change Assignment") { showEditClassroom = true }
                        .foregroundColor(.cfPrimary)
                } else {
                    HStack {
                        Text("No classroom assigned")
                            .foregroundColor(.secondary)
                        Spacer()
                        Button("Assign") { showEditClassroom = true }
                            .font(.cfCaption.bold())
                            .foregroundColor(.cfPrimary)
                    }
                }
            }

            Section("Actions") {
                NavigationLink(destination: MessagingView()) {
                    Label("Send Message", systemImage: "bubble.left.fill")
                        .foregroundColor(.cfPrimary)
                }
                // Timesheet review is admin-only.
                if appState.isAdmin {
                    NavigationLink(destination: TimesheetView()) {
                        Label("View Timesheet", systemImage: "clock.fill")
                            .foregroundColor(.cfChildren)
                    }
                }
            }
        }
        .navigationTitle(liveMember.fullName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showLogTraining) {
            LogTrainingSheet(member: liveMember) { hours in
                viewModel.addTrainingHours(to: liveMember, hours: hours)
            }
        }
        .sheet(isPresented: $showEditClassroom) {
            AssignClassroomSheet(member: liveMember) { classroom in
                viewModel.assignClassroom(to: liveMember, classroom: classroom)
            }
        }
    }
}

// MARK: - Log Training Sheet

struct LogTrainingSheet: View {
    let member: StaffMember
    let onSave: (Int) -> Void
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
                        onSave(hours)
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
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    let classrooms = ["Room 1A", "Room 1B", "Room 2A", "Room 2B", "Room 3", "Float"]

    var body: some View {
        NavigationStack {
            List(classrooms, id: \.self) { room in
                Button {
                    onSave(room)
                    dismiss()
                } label: {
                    HStack {
                        Text(room).foregroundColor(.cfTextPrimary)
                        Spacer()
                        if member.classroom == room {
                            Image(systemName: "checkmark").foregroundColor(.cfPrimary)
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
    let onSave: (StaffMember) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var fullName = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var selectedRole: StaffRole = .teacher

    var canSave: Bool {
        !fullName.trimmingCharacters(in: .whitespaces).isEmpty &&
        !email.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Personal Info") {
                    TextField("Full Name", text: $fullName)
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
                        let m = StaffMember(
                            id: UUID().uuidString,
                            fullName: fullName.trimmingCharacters(in: .whitespaces),
                            role: selectedRole.singleName,
                            roleKey: selectedRole.rawValue,
                            email: email.trimmingCharacters(in: .whitespaces),
                            phone: phone,
                            trainingHours: 0,
                            classroom: nil
                        )
                        onSave(m)
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

enum StaffRole: String, CaseIterable {
    case director, teacher, assistant, familyWorker, healthCoordinator

    var displayName: String {
        switch self {
        case .director:          return "Program Directors"
        case .teacher:           return "Lead Teachers"
        case .assistant:         return "Teacher Assistants"
        case .familyWorker:      return "Family Service Workers"
        case .healthCoordinator: return "Health Coordinators"
        }
    }

    var singleName: String {
        switch self {
        case .director:          return "Program Director"
        case .teacher:           return "Lead Teacher"
        case .assistant:         return "Teacher Assistant"
        case .familyWorker:      return "Family Service Worker"
        case .healthCoordinator: return "Health Coordinator"
        }
    }
}

@MainActor
class StaffViewModel: ObservableObject {
    @Published var allStaff: [StaffMember] = []
    @Published var searchText = ""
    @Published var isLoading = false

    func filtered(for role: StaffRole) -> [StaffMember] {
        let byRole = allStaff.filter { $0.roleKey == role.rawValue }
        guard !searchText.isEmpty else { return byRole }
        return byRole.filter { $0.fullName.localizedCaseInsensitiveContains(searchText) }
    }

    func add(_ member: StaffMember) { allStaff.append(member) }

    func addTrainingHours(to member: StaffMember, hours: Int) {
        guard let i = allStaff.firstIndex(where: { $0.id == member.id }) else { return }
        allStaff[i] = StaffMember(id: member.id, fullName: member.fullName,
                                  role: member.role, roleKey: member.roleKey,
                                  email: member.email, phone: member.phone,
                                  trainingHours: member.trainingHours + hours,
                                  classroom: member.classroom)
    }

    func assignClassroom(to member: StaffMember, classroom: String) {
        guard let i = allStaff.firstIndex(where: { $0.id == member.id }) else { return }
        allStaff[i] = StaffMember(id: member.id, fullName: member.fullName,
                                  role: member.role, roleKey: member.roleKey,
                                  email: member.email, phone: member.phone,
                                  trainingHours: member.trainingHours,
                                  classroom: classroom)
    }

    func load() async {
        isLoading = true
        do {
            allStaff = try await APIClient.shared.getStaff()
        } catch {
            #if DEBUG
            allStaff = [
                StaffMember(id:"s1", fullName:"Dr. Patricia Hayes",    role:"Program Director",     roleKey:"director",          email:"p.hayes@childflow.org",  phone:"(555) 200-1001", trainingHours:24, classroom:nil),
                StaffMember(id:"s2", fullName:"Ms. Carmen Rivera",     role:"Lead Teacher",          roleKey:"teacher",           email:"c.rivera@childflow.org", phone:"(555) 200-1002", trainingHours:18, classroom:"Room 1A"),
                StaffMember(id:"s3", fullName:"Mr. James Carter",      role:"Lead Teacher",          roleKey:"teacher",           email:"j.carter@childflow.org", phone:"(555) 200-1003", trainingHours:12, classroom:"Room 2B"),
                StaffMember(id:"s4", fullName:"Ms. Destiny Moore",     role:"Teacher Assistant",     roleKey:"assistant",         email:"d.moore@childflow.org",  phone:"(555) 200-1004", trainingHours:8,  classroom:"Room 1A"),
                StaffMember(id:"s5", fullName:"Mr. Tyrell Washington", role:"Teacher Assistant",     roleKey:"assistant",         email:"t.wash@childflow.org",   phone:"(555) 200-1005", trainingHours:5,  classroom:"Room 2B"),
                StaffMember(id:"s6", fullName:"Ms. Sandra Thompson",   role:"Family Service Worker", roleKey:"familyWorker",      email:"s.thomp@childflow.org",  phone:"(555) 200-1006", trainingHours:20, classroom:nil),
                StaffMember(id:"s7", fullName:"Ms. Angela Kim",        role:"Family Service Worker", roleKey:"familyWorker",      email:"a.kim@childflow.org",    phone:"(555) 200-1007", trainingHours:16, classroom:nil),
                StaffMember(id:"s8", fullName:"Dr. Marcus Ellis",      role:"Health Coordinator",    roleKey:"healthCoordinator", email:"m.ellis@childflow.org",  phone:"(555) 200-1008", trainingHours:22, classroom:nil),
            ]
            #endif
        }
        isLoading = false
    }
}
