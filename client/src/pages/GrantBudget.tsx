import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PiggyBank, Loader2, Plus, CheckCircle2, AlertTriangle, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { dateInputToLocal } from "@/lib/date";

const CATEGORY_LABELS: Record<string, string> = {
  education: "Education & Child Development",
  health: "Health & Nutrition",
  disability_services: "Disability Services",
  family_services: "Family & Community Services",
  program_management: "Program Management",
  transportation: "Transportation",
  facilities: "Facilities",
  tta: "Training & Technical Assistance",
  other: "Other",
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function fiscalYears(): string[] {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return [0, 1, 2].map((o) => `${start - o}-${start - o + 1}`);
}

export default function GrantBudget() {
  const years = useMemo(() => fiscalYears(), []);
  const [year, setYear] = useState(years[0]);
  const [showBudget, setShowBudget] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  const utils = trpc.useUtils();
  const summaryQuery = trpc.grantBudget.summary.useQuery({ organizationId: ORGANIZATION_ID, fiscalYear: year });
  const s = summaryQuery.data;
  const refresh = () => utils.grantBudget.summary.invalidate();

  const matchOk = (s?.matchPct ?? 0) >= 20;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PiggyBank className="h-6 w-6 text-primary" />
            Grant & Budget
          </h1>
          <p className="text-sm text-muted-foreground">
            Burn rate by Head Start cost category, the 20% non-federal share, and carryover — out of the spreadsheet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowBudget(true)}>
            <Pencil className="h-4 w-4" />Set Budget
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setShowExpense(true)}>
            <Plus className="h-4 w-4" />Add Expense
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved budget</CardDescription>
            <CardTitle className="text-2xl">{s ? money(s.totalBudgetCents) : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Fiscal year {year}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Spent · burn rate</CardDescription>
            <CardTitle className={`text-2xl ${(s?.burnPct ?? 0) > 100 ? "text-red-600" : ""}`}>
              {s ? `${money(s.totalSpentCents)} · ${s.burnPct}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent><Progress value={Math.min(100, s?.burnPct ?? 0)} className="h-1.5" /></CardContent>
        </Card>
        <Card className={s && !matchOk ? "border-orange-200" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              {matchOk ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-orange-500" />}
              Non-federal share
            </CardDescription>
            <CardTitle className={`text-2xl ${matchOk ? "text-green-600" : "text-orange-600"}`}>
              {s ? `${s.matchPct}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {s ? `${money(s.nonFederalShareCents)} match + in-kind · target ≥ 20%` : "Includes In-Kind contributions"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Carryover estimate</CardDescription>
            <CardTitle className="text-2xl">{s ? money(s.carryoverEstimateCents) : "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Unspent budget at current pace</CardContent>
        </Card>
      </div>

      {/* Category table */}
      {summaryQuery.isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (s?.categories.length ?? 0) === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No budget set for {year}. Click "Set Budget" to enter your approved amounts by cost category.
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Spending by category</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {s!.categories.map((c) => (
              <div key={c.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{CATEGORY_LABELS[c.category] ?? c.category}</span>
                  <span className={`text-xs font-medium ${c.pct > 100 ? "text-red-600" : "text-muted-foreground"}`}>
                    {money(c.spentCents)} / {money(c.budgetedCents)}
                    {c.budgetedCents > 0 && ` · ${c.pct}%`}
                    {c.pct > 100 && " — over budget"}
                  </span>
                </div>
                <Progress value={Math.min(100, c.pct)} className={`h-2 ${c.pct > 100 ? "[&>div]:bg-red-500" : c.pct > 85 ? "[&>div]:bg-orange-500" : ""}`} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent expenses */}
      {(s?.recentExpenses.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent expenses</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border">
            {s!.recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[e.category] ?? e.category} · {new Date(e.expenseDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {e.nonFederalShare === 1 && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-[10px]">match</Badge>
                  )}
                  <span className="font-medium">{money(e.amountCents)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {showBudget && (
        <BudgetDialog year={year} current={s?.categories ?? []} onClose={(c) => { setShowBudget(false); if (c) refresh(); }} />
      )}
      {showExpense && (
        <ExpenseDialog year={year} onClose={(c) => { setShowExpense(false); if (c) refresh(); }} />
      )}
    </div>
  );
}

function BudgetDialog({
  year, current, onClose,
}: {
  year: string;
  current: Array<{ category: string; budgetedCents: number }>;
  onClose: (changed: boolean) => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(current.map((c) => [c.category, String(c.budgetedCents / 100)]))
  );
  const setLineMut = trpc.grantBudget.setBudgetLine.useMutation();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      for (const [category, raw] of Object.entries(amounts)) {
        const dollars = Number(raw.replace(/[^0-9.]/g, ""));
        if (raw !== "" && !Number.isNaN(dollars)) {
          await setLineMut.mutateAsync({
            organizationId: ORGANIZATION_ID,
            fiscalYear: year,
            category: category as any,
            budgetedCents: Math.round(dollars * 100),
          });
        }
      }
      toast.success(`Budget saved for ${year}`);
      onClose(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Approved Budget — {year}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
            <div key={cat} className="flex items-center justify-between gap-3">
              <Label className="text-sm font-normal">{label}</Label>
              <div className="relative w-32">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input
                  inputMode="decimal"
                  className="pl-6 h-8 text-sm text-right"
                  value={amounts[cat] ?? ""}
                  onChange={(e) => setAmounts((p) => ({ ...p, [cat]: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save Budget
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({ year, onClose }: { year: string; onClose: (changed: boolean) => void }) {
  const [category, setCategory] = useState("education");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isMatch, setIsMatch] = useState(false);

  const addMut = trpc.grantBudget.addExpense.useMutation({
    onSuccess: () => { toast.success("Expense recorded"); onClose(true); },
    onError: (e) => toast.error(e.message),
  });

  const save = () => {
    const dollars = Number(amount.replace(/[^0-9.]/g, ""));
    if (!description.trim() || Number.isNaN(dollars) || dollars <= 0) {
      toast.error("Description and a valid amount are required.");
      return;
    }
    addMut.mutate({
      organizationId: ORGANIZATION_ID,
      fiscalYear: year,
      category: category as any,
      description: description.trim(),
      amountCents: Math.round(dollars * 100),
      expenseDate: dateInputToLocal(date) ?? new Date(),
      nonFederalShare: isMatch,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Expense — {year}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Classroom materials — Room 2" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <Input inputMode="decimal" className="pl-6" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <Button type="button" variant={isMatch ? "default" : "outline"} onClick={() => setIsMatch(!isMatch)} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />{isMatch ? "Non-federal match ✓" : "Count as match?"}
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button onClick={save} disabled={addMut.isPending} className="gap-2">
              {addMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save Expense
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
