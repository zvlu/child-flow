import Foundation

// MARK: - Health Records write endpoints (POST /api/health, POST /api/health/:id)
//
// GET /api/health already flows through APIClient.getHealthRecords() (see
// APIClient.swift). This file adds the two write endpoints backing
// HealthView's "Add Health Record" / "Mark as Completed" / "Reschedule Next
// Visit" actions.
//
// Same self-contained-networking pattern as ios/Sources/InKind/InKindView.swift
// and ios/Sources/Networking/ParticipationClearance.swift: APIClient's
// `get`/`post` are `private` to APIClient.swift (Swift's `private` is
// file-scoped, so an extension declared here cannot call them) — so this
// does its own minimal request/response cycle instead, using the same base
// URL, auth header, and date encode/decode conventions as APIClient.swift,
// just duplicated locally. If APIClient.swift's base URL or date handling
// ever changes, keep this block in sync.
extension APIClient {
    /// Creates a new health record. Backs the "Add Health Record" flow.
    /// `completedDate` defaults to now server-side when omitted.
    func createHealthRecord(
        childId: String,
        category: String,
        completedDate: Date? = nil,
        dueDate: Date? = nil,
        notes: String? = nil
    ) async throws -> HealthRecord {
        struct Body: Encodable {
            let childId: String
            let category: String
            let completedDate: Date?
            let dueDate: Date?
            let notes: String?
        }
        return try await healthPost(
            "health",
            body: Body(childId: childId, category: category, completedDate: completedDate, dueDate: dueDate, notes: notes)
        )
    }

    /// Updates an existing health record with any subset of the given
    /// fields. Backs "Mark as Completed" (pass `completedDate`; the server
    /// automatically sets status to current when a completedDate is sent
    /// without an explicit status) and "Reschedule Next Visit" (pass
    /// `dueDate` only).
    func updateHealthRecord(
        id: String,
        completedDate: Date? = nil,
        dueDate: Date? = nil
    ) async throws -> HealthRecord {
        struct Body: Encodable {
            let completedDate: Date?
            let dueDate: Date?
        }
        return try await healthPost(
            "health/\(id)",
            body: Body(completedDate: completedDate, dueDate: dueDate)
        )
    }

    // MARK: Self-contained networking (see note above)

    private static let healthBaseURL = URL(string: "http://localhost:3000/api")!
    private static let healthTokenAccount = "auth_token"

    private static let healthDecoder: JSONDecoder = {
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

    private static let healthEncoder: JSONEncoder = {
        let e = JSONEncoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(fractional.string(from: date))
        }
        return e
    }()

    private func healthMakeURL(_ path: String) -> URL {
        let base = Self.healthBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.healthBaseURL.appendingPathComponent(path)
    }

    private func healthAddAuthHeader(_ request: inout URLRequest) {
        if let token = KeychainHelper.get(Self.healthTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func healthValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func healthPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = healthMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        healthAddAuthHeader(&request)
        request.httpBody = try Self.healthEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try healthValidate(response)
        return try Self.healthDecoder.decode(T.self, from: data)
    }
}
