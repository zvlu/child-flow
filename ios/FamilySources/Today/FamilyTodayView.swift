import SwiftUI
import UIKit
import AVKit

private func familyMomentMeta(_ type: String) -> (label: String, symbol: String, color: Color) {
    switch type {
    case "meal": return (L(.meal), "fork.knife", .cfAttendance)
    case "nap": return (L(.nap), "moon.fill", .cfChildren)
    case "diaper": return (L(.diaper), "drop.fill", .orange)
    case "note": return (L(.noteWord), "text.bubble.fill", .cfInfo)
    case "photo": return (L(.photo), "camera.fill", .cfFamily)
    default: return (L(.activity), "sparkles", .cfPrimary)
    }
}

private func familyDayLabel(_ d: Date) -> String {
    let cal = Calendar.current
    if cal.isDateInToday(d) { return L(.today) }
    if cal.isDateInYesterday(d) { return L(.yesterday) }
    let f = DateFormatter()
    f.locale = FamilyL10n.shared.locale
    f.setLocalizedDateFormatFromTemplate("EEEEMMMd")
    return f.string(from: d)
}
private func familyTime(_ d: Date) -> String {
    let f = DateFormatter()
    f.locale = FamilyL10n.shared.locale
    f.timeStyle = .short
    f.dateStyle = .none
    return f.string(from: d)
}

/// AsyncImage can't load `data:` URLs, so decode base64 image data URLs directly.
private func dataUrlImage(_ s: String?) -> Image? {
    guard let s, s.hasPrefix("data:image"), let comma = s.firstIndex(of: ","),
          let data = Data(base64Encoded: String(s[s.index(after: comma)...])),
          let ui = UIImage(data: data) else { return nil }
    return Image(uiImage: ui)
}

@MainActor
final class FamilyTodayViewModel: ObservableObject {
    @Published var activities: [ActivityLogItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do { activities = try await APIClient.shared.getFamilyActivity() }
        catch { errorMessage = (error as? APIError)?.errorDescription ?? L(.couldntLoadUpdates) }
    }
}

struct FamilyTodayView: View {
    @StateObject private var vm = FamilyTodayViewModel()
    @ObservedObject private var l10n = FamilyL10n.shared

    private var grouped: [(day: String, items: [ActivityLogItem])] {
        var order: [String] = []
        var map: [String: [ActivityLogItem]] = [:]
        for a in vm.activities {
            let key = familyDayLabel(a.timestamp)
            if map[key] == nil { map[key] = []; order.append(key) }
            map[key]!.append(a)
        }
        return order.map { (day: $0, items: map[$0]!) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading {
                    ProgressView()
                } else if vm.activities.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "sparkles").font(.largeTitle).foregroundColor(.cfPrimary.opacity(0.4))
                        Text(L(.noUpdatesToday)).font(.cfSubheadline).foregroundColor(.cfTextSecondary)
                        Text(L(.teachersWillShare))
                            .font(.cfCaption).foregroundColor(.cfTextSecondary).multilineTextAlignment(.center)
                    }.padding()
                } else {
                    List {
                        ForEach(grouped, id: \.day) { group in
                            Section(group.day) {
                                ForEach(group.items) { a in FamilyMomentRow(item: a) }
                            }
                        }
                    }
                }
            }
            .navigationTitle(L(.tabToday))
        }
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }
}

private struct FamilyMomentRow: View {
    let item: ActivityLogItem
    var body: some View {
        let meta = familyMomentMeta(item.activityType)
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(meta.color.opacity(0.15)).frame(width: 34, height: 34)
                    Image(systemName: meta.symbol).font(.system(size: 14)).foregroundColor(meta.color)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(item.childName).font(.cfSubheadline.weight(.semibold)).foregroundColor(.cfTextPrimary)
                    Text("\(meta.label) · \(familyTime(item.timestamp))").font(.cfCaption2).foregroundColor(.cfTextSecondary)
                }
                Spacer()
            }
            if !item.description.isEmpty {
                Text(item.description).font(.cfBody).foregroundColor(.cfTextPrimary)
            }
            if item.mediaType == "video", let s = item.mediaUrl, s.hasPrefix("http"), let url = URL(string: s) {
                VideoPlayer(player: AVPlayer(url: url)).frame(height: 200).cornerRadius(12)
            } else if let img = dataUrlImage(item.mediaUrl) {
                img.resizable().scaledToFill().frame(maxWidth: .infinity).frame(height: 200).clipped().cornerRadius(12)
            } else if let s = item.mediaUrl, s.hasPrefix("http"), let url = URL(string: s) {
                AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { ProgressView() }
                    .frame(maxWidth: .infinity).frame(height: 200).clipped().cornerRadius(12)
            }
        }
        .padding(.vertical, 4)
    }
}
