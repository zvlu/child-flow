import { eq, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, organizations, children, staff, families, attendance, 
  healthRecords, familyServices, communicationLogs, educationRecords, pirData,
  InsertChild, InsertOrganization, InsertHealthRecord, InsertFamilyService 
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

export async function getOrganizationByAgencyId(agencyId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.agencyId, agencyId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserOrganizations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(organizations).where(eq(organizations.ownerId, userId));
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
