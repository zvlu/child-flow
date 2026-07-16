import { describe, expect, it } from "vitest";
import { definedPatch, isEmptyPatch } from "./patch";

describe("patch guards", () => {
  it("isEmptyPatch: true for {} and all-undefined patches", () => {
    expect(isEmptyPatch({})).toBe(true);
    expect(isEmptyPatch({ a: undefined, b: undefined })).toBe(true);
  });

  it("isEmptyPatch: false when any value is defined (including null/0/'')", () => {
    expect(isEmptyPatch({ a: undefined, b: null })).toBe(false);
    expect(isEmptyPatch({ a: 0 })).toBe(false);
    expect(isEmptyPatch({ a: "" })).toBe(false);
  });

  it("definedPatch strips only undefined keys", () => {
    expect(definedPatch({ a: 1, b: undefined, c: null, d: "" })).toEqual({ a: 1, c: null, d: "" });
  });
});
