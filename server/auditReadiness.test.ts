import { describe, expect, it, vi } from "vitest";
import { computeAuditReadiness } from "./auditReadiness";

vi.mock("./healthDeadlines", () => ({
  getHealthDeadlineSummary: vi.fn().mockResolvedValue({
    childrenTracked: 10, screeningComplete: 9, dentalComplete: 9, overdueCount: 0, dueSoonCount: 2, items: [],
  }),
}));
vi.mock("./chronicAbsence", () => ({
  getChronicAbsenceSummary: vi.fn().mockResolvedValue({
    windowDays: 30, childrenTracked: 10, belowBenchmark: 1, programRate: 92, alerts: [],
  }),
}));
vi.mock("./fpaDb", () => ({
  listFpas: vi.fn().mockResolvedValue([
    { status: "active", parentSigned: true, staffSigned: true },
    { status: "active", parentSigned: true, staffSigned: true },
    { status: "none", parentSigned: false, staffSigned: false },
  ]),
}));
vi.mock("./moduleDb", () => ({
  getCertifications: vi.fn().mockResolvedValue([
    { status: "active" }, { status: "active" }, { status: "expiring_soon" },
  ]),
  listPirReports: vi.fn().mockResolvedValue([
    { year: "2025-2026", status: "draft", total: 100, answered: 80 },
  ]),
}));
vi.mock("./db", () => ({
  getOrganizationUsage: vi.fn().mockResolvedValue({
    children: 116, staff: 20, maxChildren: 120, maxStaff: 30, subscriptionTier: "professional",
  }),
}));

describe("computeAuditReadiness", () => {
  it("produces a weighted 0-100 score with all six sections", async () => {
    const result = await computeAuditReadiness(1);
    expect(result.sections).toHaveLength(6);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    // Healthy demo data should read as at least on-track.
    expect(["strong", "on_track"]).toContain(result.grade);
    for (const s of result.sections) {
      expect(s.score).not.toBeNull();
      expect(s.href).toMatch(/^\//);
    }
  });

  it("excludes empty sections from the weighting instead of zeroing them", async () => {
    const { getCertifications } = await import("./moduleDb");
    (getCertifications as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const result = await computeAuditReadiness(1);
    const staff = result.sections.find((s) => s.id === "staff")!;
    expect(staff.score).toBeNull();
    // Score still computed from the remaining sections.
    expect(result.score).toBeGreaterThan(0);
  });

  it("survives a data source throwing", async () => {
    const { getHealthDeadlineSummary } = await import("./healthDeadlines");
    (getHealthDeadlineSummary as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
    const result = await computeAuditReadiness(1);
    expect(result.sections.find((s) => s.id === "health")!.score).toBeNull();
    expect(result.score).toBeGreaterThan(0);
  });
});
