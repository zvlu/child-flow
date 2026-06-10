import SwiftUI

// MARK: - Program Story View (staff-facing)

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
                            ForEach(viewModel.posts) { post in
                                StoryPostCard(post: post) {
                                    viewModel.toggleLike(post)
                                }
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
                ComposeStoryPostSheet { post in
                    viewModel.add(post)
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}

// MARK: - Story Post Card

struct StoryPostCard: View {
    let post: StoryPost
    let onLike: () -> Void

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

            // Photo placeholder
            if post.hasPhoto {
                ZStack {
                    Rectangle()
                        .fill(
                            LinearGradient(
                                colors: [post.photoColor.opacity(0.3), post.photoColor.opacity(0.15)],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            )
                        )
                        .frame(maxWidth: .infinity)
                        .frame(height: 220)
                    VStack(spacing: 8) {
                        Image(systemName: post.photoIcon)
                            .font(.system(size: 40))
                            .foregroundColor(post.photoColor.opacity(0.6))
                        Text("Photo · \(post.photoLabel)")
                            .font(.cfCaption)
                            .foregroundColor(post.photoColor.opacity(0.8))
                    }
                }
            }

            // Caption
            if !post.caption.isEmpty {
                Text(post.caption)
                    .font(.cfBody)
                    .foregroundColor(.cfTextPrimary)
                    .padding(.horizontal, 16)
                    .padding(.top, post.hasPhoto ? 12 : 0)
                    .padding(.bottom, 4)
            }

            // Tagged children
            if !post.taggedChildren.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(post.taggedChildren, id: \.self) { name in
                            HStack(spacing: 4) {
                                Image(systemName: "person.fill")
                                    .font(.system(size: 10))
                                Text(name)
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
                    // comment action
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

                Button {
                    // share action
                } label: {
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
    }
}

// MARK: - Compose Sheet

struct ComposeStoryPostSheet: View {
    let onPost: (StoryPost) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var caption = ""
    @State private var audience: StoryPost.Audience = .allFamilies
    @State private var hasPhoto = false
    @State private var isPosting = false

    var canPost: Bool { !caption.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || hasPhoto }

    var body: some View {
        NavigationStack {
            Form {
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

                Section("Add to Post") {
                    Button {
                        hasPhoto.toggle()
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: hasPhoto ? "checkmark.circle.fill" : "photo.badge.plus")
                                .foregroundColor(hasPhoto ? .cfAttendance : .cfPrimary)
                                .font(.system(size: 22))
                            Text("Add Photo")
                                .foregroundColor(.cfTextPrimary)
                            Spacer()
                            if hasPhoto {
                                Text("Added")
                                    .font(.cfCaption)
                                    .foregroundColor(.cfAttendance)
                            }
                        }
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
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let newPost = StoryPost(
                id: UUID().uuidString,
                authorName: "You",
                authorRole: "Staff",
                caption: caption,
                hasPhoto: hasPhoto,
                photoColor: .cfPrimary,
                photoIcon: "photo.fill",
                photoLabel: "Program Activity",
                audience: audience,
                taggedChildren: [],
                postedAt: Date(),
                likeCount: 0,
                commentCount: 0,
                likedByMe: false
            )
            onPost(newPost)
            dismiss()
        }
    }
}

// MARK: - Models

struct StoryPost: Identifiable {
    let id: String
    let authorName: String
    let authorRole: String
    var caption: String
    var hasPhoto: Bool
    var photoColor: Color
    var photoIcon: String
    var photoLabel: String
    var audience: Audience
    var taggedChildren: [String]
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

    enum Audience: String, CaseIterable {
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
class ProgramStoryViewModel: ObservableObject {
    @Published var posts: [StoryPost] = []
    @Published var isLoading = false
    @Published var showCompose = false

    func load() async {
        isLoading = true
        defer { isLoading = false }

        posts = [
            StoryPost(
                id: "p1",
                authorName: "Ms. Rivera",
                authorRole: "Lead Teacher",
                caption: "The children did an amazing job with our garden activity today 🌱 Sofia and Marcus were so excited to plant their seeds! Great sensory learning opportunity.",
                hasPhoto: true,
                photoColor: .cfAttendance,
                photoIcon: "leaf.fill",
                photoLabel: "Garden Activity",
                audience: .allFamilies,
                taggedChildren: ["Sofia Martinez", "Marcus Williams"],
                postedAt: Date().addingTimeInterval(-3600 * 2),
                likeCount: 8,
                commentCount: 3,
                likedByMe: false
            ),
            StoryPost(
                id: "p2",
                authorName: "Ms. Thompson",
                authorRole: "Family Services",
                caption: "Reminder: Monthly parent meeting this Thursday at 6pm. We'll be reviewing the spring family engagement goals and showing developmental updates. Snacks provided! 🍎",
                hasPhoto: false,
                photoColor: .cfGoals,
                photoIcon: "calendar",
                photoLabel: "",
                audience: .allFamilies,
                taggedChildren: [],
                postedAt: Date().addingTimeInterval(-86400),
                likeCount: 12,
                commentCount: 5,
                likedByMe: true
            ),
            StoryPost(
                id: "p3",
                authorName: "Ms. Rivera",
                authorRole: "Lead Teacher",
                caption: "Story time with 'The Very Hungry Caterpillar' — we counted fruits, practiced colors, and talked about how caterpillars grow. Aaliyah couldn't stop laughing at the silly caterpillar 🐛",
                hasPhoto: true,
                photoColor: .cfFamily,
                photoIcon: "book.fill",
                photoLabel: "Story Time",
                audience: .allFamilies,
                taggedChildren: ["Aaliyah Johnson"],
                postedAt: Date().addingTimeInterval(-86400 * 2),
                likeCount: 15,
                commentCount: 7,
                likedByMe: false
            ),
            StoryPost(
                id: "p4",
                authorName: "Admin",
                authorRole: "Program Director",
                caption: "Staff note: PIR documentation deadline is June 20th. Please make sure all attendance and developmental screening records are up to date by EOD June 18th.",
                hasPhoto: false,
                photoColor: .cfCompliance,
                photoIcon: "doc.text.fill",
                photoLabel: "",
                audience: .staffOnly,
                taggedChildren: [],
                postedAt: Date().addingTimeInterval(-86400 * 3),
                likeCount: 2,
                commentCount: 1,
                likedByMe: false
            ),
        ]
    }

    func add(_ post: StoryPost) {
        posts.insert(post, at: 0)
    }

    func toggleLike(_ post: StoryPost) {
        if let i = posts.firstIndex(where: { $0.id == post.id }) {
            posts[i].likedByMe.toggle()
            posts[i].likeCount += posts[i].likedByMe ? 1 : -1
        }
    }
}
