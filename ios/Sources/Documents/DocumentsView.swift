import SwiftUI
import UniformTypeIdentifiers

struct DocumentsView: View {
    @StateObject private var viewModel = DocumentsViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.documents.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.documents.isEmpty {
                    CFEmptyState(
                        icon: "folder.fill",
                        title: "No Documents Yet",
                        message: "Upload files here to review and assign them to a child's profile."
                    )
                } else {
                    List {
                        ForEach(viewModel.sections, id: \.title) { section in
                            Section(section.title) {
                                ForEach(section.documents) { doc in
                                    DocumentRow(document: doc) {
                                        viewModel.assignTarget = doc
                                    }
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("My Documents")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        viewModel.showUpload = true
                    } label: {
                        Label("Upload", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $viewModel.showUpload) {
                UploadDocumentSheet { name, type, data, fileName, mimeType in
                    Task { await viewModel.upload(name: name, type: type, fileData: data, fileName: fileName, mimeType: mimeType) }
                }
            }
            .sheet(item: $viewModel.assignTarget) { doc in
                ChildAssignSheet { child in
                    Task { await viewModel.assign(doc, toChildId: child.id, childName: "\(child.firstName) \(child.lastName)") }
                }
            }
            .alert("Documents", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: { Text(viewModel.errorMessage ?? "") }
            .task { await viewModel.load() }
        }
    }
}

// MARK: - Document Row

struct DocumentRow: View {
    let document: StaffDocument
    let onAssign: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(document.typeColor.opacity(0.12))
                    .frame(width: 40, height: 40)
                Image(systemName: document.typeIcon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(document.typeColor)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(document.name)
                    .font(.cfSubheadline)
                    .foregroundColor(.cfTextPrimary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(document.uploadedLabel)
                        .font(.cfCaption)
                        .foregroundColor(.cfTextSecondary)
                    if let child = document.assignedChildName {
                        Text("·")
                            .foregroundColor(.cfTextSecondary)
                            .font(.cfCaption)
                        Text(child)
                            .font(.cfCaption)
                            .foregroundColor(.cfPrimary)
                    }
                }
            }

            Spacer()

            if document.assignedChildName == nil {
                Button(action: onAssign) {
                    Text("Assign")
                        .font(.cfCaption2.bold())
                        .foregroundColor(.cfFamily)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.cfFamilyBg)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.cfAttendance)
                    .font(.system(size: 16))
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Upload Sheet

struct UploadDocumentSheet: View {
    /// name, type, file bytes, original file name, mime type
    let onUpload: (String, StaffDocument.DocumentType, Data, String, String?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var selectedType: StaffDocument.DocumentType = .general
    @State private var isPickingFile = false
    @State private var pickedFileName: String?
    @State private var pickedData: Data?
    @State private var pickedMimeType: String?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Document") {
                    TextField("File name", text: $name)
                    Picker("Type", selection: $selectedType) {
                        ForEach(StaffDocument.DocumentType.allCases, id: \.self) { type in
                            Label(type.rawValue, systemImage: type.icon).tag(type)
                        }
                    }
                    .pickerStyle(.navigationLink)
                }

                Section {
                    Button {
                        isPickingFile = true
                    } label: {
                        HStack {
                            Text(pickedFileName ?? "Choose File…")
                                .foregroundColor(pickedFileName == nil ? .cfPrimary : .cfTextPrimary)
                            Spacer()
                            if pickedFileName != nil {
                                Image(systemName: "checkmark.circle.fill").foregroundColor(.cfAttendance)
                            }
                        }
                    }
                    if let errorMessage {
                        Text(errorMessage).font(.cfCaption2).foregroundColor(.cfHealth)
                    }
                }

                Section {
                    CFPrimaryButton("Upload Document") {
                        guard let data = pickedData, let fileName = pickedFileName else { return }
                        onUpload(name.isEmpty ? fileName : name, selectedType, data, fileName, pickedMimeType)
                        dismiss()
                    }
                    .disabled(name.isEmpty || pickedData == nil)
                }
            }
            .navigationTitle("Upload Document")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .fileImporter(isPresented: $isPickingFile, allowedContentTypes: [.pdf, .image, .plainText, .data], allowsMultipleSelection: false) { result in
                switch result {
                case .success(let urls):
                    guard let url = urls.first else { return }
                    loadFile(at: url)
                case .failure(let error):
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func loadFile(at url: URL) {
        // Files from the picker can be security-scoped (e.g. iCloud Drive) —
        // must call startAccessingSecurityScopedResource before reading.
        let didStartAccessing = url.startAccessingSecurityScopedResource()
        defer { if didStartAccessing { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            guard data.count <= 20 * 1024 * 1024 else {
                errorMessage = "File is too large (max 20MB)."
                return
            }
            pickedData = data
            pickedFileName = url.lastPathComponent
            pickedMimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
            if name.isEmpty { name = url.deletingPathExtension().lastPathComponent }
            errorMessage = nil
        } catch {
            errorMessage = "Couldn't read that file."
        }
    }
}

// MARK: - Assign-to-Child Sheet

struct ChildAssignSheet: View {
    let onSelect: (Child) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var children: [Child] = []
    @State private var searchText = ""
    @State private var isLoading = true

    private var filtered: [Child] {
        guard !searchText.isEmpty else { return children }
        return children.filter { "\($0.firstName) \($0.lastName)".localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if filtered.isEmpty {
                    CFEmptyState(icon: "person.fill.questionmark", title: "No Children Found", message: "Try a different search.")
                } else {
                    List(filtered) { child in
                        Button {
                            onSelect(child)
                            dismiss()
                        } label: {
                            Text("\(child.firstName) \(child.lastName)")
                                .foregroundColor(.cfTextPrimary)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .searchable(text: $searchText, prompt: "Search children")
            .navigationTitle("File to Child")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task {
                do {
                    children = try await APIClient.shared.getChildren()
                } catch {
                    #if DEBUG
                    children = MockData.children
                    #endif
                }
                isLoading = false
            }
        }
    }
}

// MARK: - Models

struct StaffDocument: Identifiable {
    let id: String
    let name: String
    let type: DocumentType
    let uploadedAt: Date
    var assignedChildId: String?
    var assignedChildName: String?

    init(id: String, name: String, type: DocumentType, uploadedAt: Date, assignedChildId: String?, assignedChildName: String?) {
        self.id = id
        self.name = name
        self.type = type
        self.uploadedAt = uploadedAt
        self.assignedChildId = assignedChildId
        self.assignedChildName = assignedChildName
    }

    /// Maps the server's StaffDocumentDTO (raw `documentType` enum string) to this display model.
    init(dto: StaffDocumentDTO) {
        id = dto.id
        name = dto.name
        type = DocumentType(apiValue: dto.documentType)
        uploadedAt = dto.uploadedAt
        assignedChildId = dto.assignedChildId
        assignedChildName = dto.assignedChildName
    }

    var uploadedLabel: String {
        uploadedAt.formatted(.relative(presentation: .named))
    }

    var typeIcon: String { type.icon }
    var typeColor: Color { type.color }

    enum DocumentType: String, CaseIterable {
        case birthCertificate = "Birth Certificate"
        case immunization     = "Immunization Record"
        case iep               = "IEP / IFSP"
        case consent           = "Consent Form"
        case medical            = "Medical Record"
        case assessment         = "Assessment"
        case enrollment         = "Enrollment Docs"
        case general            = "General"

        /// This case's raw value in the server's `documents.documentType` enum.
        var apiValue: String {
            switch self {
            case .birthCertificate: return "birth_certificate"
            case .immunization:     return "immunization_record"
            case .iep:               return "iep"
            case .consent:           return "consent_form"
            case .medical:            return "medical_record"
            case .assessment:         return "assessment"
            case .enrollment:         return "enrollment"
            case .general:            return "other"
            }
        }

        init(apiValue: String) {
            switch apiValue {
            case "birth_certificate":   self = .birthCertificate
            case "immunization_record": self = .immunization
            case "iep":                  self = .iep
            case "consent_form":         self = .consent
            case "medical_record":       self = .medical
            case "assessment":           self = .assessment
            case "enrollment":           self = .enrollment
            default:                     self = .general // "other" and anything unrecognized
            }
        }

        var icon: String {
            switch self {
            case .birthCertificate: return "doc.badge.gearshape"
            case .immunization: return "syringe.fill"
            case .iep:          return "doc.text.fill"
            case .consent:      return "signature"
            case .medical:      return "cross.case.fill"
            case .assessment:   return "chart.bar.doc.horizontal"
            case .enrollment:   return "doc.badge.plus"
            case .general:      return "doc.fill"
            }
        }
        var color: Color {
            switch self {
            case .birthCertificate: return .cfCompliance
            case .immunization: return .cfHealth
            case .iep:          return .cfFamily
            case .consent:      return .cfGoals
            case .medical:      return .cfHealth
            case .assessment:   return .cfChildren
            case .enrollment:   return .cfChildren
            case .general:      return .cfPrimary
            }
        }
    }
}

struct DocumentSection {
    let title: String
    let documents: [StaffDocument]
}

// MARK: - ViewModel

@MainActor
class DocumentsViewModel: ObservableObject {
    @Published var documents: [StaffDocument] = []
    @Published var showUpload = false
    @Published var assignTarget: StaffDocument?
    @Published var isLoading = false
    @Published var errorMessage: String?

    var sections: [DocumentSection] {
        let unassigned = documents.filter { $0.assignedChildName == nil }
        let assigned   = documents.filter { $0.assignedChildName != nil }
        var result: [DocumentSection] = []
        if !unassigned.isEmpty { result.append(DocumentSection(title: "Pending Assignment", documents: unassigned)) }
        if !assigned.isEmpty   { result.append(DocumentSection(title: "Filed to Profiles",  documents: assigned)) }
        return result
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            documents = try await APIClient.shared.getDocuments().map(StaffDocument.init(dto:))
        } catch {
            // Server unreachable / decode failure — demo mode only.
            #if DEBUG
            documents = [
                StaffDocument(id: "d1", name: "Sofia Martinez — Immunization 2026", type: .immunization,
                              uploadedAt: Date().addingTimeInterval(-3600 * 2),
                              assignedChildId: nil, assignedChildName: nil),
                StaffDocument(id: "d2", name: "Aaliyah Johnson — IEP Draft",         type: .iep,
                              uploadedAt: Date().addingTimeInterval(-86400),
                              assignedChildId: nil, assignedChildName: nil),
                StaffDocument(id: "d3", name: "Marcus Williams — Consent Form",       type: .consent,
                              uploadedAt: Date().addingTimeInterval(-86400 * 3),
                              assignedChildId: "c4", assignedChildName: "Marcus Williams"),
                StaffDocument(id: "d4", name: "Garcia Family — Enrollment Packet",    type: .enrollment,
                              uploadedAt: Date().addingTimeInterval(-86400 * 5),
                              assignedChildId: "c1", assignedChildName: "Sofia Martinez"),
            ]
            #endif
        }
    }

    func upload(name: String, type: StaffDocument.DocumentType, fileData: Data, fileName: String, mimeType: String?) async {
        do {
            let base64 = fileData.base64EncodedString()
            let dto = try await APIClient.shared.uploadDocument(name: name, documentType: type.apiValue, fileBase64: base64, mimeType: mimeType, childId: nil)
            documents.insert(StaffDocument(dto: dto), at: 0)
        } catch {
            errorMessage = "Couldn't upload that document. Check your connection and try again."
        }
    }

    func assign(_ doc: StaffDocument, toChildId childId: String, childName: String) async {
        do {
            try await APIClient.shared.assignDocument(id: doc.id, childId: childId)
            if let i = documents.firstIndex(where: { $0.id == doc.id }) {
                documents[i].assignedChildId = childId
                documents[i].assignedChildName = childName
            }
        } catch {
            errorMessage = "Couldn't file that document to a child."
        }
    }
}
