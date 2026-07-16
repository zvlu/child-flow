import { and, eq, gte } from "drizzle-orm";
import { attendance, children, families } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Chronic Absence Alert System (web counterpart of the iOS feature).
 *
 * Head Start programs must analyze causes when a child's attendance drops
 * below 85% (45 CFR §1302.16). This module computes per-child attendance
 * rates over a rolling window and classifies risk:
 *
 *   severe  < 60%   — immediate outreach + attendance plan
 *   high    < 75%   — outreach + barrier assessment
 *   at_risk < 85%   — below the federal benchmark
 *   watch   < 90%   — trending toward risk
 *
 * Rates count `present` as 1, `half_day` as 0.5; `absent` and `excused`
 * both count against the rate (excused absences still affect §1302.16
 * attendance analysis, but are surfaced separately for context).
 */

export type ChronicAbsenceRisk = "severe" | "high" | "at_risk" | "watch";

export interface WeekRate {
  label: string;
  rate: number; // 0–100
  days: number;
}

export interface ChronicAbsenceAlert {
  childId: number;
  childName: string;
  familyId: number | null;
  familyName: string;
  attendanceRate: number; // 0–100
  riskLevel: ChronicAbsenceRisk;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  excusedDays: number;
  halfDays: number;
  lastAbsence: string | null; // ISO date
  weeklyTrend: WeekRate[];
}

export interface ChronicAbsenceSummary {
  windowDays: number;
  childrenTracked: number;
  belowBenchmark: number; // < 85%
  programRate: number; // 0–100
  alerts: ChronicAbsenceAlert[];
}

function riskFor(rate: number): ChronicAbsenceRisk | null {
  if (rate < 60) return "severe";
  if (rate < 75) return "high";
  if (rate < 85) return "at_risk";
  if (rate < 90) return "watch";
  return null;
}

export async function getChronicAbsenceSummary(
  organizationId: number,
  windowDays = 30
): Promise<ChronicAbsenceSummary> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      childId: attendance.childId,
      status: attendance.status,
      date: attendance.date,
      firstName: children.firstName,
      lastName: children.lastName,
      familyId: children.familyId,
      familyName: families.primaryContactName,
    })
    .from(attendance)
    .innerJoin(children, eq(attendance.childId, children.id))
    .leftJoin(families, eq(children.familyId, families.id))
    .where(
      and(
        eq(attendance.organizationId, organizationId),
        gte(attendance.date, since),
        eq(children.status, "active")
      )
    );

  type Acc = {
    childName: string;
    familyId: number | null;
    familyName: string;
    total: number;
    present: number;
    absent: number;
    excused: number;
    half: number;
    lastAbsence: Date | null;
    // per-week buckets keyed by weeks-ago (0 = current week)
    weeks: Map<number, { attended: number; days: number }>;
  };

  const now = Date.now();
  const byChild = new Map<number, Acc>();

  for (const r of rows) {
    let acc = byChild.get(r.childId);
    if (!acc) {
      acc = {
        childName: `${r.firstName} ${r.lastName}`,
        familyId: r.familyId,
        familyName: r.familyName ?? "—",
        total: 0,
        present: 0,
        absent: 0,
        excused: 0,
        half: 0,
        lastAbsence: null,
        weeks: new Map(),
      };
      byChild.set(r.childId, acc);
    }
    acc.total += 1;
    let attended = 0;
    switch (r.status) {
      case "present":
        acc.present += 1;
        attended = 1;
        break;
      case "half_day":
        acc.half += 1;
        attended = 0.5;
        break;
      case "excused":
        acc.excused += 1;
        if (!acc.lastAbsence || r.date > acc.lastAbsence) acc.lastAbsence = r.date;
        break;
      default: // absent
        acc.absent += 1;
        if (!acc.lastAbsence || r.date > acc.lastAbsence) acc.lastAbsence = r.date;
        break;
    }
    // Trend covers exactly the last 4 weeks; older rows still count toward
    // the overall rate but are excluded from the weekly bars so "3 wks ago"
    // never silently aggregates months of data on 60/90-day windows.
    const weeksAgo = Math.floor((now - r.date.getTime()) / (7 * 24 * 3600 * 1000));
    if (weeksAgo <= 3) {
      const wk = acc.weeks.get(weeksAgo) ?? { attended: 0, days: 0 };
      wk.attended += attended;
      wk.days += 1;
      acc.weeks.set(weeksAgo, wk);
    }
  }

  const alerts: ChronicAbsenceAlert[] = [];
  let programAttended = 0;
  let programDays = 0;

  for (const [childId, acc] of Array.from(byChild.entries())) {
    if (acc.total === 0) continue;
    const attended = acc.present + acc.half * 0.5;
    programAttended += attended;
    programDays += acc.total;
    const rate = Math.round((attended / acc.total) * 100);
    const risk = riskFor(rate);
    if (!risk) continue;

    const weekLabels = ["This week", "Last week", "2 wks ago", "3 wks ago"];
    const weeklyTrend: WeekRate[] = [3, 2, 1, 0].map((w) => {
      const wk = acc.weeks.get(w);
      return {
        label: weekLabels[w],
        rate: wk && wk.days > 0 ? Math.round((wk.attended / wk.days) * 100) : 0,
        days: wk?.days ?? 0,
      };
    });

    alerts.push({
      childId,
      childName: acc.childName,
      familyId: acc.familyId,
      familyName: acc.familyName,
      attendanceRate: rate,
      riskLevel: risk,
      totalDays: acc.total,
      presentDays: acc.present,
      absentDays: acc.absent,
      excusedDays: acc.excused,
      halfDays: acc.half,
      lastAbsence: acc.lastAbsence ? acc.lastAbsence.toISOString() : null,
      weeklyTrend,
    });
  }

  const riskOrder: Record<ChronicAbsenceRisk, number> = {
    severe: 0,
    high: 1,
    at_risk: 2,
    watch: 3,
  };
  alerts.sort(
    (a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || a.attendanceRate - b.attendanceRate
  );

  return {
    windowDays,
    childrenTracked: byChild.size,
    belowBenchmark: alerts.filter((a) => a.attendanceRate < 85).length,
    programRate: programDays > 0 ? Math.round((programAttended / programDays) * 100) : 100,
    alerts,
  };
}
