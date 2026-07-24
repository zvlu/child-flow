import SwiftUI

/// Unified, org-wide case-note feed (child + family notes), newest first —
/// the mobile mirror of the web Notes page. A note appears here as soon as
/// it's submitted from any record. Backed by NotesAPI (GET /api/notes/recent).
struct NotesView: View {
    @State private var items: [NoteFeedItem] = []
    @State private var isLoading = false
    @State private var filter = "all"   // all | child | family
    @State private var search = ""

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

    var body: some View {
        List {
            Picker("Filter", selection: $filter) {
                Text("All").tag("all")
                Text("Children").tag("child")
                Text("Families").tag("family")
            }
            .pickerStyle(.segmented)

            if isLoading && items.isEmpty {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if filtered.isEmpty {
                Text(items.isEmpty ? "No notes yet. Add one from a child or family record." : "No notes match your search.")
                    .font(.cfCaption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                ForEach(filtered) { note in
                    NoteFeedRow(note: note)
                }
            }
        }
        .navigationTitle("Notes")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "Search notes, people, authors")
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do { items = try await APIClient.shared.getRecentNotes() } catch { /* keep prior list */ }
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
