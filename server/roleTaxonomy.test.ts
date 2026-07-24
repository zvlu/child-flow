import { describe, it, expect } from "vitest";
import { STAFF_ROLE_VALUES, ROLE_LABELS } from "@shared/roles";
import { staff } from "../drizzle/schema";

// Guards the one place that can't import @shared/roles — the DB enum in
// drizzle/schema.ts is the database contract and must list the exact same
// values. If someone adds a role to one but not the other, this fails in CI.
describe("staff role taxonomy — single source of truth", () => {
  it("the drizzle staff.role enum matches @shared/roles STAFF_ROLE_VALUES", () => {
    const dbValues = [...(staff.role as unknown as { enumValues: string[] }).enumValues].sort();
    expect(dbValues).toEqual([...STAFF_ROLE_VALUES].sort());
  });

  it("every role value has a display label", () => {
    for (const v of STAFF_ROLE_VALUES) {
      expect(ROLE_LABELS[v], `missing label for role "${v}"`).toBeTruthy();
    }
  });
});
