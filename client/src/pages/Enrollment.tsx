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
import { Plus, Search, Clock, CheckCircle2, XCircle, ArrowRight, BookOpen, AlertCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { dateInputToLocal } from "@/lib/date";

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
  const filtered = apps.filter((a) =>
    `${a.childFirstName} ${a.childLastName}`.toLowerCase().includes(q) ||
    (a.parentName ?? "").toLowerCase().includes(q)
  );

  const count = (s: string) => apps.filter((a) => a.status === s).length;

  const recentChildren = [...(childrenQuery.data ?? [])]
    .sort((a, b) => new Date(b.enrollmentDate ?? 0).getTime() - new Date(a.enrollmentDate ?? 0).getTime())
    .slice(0, 12);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enrollment</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage applications, waitlist, and enrollment processes</p>
        </div>
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
      </Tabs>
    </div>
  );
}
