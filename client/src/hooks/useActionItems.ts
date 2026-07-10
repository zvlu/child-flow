import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useOrgModules } from "@/hooks/useOrgModules";

export type QueueStatus = "urgent" | "pending" | "completed";

export type QueueItem = {
  id: string;
  title: string;
  owner: string;
  area: string;
  due: string;
  status: QueueStatus;
  detail: string;
  href?: string;
  insightId?: number;
};

function formatTypeLabel(type: string) {
  return type
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "No due date";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const RISK_LABELS: Record<string, string> = {
  severe: "Severe",
  high: "High risk",
  at_risk: "At risk",
  watch: "Watch",
};

/**
 * The unified "what needs attention" feed: health follow-ups, actionable AI
 * insights, document signatures, staff credential expiries, and chronic-
 * absence alerts, merged and sorted urgent-first. Shared by the Action Queue
 * page and the dashboard's "Today" card so both always agree.
 */
export function useActionItems() {
  const modules = useOrgModules();
  const hasHeadStart = modules.has("head_start");

  const { data: followUps, isLoading: followUpsLoading } = trpc.health.followUps.useQuery({
    organizationId: ORGANIZATION_ID,
  });
  const { data: insights, isLoading: insightsLoading } = trpc.aiInsights.list.useQuery({
    organizationId: ORGANIZATION_ID,
  });
  const { data: documents, isLoading: documentsLoading } = trpc.digitalDocuments.list.useQuery(ORGANIZATION_ID);
  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID);
  const { data: certifications, isLoading: certsLoading } = trpc.staffOps.certifications.useQuery(ORGANIZATION_ID);
  const { data: absenceSummary } = trpc.chronicAbsence.summary.useQuery(
    { organizationId: ORGANIZATION_ID },
    { enabled: hasHeadStart }
  );

  const isLoading = followUpsLoading || insightsLoading || documentsLoading || certsLoading;

  const items = useMemo<QueueItem[]>(() => {
    const out: QueueItem[] = [];

    // Health follow-ups: overdue and due-soon screenings/immunizations.
    for (const fu of followUps ?? []) {
      out.push({
        id: `health-${fu.recordId}`,
        title: `${formatTypeLabel(fu.type)} follow-up — ${fu.childName}`,
        owner: fu.childName,
        area: "Health",
        due:
          fu.severity === "overdue"
            ? `Overdue (was due ${formatDate(fu.expiryDate)})`
            : `Due ${formatDate(fu.expiryDate)} (${fu.daysUntilDue} days)`,
        status: fu.severity === "overdue" ? "urgent" : "pending",
        detail: fu.message || `${formatTypeLabel(fu.type)} record needs attention before the compliance cutoff.`,
        href: "/health",
      });
    }

    // AI insights flagged as requiring action.
    for (const ins of insights ?? []) {
      if (ins.actionRequired !== 1) continue;
      out.push({
        id: `insight-${ins.id}`,
        title: ins.title,
        owner: ins.childName ?? "Program-wide",
        area: "AI Insight",
        due: `Flagged ${formatDate(ins.generatedAt)}`,
        status: ins.priority === "critical" || ins.priority === "high" ? "urgent" : "pending",
        detail: ins.content,
        insightId: ins.id,
      });
    }

    // Digital documents: pending or expired signatures; signed show as completed.
    const familyById = new Map((families ?? []).map((f) => [f.id, f]));
    for (const doc of documents ?? []) {
      const familyName = familyById.get(doc.familyId)?.primaryContactName ?? `Family #${doc.familyId}`;
      if (doc.status === "pending" || doc.status === "expired") {
        out.push({
          id: `doc-${doc.id}`,
          title: `${formatTypeLabel(doc.documentType)} signature ${doc.status === "expired" ? "expired" : "needed"} — ${familyName}`,
          owner: familyName,
          area: "Documents",
          due: doc.expiresAt ? `Expires ${formatDate(doc.expiresAt)}` : "No expiration",
          status: doc.status === "expired" ? "urgent" : "pending",
          detail:
            doc.status === "expired"
              ? `The ${formatTypeLabel(doc.documentType)} document expired and must be re-sent for signature.`
              : `The ${formatTypeLabel(doc.documentType)} document is awaiting a signature from ${familyName}.`,
          href: "/digital-documents",
        });
      } else if (doc.status === "signed") {
        out.push({
          id: `doc-${doc.id}`,
          title: `${formatTypeLabel(doc.documentType)} signed — ${familyName}`,
          owner: familyName,
          area: "Documents",
          due: doc.signedBy ? `Signed by ${doc.signedBy}` : "Signed",
          status: "completed",
          detail: `The ${formatTypeLabel(doc.documentType)} document has been completed.`,
          href: "/digital-documents",
        });
      }
    }

    // Staff certifications: expired or expiring within 60 days need renewal.
    for (const cert of certifications ?? []) {
      if (cert.status === "active") continue;
      out.push({
        id: `cert-${cert.id}`,
        title: `${cert.certificationType} ${cert.status === "expired" ? "expired" : "expiring soon"} — ${cert.staffName}`,
        owner: cert.staffName,
        area: "Staff",
        due:
          cert.status === "expired"
            ? `Expired ${formatDate(cert.expiryDate)}`
            : `Expires ${formatDate(cert.expiryDate)}`,
        status: cert.status === "expired" ? "urgent" : "pending",
        detail:
          cert.status === "expired"
            ? `${cert.staffName}'s ${cert.certificationType} certification has expired and needs renewal.`
            : `${cert.staffName}'s ${cert.certificationType} certification expires soon — renew before it lapses.`,
        href: "/staff-operations",
      });
    }

    // Chronic absence: children below the 85% benchmark (Head Start module).
    for (const alert of absenceSummary?.alerts ?? []) {
      out.push({
        id: `absence-${alert.childId}`,
        title: `${RISK_LABELS[alert.riskLevel] ?? "At risk"} attendance — ${alert.childName}`,
        owner: alert.childName,
        area: "Attendance",
        due: alert.lastAbsence ? `Last absence ${formatDate(alert.lastAbsence)}` : "Ongoing",
        status: alert.riskLevel === "severe" || alert.riskLevel === "high" ? "urgent" : "pending",
        detail: `${alert.childName} attended ${alert.attendanceRate}% over the last ${absenceSummary?.windowDays ?? 30} days (${alert.absentDays} absences). Reach out to ${alert.familyName || "the family"} before the pattern sets in.`,
        href: "/chronic-absence",
      });
    }

    const rank: Record<QueueStatus, number> = { urgent: 0, pending: 1, completed: 2 };
    return out.sort((a, b) => rank[a.status] - rank[b.status]);
  }, [followUps, insights, documents, families, certifications, absenceSummary]);

  return { items, isLoading };
}
