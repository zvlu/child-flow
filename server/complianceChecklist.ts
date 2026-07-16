import { and, eq } from "drizzle-orm";
import { complianceChecklistItems } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Generic program-monitoring checklist — shared backing for the web
 * Compliance page's "Program Monitoring Checklist" tab and the iOS
 * Compliance screen's MonitoringChecklistView. Both were previously
 * hardcoded local state with a comment noting "no server model for this
 * checklist yet" (see client/src/pages/Compliance.tsx).
 *
 * The six items below were the hardcoded fixtures both screens shipped
 * with; they're now just the seed/default set an org sees before anyone
 * has reviewed anything (unlike the old mock data, they start
 * *unreviewed* — no isCompliant/reviewedAt — rather than fabricating a
 * fake "already compliant" history).
 */

export interface ChecklistItemDefault {
  itemKey: string;
  label: string;
  category: string;
}

export const DEFAULT_CHECKLIST_ITEMS: ChecklistItemDefault[] = [
  { itemKey: "child_staff_ratio", label: "Child-to-Staff Ratio", category: "Health & Safety" },
  { itemKey: "health_safety_checks", label: "Health & Safety Checks", category: "Health & Safety" },
  { itemKey: "fiscal_management", label: "Fiscal Management", category: "Governance" },
  { itemKey: "program_governance", label: "Program Governance", category: "Governance" },
  { itemKey: "transportation_safety", label: "Transportation Safety", category: "Health & Safety" },
  { itemKey: "food_service", label: "Food Service", category: "Health & Safety" },
];

export interface ChecklistItemView {
  itemKey: string;
  label: string;
  category: string;
  isCompliant: boolean;
  note: string | null;
  reviewedAt: string | null; // ISO, or null if never reviewed
  reviewedBy: number | null;
}

export async function listChecklistItems(organizationId: number): Promise<ChecklistItemView[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select()
    .from(complianceChecklistItems)
    .where(eq(complianceChecklistItems.organizationId, organizationId));

  const byKey = new Map(rows.map((r) => [r.itemKey, r]));

  return DEFAULT_CHECKLIST_ITEMS.map((def) => {
    const row = byKey.get(def.itemKey);
    return {
      itemKey: def.itemKey,
      label: def.label,
      category: def.category,
      isCompliant: !!row?.isCompliant,
      note: row?.note ?? null,
      reviewedAt: row?.reviewedAt ? row.reviewedAt.toISOString() : null,
      reviewedBy: row?.reviewedBy ?? null,
    };
  });
}

export async function markChecklistItemReviewed(
  organizationId: number,
  itemKey: string,
  reviewedBy: number | null,
  note?: string | null
): Promise<ChecklistItemView> {
  const def = DEFAULT_CHECKLIST_ITEMS.find((d) => d.itemKey === itemKey);
  if (!def) throw new Error(`Unknown checklist item: ${itemKey}`);

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select({ id: complianceChecklistItems.id })
    .from(complianceChecklistItems)
    .where(and(eq(complianceChecklistItems.organizationId, organizationId), eq(complianceChecklistItems.itemKey, itemKey)));

  const now = new Date();
  if (existing.length > 0) {
    await db
      .update(complianceChecklistItems)
      .set({ isCompliant: 1, note: note ?? null, reviewedBy: reviewedBy ?? undefined, reviewedAt: now })
      .where(eq(complianceChecklistItems.id, existing[0].id));
  } else {
    await db.insert(complianceChecklistItems).values({
      organizationId,
      itemKey,
      label: def.label,
      category: def.category,
      isCompliant: 1,
      note: note ?? null,
      reviewedBy: reviewedBy ?? undefined,
      reviewedAt: now,
    });
  }

  const items = await listChecklistItems(organizationId);
  return items.find((i) => i.itemKey === itemKey)!;
}
