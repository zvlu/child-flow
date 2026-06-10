import SwiftUI

struct DocumentsView: View {
    @StateObject private var viewModel = DocumentsViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.documents.isEmpty {
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
                                        viewModel.assign(doc)
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
                UploadDocumentSheet { doc in
                    viewModel.add(doc)
                }
            }
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
    let onUpload: (StaffDocument) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var selectedType: StaffDocument.DocumentType = .general

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
                    // In production this would open the Files picker.
                    // For now it creates a placeholder document.
                    Button("Choose File…") {}
                        .foregroundColor(.cfPrimary)
                }

                Section {
                    CFPrimaryButton("Upload Document") {
                        let doc = StaffDocument(
                            id: UUID().uuidString,
                            name: name.isEmpty ? "Document" : name,
                            type: selectedType,
                            uploadedAt: Date(),
                            assignedChildId: nil,
                            assignedChildName: nil
                        )
                        onUpload(doc)
                        dismiss()
                    }
                    .disabled(name.isEmpty)
                }
            }
            .navigationTitle("Upload Document")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
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

    var uploadedLabel: String {
        uploadedAt.formatted(.relative(presentation: .named))
    }

    var typeIcon: String { type.icon }
    var typeColor: Color { type.color }

    enum DocumentType: String, CaseIterable {
        case immunization  = "Immunization Record"
        case iep           = "IEP / IFSP"
        case consent       = "Consent Form"
        case enrollment    = "Enrollment Docs"
        case general       = "General"

        var icon: String {
            switch self {
            case .immunization: return "syringe.fill"
            case .iep:          return "doc.text.fill"
            case .consent:      return "signature"
            case .enrollment:   return "doc.badge.plus"
            case .general:      return "doc.fill"
            }
        }
        var color: Color {
            switch self {
            case .immunization: return .cfHealth
            case .iep:          return .cfFamily
            case .consent:      return .cfGoals
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

    var sections: [DocumentSection] {
        let unassigned = documents.filter { $0.assignedChildName == nil }
        let assigned   = documents.filter { $0.assignedChildName != nil }
        var result: [DocumentSection] = []
        if !unassigned.isEmpty { result.append(DocumentSection(title: "Pending Assignment", documents: unassigned)) }
        if !assigned.isEmpty   { result.append(DocumentSection(title: "Filed to Profiles",  documents: assigned)) }
        return result
    }

    func load() async {
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
    }

    func add(_ doc: StaffDocument) {
        documents.insert(doc, at: 0)
    }

    func assign(_ doc: StaffDocument) {
        // In production: open child picker sheet
        if let i = documents.firstIndex(where: { $0.id == doc.id }) {
            documents[i].assignedChildName = "Assigned"
        }
    }
}
