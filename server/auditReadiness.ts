/**
 * Audit Readiness Score — the "if the federal reviewer walked in today"
 * number. Computed live from the same program data staff already maintain
 * (no extra data entry), broken down by Performance Standard so a director
 * can see exactly which area drags the score and jump straight to it.
 *
 * Each section scores 0–100 and carries a weight; the headline score is the
 * weighted average. Sections with no applicable data (e.g. no families yet)
 * are excluded from the weighting rather than counted as failures.
 */
import { getHealthDeadlineSummary } from "./healthDeadlines";
import { getChronicAbsenceSummary } from "./chronicAbsence";
import { listFpas } from "./fpaDb";
import { getCertifications, listPirReports } from "./moduleDb";
import { getOrganizationUsage } from "./db";

export type ReadinessSection = {
  id: string;
  label: string;
  standard: string;
  /** 0–100, or null when no data applies yet. */
  score: number | null;
  weight: number;
  detail: string;
  /** Where to go to fix it. */
  href: string;
};

export type AuditReadiness = {
  score: number;
  grade: "strong" | "on_track" | "at_risk" | "critical";
  sections: ReadinessSection[];
  computedAt: string;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function gradeFor(score: number): AuditReadiness["grade"] {
  if (score >= 90) return "strong";
  if (score >= 75) return "on_track";
  if (score >= 55) return "at_risk";
  return "critical";
}

export async function computeAuditReadiness(organizationId: number): Promise<AuditReadiness> {
  const [health, absence, fpas, certs, pirReports, usage] = await Promise.all([
    getHealthDeadlineSummary(organizationId).catch(() => null),
    getChronicAbsenceSummary(organizationId).catch(() => null),
    listFpas(organizationId).catch(() => [] as Awaited<ReturnType<typeof listFpas>>),
    getCertifications(organizationId).catch(() => []),
    listPirReports(organizationId).catch(() => []),
    getOrganizationUsage(organizationId).catch(() => null),
  ]);

  const sections: ReadinessSection[] = [];

  // §1302.42 — health screenings within 45/90-day windows.
  if (health && health.childrenTracked > 0) {
    const met = health.screeningComplete + health.dentalComplete;
    const possible = health.childrenTracked * 2;
    const overduePenalty = (health.overdueCount / Math.max(health.childrenTracked, 1)) * 30;
    sections.push({
      id: "health",
      label: "Health Screenings",
      standard: "§1302.42",
      score: clamp((met / possible) * 100 - overduePenalty),
      weight: 25,
      detail:
        health.overdueCount > 0
          ? `${health.overdueCount} overdue screening deadline${health.overdueCount === 1 ? "" : "s"}; ${health.dueSoonCount} due within 14 days.`
          : `All screening windows current; ${health.dueSoonCount} due within 14 days.`,
      href: "/health-deadlines",
    });
  } else {
    sections.push({ id: "health", label: "Health Screenings", standard: "§1302.42", score: null, weight: 25, detail: "No active children tracked yet.", href: "/health-deadlines" });
  }

  // §1302.16 — attendance / chronic absence.
  if (absence && absence.childrenTracked > 0) {
    const benchmarkGap = Math.max(0, 85 - absence.programRate); // ADA target
    const atRiskShare = (absence.belowBenchmark / absence.childrenTracked) * 100;
    sections.push({
      id: "attendance",
      label: "Attendance (ADA)",
      standard: "§1302.16",
      score: clamp(100 - benchmarkGap * 4 - atRiskShare * 0.5),
      weight: 20,
      detail: `Program rate ${absence.programRate}% over ${absence.windowDays} days; ${absence.belowBenchmark} of ${absence.childrenTracked} children below the 85% benchmark.`,
      href: "/chronic-absence",
    });
  } else {
    sections.push({ id: "attendance", label: "Attendance (ADA)", standard: "§1302.16", score: null, weight: 20, detail: "No attendance recorded in the window yet.", href: "/attendance" });
  }

  // §1302.52 — family partnership agreements.
  if (fpas.length > 0) {
    const active = fpas.filter((f) => f.status === "active" || f.status === "completed").length;
    const signed = fpas.filter((f) => f.parentSigned && f.staffSigned).length;
    sections.push({
      id: "fpa",
      label: "Family Partnerships",
      standard: "§1302.52",
      score: clamp(((active + signed) / (fpas.length * 2)) * 100),
      weight: 15,
      detail: `${active} of ${fpas.length} families with an active agreement; ${signed} fully signed.`,
      href: "/family-partnership",
    });
  } else {
    sections.push({ id: "fpa", label: "Family Partnerships", standard: "§1302.52", score: null, weight: 15, detail: "No families on record yet.", href: "/family-partnership" });
  }

  // §1302.12/.14 — funded enrollment fill rate.
  if (usage && usage.maxChildren) {
    const fill = (usage.children / usage.maxChildren) * 100;
    sections.push({
      id: "enrollment",
      label: "Funded Enrollment",
      standard: "§1302.12–.14",
      // Under-enrollment is the federal concern; >97% fill is full credit.
      score: clamp((fill / 97) * 100),
      weight: 15,
      detail: `${usage.children} of ${usage.maxChildren} funded slots filled (${Math.round(fill)}%).`,
      href: "/enrollment",
    });
  } else {
    sections.push({ id: "enrollment", label: "Funded Enrollment", standard: "§1302.12–.14", score: null, weight: 15, detail: "Funded enrollment not configured.", href: "/settings" });
  }

  // §1302.91 — staff qualifications / credentials current.
  if (certs.length > 0) {
    const expired = certs.filter((c) => c.status === "expired").length;
    const expiring = certs.filter((c) => c.status === "expiring_soon").length;
    sections.push({
      id: "staff",
      label: "Staff Credentials",
      standard: "§1302.91",
      score: clamp(100 - (expired / certs.length) * 100 - (expiring / certs.length) * 25),
      weight: 10,
      detail:
        expired > 0
          ? `${expired} expired credential${expired === 1 ? "" : "s"}, ${expiring} expiring within 60 days.`
          : `All credentials current; ${expiring} expiring within 60 days.`,
      href: "/staff-operations",
    });
  } else {
    sections.push({ id: "staff", label: "Staff Credentials", standard: "§1302.91", score: null, weight: 10, detail: "No staff credentials tracked yet.", href: "/staff-operations" });
  }

  // PIR — current-year completeness (draft prep = audit prep).
  const currentPir = pirReports[0];
  if (currentPir && currentPir.total > 0) {
    sections.push({
      id: "pir",
      label: "PIR Completeness",
      standard: "PIR",
      score:
        currentPir.status && currentPir.status !== "draft"
          ? 100
          : clamp((currentPir.answered / currentPir.total) * 100),
      weight: 15,
      detail:
        currentPir.status && currentPir.status !== "draft"
          ? `PIR ${currentPir.year} submitted.`
          : `${currentPir.answered} of ${currentPir.total} questions answered for ${currentPir.year} (Smart Fill can draft the rest).`,
      href: "/compliance",
    });
  } else {
    sections.push({ id: "pir", label: "PIR Completeness", standard: "PIR", score: null, weight: 15, detail: "No PIR report started yet.", href: "/compliance" });
  }

  const scored = sections.filter((s) => s.score != null);
  const totalWeight = scored.reduce((n, s) => n + s.weight, 0);
  const score =
    totalWeight === 0
      ? 0
      : Math.round(scored.reduce((n, s) => n + (s.score! * s.weight), 0) / totalWeight);

  return { score, grade: gradeFor(score), sections, computedAt: new Date().toISOString() };
}
