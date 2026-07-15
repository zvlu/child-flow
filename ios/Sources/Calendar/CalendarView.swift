import SwiftUI

let CALENDAR_EVENT_TYPES: [(value: String, label: String)] = [
    ("school_event", "School Event"),
    ("parent_event", "Parent Event"),
    ("holiday", "Holiday"),
    ("staff_training", "Staff Training"),
    ("deadline", "Deadline"),
    ("other", "Other"),
]
private func eventColor(_ t: String) -> Color {
    switch t {
    case "holiday": return .cfHealth
    case "parent_event": return .cfFamily
    case "school_event": return .cfPrimary
    case "staff_training": return .cfGoals
    case "deadline": return .orange
    default: return .cfTextSecondary
    }
}
private func parseISO(_ s: String) -> Date? {
    let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
}
private func dayHeader(_ d: Date) -> String {
    let cal = Calendar.current
    if cal.isDateInToday(d) { return "Today" }
    if cal.isDateInTomorrow(d) { return "Tomorrow" }
    let f = DateFormatter(); f.dateFormat = "EEEE, MMM d"; return f.string(from: d)
}
private func timeLabel(_ d: Date, allDay: Bool) -> String {
    if allDay { return "All day" }
    let f = DateFormatter(); f.dateFormat = "h:mm a"; return f.string(from: d)
}

@MainActor
final class CalendarViewModel: ObservableObject {
    @Published var events: [CalendarEventItem] = []
    @Published var isLoading = false
    @Published var posting = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do { events = try await APIClient.shared.getCalendar() }
        catch { errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load the calendar." }
    }
    func add(title: String, eventType: String, date: Date, location: String) async -> Bool {
        posting = true
        defer { posting = false }
        do {
            let iso = ISO8601DateFormatter().string(from: date)
            try await APIClient.shared.createCalendarEvent(title: title, eventType: eventType, startDate: iso, location: location.isEmpty ? nil : location)
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't save event."
            return false
        }
    }
}

struct CalendarView: View {
    @StateObject private var vm = CalendarViewModel()
    @State private var showAdd = false

    private var grouped: [(day: String, items: [CalendarEventItem])] {
        var order: [String] = []
        var map: [String: [CalendarEventItem]] = [:]
        for e in vm.events {
            let d = parseISO(e.startDate) ?? Date()
            let key = dayHeader(d)
            if map[key] == nil { map[key] = []; order.append(key) }
            map[key]!.append(e)
        }
        return order.map { (day: $0, items: map[$0]!) }
    }

    var body: some View {
        List {
            if vm.events.isEmpty && !vm.isLoading {
                Text("No upcoming events. Tap + to add one.").font(.cfSubheadline).foregroundColor(.cfTextSecondary)
            }
            ForEach(grouped, id: \.day) { group in
                Section(group.day) {
                    ForEach(group.items) { e in
                        HStack(spacing: 12) {
                            RoundedRectangle(cornerRadius: 3).fill(eventColor(e.eventType)).frame(width: 4, height: 36)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(e.title).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                                HStack(spacing: 6) {
                                    if let d = parseISO(e.startDate) { Text(timeLabel(d, allDay: e.allDay == 1)).font(.cfCaption2).foregroundColor(.cfTextSecondary) }
                                    if !e.location.isEmpty { Text("· \(e.location)").font(.cfCaption2).foregroundColor(.cfTextSecondary) }
                                }
                            }
                            Spacer()
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .navigationTitle("Calendar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) { Button { showAdd = true } label: { Image(systemName: "plus") } }
        }
        .task { await vm.load() }
        .refreshable { await vm.load() }
        .sheet(isPresented: $showAdd) { AddEventSheet(vm: vm, isPresented: $showAdd) }
        .alert("Calendar", isPresented: .constant(vm.errorMessage != nil)) {
            Button("OK") { vm.errorMessage = nil }
        } message: { Text(vm.errorMessage ?? "") }
    }
}

private struct AddEventSheet: View {
    @ObservedObject var vm: CalendarViewModel
    @Binding var isPresented: Bool
    @State private var title = ""
    @State private var eventType = "school_event"
    @State private var date = Date()
    @State private var location = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Event title", text: $title)
                Picker("Type", selection: $eventType) {
                    ForEach(CALENDAR_EVENT_TYPES, id: \.value) { t in Text(t.label).tag(t.value) }
                }
                DatePicker("When", selection: $date)
                TextField("Location (optional)", text: $location)
            }
            .navigationTitle("New Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { isPresented = false } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { if await vm.add(title: title, eventType: eventType, date: date, location: location) { isPresented = false } }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || vm.posting)
                }
            }
        }
    }
}
