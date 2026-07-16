import SwiftUI

// MARK: - Program Story View (staff-facing)
//
// Backed by GET/POST /api/story/posts, POST /api/story/posts/:id/like, and
// GET/POST /api/story/posts/:id/comments (see
// ios/Sources/Networking/StoryAPI.swift for the networking layer). Tapping
// "Comment" opens a full thread view (CommentThreadSheet) that fetches the
// real comment list and lets staff post a new one, which is appended
// locally from the POST response without a refetch.
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
                                    onLoadComments: { await viewModel.fetchComments(for: post) },
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
                ComposeStoryPostSheet(children: viewModel.children) { caption, audience, taggedChildren in
                    await viewModel.createPost(caption: caption, audience: audience, taggedChildren: taggedChildren)
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
    let onLoadComments: () async -> [StoryComment]
    let onComment: (String) async -> StoryComment?

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
            CommentThreadSheet(onLoadComments: onLoadComments, onSubmit: onComment)
        }
    }
}

// MARK: - Comment Thread Sheet
//
// Fetches the real comment thread via GET /api/story/posts/:id/comments
// (oldest-first) and lets staff post a new comment; the newly created
// comment is appended locally from the POST response so the thread updates
// immediately without a full refetch.

struct CommentThreadSheet: View {
    let onLoadComments: () async -> [StoryComment]
    let onSubmit: (String) async -> StoryComment?
    @Environment(\.dismiss) private var dismiss

    @State private var comments: [StoryComment] = []
    @State private var isLoading = true
    @State private var newText = ""
    @State private var isSaving = false

    private var trimmed: String { newText.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Group {
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if comments.isEmpty {
                        CFEmptyState(
                            icon: "bubble.left",
                            title: "No Comments Yet",
                            message: "Be the first to leave a comment on this update."
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        ScrollView {
                            LazyVStack(alignment: .leading, spacing: 14) {
                                ForEach(comments) { comment in
                                    CommentRow(comment: comment)
                                }
                            }
                            .padding(16)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                Divider()

                HStack(alignment: .bottom, spacing: 10) {
                    TextField("Add a comment…", text: $newText, axis: .vertical)
                        .font(.cfBody)
                        .lineLimit(1...4)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.cfBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 10))

                    Button(action: submit) {
                        if isSaving {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 28))
                                .foregroundColor(trimmed.isEmpty ? .cfTextSecondary.opacity(0.4) : .cfPrimary)
                        }
                    }
                    .disabled(trimmed.isEmpty || isSaving)
                }
                .padding(12)
            }
            .background(Color.cfSurface.ignoresSafeArea(edges: .bottom))
            .navigationTitle("Comments")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await loadComments() }
        }
    }

    private func loadComments() async {
        isLoading = true
        comments = await onLoadComments()
        isLoading = false
    }

    private func submit() {
        let text = trimmed
        guard !text.isEmpty else { return }
        isSaving = true
        Task {
            if let comment = await onSubmit(text) {
                comments.append(comment)
                newText = ""
            }
            isSaving = false
        }
    }
}

struct CommentRow: View {
    let comment: StoryComment

    private var postedLabel: String {
        let diff = Date().timeIntervalSince(comment.postedAt)
        if diff < 60 { return "Just now" }
        if diff < 3600 { return "\(Int(diff / 60))m ago" }
        if diff < 86400 { return "\(Int(diff / 3600))h ago" }
        return comment.postedAt.formatted(.dateTime.month(.abbreviated).day())
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(comment.authorName)
                    .font(.cfSubheadline.bold())
                    .foregroundColor(.cfTextPrimary)
                Spacer()
                Text(postedLabel)
                    .font(.cfCaption2)
                    .foregroundColor(.cfTextSecondary)
            }
            Text(comment.content)
                .font(.cfBody)
                .foregroundColor(.cfTextPrimary)
        }
    }
}

// MARK: - Compose Sheet

struct ComposeStoryPostSheet: View {
    /// Children available to tag, loaded by the view model via
    /// `APIClient.shared.getChildren()` (same source used to resolve tag
    /// names on existing posts).
    let children: [Child]
    /// Returns `true` on success; the sheet stays open and shows an error on failure.
    let onPost: (String, StoryPost.Audience, [Int]) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var caption = ""
    @State private var audience: StoryPost.Audience = .allFamilies
    @State private var taggedChildIds: Set<Int> = []
    @State private var isPosting = false
    @State private var errorMessage: String?

    var canPost: Bool { !caption.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    private var sortedChildren: [(id: Int, name: String)] {
        children.compactMap { child -> (id: Int, name: String)? in
            guard let id = Int(child.id) else { return nil }
            return (id, child.fullName)
        }
        .sorted { $0.name < $1.name }
    }

    private var taggedChildrenSummary: String {
        if taggedChildIds.isEmpty { return "None" }
        let names = sortedChildren.filter { taggedChildIds.contains($0.id) }.map(\.name)
        if names.count <= 2 { return names.joined(separator: ", ") }
        return "\(names[0]), \(names[1]) +\(names.count - 2)"
    }

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

                if !sortedChildren.isEmpty {
                    Section("Tag Children") {
                        Menu {
                            ForEach(sortedChildren, id: \.id) { child in
                                Button {
                                    toggleTag(child.id)
                                } label: {
                                    if taggedChildIds.contains(child.id) {
                                        Label(child.name, systemImage: "checkmark")
                                    } else {
                                        Text(child.name)
                                    }
                                }
                            }
                        } label: {
                            HStack {
                                Text("Tagged Children")
                                    .foregroundColor(.cfTextPrimary)
                                Spacer()
                                Text(taggedChildrenSummary)
                                    .foregroundColor(.cfTextSecondary)
                            }
                        }

                        if !taggedChildIds.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(sortedChildren.filter { taggedChildIds.contains($0.id) }, id: \.id) { child in
                                        HStack(spacing: 4) {
                                            Text(child.name)
                                                .font(.cfCaption2)
                                            Image(systemName: "xmark.circle.fill")
                                                .font(.system(size: 11))
                                        }
                                        .foregroundColor(.cfChildren)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.cfChildrenBg)
                                        .clipShape(Capsule())
                                        .onTapGesture { toggleTag(child.id) }
                                    }
                                }
                            }
                        }
                    }
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

    private func toggleTag(_ childId: Int) {
        if taggedChildIds.contains(childId) {
            taggedChildIds.remove(childId)
        } else {
            taggedChildIds.insert(childId)
        }
    }

    private func post() {
        isPosting = true
        errorMessage = nil
        Task {
            let success = await onPost(caption, audience, Array(taggedChildIds))
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
    /// Real children, loaded via `APIClient.shared.getChildren()`. Used both
    /// to resolve tag names on existing posts (`childName(for:)`) and to
    /// power the tagged-children picker in `ComposeStoryPostSheet`.
    @Published private(set) var children: [Child] = []
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
            let (fetchedPosts, fetchedChildren) = try await (postsTask, childrenTask)
            posts = fetchedPosts.sorted { $0.postedAt > $1.postedAt }
            children = fetchedChildren
            childNamesById = Dictionary(uniqueKeysWithValues: fetchedChildren.compactMap { child -> (Int, String)? in
                guard let id = Int(child.id) else { return nil }
                return (id, child.fullName)
            })
            errorMessage = nil
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load the program story. Check your connection and try again."
        }
    }

    @discardableResult
    func createPost(caption: String, audience: StoryPost.Audience, taggedChildren: [Int]) async -> Bool {
        do {
            _ = try await APIClient.shared.createStoryPost(
                caption: caption,
                audience: audience.rawValue,
                taggedChildren: taggedChildren.isEmpty ? nil : taggedChildren
            )
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

    /// Fetches the full comment thread for a post (oldest-first), used by
    /// `CommentThreadSheet` to show real comment bodies rather than just a count.
    func fetchComments(for post: StoryPost) async -> [StoryComment] {
        do {
            return try await APIClient.shared.getStoryPostComments(postId: post.id)
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't load comments. Check your connection and try again."
            return []
        }
    }

    /// Posts a real comment, bumps the visible count, and returns the full
    /// created comment (as echoed back by the server) so callers can append
    /// it to a local thread list immediately without a refetch.
    @discardableResult
    func addComment(to post: StoryPost, content: String) async -> StoryComment? {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        do {
            let comment = try await APIClient.shared.addStoryPostComment(postId: post.id, content: trimmed)
            if let idx = posts.firstIndex(where: { $0.id == post.id }) {
                posts[idx].commentCount += 1
            }
            return comment
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? "Couldn't post that comment. Check your connection and try again."
            return nil
        }
    }
}
