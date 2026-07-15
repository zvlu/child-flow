import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { clientIpFromReq } from "./_core/audit";
import { userHasModule } from "./_core/modules";
import { insertAuditLog } from "./db";
import { getGrantSummary, setBudgetLine, addExpense, GRANT_CATEGORIES, type GrantCategory } from "./grantBudget";
import type { User } from "../drizzle/schema";

/**
 * REST backing for the native iOS staff app's GrantBudgetView.swift screen
 * (Head Start grant burn-rate / 20% non-federal match tracking, roadmap
 * #12). Reuses the business logic already implemented in grantBudget.ts —
 * this file is purely the HTTP + auth/gating layer, same split as
 * erseaRest.ts / familyCaseManagementRest.ts.
 *
 * Head-Start gated: role check + org membership + `head_start` module check,
 * 401 if any fail (same pattern as erseaRest.ts's requireStaff).
 *
 * Money convention: every `*Cents` field in the JSON stays an integer number
 * of cents (matches grantBudget.ts's in-process types exactly — no
 * dollar conversion happens in this file). The iOS GrantSummary struct
 * mirrors this and divides by 100 only at render time.
 *
 *   GET  /api/grants/summary?fiscalYear=2025-2026   full budget/burn summary
 *   POST /api/grants/budget-line                    upsert a budget line
 *   POST /api/grants/expenses                        record a new expense
 */

async function requireStaff(req: Request): Promise<User | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin" && user.role !== "staff") return null;
    return (await userHasModule(user, "head_start")) ? user : null;
  } catch {
    return null;
  }
}

function reject(res: Response, status: number, error: string) {
  res.status(status).json({ error });
}

function isValidFiscalYear(fy: unknown): fy is string {
  return typeof fy === "string" && /^\d{4}-\d{4}$/.test(fy);
}

function isGrantCategory(c: unknown): c is GrantCategory {
  return typeof c === "string" && (GRANT_CATEGORIES as readonly string[]).includes(c);
}

export function registerGrantBudgetRoutes(app: Express) {
  app.get("/api/grants/summary", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");

    const fiscalYear = req.query.fiscalYear;
    if (!isValidFiscalYear(fiscalYear)) {
      return reject(res, 400, "fiscalYear is required, e.g. 2025-2026");
    }

    try {
      const summary = await getGrantSummary(orgId, fiscalYear);
      // Reshape recentExpenses into the iOS-friendly form (string id, boolean
      // flag) — same id-stringification convention as eligibilityToIos /
      // suspensionToIos in erseaRest.ts. Everything else in GrantSummary is
      // already a plain number/string and passes through unchanged.
      res.json({
        ...summary,
        recentExpenses: summary.recentExpenses.map((e) => ({
          id: String(e.id),
          fiscalYear: e.fiscalYear,
          category: e.category,
          description: e.description,
          amountCents: e.amountCents,
          expenseDate: e.expenseDate,
          nonFederalShare: e.nonFederalShare === 1,
        })),
      });
    } catch (e) {
      reject(res, 500, e instanceof Error ? e.message : "Failed to load grant summary");
    }
  });

  app.post("/api/grants/budget-line", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");

    const fiscalYear = req.body?.fiscalYear;
    const category = req.body?.category;
    const budgetedCents = Number(req.body?.budgetedCents);
    if (!isValidFiscalYear(fiscalYear)) {
      return reject(res, 400, "fiscalYear is required, e.g. 2025-2026");
    }
    if (!isGrantCategory(category)) {
      return reject(res, 400, "Invalid category");
    }
    if (!Number.isFinite(budgetedCents) || budgetedCents < 0) {
      return reject(res, 400, "budgetedCents must be a non-negative number");
    }

    try {
      await setBudgetLine({ organizationId: orgId, fiscalYear, category, budgetedCents: Math.round(budgetedCents) });
    } catch (e) {
      return reject(res, 500, e instanceof Error ? e.message : "Failed to save budget line");
    }

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "update",
      resourceType: "grant_budget_line",
      resourceId: `${fiscalYear}:${category}`,
      ipAddress: clientIpFromReq(req),
      detail: `set ${category} budget to ${budgetedCents} cents for FY ${fiscalYear}`,
    });
    res.json({ success: true });
  });

  app.post("/api/grants/expenses", async (req: Request, res: Response) => {
    const user = await requireStaff(req);
    if (!user) return reject(res, 401, "Please sign in again");
    const orgId = user.organizationId;
    if (orgId == null) return reject(res, 400, "No organization");

    const fiscalYear = req.body?.fiscalYear;
    const category = req.body?.category;
    const description = String(req.body?.description ?? "").trim();
    const amountCents = Number(req.body?.amountCents);
    const expenseDate = req.body?.expenseDate ? new Date(req.body.expenseDate) : null;
    const nonFederalShare = Boolean(req.body?.nonFederalShare);

    if (!isValidFiscalYear(fiscalYear)) {
      return reject(res, 400, "fiscalYear is required, e.g. 2025-2026");
    }
    if (!isGrantCategory(category)) {
      return reject(res, 400, "Invalid category");
    }
    if (!description) {
      return reject(res, 400, "description is required");
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return reject(res, 400, "amountCents must be a positive number");
    }
    if (!expenseDate || Number.isNaN(expenseDate.getTime())) {
      return reject(res, 400, "Invalid expenseDate");
    }

    let created: { id: number };
    try {
      created = await addExpense({
        organizationId: orgId,
        fiscalYear,
        category,
        description,
        amountCents: Math.round(amountCents),
        expenseDate,
        nonFederalShare,
      });
    } catch (e) {
      return reject(res, 500, e instanceof Error ? e.message : "Failed to record expense");
    }

    await insertAuditLog({
      userId: user.id,
      actorOpenId: user.openId,
      action: "create",
      resourceType: "grant_expense",
      resourceId: String(created.id),
      ipAddress: clientIpFromReq(req),
      detail: `${category} expense of ${amountCents} cents for FY ${fiscalYear}`,
    });
    res.json({ success: true });
  });
}
