import Foundation

// MARK: - Nutrition Forms POST wiring (CACFP §226 recordkeeping)
//
// Mirrors server/nutritionForms.ts (registerNutritionFormRoutes). The GET
// methods (getNutritionForms / getCACFPForms / getMedicalStatements) already
// live in ios/Sources/Networking/APIClient.swift, but there were no POST
// counterparts — the "Save" buttons on ios/Sources/Nutrition/
// NutritionFormsView.swift only appended to a local in-memory array.
//
//   POST /api/nutrition/preferences          childId + completedDate required
//   POST /api/nutrition/infant-formula        childId + completedDate required
//   POST /api/nutrition/medical-statements    childId + signedDate required
//
// This feature must not modify the shared ios/Sources/Networking/
// APIClient.swift file. APIClient's `get`/`post` helpers are `private` to
// that file (Swift's `private` is file-scoped, so an extension declared here
// cannot call them) — so this does its own minimal request/response cycle
// instead, using the same base URL, auth header, and date encode/decode
// conventions as APIClient.swift, just duplicated locally (see
// ios/Sources/InKind/InKindView.swift and
// ios/Sources/Networking/ParticipationClearance.swift for the same pattern).
// If APIClient.swift's base URL or date handling ever changes, keep this
// block in sync.
extension APIClient {
    /// Creates a nutritional-preferences form. `preferences` mirrors the
    /// server's `Array<{ id, foodGroup, item, preference }>` json column
    /// exactly (see drizzle/schema.ts nutritionPreferenceForms.preferences),
    /// so `FoodPreferenceEntry` (Models.swift) can be encoded directly.
    func createNutritionPreferenceForm(
        childId: String,
        classroom: String?,
        completedDate: Date,
        parentName: String?,
        preferences: [FoodPreferenceEntry],
        notes: String?
    ) async throws {
        guard let childIdInt = Int(childId) else { throw NutritionFormsAPIError.invalidChild }
        struct Body: Encodable {
            let childId: Int
            let classroom: String?
            let completedDate: Date
            let parentName: String?
            let preferences: [FoodPreferenceEntry]
            let notes: String?
        }
        let _: SuccessResponse = try await nutritionPost(
            "nutrition/preferences",
            body: Body(
                childId: childIdInt,
                classroom: classroom,
                completedDate: completedDate,
                parentName: parentName,
                preferences: preferences,
                notes: notes
            )
        )
    }

    /// Creates an infant-formula form.
    func createInfantFormulaForm(
        childId: String,
        classroom: String?,
        completedDate: Date,
        parentName: String?,
        formulaBrand: String?,
        formulaType: String?,
        preparationInstructions: String?,
        feedingSchedule: String?,
        notes: String?
    ) async throws {
        guard let childIdInt = Int(childId) else { throw NutritionFormsAPIError.invalidChild }
        struct Body: Encodable {
            let childId: Int
            let classroom: String?
            let completedDate: Date
            let parentName: String?
            let formulaBrand: String?
            let formulaType: String?
            let preparationInstructions: String?
            let feedingSchedule: String?
            let notes: String?
        }
        let _: SuccessResponse = try await nutritionPost(
            "nutrition/infant-formula",
            body: Body(
                childId: childIdInt,
                classroom: classroom,
                completedDate: completedDate,
                parentName: parentName,
                formulaBrand: formulaBrand,
                formulaType: formulaType,
                preparationInstructions: preparationInstructions,
                feedingSchedule: feedingSchedule,
                notes: notes
            )
        )
    }

    /// Creates a medical-statement form.
    func createMedicalStatement(
        childId: String,
        classroom: String?,
        physicianName: String?,
        physicianPhone: String?,
        diagnosis: String?,
        foodsToAvoid: [String],
        substitutions: String?,
        signedDate: Date,
        notes: String?
    ) async throws {
        guard let childIdInt = Int(childId) else { throw NutritionFormsAPIError.invalidChild }
        struct Body: Encodable {
            let childId: Int
            let classroom: String?
            let physicianName: String?
            let physicianPhone: String?
            let diagnosis: String?
            let foodsToAvoid: [String]
            let substitutions: String?
            let signedDate: Date
            let notes: String?
        }
        let _: SuccessResponse = try await nutritionPost(
            "nutrition/medical-statements",
            body: Body(
                childId: childIdInt,
                classroom: classroom,
                physicianName: physicianName,
                physicianPhone: physicianPhone,
                diagnosis: diagnosis,
                foodsToAvoid: foodsToAvoid,
                substitutions: substitutions,
                signedDate: signedDate,
                notes: notes
            )
        )
    }

    // MARK: Self-contained networking (see note above)

    private static let nutritionBaseURL = URL(string: "http://localhost:3000/api")!
    private static let nutritionTokenAccount = "auth_token"

    private static let nutritionEncoder: JSONEncoder = {
        let e = JSONEncoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(fractional.string(from: date))
        }
        return e
    }()

    private static let nutritionDecoder: JSONDecoder = {
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

    private func nutritionMakeURL(_ path: String) -> URL {
        let base = Self.nutritionBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.nutritionBaseURL.appendingPathComponent(path)
    }

    private func nutritionAddAuthHeader(_ request: inout URLRequest) {
        if let token = KeychainHelper.get(Self.nutritionTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func nutritionValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func nutritionPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = nutritionMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        nutritionAddAuthHeader(&request)
        request.httpBody = try Self.nutritionEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try nutritionValidate(response)
        return try Self.nutritionDecoder.decode(T.self, from: data)
    }
}

/// Client-side validation error for the nutrition form sheets — thrown
/// before any network call when the staff member hasn't picked a real child
/// yet (the server requires a valid, org-scoped `childId`).
enum NutritionFormsAPIError: LocalizedError {
    case invalidChild

    var errorDescription: String? {
        switch self {
        case .invalidChild: return "Please select a child before saving."
        }
    }
}
