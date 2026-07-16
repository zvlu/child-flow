import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Landmark, Plus, Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

const STATUS = {
  active: { label: "Active", color: "bg-green-100 text-green-700 border-green-200" },
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 border-amber-200" },
  expired: { label: "Expired", color: "bg-red-100 text-red-700 border-red-200" },
} as const;

const money = (v: string | null | undefined) =>
  v == null || v === "" ? "—" : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return null;
  const x = new Date(d);
  return isNaN(x.getTime()) ? null : x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const EMPTY = {
  familyId: "", agencyName: "", caseNumber: "",
  authorizedAmount: "", copayAmount: "", startDate: "", endDate: "",
  status: "active" as "active" | "pending" | "expired", notes: "",
};

export default function Subsidies() {
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const { data: subsidies, isLoading } = trpc.subsidies.list.useQuery(ORGANIZATION_ID);
  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID);

  const create = trpc.subsidies.create.useMutation({
    onSuccess: () => { utils.subsidies.list.invalidate(); toast.success("Subsidy added"); setAddOpen(false); setForm(EMPTY); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.subsidies.update.useMutation({
    onSuccess: () => utils.subsidies.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.subsidies.delete.useMutation({
    onSuccess: () => { utils.subsidies.list.invalidate(); toast.success("Subsidy removed"); },
    onError: (e) => toast.error(e.message),
  });
  const confirm = useConfirm();
  const confirmDelete = async (s: any) => {
    if (await confirm({
      title: "Remove this subsidy?",
      description: `${s.agencyName ?? "This subsidy"}${s.familyName ? ` for ${s.familyName}` : ""} will be permanently removed.`,
      confirmLabel: "Remove",
      destructive: true,
    })) del.mutate(s.id);
  };

  const totals = useMemo(() => {
    const list = subsidies ?? [];
    const active = list.filter((s: any) => s.status === "active");
    const authorized = active.reduce((sum: number, s: any) => sum + Number(s.authorizedAmount || 0), 0);
    return { count: list.length, active: active.length, authorized };
  }, [subsidies]);

  const submit = () => {
    if (!form.familyId) { toast.error("Pick a family"); return; }
    if (!form.agencyName.trim()) { toast.error("Agency name is required"); return; }
    create.mutate({
      organizationId: ORGANIZATION_ID,
      familyId: Number(form.familyId),
      agencyName: form.agencyName.trim(),
      caseNumber: form.caseNumber || undefined,
      authorizedAmount: form.authorizedAmount || undefined,
      copayAmount: form.copayAmount || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      status: form.status,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subsidies</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track subsidy agencies, authorized amounts, and family co-pays.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />Add Subsidy</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Subsidies", value: totals.count, color: "text-primary" },
          { label: "Active", value: totals.active, color: "text-green-600" },
          { label: "Authorized (active)", value: money(String(totals.authorized)), color: "text-foreground" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (subsidies ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Landmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No subsidies tracked yet</p>
          <p className="text-sm mt-1">Add a subsidy to record agency funding and co-pays for a family.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(subsidies ?? []).map((s: any) => {
            const window = [fmtDate(s.startDate), fmtDate(s.endDate)].filter(Boolean).join(" – ");
            return (
              <Card key={s.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{s.familyName}</h3>
                        <Badge className={`text-[10px] ${STATUS[s.status as keyof typeof STATUS].color} hover:${STATUS[s.status as keyof typeof STATUS].color}`}>
                          {STATUS[s.status as keyof typeof STATUS].label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {s.agencyName}{s.caseNumber ? ` · Case ${s.caseNumber}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm">
                        <span className="text-muted-foreground">Authorized: <strong className="text-foreground">{money(s.authorizedAmount)}</strong></span>
                        <span className="text-muted-foreground">Co-pay: <strong className="text-foreground">{money(s.copayAmount)}</strong></span>
                        {window && <span className="text-muted-foreground">{window}</span>}
                      </div>
                      {s.notes && <p className="text-xs text-muted-foreground mt-1.5">{s.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Select value={s.status} onValueChange={(v) => update.mutate({ id: s.id, status: v as any })}>
                        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                      <button onClick={() => confirmDelete(s)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add subsidy dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Subsidy</DialogTitle>
            <DialogDescription>Record a family's child-care subsidy or voucher.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Family</label>
                <Select value={form.familyId} onValueChange={(v) => set("familyId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {(families ?? []).map((f: any) => <SelectItem key={f.id} value={String(f.id)}>{f.primaryContactName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Status</label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Agency</label>
                <Input value={form.agencyName} onChange={(e) => set("agencyName", e.target.value)} placeholder="e.g. CT Care 4 Kids" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Case #</label>
                <Input value={form.caseNumber} onChange={(e) => set("caseNumber", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Authorized $</label>
                <Input type="number" inputMode="decimal" value={form.authorizedAmount} onChange={(e) => set("authorizedAmount", e.target.value)} placeholder="0.00" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Co-pay $</label>
                <Input type="number" inputMode="decimal" value={form.copayAmount} onChange={(e) => set("copayAmount", e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Start date</label>
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">End date</label>
                <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Notes</label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Add Subsidy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
