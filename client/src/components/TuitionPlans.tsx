import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";

const FREQ_LABEL: Record<string, string> = { weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly" };

function money(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isNaN(n) ? "$0.00" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** AR aging buckets — how much is outstanding and how stale it is. */
export function ArAgingCards() {
  const { data } = trpc.billing.aging.useQuery(ORGANIZATION_ID);
  if (!data || data.totalOutstanding === 0) return null;
  const buckets = [
    { label: "Current", value: data.current, tone: "text-foreground" },
    { label: "1–30 days late", value: data.d1to30, tone: "text-amber-600" },
    { label: "31–60 days late", value: data.d31to60, tone: "text-orange-600" },
    { label: "60+ days late", value: data.d60plus, tone: "text-red-600" },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Outstanding Balances</CardTitle>
        <CardDescription>
          {money(data.totalOutstanding)} receivable · {data.overdueFamilies} famil{data.overdueFamilies === 1 ? "y" : "ies"} past due
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {buckets.map((b) => (
          <div key={b.label} className="rounded-lg border border-border p-3">
            <p className={`text-xl font-bold ${b.tone}`}>{money(b.value)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{b.label}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Recurring tuition plans: set the rate once, invoices generate themselves.
 * "Generate due invoices" is idempotent (safe to click daily — or wire to a
 * schedule later).
 */
export function TuitionPlans({ isAdmin }: { isAdmin: boolean }) {
  const utils = trpc.useUtils();
  const { data: plans, isLoading } = trpc.billing.plans.useQuery(ORGANIZATION_ID);
  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID);

  const [open, setOpen] = useState(false);
  const [familyId, setFamilyId] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const invalidate = () => {
    utils.billing.plans.invalidate(ORGANIZATION_ID);
    utils.billing.invoices.invalidate(ORGANIZATION_ID);
    utils.billing.aging.invalidate(ORGANIZATION_ID);
  };

  const createPlan = trpc.billing.createPlan.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Tuition plan created");
      setOpen(false);
      setFamilyId(""); setName(""); setAmount("");
    },
    onError: (e) => toast.error(e.message || "Could not create the plan"),
  });

  const setActive = trpc.billing.setPlanActive.useMutation({
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const generate = trpc.billing.generateInvoices.useMutation({
    onSuccess: (res) => {
      invalidate();
      toast.success(
        res.created === 0
          ? "Nothing due — all plans are up to date"
          : `Generated ${res.created} invoice${res.created === 1 ? "" : "s"} from ${res.plansProcessed} plan${res.plansProcessed === 1 ? "" : "s"}`
      );
    },
    onError: (e) => toast.error(e.message || "Generation failed"),
  });

  const familyName = (id: number) => (families ?? []).find((f) => f.id === id)?.primaryContactName ?? `Family #${id}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" /> Tuition Plans
            </CardTitle>
            <CardDescription>Set the rate once — invoices generate themselves on schedule.</CardDescription>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={generate.isPending}
                onClick={() => generate.mutate(ORGANIZATION_ID)}
              >
                {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Generate due invoices
              </Button>
              <Button size="sm" className="gap-1" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New Plan
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (plans ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No tuition plans yet. Create one per family and stop writing the same invoice every month.
          </p>
        ) : (
          <div className="space-y-2">
            {(plans ?? []).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {p.name} <span className="text-muted-foreground">· {familyName(p.familyId)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {money(p.amount)} {FREQ_LABEL[p.frequency].toLowerCase()} · next invoice {new Date(p.nextInvoiceDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={p.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-muted text-muted-foreground"}>
                    {p.isActive ? "Active" : "Paused"}
                  </Badge>
                  {isAdmin && (
                    <Switch
                      checked={p.isActive === 1}
                      disabled={setActive.isPending}
                      onCheckedChange={(v) => setActive.mutate({ id: p.id, organizationId: ORGANIZATION_ID, isActive: v })}
                      aria-label={p.isActive ? "Pause plan" : "Activate plan"}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New tuition plan</DialogTitle>
            <DialogDescription>Invoices generate automatically from the start date at the chosen frequency.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={familyId} onValueChange={setFamilyId}>
              <SelectTrigger><SelectValue placeholder="Family" /></SelectTrigger>
              <SelectContent>
                {(families ?? []).map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>{f.primaryContactName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name (e.g., Full-day tuition)" />
            <div className="grid grid-cols-2 gap-3">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (e.g., 850.00)" inputMode="decimal" />
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">First invoice date</p>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!familyId || !name.trim() || !/^\d+(\.\d{1,2})?$/.test(amount) || createPlan.isPending}
              onClick={() =>
                createPlan.mutate({
                  organizationId: ORGANIZATION_ID,
                  familyId: Number(familyId),
                  name: name.trim(),
                  amount,
                  frequency,
                  nextInvoiceDate: startDate,
                })
              }
            >
              {createPlan.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
