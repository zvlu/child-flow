import { eq, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, organizations, children, staff, families, attendance,
  healthRecords, familyServices, communicationLogs, educationRecords, pirData,
  InsertChild, InsertOrganization, InsertHealthRecord, InsertFamilyService,
  auditLogs, InsertAuditLog
} from "../drizzle/schema";
import { ENV } from './_core/env';

const FOLLOW_UP_TYPES = new Set(["immunization", "physical", "dental", "vision", "hearing"]);

export type HealthFollowUpAlert = {
  childId: number;
  childName: string;
  recordId: number;
  type: string;
  expiryDate: Date;
  daysUntilDue: number;
  severity: "overdue" | "due_soon";
  message: string;
};

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/** Look up a user by email for password-based sign-in. */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/** Set (or clear, with null) a user's scrypt password hash. */
export async function setUserPassword(openId: string, passwordHash: string | null) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot set password: database not available");
    return;
  }

  await db.update(users).set({ passwordHash }).where(eq(users.openId, openId));
}

/** Bind a user to an organization (used by self-serve signup). */
export async function assignUserOrganization(openId: string, organizationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ organizationId }).where(eq(users.openId, openId));
}

/** Update a user's own editable profile fields (currently just display name). */
export async function updateUserProfile(openId: string, data: { name?: string; avatarUrl?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.openId, openId));
}

/**
 * Merge a partial settings patch into the user's existing settings JSON.
 * Reading-then-writing keeps untouched preferences intact and lets the column
 * grow without every caller having to send the whole object.
 */
export async function updateUserSettings(
  openId: string,
  patch: Partial<NonNullable<typeof users.$inferSelect.settings>>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await getUserByOpenId(openId);
  const merged: NonNullable<typeof users.$inferSelect.settings> = { ...(current?.settings ?? {}) };

  if (patch.twoFactorEnabled !== undefined) merged.twoFactorEnabled = patch.twoFactorEnabled;

  if (patch.preferredLanguage !== undefined) {
    if (patch.preferredLanguage) merged.preferredLanguage = patch.preferredLanguage;
    else delete merged.preferredLanguage;
  }

  // Notification toggles merge key-by-key so changing one preference never
  // resets the others.
  if (patch.notifications !== undefined) {
    merged.notifications = { ...(current?.settings?.notifications ?? {}), ...patch.notifications };
    if (Object.keys(merged.notifications).length === 0) delete merged.notifications;
  }

  // Navigation layout is replaced wholesale (the client always sends the full
  // arranged set); an empty object means "reset to defaults".
  if (patch.navigation !== undefined) {
    const hasPrefs = patch.navigation.topNav || patch.navigation.sideNav;
    if (hasPrefs) merged.navigation = patch.navigation;
    else delete merged.navigation;
  }

  await db.update(users).set({ settings: merged }).where(eq(users.openId, openId));
  return merged;
}

/**
 * Append a row to the audit log.
 * Best-effort: failures are logged but never propagated into the request path,
 * so audit-write problems can't deny access to (or block writes of) care records.
 */
export async function insertAuditLog(entry: InsertAuditLog): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn(
      "[Audit] DB unavailable, dropping audit event:",
      entry.action,
      entry.resourceType
    );
    return;
  }

  try {
    await db.insert(auditLogs).values(entry);
  } catch (error) {
    console.error("[Audit] Failed to write audit log:", error);
  }
}

export async function getOrganizationByAgencyId(agencyId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.agencyId, agencyId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Update the editable program-profile fields of an organization. */
export async function updateOrganization(
  id: number,
  data: Partial<Pick<typeof organizations.$inferInsert,
    "name" | "director" | "directorEmail" | "phone" | "address" | "maxChildren" | "classroomCount" | "maxStaff" | "subscriptionTier" | "enabledModules">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(organizations).set(data).where(eq(organizations.id, id));
}

/** Current enrollment/staff counts vs the org's plan limits — backs usage UI + enforcement. */
export async function getOrganizationUsage(organizationId: number) {
  const db = await getDb();
  if (!db) return null;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) return null;
  const kids = await db.select({ id: children.id }).from(children).where(eq(children.organizationId, organizationId));
  const staffRows = await db.select({ id: staff.id }).from(staff).where(eq(staff.organizationId, organizationId));
  return {
    children: kids.length,
    staff: staffRows.length,
    maxChildren: org.maxChildren ?? null,
    maxStaff: org.maxStaff ?? null,
    subscriptionTier: org.subscriptionTier,
  };
}

export async function getUserOrganizations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(organizations).where(eq(organizations.ownerId, userId));
}

/** All organizations with live children/staff counts — platform-owner dashboard. */
export async function getAllOrganizations() {
  const db = await getDb();
  if (!db) return [];
  const orgs = await db.select().from(organizations).orderBy(organizations.name);
  const kids = await db.select({ organizationId: children.organizationId, id: children.id }).from(children);
  const staffRows = await db.select({ organizationId: staff.organizationId, id: staff.id }).from(staff);
  const tally = (rows: { organizationId: number }[]) => {
    const m = new Map<number, number>();
    for (const r of rows) m.set(r.organizationId, (m.get(r.organizationId) ?? 0) + 1);
    return m;
  };
  const childCount = tally(kids);
  const staffCount = tally(staffRows);
  return orgs.map((o) => ({ ...o, childrenCount: childCount.get(o.id) ?? 0, staffCount: staffCount.get(o.id) ?? 0 }));
}

export async function createOrganization(data: InsertOrganization) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(organizations).values(data);
  return { id: result.insertId };
}

export async function setOrganizationActive(id: number, isActive: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(organizations).set({ isActive }).where(eq(organizations.id, id));
  return { success: true };
}

export async function getOrganizationChildren(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(children).where(eq(children.organizationId, organizationId));
}

export async function getChildById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(children).where(eq(children.id, id));
  return results[0] || null;
}

export async function getFamilySiblings(familyId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(children).where(eq(children.familyId, familyId));
}

export async function createChild(data: InsertChild) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(children).values(data);
  return result;
}

/** Insert many children in one statement (CSV bulk import). Returns the count. */
export async function bulkCreateChildren(rows: InsertChild[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (rows.length === 0) return { count: 0 };
  await db.insert(children).values(rows);
  return { count: rows.length };
}

export async function getOrganizationStaff(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(staff).where(eq(staff.organizationId, organizationId));
}

export async function getAttendanceByDate(organizationId: number, date: Date) {
  const db = await getDb();
  if (!db) return [];
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.organizationId, organizationId),
        gte(attendance.date, startOfDay),
        lte(attendance.date, endOfDay)
      )
    );
}

export async function getHealthRecords(organizationId: number, childId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (childId) {
    return await db.select().from(healthRecords).where(
      and(
        eq(healthRecords.organizationId, organizationId),
        eq(healthRecords.childId, childId)
      )
    );
  }
  return await db.select().from(healthRecords).where(eq(healthRecords.organizationId, organizationId));
}

export async function createHealthRecord(data: InsertHealthRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(healthRecords).values(data);
}

export async function getHealthFollowUpAlerts(organizationId: number, dueWithinDays = 30): Promise<HealthFollowUpAlert[]> {
  const db = await getDb();
  if (!db) return [];

  const [records, organizationChildren] = await Promise.all([
    db.select().from(healthRecords).where(eq(healthRecords.organizationId, organizationId)),
    db.select().from(children).where(eq(children.organizationId, organizationId)),
  ]);

  const childNameById = new Map<number, string>();
  for (const child of organizationChildren) {
    childNameById.set(child.id, `${child.firstName} ${child.lastName}`);
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dueSoonLimit = new Date(startOfToday);
  dueSoonLimit.setDate(dueSoonLimit.getDate() + dueWithinDays);

  const latestByChildType = new Map<string, typeof records[number]>();
  for (const record of records) {
    if (!record.expiryDate || !FOLLOW_UP_TYPES.has(record.type)) continue;

    const key = `${record.childId}:${record.type}`;
    const existing = latestByChildType.get(key);
    if (!existing) {
      latestByChildType.set(key, record);
      continue;
    }

    const existingTime = existing.expiryDate ? new Date(existing.expiryDate).getTime() : 0;
    const currentTime = new Date(record.expiryDate).getTime();
    if (currentTime > existingTime) {
      latestByChildType.set(key, record);
    }
  }

  const alerts: HealthFollowUpAlert[] = [];
  for (const record of Array.from(latestByChildType.values())) {
    if (!record.expiryDate) continue;

    const expiry = new Date(record.expiryDate);
    if (expiry > dueSoonLimit) continue;

    const childName = childNameById.get(record.childId) || `Child #${record.childId}`;
    const daysUntilDue = Math.ceil((expiry.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntilDue < 0;
    const normalizedType = record.type.replaceAll("_", " ");
    const message = isOverdue
      ? `${childName} ${normalizedType} follow-up is overdue`
      : `${childName} ${normalizedType} follow-up is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;

    alerts.push({
      childId: record.childId,
      childName,
      recordId: record.id,
      type: record.type,
      expiryDate: expiry,
      daysUntilDue,
      severity: isOverdue ? "overdue" : "due_soon",
      message,
    });
  }

  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "overdue" ? -1 : 1;
    return a.daysUntilDue - b.daysUntilDue;
  });

  return alerts;
}

export async function getFamilyServices(organizationId: number, familyId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (familyId) {
    return await db.select().from(familyServices).where(
      and(
        eq(familyServices.organizationId, organizationId),
        eq(familyServices.familyId, familyId)
      )
    );
  }
  return await db.select().from(familyServices).where(eq(familyServices.organizationId, organizationId));
}

export async function createFamilyService(data: InsertFamilyService) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(familyServices).values(data);
}

export async function getCommunicationLogs(organizationId: number, recipientId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (recipientId) {
    return await db.select().from(communicationLogs).where(
      and(
        eq(communicationLogs.organizationId, organizationId),
        eq(communicationLogs.recipientId, recipientId)
      )
    );
  }
  return await db.select().from(communicationLogs).where(eq(communicationLogs.organizationId, organizationId));
}

export async function createCommunicationLog(data: typeof communicationLogs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(communicationLogs).values(data);
  return { id: result.insertId };
}

export async function getEducationRecords(organizationId: number, childId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (childId) {
    return await db.select().from(educationRecords).where(
      and(
        eq(educationRecords.organizationId, organizationId),
        eq(educationRecords.childId, childId)
      )
    );
  }
  return await db.select().from(educationRecords).where(eq(educationRecords.organizationId, organizationId));
}

export async function getPirData(organizationId: number, year: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(pirData).where(
    and(
      eq(pirData.organizationId, organizationId),
      eq(pirData.year, year)
    )
  );
}

