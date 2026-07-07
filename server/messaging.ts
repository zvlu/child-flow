import { and, desc, eq, inArray } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import {
  chatMessages,
  children,
  conversations,
  families,
  users,
  type Conversation,
  type User,
} from "../drizzle/schema";
import { clientIpFromReq } from "./_core/audit";
import { sdk } from "./_core/sdk";
import { getDb, insertAuditLog, updateUserSettings } from "./db";
import {
  isSupportedLanguage,
  translateThreadForViewer,
  type SupportedLanguage,
} from "./translation";

/**
 * Two-way in-app messaging between staff and families.
 *
 * Serves the conversation endpoints both iOS apps already call:
 *   GET  /api/messaging/conversations                  — list (role-scoped)
 *   GET  /api/messaging/conversations/:id/messages     — thread (marks read)
 *   POST /api/messaging/messages                       — reply
 *   POST /api/messaging/conversations                  — start a thread
 *
 * Scoping: staff/admin see every conversation in the program; parent accounts
 * see only their own family's. All access is re-checked per conversation.
 */

type Viewer = { user: User; side: "staff" | "family"; familyId: number | null };

async function requireViewer(req: Request): Promise<Viewer | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role === "admin" || user.role === "staff") {
      return { user, side: "staff", familyId: null };
    }
    if (user.role === "parent" && user.familyId != null) {
      return { user, side: "family", familyId: user.familyId };
    }
    return null;
  } catch {
    return null;
  }
}

/** Can this viewer see this conversation at all? */
function canAccess(viewer: Viewer, conversation: Conversation): boolean {
  // Staff may only see threads in their own organization; a parent only their
  // own family's thread (which is inherently within their org).
  if (viewer.side === "staff") return conversation.organizationId === viewer.user.organizationId;
  return conversation.familyId === viewer.familyId;
}

/** Serialize a conversation the way the iOS apps decode it. */
async function serializeConversation(conversation: Conversation, viewer: Viewer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [family] = await db
    .select()
    .from(families)
    .where(eq(families.id, conversation.familyId))
    .limit(1);
  const kids = await db
    .select({ firstName: children.firstName, lastName: children.lastName })
    .from(children)
    .where(eq(children.familyId, conversation.familyId))
    .limit(1);

  const [latest] = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversation.id))
    .orderBy(desc(chatMessages.sentAt), desc(chatMessages.id))
    .limit(1);

  const viewerLastReadAt =
    viewer.side === "staff" ? conversation.staffLastReadAt : conversation.familyLastReadAt;
  const incoming = await db
    .select({ id: chatMessages.id, sentAt: chatMessages.sentAt })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversation.id),
        eq(chatMessages.senderRole, viewer.side === "staff" ? "family" : "staff")
      )
    );
  const unreadCount = incoming.filter(
    m => viewerLastReadAt == null || m.sentAt > viewerLastReadAt
  ).length;

  return {
    id: String(conversation.id),
    familyName: family?.primaryContactName ?? "Family",
    childName: kids[0] ? `${kids[0].firstName} ${kids[0].lastName}` : "",
    participantNames: [family?.primaryContactName ?? "Family"],
    lastMessage: latest?.body ?? "",
    lastMessageDate: (latest?.sentAt ?? conversation.createdAt).toISOString(),
    unreadCount,
    isActive: conversation.isActive === 1,
  };
}

/** The viewer's preferred message language (users.settings.preferredLanguage). */
function viewerLanguage(viewer: Viewer): SupportedLanguage {
  const pref = viewer.user.settings?.preferredLanguage;
  return pref && isSupportedLanguage(pref) ? pref : "en";
}

function serializeMessage(
  m: typeof chatMessages.$inferSelect,
  senderName: string,
  viewer: Viewer,
  conversation: Conversation,
  translation?: { body: string; translated: boolean }
) {
  // The viewer's own messages count as read once the OTHER side has seen the
  // thread; everything the viewer is fetching right now is read by definition.
  const otherLastReadAt =
    m.senderRole === "staff" ? conversation.familyLastReadAt : conversation.staffLastReadAt;
  const isRead =
    m.senderRole === (viewer.side === "staff" ? "staff" : "family")
      ? otherLastReadAt != null && otherLastReadAt >= m.sentAt
      : true;

  return {
    id: String(m.id),
    conversationId: String(m.conversationId),
    senderId: String(m.senderUserId),
    senderName,
    senderRole: m.senderRole,
    body: translation?.body ?? m.body,
    // Original text so clients can offer a "show original" toggle.
    bodyOriginal: translation?.translated ? m.body : undefined,
    isTranslated: translation?.translated ?? false,
    sentAt: m.sentAt.toISOString(),
    isRead,
  };
}

async function senderNames(userIds: number[]): Promise<Map<number, string>> {
  const db = await getDb();
  if (!db || userIds.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, userIds));
  return new Map(rows.map(r => [r.id, r.name ?? "Unknown"]));
}

export function registerMessagingRoutes(app: Express) {
  /** List conversations visible to the caller. */
  app.get("/api/messaging/conversations", async (req: Request, res: Response) => {
    const viewer = await requireViewer(req);
    if (!viewer) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    const rows =
      viewer.side === "staff"
        ? await db
            .select()
            .from(conversations)
            .where(eq(conversations.organizationId, viewer.user.organizationId ?? -1))
            .orderBy(desc(conversations.updatedAt))
        : await db
            .select()
            .from(conversations)
            .where(eq(conversations.familyId, viewer.familyId!))
            .orderBy(desc(conversations.updatedAt));

    res.json(await Promise.all(rows.map(c => serializeConversation(c, viewer))));
  });

  /** Fetch a thread; marks the viewer's side as read. */
  app.get(
    "/api/messaging/conversations/:id/messages",
    async (req: Request, res: Response) => {
      const viewer = await requireViewer(req);
      if (!viewer) {
        res.status(401).json({ error: "Please sign in again" });
        return;
      }
      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Database not available" });
        return;
      }

      const conversationId = Number(req.params.id);
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      if (!conversation || !canAccess(viewer, conversation)) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      const msgs = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conversationId))
        .orderBy(chatMessages.sentAt);
      const names = await senderNames(Array.from(new Set(msgs.map(m => m.senderUserId))));

      // Real-time translation: messages from the other side render in the
      // viewer's preferred language (staff default to English). Source-language
      // stamps let same-language messages skip the LLM entirely.
      const lang = viewerLanguage(viewer);
      const translationsByMessage = await translateThreadForViewer(msgs, viewer.side, lang);

      // Mark the viewer's side as caught up.
      await db
        .update(conversations)
        .set(
          viewer.side === "staff"
            ? { staffLastReadAt: new Date() }
            : { familyLastReadAt: new Date() }
        )
        .where(eq(conversations.id, conversationId));

      res.json(
        msgs.map(m =>
          serializeMessage(
            m,
            names.get(m.senderUserId) ?? "Unknown",
            viewer,
            conversation,
            translationsByMessage.get(m.id)
          )
        )
      );
    }
  );

  /** Send a message into an existing conversation. */
  app.post("/api/messaging/messages", async (req: Request, res: Response) => {
    const viewer = await requireViewer(req);
    if (!viewer) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const conversationId = Number(req.body?.conversationId);
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!conversationId || !body) {
      res.status(400).json({ error: "conversationId and body are required" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (!conversation || !canAccess(viewer, conversation)) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await db.insert(chatMessages).values({
      conversationId,
      senderUserId: viewer.user.id,
      senderRole: viewer.side,
      body,
      sentAt: new Date(),
    });
    // Sending implies having read the thread.
    await db
      .update(conversations)
      .set(
        viewer.side === "staff"
          ? { staffLastReadAt: new Date() }
          : { familyLastReadAt: new Date() }
      )
      .where(eq(conversations.id, conversationId));

    const [saved] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(desc(chatMessages.id))
      .limit(1);
    res.json(
      serializeMessage(saved!, viewer.user.name ?? "Unknown", viewer, conversation)
    );
  });

  /** Start a conversation (or reuse the family's existing active thread). */
  app.post("/api/messaging/conversations", async (req: Request, res: Response) => {
    const viewer = await requireViewer(req);
    if (!viewer) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    // Parents always message within their own family, whatever the payload says.
    const familyId =
      viewer.side === "family" ? viewer.familyId! : Number(req.body?.familyId);
    if (!familyId || !body) {
      res.status(400).json({ error: "familyId and body are required" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);
    if (!family) {
      res.status(404).json({ error: "Family not found" });
      return;
    }
    // Staff may only start threads with families in their own org.
    if (viewer.side === "staff" && family.organizationId !== viewer.user.organizationId) {
      res.status(403).json({ error: "You don't have access to that family." });
      return;
    }

    // One active thread per family keeps the inbox tidy.
    let [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.familyId, familyId), eq(conversations.isActive, 1)))
      .limit(1);

    if (!conversation) {
      await db.insert(conversations).values({
        organizationId: family.organizationId,
        familyId,
        createdBy: viewer.user.id,
      });
      [conversation] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.familyId, familyId), eq(conversations.isActive, 1)))
        .orderBy(desc(conversations.id))
        .limit(1);
      await insertAuditLog({
        userId: viewer.user.id,
        actorOpenId: viewer.user.openId,
        action: "create",
        resourceType: "conversation",
        resourceId: String(familyId),
        ipAddress: clientIpFromReq(req),
      });
    }

    await db.insert(chatMessages).values({
      conversationId: conversation!.id,
      senderUserId: viewer.user.id,
      senderRole: viewer.side,
      body,
      // Stamp the sender's language so readers in the same language never
      // trigger a pointless LLM round-trip (see translateThreadForViewer).
      translations: { __source: viewerLanguage(viewer) },
      sentAt: new Date(),
    });
    await db
      .update(conversations)
      .set(
        viewer.side === "staff"
          ? { staffLastReadAt: new Date() }
          : { familyLastReadAt: new Date() }
      )
      .where(eq(conversations.id, conversation!.id));

    res.json(await serializeConversation(conversation!, viewer));
  });

  /**
   * Set the caller's preferred message language. The family app calls this
   * whenever the user changes language; staff messages then arrive translated.
   */
  app.post("/api/messaging/language", async (req: Request, res: Response) => {
    const viewer = await requireViewer(req);
    if (!viewer) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const language = typeof req.body?.language === "string" ? req.body.language : "";
    if (!isSupportedLanguage(language)) {
      res.status(400).json({ error: `Unsupported language: ${language}` });
      return;
    }
    await updateUserSettings(viewer.user.openId, { preferredLanguage: language });
    res.json({ ok: true, language });
  });
}
