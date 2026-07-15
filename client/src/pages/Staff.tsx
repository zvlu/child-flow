import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Mail, Phone, Award, BookOpen, MoreHorizontal, Download, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useIsAdmin } from "@/_core/hooks/useIsAdmin";
import { toast } from "sonner";
import { formatDate } from "@/lib/date";

/** §1302.91 staffing taxonomy — grouped roughly by service area. */
const roleLabels: Record<string, string> = {
  director: "Head Start Director",
  admin: "Administrator",
  fiscal_officer: "Fiscal Officer",
  education_coordinator: "Education Coordinator",
  coach: "Coach",
  teacher: "Teacher",
  assistant: "Assistant Teacher",
  health_coordinator: "Health Coordinator",
  nurse: "Nurse",
  nutritionist: "Nutritionist / RD",
  mental_health_consultant: "Mental Health Consultant",
  disabilities_coordinator: "Disabilities Coordinator",
  family_services_manager: "Family Services Manager",
  family_advocate: "Family Advocate",
  home_visitor: "Home Visitor",
  ersea_coordinator: "ERSEA Coordinator",
  cook: "Cook / Food Service",
  bus_driver: "Bus Driver",
  coordinator: "Coordinator (legacy)",
};

const roleColors: Record<string, string> = {
  admin: "bg-amber-100 text-amber-700 border-amber-200",
  teacher: "bg-blue-100 text-blue-700 border-blue-200",
  assistant: "bg-green-100 text-green-700 border-green-200",
  coordinator: "bg-purple-100 text-purple-700 border-purple-200",
};

const certStatusBadges: Record<string, string> = {
  active: "bg-green-100 text-green-700 hover:bg-green-100",
  expiring_soon: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  expired: "bg-red-100 text-red-700 hover:bg-red-100",
};

const certStatusLabels: Record<string, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
};

// Training events have no backend yet — kept as static placeholders.
const trainingEvents = [
  { title: "Trauma-Informed Care", date: "Nov 20, 2026", hours: 3, required: true },
  { title: "Child Assessment Strategies", date: "Dec 5, 2026", hours: 2, required: true },
  { title: "Family Engagement Best Practices", date: "Dec 12, 2026", hours: 2, required: false },
  { title: "CPR/First Aid Renewal", date: "Jan 15, 2027", hours: 4, required: true },
];

const STAFF_ROLES = [
  "admin", "director", "fiscal_officer",
  "education_coordinator", "coach",
  "health_coordinator", "nurse", "nutritionist", "mental_health_consultant",
  "disabilities_coordinator",
  "family_services_manager", "family_advocate", "home_visitor",
  "ersea_coordinator",
  "teacher", "assistant",
  "cook", "bus_driver",
  "coordinator",
] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

type StaffFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  role: StaffRole;
};

const emptyForm: StaffFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  position: "",
  role: "teacher",
};

function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function Staff() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<StaffFormState>(emptyForm);

  const utils = trpc.useUtils();
  const { data: staff, isLoading: staffLoading } = trpc.staff.list.useQuery(ORGANIZATION_ID);
  const { data: classrooms } = trpc.classrooms.list.useQuery(ORGANIZATION_ID);
  const { data: certifications, isLoading: certsLoading } = trpc.staffOps.certifications.useQuery(ORGANIZATION_ID);

  const isAdmin = useIsAdmin();
  const createStaff = trpc.staff.create.useMutation({
    onSuccess: () => {
      utils.staff.list.invalidate();
      toast.success("Staff member added");
      setAddOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(`Failed to add staff: ${err.message}`),
  });

  const updateStaff = trpc.staff.update.useMutation({
    onSuccess: () => {
      utils.staff.list.invalidate();
      toast.success("Staff member updated");
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(`Failed to update staff: ${err.message}`),
  });

  const staffList = staff ?? [];

  // Derive classroom assignments from classroom teacher/assistant names.
  const classroomByStaffName = useMemo(() => {
    const map = new Map<string, string>();
    for (const room of classrooms ?? []) {
      if (room.teacherName) map.set(room.teacherName, room.name);
      if (room.assistantName) map.set(room.assistantName, room.name);
    }
    return map;
  }, [classrooms]);

  const certsByStaffId = useMemo(() => {
    const map = new Map<number, NonNullable<typeof certifications>>();
    for (const cert of certifications ?? []) {
      const list = map.get(cert.staffId) ?? [];
      list.push(cert);
      map.set(cert.staffId, list);
    }
    return map;
  }, [certifications]);

  const filtered = staffList.filter((s) => {
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch =
      name.includes(q) ||
      (s.position ?? "").toLowerCase().includes(q) ||
      (roleLabels[s.role ?? "teacher"] ?? s.role ?? "").toLowerCase().includes(q);
    const matchesRole = roleFilter === "all" || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const certAlerts = (certifications ?? []).filter((c) => c.status !== "active").length;

  const openEdit = (member: (typeof staffList)[number]) => {
    setForm({
      firstName: member.firstName ?? "",
      lastName: member.lastName ?? "",
      email: member.email ?? "",
      phone: member.phone ?? "",
      position: member.position ?? "",
      role: member.role ?? "teacher",
    });
    setEditId(member.id);
  };

  const submitForm = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      position: form.position.trim() || undefined,
      role: form.role,
    };
    if (editId !== null) {
      updateStaff.mutate({ id: editId, ...payload });
    } else {
      createStaff.mutate({ organizationId: ORGANIZATION_ID, ...payload });
    }
  };

  const staffFormFields = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="staff-first">First Name</Label>
          <Input id="staff-first" value={form.firstName} onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-last">Last Name</Label>
          <Input id="staff-last" value={form.lastName} onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-email">Email</Label>
        <Input id="staff-email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-phone">Phone</Label>
        <Input id="staff-phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="staff-position">Position</Label>
          <Input id="staff-position" placeholder="e.g. Lead Teacher" value={form.position} onChange={(e) => setForm(f => ({ ...f, position: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v as StaffRole }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(roleLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {staffLoading ? "Loading staff…" : `${staffList.length} staff members`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" />Export</Button>
          {isAdmin && (
            <Button size="sm" className="gap-2" onClick={() => { setForm(emptyForm); setAddOpen(true); }}>
              <Plus className="h-4 w-4" />Add Staff
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Staff", value: staffList.length },
          { label: "Teachers", value: staffList.filter(s => s.role === "teacher").length },
          { label: "Active", value: staffList.filter(s => s.isActive === 1).length },
          { label: "Certification Alerts", value: certAlerts },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{staffLoading ? "—" : stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="directory">
        <TabsList>
          <TabsTrigger value="directory">Staff Directory</TabsTrigger>
          <TabsTrigger value="training">Training & Development</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search staff..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {staffLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading staff…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No staff members match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map(member => {
                const fullName = `${member.firstName} ${member.lastName}`;
                const classroom = classroomByStaffName.get(fullName);
                const memberCerts = certsByStaffId.get(member.id) ?? [];
                return (
                  <Card key={member.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {initials(member.firstName, member.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-foreground">{fullName}</h3>
                            {isAdmin && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEdit(member)}>Edit</DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => updateStaff.mutate({ id: member.id, isActive: member.isActive === 1 ? 0 : 1 })}
                                  >
                                    {member.isActive === 1 ? "Deactivate" : "Activate"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge className={`text-xs ${roleColors[member.role ?? "teacher"] || "bg-gray-100 text-gray-700"} hover:bg-opacity-100`}>
                              {member.position || roleLabels[member.role ?? "teacher"] || member.role}
                            </Badge>
                            {member.isActive !== 1 && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                            )}
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {classroom && <p>Classroom: {classroom}</p>}
                            {member.email && <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{member.email}</div>}
                            {member.phone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{member.phone}</div>}
                          </div>
                          {memberCerts.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {memberCerts.map(cert => (
                                <Badge key={cert.id} variant="outline" className="text-xs">
                                  {cert.certificationType}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="training" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Upcoming Training Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {trainingEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{event.title}</p>
                      {event.required && <Badge className="text-xs bg-red-100 text-red-700 hover:bg-red-100">Required</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{event.date} &bull; {event.hours} hours</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs" disabled title="Training registration coming soon">Register</Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Certification Status by Staff</CardTitle>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                </div>
              ) : (
                <div className="space-y-3">
                  {staffList.map(member => {
                    const memberCerts = certsByStaffId.get(member.id) ?? [];
                    const alerts = memberCerts.filter(c => c.status !== "active").length;
                    return (
                      <div key={member.id} className="flex items-center gap-4">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {initials(member.firstName, member.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{member.firstName} {member.lastName}</span>
                          {memberCerts.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No certifications on file</span>
                          ) : alerts > 0 ? (
                            <span className="text-xs font-medium text-amber-600">
                              {memberCerts.length} certification{memberCerts.length > 1 ? "s" : ""} &bull; {alerts} need{alerts === 1 ? "s" : ""} attention
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-green-600">
                              {memberCerts.length} certification{memberCerts.length > 1 ? "s" : ""} current
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Staff Certifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {certsLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading certifications…
                </div>
              ) : (certifications ?? []).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No certifications on file.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Staff Member</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Certification</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Number</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Issued</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Expires</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(certifications ?? []).map(cert => (
                        <tr key={cert.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-medium text-sm">{cert.staffName}</span>
                          </td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{cert.certificationType}</td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{cert.certificationNumber || "—"}</td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(cert.issueDate)}</td>
                          <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(cert.expiryDate)}</td>
                          <td className="px-4 py-4">
                            <Badge className={`text-xs ${certStatusBadges[cert.status] ?? ""}`}>
                              {certStatusLabels[cert.status] ?? cert.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Staff dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setForm(emptyForm); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          {staffFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitForm} disabled={createStaff.isPending}>
              {createStaff.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff dialog */}
      <Dialog open={editId !== null} onOpenChange={(open) => { if (!open) { setEditId(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          {staffFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button onClick={submitForm} disabled={updateStaff.isPending}>
              {updateStaff.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
