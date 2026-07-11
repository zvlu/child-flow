import { describe, expect, it, vi } from "vitest";
import { families, staff } from "../drizzle/schema";
import { computeHealthScore, suggestAssignments, CASELOAD_LIMIT } from "./caseloads";

let staffRows: Record<string, any>[] = [];
let familyRows: Record<string, any>[] = [];

const fakeDb = {
  select: (..._cols: unknown[]) => ({
    from: (table: unknown) => ({
      where: () => Promise.resolve(table === staff ? staffRows : table === families ? familyRows : []),
    }),
  }),
};

vi.mock("./db", () => ({ getDb: () => Promise.resolve(fakeDb) }));

describe("computeHealthScore", () => {
  it("is 100 for an empty case load", () => {
    expect(computeHealthScore({ familyCount: 0, visitedThisMonth: 0, followUpsDue: 0, overCapacity: false })).toBe(100);
  });
  it("rewards full visit coverage with no follow-ups due", () => {
    expect(computeHealthScore({ familyCount: 10, visitedThisMonth: 10, followUpsDue: 0, overCapacity: false })).toBe(100);
  });
  it("drops as coverage falls and follow-ups pile up", () => {
    const good = computeHealthScore({ familyCount: 10, visitedThisMonth: 8, followUpsDue: 1, overCapacity: false });
    const bad = computeHealthScore({ familyCount: 10, visitedThisMonth: 2, followUpsDue: 6, overCapacity: false });
    expect(good).toBeGreaterThan(bad);
    expect(bad).toBeLessThan(50);
  });
  it("caps the score at 70 when over capacity", () => {
    expect(
      computeHealthScore({ familyCount: CASELOAD_LIMIT + 5, visitedThisMonth: CASELOAD_LIMIT + 5, followUpsDue: 0, overCapacity: true })
    ).toBeLessThanOrEqual(70);
  });
});

describe("suggestAssignments", () => {
  it("prefers the same-city advocate, then the lightest load, and balances as it goes", async () => {
    staffRows = [
      { id: 1, firstName: "Ana", lastName: "Reyes" },
      { id: 2, firstName: "Ben", lastName: "Ward" },
    ];
    familyRows = [
      // Existing loads: Ana has 2 (both Sacramento), Ben has 1 (Davis).
      { id: 10, familyAdvocateId: 1, primaryContactName: "F10", city: "Sacramento" },
      { id: 11, familyAdvocateId: 1, primaryContactName: "F11", city: "Sacramento" },
      { id: 12, familyAdvocateId: 2, primaryContactName: "F12", city: "Davis" },
      // Unassigned:
      { id: 20, familyAdvocateId: null, primaryContactName: "Garcia", city: "Sacramento" },
      { id: 21, familyAdvocateId: null, primaryContactName: "Okafor", city: null },
      { id: 22, familyAdvocateId: null, primaryContactName: "Nguyen", city: null },
    ];

    const suggestions = await suggestAssignments(1);
    expect(suggestions).toHaveLength(3);

    // Garcia (Sacramento) → Ana despite her heavier load (city match wins).
    expect(suggestions[0]).toMatchObject({ familyName: "Garcia", advocateId: 1 });
    // Okafor (no city) → Ben (lightest load: 1 vs Ana's now-3).
    expect(suggestions[1]).toMatchObject({ familyName: "Okafor", advocateId: 2 });
    // Nguyen → Ben again (2 vs 3) — loads balance as suggestions accumulate.
    expect(suggestions[2]).toMatchObject({ familyName: "Nguyen", advocateId: 2 });
  });

  it("skips families when every advocate is at the case-load limit", async () => {
    staffRows = [{ id: 1, firstName: "Ana", lastName: "Reyes" }];
    familyRows = [
      ...Array.from({ length: CASELOAD_LIMIT }, (_, i) => ({
        id: 100 + i, familyAdvocateId: 1, primaryContactName: `F${i}`, city: null,
      })),
      { id: 999, familyAdvocateId: null, primaryContactName: "Overflow", city: null },
    ];
    const suggestions = await suggestAssignments(1);
    expect(suggestions).toHaveLength(0);
  });
});
