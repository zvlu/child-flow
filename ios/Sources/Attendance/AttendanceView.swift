import SwiftUI

// MARK: - Classroom Today (teacher one-screen flow)
// Pick a room, mark attendance, and drop a quick note on any child — all on
// one screen, no navigation. Attendance + notes both persist to the server.

struct AttendanceView: View {
    @StateObject private var viewModel = AttendanceViewModel()
    @State private var showMenu = false
    @State private var noteTarget: AttendanceRecord?
    @State private var justSaved = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Date + present count
                HStack {
                    Button(action: { viewModel.previousDay() }) {
                        Image(systemName: "chevron.left")
                    }
                    Spacer()
                    VStack(spacing: 2) {
                        Text(viewModel.selectedDate, style: .date)
                            .font(.cfHeadline)
                        Text("\(viewModel.presentCount)/\(viewModel.totalCount) present")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    }
                    Spacer()
                    Button(action: { viewModel.nextDay() }) {
                        Image(systemName: "chevron.right")
                    }
                    .disabled(viewModel.isToday)
                }
                .padding()
                .background(Color.cfSurface)

                // Classroom picker
                Picker("Classroom", selection: $viewModel.selectedClassroom) {
                    Text("All Rooms").tag(String?.none)
                    ForEach(viewModel.classrooms, id: \.self) { room in
                        Text(room).tag(String?.some(room))
                    }
                }
                .pickerStyle(.menu)
                .tint(.cfPrimary)
                .padding(.horizontal)
                .onChange(of: viewModel.selectedClassroom) { _, _ in Task { await viewModel.load() } }

                List {
                    ForEach($viewModel.records) { $record in
                        AttendanceRow(
                            record: $record,
                            hasNote: viewModel.notedChildIds.contains(record.childId),
                            onNote: { noteTarget = record },
                            onChange: { viewModel.hasChanges = true }
                        )
                    }
                }
                .listStyle(.plain)
            }
            .background(Color.cfBackground)
            .navigationTitle("Classroom Today")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { showMenu = true } label: {
                        Image(systemName: "line.3.horizontal").foregroundColor(.cfPrimary)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 10) {
                        NavigationLink { ChronicAbsenceView() } label: {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                        }
                        Button(justSaved ? "Saved ✓" : "Save") {
                            viewModel.saveAll()
                            justSaved = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) { justSaved = false }
                        }
                        .fontWeight(.semibold)
                        .disabled(viewModel.records.isEmpty)
                    }
                }
            }
            .sheet(isPresented: $showMenu) { AppMenuSheet() }
            .sheet(item: $noteTarget) { rec in
                QuickNoteSheet(childName: rec.childName) { text in
                    viewModel.addNote(childId: rec.childId, content: text)
                }
            }
            .task { await viewModel.load() }
            .overlay {
                if viewModel.isLoading { ProgressView() }
            }
        }
    }
}

struct AttendanceRow: View {
    @Binding var record: AttendanceRecord
    let hasNote: Bool
    let onNote: () -> Void
    let onChange: () -> Void

    private func short(_ s: AttendanceStatus) -> String {
        switch s {
        case .present: return "Present"
        case .absent:  return "Absent"
        case .excused: return "Excused"
        case .halfDay: return "Half"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(record.childName)
                        .font(.cfSubheadline.weight(.medium))
                        .foregroundColor(.cfTextPrimary)
                    if !record.classroom.isEmpty {
                        Text(record.classroom)
                            .font(.cfCaption2)
                            .foregroundColor(.cfTextSecondary)
                    }
                }
                Spacer()
                Button(action: onNote) {
                    Image(systemName: hasNote ? "checkmark.circle.fill" : "note.text.badge.plus")
                        .font(.system(size: 18))
                        .foregroundColor(hasNote ? .cfAttendance : .cfPrimary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(hasNote ? "Note added for \(record.childName)" : "Add note for \(record.childName)")
            }

            Picker("Status", selection: $record.status) {
                ForEach(AttendanceStatus.allCases, id: \.self) { s in
                    Text(short(s)).tag(s)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: record.status) { _, _ in onChange() }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Quick Note composer

struct QuickNoteSheet: View {
    let childName: String
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("A quick observation or reminder about \(childName). Staff will see it on the child's profile.")
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
                TextEditor(text: $text)
                    .focused($focused)
                    .frame(minHeight: 140)
                    .padding(8)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.cfBorder, lineWidth: 1))
                Spacer()
            }
            .padding()
            .navigationTitle("Quick Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        onSave(text.trimmingCharacters(in: .whitespacesAndNewlines))
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear { focused = true }
        }
    }
}

@MainActor
class AttendanceViewModel: ObservableObject {
    @Published var records: [AttendanceRecord] = []
    @Published var selectedDate = Date()
    @Published var selectedClassroom: String? = nil
    @Published var classrooms: [String] = []
    @Published var notedChildIds: Set<String> = []
    @Published var hasChanges = false
    @Published var isLoading = false

    var presentCount: Int { records.filter { $0.status == .present || $0.status == .halfDay }.count }
    var totalCount: Int { records.count }
    var isToday: Bool { Calendar.current.isDateInToday(selectedDate) }

    func load() async {
        isLoading = true
        do {
            let data = try await APIClient.shared.getAttendance(date: selectedDate, classroom: selectedClassroom)
            records = data.records
            classrooms = data.classrooms
        } catch {
            #if DEBUG
            classrooms = ["Butterflies", "Caterpillars", "Dragonflies", "Ladybugs"]
            records = MockData.children.map { child in
                AttendanceRecord(
                    id: UUID().uuidString,
                    childId: child.id,
                    childName: child.fullName,
                    classroom: child.classroom,
                    status: .present,
                    date: selectedDate
                )
            }
            #endif
        }
        isLoading = false
    }

    func previousDay() {
        selectedDate = Calendar.current.date(byAdding: .day, value: -1, to: selectedDate) ?? selectedDate
        Task { await load() }
    }

    func nextDay() {
        guard !isToday else { return }
        selectedDate = Calendar.current.date(byAdding: .day, value: 1, to: selectedDate) ?? selectedDate
        Task { await load() }
    }

    func saveAll() {
        Task {
            do {
                try await APIClient.shared.saveAttendance(records: records)
                hasChanges = false
            } catch {}
        }
    }

    func addNote(childId: String, content: String) {
        guard !content.isEmpty else { return }
        Task {
            do {
                try await APIClient.shared.addQuickNote(childId: childId, content: content)
                notedChildIds.insert(childId)
            } catch {}
        }
    }
}
