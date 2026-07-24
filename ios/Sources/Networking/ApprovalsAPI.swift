import Foundation

// MARK: - Approvals (higher-up sign-off inbox)
//
// Mirrors server/approvalsRest.ts: GET /api/approvals?status=… (admins see the
// org queue, managers see their own requests) and POST /api/approvals/:id/review
// { approve, note } (admin only). Backs ApprovalsView.
//
// Like the other feature API files (StaffManagement.swift, StoryAPI.swift), this
// can't reuse APIClient.swift's file-private get/post helpers, so it duplicates
// the same base URL / Bearer-token / date conventions locally.

struct ApprovalItem: Decodable, Identifiable {
    let id: String
    /// "custom_role" | "staff_hire" | "staff_role_change"
    let type: String
    /// "pending" | "approved" | "denied"
    let status: String
    let title: String
    let detail: String
    let requestReason: String?
    let reviewedAt: Date?
    let decisionNote: String?
    let createdAt: Date
}

struct ReviewApprovalResponse: Decodable {
    let success: Bool
}

extension APIClient {
    func getApprovals(status: String = "pending") async throws -> [ApprovalItem] {
        try await approvalsGet("approvals?status=\(status)")
    }

    /// Approve or deny a request. Admin-only server-side — throws
    /// `APIError.httpError(403)` otherwise.
    @discardableResult
    func reviewApproval(id: String, approve: Bool, note: String?) async throws -> ReviewApprovalResponse {
        struct Body: Encodable {
            let approve: Bool
            let note: String?
        }
        return try await approvalsPost("approvals/\(id)/review", body: Body(approve: approve, note: note))
    }

    // MARK: Self-contained networking (see note above)

    private static let approvalsBaseURL = URL(string: "http://localhost:3000/api")!
    private static let approvalsTokenAccount = "auth_token"

    private static let approvalsDecoder: JSONDecoder = {
        let d = JSONDecoder()
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

    private static let approvalsEncoder = JSONEncoder()

    // Preserve any "?query" in the path (URL(string:) keeps it; do NOT use
    // appendingPathComponent, which would percent-escape the "?").
    private func approvalsMakeURL(_ path: String) -> URL {
        let base = Self.approvalsBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.approvalsBaseURL.appendingPathComponent(path)
    }

    private func approvalsAddAuthHeader(_ request: inout URLRequest) {
        if let token = KeychainHelper.get(Self.approvalsTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func approvalsValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func approvalsGet<T: Decodable>(_ path: String) async throws -> T {
        let url = approvalsMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        approvalsAddAuthHeader(&request)
        let (data, response) = try await URLSession.shared.data(for: request)
        try approvalsValidate(response)
        return try Self.approvalsDecoder.decode(T.self, from: data)
    }

    private func approvalsPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = approvalsMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        approvalsAddAuthHeader(&request)
        request.httpBody = try Self.approvalsEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try approvalsValidate(response)
        return try Self.approvalsDecoder.decode(T.self, from: data)
    }
}
