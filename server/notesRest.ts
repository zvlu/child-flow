import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getRecentNotes } from "./moduleDb";
import type { User } from "../drizzle/schema";

/**
 * REST backing for the iOS Notes screen — the unified, org-wide feed of every
 * child + family note, newest first. Mirrors the web tRPC `notes.recent`
 * (orgStaffProcedure, not Head Start-gated), so any staff/admin can read it.
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

export function registerNotesRoutes(app: Express) {
  app.get("/api/notes/recent", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const notes = await getRecentNotes(user.organizationId, limit);
    res.json(
      notes.map((n) => ({
        id: n.id,
        kind: n.kind,
        subjectId: n.subjectId,
        subjectName: n.subjectName,
        title: n.title,
        body: n.body,
        tag: n.tag,
        priority: n.priority,
        confidentiality: n.confidentiality,
        author: n.author,
        at: n.createdAt.toISOString(),
      })),
    );
  });
}
