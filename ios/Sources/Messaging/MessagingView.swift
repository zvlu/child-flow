import SwiftUI

// MARK: - Conversations List

struct MessagingView: View {
    @StateObject private var viewModel = MessagingViewModel()
    @State private var showMenu = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.conversations.isEmpty {
                    ProgressView()
                } else if viewModel.conversations.isEmpty {
                    ContentUnavailableView(
                        "No Conversations",
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text("Invite families to start messaging.")
                    )
                } else {
                    List {
                        ForEach(viewModel.filteredConversations) { conversation in
                            NavigationLink(destination: ConversationView(conversation: conversation)) {
                                ConversationRow(conversation: conversation)
                            }
                            .listRowBackground(
                                conversation.unreadCount > 0
                                ? Color.accentColor.opacity(0.05)
                                : Color.clear
                            )
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Messages")
            .searchable(text: $viewModel.searchText, prompt: "Search conversations")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    HStack(spacing: 16) {
                        Button { showMenu = true } label: {
                            Image(systemName: "line.3.horizontal")
                                .foregroundColor(.cfPrimary)
                        }
                        NavigationLink(destination: InviteFamiliesView()) {
                            Image(systemName: "person.badge.plus")
                        }
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack(spacing: 16) {
                        Button {
                            viewModel.showBroadcast = true
                        } label: {
                            Image(systemName: "megaphone.fill")
                                .foregroundColor(.cfAccent)
                        }
                        NavigationLink(destination: NewMessageView()) {
                            Image(systemName: "square.and.pencil")
                        }
                    }
                }
            }
            .sheet(isPresented: $showMenu) { AppMenuSheet() }
            .sheet(isPresented: $viewModel.showBroadcast) {
                BroadcastAnnouncementSheet { msg in
                    viewModel.addBroadcast(msg)
                }
            }
            .task { await viewModel.load() }
            .refreshable { await viewModel.load() }
        }
    }
}

// MARK: - Conversation Row

struct ConversationRow: View {
    let conversation: Conversation

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack(alignment: .topTrailing) {
                Circle()
                    .fill(Color.accentColor.opacity(0.15))
                    .frame(width: 48, height: 48)
                    .overlay {
                        Text(conversation.familyName.prefix(1).uppercased())
                            .font(.title3.weight(.semibold))
                            .foregroundColor(.accentColor)
                    }
                if conversation.unreadCount > 0 {
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 18, height: 18)
                        .overlay {
                            Text("\(min(conversation.unreadCount, 9))\(conversation.unreadCount > 9 ? "+" : "")")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                        }
                        .offset(x: 4, y: -4)
                }
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(conversation.familyName)
                        .font(.subheadline.weight(conversation.unreadCount > 0 ? .semibold : .regular))
                    Spacer()
                    Text(conversation.lastMessageDate, style: .relative)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Text(conversation.childName)
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

// MARK: - Conversation (Chat) View

struct ConversationView: View {
    let conversation: Conversation
    @StateObject private var viewModel: ConversationViewModel
    @FocusState private var isInputFocused: Bool

    init(conversation: Conversation) {
        self.conversation = conversation
        _viewModel = StateObject(wrappedValue: ConversationViewModel(conversationId: conversation.id))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Family info header
            HStack(spacing: 10) {
                Image(systemName: "person.2.fill")
                    .foregroundColor(.accentColor)
                VStack(alignment: .leading, spacing: 1) {
                    Text(conversation.participantNames.joined(separator: ", "))
                        .font(.caption.weight(.medium))
                    Text("Re: \(conversation.childName)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color(.secondarySystemBackground))

            Divider()

            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.messages) { message in
                            MessageBubble(message: message)
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

            // Composer
            HStack(alignment: .bottom, spacing: 10) {
                TextField("Message", text: $viewModel.draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...5)
                    .focused($isInputFocused)

                Button(action: { viewModel.send() }) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(viewModel.draft.trimmingCharacters(in: .whitespaces).isEmpty ? .secondary : .accentColor)
                }
                .disabled(viewModel.draft.trimmingCharacters(in: .whitespaces).isEmpty || viewModel.isSending)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
            .background(Color(.systemBackground))
        }
        .navigationTitle(conversation.familyName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: Message
    @State private var showOriginal = false

    var isFromStaff: Bool { message.senderRole == .staff }
    var isTranslated: Bool { (message.isTranslated ?? false) && message.bodyOriginal != nil }

    var body: some View {
        HStack {
            if isFromStaff { Spacer(minLength: 60) }

            VStack(alignment: isFromStaff ? .trailing : .leading, spacing: 3) {
                if !isFromStaff {
                    Text(message.senderName)
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(.secondary)
                        .padding(.leading, 4)
                }

                Text(showOriginal ? (message.bodyOriginal ?? message.body) : message.body)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isFromStaff ? Color.accentColor : Color(.secondarySystemBackground))
                    .foregroundColor(isFromStaff ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 18))

                HStack(spacing: 4) {
                    Text(message.sentAt, style: .time)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    if isTranslated {
                        Button {
                            withAnimation { showOriginal.toggle() }
                        } label: {
                            Label(showOriginal ? "Show translation" : "Show original", systemImage: "globe")
                                .font(.caption2)
                                .foregroundColor(.accentColor)
                        }
                    }
                    if isFromStaff {
                        Group {
                            if message.isRead {
                                HStack(spacing: 2) {
                                    Image(systemName: "checkmark")
                                    Image(systemName: "checkmark")
                                }
                                .foregroundColor(.cfPrimary)
                            } else {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.secondary)
                            }
                        }
                        .font(.system(size: 9, weight: .semibold))
                    }
                }
                .padding(.horizontal, 4)
            }

            if !isFromStaff { Spacer(minLength: 60) }
        }
    }
}

// MARK: - New Message View

struct NewMessageView: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var viewModel = NewMessageViewModel()

    var body: some View {
        NavigationStack {
            Form {
                Section("Family") {
                    if viewModel.selectedFamily == nil {
                        NavigationLink("Select Family") {
                            FamilyPickerView(selected: $viewModel.selectedFamily)
                        }
                    } else {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(viewModel.selectedFamily!.name)
                                    .font(.subheadline.weight(.medium))
                                Text("Re: \(viewModel.selectedFamily!.childrenCount) children")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Button("Change") { viewModel.selectedFamily = nil }
                                .font(.caption)
                        }
                    }
                }

                if viewModel.selectedFamily != nil {
                    Section("Recipients") {
                        Toggle("Primary contact", isOn: $viewModel.includePrimary)
                        Toggle("Secondary contact", isOn: $viewModel.includeSecondary)
                    }

                    Section("Message") {
                        TextEditor(text: $viewModel.messageBody)
                            .frame(minHeight: 100)
                    }
                }
            }
            .navigationTitle("New Message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Send") {
                        viewModel.send()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(!viewModel.canSend)
                }
            }
        }
    }
}

struct FamilyPickerView: View {
    @Binding var selected: Family?
    @State private var families: [Family] = []
    @State private var searchText = ""
    @Environment(\.dismiss) var dismiss

    var filtered: [Family] {
        searchText.isEmpty ? families : families.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        List(filtered) { family in
            Button(action: {
                selected = family
                dismiss()
            }) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(family.name).foregroundColor(.primary)
                    Text("\(family.childrenCount) children")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .searchable(text: $searchText)
        .navigationTitle("Select Family")
        .task {
            families = (try? await APIClient.shared.getFamilies()) ?? []
        }
    }
}

// MARK: - ViewModels

@MainActor
class MessagingViewModel: ObservableObject {
    @Published var conversations: [Conversation] = []
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var showBroadcast = false

    func addBroadcast(_ message: String) {
        // In production: call API to send to all families.
        // Locally append a sentinel conversation entry.
    }

    var filteredConversations: [Conversation] {
        guard !searchText.isEmpty else { return conversations }
        return conversations.filter {
            $0.familyName.localizedCaseInsensitiveContains(searchText) ||
            $0.childName.localizedCaseInsensitiveContains(searchText)
        }
    }

    func load() async {
        isLoading = true
        do {
            conversations = try await APIClient.shared.getConversations()
        } catch {
            #if DEBUG
            conversations = MockData.conversations
            #endif
        }
        isLoading = false
    }
}

// ConversationViewModel lives in Sources/Networking/ConversationViewModel.swift,
// shared with the family app.

// MARK: - Broadcast Announcement Sheet

struct BroadcastAnnouncementSheet: View {
    let onSend: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var messageText = ""
    @State private var audience: BroadcastAudience = .allFamilies
    @State private var isSending = false

    enum BroadcastAudience: String, CaseIterable {
        case allFamilies   = "All Families"
        case myFamilies    = "My Caseload Families"
        var icon: String {
            self == .allFamilies ? "person.3.fill" : "person.2.fill"
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 10) {
                        ZStack {
                            Circle()
                                .fill(Color.cfAccent.opacity(0.15))
                                .frame(width: 40, height: 40)
                            Image(systemName: "megaphone.fill")
                                .foregroundColor(.cfAccent)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Broadcast Announcement")
                                .font(.cfSubheadline.bold())
                            Text("Sends to families as a message — not a push notification")
                                .font(.cfCaption)
                                .foregroundColor(.cfTextSecondary)
                        }
                    }
                    .listRowBackground(Color.cfAccent.opacity(0.05))
                }

                Section("Send To") {
                    Picker("Audience", selection: $audience) {
                        ForEach(BroadcastAudience.allCases, id: \.self) { aud in
                            Label(aud.rawValue, systemImage: aud.icon).tag(aud)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Message") {
                    ZStack(alignment: .topLeading) {
                        if messageText.isEmpty {
                            Text("Type your announcement…")
                                .foregroundColor(Color(.placeholderText))
                                .font(.cfBody)
                                .padding(.top, 8)
                                .padding(.leading, 4)
                        }
                        TextEditor(text: $messageText)
                            .font(.cfBody)
                            .frame(minHeight: 120)
                    }
                }

                Section {
                    Button(action: send) {
                        HStack {
                            Spacer()
                            if isSending {
                                ProgressView().tint(.white)
                            } else {
                                Label("Send to \(audience.rawValue)", systemImage: "megaphone.fill")
                                    .fontWeight(.semibold)
                                    .foregroundColor(.white)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 4)
                        .background(messageText.isEmpty ? Color.cfAccent.opacity(0.4) : Color.cfAccent)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(messageText.isEmpty || isSending)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            }
            .navigationTitle("Announcement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func send() {
        isSending = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            onSend(messageText)
            dismiss()
        }
    }
}

@MainActor
class NewMessageViewModel: ObservableObject {
    @Published var selectedFamily: Family?
    @Published var includePrimary = true
    @Published var includeSecondary = false
    @Published var messageBody = ""

    var canSend: Bool {
        selectedFamily != nil && (includePrimary || includeSecondary) && !messageBody.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func send() {
        guard let family = selectedFamily else { return }
        Task {
            _ = try? await APIClient.shared.newConversation(
                familyId: family.id,
                body: messageBody
            )
        }
    }
}
