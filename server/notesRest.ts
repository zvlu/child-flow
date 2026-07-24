import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getRecentNotes, createStudentNote } from "./moduleDb";
import { getChildById } from "./db";
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

  // Create a child case note (iOS Quick Note). Mirrors the web tRPC
  // notes.create; verifies the child belongs to the caller's org first.
  app.post("/api/notes", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user || user.organizationId == null) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const childId = Number(req.body?.childId);
    const title = String(req.body?.title ?? "").trim();
    const content = String(req.body?.content ?? "").trim();
    const priorityRaw = String(req.body?.priority ?? "medium");
    const priority = (["low", "medium", "high", "critical"].includes(priorityRaw) ? priorityRaw : "medium") as
      | "low" | "medium" | "high" | "critical";
    if (!Number.isFinite(childId) || !title || !content) {
      res.status(400).json({ error: "childId, title, and content are required" });
      return;
    }
    const child = await getChildById(childId);
    if (!child || child.organizationId !== user.organizationId) {
      res.status(404).json({ error: "Child not found" });
      return;
    }
    const result = await createStudentNote({
      organizationId: user.organizationId,
      childId,
      title,
      content,
      priority,
      createdBy: null,
    });
    res.json({ id: String(result.id) });
  });
}
