import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { classrooms, staff, type User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";

/**
 * REST backing for the iOS staff app's "Staff Directory" screen
 * (ios/Sources/Staff/StaffView.swift), which has always called GET /api/staff
 * — a route that never existed server-side, so the directory was silently
 * empty outside DEBUG's mock-data fallback.
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    return user.role === "admin" || user.role === "staff" ? user : null;
  } catch {
    return null;
  }
}

// §1302.91 role enum -> the display title the web Staff page already uses
// (client/src/pages/Staff.tsx's `roleLabels`) so both surfaces agree.
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  director: "Head Start Director",
  fiscal_officer: "Fiscal Officer",
  education_coordinator: "Education Coordinator",
  coach: "Coach",
  health_coordinator: "Health Coordinator",
  nurse: "Nurse",
  nutritionist: "Nutritionist / RD",
  mental_health_consultant: "Mental Health Consultant",
  disabilities_coordinator: "Disabilities Coordinator",
  family_services_manager: "Family Services Manager",
  family_advocate: "Family Advocate",
  home_visitor: "Home Visitor",
  ersea_coordinator: "ERSEA Coordinator",
  teacher: "Teacher",
  assistant: "Assistant Teacher",
  cook: "Cook",
  bus_driver: "Bus Driver",
  coordinator: "Coordinator",
};

export function registerStaffDirectoryRoutes(app: Express) {
  app.get("/api/staff", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) {
      res.status(401).json({ error: "Please sign in again" });
      return;
    }
    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }
    const org = user.organizationId != null ? { id: user.organizationId } : null;
    if (!org) {
      res.json([]);
      return;
    }

    const rows = await db.select().from(staff).where(eq(staff.organizationId, org.id));
    const rooms = await db
      .select({ id: classrooms.id, name: classrooms.name, teacherId: classrooms.teacherId, assistantId: classrooms.assistantId })
      .from(classrooms)
      .where(eq(classrooms.organizationId, org.id));
    const classroomByStaffId = new Map<number, string>();
    for (const r of rooms) {
      if (r.teacherId != null) classroomByStaffId.set(r.teacherId, r.name);
      if (r.assistantId != null && !classroomByStaffId.has(r.assistantId)) classroomByStaffId.set(r.assistantId, r.name);
    }

    res.json(
      rows
        .filter((s) => s.isActive !== 0)
        .map((s) => ({
          id: String(s.id),
          fullName: `${s.firstName} ${s.lastName}`,
          role: ROLE_LABELS[s.role ?? "teacher"] ?? "Staff",
          roleKey: s.role ?? "teacher",
          email: s.email ?? "",
          phone: s.phone ?? "",
          // No training-hours tracking feature exists yet — 0 is an honest
          // "nothing recorded" rather than a guessed number.
          trainingHours: 0,
          classroom: classroomByStaffId.get(s.id) ?? null,
        }))
    );
  });
}
