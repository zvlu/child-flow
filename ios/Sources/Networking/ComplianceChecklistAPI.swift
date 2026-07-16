import SwiftUI

// MARK: - Program Monitoring Checklist
//
// Mirrors server/complianceChecklistRest.ts (GET /api/compliance/checklist,
// POST /api/compliance/checklist/:itemKey/reviewed) and the underlying
// server/complianceChecklist.ts business logic. This is the same backend
// the web Compliance page's "Program Monitoring Checklist" tab uses.
// Six fixed items per org; each starts unreviewed (isCompliant: false,
// reviewedAt: nil, reviewedBy: nil) until a staffer marks it reviewed —
// unlike the old iOS mock data, there's no fabricated "already compliant"
// history.

struct ComplianceChecklistEntry: Decodable, Identifiable {
    let itemKey: String
    let label: String
    let category: String
    let isCompliant: Bool
    let note: String?
    let reviewedAt: Date?
    let reviewedBy: Int?

    var id: String { itemKey }
}

// MARK: - APIClient extension
//
// getComplianceChecklist / markComplianceChecklistItemReviewed follow the
// same call ergonomics as every other APIClient method (`try await
// APIClient.shared.foo(...)`), but this feature must not modify the shared
// ios/Sources/Networking/APIClient.swift file. APIClient's `get`/`post`
// helpers are `private` to that file (Swift's `private` is file-scoped, so
// an extension declared here cannot call them) — so this does its own
// minimal request/response cycle instead, using the same base URL, auth
// header, and date decode conventions as APIClient.swift, just duplicated
// locally (see ios/Sources/InKind/InKindView.swift and
// ios/Sources/Networking/ParticipationClearance.swift for the same
// pattern). If APIClient.swift's base URL or date handling ever changes,
// keep this block in sync.
extension APIClient {
    func getComplianceChecklist() async throws -> [ComplianceChecklistEntry] {
        try await checklistGet("compliance/checklist")
    }

    @discardableResult
    func markComplianceChecklistItemReviewed(itemKey: String, note: String?) async throws -> ComplianceChecklistEntry {
        struct Body: Encodable {
            let note: String?
        }
        return try await checklistPost("compliance/checklist/\(itemKey)/reviewed", body: Body(note: note))
    }

    // MARK: Self-contained networking (see note above)

    private static let checklistBaseURL = URL(string: "http://localhost:3000/api")!
    private static let checklistTokenAccount = "auth_token"

    private static let checklistDecoder: JSONDecoder = {
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

    private static let checklistEncoder: JSONEncoder = JSONEncoder()

    private func checklistMakeURL(_ path: String) -> URL {
        let base = Self.checklistBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.checklistBaseURL.appendingPathComponent(path)
    }

    private func checklistAddAuthHeader(_ request: inout URLRequest) {
        if let token = KeychainHelper.get(Self.checklistTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func checklistValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func checklistGet<T: Decodable>(_ path: String) async throws -> T {
        let url = checklistMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        checklistAddAuthHeader(&request)
        let (data, response) = try await URLSession.shared.data(for: request)
        try checklistValidate(response)
        return try Self.checklistDecoder.decode(T.self, from: data)
    }

    private func checklistPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = checklistMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        checklistAddAuthHeader(&request)
        request.httpBody = try Self.checklistEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try checklistValidate(response)
        return try Self.checklistDecoder.decode(T.self, from: data)
    }
}
