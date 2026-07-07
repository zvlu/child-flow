import { and, eq } from "drizzle-orm";
import {
  grantBudgetLines,
  grantExpenses,
  inKindContributions,
  type GrantExpense,
} from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Grant & budget compliance (roadmap #12).
 * Burn rate per Head Start cost category, the 20% non-federal share, and a
 * simple carryover estimate — the things programs currently do in spreadsheets.
 */

export const GRANT_CATEGORIES = [
  "education", "health", "disability_services", "family_services",
  "program_management", "transportation", "facilities", "tta", "other",
] as const;
export type GrantCategory = (typeof GRANT_CATEGORIES)[number];

export interface CategorySummary {
  category: GrantCategory;
  budgetedCents: number;
  spentCents: number;
  pct: number; // 0–100+ (over-budget goes past 100)
}

export interface GrantSummary {
  fiscalYear: string;
  totalBudgetCents: number;
  totalSpentCents: number;
  burnPct: number;
  /** Federal spend (non-match) — the base the 20% match is computed against. */
  federalSpendCents: number;
  nonFederalShareCents: number; // match expenses + in-kind value
  matchPct: number; // non-federal share as % of total (target ≥ 20)
  carryoverEstimateCents: number;
  categories: CategorySummary[];
  recentExpenses: Array<GrantExpense & {}>;
}

/** Fiscal-year window matching the "YYYY-YYYY" program-year label. */
function fiscalYearRange(fiscalYear: string): { start: Date; end: Date } {
  const startYear = Number(fiscalYear.slice(0, 4)) || new Date().getFullYear();
  return {
    start: new Date(startYear, 8, 1), // Sep 1
    end: new Date(startYear + 1, 7, 31, 23, 59, 59), // Aug 31
  };
}

export async function getGrantSummary(
  organizationId: number,
  fiscalYear: string
): Promise<GrantSummary> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [lines, expenses, inKind] = await Promise.all([
    db
      .select()
      .from(grantBudgetLines)
      .where(and(eq(grantBudgetLines.organizationId, organizationId), eq(grantBudgetLines.fiscalYear, fiscalYear))),
    db
      .select()
      .from(grantExpenses)
      .where(and(eq(grantExpenses.organizationId, organizationId), eq(grantExpenses.fiscalYear, fiscalYear))),
    db
      .select({ value: inKindContributions.value, date: inKindContributions.date })
      .from(inKindContributions)
      .where(eq(inKindContributions.organizationId, organizationId)),
  ]);

  const budgetByCat = new Map<string, number>();
  for (const l of lines) {
    budgetByCat.set(l.category, (budgetByCat.get(l.category) ?? 0) + l.budgetedCents);
  }
  const spentByCat = new Map<string, number>();
  let matchExpenseCents = 0;
  let federalSpendCents = 0;
  for (const e of expenses) {
    spentByCat.set(e.category, (spentByCat.get(e.category) ?? 0) + e.amountCents);
    if (e.nonFederalShare === 1) matchExpenseCents += e.amountCents;
    else federalSpendCents += e.amountCents;
  }

  // In-kind contributions inside the fiscal-year window count toward match.
  const { start, end } = fiscalYearRange(fiscalYear);
  const inKindCents = inKind
    .filter((k) => k.date >= start && k.date <= end)
    .reduce((acc, k) => acc + Math.round(Number(k.value) * 100), 0);

  const categories: CategorySummary[] = GRANT_CATEGORIES.map((category) => {
    const budgetedCents = budgetByCat.get(category) ?? 0;
    const spentCents = spentByCat.get(category) ?? 0;
    return {
      category,
      budgetedCents,
      spentCents,
      pct: budgetedCents > 0 ? Math.round((spentCents / budgetedCents) * 100) : spentCents > 0 ? 999 : 0,
    };
  }).filter((c) => c.budgetedCents > 0 || c.spentCents > 0);

  const totalBudgetCents = lines.reduce((acc, l) => acc + l.budgetedCents, 0);
  const totalSpentCents = expenses.reduce((acc, e) => acc + e.amountCents, 0);
  const nonFederalShareCents = matchExpenseCents + inKindCents;
  // §75.306: non-federal share must be ≥ 20% of TOTAL project cost
  // (federal + match). Equivalent check: match / total ≥ 20%.
  const totalProject = federalSpendCents + nonFederalShareCents;

  return {
    fiscalYear,
    totalBudgetCents,
    totalSpentCents,
    burnPct: totalBudgetCents > 0 ? Math.round((totalSpentCents / totalBudgetCents) * 100) : 0,
    federalSpendCents,
    nonFederalShareCents,
    matchPct: totalProject > 0 ? Math.round((nonFederalShareCents / totalProject) * 100) : 0,
    carryoverEstimateCents: Math.max(0, totalBudgetCents - totalSpentCents),
    categories,
    recentExpenses: expenses
      .sort((a, b) => b.expenseDate.getTime() - a.expenseDate.getTime())
      .slice(0, 15),
  };
}

export async function setBudgetLine(input: {
  organizationId: number;
  fiscalYear: string;
  category: GrantCategory;
  budgetedCents: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [existing] = await db
    .select({ id: grantBudgetLines.id })
    .from(grantBudgetLines)
    .where(
      and(
        eq(grantBudgetLines.organizationId, input.organizationId),
        eq(grantBudgetLines.fiscalYear, input.fiscalYear),
        eq(grantBudgetLines.category, input.category)
      )
    )
    .limit(1);
  if (existing) {
    await db
      .update(grantBudgetLines)
      .set({ budgetedCents: input.budgetedCents })
      .where(eq(grantBudgetLines.id, existing.id));
  } else {
    await db.insert(grantBudgetLines).values(input);
  }
}

export async function addExpense(input: {
  organizationId: number;
  fiscalYear: string;
  category: GrantCategory;
  description: string;
  amountCents: number;
  expenseDate: Date;
  nonFederalShare: boolean;
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(grantExpenses).values({
    organizationId: input.organizationId,
    fiscalYear: input.fiscalYear,
    category: input.category,
    description: input.description,
    amountCents: input.amountCents,
    expenseDate: input.expenseDate,
    nonFederalShare: input.nonFederalShare ? 1 : 0,
  });
  return { id: result.insertId };
}
