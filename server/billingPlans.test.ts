import { beforeEach, describe, expect, it, vi } from "vitest";
import { billingPlans, invoices } from "../drizzle/schema";
import { generateDueInvoices, getArAging } from "./billingPlans";

/** Fake drizzle db: select returns per-table seeds; insert/update are recorded. */
let planRows: Record<string, any>[] = [];
let invoiceRows: Record<string, any>[] = [];
const inserted: { table: unknown; row: Record<string, any> }[] = [];
const updated: { table: unknown; set: Record<string, any> }[] = [];

const fakeDb = {
  select: () => ({
    from: (table: unknown) => ({
      where: () => Promise.resolve(table === billingPlans ? planRows : invoiceRows),
    }),
  }),
  insert: (table: unknown) => ({
    values: (row: Record<string, any>) => {
      inserted.push({ table, row });
      return Promise.resolve([{ insertId: 1 }]);
    },
  }),
  update: (table: unknown) => ({
    set: (set: Record<string, any>) => ({
      where: () => {
        updated.push({ table, set });
        return Promise.resolve();
      },
    }),
  }),
};

vi.mock("./db", () => ({ getDb: () => Promise.resolve(fakeDb) }));

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

describe("generateDueInvoices", () => {
  beforeEach(() => {
    planRows = [];
    invoiceRows = [];
    inserted.length = 0;
    updated.length = 0;
  });

  it("creates one invoice per missed period and advances the plan date", async () => {
    // Monthly plan ~2 months behind → 3 invoices (start month + 2 catch-ups).
    planRows = [{ id: 5, organizationId: 1, familyId: 2, amount: "850.00", frequency: "monthly", nextInvoiceDate: daysAgo(65), isActive: 1, name: "Full-day tuition" }];
    const result = await generateDueInvoices(1);

    expect(result.plansProcessed).toBe(1);
    expect(result.created).toBe(3);
    const invoiceInserts = inserted.filter((i) => i.table === invoices);
    expect(invoiceInserts).toHaveLength(3);
    for (const i of invoiceInserts) {
      expect(i.row.familyId).toBe(2);
      expect(i.row.amount).toBe("850.00");
      expect(i.row.status).toBe("sent");
      expect(i.row.invoiceNumber).toMatch(/^INV-\d{8}-P5/);
    }
    // Plan advanced into the future → next run creates nothing.
    const planUpdate = updated.find((u) => u.table === billingPlans)!;
    expect(new Date(planUpdate.set.nextInvoiceDate).getTime()).toBeGreaterThan(Date.now() - 86_400_000);
  });

  it("creates nothing when no plans are due", async () => {
    planRows = []; // the where() clause filters out future-dated plans in real drizzle
    const result = await generateDueInvoices(1);
    expect(result.created).toBe(0);
    expect(inserted).toHaveLength(0);
  });
});

describe("getArAging", () => {
  beforeEach(() => {
    invoiceRows = [];
  });

  it("buckets open invoices by days past due and ignores paid/cancelled", async () => {
    invoiceRows = [
      { familyId: 1, amount: "100.00", status: "sent", dueDate: daysAgo(-5) },   // not yet due → current
      { familyId: 1, amount: "200.00", status: "sent", dueDate: daysAgo(10) },   // 1–30
      { familyId: 2, amount: "300.00", status: "overdue", dueDate: daysAgo(45) }, // 31–60
      { familyId: 3, amount: "400.00", status: "overdue", dueDate: daysAgo(90) }, // 60+
      { familyId: 4, amount: "999.00", status: "paid", dueDate: daysAgo(90) },   // ignored
      { familyId: 5, amount: "999.00", status: "cancelled", dueDate: daysAgo(90) }, // ignored
    ];
    const aging = await getArAging(1);
    expect(aging.current).toBe(100);
    expect(aging.d1to30).toBe(200);
    expect(aging.d31to60).toBe(300);
    expect(aging.d60plus).toBe(400);
    expect(aging.totalOutstanding).toBe(1000);
    expect(aging.overdueFamilies).toBe(3);
  });
});
