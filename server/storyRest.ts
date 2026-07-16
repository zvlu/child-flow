import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { storyPosts, storyPostLikes, storyPostComments, staff, type User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { getDb, insertAuditLog } from "./db";
import { resolveStaffId } from "./moduleDb";

/**
 * Program "Story" feed (iOS Sources/Story/ProgramStoryView.swift) —
 * previously entirely mocked: `load()` always overwrote state with 4
 * hardcoded fixtures regardless of server state, and "Post"/"Like"/
 * "Comment" only mutated a local array. See drizzle/schema.ts's
 * storyPosts/storyPostLikes/storyPostComments tables.
 *
 * Deliberately does not implement real photo upload — the mock's
 * "hasPhoto/photoColor/photoIcon/photoLabel" was decorative styling, not an
 * actual uploaded image, so there's nothing real to persist there yet; a
 * `photoUrl` column exists on storyPosts for whenever that's built for real
 * (see server/fileStorage.ts's UPLOADS_ROOT pattern used elsewhere).
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

const AUDIENCE_TO_LABEL: Record<string, string> = {
  all_families: "All Families",
  my_families: "My Caseload Families",
  staff_only: "Staff Only",
};
const LABEL_TO_AUDIENCE: Record<string, string> = {
  "All Families": "all_families",
  "My Caseload Families": "my_families",
  "Staff Only": "staff_only",
};

export function registerStoryRoutes(app: Express) {
  app.get("/api/story/posts", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const myStaffId = await resolveStaffId(user.organizationId, user.id);

    const posts = await db
      .select({ post: storyPosts, authorFirst: staff.firstName, authorLast: staff.lastName, authorRole: staff.role })
      .from(storyPosts)
      .leftJoin(staff, eq(storyPosts.authorStaffId, staff.id))
      .where(eq(storyPosts.organizationId, user.organizationId))
      .orderBy(desc(storyPosts.createdAt));

    const postIds = posts.map((p) => p.post.id);

    // Fetch likes/comments for all posts in this org's post set (two queries
    // total, not one per post).
    const allLikes = postIds.length
      ? await db.select().from(storyPostLikes).where(inArray(storyPostLikes.postId, postIds))
      : [];
    const allComments = postIds.length
      ? await db.select().from(storyPostComments).where(inArray(storyPostComments.postId, postIds))
      : [];
    const likesByPost = new Map<number, typeof allLikes>();
    for (const l of allLikes) {
      likesByPost.set(l.postId, [...(likesByPost.get(l.postId) ?? []), l]);
    }
    const commentCountByPost = new Map<number, number>();
    for (const c of allComments) {
      commentCountByPost.set(c.postId, (commentCountByPost.get(c.postId) ?? 0) + 1);
    }

    res.json(
      posts.map(({ post, authorFirst, authorLast, authorRole }) => {
        const postLikes = likesByPost.get(post.id) ?? [];
        return {
          id: String(post.id),
          authorName: authorFirst ? `${authorFirst} ${authorLast}` : "Staff",
          authorRole: authorRole ?? "teacher",
          caption: post.content,
          hasPhoto: !!post.photoUrl,
          photoUrl: post.photoUrl,
          audience: AUDIENCE_TO_LABEL[post.audience ?? "all_families"],
          taggedChildren: post.taggedChildIds ?? [],
          postedAt: post.createdAt.toISOString(),
          likeCount: postLikes.length,
          commentCount: commentCountByPost.get(post.id) ?? 0,
          likedByMe: myStaffId != null && postLikes.some((l) => l.staffId === myStaffId),
        };
      })
    );
  });

  app.post("/api/story/posts", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const content = String(req.body?.caption ?? "").trim();
    if (!content) {
      res.status(400).json({ error: "caption is required" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const authorStaffId = await resolveStaffId(user.organizationId, user.id);
    const audience = LABEL_TO_AUDIENCE[req.body?.audience] ?? "all_families";
    const taggedChildIds = Array.isArray(req.body?.taggedChildren)
      ? req.body.taggedChildren.map(Number).filter((n: number) => Number.isFinite(n))
      : undefined;

    const [result] = await db.insert(storyPosts).values({
      organizationId: user.organizationId,
      authorStaffId: authorStaffId ?? undefined,
      content,
      audience: audience as "all_families" | "my_families" | "staff_only",
      taggedChildIds,
    });

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "story_post",
      resourceId: String(result.insertId),
      ipAddress: clientIpFromReq(req),
    });

    res.json({ id: String(result.insertId), success: true });
  });

  app.post("/api/story/posts/:id/like", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const postId = Number(req.params.id);
    const db = await getDb();
    if (!db || !Number.isFinite(postId)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const staffId = await resolveStaffId(user.organizationId, user.id);
    if (staffId == null) {
      res.status(400).json({ error: "No staff record for this user" });
      return;
    }
    const existing = await db
      .select({ id: storyPostLikes.id })
      .from(storyPostLikes)
      .where(and(eq(storyPostLikes.postId, postId), eq(storyPostLikes.staffId, staffId)));

    if (existing.length > 0) {
      await db.delete(storyPostLikes).where(eq(storyPostLikes.id, existing[0].id));
      res.json({ liked: false });
    } else {
      await db.insert(storyPostLikes).values({ postId, staffId });
      res.json({ liked: true });
    }
  });

  /**
   * List comments on a post, oldest first (thread order) — previously
   * missing entirely, so the iOS Story feed could only show a running
   * comment count with no way to actually read what was said.
   */
  app.get("/api/story/posts/:id/comments", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const postId = Number(req.params.id);
    const db = await getDb();
    if (!db || !Number.isFinite(postId)) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    // Confirm the post belongs to this org before returning its comments.
    const [post] = await db.select({ organizationId: storyPosts.organizationId }).from(storyPosts).where(eq(storyPosts.id, postId));
    if (!post || post.organizationId !== user.organizationId) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const rows = await db
      .select()
      .from(storyPostComments)
      .where(eq(storyPostComments.postId, postId))
      .orderBy(asc(storyPostComments.createdAt));
    res.json(
      rows.map((c) => ({
        id: String(c.id),
        authorName: c.authorName,
        content: c.content,
        postedAt: c.createdAt.toISOString(),
      }))
    );
  });

  app.post("/api/story/posts/:id/comments", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const postId = Number(req.params.id);
    const content = String(req.body?.content ?? "").trim();
    const db = await getDb();
    if (!db || !Number.isFinite(postId) || !content) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const staffId = await resolveStaffId(user.organizationId, user.id);
    let authorName = "Staff";
    if (staffId != null) {
      const [s] = await db.select({ firstName: staff.firstName, lastName: staff.lastName }).from(staff).where(eq(staff.id, staffId));
      if (s) authorName = `${s.firstName} ${s.lastName}`;
    }
    const [result] = await db.insert(storyPostComments).values({
      postId,
      authorName,
      staffId: staffId ?? undefined,
      content,
    });
    res.json({ id: String(result.insertId), authorName, content, postedAt: new Date().toISOString(), success: true });
  });
}
