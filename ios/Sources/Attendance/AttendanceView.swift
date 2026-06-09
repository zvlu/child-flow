import SwiftUI

struct AttendanceView: View {
    @StateObject private var viewModel = AttendanceViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Date + stats bar
                HStack {
                    Button(action: { viewModel.previousDay() }) {
                        Image(systemName: "chevron.left")
                    }
                    Spacer()
                    VStack(spacing: 2) {
                        Text(viewModel.selectedDate, style: .date)
                            .font(.headline)
                        Text("\(viewModel.presentCount)/\(viewModel.totalCount) present")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Button(action: { viewModel.nextDay() }) {
                        Image(systemName: "chevron.right")
                    }
                    .disabled(viewModel.isToday)
                }
                .padding()
                .background(Color(.secondarySystemBackground))

                // Classroom picker
                Picker("Classroom", selection: $viewModel.selectedClassroom) {
                    Text("All Classrooms").tag(String?.none)
                    ForEach(viewModel.classrooms, id: \.self) { room in
                        Text(room).tag(String?.some(room))
                    }
                }
                .pickerStyle(.menu)
                .padding(.horizontal)

                List {
                    ForEach($viewModel.records) { $record in
                        AttendanceRow(record: $record)
                    }
                }
            }
            .navigationTitle("Attendance")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") { viewModel.saveAll() }
                        .disabled(!viewModel.hasChanges)
                }
            }
            .task { await viewModel.load() }
        }
    }
}

struct AttendanceRow: View {
    @Binding var record: AttendanceRecord

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(record.childName)
                    .font(.subheadline.weight(.medium))
                Text(record.classroom)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Picker("Status", selection: $record.status) {
                Text("Present").tag(AttendanceStatus.present)
                Text("Absent").tag(AttendanceStatus.absent)
                Text("Excused").tag(AttendanceStatus.excused)
                Text("Half Day").tag(AttendanceStatus.halfDay)
            }
            .pickerStyle(.menu)
            .tint(record.status.color)
        }
    }
}

@MainActor
class AttendanceViewModel: ObservableObject {
    @Published var records: [AttendanceRecord] = []
    @Published var selectedDate = Date()
    @Published var selectedClassroom: String? = nil
    @Published var classrooms: [String] = []
    @Published var hasChanges = false
    @Published var isLoading = false

    var presentCount: Int { records.filter { $0.status == .present }.count }
    var totalCount: Int { records.count }
    var isToday: Bool { Calendar.current.isDateInToday(selectedDate) }

    func load() async {
        isLoading = true
        do {
            let data = try await APIClient.shared.getAttendance(date: selectedDate, classroom: selectedClassroom)
            records = data.records
            classrooms = data.classrooms
        } catch {}
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
}
