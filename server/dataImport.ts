/**
 * One-stop roster import: each CSV row can carry a child, their family
 * contact, and recent health exam dates. We dedupe families within the org
 * (by contact email, falling back to name+phone), create children linked to
 * the right family, and record any health exams — all in a single call, so
 * migrating from a spreadsheet is one upload instead of four.
 */
import { eq } from "drizzle-orm";
import { children, families, healthRecords, type Family } from "../drizzle/schema";
import { getDb } from "./db";

export type ImportHealthDates = {
  physicalDate?: Date;
  immunizationDate?: Date;
  dentalDate?: Date;
  visionDate?: Date;
  hearingDate?: Date;
};

export type ImportRosterRow = {
  // Child (required)
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  status?: "active" | "inactive" | "graduated" | "withdrawn";
  notes?: string;
  // Family contact (optional — omitted rows create an unlinked child)
  familyContactName?: string;
  familyContactPhone?: string;
  familyContactEmail?: string;
  secondaryContactName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  // Health exams (optional)
  health?: ImportHealthDates;
  healthProvider?: string;
};

export type ImportRosterResult = {
  childrenCreated: number;
  familiesCreated: number;
  familiesMatched: number;
  healthRecordsCreated: number;
  errors: { rowIndex: number; message: string }[];
};

const HEALTH_TYPE_BY_KEY: Record<keyof ImportHealthDates, "physical" | "immunization" | "dental" | "vision" | "hearing"> = {
  physicalDate: "physical",
  immunizationDate: "immunization",
  dentalDate: "dental",
  visionDate: "vision",
  hearingDate: "hearing",
};

const digits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();

/** Stable identity for a family row so siblings on separate lines share one family. */
function familyKey(row: ImportRosterRow): string | null {
  const email = norm(row.familyContactEmail);
  if (email) return `e:${email}`;
  const name = norm(row.familyContactName);
  if (!name) return null;
  return `n:${name}|${digits(row.familyContactPhone)}`;
}

function keyForExisting(f: Family): string[] {
  const keys: string[] = [];
  const email = norm(f.primaryContactEmail ?? undefined);
  if (email) keys.push(`e:${email}`);
  const name = norm(f.primaryContactName);
  if (name) keys.push(`n:${name}|${digits(f.primaryContactPhone ?? undefined)}`);
  return keys;
}

export async function importRoster(
  organizationId: number,
  rows: ImportRosterRow[]
): Promise<ImportRosterResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result: ImportRosterResult = {
    childrenCreated: 0,
    familiesCreated: 0,
    familiesMatched: 0,
    healthRecordsCreated: 0,
    errors: [],
  };

  // Existing families in this org, keyed for matching.
  const existing = await db.select().from(families).where(eq(families.organizationId, organizationId));
  const familyIdByKey = new Map<string, number>();
  for (const f of existing) for (const k of keyForExisting(f)) if (!familyIdByKey.has(k)) familyIdByKey.set(k, f.id);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // 1. Family: match or create (once per key — siblings share it).
      let familyId: number | undefined;
      const key = familyKey(row);
      if (key) {
        const matched = familyIdByKey.get(key);
        if (matched !== undefined) {
          familyId = matched;
          result.familiesMatched++;
        } else {
          const [ins] = await db.insert(families).values({
            organizationId,
            primaryContactName: row.familyContactName?.trim() || row.familyContactEmail!.trim(),
            primaryContactPhone: row.familyContactPhone?.trim() || undefined,
            primaryContactEmail: row.familyContactEmail?.trim() || undefined,
            secondaryContactName: row.secondaryContactName?.trim() || undefined,
            address: row.address?.trim() || undefined,
            city: row.city?.trim() || undefined,
            state: row.state?.trim().slice(0, 2).toUpperCase() || undefined,
            zipCode: row.zipCode?.trim() || undefined,
          });
          familyId = ins.insertId;
          familyIdByKey.set(key, familyId);
          result.familiesCreated++;
        }
      }

      // 2. Child, linked to the family when present.
      const [childIns] = await db.insert(children).values({
        organizationId,
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        dateOfBirth: row.dateOfBirth,
        gender: row.gender,
        status: row.status ?? "active",
        familyId,
        notes: row.notes?.trim() || undefined,
      });
      const childId = childIns.insertId;
      result.childrenCreated++;

      // 3. Health records for any exam dates supplied.
      for (const [k, type] of Object.entries(HEALTH_TYPE_BY_KEY) as [keyof ImportHealthDates, (typeof HEALTH_TYPE_BY_KEY)[keyof ImportHealthDates]][]) {
        const recordDate = row.health?.[k];
        if (!recordDate) continue;
        await db.insert(healthRecords).values({
          childId,
          organizationId,
          type,
          status: "up_to_date",
          recordDate,
          provider: row.healthProvider?.trim() || undefined,
          notes: "Imported from roster spreadsheet",
        });
        result.healthRecordsCreated++;
      }
    } catch (err) {
      result.errors.push({
        rowIndex: i,
        message: err instanceof Error ? err.message : "Unknown error importing row",
      });
    }
  }

  return result;
}
