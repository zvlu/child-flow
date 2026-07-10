import { beforeEach, describe, expect, it, vi } from "vitest";
import { children, families, healthRecords } from "../drizzle/schema";
import { importRoster } from "./dataImport";

/**
 * Fake drizzle db: select().from().where() returns pre-seeded families;
 * insert(table).values(row) records the row and hands back an insertId.
 */
const inserted: { table: unknown; row: Record<string, any>; insertId: number }[] = [];
let existingFamilies: Record<string, any>[] = [];
let existingChildren: Record<string, any>[] = [];
let nextId = 100;

const fakeDb = {
  select: (..._cols: unknown[]) => ({
    from: (table: unknown) => ({
      where: () => Promise.resolve(table === children ? existingChildren : existingFamilies),
    }),
  }),
  insert: (table: unknown) => ({
    values: (row: Record<string, any>) => {
      const insertId = nextId++;
      inserted.push({ table, row, insertId });
      return Promise.resolve([{ insertId }]);
    },
  }),
  transaction: (fn: (tx: typeof fakeDb) => Promise<unknown>) => fn(fakeDb),
};

vi.mock("./db", () => ({ getDb: () => Promise.resolve(fakeDb) }));

const insertedFor = (table: unknown) => inserted.filter((i) => i.table === table);

describe("importRoster", () => {
  beforeEach(() => {
    inserted.length = 0;
    existingFamilies = [];
    existingChildren = [];
    nextId = 100;
  });

  it("links siblings sharing a parent contact to one new family", async () => {
    const result = await importRoster(1, [
      { firstName: "Sofia", lastName: "Ramirez", familyContactName: "Elena Ramirez", familyContactEmail: "elena@example.com" },
      { firstName: "Mateo", lastName: "Ramirez", familyContactName: "Elena Ramirez", familyContactEmail: "elena@example.com" },
    ]);

    expect(result.childrenCreated).toBe(2);
    expect(result.familiesCreated).toBe(1);
    expect(result.familiesMatched).toBe(1); // second sibling matched the family created for the first
    expect(result.errors).toHaveLength(0);

    const familyRows = insertedFor(families);
    expect(familyRows).toHaveLength(1);
    const familyId = familyRows[0].insertId;
    const childRows = insertedFor(children);
    expect(childRows).toHaveLength(2);
    for (const c of childRows) expect(c.row.familyId).toBe(familyId);
  });

  it("matches an existing family by contact email instead of duplicating it", async () => {
    existingFamilies = [
      { id: 7, organizationId: 1, primaryContactName: "Elena Ramirez", primaryContactEmail: "ELENA@example.com", primaryContactPhone: null },
    ];

    const result = await importRoster(1, [
      { firstName: "Sofia", lastName: "Ramirez", familyContactEmail: "elena@example.com" },
    ]);

    expect(result.familiesCreated).toBe(0);
    expect(result.familiesMatched).toBe(1);
    expect(insertedFor(families)).toHaveLength(0);
    expect(insertedFor(children)[0].row.familyId).toBe(7);
  });

  it("matches by name + phone when there is no email", async () => {
    existingFamilies = [
      { id: 9, organizationId: 1, primaryContactName: "James Cole", primaryContactEmail: null, primaryContactPhone: "(555) 111-2222" },
    ];

    const result = await importRoster(1, [
      { firstName: "Ava", lastName: "Cole", familyContactName: "james cole", familyContactPhone: "555-111-2222" },
    ]);

    expect(result.familiesMatched).toBe(1);
    expect(insertedFor(children)[0].row.familyId).toBe(9);
  });

  it("creates health records for each supplied exam date", async () => {
    const physicalDate = new Date("2025-09-01");
    const dentalDate = new Date("2025-10-15");

    const result = await importRoster(1, [
      {
        firstName: "Sofia",
        lastName: "Ramirez",
        health: { physicalDate, dentalDate },
        healthProvider: "Dr. Chen",
      },
    ]);

    expect(result.healthRecordsCreated).toBe(2);
    const hr = insertedFor(healthRecords);
    expect(hr.map((r) => r.row.type).sort()).toEqual(["dental", "physical"]);
    const childId = insertedFor(children)[0].insertId;
    for (const r of hr) {
      expect(r.row.childId).toBe(childId);
      expect(r.row.organizationId).toBe(1);
      expect(r.row.provider).toBe("Dr. Chen");
    }
  });

  it("creates an unlinked child when no family contact is given", async () => {
    const result = await importRoster(1, [{ firstName: "Ana", lastName: "Solo" }]);

    expect(result.childrenCreated).toBe(1);
    expect(result.familiesCreated).toBe(0);
    expect(insertedFor(children)[0].row.familyId).toBeUndefined();
  });

  it("skips children who already exist (same name + DOB) — re-upload is safe", async () => {
    const dob = new Date("2021-03-12");
    existingChildren = [{ firstName: "Sofia", lastName: "Ramirez", dateOfBirth: dob }];

    const result = await importRoster(1, [
      { firstName: "sofia", lastName: "RAMIREZ", dateOfBirth: dob }, // case-insensitive match
      { firstName: "Mateo", lastName: "Ramirez", dateOfBirth: new Date("2022-11-02") },
    ]);

    expect(result.skippedDuplicates).toBe(1);
    expect(result.childrenCreated).toBe(1);
    expect(insertedFor(children)).toHaveLength(1);
    expect(insertedFor(children)[0].row.firstName).toBe("Mateo");
  });

  it("skips duplicate rows within the same upload", async () => {
    const row = { firstName: "Ana", lastName: "Solo", dateOfBirth: new Date("2021-01-01") };
    const result = await importRoster(1, [row, { ...row }]);
    expect(result.childrenCreated).toBe(1);
    expect(result.skippedDuplicates).toBe(1);
  });

  it("records a per-row error without aborting the rest of the import", async () => {
    const originalInsert = fakeDb.insert;
    let childInserts = 0;
    fakeDb.insert = ((table: unknown) => {
      if (table === children && childInserts++ === 0) {
        return { values: () => Promise.reject(new Error("boom")) };
      }
      return originalInsert(table);
    }) as typeof fakeDb.insert;

    try {
      const result = await importRoster(1, [
        { firstName: "Bad", lastName: "Row" },
        { firstName: "Good", lastName: "Row" },
      ]);

      expect(result.errors).toEqual([{ rowIndex: 0, message: "boom" }]);
      expect(result.childrenCreated).toBe(1);
    } finally {
      fakeDb.insert = originalInsert;
    }
  });
});
