import { describe, expect, it } from "vitest";
import { dateInputToLocal } from "./date";

describe("dateInputToLocal", () => {
  it("parses YYYY-MM-DD as local midnight (no UTC off-by-one)", () => {
    const d = dateInputToLocal("2021-09-15")!;
    expect(d.getFullYear()).toBe(2021);
    expect(d.getMonth()).toBe(8); // September (0-indexed)
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it("returns undefined for empty or malformed input", () => {
    expect(dateInputToLocal("")).toBeUndefined();
    expect(dateInputToLocal(null)).toBeUndefined();
    expect(dateInputToLocal("not-a-date")).toBeUndefined();
    expect(dateInputToLocal("09/15/2021")).toBeUndefined();
  });
});
