import SwiftUI

struct ChildrenView: View {
    @StateObject private var viewModel = ChildrenViewModel()
    @State private var showMenu = false

    var body: some View {
        NavigationStack {
            List {
                ForEach(viewModel.filteredChildren) { child in
                    NavigationLink(destination: ChildDetailView(child: child)) {
                        ChildRow(child: child)
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
}

struct ChildRow: View {
    let child: Child

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
                Text(child.classroom)
                    .font(.caption)
                    .foregroundColor(.secondary)
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
    var body: some View {
        List {
            Section("Health Status") {
                LabeledContent("Physical Exam", value: child.healthStatus)
                LabeledContent("Dental Exam", value: "Current")
                LabeledContent("Vision", value: "Current")
                LabeledContent("Hearing", value: "Due Soon")
            }
            if !child.allergies.isEmpty {
                Section("Allergies") {
                    ForEach(child.allergies, id: \.self) { allergy in
                        Text(allergy)
                    }
                }
            }
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
    var body: some View {
        List {
            Section("Primary Contact") {
                LabeledContent("Name", value: child.parentName)
                LabeledContent("Phone", value: child.parentPhone)
            }
        }
    }
}

@MainActor
class ChildrenViewModel: ObservableObject {
    @Published var children: [Child] = []
    @Published var searchText = ""
    @Published var statusFilter: String? = nil
    @Published var isLoading = false

    var filteredChildren: [Child] {
        children.filter { child in
            let matchesSearch = searchText.isEmpty ||
                child.fullName.localizedCaseInsensitiveContains(searchText)
            let matchesStatus = statusFilter == nil ||
                child.enrollmentStatus.lowercased() == statusFilter
            return matchesSearch && matchesStatus
        }
    }

    func load() async {
        isLoading = true
        do {
            children = try await APIClient.shared.getChildren()
        } catch {
            #if DEBUG
            children = MockData.children
            #endif
        }
        isLoading = false
    }
}
