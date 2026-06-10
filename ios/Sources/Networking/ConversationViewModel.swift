import Foundation

/// Chat thread view model shared by the staff and family apps.
@MainActor
class ConversationViewModel: ObservableObject {
    let conversationId: String
    @Published var messages: [Message] = []
    @Published var draft = ""
    @Published var isSending = false

    init(conversationId: String) {
        self.conversationId = conversationId
    }

    func load() async {
        do {
            messages = try await APIClient.shared.getMessages(conversationId: conversationId)
        } catch {
            // Leave whatever is already loaded; the view shows an empty state.
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
            } catch {}
            isSending = false
        }
    }
}
