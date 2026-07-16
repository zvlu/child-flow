import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ClipboardList, Plus, Loader2, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { objectsToCsv, downloadCsv } from "@/lib/csv";
import { dateInputToLocal } from "@/lib/date";
import { Glossary } from "@/components/Glossary";

const DRDP_DOMAINS = [
  { code: "ATL-REG", label: "Approaches to Learning–Self-Regulation" },
  { code: "SED", label: "Social & Emotional Development" },
  { code: "LLD", label: "Language & Literacy Development" },
  { code: "COG", label: "Cognition (Math & Science)" },
  { code: "PD-HLTH", label: "Physical Development–Health" },
  { code: "ELD", label: "English-Language Development" },
  { code: "HSS", label: "History–Social Science" },
  { code: "VPA", label: "Visual & Performing Arts" },
];
const domainLabel = (code: string | null) => DRDP_DOMAINS.find((d) => d.code === code)?.label ?? code ?? "—";

// DRDP developmental progression (simplified to the four primary bands).
const LEVELS = ["Responding", "Exploring", "Building", "Integrating"];
const levelValue = (score: string | null) => {
  const i = LEVELS.indexOf(score ?? "");
  return i >= 0 ? i + 1 : 0;
};
const LEVEL_COLORS = ["#f87171", "#f59e0b", "#60a5fa", "#4ade80"];

const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString() : "—");
const BLANK = { childId: "", domain: "ATL-REG", level: "Exploring", date: new Date().toISOString().slice(0, 10), title: "", notes: "" };

export default function Assessments() {
  const orgId = ORGANIZATION_ID;
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [childFilter, setChildFilter] = useState("all");

  const recordsQuery = trpc.education.list.useQuery({ organizationId: orgId });
  const childrenQuery = trpc.children.list.useQuery(orgId);

  const assessments = (recordsQuery.data ?? []).filter((r: any) => r.type === "assessment");
  const childName = useMemo(() => {
    const m = new Map<number, string>();
    (childrenQuery.data ?? []).forEach((c: any) => m.set(c.id, `${c.firstName} ${c.lastName}`));
    return m;
  }, [childrenQuery.data]);

  const create = trpc.education.create.useMutation({
    onSuccess: async () => { await utils.education.list.invalidate({ organizationId: orgId }); toast.success("Assessment recorded"); setOpen(false); setForm({ ...BLANK }); },
    onError: (e) => toast.error(e.message || "Could not record assessment"),
  });
  const set = (k: keyof typeof BLANK) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.childId) { toast.error("Select a child."); return; }
    create.mutate({
      organizationId: orgId,
      childId: Number(form.childId),
      type: "assessment",
      title: form.title.trim() || `${form.domain} — ${form.level}`,
      description: form.notes.trim() || undefined,
      assessmentDate: dateInputToLocal(form.date) ?? new Date(),
      score: form.level,
      domain: form.domain,
    });
  };

  const filtered = childFilter === "all" ? assessments : assessments.filter((a: any) => String(a.childId) === childFilter);

  const stats = useMemo(() => {
    const now = new Date();
    const children = new Set(assessments.map((a: any) => a.childId));
    const domains = new Set(assessments.map((a: any) => a.domain).filter(Boolean));
    const thisMonth = assessments.filter((a: any) => {
      const d = new Date(a.assessmentDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    return { total: assessments.length, children: children.size, domains: domains.size, thisMonth };
  }, [assessments]);

  // For a selected child: most recent level per domain → DRDP profile bar chart.
  const profile = useMemo(() => {
    if (childFilter === "all") return [];
    const latest = new Map<string, { date: number; level: number }>();
    for (const a of filtered) {
      if (!a.domain) continue;
      const t = new Date(a.assessmentDate).getTime();
      const cur = latest.get(a.domain);
      if (!cur || t > cur.date) latest.set(a.domain, { date: t, level: levelValue(a.score) });
    }
    return DRDP_DOMAINS.filter((d) => latest.has(d.code)).map((d) => ({ domain: d.code, level: latest.get(d.code)!.level }));
  }, [filtered, childFilter]);

  const exportCsv = () => {
    if (!filtered.length) { toast.message("Nothing to export yet."); return; }
    const out = filtered.map((a: any) => ({
      child: childName.get(a.childId) ?? `#${a.childId}`, domain: a.domain ?? "", domainName: domainLabel(a.domain),
      level: a.score ?? "", date: fmtDate(a.assessmentDate), title: a.title, notes: a.description ?? "",
    }));
    downloadCsv(`assessments-${new Date().toISOString().slice(0, 10)}.csv`, objectsToCsv(out));
    toast.success(`Exported ${out.length} assessments`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><ClipboardList className="h-6 w-6 text-primary" />Child Assessments <Glossary term="DRDP" /></h1>
          <p className="text-muted-foreground text-sm mt-0.5">DRDP developmental assessments and progress by domain</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" />Export</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Record Assessment</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Record Assessment</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Child</Label>
                  <Select value={form.childId} onValueChange={set("childId")}>
                    <SelectTrigger><SelectValue placeholder="Select a child" /></SelectTrigger>
                    <SelectContent>
                      {(childrenQuery.data ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Domain</Label>
                    <Select value={form.domain} onValueChange={set("domain")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DRDP_DOMAINS.map((d) => <SelectItem key={d.code} value={d.code}>{d.code} — {d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Developmental Level</Label>
                    <Select value={form.level} onValueChange={set("level")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Title (optional)</Label><Input placeholder="Auto from domain/level" value={form.title} onChange={(e) => set("title")(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Input placeholder="Observations" value={form.notes} onChange={(e) => set("notes")(e.target.value)} /></div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={submit} disabled={create.isPending} className="gap-2">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Assessments", value: stats.total },
          { label: "Children Assessed", value: stats.children },
          { label: "Domains Covered", value: stats.domains },
          { label: "This Month", value: stats.thisMonth },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            <p className="text-2xl font-bold mt-1 text-primary">{s.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm">Child</Label>
        <Select value={childFilter} onValueChange={setChildFilter}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All children</SelectItem>
            {(childrenQuery.data ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {childFilter !== "all" && profile.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Developmental Profile — {childName.get(Number(childFilter))}</CardTitle>
            <CardDescription>Most recent level by domain (1 Responding → 4 Integrating)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={profile}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="domain" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 4]} ticks={[1, 2, 3, 4]} tick={{ fontSize: 12 }} tickFormatter={(v) => LEVELS[v - 1] ?? ""} width={90} />
                <Tooltip formatter={(v: any) => [LEVELS[v - 1] ?? v, "Level"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="level" radius={[4, 4, 0, 0]}>
                  {profile.map((p, i) => <Cell key={i} fill={LEVEL_COLORS[(p.level - 1) % 4] ?? "#60a5fa"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Assessment Records</CardTitle></CardHeader>
        <CardContent className="p-0">
          {recordsQuery.isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No assessments recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-3">Child</th><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((a: any) => (
                    <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium">{childName.get(a.childId) ?? `#${a.childId}`}</td>
                      <td className="px-4 py-3 text-sm"><span className="font-mono text-xs">{a.domain ?? "—"}</span> <span className="text-muted-foreground">{a.domain ? domainLabel(a.domain) : ""}</span></td>
                      <td className="px-4 py-3"><Badge className="text-xs border-0" style={{ background: `${LEVEL_COLORS[levelValue(a.score) - 1] ?? "#e5e7eb"}33`, color: LEVEL_COLORS[levelValue(a.score) - 1] ?? "#374151" }}>{a.score ?? "—"}</Badge></td>
                      <td className="px-4 py-3 text-sm">{fmtDate(a.assessmentDate)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{a.description || "—"}</td>
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
