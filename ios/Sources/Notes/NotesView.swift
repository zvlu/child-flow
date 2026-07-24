import SwiftUI

/// Unified, org-wide case-note feed (child + family notes), newest first —
/// the mobile mirror of the web Notes page. A note appears here as soon as
/// it's submitted from any record. Backed by NotesAPI (GET /api/notes/recent).
struct NotesView: View {
    @State private var items: [NoteFeedItem] = []
    @State private var isLoading = false
    @State private var filter = "all"    // all | child | family
    @State private var group = "recent"  // recent | person
    @State private var search = ""
    @State private var showCompose = false

    private var filtered: [NoteFeedItem] {
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        return items.filter { n in
            if filter != "all" && n.kind != filter { return false }
            if q.isEmpty { return true }
            return n.subjectName.lowercased().contains(q)
                || n.title.lowercased().contains(q)
                || n.body.lowercased().contains(q)
                || (n.author ?? "").lowercased().contains(q)
        }
    }

    /// Grouped by subject (child/family), subjects alphabetical, notes
    /// newest-first within each (they arrive newest-first from the server).
    private var byPerson: [(name: String, notes: [NoteFeedItem])] {
        var map: [String: [NoteFeedItem]] = [:]
        for n in filtered { map[n.subjectName, default: []].append(n) }
        return map.keys.sorted().map { (name: $0, notes: map[$0]!) }
    }

    var body: some View {
        List {
            Section {
                Picker("Filter", selection: $filter) {
                    Text("All").tag("all")
                    Text("Children").tag("child")
                    Text("Families").tag("family")
                }
                .pickerStyle(.segmented)
                Picker("Group", selection: $group) {
                    Text("Recent").tag("recent")
                    Text("By person").tag("person")
                }
                .pickerStyle(.segmented)
            }

            if isLoading && items.isEmpty {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if filtered.isEmpty {
                Text(items.isEmpty ? "No notes yet. Tap the compose button to add one." : "No notes match your search.")
                    .font(.cfCaption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else if group == "person" {
                ForEach(byPerson, id: \.name) { grp in
                    Section(grp.name) {
                        ForEach(grp.notes) { NoteFeedRow(note: $0) }
                    }
                }
            } else {
                ForEach(filtered) { NoteFeedRow(note: $0) }
            }
        }
        .navigationTitle("Notes")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "Search notes, people, authors")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showCompose = true } label: { Image(systemName: "square.and.pencil") }
                    .accessibilityLabel("New note")
            }
        }
        .sheet(isPresented: $showCompose) {
            QuickNoteComposeSheet { await load() }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do { items = try await APIClient.shared.getRecentNotes() } catch { /* keep prior list */ }
    }
}

/// Compose a child case note from anywhere (the iOS Quick Note). Posts to
/// POST /api/notes and refreshes the feed on save.
struct QuickNoteComposeSheet: View {
    let onSaved: () async -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var children: [Child] = []
    @State private var childId = ""
    @State private var title = ""
    @State private var content = ""
    @State private var priority = "medium"
    @State private var saving = false
    @State private var errorMessage: String?

    private var canSave: Bool {
        !childId.isEmpty
            && !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !content.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Child") {
                    Picker("Child", selection: $childId) {
                        Text("Select a child").tag("")
                        ForEach(children) { c in
                            Text("\(c.firstName) \(c.lastName)").tag(c.id)
                        }
                    }
                }
                Section("Note") {
                    TextField("Title", text: $title)
                    TextField("What did you observe?", text: $content, axis: .vertical)
                        .lineLimit(3 ... 6)
                    Picker("Priority", selection: $priority) {
                        Text("Low").tag("low")
                        Text("Medium").tag("medium")
                        Text("High").tag("high")
                        Text("Critical").tag("critical")
                    }
                }
                Section {
                    Button { Task { await save() } } label: {
                        HStack {
                            if saving { ProgressView() }
                            Text("Add note")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .disabled(!canSave || saving)
                }
            }
            .navigationTitle("Quick note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .task {
                do { children = try await APIClient.shared.getChildren() } catch { /* leave empty */ }
            }
            .alert("Notice", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func save() async {
        guard let cid = Int(childId) else { return }
        saving = true
        defer { saving = false }
        do {
            _ = try await APIClient.shared.createStudentNote(
                childId: cid,
                title: title.trimmingCharacters(in: .whitespaces),
                content: content.trimmingCharacters(in: .whitespaces),
                priority: priority,
            )
            await onSaved()
            dismiss()
        } catch {
            errorMessage = "Couldn't save that note. Check your connection and try again."
        }
    }
}

private struct NoteFeedRow: View {
    let note: NoteFeedItem

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Image(systemName: note.kind == "child" ? "figure.child" : "person.2.fill")
                    .foregroundColor(note.kind == "child" ? .cfChildren : .cfFamily)
                Text(note.subjectName)
                    .font(.cfSubheadline).fontWeight(.semibold)
                    .foregroundColor(.cfTextPrimary)
                Text("·").foregroundColor(.secondary)
                Text(note.title.capitalized)
                    .font(.cfCaption).foregroundColor(.secondary)
                Spacer()
                if let p = note.priority, ["high", "critical"].contains(p) {
                    Text(p.capitalized)
                        .font(.caption2).bold()
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background((p == "critical" ? Color.red : Color.orange).opacity(0.15))
                        .foregroundColor(p == "critical" ? .red : .orange)
                        .clipShape(Capsule())
                }
                if note.confidentiality == "sensitive" {
                    Image(systemName: "lock.fill").font(.caption2).foregroundColor(.red)
                }
            }
            Text(note.body)
                .font(.cfCaption)
                .foregroundColor(.cfTextPrimary)
                .lineLimit(3)
            Text(subtitle)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 2)
    }

    private var subtitle: String {
        let who = note.author.map { "\($0) · " } ?? ""
        return who + Self.formatted(note.at)
    }

    private static func formatted(_ iso: String?) -> String {
        guard let iso else { return "" }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        guard let d = fractional.date(from: iso) ?? plain.date(from: iso) else { return "" }
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .short
        return out.string(from: d)
    }
}
