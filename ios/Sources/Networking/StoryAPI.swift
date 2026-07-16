import Foundation

// MARK: - Program Story (staff-facing "moments" feed)
//
// Mirrors the server's story REST endpoints:
//   GET  /api/story/posts                       -> [StoryPost]
//   POST /api/story/posts                        -> { id, success }
//   POST /api/story/posts/:id/like               -> { liked }
//   GET  /api/story/posts/:id/comments           -> [{ id, authorName, content, postedAt }]
//   POST /api/story/posts/:id/comments           -> { id, authorName, content, postedAt, success }
//
// The GET comments endpoint returns the thread oldest-first. The POST
// endpoint now echoes back the full created comment (not just its id), so
// callers can append it straight to a local thread without a refetch.
//
// Also note: the server does not implement real photo upload. `photoUrl`
// exists on the wire model but nothing populates it yet, so the UI only
// ever shows a generic "photo attached" placeholder when it's non-nil —
// it does not fake an actual photo-picking experience.

// MARK: - APIClient extension
//
// getStoryPosts / createStoryPost / toggleStoryPostLike / addStoryPostComment /
// getStoryPostComments follow the same call ergonomics as every other
// APIClient method (`try await APIClient.shared.foo(...)`), but this
// feature must not modify the shared ios/Sources/Networking/APIClient.swift
// file. APIClient's `get`/`post` helpers are `private` to that file
// (Swift's `private` is file-scoped, so an extension declared here cannot
// call them) — so this does its own minimal request/response cycle
// instead, using the same base URL, auth header, and date encode/decode
// conventions as APIClient.swift, just duplicated locally (see
// ios/Sources/InKind/InKindView.swift and
// ios/Sources/Networking/ParticipationClearance.swift for the same
// pattern). If APIClient.swift's base URL or date handling ever changes,
// keep this block in sync.
extension APIClient {
    func getStoryPosts() async throws -> [StoryPost] {
        try await storyGet("story/posts")
    }

    @discardableResult
    func createStoryPost(caption: String, audience: String?, taggedChildren: [Int]?) async throws -> Int {
        struct Body: Encodable {
            let caption: String
            let audience: String?
            let taggedChildren: [Int]?
        }
        struct Response: Decodable { let id: Int; let success: Bool }
        let response: Response = try await storyPost(
            "story/posts",
            body: Body(caption: caption, audience: audience, taggedChildren: taggedChildren)
        )
        return response.id
    }

    /// Toggles the current staff member's like on a post. Returns the
    /// post's new `liked` state as reported by the server (source of truth
    /// for reconciling any optimistic UI update).
    func toggleStoryPostLike(postId: Int) async throws -> Bool {
        struct Response: Decodable { let liked: Bool }
        let response: Response = try await storyPost("story/posts/\(postId)/like", body: EmptyBody())
        return response.liked
    }

    /// Posts a new comment and returns the full created comment (author
    /// name, content, and timestamp) as reported by the server, so callers
    /// can append it directly to a local thread without a refetch.
    @discardableResult
    func addStoryPostComment(postId: Int, content: String) async throws -> StoryComment {
        struct Body: Encodable { let content: String }
        struct Response: Decodable {
            let id: Int
            let authorName: String
            let content: String
            let postedAt: Date
            let success: Bool
        }
        let response: Response = try await storyPost(
            "story/posts/\(postId)/comments",
            body: Body(content: content)
        )
        return StoryComment(id: response.id, authorName: response.authorName, content: response.content, postedAt: response.postedAt)
    }

    /// Fetches the full comment thread for a post, oldest-first.
    func getStoryPostComments(postId: Int) async throws -> [StoryComment] {
        try await storyGet("story/posts/\(postId)/comments")
    }

    // MARK: Self-contained networking (see note above)

    private static let storyBaseURL = URL(string: "http://localhost:3000/api")!
    private static let storyTokenAccount = "auth_token"

    private static let storyDecoder: JSONDecoder = {
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

    private static let storyEncoder: JSONEncoder = {
        let e = JSONEncoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(fractional.string(from: date))
        }
        return e
    }()

    private func storyMakeURL(_ path: String) -> URL {
        let base = Self.storyBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.storyBaseURL.appendingPathComponent(path)
    }

    private func storyAddAuthHeader(_ request: inout URLRequest) {
        if let token = KeychainHelper.get(Self.storyTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func storyValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func storyGet<T: Decodable>(_ path: String) async throws -> T {
        let url = storyMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        storyAddAuthHeader(&request)
        let (data, response) = try await URLSession.shared.data(for: request)
        try storyValidate(response)
        return try Self.storyDecoder.decode(T.self, from: data)
    }

    private func storyPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = storyMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        storyAddAuthHeader(&request)
        request.httpBody = try Self.storyEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try storyValidate(response)
        return try Self.storyDecoder.decode(T.self, from: data)
    }
}

// MARK: - StoryComment model

/// A single comment on a story post, as returned by
/// `GET /api/story/posts/:id/comments` (thread, oldest-first) and echoed
/// back in full by `POST /api/story/posts/:id/comments`.
struct StoryComment: Decodable, Identifiable {
    let id: Int
    let authorName: String
    let content: String
    let postedAt: Date
}
