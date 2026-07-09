import SwiftUI
import WebKit

// MARK: - Digital Documents (E-Sign)
// iOS mirror of the web's E-Signatures page, backed by /api/digital-documents.
// Field staff review a document (IEP, consent, waiver, …) and capture a
// typed-name signature on the spot.

// MARK: - ViewModel

@MainActor
final class DigitalDocumentsViewModel: ObservableObject {
    @Published var documents: [DigitalDocumentItem] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            documents = try await APIClient.shared.getDigitalDocuments()
        } catch {
            #if DEBUG
            documents = MockData.digitalDocuments
            #endif
        }
    }

    /// Optimistic local update after a successful sign call.
    func markSigned(id: String, by name: String) {
        guard let i = documents.firstIndex(where: { $0.id == id }) else { return }
        documents[i].status = "signed"
        documents[i].signedBy = name
    }
}

// MARK: - List

struct DigitalDocumentsView: View {
    @StateObject private var viewModel = DigitalDocumentsViewModel()

    private var pending: [DigitalDocumentItem] { viewModel.documents.filter { $0.status == "pending" } }
    private var signed: [DigitalDocumentItem] { viewModel.documents.filter { $0.status == "signed" } }
    private var expired: [DigitalDocumentItem] { viewModel.documents.filter { $0.status == "expired" } }

    var body: some View {
        List {
            if viewModel.isLoading && viewModel.documents.isEmpty {
                HStack { Spacer(); ProgressView(); Spacer() }
                    .listRowBackground(Color.clear)
            } else if viewModel.documents.isEmpty {
                Text("No documents awaiting signatures.")
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 32)
                    .listRowBackground(Color.clear)
            } else {
                if !pending.isEmpty {
                    Section {
                        ForEach(pending) { doc in
                            NavigationLink(destination: DocumentSignView(document: doc, viewModel: viewModel)) {
                                DigitalDocumentRow(document: doc)
                            }
                        }
                    } header: {
                        Label("Awaiting Signature", systemImage: "signature")
                            .foregroundColor(.cfAccent)
                    }
                }
                if !signed.isEmpty {
                    Section("Signed") {
                        ForEach(signed) { doc in
                            NavigationLink(destination: DocumentSignView(document: doc, viewModel: viewModel)) {
                                DigitalDocumentRow(document: doc)
                            }
                        }
                    }
                }
                if !expired.isEmpty {
                    Section("Expired") {
                        ForEach(expired) { doc in
                            DigitalDocumentRow(document: doc)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .background(Color.cfBackground)
        .navigationTitle("E-Signatures")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
    }
}

struct DigitalDocumentRow: View {
    let document: DigitalDocumentItem

    private var statusColor: Color {
        switch document.status {
        case "signed":  return .cfAttendance
        case "expired": return .cfHealth
        default:        return .cfAccent
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: document.status == "signed" ? "checkmark.seal.fill" : "signature")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(statusColor)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(digitalDocumentTypeLabel(document.documentType))
                    .font(.cfSubheadline)
                    .foregroundColor(.cfTextPrimary)
                Text(document.familyName)
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
            }
            Spacer()
            if let signedBy = document.signedBy, document.status == "signed" {
                Text(signedBy)
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Detail + Sign

struct DocumentSignView: View {
    let document: DigitalDocumentItem
    @ObservedObject var viewModel: DigitalDocumentsViewModel

    @State private var signerName = ""
    @State private var isSigning = false
    @State private var justSignedBy: String?
    @State private var errorMessage: String?
    @State private var showConfirm = false

    private var effectiveSignedBy: String? { justSignedBy ?? (document.status == "signed" ? document.signedBy : nil) }
    private var isSigned: Bool { effectiveSignedBy != nil }

    var body: some View {
        VStack(spacing: 0) {
            if let url = URL(string: document.documentUrl) {
                DocumentWebView(url: url)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Text("This document couldn't be loaded.")
                    .font(.cfCaption)
                    .foregroundColor(.cfTextSecondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            // Signature bar
            VStack(alignment: .leading, spacing: 10) {
                if isSigned {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundColor(.cfAttendance)
                        Text("Signed by \(effectiveSignedBy ?? "")")
                            .font(.cfSubheadline.bold())
                            .foregroundColor(.cfTextPrimary)
                    }
                } else {
                    Text("Sign this \(digitalDocumentTypeLabel(document.documentType)) — \(document.familyName)")
                        .font(.cfCaption.bold())
                        .foregroundColor(.cfTextPrimary)
                    TextField("Type your full legal name", text: $signerName)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.cfCaption2)
                            .foregroundColor(.cfHealth)
                    }
                    Button {
                        showConfirm = true
                    } label: {
                        HStack {
                            if isSigning { ProgressView().tint(.white) } else { Image(systemName: "signature") }
                            Text("Sign Document")
                        }
                        .font(.cfSubheadline.bold())
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(signerName.trimmingCharacters(in: .whitespaces).isEmpty ? Color.cfTextSecondary.opacity(0.3) : Color.cfPrimary)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(signerName.trimmingCharacters(in: .whitespaces).isEmpty || isSigning)
                    Text("Typing your name constitutes a legal electronic signature.")
                        .font(.cfCaption2)
                        .foregroundColor(.cfTextSecondary)
                }
            }
            .padding(16)
            .background(Color.cfSurface)
        }
        .navigationTitle(digitalDocumentTypeLabel(document.documentType))
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            "Sign as \"\(signerName.trimmingCharacters(in: .whitespaces))\"? This can't be undone.",
            isPresented: $showConfirm,
            titleVisibility: .visible
        ) {
            Button("Sign Document") { Task { await sign() } }
            Button("Cancel", role: .cancel) {}
        }
    }

    private func sign() async {
        let name = signerName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        isSigning = true
        defer { isSigning = false }
        do {
            try await APIClient.shared.signDigitalDocument(id: document.id, signedBy: name)
            justSignedBy = name
            viewModel.markSigned(id: document.id, by: name)
        } catch {
            #if DEBUG
            // Demo mode: no server — record the signature locally so the flow is testable.
            justSignedBy = name
            viewModel.markSigned(id: document.id, by: name)
            #else
            errorMessage = "Couldn't save the signature. Check your connection and try again."
            #endif
        }
    }
}

// MARK: - Web View

private struct DocumentWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.allowsBackForwardNavigationGestures = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if webView.url != url {
            webView.load(URLRequest(url: url))
        }
    }
}

// MARK: - Launch View
// Resolves a family's pending document and lands straight on the sign screen,
// so "Sign Sofia Johnson's IEP" opens the Johnson IEP — not a documents list.
// Falls back to the full E-Signatures list if nothing matches.

struct DocumentSignLaunchView: View {
    let familyName: String
    var documentType: String? = nil

    @StateObject private var viewModel = DigitalDocumentsViewModel()
    @State private var isLoading = true

    private var match: DigitalDocumentItem? {
        viewModel.documents.first {
            $0.status == "pending"
                && $0.familyName.localizedCaseInsensitiveContains(familyName)
                && (documentType == nil || $0.documentType == documentType)
        }
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let doc = match {
                DocumentSignView(document: doc, viewModel: viewModel)
            } else {
                DigitalDocumentsView()
            }
        }
        .task {
            await viewModel.load()
            isLoading = false
        }
    }
}
