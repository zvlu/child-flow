import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgModules } from "@/hooks/useOrgModules";

/**
 * One-click federal-review evidence binder: pulls the audit-readiness
 * breakdown, enrollment roster, ADA summary, health deadlines, family
 * partnership agreements, and staff credentials into a single dated,
 * print-ready document (browser print → Save as PDF). What used to be a
 * week of assembling spreadsheets before a monitoring visit becomes a
 * button. Audit readiness is admin-only, Head Start-only data, so the
 * binder is gated the same way (defense in depth — this only currently
 * renders inside the already-ModuleGated /compliance page, but a review
 * binder full of §1302 sections makes no sense for a core-only org).
 */
export function ReviewBinderButton() {
  const { user } = useAuth();
  const hasHeadStart = useOrgModules().has("head_start");
  const [building, setBuilding] = useState(false);
  const utils = trpc.useUtils();

  if (user?.role !== "admin" || !hasHeadStart) return null;

  const esc = (v: unknown) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const table = (headers: string[], rows: (string | number)[][]) => `
    <table>
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;

  const fmtDate = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  const build = async () => {
    setBuilding(true);
    try {
      const [readiness, org, children, classroomMap, absence, health, fpas, certs] = await Promise.all([
        utils.compliance.auditReadiness.fetch(ORGANIZATION_ID),
        utils.organizations.get.fetch(ORGANIZATION_ID),
        utils.children.list.fetch(ORGANIZATION_ID),
        utils.children.classroomMap.fetch(ORGANIZATION_ID).catch(() => []),
        utils.chronicAbsence.summary.fetch({ organizationId: ORGANIZATION_ID }).catch(() => null),
        utils.healthDeadlines.summary.fetch({ organizationId: ORGANIZATION_ID }).catch(() => null),
        utils.fpa.list.fetch({ organizationId: ORGANIZATION_ID }).catch(() => []),
        utils.staffOps.certifications.fetch(ORGANIZATION_ID).catch(() => []),
      ]);

      const classroomByChild = new Map((classroomMap as any[]).map((r) => [r.childId, r.classroomName]));
      const now = new Date();
      const stamp = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

      const sectionsHtml = readiness.sections
        .map(
          (s) => `
          <tr>
            <td><strong>${esc(s.label)}</strong> <span class="muted">${esc(s.standard)}</span></td>
            <td class="num">${s.score == null ? "—" : s.score}</td>
            <td>${esc(s.detail)}</td>
          </tr>`
        )
        .join("");

      const activeChildren = (children as any[]).filter((c) => c.status === "active");

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Program Review Binder — ${esc(org?.name ?? "Program")}</title>
<style>
  body { font: 13px/1.5 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1c1917; margin: 40px auto; max-width: 900px; padding: 0 24px; }
  h1 { font-size: 24px; margin: 0 0 2px; } h2 { font-size: 16px; margin: 32px 0 8px; border-bottom: 2px solid #4F7C5D; padding-bottom: 4px; }
  .muted { color: #78716c; font-weight: normal; font-size: 11px; }
  .cover { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .score { text-align: center; border: 3px solid #4F7C5D; border-radius: 12px; padding: 10px 22px; }
  .score b { font-size: 34px; display: block; color: #4F7C5D; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #57534e; border-bottom: 1.5px solid #d6d3d1; padding: 5px 8px; }
  td { border-bottom: 1px solid #e7e5e4; padding: 5px 8px; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  footer { margin-top: 40px; font-size: 11px; color: #78716c; border-top: 1px solid #e7e5e4; padding-top: 8px; }
  @media print { body { margin: 0 auto; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style></head><body>
  <div class="cover">
    <div>
      <h1>Program Review Binder</h1>
      <p class="muted">${esc(org?.name ?? "")}${org?.agencyId ? ` · Agency ${esc(org.agencyId)}` : ""}<br>Generated ${esc(stamp)} · Sprout</p>
    </div>
    <div class="score"><b>${readiness.score}</b><span class="muted">Audit readiness / 100</span></div>
  </div>

  <h2>1. Readiness by Performance Standard</h2>
  <table><thead><tr><th>Area</th><th class="num">Score</th><th>Finding</th></tr></thead><tbody>${sectionsHtml}</tbody></table>

  <h2>2. Enrollment Roster <span class="muted">${activeChildren.length} active · ${(children as any[]).length} total on record</span></h2>
  ${table(
    ["Child", "Status", "Classroom", "Enrolled"],
    (children as any[]).map((c) => [
      `${c.firstName} ${c.lastName}`,
      c.status ?? "—",
      classroomByChild.get(c.id) ?? "—",
      fmtDate(c.enrollmentDate),
    ])
  )}

  <h2>3. Attendance (§1302.16)</h2>
  ${
    absence
      ? `<p>Program ADA <strong>${absence.programRate}%</strong> over the last ${absence.windowDays} days · ${absence.belowBenchmark} of ${absence.childrenTracked} children below the 85% benchmark.</p>` +
        (absence.alerts.length
          ? table(
              ["Child", "Rate", "Risk", "Absences", "Last absence"],
              absence.alerts.map((a: any) => [a.childName, `${a.attendanceRate}%`, a.riskLevel.replace("_", " "), a.absentDays, fmtDate(a.lastAbsence)])
            )
          : "<p>No children currently flagged.</p>")
      : "<p>No attendance data in the window.</p>"
  }

  <h2>4. Health Screening Deadlines (§1302.42)</h2>
  ${
    health
      ? `<p>${health.screeningComplete} of ${health.childrenTracked} children complete on 45-day screenings · ${health.dentalComplete} complete on 90-day dental · <strong>${health.overdueCount} overdue</strong>, ${health.dueSoonCount} due within 14 days.</p>` +
        table(
          ["Child", "Enrolled", "45-day screening", "90-day dental"],
          (health.items as any[]).map((i) => [
            i.childName,
            fmtDate(i.enrollmentDate),
            `${i.screening.state.replace("_", " ")} (${fmtDate(i.screening.deadline)})`,
            `${i.dental.state.replace("_", " ")} (${fmtDate(i.dental.deadline)})`,
          ])
        )
      : "<p>No active children tracked.</p>"
  }

  <h2>5. Family Partnership Agreements (§1302.52)</h2>
  ${
    (fpas as any[]).length
      ? table(
          ["Family", "Status", "Goals", "Visits", "Signatures", "Review date"],
          (fpas as any[]).map((f) => [
            f.familyName,
            f.status === "none" ? "no agreement" : f.status.replace("_", " "),
            `${f.goalsCompleted}/${f.goalsTotal}`,
            `${f.visitsLogged}/${f.targetVisits}`,
            f.parentSigned && f.staffSigned ? "complete" : f.parentSigned || f.staffSigned ? "partial" : "none",
            fmtDate(f.reviewDate),
          ])
        )
      : "<p>No families on record.</p>"
  }

  <h2>6. Staff Credentials (§1302.91)</h2>
  ${
    (certs as any[]).length
      ? table(
          ["Staff", "Credential", "Number", "Issued", "Expires", "Status"],
          (certs as any[]).map((c) => [c.staffName, c.certificationType, c.certificationNumber ?? "—", fmtDate(c.issueDate), fmtDate(c.expiryDate), c.status.replace("_", " ")])
        )
      : "<p>No credentials tracked.</p>"
  }

  <footer>Generated from live program data by Sprout on ${esc(now.toLocaleString())}. Scores are advisory and do not replace official monitoring protocols.</footer>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
</body></html>`;

      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Pop-up blocked — allow pop-ups to export the binder.");
        return;
      }
      win.document.write(html);
      win.document.close();
      toast.success("Review binder ready — use Print → Save as PDF");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assemble the binder");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <Button variant="outline" className="gap-2" onClick={build} disabled={building}>
      {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Export Review Binder
    </Button>
  );
}
