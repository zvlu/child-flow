import SwiftUI

// MARK: - Family Engagement Events

struct FamilyEngagementEventView: View {
    @StateObject private var viewModel = EventsViewModel()
    @State private var showNewEvent = false
    @State private var filter: EventFilter = .upcoming

    enum EventFilter: String, CaseIterable {
        case upcoming = "Upcoming"
        case all = "All"
        case completed = "Completed"
    }

    var filteredEvents: [FamilyEngagementEvent] {
        switch filter {
        case .upcoming:
            return viewModel.events.filter {
                $0.status == .planning || $0.status == .ready
            }
        case .completed:
            return viewModel.events.filter { $0.status == .completed }
        case .all:
            return viewModel.events
        }
    }

    var body: some View {
        List {
            // Filter picker
            Picker("Filter", selection: $filter) {
                ForEach(EventFilter.allCases, id: \.self) { f in
                    Text(f.rawValue).tag(f)
                }
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)
            .listRowInsets(.init())
            .padding(.vertical, 4)

            if filteredEvents.isEmpty && !viewModel.isLoading {
                VStack(spacing: 16) {
                    Image(systemName: "person.3.fill")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("No Events")
                        .font(.headline)
                    Text("Plan family engagement events like workshops, orientations, and community nights.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Plan Event") { showNewEvent = true }
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .listRowBackground(Color.clear)
            } else {
                ForEach(filteredEvents) { event in
                    NavigationLink(destination: EventDetailView(event: event, onUpdate: {
                        Task { await viewModel.load() }
                    })) {
                        EventRow(event: event)
                    }
                }
            }
        }
        .navigationTitle("Family Events")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { showNewEvent = true }) { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showNewEvent) {
            NewEventSheet { _ in Task { await viewModel.load() } }
        }
        .task { await viewModel.load() }
        .overlay { if viewModel.isLoading { ProgressView() } }
    }
}

struct EventRow: View {
    let event: FamilyEngagementEvent

    var completionPercent: Double {
        let all = event.preEventChecklist + event.dayOfChecklist + event.postEventChecklist
        guard !all.isEmpty else { return 0 }
        return Double(all.filter(\.isComplete).count) / Double(all.count)
    }

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 10)
                .fill(event.status.color.opacity(0.12))
                .frame(width: 48, height: 48)
                .overlay {
                    Image(systemName: "person.3.fill")
                        .foregroundColor(event.status.color)
                        .font(.subheadline)
                }

            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.subheadline.weight(.medium))
                HStack(spacing: 8) {
                    Text(event.eventType.rawValue)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.accentColor.opacity(0.1))
                        .foregroundColor(.accentColor)
                        .clipShape(Capsule())
                    Text(event.plannedDate, style: .date)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                if completionPercent > 0 {
                    ProgressView(value: completionPercent)
                        .tint(event.status.color)
                }
            }
            Spacer()
            Text(event.status.rawValue)
                .font(.caption2.weight(.semibold))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(event.status.color.opacity(0.12))
                .foregroundColor(event.status.color)
                .clipShape(Capsule())
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Event Detail

struct EventDetailView: View {
    @State var event: FamilyEngagementEvent
    let onUpdate: () -> Void
    @State private var selectedPhase = 0
    private let phases = ["Pre-Event", "Day Of", "Post-Event"]

    var currentChecklist: Binding<[EventChecklistItem]> {
        switch selectedPhase {
        case 0: return $event.preEventChecklist
        case 1: return $event.dayOfChecklist
        default: return $event.postEventChecklist
        }
    }

    var body: some View {
        List {
            // Event info
            Section("Event Details") {
                LabeledContent("Title", value: event.title)
                LabeledContent("Type", value: event.eventType.rawValue)
                LabeledContent("Date") { Text(event.plannedDate, style: .date) }
                LabeledContent("Location", value: event.location.isEmpty ? "TBD" : event.location)
                LabeledContent("Status", value: event.status.rawValue)
                if let actual = event.actualAttendance {
                    LabeledContent("Attendance", value: "\(actual) / \(event.expectedAttendance) expected")
                } else {
                    LabeledContent("Expected Attendance", value: "\(event.expectedAttendance)")
                }
            }

            // Objectives
            if !event.objectives.isEmpty {
                Section("Objectives") {
                    ForEach(event.objectives, id: \.self) { obj in
                        Label(obj, systemImage: "checkmark.circle")
                            .font(.subheadline)
                    }
                }
            }

            // Checklist phases
            Section {
                Picker("Phase", selection: $selectedPhase) {
                    ForEach(phases.indices, id: \.self) { i in
                        Text(phases[i]).tag(i)
                    }
                }
                .pickerStyle(.segmented)

                let allItems = currentChecklist.wrappedValue
                let completed = allItems.filter(\.isComplete).count
                HStack {
                    Text("\(completed)/\(allItems.count) complete")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    ProgressView(value: allItems.isEmpty ? 0 : Double(completed) / Double(allItems.count))
                        .frame(width: 100)
                }

                ForEach(currentChecklist) { $item in
                    HStack(alignment: .top, spacing: 10) {
                        Button(action: {
                            item.isComplete.toggle()
                            saveUpdate()
                        }) {
                            Image(systemName: item.isComplete
                                ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(item.isComplete ? .green : .secondary)
                        }
                        Text(item.title)
                            .font(.subheadline)
                            .strikethrough(item.isComplete)
                            .foregroundColor(item.isComplete ? .secondary : .primary)
                    }
                }
            } header: {
                Text("Checklist")
            }

            if !event.notes.isEmpty {
                Section("Notes") { Text(event.notes) }
            }
        }
        .navigationTitle(event.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func saveUpdate() {
        Task {
            do {
                _ = try await APIClient.shared.updateEvent(event: event)
                onUpdate()
            } catch {}
        }
    }
}

// MARK: - New Event Sheet

struct NewEventSheet: View {
    let onSave: (FamilyEngagementEvent) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var eventType: FamilyEngagementEvent.EventType = .familyNight
    @State private var plannedDate = Date().addingTimeInterval(14 * 24 * 3600)
    @State private var location = ""
    @State private var expectedAttendance = 20
    @State private var objectives: [String] = [""]
    @State private var isSaving = false

    let defaultPreChecklist = [
        "Secure venue / room reservation",
        "Send invitations to families",
        "Confirm speaker / presenter",
        "Prepare materials and handouts",
        "Arrange childcare if needed",
        "Order / prepare food",
        "Confirm RSVP count"
    ]
    let defaultDayOfChecklist = [
        "Set up room",
        "Sign-in sheet ready",
        "Childcare staff on site",
        "Food / refreshments set up",
        "Presentation materials ready"
    ]
    let defaultPostChecklist = [
        "Record attendance",
        "Document in ChildFlow",
        "Send thank-you to families",
        "Complete event evaluation",
        "Note suggestions for next event"
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section("Event Information") {
                    TextField("Event Title", text: $title)
                    Picker("Event Type", selection: $eventType) {
                        ForEach(FamilyEngagementEvent.EventType.allCases, id: \.self) { t in
                            Text(t.rawValue).tag(t)
                        }
                    }
                    DatePicker("Planned Date", selection: $plannedDate, displayedComponents: .date)
                    TextField("Location", text: $location)
                    Stepper("Expected Attendance: \(expectedAttendance)",
                            value: $expectedAttendance, in: 1...200)
                }
                Section {
                    ForEach(objectives.indices, id: \.self) { i in
                        HStack {
                            TextField("Objective \(i + 1)", text: $objectives[i])
                            if objectives.count > 1 {
                                Button(action: { objectives.remove(at: i) }) {
                                    Image(systemName: "minus.circle.fill").foregroundColor(.red)
                                }
                            }
                        }
                    }
                    Button(action: { objectives.append("") }) {
                        Label("Add Objective", systemImage: "plus.circle")
                    }
                } header: {
                    Text("Objectives")
                }
                Section {
                    Text("Default checklists will be created automatically based on Head Start best practices.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Plan Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { save() }.disabled(title.isEmpty || isSaving)
                }
            }
        }
    }

    private func save() {
        isSaving = true
        let event = FamilyEngagementEvent(
            id: UUID().uuidString,
            title: title,
            eventType: eventType,
            plannedDate: plannedDate,
            actualDate: nil,
            location: location,
            createdBy: "Current User",
            objectives: objectives.filter { !$0.isEmpty },
            preEventChecklist: defaultPreChecklist.map { t in
                EventChecklistItem(id: UUID().uuidString, title: t, isComplete: false, notes: "")
            },
            dayOfChecklist: defaultDayOfChecklist.map { t in
                EventChecklistItem(id: UUID().uuidString, title: t, isComplete: false, notes: "")
            },
            postEventChecklist: defaultPostChecklist.map { t in
                EventChecklistItem(id: UUID().uuidString, title: t, isComplete: false, notes: "")
            },
            expectedAttendance: expectedAttendance,
            actualAttendance: nil,
            notes: "",
            status: .planning
        )
        Task {
            do {
                let saved = try await APIClient.shared.createEvent(event: event)
                await MainActor.run { onSave(saved); dismiss() }
            } catch {
                await MainActor.run { onSave(event); dismiss() }
            }
            isSaving = false
        }
    }
}

@MainActor
class EventsViewModel: ObservableObject {
    @Published var events: [FamilyEngagementEvent] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            events = try await APIClient.shared.getFamilyEngagementEvents()
        } catch {
            #if DEBUG
            events = MockData.events
            #endif
        }
        isLoading = false
    }
}
