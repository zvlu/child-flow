import SwiftUI

// MARK: - Program Story View (staff-facing)
//
// Backed by GET/POST /api/story/posts, POST /api/story/posts/:id/like, and
// POST /api/story/posts/:id/comments (see ios/Sources/Networking/StoryAPI.swift
// for the networking layer). There is no GET-comments-list endpoint yet, so
// "Comment" posts a real comment and bumps the visible count rather than
// opening a full thread view — see the note on ProgramStoryViewModel.addComment.
//
// The server does not implement real photo upload (no field populates
// `photoUrl` today), so this view never fakes a photo-picking experience:
// the compose sheet has no "Add Photo" control, and the feed only shows a
// generic placeholder icon on posts that do carry a `photoUrl`.

struct ProgramStoryView: View {
    @StateObject private var viewModel = ProgramStoryViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.posts.isEmpty && !viewModel.isLoading {
                    CFEmptyState(
                        icon: "photo.on.rectangle.angled",
                        title: "No Updates Yet",
                        message: "Post a photo or update so families can see what's happening in the program.",
                        buttonLabel: "Post Update",
                        buttonAction: { viewModel.showCompose = true }
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            if let errorMessage = viewModel.errorMessage {
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .foregroundColor(.cfError)
                                    Text(errorMessage)
                                        .font(.cfSubheadline)
                                        .foregroundColor(.cfTextPrimary)
                                }
                                .padding(12)
                                .background(Color.cfHealthBg)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }

                            ForEach(viewModel.posts) { post in
                                StoryPostCard(
                                    post: post,
                                    childName: viewModel.childName(for:),
                                    onLike: { viewModel.toggleLike(post) },
                                    onComment: { text in await viewModel.addComment(to: post, content: text) }
                                )
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 32)
                    }
                }
            }
            .navigationTitle("Program Story")
            .navigationBarTitleDisplayMode(.large)
            .background(Color.cfBackground.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        viewModel.showCompose = true
                    } label: {
                        Label("Post", systemImage: "plus")
                            .fontWeight(.semibold)
                    }
                }
            }
            .sheet(isPresented: $viewModel.showCompose) {
                ComposeStoryPostSheet { caption, audience in
                    await viewModel.createPost(caption: caption, audience: audience)
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
            .overlay {
                if viewModel.isLoading && viewModel.posts.isEmpty {
                    ProgressView()
                }
            }
        }
    }
}

// MARK: - Story Post Card

struct StoryPostCard: View {
    let post: StoryPost
    let childName: (Int) -> String
    let onLike: () -> Void
    let onComment: (String) async -> Void

    @State private var showCommentSheet = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Author row
            HStack(spacing: 10) {
                Circle()
                    .fill(Color.cfPrimary.opacity(0.15))
                    .frame(width: 38, height: 38)
                    .overlay {
                        Text(post.authorInitials)
                            .font(.cfCaption2.bold())
                            .foregroundColor(.cfPrimary)
                    }
                VStack(alignment: .leading, spacing: 2) {
                    Text(post.authorName)
                        .font(.cfSubheadline.bold())
                        .foregroundColor(.cfTextPrimary)
                    HStack(spacing: 6) {
                        Text(post.audience.label)
                            .font(.cfCaption2)
                            .foregroundColor(.white)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(post.audience.color)
                            .clipShape(Capsule())
                        Text(post.postedLabel)
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    }
                }
                Spacer()
                Image(systemName: "ellipsis")
                    .foregroundColor(.cfTextSecondary)
                    .font(.system(size: 15))
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 12)

            // Photo placeholder — the server doesn't implement real photo
            // upload yet, so this is a generic "there's a photo" indicator,
            // not an attempt to render (or fake) the actual image.
            if post.photoUrl != nil {
                ZStack {
                    Rectangle()
                        .fill(Color.cfPrimary.opacity(0.12))
                        .frame(maxWidth: .infinity)
                        .frame(height: 220)
                    VStack(spacing: 8) {
                        Image(systemName: "photo.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.cfPrimary.opacity(0.6))
                        Text("Photo attached")
                            .font(.cfCaption)
                            .foregroundColor(.cfPrimary.opacity(0.8))
                    }
                }
            }

            // Caption
            if !post.caption.isEmpty {
                Text(post.caption)
                    .font(.cfBody)
                    .foregroundColor(.cfTextPrimary)
                    .padding(.horizontal, 16)
                    .padding(.top, post.photoUrl != nil ? 12 : 0)
                    .padding(.bottom, 4)
            }

            // Tagged children
            if !post.taggedChildren.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(post.taggedChildren, id: \.self) { childId in
                            HStack(spacing: 4) {
                                Image(systemName: "person.fill")
                                    .font(.system(size: 10))
                                Text(childName(childId))
                                    .font(.cfCaption2)
                            }
                            .foregroundColor(.cfChildren)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.cfChildrenBg)
                            .clipShape(Capsule())
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .padding(.vertical, 6)
            }

            Divider()
                .padding(.horizontal, 16)
                .padding(.top, 10)

            // Action row
            HStack(spacing: 0) {
                Button(action: onLike) {
                    HStack(spacing: 6) {
                        Image(systemName: post.likedByMe ? "heart.fill" : "heart")
                            .foregroundColor(post.likedByMe ? .cfHealth : .cfTextSecondary)
                        Text(post.likeCount > 0 ? "\(post.likeCount)" : "Like")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }

                Button {
                    showCommentSheet = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "bubble.left")
                            .foregroundColor(.cfTextSecondary)
                        Text(post.commentCount > 0 ? "\(post.commentCount)" : "Comment")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }

                ShareLink(item: post.caption.isEmpty ? "Check out this update from \(post.authorName)." : post.caption) {
                    HStack(spacing: 6) {
                        Image(systemName: "paperplane")
                            .foregroundColor(.cfTextSecondary)
                        Text("Share")
                            .font(.cfCaption)
                            .foregroundColor(.cfTextSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }
            }
            .padding(.horizontal, 4)
        }
        .background(Color.cfSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .cfCardShadow()
        .sheet(isPresented: $showCommentSheet) {
            AddCommentSheet { text in
                await onComment(text)
            }
        }
    }
}

// MARK: - Add Comment Sheet
//
// The server has no GET-comments-list endpoint (POST /api/story/posts/:id/comments
// only increments the post's commentCount), so this is intentionally a
// one-shot "post a comment" flow rather than a full comment thread view.

struct AddCommentSheet: View {
    let onSubmit: (String) async -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var isSaving = false

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Comment") {
                    TextEditor(text: $text)
                        .font(.cfBody)
                        .frame(minHeight: 100)
                }
            }
            .navigationTitle("Add Comment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        isSaving = true
                        Task {
                            await onSubmit(trimmed)
                            isSaving = false
                            dismiss()
                        }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Post")
                        }
                    }
                    .disabled(trimmed.isEmpty || isSaving)
                }
            }
        }
    }
}

// MARK: - Compose Sheet

struct ComposeStoryPostSheet: View {
    /// Returns `true` on success; the sheet stays open and shows an error on failure.
    let onPost: (String, StoryPost.Audience) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var caption = ""
    @State private var audience: StoryPost.Audience = .allFamilies
    @State private var isPosting = false
    @State private var errorMessage: String?

    var canPost: Bool { !caption.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                if let errorMessage {
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
                    ZStack(alignment: .topLeading) {
                        if caption.isEmpty {
                            Text("What's happening in your program today?")
                                .foregroundColor(Color(.placeholderText))
                                .font(.cfBody)
                                .padding(.top, 8)
                                .padding(.leading, 4)
                        }
                        TextEditor(text: $caption)
                            .font(.cfBody)
                            .frame(minHeight: 120)
                    }
                }

                Section("Visible To") {
                    Picker("Audience", selection: $audience) {
                        ForEach(StoryPost.Audience.allCases, id: \.self) { aud in
                            Label(aud.label, systemImage: aud.icon).tag(aud)
                        }
                    }
                    .pickerStyle(.navigationLink)
                }

                Section {
                    Button(action: post) {
                        HStack {
                            Spacer()
                            if isPosting {
                                ProgressView().tint(.white)
                            } else {
                                Text("Post Update")
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 4)
                        .background(canPost ? Color.cfPrimary : Color.cfPrimary.opacity(0.4))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(!canPost || isPosting)
                    .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                    .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("New Post")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func post() {
        isPosting = true
        errorMessage = nil
        Task {
            let success = await onPost(caption, audience)
            isPosting = false
            if success {
                dismiss()
            } else {
                errorMessage = "Couldn't post that update. Check your connection and try again."
            }
        }
    }
}

// MARK: - Models

struct StoryPost: Identifiable, Decodable {
    let id: Int
    let authorName: String
    let authorRole: String
    var caption: String
    /// Nil until the server implements real photo upload — currently
    /// nothing populates this. When present, the feed shows a generic
    /// placeholder rather than fetching/rendering an actual image.
    var photoUrl: String?
    var audience: Audience
    /// Child ids (not names) tagged on the post; resolved to display names
    /// via ProgramStoryViewModel.childName(for:).
    var taggedChildren: [Int]
    let postedAt: Date
    var likeCount: Int
    var commentCount: Int
    var likedByMe: Bool

    var authorInitials: String {
        authorName.split(separator: " ")
            .prefix(2)
            .compactMap { $0.first }
            .map(String.init)
            .joined()
    }

    var postedLabel: String {
        let diff = Date().timeIntervalSince(postedAt)
        if diff < 3600 { return "\(Int(diff / 60))m ago" }
        if diff < 86400 { return "\(Int(diff / 3600))h ago" }
        return postedAt.formatted(.dateTime.month(.abbreviated).day())
    }

    enum Audience: String, CaseIterable, Codable {
        case allFamilies   = "All Families"
        case myFamilies    = "My Caseload Families"
        case staffOnly     = "Staff Only"

        var label: String { rawValue }

        var icon: String {
            switch self {
            case .allFamilies:  return "person.3.fill"
            case .myFamilies:   return "person.2.fill"
            case .staffOnly:    return "person.badge.key.fill"
            }
        }

        var color: Color {
            switch self {
            case .allFamilies:  return .cfPrimary
            case .myFamilies:   return .cfChildren
            case .staffOnly:    return .cfCompliance
            }
        }
    }
}

// MARK: - ViewModel

@MainActor
final class ProgramStoryViewModel: ObservableObject {
    @Published var posts: [StoryPost] = []
    @Published var isLoading = false
    @Published var showCompose = false
    @Published var errorMessage: String?
    @Published private var childNamesById: [Int: String] = [:]

    func childName(for id: Int) -> String {
        childNamesById[id] ?? "Child #\(id)"
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let postsTask = APIClient.shared.getStoryPosts()
            async let childrenTask = APIClient.shared.getChildren()
            let (fetchedPosts, children) = try await (postsTask, childrenTask)
            posts = fetchedPosts.sorted { $0.postedAt > $1.postedAt }
            childNamesById = Dictionary(uniqueKeysWithValues: children.compactMap { child -> (Int, String)? in
                guard let id = Int(child.id) else { return nil }
                return (id, child.fullName)
            })
            errorMessage = nil
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load the program story. Check your connection and try again."
        }
    }

    @discardableResult
    func createPost(caption: String, audience: StoryPost.Audience) async -> Bool {
        do {
            _ = try await APIClient.shared.createStoryPost(caption: caption, audience: audience.rawValue, taggedChildren: nil)
            await load()
            return true
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't post that update. Check your connection and try again."
            return false
        }
    }

    /// Optimistic like toggle: flips immediately, then reconciles with the
    /// server's definitive `liked` state (correcting the optimistic guess
    /// if it was wrong, or reverting entirely if the request fails).
    func toggleLike(_ post: StoryPost) {
        guard let i = posts.firstIndex(where: { $0.id == post.id }) else { return }
        applyLikeToggle(at: i)

        Task {
            do {
                let liked = try await APIClient.shared.toggleStoryPostLike(postId: post.id)
                if let idx = posts.firstIndex(where: { $0.id == post.id }), posts[idx].likedByMe != liked {
                    applyLikeToggle(at: idx)
                }
            } catch {
                if let idx = posts.firstIndex(where: { $0.id == post.id }) {
                    applyLikeToggle(at: idx)
                }
                errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't update your like. Check your connection and try again."
            }
        }
    }

    private func applyLikeToggle(at index: Int) {
        posts[index].likedByMe.toggle()
        posts[index].likeCount += posts[index].likedByMe ? 1 : -1
    }

    /// Posts a real comment and bumps the visible count. There's no
    /// GET-comments-list endpoint yet, so individual comment bodies aren't
    /// fetched back — this can't build a full comment thread view, only
    /// record that a comment was made.
    func addComment(to post: StoryPost, content: String) async {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            _ = try await APIClient.shared.addStoryPostComment(postId: post.id, content: trimmed)
            if let idx = posts.firstIndex(where: { $0.id == post.id }) {
                posts[idx].commentCount += 1
            }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't post that comment. Check your connection and try again."
        }
    }
}
