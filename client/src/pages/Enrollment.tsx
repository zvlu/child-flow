import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search, Clock, CheckCircle2, XCircle, ArrowRight, BookOpen, AlertCircle, Loader2, Calculator } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { dateInputToLocal } from "@/lib/date";
import { Glossary } from "@/components/Glossary";

const INCOME_LABEL: Record<string, string> = {
  below_100: "Below 100% FPL",
  below_130: "100–130% FPL",
  below_185: "130–185% FPL",
  above_185: "Above 185% FPL",
};

const priorityBadge = (priority: string) => {
  if (priority === "high") return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">High Priority</Badge>;
  if (priority === "medium") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100 text-xs">Medium</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 text-xs">Low</Badge>;
};

const statusBadge = (status: string) => {
  if (status === "enrolled") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">Enrolled</Badge>;
  if (status === "approved") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Approved</Badge>;
  if (status === "reviewing") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-xs">Reviewing</Badge>;
  if (status === "denied") return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Denied</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100 text-xs">Pending</Badge>;
};

function ageFrom(dob: Date | string | null): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) return "—";
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

const fmtDate = (v: Date | string | null) => (v ? new Date(v).toLocaleDateString() : "—");

/**
 * ERSEA selection score (§1302.14): a transparent point system for ranking
 * the waitlist by need. Income depth, staff-set priority, waiting time, and
 * categorical markers (recorded in notes by the eligibility calculator).
 */
function selectionScore(app: {
  incomeLevel: string | null;
  priority: string | null;
  appliedDate: Date | string | null;
  notes: string | null;
}): { score: number; parts: string[] } {
  let score = 0;
  const parts: string[] = [];

  const income: Record<string, number> = { below_100: 40, below_130: 30, below_185: 15, above_185: 0 };
  if (app.incomeLevel && income[app.incomeLevel] != null) {
    score += income[app.incomeLevel];
    if (income[app.incomeLevel] > 0) parts.push(`income +${income[app.incomeLevel]}`);
  }

  const prio: Record<string, number> = { high: 25, medium: 10, low: 0 };
  if (app.priority && prio[app.priority] != null && prio[app.priority] > 0) {
    score += prio[app.priority];
    parts.push(`priority +${prio[app.priority]}`);
  }

  // Categorical markers stamped by the eligibility calculator.
  const notes = (app.notes ?? "").toLowerCase();
  if (notes.includes("homeless")) { score += 30; parts.push("homeless +30"); }
  if (notes.includes("foster")) { score += 30; parts.push("foster care +30"); }
  if (notes.includes("tanf") || notes.includes("ssi")) { score += 25; parts.push("TANF/SSI +25"); }
  if (notes.includes("iep") || notes.includes("ifsp")) { score += 20; parts.push("IEP/IFSP +20"); }

  // Waiting time: +1 per full month waiting, capped at 10.
  if (app.appliedDate) {
    const months = Math.floor((Date.now() - new Date(app.appliedDate).getTime()) / (30 * 24 * 3600 * 1000));
    const pts = Math.min(10, Math.max(0, months));
    if (pts > 0) { score += pts; parts.push(`waiting +${pts}`); }
  }

  return { score, parts };
}

function scoreBadge(score: number) {
  const cls =
    score >= 70 ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100" :
    score >= 40 ? "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100" :
    "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100";
  return <Badge className={`${cls} text-xs font-mono`}>Score {score}</Badge>;
}

const BLANK_FORM = {
  childFirstName: "", childLastName: "", dateOfBirth: "", gender: "",
  parentName: "", parentPhone: "", parentEmail: "", address: "",
  incomeLevel: "", householdSize: "", priority: "medium", notes: "",
};

export default function Enrollment() {
  const orgId = ORGANIZATION_ID;
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });

  const appsQuery = trpc.enrollment.list.useQuery(orgId);
  const apps = appsQuery.data ?? [];
  const childrenQuery = trpc.children.list.useQuery(orgId);
  const classroomsQuery = trpc.classrooms.list.useQuery(orgId);

  const refetchApps = () => utils.enrollment.list.invalidate();

  const createMut = trpc.enrollment.create.useMutation({
    onSuccess: async () => { await refetchApps(); toast.success("Application submitted"); setShowNewForm(false); setForm({ ...BLANK_FORM }); },
    onError: (e) => toast.error(e.message || "Could not submit application"),
  });
  const statusMut = trpc.enrollment.setStatus.useMutation({
    onSuccess: async () => { await refetchApps(); },
    onError: (e) => toast.error(e.message || "Could not update application"),
  });
  const enrollMut = trpc.enrollment.enroll.useMutation({
    onSuccess: async (r) => {
      await Promise.all([refetchApps(), utils.children.list.invalidate()]);
      toast.success(r.alreadyEnrolled ? "Already enrolled" : "Child enrolled — record created");
    },
    onError: (e) => toast.error(e.message || "Could not enroll"),
  });

  const set = (k: keyof typeof BLANK_FORM) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.childFirstName.trim() || !form.childLastName.trim()) {
      toast.error("Child first and last name are required.");
      return;
    }
    createMut.mutate({
      organizationId: orgId,
      childFirstName: form.childFirstName.trim(),
      childLastName: form.childLastName.trim(),
      dateOfBirth: dateInputToLocal(form.dateOfBirth),
      gender: (form.gender || undefined) as any,
      parentName: form.parentName.trim() || undefined,
      parentPhone: form.parentPhone.trim() || undefined,
      parentEmail: form.parentEmail.trim() || undefined,
      address: form.address.trim() || undefined,
      incomeLevel: (form.incomeLevel || undefined) as any,
      householdSize: form.householdSize ? Number(form.householdSize) : undefined,
      priority: (form.priority || undefined) as any,
      notes: form.notes.trim() || undefined,
    });
  };

  const setStatus = (id: number, status: "pending" | "reviewing" | "approved" | "denied") =>
    statusMut.mutate({ id, organizationId: orgId, status });
  const busy = (id: number) => (statusMut.isPending && statusMut.variables?.id === id) || (enrollMut.isPending && enrollMut.variables?.id === id);

  const q = search.trim().toLowerCase();
  const filtered = apps
    .filter((a) =>
      `${a.childFirstName} ${a.childLastName}`.toLowerCase().includes(q) ||
      (a.parentName ?? "").toLowerCase().includes(q)
    )
    // Ranked by selection score so the greatest need is always at the top
    // (§1302.14 selection criteria), then by application date.
    .sort((a, b) => {
      const active = (s: string) => s === "pending" || s === "reviewing" || s === "approved";
      if (active(a.status) !== active(b.status)) return active(a.status) ? -1 : 1;
      const diff = selectionScore(b).score - selectionScore(a).score;
      if (diff !== 0) return diff;
      return new Date(a.appliedDate ?? 0).getTime() - new Date(b.appliedDate ?? 0).getTime();
    });

  const count = (s: string) => apps.filter((a) => a.status === s).length;

  const recentChildren = [...(childrenQuery.data ?? [])]
    .sort((a, b) => new Date(b.enrollmentDate ?? 0).getTime() - new Date(a.enrollmentDate ?? 0).getTime())
    .slice(0, 12);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-1.5">Enrollment <Glossary term="ERSEA" /></h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage applications, waitlist, and enrollment processes</p>
        </div>
        <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowCalc(true)}>
          <Calculator className="h-4 w-4" />Eligibility Calculator
        </Button>
        <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />New Application</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Enrollment Application</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Child First Name</Label><Input placeholder="First name" value={form.childFirstName} onChange={(e) => set("childFirstName")(e.target.value)} /></div>
                <div className="space-y-2"><Label>Child Last Name</Label><Input placeholder="Last name" value={form.childLastName} onChange={(e) => set("childLastName")(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth")(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={set("gender")}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Parent/Guardian Name</Label><Input placeholder="Full name" value={form.parentName} onChange={(e) => set("parentName")(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone Number</Label><Input placeholder="(555) 000-0000" value={form.parentPhone} onChange={(e) => set("parentPhone")(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Parent Email</Label><Input type="email" placeholder="name@example.com" value={form.parentEmail} onChange={(e) => set("parentEmail")(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={set("priority")}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Home Address</Label><Input placeholder="Street address, city, state, zip" value={form.address} onChange={(e) => set("address")(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Household Income Level</Label>
                  <Select value={form.incomeLevel} onValueChange={set("incomeLevel")}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="below_100">Below 100% FPL</SelectItem>
                      <SelectItem value="below_130">100–130% FPL</SelectItem>
                      <SelectItem value="below_185">130–185% FPL</SelectItem>
                      <SelectItem value="above_185">Above 185% FPL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Household Size</Label><Input type="number" min={1} placeholder="Number of people" value={form.householdSize} onChange={(e) => set("householdSize")(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Notes</Label><Input placeholder="Optional notes" value={form.notes} onChange={(e) => set("notes")(e.target.value)} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowNewForm(false)}>Cancel</Button>
                <Button onClick={submit} disabled={createMut.isPending} className="gap-2">
                  {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Submit Application
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <ErseaCalculatorDialog
        open={showCalc}
        onClose={() => setShowCalc(false)}
        onUseInApplication={(prefill) => {
          setForm((f) => ({ ...f, ...prefill }));
          setShowCalc(false);
          setShowNewForm(true);
        }}
      />

      {/* Stats — live counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Applications", value: apps.length, icon: BookOpen, color: "text-primary" },
          { label: "Pending Review", value: count("pending"), icon: Clock, color: "text-yellow-600" },
          { label: "Under Review", value: count("reviewing"), icon: AlertCircle, color: "text-blue-600" },
          { label: "Approved", value: count("approved"), icon: CheckCircle2, color: "text-green-600" },
        ].map((stat) => {
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

      <Tabs defaultValue="waitlist">
        <TabsList>
          <TabsTrigger value="waitlist">Waitlist & Applications</TabsTrigger>
          <TabsTrigger value="enrolled">Currently Enrolled</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Planning</TabsTrigger>
          <TabsTrigger value="incidents">§1302.17 Log</TabsTrigger>
        </TabsList>

        <TabsContent value="waitlist" className="mt-4 space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search applications..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <Card>
            <CardContent className="p-0">
              {appsQuery.isLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  {apps.length === 0 ? "No applications yet. Click “New Application” to add one." : "No applications match your search."}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((app) => {
                    const name = `${app.childFirstName} ${app.childLastName}`;
                    return (
                      <div key={app.id} className="p-5 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                              {(app.childFirstName[0] ?? "") + (app.childLastName[0] ?? "")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">{name}</h3>
                              {(app.status === "pending" || app.status === "reviewing" || app.status === "approved") && (
                                <span title={selectionScore(app).parts.join(" · ") || "No scoring factors yet"}>
                                  {scoreBadge(selectionScore(app).score)}
                                </span>
                              )}
                              {priorityBadge(app.priority)}
                              {statusBadge(app.status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              DOB: {fmtDate(app.dateOfBirth)} &bull; Age: {ageFrom(app.dateOfBirth)}
                              {app.parentName ? <> &bull; Parent: {app.parentName}</> : null}
                              {app.parentPhone ? <> &bull; {app.parentPhone}</> : null}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {app.incomeLevel ? <>Income: {INCOME_LABEL[app.incomeLevel] ?? app.incomeLevel} &bull; </> : null}
                              Applied: {fmtDate(app.appliedDate)}
                            </p>
                            {app.notes && <p className="text-xs text-primary mt-1">{app.notes}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {(app.status === "pending" || app.status === "reviewing") && (
                              <>
                                <Button variant="outline" size="sm" className="text-xs gap-1" disabled={busy(app.id)} onClick={() => setStatus(app.id, "approved")}>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />Approve
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs gap-1" disabled={busy(app.id)} onClick={() => setStatus(app.id, "denied")}>
                                  <XCircle className="h-3.5 w-3.5 text-red-500" />Deny
                                </Button>
                              </>
                            )}
                            {app.status === "approved" && (
                              <Button size="sm" className="text-xs gap-1" disabled={busy(app.id)} onClick={() => enrollMut.mutate({ id: app.id, organizationId: orgId })}>
                                {busy(app.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Enroll <ArrowRight className="h-3.5 w-3.5" /></>}
                              </Button>
                            )}
                            {app.status === "denied" && (
                              <Button variant="ghost" size="sm" className="text-xs" disabled={busy(app.id)} onClick={() => setStatus(app.id, "pending")}>Reopen</Button>
                            )}
                            {app.status === "enrolled" && app.enrolledChildId && (
                              <Link href={`/children/${app.enrolledChildId}`} asChild>
                                <a className="text-xs font-medium text-primary hover:underline">View child →</a>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrolled" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recently Enrolled Children</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {childrenQuery.isLoading ? (
                <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : recentChildren.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No children enrolled yet.</p>
              ) : (
                recentChildren.map((child) => (
                  <Link key={child.id} href={`/children/${child.id}`} asChild>
                    <a className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {(child.firstName[0] ?? "") + (child.lastName[0] ?? "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{child.firstName} {child.lastName}</p>
                        <p className="text-xs text-muted-foreground">Enrolled: {fmtDate(child.enrollmentDate)}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs capitalize">{child.status ?? "active"}</Badge>
                    </a>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capacity" className="mt-4">
          {classroomsQuery.isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (classroomsQuery.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No classrooms configured yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(classroomsQuery.data ?? []).map((room) => {
                const capacity = (room as any).capacity ?? 0;
                const enrolled = (room as any).enrolledCount ?? 0;
                const pct = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
                const open = Math.max(0, capacity - enrolled);
                return (
                  <Card key={room.id}>
                    <CardContent className="p-5">
                      <h3 className="font-semibold text-foreground">{(room as any).name ?? "Classroom"}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{(room as any).teacherName ?? "Unassigned"}</p>
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Enrolled</span>
                          <span className="font-bold">{enrolled}{capacity ? `/${capacity}` : ""}</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 95 ? "bg-red-500" : pct >= 85 ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{capacity ? `${open} open slot${open !== 1 ? "s" : ""}` : "No capacity set"}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="incidents" className="mt-4">
          <IncidentLogTab childList={(childrenQuery.data ?? []) as Array<{ id: number; firstName: string; lastName: string }>} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// §1302.17 Suspension / Expulsion Log
// Programs must prohibit expulsion, severely limit suspension, and document
// every intervention attempted before any exclusion.
// ─────────────────────────────────────────────────────────────────────────────

const INCIDENT_TYPES = [
  { value: "temporary_suspension", label: "Temporary suspension" },
  { value: "expulsion_prevented", label: "Expulsion prevented (supports in place)" },
  { value: "transition_out", label: "Transition to another placement" },
] as const;

const STEP_LABELS: Record<string, string> = {
  mental_health_consult: "Mental health consultation (§1302.45)",
  parent_meeting: "Meeting with parents/guardians",
  individualized_supports: "Individualized supports implemented",
  community_referrals: "Community service referrals",
  home_visit: "Home visit conducted",
};

function IncidentLogTab({ childList }: { childList: Array<{ id: number; firstName: string; lastName: string }> }) {
  const utils = trpc.useUtils();
  const incidentsQuery = trpc.suspensionLog.list.useQuery({ organizationId: ORGANIZATION_ID });
  const createMut = trpc.suspensionLog.create.useMutation({
    onSuccess: () => { utils.suspensionLog.list.invalidate(); toast.success("Incident documented"); setShowNew(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.suspensionLog.update.useMutation({
    onSuccess: () => utils.suspensionLog.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const [showNew, setShowNew] = useState(false);
  const [childId, setChildId] = useState("");
  const [type, setType] = useState<(typeof INCIDENT_TYPES)[number]["value"]>("temporary_suspension");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Set<string>>(new Set());

  const incidents = incidentsQuery.data ?? [];
  const open = incidents.filter((i) => i.status === "open").length;

  const toggleStep = (s: string) =>
    setSteps((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const submit = () => {
    if (!childId || !description.trim()) {
      toast.error("Child and description are required.");
      return;
    }
    createMut.mutate({
      organizationId: ORGANIZATION_ID,
      childId: Number(childId),
      incidentDate: dateInputToLocal(date) ?? new Date(),
      type,
      description: description.trim(),
      stepsTaken: Array.from(steps),
    });
  };

  const toggleIncidentStep = (incident: { id: number; stepsTaken: string[] | null }, step: string) => {
    const current = new Set(incident.stepsTaken ?? []);
    if (current.has(step)) current.delete(step);
    else current.add(step);
    updateMut.mutate({ id: incident.id, organizationId: ORGANIZATION_ID, stepsTaken: Array.from(current) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {open > 0
            ? `${open} open incident${open === 1 ? "" : "s"} — complete the required interventions below.`
            : "Every incident must document the interventions attempted before exclusion."}
        </p>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            // Fresh form every time — never pre-filled with the last incident.
            setChildId("");
            setType("temporary_suspension");
            setDate(new Date().toISOString().slice(0, 10));
            setDescription("");
            setSteps(new Set());
            setShowNew(true);
          }}
        >
          <Plus className="h-4 w-4" />Document Incident
        </Button>
      </div>

      {incidentsQuery.isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : incidents.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No incidents documented. That's the goal — §1302.17 requires programs to minimize exclusionary discipline.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => {
            const done = new Set(incident.stepsTaken ?? []);
            const typeLabel = INCIDENT_TYPES.find((t) => t.value === incident.type)?.label ?? incident.type;
            return (
              <Card key={incident.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{incident.childName}</h3>
                      <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                      {incident.status === "open" ? (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-xs">Open</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Resolved</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(incident.incidentDate).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{incident.description}</p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {Object.entries(STEP_LABELS).map(([step, label]) => (
                      <button
                        key={step}
                        onClick={() => incident.status === "open" && toggleIncidentStep(incident, step)}
                        disabled={incident.status !== "open" || updateMut.isPending}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                          done.has(step)
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-border text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        {done.has(step) ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Clock className="h-3.5 w-3.5 shrink-0" />}
                        {label}
                      </button>
                    ))}
                  </div>
                  {incident.status === "open" && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateMut.isPending || done.size < 2}
                        title={done.size < 2 ? "Complete at least two interventions before resolving" : undefined}
                        onClick={() => updateMut.mutate({ id: incident.id, organizationId: ORGANIZATION_ID, status: "resolved" })}
                      >
                        Mark resolved
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Document a §1302.17 Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Child</Label>
                <Select value={childId} onValueChange={setChildId}>
                  <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
                  <SelectContent>
                    {childList.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Incident date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>What happened & context</Label>
              <Input placeholder="Brief factual description of the behavior and circumstances" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Interventions already attempted</Label>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {Object.entries(STEP_LABELS).map(([step, label]) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => toggleStep(step)}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs ${
                      steps.has(step) ? "border-green-200 bg-green-50 text-green-700" : "border-border text-muted-foreground"
                    }`}
                  >
                    {steps.has(step) ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Plus className="h-3.5 w-3.5 shrink-0" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={submit} disabled={createMut.isPending} className="gap-2">
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save Incident
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERSEA Eligibility Calculator (45 CFR §1302.12)
// 2025 HHS Poverty Guidelines — 48 contiguous states + D.C.
// ─────────────────────────────────────────────────────────────────────────────

const FPL_2025: Record<number, number> = {
  1: 15_650, 2: 21_150, 3: 26_650, 4: 32_150,
  5: 37_650, 6: 43_150, 7: 48_650, 8: 54_150,
};
const FPL_EXTRA_PERSON = 5_500;

function fplFor(householdSize: number): number {
  if (householdSize <= 8) return FPL_2025[Math.max(1, householdSize)];
  return FPL_2025[8] + (householdSize - 8) * FPL_EXTRA_PERSON;
}

type CategoricalFlag = "homeless" | "foster" | "public_assistance";

const CATEGORICAL_LABELS: Record<CategoricalFlag, string> = {
  homeless: "Experiencing homelessness (McKinney-Vento)",
  foster: "Child in foster care",
  public_assistance: "Family receives TANF or SSI",
};

interface Determination {
  fplPercent: number;
  eligible: boolean;
  basis: string;
  detail: string;
  incomeLevel: "below_100" | "below_130" | "below_185" | "above_185";
  priority: "high" | "medium" | "low";
}

function determine(income: number, householdSize: number, flags: Set<CategoricalFlag>, hasIepIfsp: boolean): Determination {
  const fpl = fplFor(householdSize);
  const pct = Math.round((income / fpl) * 100);
  const incomeLevel = pct <= 100 ? "below_100" : pct <= 130 ? "below_130" : pct <= 185 ? "below_185" : "above_185";

  if (flags.size > 0) {
    const which = Array.from(flags).map((f) => CATEGORICAL_LABELS[f]).join("; ");
    return {
      fplPercent: pct,
      eligible: true,
      basis: "Categorically eligible",
      detail: `${which}. Eligible regardless of income (§1302.12(c)).`,
      incomeLevel,
      priority: "high",
    };
  }
  if (pct <= 100) {
    return {
      fplPercent: pct,
      eligible: true,
      basis: "Income eligible",
      detail: `Household income is at or below 100% of the federal poverty line ($${fpl.toLocaleString()} for ${householdSize}).`,
      incomeLevel,
      priority: hasIepIfsp ? "high" : "medium",
    };
  }
  if (pct <= 130) {
    return {
      fplPercent: pct,
      eligible: true,
      basis: "Eligible under the 130% provision",
      detail: "Between 100–130% FPL — programs may fill up to 35% of slots from this band (§1302.12(d)). Document the determination.",
      incomeLevel,
      priority: hasIepIfsp ? "high" : "low",
    };
  }
  return {
    fplPercent: pct,
    eligible: false,
    basis: "Over income",
    detail: hasIepIfsp
      ? "Above 130% FPL — but a child with an IEP/IFSP may be enrolled under the 10% over-income allowance (§1302.12(e)); disability enrollment also counts toward the 10% requirement (§1302.14(b))."
      : "Above 130% FPL. Up to 10% of enrollment may be over-income if all eligible families are served (§1302.12(e)).",
    incomeLevel,
    priority: hasIepIfsp ? "medium" : "low",
  };
}

function ErseaCalculatorDialog({
  open,
  onClose,
  onUseInApplication,
}: {
  open: boolean;
  onClose: () => void;
  onUseInApplication: (prefill: { incomeLevel: string; householdSize: string; priority: string; notes: string }) => void;
}) {
  const [income, setIncome] = useState("");
  const [size, setSize] = useState("4");
  const [flags, setFlags] = useState<Set<CategoricalFlag>>(new Set());
  const [iep, setIep] = useState(false);

  const incomeNum = Number(income.replace(/[^0-9.]/g, ""));
  const sizeNum = Math.max(1, Number(size) || 1);
  const ready = income !== "" && !Number.isNaN(incomeNum);
  const result = ready ? determine(incomeNum, sizeNum, flags, iep) : null;

  const toggleFlag = (f: CategoricalFlag) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" /> ERSEA Eligibility Calculator
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Annual household income</Label>
              <Input placeholder="e.g. 28000" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Household size</Label>
              <Input type="number" min={1} max={20} value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categorical eligibility (auto-eligible)</Label>
            <div className="space-y-1.5">
              {(Object.keys(CATEGORICAL_LABELS) as CategoricalFlag[]).map((f) => (
                <Button
                  key={f}
                  type="button"
                  variant={flags.has(f) ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => toggleFlag(f)}
                >
                  {flags.has(f) ? <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                  {CATEGORICAL_LABELS[f]}
                </Button>
              ))}
              <Button
                type="button"
                variant={iep ? "default" : "outline"}
                size="sm"
                className="w-full justify-start text-xs h-8"
                onClick={() => setIep(!iep)}
              >
                {iep ? <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                Child has an IEP / IFSP (disability priority)
              </Button>
            </div>
          </div>

          {result && (
            <Card className={result.eligible ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${result.eligible ? "text-green-700" : "text-red-700"}`}>
                    {result.basis}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {result.fplPercent}% FPL
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{result.detail}</p>
                <p className="text-[11px] text-muted-foreground">
                  2025 HHS Poverty Guidelines (48 contiguous states + D.C.). Verify with source documents
                  (pay stubs, W-2, TANF/SSI letters) and keep them with the application.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button
              disabled={!result}
              onClick={() => {
                if (!result) return;
                onUseInApplication({
                  incomeLevel: result.incomeLevel,
                  householdSize: String(sizeNum),
                  priority: result.priority,
                  notes: `Eligibility: ${result.basis} (${result.fplPercent}% FPL)${flags.size > 0 ? ` — ${Array.from(flags).map((f) => CATEGORICAL_LABELS[f]).join("; ")}` : ""}${iep ? " — has IEP/IFSP" : ""}`,
                });
              }}
              className="gap-2"
            >
              <ArrowRight className="h-4 w-4" /> Use in application
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
