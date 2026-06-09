import Foundation

/// Central API client for all ChildFlow backend requests.
/// Configure `baseURL` to point at your deployed server.
actor APIClient {
    static let shared = APIClient()

    // MARK: - Configuration
    /// Change this to your production URL before deploying
    private var baseURL = URL(string: "http://localhost:3000/api")!
    private var authToken: String?

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    // MARK: - Auth
    func setToken(_ token: String) {
        authToken = token
        UserDefaults.standard.set(token, forKey: "auth_token")
    }

    func clearToken() {
        authToken = nil
        UserDefaults.standard.removeObject(forKey: "auth_token")
    }

    func loadStoredToken() {
        authToken = UserDefaults.standard.string(forKey: "auth_token")
    }

    // MARK: - Auth Endpoints
    func login(email: String, password: String) async throws -> String {
        struct LoginBody: Encodable { let email, password: String }
        struct LoginResponse: Decodable { let token: String }
        let response: LoginResponse = try await post("auth/login", body: LoginBody(email: email, password: password))
        return response.token
    }

    // MARK: - Dashboard
    func getDashboardStats() async throws -> DashboardData {
        try await get("dashboard/stats")
    }

    // MARK: - Children
    func getChildren() async throws -> [Child] {
        try await get("children")
    }

    func getChild(id: String) async throws -> Child {
        try await get("children/\(id)")
    }

    // MARK: - Attendance
    func getAttendance(date: Date, classroom: String?) async throws -> AttendanceData {
        let dateStr = ISO8601DateFormatter().string(from: date)
        var path = "attendance?date=\(dateStr)"
        if let classroom { path += "&classroom=\(classroom)" }
        return try await get(path)
    }

    func saveAttendance(records: [AttendanceRecord]) async throws {
        struct SaveBody: Encodable { let records: [AttendanceRecord] }
        let _: EmptyResponse = try await post("attendance/bulk", body: SaveBody(records: records))
    }

    // MARK: - Health
    func getHealthRecords() async throws -> [HealthRecord] {
        try await get("health")
    }

    // MARK: - Family Services
    func getFamilies() async throws -> [Family] {
        try await get("families")
    }

    // MARK: - Staff
    func getStaff() async throws -> [StaffMember] {
        try await get("staff")
    }

    // MARK: - Enrollment
    func getEnrollmentApplications() async throws -> [EnrollmentApplication] {
        try await get("enrollment")
    }

    // MARK: - Reports
    func generateReport(type: String) async throws -> GeneratedReport {
        struct ReportRequest: Encodable { let type: String }
        return try await post("reports/generate", body: ReportRequest(type: type))
    }

    // MARK: - Compliance
    func getComplianceData() async throws -> ComplianceData {
        try await get("compliance")
    }

    // MARK: - Settings
    func getSettings() async throws -> ProgramSettings {
        try await get("settings")
    }

    // MARK: - Private helpers
    private func get<T: Decodable>(_ path: String) async throws -> T {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        addAuthHeader(&request)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    private func post<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        addAuthHeader(&request)
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response)
        return try decoder.decode(T.self, from: data)
    }

    private func addAuthHeader(_ request: inout URLRequest) {
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.httpError(http.statusCode)
        }
    }
}

struct EmptyResponse: Decodable {}

enum APIError: LocalizedError {
    case httpError(Int)
    case unauthorized
    case decodingFailed

    var errorDescription: String? {
        switch self {
        case .httpError(let code): return "Server error (\(code))"
        case .unauthorized: return "Please sign in again"
        case .decodingFailed: return "Unexpected server response"
        }
    }
}
