import SwiftUI

// MARK: - Classroom Quality (CLASS®/ECERS observation tracking)
//
// Mirrors client/src/pages/ClassroomQuality.tsx for the native staff app.
// Backed by server/classroomQualityRest.ts, which reuses the existing
// business logic in server/classroomQuality.ts (listAssessments /
// createAssessment). Head Start-gated — OHS uses CLASS® in federal reviews.

// MARK: - Wire models (mirror server/classroomQualityRest.ts JSON exactly)

struct ClassroomAssessmentDTO: Decodable, Identifiable {
    let id: String
    let classroomId: String
    let classroomName: String
    let tool: String // "class" | "ecers"
    let assessmentDate: Date
    let observer: String?
    /// Dimension/subscale key -> score (1–7). Keys are snake_case slugs
    /// (e.g. "positive_climate") shared verbatim with the web app — see the
    /// note on `classroomQualityDecoder` below for why key casing is
    /// preserved exactly as sent by the server.
    let scores: [String: Double]
    let coachingNotes: String?
}

struct NewAssessmentRequest: Encodable {
    let classroomId: String
    let tool: String
    let assessmentDate: Date
    let observer: String?
    let scores: [String: Double]
    let coachingNotes: String?
}

// MARK: - CLASS® domain/dimension definitions (mirror CLASS_DOMAINS in the web page)

struct CLASSDimension: Identifiable, Hashable {
    let key: String
    let label: String
    var id: String { key }
}

struct CLASSDomain: Identifiable {
    let key: String
    let label: String
    let shortLabel: String
    let competitiveThreshold: Double
    let dimensions: [CLASSDimension]
    let reversedKeys: Set<String>
    var id: String { key }
}

let classDomains: [CLASSDomain] = [
    CLASSDomain(
        key: "emotional_support",
        label: "Emotional Support",
        shortLabel: "ES",
        competitiveThreshold: 6.0,
        dimensions: [
            CLASSDimension(key: "positive_climate", label: "Positive Climate"),
            CLASSDimension(key: "negative_climate", label: "Negative Climate (low = good)"),
            CLASSDimension(key: "teacher_sensitivity", label: "Teacher Sensitivity"),
            CLASSDimension(key: "regard_perspectives", label: "Regard for Student Perspectives"),
        ],
        reversedKeys: ["negative_climate"]
    ),
    CLASSDomain(
        key: "classroom_organization",
        label: "Classroom Organization",
        shortLabel: "CO",
        competitiveThreshold: 6.0,
        dimensions: [
            CLASSDimension(key: "behavior_management", label: "Behavior Management"),
            CLASSDimension(key: "productivity", label: "Productivity"),
            CLASSDimension(key: "instructional_formats", label: "Instructional Learning Formats"),
        ],
        reversedKeys: []
    ),
    CLASSDomain(
        key: "instructional_support",
        label: "Instructional Support",
        shortLabel: "IS",
        competitiveThreshold: 3.0,
        dimensions: [
            CLASSDimension(key: "concept_development", label: "Concept Development"),
            CLASSDimension(key: "quality_feedback", label: "Quality of Feedback"),
            CLASSDimension(key: "language_modeling", label: "Language Modeling"),
        ],
        reversedKeys: []
    ),
]

/// ECERS subscales (mirror ECERS_SUBSCALES in the web page), in display order.
let ecersSubscales: [(key: String, label: String)] = [
    ("space_furnishings", "Space & Furnishings"),
    ("personal_care", "Personal Care Routines"),
    ("language_literacy", "Language & Literacy"),
    ("learning_activities", "Learning Activities"),
    ("interaction", "Interaction"),
    ("program_structure", "Program Structure"),
]

/// Domain average with reversed dimensions flipped (8 − score). Mirrors
/// `domainAverage` in client/src/pages/ClassroomQuality.tsx.
func domainAverage(scores: [String: Double], domain: CLASSDomain) -> Double? {
    var vals: [Double] = []
    for dim in domain.dimensions {
        guard let raw = scores[dim.key] else { continue }
        vals.append(domain.reversedKeys.contains(dim.key) ? 8 - raw : raw)
    }
    guard !vals.isEmpty else { return nil }
    return (vals.reduce(0, +) / Double(vals.count) * 10).rounded() / 10
}

// MARK: - APIClient extension
//
// getClassroomAssessments / createClassroomAssessment follow the same call
// ergonomics as every other APIClient method (`try await
// APIClient.shared.foo(...)`), but this feature must not modify the shared
// ios/Sources/Networking/APIClient.swift file. APIClient's `get`/`post`
// helpers are `private` to that file (Swift's `private` is file-scoped, so
// an extension declared here cannot call them), so these two methods do
// their own minimal request/response cycle instead — same base URL and auth
// header conventions as APIClient.swift (see GrantBudgetView.swift for the
// same pattern used elsewhere in this app).
//
// One deliberate difference from APIClient's shared decoder: we do NOT set
// `keyDecodingStrategy = .convertFromSnakeCase` here. `scores` is a raw
// `Record<string, number>` keyed by snake_case dimension slugs (e.g.
// "positive_climate"); JSONDecoder's snake-case conversion is applied to
// *every* keyed container it decodes, including Dictionary<String, Value>,
// which would silently rewrite those keys to "positiveClimate" and break
// every lookup in `domainAverage` above. All of classroomQualityRest.ts's
// top-level fields are already camelCase, so skipping the conversion loses
// nothing there while keeping `scores` keys intact.
extension APIClient {
    func getClassroomAssessments() async throws -> [ClassroomAssessmentDTO] {
        try await classroomQualityGet("classroom-quality")
    }

    func createClassroomAssessment(_ request: NewAssessmentRequest) async throws {
        let _: SuccessResponse = try await classroomQualityPost("classroom-quality", body: request)
    }

    // MARK: Self-contained networking (see note above)

    private static let classroomQualityBaseURL = URL(string: "http://localhost:3000/api")!
    private static let classroomQualityTokenAccount = "auth_token"

    private static let classroomQualityDecoder: JSONDecoder = {
        let d = JSONDecoder()
        // Intentionally no keyDecodingStrategy — see extension doc comment.
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

    private static let classroomQualityEncoder: JSONEncoder = {
        let e = JSONEncoder()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        e.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            try container.encode(fractional.string(from: date))
        }
        return e
    }()

    private func classroomQualityMakeURL(_ path: String) -> URL {
        let base = Self.classroomQualityBaseURL.absoluteString
        let joined = path.hasPrefix("/") ? base + path : base + "/" + path
        return URL(string: joined) ?? Self.classroomQualityBaseURL.appendingPathComponent(path)
    }

    private func classroomQualityValidate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            if http.statusCode == 401 {
                NotificationCenter.default.post(name: .cfSessionExpired, object: nil)
                throw APIError.unauthorized
            }
            throw APIError.httpError(http.statusCode)
        }
    }

    private func classroomQualityGet<T: Decodable>(_ path: String) async throws -> T {
        let url = classroomQualityMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = KeychainHelper.get(Self.classroomQualityTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        try classroomQualityValidate(response)
        return try Self.classroomQualityDecoder.decode(T.self, from: data)
    }

    private func classroomQualityPost<Body: Encodable, T: Decodable>(_ path: String, body: Body) async throws -> T {
        let url = classroomQualityMakeURL(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = KeychainHelper.get(Self.classroomQualityTokenAccount) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try Self.classroomQualityEncoder.encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        try classroomQualityValidate(response)
        return try Self.classroomQualityDecoder.decode(T.self, from: data)
    }
}

// MARK: - View Model

@MainActor
final class ClassroomQualityViewModel: ObservableObject {
    @Published var assessments: [ClassroomAssessmentDTO] = []
    @Published var classrooms: [ClassroomSummary] = []
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?

    var classAssessments: [ClassroomAssessmentDTO] {
        assessments.filter { $0.tool == "class" }
    }

    /// Newest CLASS assessment per classroom (the list is already
    /// date-descending, as returned by listAssessments on the server).
    var latestClassPerClassroom: [ClassroomAssessmentDTO] {
        var seen = Set<String>()
        var result: [ClassroomAssessmentDTO] = []
        for a in classAssessments where !seen.contains(a.classroomId) {
            seen.insert(a.classroomId)
            result.append(a)
        }
        return result
    }

    var latestClassroomsObserved: Int { latestClassPerClassroom.count }

    func latestDomainAverage(_ domain: CLASSDomain) -> Double? {
        let vals = latestClassPerClassroom.compactMap { domainAverage(scores: $0.scores, domain: domain) }
        guard !vals.isEmpty else { return nil }
        return (vals.reduce(0, +) / Double(vals.count) * 10).rounded() / 10
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let a = APIClient.shared.getClassroomAssessments()
            async let c = APIClient.shared.getClassrooms()
            let (loadedAssessments, loadedClassrooms) = try await (a, c)
            assessments = loadedAssessments
            classrooms = loadedClassrooms
            errorMessage = nil
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
                ?? "Couldn't load Classroom Quality data. Check your connection and try again."
        }
    }

    @discardableResult
    func recordObservation(
        classroomId: String,
        tool: String,
        assessmentDate: Date,
        observer: String?,
        scores: [String: Double],
        coachingNotes: String?
    ) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        do {
            let request = NewAssessmentRequest(
                classroomId: classroomId,
                tool: tool,
                assessmentDate: assessmentDate,
                observer: observer,
                scores: scores,
                coachingNotes: coachingNotes
            )
            try await APIClient.shared.createClassroomAssessment(request)
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription
                ?? "Couldn't save that observation. Check your connection and try again."
            return false
        }
    }
}

// MARK: - Main View

struct ClassroomQualityView: View {
    @StateObject private var viewModel = ClassroomQualityViewModel()
    @State private var showRecordSheet = false

    var body: some View {
        HeadStartGate(featureDescription: "Classroom Quality assessments") {
            List {
                if let errorMessage = viewModel.errorMessage {
                    Section {
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.cfError)
                            Text(errorMessage)
                                .font(.cfSubheadline)
                                .foregroundColor(.cfTextPrimary)
                        }
                        .padding(.vertical, 4)
                    }
                    .listRowBackground(Color.cfHealthBg)
                }

                Section {
                    VStack(spacing: 10) {
                        ForEach(classDomains) { domain in
                            DomainSummaryCard(
                                domain: domain,
                                average: viewModel.latestDomainAverage(domain),
                                classroomsObserved: viewModel.latestClassroomsObserved
                            )
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("CLASS® Domain Summary")
                }
                .listRowBackground(Color.clear)

                if viewModel.classAssessments.count >= 2 {
                    Section {
                        ForEach(viewModel.classAssessments.sorted { $0.assessmentDate < $1.assessmentDate }) { a in
                            TrendRow(assessment: a)
                        }
                    } header: {
                        Text("CLASS® Trend")
                    } footer: {
                        Text("Dashed thresholds on the web trend chart: ES/CO 6.0 · IS 3.0")
                            .font(.cfCaption2)
                    }
                }

                Section {
                    if viewModel.assessments.isEmpty {
                        Text("No observations yet. Record a CLASS or ECERS observation to start the quality trend.")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    } else {
                        ForEach(viewModel.assessments) { a in
                            AssessmentRow(assessment: a)
                        }
                    }
                } header: {
                    Text("Assessment History (\(viewModel.assessments.count))")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Classroom Quality")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showRecordSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showRecordSheet) {
                RecordObservationSheet(classrooms: viewModel.classrooms) { classroomId, tool, date, observer, scores, notes in
                    await viewModel.recordObservation(
                        classroomId: classroomId,
                        tool: tool,
                        assessmentDate: date,
                        observer: observer,
                        scores: scores,
                        coachingNotes: notes
                    )
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
            .overlay {
                if viewModel.isLoading && viewModel.assessments.isEmpty {
                    ProgressView()
                }
            }
        }
    }
}

// MARK: - Domain Summary Card

private struct DomainSummaryCard: View {
    let domain: CLASSDomain
    let average: Double?
    let classroomsObserved: Int

    private var meetsThreshold: Bool {
        guard let average else { return false }
        return average >= domain.competitiveThreshold
    }

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(domain.label)
                    .font(.cfSubheadline)
                    .foregroundColor(.cfTextSecondary)
                Text(average != nil ? String(format: "%.1f", average!) : "—")
                    .font(.cfTitle)
                    .foregroundColor(average == nil ? .cfTextSecondary : (meetsThreshold ? .cfAttendance : .cfWarning))
                Text("Competitive threshold: \(String(format: "%.1f", domain.competitiveThreshold)) · \(classroomsObserved) classroom\(classroomsObserved == 1 ? "" : "s") observed")
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
            }
            Spacer()
            if average != nil {
                Image(systemName: meetsThreshold ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .foregroundColor(meetsThreshold ? .cfAttendance : .cfWarning)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .cfSubtleShadow()
    }
}

// MARK: - Trend Row (simple date : score list, no charting dependency)

private struct TrendRow: View {
    let assessment: ClassroomAssessmentDTO

    var body: some View {
        HStack {
            Text(assessment.assessmentDate.formatted(date: .abbreviated, time: .omitted))
                .font(.cfCaption)
                .foregroundColor(.cfTextSecondary)
            Spacer()
            HStack(spacing: 6) {
                ForEach(classDomains) { domain in
                    if let avg = domainAverage(scores: assessment.scores, domain: domain) {
                        let ok = avg >= domain.competitiveThreshold
                        Text("\(domain.shortLabel) \(String(format: "%.1f", avg))")
                            .font(.cfCaption2.weight(.semibold))
                            .foregroundColor(ok ? .cfAttendance : .cfWarning)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background((ok ? Color.cfAttendance : Color.cfWarning).opacity(0.12))
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Assessment History Row

private struct AssessmentRow: View {
    let assessment: ClassroomAssessmentDTO

    private var ecersSummary: String {
        ecersSubscales.compactMap { pair -> String? in
            guard let v = assessment.scores[pair.key] else { return nil }
            return "\(pair.label): \(String(format: "%.0f", v))"
        }.joined(separator: "  ·  ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(assessment.classroomName)
                            .font(.cfSubheadline.weight(.semibold))
                        CFBadge(label: assessment.tool.uppercased(), color: .cfPrimary)
                    }
                    if assessment.tool == "class" {
                        HStack(spacing: 6) {
                            ForEach(classDomains) { domain in
                                if let avg = domainAverage(scores: assessment.scores, domain: domain) {
                                    let ok = avg >= domain.competitiveThreshold
                                    Text("\(domain.shortLabel) \(String(format: "%.1f", avg))")
                                        .font(.cfCaption2.weight(.semibold))
                                        .foregroundColor(ok ? .cfAttendance : .cfWarning)
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 3)
                                        .background((ok ? Color.cfAttendance : Color.cfWarning).opacity(0.12))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    } else if !ecersSummary.isEmpty {
                        Text(ecersSummary)
                            .font(.cfCaption2)
                            .foregroundColor(.cfTextSecondary)
                    }
                }
                Spacer()
                Text(assessment.assessmentDate.formatted(date: .abbreviated, time: .omitted) + (assessment.observer.map { " · \($0)" } ?? ""))
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
            }
            if let notes = assessment.coachingNotes, !notes.isEmpty {
                Label(notes, systemImage: "note.text")
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Record Observation Sheet

private struct RecordObservationSheet: View {
    let classrooms: [ClassroomSummary]
    let onSave: (String, String, Date, String?, [String: Double], String?) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var classroomId: String = ""
    @State private var tool: String = "class"
    @State private var date = Date()
    @State private var observer = ""
    @State private var scores: [String: Int] = [:]
    @State private var notes = ""
    @State private var isSaving = false

    private var dimensionFields: [(key: String, label: String)] {
        if tool == "class" {
            return classDomains.flatMap { domain in
                domain.dimensions.map { (key: $0.key, label: "\(domain.shortLabel) — \($0.label)") }
            }
        } else {
            return ecersSubscales
        }
    }

    private var isValid: Bool {
        !classroomId.isEmpty && !scores.isEmpty
    }

    private func scoreBinding(for key: String) -> Binding<Int> {
        Binding(
            get: { scores[key] ?? 0 },
            set: { scores[key] = $0 == 0 ? nil : $0 }
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Observation") {
                    Picker("Classroom", selection: $classroomId) {
                        Text("Select a classroom").tag("")
                        ForEach(classrooms) { c in
                            Text(c.name).tag(c.id)
                        }
                    }
                    Picker("Tool", selection: $tool) {
                        Text("CLASS®").tag("class")
                        Text("ECERS").tag("ecers")
                    }
                    .onChange(of: tool) { _, _ in scores = [:] }
                    DatePicker("Date", selection: $date, in: ...Date(), displayedComponents: .date)
                    TextField("Observer name", text: $observer)
                }

                Section {
                    ForEach(dimensionFields, id: \.key) { field in
                        HStack {
                            Text(field.label)
                                .font(.cfSubheadline)
                            Spacer()
                            Picker(field.label, selection: scoreBinding(for: field.key)) {
                                Text("—").tag(0)
                                ForEach(1...7, id: \.self) { n in
                                    Text("\(n)").tag(n)
                                }
                            }
                            .pickerStyle(.menu)
                            .labelsHidden()
                        }
                    }
                } header: {
                    Text(tool == "class" ? "CLASS® Dimensions (1–7)" : "ECERS Subscales (1–7)")
                }

                Section("Coaching Notes") {
                    TextEditor(text: $notes).frame(minHeight: 70)
                }
            }
            .navigationTitle("Record Observation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let scoreDoubles = scores.reduce(into: [String: Double]()) { acc, pair in
                            acc[pair.key] = Double(pair.value)
                        }
                        let trimmedObserver = observer.trimmingCharacters(in: .whitespacesAndNewlines)
                        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
                        isSaving = true
                        Task {
                            let ok = await onSave(
                                classroomId,
                                tool,
                                date,
                                trimmedObserver.isEmpty ? nil : trimmedObserver,
                                scoreDoubles,
                                trimmedNotes.isEmpty ? nil : trimmedNotes
                            )
                            isSaving = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(!isValid || isSaving)
                }
            }
            .overlay {
                if isSaving { ProgressView() }
            }
        }
    }
}
