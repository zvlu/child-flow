import { eq, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, organizations, children, staff, families, attendance, 
  healthRecords, familyServices,
  InsertChild, InsertOrganization, InsertHealthRecord, InsertFamilyService 
} from "../drizzle/schema";
import { ENV } from './_core/env';

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
}n result.length > 0 ? result[0] : undefined;
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
