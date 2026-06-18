import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HandHeart, Plus, Download, Trash2, Loader2, Clock, DollarSign, Gift } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { objectsToCsv, downloadCsv } from "@/lib/csv";
import { dateInputToLocal } from "@/lib/date";

const TYPE_LABEL: Record<string, string> = {
  volunteer: "Volunteer Time", goods: "Donated Goods", services: "Services", facility: "Facility / Space", other: "Other",
};
const typeBadge = (t: string) => {
  const map: Record<string, string> = {
    volunteer: "bg-blue-100 text-blue-700",
    goods: "bg-amber-100 text-amber-700",
    services: "bg-purple-100 text-purple-700",
    facility: "bg-emerald-100 text-emerald-700",
    other: "bg-gray-100 text-gray-600",
  };
  return <Badge className={`${map[t] ?? map.other} hover:${map[t] ?? map.other} text-xs border-0`}>{TYPE_LABEL[t] ?? t}</Badge>;
};

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString() : "—");

const BLANK = { type: "volunteer", contributor: "", description: "", date: new Date().toISOString().slice(0, 10), hours: "", value: "" };

export default function InKind() {
  const orgId = ORGANIZATION_ID;
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  const listQuery = trpc.inKind.list.useQuery(orgId);
  const rows = listQuery.data ?? [];

  const create = trpc.inKind.create.useMutation({
    onSuccess: async () => { await utils.inKind.list.invalidate(orgId); toast.success("Contribution logged"); setOpen(false); setForm({ ...BLANK }); },
    onError: (e) => toast.error(e.message || "Could not save contribution"),
  });
  const del = trpc.inKind.delete.useMutation({
    onSuccess: async () => { await utils.inKind.list.invalidate(orgId); toast.success("Contribution removed"); },
    onError: (e) => toast.error(e.message || "Could not remove"),
  });

  const set = (k: keyof typeof BLANK) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const totals = useMemo(() => {
    let value = 0, hours = 0, monthValue = 0;
    const now = new Date();
    for (const r of rows) {
      const v = Number(r.value) || 0;
      value += v;
      hours += Number(r.hours) || 0;
      const d = new Date(r.date as any);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) monthValue += v;
    }
    return { value, hours, monthValue, count: rows.length };
  }, [rows]);

  const submit = () => {
    if (!form.contributor.trim()) { toast.error("Contributor is required."); return; }
    const value = Number(form.value);
    if (!form.value || isNaN(value) || value < 0) { toast.error("Enter a valid dollar value."); return; }
    create.mutate({
      organizationId: orgId,
      type: form.type as any,
      contributor: form.contributor.trim(),
      description: form.description.trim() || undefined,
      date: dateInputToLocal(form.date) ?? new Date(),
      hours: form.type === "volunteer" && form.hours ? Number(form.hours) : undefined,
      value,
    });
  };

  const exportCsv = () => {
    if (!rows.length) { toast.message("Nothing to export yet."); return; }
    const out = rows.map((r) => ({
      date: fmtDate(r.date), type: TYPE_LABEL[r.type] ?? r.type, contributor: r.contributor,
      description: r.description ?? "", hours: r.hours ?? "", value: Number(r.value).toFixed(2),
    }));
    downloadCsv(`in-kind-${new Date().toISOString().slice(0, 10)}.csv`, objectsToCsv(out));
    toast.success(`Exported ${out.length} contributions`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><HandHeart className="h-6 w-6 text-primary" />In-Kind Contributions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track volunteer time and donations toward the non-federal (20%) match</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" />Export</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Log Contribution</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Log In-Kind Contribution</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={set("type")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Contributor</Label><Input placeholder="Name or organization" value={form.contributor} onChange={(e) => set("contributor")(e.target.value)} /></div>
                <div className="space-y-2"><Label>Description</Label><Input placeholder="What was contributed" value={form.description} onChange={(e) => set("description")(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  {form.type === "volunteer" && (
                    <div className="space-y-2"><Label>Hours</Label><Input type="number" min={0} step="0.25" value={form.hours} onChange={(e) => set("hours")(e.target.value)} /></div>
                  )}
                  <div className="space-y-2"><Label>Value (USD)</Label><Input type="number" min={0} step="0.01" placeholder="0.00" value={form.value} onChange={(e) => set("value")(e.target.value)} /></div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={submit} disabled={create.isPending} className="gap-2">
                    {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total In-Kind Value", value: usd(totals.value), icon: DollarSign, color: "text-primary" },
          { label: "This Month", value: usd(totals.monthValue), icon: DollarSign, color: "text-emerald-600" },
          { label: "Volunteer Hours", value: totals.hours.toLocaleString(), icon: Clock, color: "text-blue-600" },
          { label: "Contributions", value: String(totals.count), icon: Gift, color: "text-amber-600" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}><CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-muted-foreground font-medium">{s.label}</p><p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p></div>
                <Icon className={`h-8 w-8 opacity-20 ${s.color}`} />
              </div>
            </CardContent></Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contribution Log</CardTitle>
          <CardDescription>All recorded in-kind contributions, most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No contributions yet. Click “Log Contribution” to add one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Contributor</th>
                    <th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Hours</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3 text-sm">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3">{typeBadge(r.type)}</td>
                      <td className="px-4 py-3 text-sm font-medium">{r.contributor}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.description || "—"}</td>
                      <td className="px-4 py-3 text-sm text-right">{r.hours ? Number(r.hours).toLocaleString() : "—"}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{usd(Number(r.value))}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={del.isPending}
                          onClick={() => del.mutate({ id: r.id, organizationId: orgId })} aria-label="Delete contribution">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
