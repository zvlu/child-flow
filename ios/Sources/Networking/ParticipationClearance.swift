import SwiftUI

// MARK: - Participation Clearance ("cleared to attend")
//
// Mirrors server/participationClearanceRest.ts (GET /api/children/clearance,
// GET /api/children/:id/clearance). Consumed by the Attendance and Children
// screens to give staff a visible, non-blocking warning when a child isn't
// cleared to attend — staff can still check the child in (e.g. an
// emergency); this is informational, not an enforced block.

struct ClearanceBlocker: Decodable {
    let code: String
    let label: String
}

/// Shape returned per child, both in the org-wide map (GET
/// /api/children/clearance) and the single-child endpoint.
struct ChildClearanceStatus: Decodable {
    let cleared: Bool
    let blockers: [ClearanceBlocker]
}

// MARK: - APIClient extension
//
// getClearanceMap follows the same call ergonomics as every other APIClient
// method (`try await APIClient.shared.foo(...)`), but this feature must not
// modify the shared ios/Sources/Networking/APIClient.swift file. APIClient's
// `get`/`post` helpers are `private` to that file (Swift's `private` is
// file-scoped, so an extension declared here cannot call them) — so this
// does its own minimal request/response cycle instead, using the same base
// URL, auth header, and date decode conventions as APIClient.swift, just
// duplicated locally (see ios/Sources/InKind/InKindView.swift for the same
// pattern). If APIClient.swift's base URL or date handling ever changes,
// keep this block in sync.
extension APIClient {
    /// Org-wide clearance map keyed by childId (as a string) — one request
    /// covers every child, so roster/attendance grids don't fetch per-row.
    func getClearanceMap() async throws -> [String: ChildClearanceStatus] {
        try await clearanceGet("children/clearance")
    }

    // MARK: Self-contained networking (see note above)

    private static let clearanceBaseURL = URL(string: "http://localhost:3000/api")!
    private static let clearanceTokenAccount = "auth_token"

    private static let clearanceDecoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            if let date = fractional.date(from: value) ?? plain.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unrecognized date format: \(value)")
        }
        return d
    }()

    private func clearanceMakeURL(_ path: String) -> URL {
        let base = Self.clearanceBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.clearanceBaseURL.appendingPathComponent(path)
    }

    private func clearanceAddAuthHeader(_ request: inout URLRequest) {
        if let token = KeychainHelper.get(Self.clearanceTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func clearanceValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func clearanceGet<T: Decodable>(_ path: String) async throws -> T {
        let url = clearanceMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        clearanceAddAuthHeader(&request)
        let (data, response) = try await URLSession.shared.data(for: request)
        try clearanceValidate(response)
        return try Self.clearanceDecoder.decode(T.self, from: data)
    }
}

// MARK: - Shared warning badge
//
// One shared component so AttendanceRow (ios/Sources/Attendance/AttendanceView.swift)
// and ChildRow (ios/Sources/Children/ChildrenView.swift) render an identical
// badge instead of duplicating the icon + popover in each file.

/// Small amber warning badge shown when a child isn't cleared to attend.
/// Tapping it reveals the blocker list — non-blocking, purely informational,
/// so staff can still act (e.g. check the child in during an emergency).
struct ClearanceWarningBadge: View {
    let childName: String
    let blockers: [ClearanceBlocker]
    @State private var showBlockers = false

    var body: some View {
        Button {
            showBlockers = true
        } label: {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.cfWarning)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(childName) is not cleared to attend. Double tap for details.")
        .popover(isPresented: $showBlockers) {
            ClearanceBlockerDetail(childName: childName, blockers: blockers)
        }
    }
}

private struct ClearanceBlockerDetail: View {
    let childName: String
    let blockers: [ClearanceBlocker]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Not Cleared to Attend", systemImage: "exclamationmark.triangle.fill")
                .font(.cfSubheadline.weight(.semibold))
                .foregroundColor(.cfWarning)
            Text(childName)
                .font(.cfCaption)
                .foregroundColor(.cfTextSecondary)
            Divider()
            if blockers.isEmpty {
                Text("No details available.")
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(blockers, id: \.code) { blocker in
                        HStack(alignment: .top, spacing: 6) {
                            Text("\u{2022}")
                            Text(blocker.label)
                                .font(.cfCaption)
                                .foregroundColor(.cfTextPrimary)
                        }
                    }
                }
            }
            Text("Staff may still check the child in if needed (e.g. an emergency).")
                .font(.cfCaption2)
                .foregroundColor(.cfTextSecondary)
        }
        .padding(16)
        .frame(minWidth: 260, maxWidth: 320)
        .presentationCompactAdaptation(.popover)
    }
}
