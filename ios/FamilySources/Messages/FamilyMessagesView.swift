import SwiftUI

// Family-facing messages — same conversation model, simpler UI

struct FamilyMessagesView: View {
    @StateObject private var viewModel = FamilyMessagesViewModel()
    @ObservedObject private var l10n = FamilyL10n.shared

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.conversations.isEmpty {
                    ProgressView()
                } else if viewModel.conversations.isEmpty {
                    ContentUnavailableView(
                        L(.noMessagesYet),
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text(L(.teachersReachOut))
                    )
                } else {
                    List(viewModel.conversations) { conversation in
                        NavigationLink(destination: FamilyChatView(conversation: conversation)) {
                            FamilyConversationRow(conversation: conversation)
                        }
                        .listRowBackground(
                            conversation.unreadCount > 0
                                ? Color.accentColor.opacity(0.05)
                                : Color.clear
                        )
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle(L(.tabMessages))
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
            .alert("Couldn't Load Messages", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: { Text(viewModel.errorMessage ?? "") }
        }
    }
}

struct FamilyConversationRow: View {
    let conversation: Conversation

    var body: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .topTrailing) {
                Circle()
                    .fill(Color.accentColor.opacity(0.12))
                    .frame(width: 46, height: 46)
                    .overlay {
                        Image(systemName: "person.fill")
                            .foregroundColor(.accentColor)
                    }
                if conversation.unreadCount > 0 {
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 16, height: 16)
                        .overlay {
                            Text("\(conversation.unreadCount)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .offset(x: 3, y: -3)
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(conversation.participantNames.joined(separator: ", "))
                        .font(.subheadline.weight(conversation.unreadCount > 0 ? .semibold : .regular))
                    Spacer()
                    Text(conversation.lastMessageDate, style: .relative)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Text(L(.reFmt, conversation.childName))
                    .font(.caption)
                    .foregroundColor(.accentColor)
                Text(conversation.lastMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Family Chat View

struct FamilyChatView: View {
    let conversation: Conversation
    @StateObject private var viewModel: ConversationViewModel
    @FocusState private var isInputFocused: Bool

    init(conversation: Conversation) {
        self.conversation = conversation
        _viewModel = StateObject(wrappedValue: ConversationViewModel(conversationId: conversation.id))
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(viewModel.messages) { message in
                            FamilyMessageBubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: viewModel.messages.count) { _, _ in
                    if let last = viewModel.messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            Divider()

            HStack(alignment: .bottom, spacing: 10) {
                TextField(L(.messagePlaceholder), text: $viewModel.draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...5)
                    .focused($isInputFocused)

                Button(action: { viewModel.send() }) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(
                            viewModel.draft.trimmingCharacters(in: .whitespaces).isEmpty
                                ? .secondary : .accentColor
                        )
                }
                .disabled(viewModel.draft.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isSending)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
        .navigationTitle(conversation.participantNames.first ?? L(.tabMessages))
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        .alert("Message Error", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") { viewModel.errorMessage = nil }
        } message: { Text(viewModel.errorMessage ?? "") }
    }
}

// Family bubble — flipped perspective (family messages on right, staff on left)
struct FamilyMessageBubble: View {
    let message: Message
    @State private var showOriginal = false

    var isFromFamily: Bool { message.senderRole == .family }
    var isTranslated: Bool { (message.isTranslated ?? false) && message.bodyOriginal != nil }

    var body: some View {
        HStack {
            if isFromFamily { Spacer(minLength: 60) }

            VStack(alignment: isFromFamily ? .trailing : .leading, spacing: 3) {
                if !isFromFamily {
                    Text(message.senderName)
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(.secondary)
                        .padding(.leading, 4)
                }

                Text(showOriginal ? (message.bodyOriginal ?? message.body) : message.body)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isFromFamily ? Color.accentColor : Color(.secondarySystemBackground))
                    .foregroundColor(isFromFamily ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 18))

                HStack(spacing: 6) {
                    Text(message.sentAt, style: .time)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    if isTranslated {
                        Button {
                            withAnimation { showOriginal.toggle() }
                        } label: {
                            Label(showOriginal ? "Translated" : "Original", systemImage: "globe")
                                .font(.caption2)
                                .foregroundColor(.accentColor)
                        }
                    }
                }
                .padding(.horizontal, 4)
            }

            if !isFromFamily { Spacer(minLength: 60) }
        }
    }
}

@MainActor
class FamilyMessagesViewModel: ObservableObject {
    @Published var conversations: [Conversation] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        do {
            conversations = try await APIClient.shared.getConversations()
        } catch {
            // Used to be `catch {}` — a failed load rendered the exact same
            // "No Messages Yet" empty state as a genuinely empty inbox, so a
            // parent with real unread messages had no way to tell the load failed.
            errorMessage = "Couldn't load your messages. Check your connection and try again."
        }
        isLoading = false
    }
}
