import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, Loader2, ShieldAlert, Inbox, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const TIER_LABEL: Record<string, string> = { starter: "Starter", professional: "Professional", enterprise: "Enterprise" };
const tierBadge = (t: string) => {
  const map: Record<string, string> = { starter: "bg-slate-100 text-slate-700", professional: "bg-blue-100 text-blue-700", enterprise: "bg-purple-100 text-purple-700" };
  return <Badge className={`${map[t] ?? map.starter} border-0 text-xs`}>{TIER_LABEL[t] ?? t}</Badge>;
};

const BLANK = { name: "", agencyId: "", subscriptionTier: "starter", maxChildren: "100", maxStaff: "20" };

export default function OrgAdmin() {
  const { user, loading } = useAuth();
  const isOwner = Boolean((user as any)?.isOwner);
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  const listQuery = trpc.organizations.listAll.useQuery(undefined, { enabled: isOwner });
  const orgs = listQuery.data ?? [];

  const create = trpc.organizations.create.useMutation({
    onSuccess: async () => { await utils.organizations.listAll.invalidate(); toast.success("Organization created"); setOpen(false); setForm({ ...BLANK }); },
    onError: (e) => toast.error(e.message || "Could not create organization"),
  });
  const setActive = trpc.organizations.setActive.useMutation({
    onSuccess: async () => { await utils.organizations.listAll.invalidate(); },
    onError: (e) => toast.error(e.message || "Could not update organization"),
  });

  const requestsQuery = trpc.programRequests.list.useQuery(undefined, { enabled: isOwner });
  const requests = requestsQuery.data ?? [];
  const pendingRequests = requests.filter((r: any) => r.status === "pending");
  const approve = trpc.programRequests.approve.useMutation({
    onSuccess: async () => { await Promise.all([utils.programRequests.list.invalidate(), utils.organizations.listAll.invalidate()]); toast.success("Approved — organization created"); },
    onError: (e) => toast.error(e.message || "Could not approve request"),
  });
  const decline = trpc.programRequests.decline.useMutation({
    onSuccess: async () => { await utils.programRequests.list.invalidate(); toast.success("Request declined"); },
    onError: (e) => toast.error(e.message || "Could not decline request"),
  });

  const set = (k: keyof typeof BLANK) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim() || !form.agencyId.trim()) { toast.error("Name and Agency ID are required."); return; }
    create.mutate({
      name: form.name.trim(),
      agencyId: form.agencyId.trim(),
      subscriptionTier: form.subscriptionTier as any,
      maxChildren: form.maxChildren ? Number(form.maxChildren) : undefined,
      maxStaff: form.maxStaff ? Number(form.maxStaff) : undefined,
    });
  };

  if (loading) {
    return <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isOwner) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-12 text-center">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Platform owner access required</p>
          <p className="text-sm text-muted-foreground mt-1">Only the platform owner can manage organizations.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" />Organizations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Platform administration — manage every program on this deployment</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" />New Organization</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Organization</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Program Name</Label><Input placeholder="Sunshine Head Start" value={form.name} onChange={(e) => set("name")(e.target.value)} /></div>
                <div className="space-y-2"><Label>Agency ID</Label><Input placeholder="HS-CA-00000" value={form.agencyId} onChange={(e) => set("agencyId")(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tier</Label>
                  <Select value={form.subscriptionTier} onValueChange={set("subscriptionTier")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TIER_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Max Children</Label><Input type="number" min={0} value={form.maxChildren} onChange={(e) => set("maxChildren")(e.target.value)} /></div>
                <div className="space-y-2"><Label>Max Staff</Label><Input type="number" min={0} value={form.maxStaff} onChange={(e) => set("maxStaff")(e.target.value)} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={create.isPending} className="gap-2">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Organizations", value: orgs.length },
          { label: "Active", value: orgs.filter((o: any) => o.isActive).length },
          { label: "Total Children", value: orgs.reduce((s: number, o: any) => s + (o.childrenCount ?? 0), 0) },
          { label: "Total Staff", value: orgs.reduce((s: number, o: any) => s + (o.staffCount ?? 0), 0) },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1 text-primary">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />Program Requests
            {pendingRequests.length > 0 && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">{pendingRequests.length} pending</Badge>}
          </CardTitle>
          <CardDescription>Self-serve requests from prospective programs. Approving provisions an organization.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {requestsQuery.isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No requests yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((r: any) => (
                <div key={r.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-foreground">{r.organizationName}</p>
                      {r.status === "pending" && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Pending</Badge>}
                      {r.status === "approved" && <Badge className="bg-green-100 text-green-700 border-0 text-xs">Approved</Badge>}
                      {r.status === "declined" && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Declined</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.contactName} • {r.contactEmail}{r.phone ? ` • ${r.phone}` : ""}{r.agencyId ? ` • ${r.agencyId}` : ""}
                    </p>
                    {r.message && <p className="text-xs text-muted-foreground mt-1 italic">“{r.message}”</p>}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" className="text-xs gap-1" disabled={approve.isPending} onClick={() => approve.mutate({ id: r.id })}>
                        <Check className="h-3.5 w-3.5 text-green-600" />Approve
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs gap-1" disabled={decline.isPending} onClick={() => decline.mutate({ id: r.id })}>
                        <X className="h-3.5 w-3.5 text-red-500" />Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">All Programs</CardTitle><CardDescription>Toggle active to suspend or restore a program.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : orgs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No organizations yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-3">Program</th><th className="px-4 py-3">Agency ID</th><th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3 text-right">Children</th><th className="px-4 py-3 text-right">Staff</th><th className="px-4 py-3 text-center">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orgs.map((o: any) => (
                    <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium">{o.name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-xs">{o.agencyId}</td>
                      <td className="px-4 py-3">{tierBadge(o.subscriptionTier)}</td>
                      <td className="px-4 py-3 text-sm text-right">{o.childrenCount}{o.maxChildren != null ? ` / ${o.maxChildren}` : ""}</td>
                      <td className="px-4 py-3 text-sm text-right">{o.staffCount}{o.maxStaff != null ? ` / ${o.maxStaff}` : ""}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Switch checked={Boolean(o.isActive)} disabled={setActive.isPending} onCheckedChange={(v) => setActive.mutate({ id: o.id, isActive: v })} />
                        </div>
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
