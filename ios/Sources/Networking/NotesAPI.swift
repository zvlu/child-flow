import Foundation

// MARK: - Notes feed (unified case-note timeline)
//
// Mirrors server/notesRest.ts GET /api/notes/recent and the web tRPC
// notes.recent: every child + family note, org-wide, newest first. Backs
// NotesView. Self-contained networking like the other feature API files.

struct NoteFeedItem: Decodable, Identifiable {
    let id: String
    /// "child" | "family"
    let kind: String
    let subjectId: Int
    let subjectName: String
    let title: String
    let body: String
    let tag: String?
    let priority: String?
    /// "standard" | "sensitive"
    let confidentiality: String
    let author: String?
    /// ISO-8601 timestamp string.
    let at: String?
}

extension APIClient {
    func getRecentNotes(limit: Int = 100) async throws -> [NoteFeedItem] {
        try await notesGet("notes/recent?limit=\(limit)")
    }

    // MARK: Self-contained networking (see StaffManagement.swift note)

    private static let notesBaseURL = URL(string: "http://localhost:3000/api")!
    private static let notesTokenAccount = "auth_token"
    private static let notesDecoder = JSONDecoder()

    // Keep "?query" intact — URL(string:) preserves it; appendingPathComponent
    // would percent-escape the "?".
    private func notesMakeURL(_ path: String) -> URL {
        let base = Self.notesBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.notesBaseURL.appendingPathComponent(path)
    }

    private func notesGet<T: Decodable>(_ path: String) async throws -> T {
        let url = notesMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = KeychainHelper.get(Self.notesTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
        return try Self.notesDecoder.decode(T.self, from: data)
    }
}
