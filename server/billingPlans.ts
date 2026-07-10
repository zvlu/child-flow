/**
 * Recurring tuition: plans that auto-generate invoices, plus the AR aging
 * summary. Generation is idempotent — each run creates invoices only for
 * plans whose nextInvoiceDate has arrived, then advances that date one
 * period, so the button (or a future cron) can run any number of times.
 */
import { and, eq, lte } from "drizzle-orm";
import { billingPlans, invoices, type BillingPlan, type InsertBillingPlan } from "../drizzle/schema";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

export async function getBillingPlans(organizationId: number) {
  const db = await requireDb();
  return db.select().from(billingPlans).where(eq(billingPlans.organizationId, organizationId)).orderBy(billingPlans.name);
}

export async function createBillingPlan(data: InsertBillingPlan) {
  const db = await requireDb();
  const [result] = await db.insert(billingPlans).values(data);
  return { id: result.insertId };
}

export async function setBillingPlanActive(id: number, organizationId: number, isActive: boolean) {
  const db = await requireDb();
  await db
    .update(billingPlans)
    .set({ isActive: isActive ? 1 : 0 })
    .where(and(eq(billingPlans.id, id), eq(billingPlans.organizationId, organizationId)));
  return { id };
}

function advance(date: Date, frequency: BillingPlan["frequency"]): Date {
  const next = new Date(date);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "biweekly") next.setDate(next.getDate() + 14);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

const dateStr = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Generate invoices for every active plan that has come due. Plans more than
 * one period behind generate one invoice per missed period (capped at 12 to
 * bound a pathological backlog).
 */
export async function generateDueInvoices(organizationId: number) {
  const db = await requireDb();
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const due = await db
    .select()
    .from(billingPlans)
    .where(and(
      eq(billingPlans.organizationId, organizationId),
      eq(billingPlans.isActive, 1),
      lte(billingPlans.nextInvoiceDate, today),
    ));

  let created = 0;
  for (const plan of due) {
    let cursor = new Date(plan.nextInvoiceDate);
    let guard = 0;
    while (cursor <= today && guard < 12) {
      const dueDate = new Date(cursor);
      dueDate.setDate(dueDate.getDate() + 7); // one week to pay
      await db.insert(invoices).values({
        organizationId,
        familyId: plan.familyId,
        invoiceNumber: `INV-${dateStr(cursor).replace(/-/g, "")}-P${plan.id}${guard ? `-${guard}` : ""}`,
        amount: plan.amount,
        dueDate,
        status: "sent",
        description: `${plan.name} — ${plan.frequency} tuition (period starting ${dateStr(cursor)})`,
      });
      created++;
      guard++;
      cursor = advance(cursor, plan.frequency);
    }
    await db
      .update(billingPlans)
      .set({ nextInvoiceDate: cursor })
      .where(eq(billingPlans.id, plan.id));
  }

  return { created, plansProcessed: due.length };
}

export type ArAging = {
  current: number;
  d1to30: number;
  d31to60: number;
  d60plus: number;
  totalOutstanding: number;
  overdueFamilies: number;
};

/** Outstanding receivables bucketed by days past due. */
export async function getArAging(organizationId: number): Promise<ArAging> {
  const db = await requireDb();
  const rows = await db.select().from(invoices).where(eq(invoices.organizationId, organizationId));
  const open = rows.filter((r) => r.status === "sent" || r.status === "overdue");

  const now = Date.now();
  const aging: ArAging = { current: 0, d1to30: 0, d31to60: 0, d60plus: 0, totalOutstanding: 0, overdueFamilies: 0 };
  const overdueFams = new Set<number>();

  for (const inv of open) {
    const amount = Number(inv.amount) || 0;
    const daysPast = Math.floor((now - new Date(inv.dueDate).getTime()) / 86_400_000);
    aging.totalOutstanding += amount;
    if (daysPast <= 0) aging.current += amount;
    else if (daysPast <= 30) { aging.d1to30 += amount; overdueFams.add(inv.familyId); }
    else if (daysPast <= 60) { aging.d31to60 += amount; overdueFams.add(inv.familyId); }
    else { aging.d60plus += amount; overdueFams.add(inv.familyId); }
  }
  aging.overdueFamilies = overdueFams.size;
  return aging;
}
