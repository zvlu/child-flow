import SwiftUI
import UIKit
import AVKit

/// Decode a base64 image data URL to a SwiftUI Image (AsyncImage can't load data: URLs).
private func momentImage(_ s: String?) -> Image? {
    guard let s, s.hasPrefix("data:image"), let comma = s.firstIndex(of: ","),
          let data = Data(base64Encoded: String(s[s.index(after: comma)...])),
          let ui = UIImage(data: data) else { return nil }
    return Image(uiImage: ui)
}

// MARK: - Moment type metadata

private struct MomentType: Identifiable {
    let id: String
    let label: String
    let symbol: String
    let color: Color
}

private let MOMENT_TYPES: [MomentType] = [
    .init(id: "meal", label: "Meal", symbol: "fork.knife", color: .cfAttendance),
    .init(id: "nap", label: "Nap", symbol: "moon.fill", color: .cfChildren),
    .init(id: "diaper", label: "Diaper", symbol: "drop.fill", color: .orange),
    .init(id: "activity", label: "Activity", symbol: "sparkles", color: .cfPrimary),
    .init(id: "note", label: "Note", symbol: "text.bubble.fill", color: .cfInfo),
    .init(id: "photo", label: "Photo", symbol: "camera.fill", color: .cfFamily),
]

private func momentMeta(_ type: String) -> MomentType {
    MOMENT_TYPES.first { $0.id == type } ?? MOMENT_TYPES[3]
}

private func momentDayLabel(_ date: Date) -> String {
    let cal = Calendar.current
    if cal.isDateInToday(date) { return "Today" }
    if cal.isDateInYesterday(date) { return "Yesterday" }
    let f = DateFormatter(); f.dateFormat = "EEEE, MMM d"
    return f.string(from: date)
}

private func momentTime(_ date: Date) -> String {
    let f = DateFormatter(); f.dateFormat = "h:mm a"
    return f.string(from: date)
}

// MARK: - ViewModel

@MainActor
final class DailyReportsViewModel: ObservableObject {
    @Published var activities: [ActivityLogItem] = []
    @Published var children: [Child] = []
    @Published var isLoading = false
    @Published var posting = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let kids = APIClient.shared.getChildren()
            async let acts = APIClient.shared.getActivityLogs()
            children = try await kids
            activities = try await acts
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load daily reports."
        }
    }

    func log(childId: String, type: String, description: String) async -> Bool {
        posting = true
        defer { posting = false }
        do {
            try await APIClient.shared.logActivity(childId: childId, activityType: type, description: description)
            activities = (try? await APIClient.shared.getActivityLogs()) ?? activities
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't save that moment."
            return false
        }
    }
}

// MARK: - View

struct DailyReportsView: View {
    @StateObject private var vm = DailyReportsViewModel()
    @State private var selectedChildId = ""
    @State private var selectedType = "activity"
    @State private var description = ""

    private var selectedChildName: String {
        vm.children.first { $0.id == selectedChildId }.map { "\($0.firstName) \($0.lastName)" } ?? ""
    }

    private var groupedFeed: [(day: String, items: [ActivityLogItem])] {
        var order: [String] = []
        var map: [String: [ActivityLogItem]] = [:]
        for a in vm.activities {
            let key = momentDayLabel(a.timestamp)
            if map[key] == nil { map[key] = []; order.append(key) }
            map[key]!.append(a)
        }
        return order.map { (day: $0, items: map[$0]!) }
    }

    private func submit() async {
        guard !selectedChildId.isEmpty else { return }
        let text = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        if await vm.log(childId: selectedChildId, type: selectedType, description: text) {
            description = ""
        }
    }

    var body: some View {
        List {
            Section("Log a Moment") {
                Menu {
                    ForEach(vm.children) { c in
                        Button("\(c.firstName) \(c.lastName)") { selectedChildId = c.id }
                    }
                } label: {
                    HStack {
                        Text("Child").foregroundColor(.cfTextPrimary)
                        Spacer()
                        Text(selectedChildName.isEmpty ? "Select…" : selectedChildName)
                            .foregroundColor(selectedChildName.isEmpty ? .secondary : .cfPrimary)
                        Image(systemName: "chevron.up.chevron.down").font(.caption).foregroundColor(.secondary)
                    }
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(MOMENT_TYPES) { t in
                            let active = selectedType == t.id
                            Button { selectedType = t.id } label: {
                                HStack(spacing: 5) {
                                    Image(systemName: t.symbol).font(.caption)
                                    Text(t.label).font(.cfCaption)
                                }
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(active ? t.color.opacity(0.15) : Color(.tertiarySystemFill))
                                .foregroundColor(active ? t.color : .cfTextSecondary)
                                .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 2)
                }

                TextField("What happened? (e.g. ate all of lunch)", text: $description, axis: .vertical)
                    .lineLimit(1...3)

                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        if vm.posting { ProgressView().padding(.trailing, 4) }
                        else { Image(systemName: "paperplane.fill") }
                        Text("Add to Feed")
                    }
                    .frame(maxWidth: .infinity)
                }
                .disabled(vm.posting || selectedChildId.isEmpty || description.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            if vm.isLoading {
                Section { HStack { Spacer(); ProgressView(); Spacer() } }
            } else if vm.activities.isEmpty {
                Section {
                    Text("No moments logged yet. Add the first one above — families see it instantly.")
                        .font(.cfSubheadline).foregroundColor(.cfTextSecondary)
                }
            } else {
                ForEach(groupedFeed, id: \.day) { group in
                    Section(group.day) {
                        ForEach(group.items) { a in MomentRow(item: a) }
                    }
                }
            }
        }
        .navigationTitle("Daily Reports")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load() }
        .alert("Daily Reports", isPresented: .constant(vm.errorMessage != nil), actions: {
            Button("OK") { vm.errorMessage = nil }
        }, message: { Text(vm.errorMessage ?? "") })
    }
}

private struct MomentRow: View {
    let item: ActivityLogItem
    var body: some View {
        let meta = momentMeta(item.activityType)
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle().fill(meta.color.opacity(0.15)).frame(width: 36, height: 36)
                Image(systemName: meta.symbol).font(.system(size: 15)).foregroundColor(meta.color)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(item.childName).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                    Text(meta.label.uppercased()).font(.system(size: 9, weight: .bold)).foregroundColor(.cfTextSecondary)
                }
                Text(item.description).font(.cfBody).foregroundColor(.cfTextPrimary)
                if item.mediaType == "video", let s = item.mediaUrl, s.hasPrefix("http"), let url = URL(string: s) {
                    VideoPlayer(player: AVPlayer(url: url)).frame(height: 160).cornerRadius(10)
                } else if let img = momentImage(item.mediaUrl) {
                    img.resizable().scaledToFill().frame(maxWidth: .infinity).frame(height: 160).clipped().cornerRadius(10)
                }
                Text("\(momentTime(item.timestamp)) · \(item.staffName)").font(.cfCaption).foregroundColor(.cfTextSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
    }
}
