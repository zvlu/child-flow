import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Search, Plus, Heart, Stethoscope, Syringe, AlertTriangle, CheckCircle2, Clock, Download, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { objectsToCsv, downloadCsv } from "@/lib/csv";

type HealthType = "immunization" | "dental" | "physical" | "vision" | "hearing" | "lead" | "hemoglobin" | "other";
type HealthStatus = "up_to_date" | "due_soon" | "overdue" | "exempt" | "not_required";

const HEALTH_TYPES: { value: HealthType; label: string }[] = [
  { value: "immunization", label: "Immunization" },
  { value: "dental", label: "Dental" },
  { value: "physical", label: "Physical" },
  { value: "vision", label: "Vision" },
  { value: "hearing", label: "Hearing" },
  { value: "lead", label: "Lead Screening" },
  { value: "hemoglobin", label: "Hemoglobin" },
  { value: "other", label: "Other" },
];

const HEALTH_STATUSES: { value: HealthStatus; label: string }[] = [
  { value: "up_to_date", label: "Up to Date" },
  { value: "due_soon", label: "Due Soon" },
  { value: "overdue", label: "Overdue" },
  { value: "exempt", label: "Exempt" },
  { value: "not_required", label: "Not Required" },
];

const typeLabel = (type: string) =>
  HEALTH_TYPES.find(t => t.value === type)?.label ?? type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

const statusBadge = (status?: string) => {
  if (status === "up_to_date") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Current</Badge>;
  if (status === "due_soon") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100 text-xs">Due Soon</Badge>;
  if (status === "overdue") return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Overdue</Badge>;
  if (status === "exempt") return <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted text-xs">Exempt</Badge>;
  if (status === "not_required") return <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted text-xs">Not Required</Badge>;
  return <Badge variant="outline" className="text-muted-foreground text-xs">No Record</Badge>;
};

const ageString = (dob: unknown) => {
  if (!dob) return "—";
  const birth = new Date(dob as string | Date);
  if (isNaN(birth.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);
  return `${Math.floor(months / 12)}y ${months % 12}m`;
};

const formatDate = (d: unknown) =>
  d ? new Date(d as string | Date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const VALID_HEALTH_FILTERS = ["all", "current", "due_soon", "overdue"];

export default function Health() {
  const [, navigate] = useLocation();
  const search0 = useSearch();
  // Deep-link support: /health?status=overdue lands pre-filtered.
  const initialFilter = (() => {
    const s = new URLSearchParams(search0).get("status") ?? "all";
    return VALID_HEALTH_FILTERS.includes(s) ? s : "all";
  })();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    childId: "",
    type: "physical" as HealthType,
    status: "up_to_date" as HealthStatus,
    recordDate: new Date().toISOString().slice(0, 10),
    expiryDate: "",
    provider: "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const childrenQuery = trpc.children.list.useQuery(ORGANIZATION_ID);
  const classroomMapQuery = trpc.children.classroomMap.useQuery(ORGANIZATION_ID);
  const healthQuery = trpc.health.list.useQuery({ organizationId: ORGANIZATION_ID });
  const followUpsQuery = trpc.health.followUps.useQuery({ organizationId: ORGANIZATION_ID });

  const createMutation = trpc.health.create.useMutation({
    onSuccess: () => {
      utils.health.list.invalidate();
      utils.health.followUps.invalidate();
      toast.success("Health record added");
      setAddOpen(false);
      setForm(f => ({ ...f, expiryDate: "", provider: "", notes: "" }));
    },
    onError: (err) => toast.error(err.message || "Failed to add health record"),
  });

  const exportHealth = () => {
    const records = healthQuery.data ?? [];
    if (!records.length) { toast.message("No health records to export yet."); return; }
    const nameById = new Map((childrenQuery.data ?? []).map((c) => [c.id, `${c.firstName} ${c.lastName}`]));
    const rows = records.map((r) => ({
      child: nameById.get(r.childId) ?? `Child #${r.childId}`,
      type: r.type,
      status: r.status ?? "",
      date: r.recordDate ? new Date(r.recordDate).toLocaleDateString() : "",
      notes: r.notes ?? "",
    }));
    downloadCsv(`health-records-${new Date().toISOString().slice(0, 10)}.csv`, objectsToCsv(rows));
    toast.success(`Exported ${rows.length} health record${rows.length === 1 ? "" : "s"} to CSV`);
  };

  const handleAddRecord = () => {
    if (!form.childId) {
      toast.error("Please select a child");
      return;
    }
    if (!form.recordDate) {
      toast.error("Please choose a record date");
      return;
    }
    createMutation.mutate({
      organizationId: ORGANIZATION_ID,
      childId: Number(form.childId),
      type: form.type,
      status: form.status,
      recordDate: new Date(`${form.recordDate}T00:00:00`),
      expiryDate: form.expiryDate ? new Date(`${form.expiryDate}T00:00:00`) : undefined,
      provider: form.provider || undefined,
      notes: form.notes || undefined,
    });
  };

  // Join children + classrooms + latest health record per screening type
  const rows = useMemo(() => {
    const classroomByChild = new Map((classroomMapQuery.data ?? []).map(m => [m.childId, m.classroomName]));
    const recordsByChild = new Map<number, NonNullable<typeof healthQuery.data>>();
    for (const rec of healthQuery.data ?? []) {
      const list = recordsByChild.get(rec.childId) ?? [];
      list.push(rec);
      recordsByChild.set(rec.childId, list);
    }
    const latestOfType = (childId: number, type: HealthType) => {
      const recs = (recordsByChild.get(childId) ?? []).filter(r => r.type === type);
      if (recs.length === 0) return undefined;
      return recs.reduce((a, b) =>
        new Date(b.recordDate).getTime() > new Date(a.recordDate).getTime() ? b : a
      );
    };
    return (childrenQuery.data ?? []).map(child => {
      const pick = (type: HealthType) => {
        const rec = latestOfType(child.id, type);
        return { status: rec?.status ?? undefined, date: rec ? formatDate(rec.recordDate) : "—" };
      };
      return {
        id: child.id,
        name: `${child.firstName} ${child.lastName}`,
        age: ageString(child.dateOfBirth),
        classroom: classroomByChild.get(child.id) ?? "Unassigned",
        physical: pick("physical"),
        dental: pick("dental"),
        vision: pick("vision"),
        hearing: pick("hearing"),
        immunizations: pick("immunization").status,
      };
    });
  }, [childrenQuery.data, classroomMapQuery.data, healthQuery.data]);

  const rowStatuses = (r: (typeof rows)[number]) =>
    [r.physical.status, r.dental.status, r.vision.status, r.hearing.status, r.immunizations];
  const hasOverdue = (r: (typeof rows)[number]) => rowStatuses(r).includes("overdue");
  const hasDueSoon = (r: (typeof rows)[number]) => rowStatuses(r).includes("due_soon");

  const filtered = rows.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ||
      (filter === "overdue" && hasOverdue(r)) ||
      (filter === "due_soon" && hasDueSoon(r)) ||
      (filter === "current" && !hasOverdue(r) && !hasDueSoon(r));
    return matchSearch && matchFilter;
  });

  const overdueCount = rows.filter(hasOverdue).length;
  const dueSoonCount = rows.filter(hasDueSoon).length;
  const currentCount = rows.filter(r => !hasOverdue(r) && !hasDueSoon(r)).length;

  // Per-category status breakdown across all children
  const categoryStats = useMemo(() => {
    const records = healthQuery.data ?? [];
    const types = Array.from(new Set(records.map(r => r.type)));
    return types.map(type => {
      const recs = records.filter(r => r.type === type);
      return {
        type,
        upToDate: recs.filter(r => r.status === "up_to_date").length,
        dueSoon: recs.filter(r => r.status === "due_soon").length,
        overdue: recs.filter(r => r.status === "overdue").length,
        other: recs.filter(r => r.status !== "up_to_date" && r.status !== "due_soon" && r.status !== "overdue").length,
        total: recs.length,
      };
    });
  }, [healthQuery.data]);

  const isLoading = childrenQuery.isLoading || healthQuery.isLoading || classroomMapQuery.isLoading;
  const followUps = followUpsQuery.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Health Records</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track screenings, immunizations, and medical information</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportHealth}><Download className="h-4 w-4" />Export</Button>
          <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />Add Record</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Children", value: rows.length, color: "text-foreground", icon: Heart },
          { label: "All Current", value: currentCount, color: "text-green-600", icon: CheckCircle2 },
          { label: "Due Soon", value: dueSoonCount, color: "text-yellow-600", icon: Clock },
          { label: "Overdue", value: overdueCount, color: "text-red-600", icon: AlertTriangle },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                  <Icon className={`h-8 w-8 opacity-20 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="screenings">
        <TabsList>
          <TabsTrigger value="screenings">Screenings</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="followups">Follow-Up Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="screenings" className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search children..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="due_soon">Due Soon</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No children match the current search and filter.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Child</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 flex items-center gap-1"><Stethoscope className="h-3 w-3" />Physical</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Dental</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Vision</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Hearing</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3"><Syringe className="h-3 w-3 inline mr-1" />Immunizations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map(record => {
                        const initials = record.name.split(" ").map(n => n[0]).join("");
                        return (
                          <tr
                            key={record.id}
                            className="hover:bg-muted/20 transition-colors cursor-pointer"
                            title={`Open ${record.name}'s health records`}
                            onClick={() => navigate(`/children/${record.id}`)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-sm">{record.name}</p>
                                  <p className="text-xs text-muted-foreground">{record.age} &bull; {record.classroom}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div>{statusBadge(record.physical.status)}</div>
                              <p className="text-xs text-muted-foreground mt-1">{record.physical.date}</p>
                            </td>
                            <td className="px-4 py-4">
                              <div>{statusBadge(record.dental.status)}</div>
                              <p className="text-xs text-muted-foreground mt-1">{record.dental.date}</p>
                            </td>
                            <td className="px-4 py-4">
                              <div>{statusBadge(record.vision.status)}</div>
                              <p className="text-xs text-muted-foreground mt-1">{record.vision.date}</p>
                            </td>
                            <td className="px-4 py-4">
                              <div>{statusBadge(record.hearing.status)}</div>
                              <p className="text-xs text-muted-foreground mt-1">{record.hearing.date}</p>
                            </td>
                            <td className="px-4 py-4">{statusBadge(record.immunizations)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Screening Status by Category</CardTitle>
              <CardDescription>Status breakdown of health records across all children</CardDescription>
            </CardHeader>
            <CardContent>
              {healthQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : categoryStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No health records yet.</p>
              ) : (
                <div className="space-y-3">
                  {categoryStats.map(cat => (
                    <div key={cat.type} className="flex items-center gap-4">
                      <div className="w-28 text-sm font-medium">{typeLabel(cat.type)}</div>
                      <div className="flex-1">
                        <div className="flex gap-1 h-6 rounded overflow-hidden">
                          {cat.upToDate > 0 && (
                            <div className="bg-green-500 text-white text-xs flex items-center justify-center font-medium rounded" style={{ flex: cat.upToDate }}>
                              {cat.upToDate}
                            </div>
                          )}
                          {cat.dueSoon > 0 && (
                            <div className="bg-yellow-400 text-yellow-900 text-xs flex items-center justify-center font-medium rounded" style={{ flex: cat.dueSoon }}>
                              {cat.dueSoon}
                            </div>
                          )}
                          {cat.overdue > 0 && (
                            <div className="bg-red-500 text-white text-xs flex items-center justify-center font-medium rounded" style={{ flex: cat.overdue }}>
                              {cat.overdue}
                            </div>
                          )}
                          {cat.other > 0 && (
                            <div className="bg-muted text-muted-foreground text-xs flex items-center justify-center font-medium rounded" style={{ flex: cat.other }}>
                              {cat.other}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="w-28 text-right">
                        {cat.overdue === 0 && cat.dueSoon === 0 ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">All Current</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{cat.upToDate}/{cat.total} current</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Follow-Up Alerts</CardTitle>
              <CardDescription>Screenings that are overdue or due within the next 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {followUpsQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No follow-ups due. All screenings are up to date.
                </p>
              ) : (
                <div className="space-y-3">
                  {followUps.map(alert => {
                    const overdue = alert.severity === "overdue";
                    return (
                      <div
                        key={alert.recordId}
                        className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-shadow hover:shadow-md ${overdue ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"}`}
                        title={`Open ${alert.childName}'s health records`}
                        onClick={() => navigate(`/children/${alert.childId}`)}
                      >
                        {overdue
                          ? <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                          : <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{alert.childName}</p>
                          <p className={`text-sm ${overdue ? "text-red-700" : "text-yellow-700"}`}>{alert.message}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {statusBadge(alert.severity)}
                          <p className="text-xs text-muted-foreground mt-1">Due {formatDate(alert.expiryDate)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Record Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Health Record</DialogTitle>
            <DialogDescription>Record a new screening, immunization, or exam for a child.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Child</Label>
              <Select value={form.childId} onValueChange={v => setForm(f => ({ ...f, childId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent>
                  {(childrenQuery.data ?? []).map(child => (
                    <SelectItem key={child.id} value={String(child.id)}>
                      {child.firstName} {child.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as HealthType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEALTH_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as HealthStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEALTH_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Record Date</Label>
                <Input type="date" value={form.recordDate} onChange={e => setForm(f => ({ ...f, recordDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry / Next Due</Label>
                <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Input placeholder="e.g. Dr. Smith, City Pediatrics" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRecord} disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
