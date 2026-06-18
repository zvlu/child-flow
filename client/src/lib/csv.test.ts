import { describe, expect, it } from "vitest";
import { objectsToCsv, parseCsv, parseCsvToObjects } from "./csv";

describe("objectsToCsv", () => {
  it("returns empty string for no rows", () => {
    expect(objectsToCsv([])).toBe("");
  });

  it("uses the union of keys as headers and serializes values", () => {
    const csv = objectsToCsv([
      { a: 1, b: "x" },
      { a: 2, c: true },
    ]);
    expect(csv).toBe("a,b,c\n1,x,\n2,,true");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    const csv = objectsToCsv([{ name: 'Doe, Jane', note: 'say "hi"', multi: "a\nb" }]);
    expect(csv).toBe('name,note,multi\n"Doe, Jane","say ""hi""","a\nb"');
  });

  it("formats Date values as YYYY-MM-DD", () => {
    const csv = objectsToCsv([{ d: new Date("2021-08-12T10:00:00Z") }]);
    expect(csv).toBe("d\n2021-08-12");
  });
});

describe("parseCsv", () => {
  it("parses a simple grid and ignores blank lines", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4\n")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("handles quoted fields with commas, escaped quotes and CRLF", () => {
    const grid = parseCsv('name,note\r\n"Doe, Jane","say ""hi"""\r\n');
    expect(grid).toEqual([["name", "note"], ["Doe, Jane", 'say "hi"']]);
  });
});

describe("parseCsvToObjects", () => {
  it("maps rows to objects keyed by normalized headers", () => {
    const rows = parseCsvToObjects("First Name,Last Name\nAva,Nguyen\nLiam,Brooks");
    expect(rows).toEqual([
      { firstname: "Ava", lastname: "Nguyen" },
      { firstname: "Liam", lastname: "Brooks" },
    ]);
  });

  it("returns empty array when there is no data", () => {
    expect(parseCsvToObjects("")).toEqual([]);
  });
});
