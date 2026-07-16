import Foundation

// MARK: - Staff Management (create staff, log training hours, assign classroom)
//
// Mirrors server/staffDirectory.ts's POST /api/staff, POST /api/staff/training,
// and POST /api/classrooms/:id/assign-staff. Wires up StaffView.swift's "Add
// Staff Member", "Log Training Hours", and "Assign Classroom" flows, which
// previously only mutated StaffViewModel's local `allStaff` array and were
// wiped on next load()/relaunch.
//
// Like ios/Sources/InKind/InKindView.swift and
// ios/Sources/Networking/ParticipationClearance.swift, this can't extend
// APIClient.swift's private get/post helpers (Swift's `private` is
// file-scoped), so it duplicates the same request/response conventions
// (base URL, Bearer-token-from-Keychain auth, ISO8601-fractional-seconds
// date encoding) locally instead of editing APIClient.swift.

struct CreateStaffResponse: Decodable {
    let id: String
}

struct LogTrainingResponse: Decodable {
    let id: Int
    let success: Bool
}

extension APIClient {
    /// Admin-only server-side — throws `APIError.httpError(403)` if the
    /// signed-in user isn't an admin.
    @discardableResult
    func createStaffMember(
        firstName: String,
        lastName: String,
        email: String?,
        phone: String?,
        position: String?,
        role: String
    ) async throws -> CreateStaffResponse {
        struct Body: Encodable {
            let firstName: String
            let lastName: String
            let email: String?
            let phone: String?
            let position: String?
            let role: String
        }
        return try await staffMgmtPost(
            "staff",
            body: Body(firstName: firstName, lastName: lastName, email: email, phone: phone, position: position, role: role)
        )
    }

    /// Not admin-gated server-side — any signed-in staff member may log
    /// training hours (their own or another's).
    @discardableResult
    func logTrainingHours(
        staffId: Int,
        trainingName: String,
        hours: Double,
        trainingDate: Date?,
        notes: String?
    ) async throws -> LogTrainingResponse {
        struct Body: Encodable {
            let staffId: Int
            let trainingName: String
            let hours: Double
            let trainingDate: Date?
            let notes: String?
        }
        return try await staffMgmtPost(
            "staff/training",
            body: Body(staffId: staffId, trainingName: trainingName, hours: hours, trainingDate: trainingDate, notes: notes)
        )
    }

    /// Admin-only server-side — throws `APIError.httpError(403)` if the
    /// signed-in user isn't an admin. `staffId: nil` unassigns whichever
    /// staffer currently holds that role in the classroom.
    func assignClassroomStaff(classroomId: Int, role: String, staffId: Int?) async throws {
        struct Body: Encodable {
            let role: String
            let staffId: Int?
        }
        let _: SuccessResponse = try await staffMgmtPost(
            "classrooms/\(classroomId)/assign-staff",
            body: Body(role: role, staffId: staffId)
        )
    }

    // MARK: Self-contained networking (see note above)

    private static let staffMgmtBaseURL = URL(string: "http://localhost:3000/api")!
    private static let staffMgmtTokenAccount = "auth_token"

    private static let staffMgmtEncoder: JSONEncoder = {
        let e = JSONEncoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(fractional.string(from: date))
        }
        return e
    }()

    private static let staffMgmtDecoder: JSONDecoder = {
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

    private func staffMgmtMakeURL(_ path: String) -> URL {
        let base = Self.staffMgmtBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.staffMgmtBaseURL.appendingPathComponent(path)
    }

    private func staffMgmtAddAuthHeader(_ request: inout URLRequest) {
        if let token = KeychainHelper.get(Self.staffMgmtTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func staffMgmtValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func staffMgmtPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = staffMgmtMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        staffMgmtAddAuthHeader(&request)
        request.httpBody = try Self.staffMgmtEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try staffMgmtValidate(response)
        return try Self.staffMgmtDecoder.decode(T.self, from: data)
    }
}
