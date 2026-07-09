import Foundation

/// Chat thread view model shared by the staff and family apps.
@MainActor
class ConversationViewModel: ObservableObject {
    let conversationId: String
    @Published var messages: [Message] = []
    @Published var draft = ""
    @Published var isSending = false
    @Published var errorMessage: String?

    init(conversationId: String) {
        self.conversationId = conversationId
    }

    func load() async {
        do {
            messages = try await APIClient.shared.getMessages(conversationId: conversationId)
        } catch {
            // A failed load used to render identically to a genuinely empty
            // thread — surface it instead of leaving the person guessing.
            errorMessage = "Couldn't load this conversation. Check your connection and try again."
        }
    }

    func send() {
        let body = draft.trimmingCharacters(in: .whitespaces)
        guard !body.isEmpty else { return }
        draft = ""
        isSending = true
        Task {
            do {
                let sent = try await APIClient.shared.sendMessage(conversationId: conversationId, body: body)
                messages.append(sent)
            } catch {
                // Restore what was typed — this used to clear the compose field
                // unconditionally and silently drop the message on failure, so a
                // failed send looked exactly like a sent one.
                draft = body
                errorMessage = "This message wasn't sent. Check your connection and try again."
            }
            isSending = false
        }
    }
}
