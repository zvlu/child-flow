import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Plus, Baby, ChevronRight, Download, Upload, MoreHorizontal, Loader2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { FlagChips } from "@/components/FlagChips";

const healthBadge = (status: string) => {
  if (status === "current") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Current</Badge>;
  if (status === "due_soon") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">Due Soon</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Overdue</Badge>;
};

const statusBadge = (status: string) => {
  if (status === "active") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>;
  if (status === "graduated") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">Graduated</Badge>;
  if (status === "withdrawn") return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Withdrawn</Badge>;
  return <Badge variant="secondary">Inactive</Badge>;
};

function formatAge(dob: string | Date | null | undefined): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) months = 0;
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

function formatDate(x: string | Date | null | undefined): string {
  if (!x) return "—";
  const d = new Date(x);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function Children() {
  const [search, setSearch] = useState("");
  const [classroomFilter, setClassroomFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "family">("list");

  const utils = trpc.useUtils();

  const { data: children, isLoading } = trpc.children.list.useQuery(ORGANIZATION_ID);
  const { data: classroomMap } = trpc.children.classroomMap.useQuery(ORGANIZATION_ID);
  const { data: childFlags } = trpc.children.flags.useQuery(ORGANIZATION_ID);
  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID);
  const { data: healthRecords } = trpc.health.list.useQuery({ organizationId: ORGANIZATION_ID });

  const attendanceRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { start, end };
  }, []);
  const { data: attendanceRecords } = trpc.attendance.getRange.useQuery({
    organizationId: ORGANIZATION_ID,
    start: attendanceRange.start,
    end: attendanceRange.end,
  });

  const withdrawMutation = trpc.children.update.useMutation({
    onSuccess: () => {
      utils.children.list.invalidate(ORGANIZATION_ID);
      toast.success("Child withdrawn");
    },
    onError: (err) => toast.error(err.message || "Failed to withdraw child"),
  });

  const classroomByChild = useMemo(() => {
    const m = new Map<number, string>();
    (classroomMap ?? []).forEach((row: any) => m.set(row.childId, row.classroomName));
    return m;
  }, [classroomMap]);

  const familyContactById = useMemo(() => {
    const m = new Map<number, string>();
    (families ?? []).forEach((f: any) => m.set(f.id, f.primaryContactName));
    return m;
  }, [families]);

  const familyPhoneById = useMemo(() => {
    const m = new Map<number, string>();
    (families ?? []).forEach((f: any) => f.primaryContactPhone && m.set(f.id, f.primaryContactPhone));
    return m;
  }, [families]);

  const flagsByChild = useMemo(() => {
    const m = new Map<number, any[]>();
    (childFlags ?? []).forEach((f: any) => {
      if (!m.has(f.childId)) m.set(f.childId, []);
      m.get(f.childId)!.push(f);
    });
    return m;
  }, [childFlags]);

  // Health status per child: any overdue -> overdue, any due_soon -> due_soon, else current
  const healthStatusByChild = useMemo(() => {
    const m = new Map<number, string>();
    (healthRecords ?? []).forEach((r: any) => {
      const prev = m.get(r.childId);
      if (r.status === "overdue") {
        m.set(r.childId, "overdue");
      } else if (r.status === "due_soon") {
        if (prev !== "overdue") m.set(r.childId, "due_soon");
      } else if (!prev) {
        m.set(r.childId, "current");
      }
    });
    return m;
  }, [healthRecords]);

  const attendanceRateByChild = useMemo(() => {
    const counts = new Map<number, { attended: number; total: number }>();
    (attendanceRecords ?? []).forEach((r: any) => {
      const c = counts.get(r.childId) ?? { attended: 0, total: 0 };
      c.total += 1;
      if (r.status === "present") c.attended += 1;
      else if (r.status === "half_day") c.attended += 0.5;
      counts.set(r.childId, c);
    });
    const m = new Map<number, number>();
    counts.forEach((c, childId) => {
      if (c.total > 0) m.set(childId, Math.round((c.attended / c.total) * 100));
    });
    return m;
  }, [attendanceRecords]);

  const allChildren = children ?? [];

  const classroomOptions = useMemo(() => {
    const names = new Set<string>();
    (classroomMap ?? []).forEach((row: any) => {
      if (row.classroomName) names.add(row.classroomName);
    });
    return Array.from(names).sort();
  }, [classroomMap]);

  const filtered = allChildren.filter((c: any) => {
    const matchSearch = `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase());
    const classroom = classroomByChild.get(c.id) ?? "";
    const matchClassroom = classroomFilter === "all" || classroom === classroomFilter;
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchClassroom && matchStatus;
  });

  const healthCounts = useMemo(() => {
    let current = 0, dueSoon = 0, overdue = 0;
    allChildren.forEach((c: any) => {
      const s = healthStatusByChild.get(c.id);
      if (s === "overdue") overdue++;
      else if (s === "due_soon") dueSoon++;
      else if (s === "current") current++;
    });
    return { current, dueSoon, overdue };
  }, [allChildren, healthStatusByChild]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Children</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{filtered.length} of {allChildren.length} children</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Link href="/enrollment">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add Child
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active", value: allChildren.filter((c: any) => c.status === "active").length, color: "text-green-600" },
          { label: "Health Current", value: healthCounts.current, color: "text-green-600" },
          { label: "Health Due Soon", value: healthCounts.dueSoon, color: "text-yellow-600" },
          { label: "Health Overdue", value: healthCounts.overdue, color: "text-red-600" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search children..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={classroomFilter} onValueChange={setClassroomFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Classroom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classrooms</SelectItem>
                {classroomOptions.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* View toggle: flat list or grouped by family */}
      <div className="flex gap-2">
        <Button size="sm" variant={viewMode === "list" ? "default" : "outline"} onClick={() => setViewMode("list")}>
          List
        </Button>
        <Button size="sm" variant={viewMode === "family" ? "default" : "outline"} onClick={() => setViewMode("family")}>
          By Family
        </Button>
      </div>

      {/* Grouped by family: parent contact with their children (siblings) together */}
      {viewMode === "family" && (
        <div className="space-y-4">
          {(() => {
            const groups = new Map<string, any[]>();
            for (const child of filtered) {
              const key = child.familyId != null ? String(child.familyId) : "none";
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(child);
            }
            const entries = Array.from(groups.entries()).sort((a, b) => {
              const nameA = a[0] === "none" ? "zzz" : (familyContactById.get(Number(a[0])) ?? "");
              const nameB = b[0] === "none" ? "zzz" : (familyContactById.get(Number(b[0])) ?? "");
              return nameA.localeCompare(nameB);
            });
            if (entries.length === 0) {
              return <Card><CardContent className="py-12 text-center text-muted-foreground">No children match your filters.</CardContent></Card>;
            }
            return entries.map(([key, kids]) => {
              const contact = key === "none" ? "No family on record" : (familyContactById.get(Number(key)) ?? "Family");
              const phone = key === "none" ? null : familyPhoneById.get(Number(key));
              return (
                <Card key={key}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-foreground">{contact}</p>
                        <p className="text-xs text-muted-foreground">
                          {kids.length} {kids.length === 1 ? "child" : "children"}
                          {phone ? ` · ${phone}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {kids.map((child: any) => (
                        <Link key={child.id} href={`/children/${child.id}`}>
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {child.firstName?.[0]}{child.lastName?.[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{child.firstName} {child.lastName}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {classroomByChild.get(child.id) ?? "No room"} · {formatAge(child.dateOfBirth)}
                              </p>
                              <div className="mt-1"><FlagChips flags={flagsByChild.get(child.id) ?? []} limit={2} /></div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>
      )}

      {/* Children Table */}
      {viewMode === "list" && (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Child</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Age</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Classroom</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Health</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Attendance</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Family Contact</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((child: any) => {
                  const initials = `${child.firstName?.[0] ?? ""}${child.lastName?.[0] ?? ""}`;
                  const attendanceRate = attendanceRateByChild.get(child.id);
                  return (
                    <tr key={child.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-sm text-foreground">{child.firstName} {child.lastName}</p>
                            <p className="text-xs text-muted-foreground">DOB: {formatDate(child.dateOfBirth)}</p>
                            <div className="mt-1"><FlagChips flags={flagsByChild.get(child.id) ?? []} limit={3} /></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-foreground">{formatAge(child.dateOfBirth)}</td>
                      <td className="px-4 py-4 text-sm text-foreground">{classroomByChild.get(child.id) ?? "—"}</td>
                      <td className="px-4 py-4">{statusBadge(child.status)}</td>
                      <td className="px-4 py-4">{healthBadge(healthStatusByChild.get(child.id) ?? "current")}</td>
                      <td className="px-4 py-4">
                        {attendanceRate !== undefined ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${attendanceRate >= 90 ? "bg-green-500" : attendanceRate >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${attendanceRate}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{attendanceRate}%</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{familyContactById.get(child.familyId) ?? "—"}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <Link href={`/children/${child.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs">
                              View <ChevronRight className="h-3 w-3" />
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <Link href={`/children/${child.id}`}>
                                <DropdownMenuItem>Edit Profile</DropdownMenuItem>
                              </Link>
                              <Link href={`/children/${child.id}`}>
                                <DropdownMenuItem>Health Records</DropdownMenuItem>
                              </Link>
                              <Link href={`/children/${child.id}`}>
                                <DropdownMenuItem>Attendance History</DropdownMenuItem>
                              </Link>
                              <Link href={`/children/${child.id}`}>
                                <DropdownMenuItem>Family Info</DropdownMenuItem>
                              </Link>
                              <DropdownMenuItem
                                className="text-destructive"
                                disabled={child.status === "withdrawn" || withdrawMutation.isPending}
                                onClick={() => withdrawMutation.mutate({ id: child.id, status: "withdrawn" })}
                              >
                                Withdraw
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Baby className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No children found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
