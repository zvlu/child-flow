import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { CheckCircle2, XCircle, Clock, AlertCircle, AlertTriangle, Save, Download, CalendarDays, Loader2, MonitorSmartphone } from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { objectsToCsv, downloadCsv } from "@/lib/csv";

type AttendanceStatus = "present" | "absent" | "excused" | "half_day";

const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: typeof CheckCircle2; iconColor: string }> = {
  present: { label: "Present", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2, iconColor: "text-green-500" },
  absent: { label: "Absent", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle, iconColor: "text-red-500" },
  excused: { label: "Excused", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle, iconColor: "text-yellow-500" },
  half_day: { label: "Half Day", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock, iconColor: "text-blue-500" },
};

const startOfDay = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export default function Attendance() {
  const [date, setDate] = useState<Date>(() => startOfDay(new Date()));
  const [classroom, setClassroom] = useState("all");
  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});

  const utils = trpc.useUtils();
  const childrenQuery = trpc.children.list.useQuery(ORGANIZATION_ID);
  const classroomMapQuery = trpc.children.classroomMap.useQuery(ORGANIZATION_ID);
  const classroomsQuery = trpc.classrooms.list.useQuery(ORGANIZATION_ID);
  const dayQuery = trpc.attendance.getByDate.useQuery({ organizationId: ORGANIZATION_ID, date });
  // "Cleared to attend" participation status (server/participationClearance.ts)
  // — org-wide in one query, looked up per-child below.
  const clearanceQuery = trpc.health.clearance.useQuery({ organizationId: ORGANIZATION_ID });

  // Current week (Mon-Fri) for the weekly overview chart
  const { weekStart, weekEnd } = useMemo(() => {
    const base = startOfDay(new Date());
    const diffToMonday = (base.getDay() + 6) % 7;
    const start = new Date(base);
    start.setDate(base.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 4);
    end.setHours(23, 59, 59, 999);
    return { weekStart: start, weekEnd: end };
  }, []);
  const rangeQuery = trpc.attendance.getRange.useQuery({ organizationId: ORGANIZATION_ID, start: weekStart, end: weekEnd });

  const roster = useMemo(() => {
    const classroomByChild = new Map((classroomMapQuery.data ?? []).map(m => [m.childId, m.classroomName]));
    return (childrenQuery.data ?? []).map(c => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      classroom: classroomByChild.get(c.id) ?? "Unassigned",
    }));
  }, [childrenQuery.data, classroomMapQuery.data]);

  const recordByChild = useMemo(
    () => new Map((dayQuery.data ?? []).map(r => [r.childId, r])),
    [dayQuery.data]
  );

  const clearanceByChild = useMemo(() => {
    const m = new Map<number, { cleared: boolean; blockers: { code: string; label: string }[] }>();
    ((clearanceQuery.data ?? []) as any[]).forEach((c) => m.set(c.childId, c));
    return m;
  }, [clearanceQuery.data]);

  // Initialize local attendance state from the saved records for the selected day
  useEffect(() => {
    const next: Record<number, AttendanceStatus> = {};
    for (const child of roster) {
      const rec = recordByChild.get(child.id);
      next[child.id] = (rec?.status as AttendanceStatus | undefined) ?? "present";
    }
    setAttendance(next);
  }, [roster, recordByChild]);

  const saveMutation = trpc.attendance.save.useMutation({
    onSuccess: () => {
      utils.attendance.getByDate.invalidate();
      utils.attendance.getRange.invalidate();
      toast.success("Attendance saved");
    },
    onError: (err) => toast.error(err.message || "Failed to save attendance"),
  });

  const handleSave = () => {
    if (roster.length === 0) {
      toast.error("No children to record attendance for");
      return;
    }
    saveMutation.mutate({
      organizationId: ORGANIZATION_ID,
      date,
      records: roster.map(child => {
        const existing = recordByChild.get(child.id);
        return {
          childId: child.id,
          status: attendance[child.id] ?? "present",
          checkInTime: existing?.checkInTime ? new Date(existing.checkInTime) : null,
          checkOutTime: existing?.checkOutTime ? new Date(existing.checkOutTime) : null,
          notes: existing?.notes ?? null,
        };
      }),
    });
  };

  const classroomNames = useMemo(() => {
    const fromList = (classroomsQuery.data ?? []).map(c => c.name);
    if (fromList.length > 0) return fromList;
    return Array.from(new Set((classroomMapQuery.data ?? []).map(m => m.classroomName))).sort();
  }, [classroomsQuery.data, classroomMapQuery.data]);

  const filtered = roster.filter(c => classroom === "all" || c.classroom === classroom);
  const statusOf = (id: number): AttendanceStatus => attendance[id] ?? "present";
  const presentCount = roster.filter(c => statusOf(c.id) === "present").length;
  const absentCount = roster.filter(c => statusOf(c.id) === "absent").length;
  const excusedCount = roster.filter(c => statusOf(c.id) === "excused").length;
  const rate = roster.length > 0 ? Math.round((presentCount / roster.length) * 100) : 0;

  const exportAttendance = () => {
    if (filtered.length === 0) { toast.message("No roster to export."); return; }
    const rows = filtered.map((c) => ({
      child: c.name,
      classroom: c.classroom,
      status: statusConfig[statusOf(c.id)].label,
      date: date.toLocaleDateString(),
    }));
    downloadCsv(`attendance-${date.toISOString().slice(0, 10)}.csv`, objectsToCsv(rows));
    toast.success(`Exported ${rows.length} attendance record${rows.length === 1 ? "" : "s"} to CSV`);
  };

  const setStatus = (id: number, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [id]: status }));
  };

  // Weekly chart data built from the saved attendance rows for this week
  const weeklyData = useMemo(() => {
    const counts = new Map<string, { present: number; absent: number }>();
    for (const row of rangeQuery.data ?? []) {
      const key = startOfDay(new Date(row.date)).toDateString();
      const entry = counts.get(key) ?? { present: 0, absent: 0 };
      if (row.status === "present") entry.present += 1;
      if (row.status === "absent") entry.absent += 1;
      counts.set(key, entry);
    }
    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const entry = counts.get(d.toDateString()) ?? { present: 0, absent: 0 };
      days.push({
        day: `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getMonth() + 1}/${d.getDate()}`,
        present: entry.present,
        absent: entry.absent,
      });
    }
    return days;
  }, [rangeQuery.data, weekStart]);

  const weekRangeLabel = `${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${new Date(weekEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  // Saved stats for the selected calendar day
  const dayRecords = dayQuery.data ?? [];
  const dayPresent = dayRecords.filter(r => r.status === "present").length;
  const dayAbsent = dayRecords.filter(r => r.status === "absent").length;
  const dayRate = roster.length > 0 ? Math.round((dayPresent / roster.length) * 100) : 0;

  const isRosterLoading = childrenQuery.isLoading || classroomMapQuery.isLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/kiosk">
            <Button variant="outline" size="sm" className="gap-2">
              <MonitorSmartphone className="h-4 w-4" />Kiosk Mode
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportAttendance}><Download className="h-4 w-4" />Export</Button>
          <Button size="sm" className="gap-2" onClick={handleSave} disabled={saveMutation.isPending || isRosterLoading}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Attendance
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total", value: roster.length, color: "text-foreground", bg: "bg-muted/30" },
          { label: "Present", value: presentCount, color: "text-green-600", bg: "bg-green-50" },
          { label: "Absent", value: absentCount, color: "text-red-600", bg: "bg-red-50" },
          { label: "Excused", value: excusedCount, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Rate", value: `${rate}%`, color: rate >= 90 ? "text-green-600" : rate >= 80 ? "text-yellow-600" : "text-red-600", bg: "bg-primary/5" },
        ].map(stat => (
          <Card key={stat.label} className={stat.bg}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today's Attendance</TabsTrigger>
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={classroom} onValueChange={setClassroom}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Classroom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classrooms</SelectItem>
                {classroomNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filtered.length} children</span>
          </div>

          <Card>
            <CardContent className="p-0">
              {isRosterLoading || dayQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  No children found{classroom !== "all" ? " in this classroom" : ""}.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map(child => {
                    const currentStatus = statusOf(child.id);
                    const initials = child.name.split(" ").map(n => n[0]).join("");
                    const clr = clearanceByChild.get(child.id);
                    const blocked = !!clr && !clr.cleared;
                    return (
                      <div key={child.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/20 transition-colors">
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-foreground">{child.name}</p>
                            {blocked && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700"
                                title={`Not cleared to attend: ${clr!.blockers.map(b => b.label).join(", ")}`}
                              >
                                <AlertTriangle className="h-3 w-3" /> Not cleared
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{child.classroom}</p>
                          {blocked && (
                            <p className="text-[11px] text-amber-700/80 mt-0.5 truncate" title={clr!.blockers.map(b => b.label).join(" · ")}>
                              {clr!.blockers.map(b => b.label).join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(Object.entries(statusConfig) as [AttendanceStatus, typeof statusConfig[AttendanceStatus]][]).map(([key, cfg]) => {
                            const Icon = cfg.icon;
                            const isSelected = currentStatus === key;
                            return (
                              <button
                                key={key}
                                onClick={() => setStatus(child.id, key)}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                                  isSelected ? cfg.color : "bg-background text-muted-foreground border-border hover:bg-muted/30"
                                )}
                              >
                                <Icon className={cn("h-3.5 w-3.5", isSelected ? cfg.iconColor : "text-muted-foreground")} />
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Weekly Attendance Overview</CardTitle>
              <CardDescription>{weekRangeLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              {rangeQuery.isLoading ? (
                <div className="flex items-center justify-center h-[280px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={weeklyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                    <Bar dataKey="present" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} name="Present" />
                    <Bar dataKey="absent" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} name="Absent" opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <div className="flex gap-6">
            <Card className="w-fit">
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(startOfDay(d))}
                  className="rounded-md"
                />
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dayQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : dayRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No attendance has been recorded for this day yet.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{dayPresent}</p>
                      <p className="text-xs text-muted-foreground">Present</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{dayAbsent}</p>
                      <p className="text-xs text-muted-foreground">Absent</p>
                    </div>
                    <div className="text-center p-3 bg-primary/5 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{dayRate}%</p>
                      <p className="text-xs text-muted-foreground">Rate</p>
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">Click a date on the calendar to view or edit attendance records for that day.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
