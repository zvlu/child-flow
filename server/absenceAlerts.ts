/**
 * Chronic-absence threshold notifications (HANDOFF next-step #4).
 *
 * After attendance is saved we recompute the org's chronic-absence summary;
 * any child newly at severe/high risk gets (a) an AI-insight record — which
 * surfaces in the dashboard's "Needs Attention Today" card and the Action
 * Queue via useActionItems — and (b) a push notification to the org's staff
 * devices. The undismissed insight doubles as the dedupe marker, so a child
 * is flagged once per episode rather than on every attendance save; staff
 * dismissing the insight re-arms the alert.
 */
import { getChronicAbsenceSummary } from "./chronicAbsence";
import { getAiInsights, createAiInsight, getDeviceTokensForOrgStaff } from "./moduleDb";
import { sendPushToTokens } from "./_core/push";

const ALERT_TITLE_PREFIX = "Chronic absence risk";

export async function checkChronicAbsenceAlerts(organizationId: number): Promise<{ created: number }> {
  const summary = await getChronicAbsenceSummary(organizationId);
  const serious = summary.alerts.filter((a) => a.riskLevel === "severe" || a.riskLevel === "high");
  if (serious.length === 0) return { created: 0 };

  // Children already carrying an undismissed absence flag don't re-alert.
  const existing = await getAiInsights(organizationId);
  const alreadyFlagged = new Set(
    existing
      .filter((i) => i.insightType === "compliance_flag" && i.title.startsWith(ALERT_TITLE_PREFIX))
      .map((i) => i.childId)
  );

  const fresh = serious.filter((a) => !alreadyFlagged.has(a.childId));
  if (fresh.length === 0) return { created: 0 };

  for (const alert of fresh) {
    await createAiInsight({
      childId: alert.childId,
      organizationId,
      insightType: "compliance_flag",
      title: `${ALERT_TITLE_PREFIX} — ${alert.childName}`,
      content:
        `${alert.childName}'s attendance is ${alert.attendanceRate}% over the last ${summary.windowDays} days ` +
        `(${alert.absentDays} absences), below the 85% benchmark (§1302.16). ` +
        `Reach out to ${alert.familyName || "the family"} and consider an attendance improvement plan.`,
      priority: alert.riskLevel === "severe" ? "critical" : "high",
      actionRequired: 1,
    });
  }

  // One push per save, not one per child — nobody wants six buzzes at drop-off.
  try {
    const tokens = await getDeviceTokensForOrgStaff(organizationId);
    const body =
      fresh.length === 1
        ? `${fresh[0].childName} fell to ${fresh[0].attendanceRate}% attendance — below the 85% benchmark.`
        : `${fresh.length} children crossed the chronic-absence threshold and need outreach.`;
    await sendPushToTokens(tokens, "Chronic absence alert", body, { type: "chronic_absence" });
  } catch (e) {
    console.warn("[AbsenceAlerts] push failed:", e);
  }

  return { created: fresh.length };
}
