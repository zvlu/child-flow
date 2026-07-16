import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Tooltip
} from "recharts";
import {
  Info, MoreHorizontal, RefreshCw, ChevronDown,
  FileSpreadsheet, FileText, CalendarDays
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { objectsToCsv, downloadCsv } from "@/lib/csv";

/** Recent PIR-style program years, current first (year starts in the fall).
 * Same convention as PirReportEditor's recentProgramYears — kept local here
 * since this panel's year selector is purely a display label, not a query
 * param (none of this panel's data is year-scoped). */
function recentProgramYears(): string[] {
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return [0, 1, 2, 3].map((o) => {
    const y = startYear - o;
    return `${y}-${y + 1}`;
  });
}

const donutData = (completed: number, total: number, color: string) => [
  { name: "Completed", value: completed, color: color },
  { name: "Incomplete", value: Math.max(0, total - completed), color: "#f1f5f9" },
];

const HEALTH_STATUS_META: Record<string, { label: string; color: string }> = {
  up_to_date: { label: "Up to Date", color: "#22c55e" },
  due_soon: { label: "Due Soon", color: "#f59e0b" },
  overdue: { label: "Overdue", color: "#ef4444" },
  exempt: { label: "Exempt", color: "#8b5cf6" },
  not_required: { label: "Not Required", color: "#94a3b8" },
};

function formatTypeLabel(type: string) {
  return type
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface PanelCardProps {
  title: string;
  children?: React.ReactNode;
  isEmpty?: boolean;
  isLoading?: boolean;
  emptyText?: string;
}

const PanelCard = ({ title, children, isEmpty, isLoading, emptyText = "No Data" }: PanelCardProps) => (
  <Card className="rounded-xl border-none shadow-sm bg-card h-[260px] flex flex-col overflow-hidden transition-all hover:shadow-md">
    <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0 flex-shrink-0">
      <CardTitle className="text-[12px] font-bold text-foreground tracking-tight truncate pr-2 uppercase">{title}</CardTitle>
      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0" />
    </CardHeader>
    <CardContent className="flex-1 flex flex-col items-center justify-center p-3 overflow-hidden">
      {isLoading ? (
        <RefreshCw className="h-6 w-6 text-slate-200 animate-spin" />
      ) : isEmpty ? (
        <p className="text-muted-foreground text-[11px] font-medium text-center px-4 leading-relaxed">{emptyText}</p>
      ) : (
        children
      )}
    </CardContent>
  </Card>
);

const DonutChart = ({ completed, total, color, label, subLabel }: { completed: number, total: number, color: string, label: string, subLabel: string }) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex flex-col items-center w-full h-full justify-center">
      <div className="relative h-28 w-28 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData(completed, total, color)}
              innerRadius={32}
              outerRadius={44}
              paddingAngle={0}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              <Cell fill={color} />
              <Cell fill="#f1f5f9" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-foreground leading-none">{completed}</span>
          <span className="text-[9px] text-muted-foreground text-center leading-tight mt-1 font-medium">
            of {total}<br/>({percentage}%)
          </span>
        </div>
      </div>
      <div className="flex gap-3 mt-3 text-[9px] text-muted-foreground flex-wrap justify-center font-medium">
        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> {label}: {completed}</div>
        <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-muted" /> {subLabel}: {total - completed}</div>
      </div>
    </div>
  );
};

export default function PerformancePanel() {
  const [programYear, setProgramYear] = useState(() => recentProgramYears()[0]);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [pendingYear, setPendingYear] = useState(programYear);
  const [refreshedAt, setRefreshedAt] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );

  // Stable 30-day window so query keys do not churn on re-render.
  const { rangeStart, rangeEnd } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { rangeStart: start, rangeEnd: end };
  }, []);

  const {
    data: classrooms, isLoading: classroomsLoading, refetch: refetchClassrooms,
  } = trpc.classrooms.list.useQuery(ORGANIZATION_ID);
  const {
    data: children, isLoading: childrenLoading, refetch: refetchChildren,
  } = trpc.children.list.useQuery(ORGANIZATION_ID);
  const {
    data: attendanceRows, isLoading: attendanceLoading, refetch: refetchAttendance,
  } = trpc.attendance.getRange.useQuery({
    organizationId: ORGANIZATION_ID,
    start: rangeStart,
    end: rangeEnd,
  });
  const {
    data: healthRecords, isLoading: healthLoading, refetch: refetchHealth,
  } = trpc.health.list.useQuery({
    organizationId: ORGANIZATION_ID,
  });

  const handleRefresh = async () => {
    try {
      await Promise.all([
        refetchClassrooms(),
        refetchChildren(),
        refetchAttendance(),
        refetchHealth(),
      ]);
      setRefreshedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      toast.success("Panel data refreshed");
    } catch {
      toast.error("Refresh failed — please try again");
    }
  };

  const openYearDialog = () => {
    setPendingYear(programYear);
    setYearDialogOpen(true);
  };

  const applyProgramYear = () => {
    setProgramYear(pendingYear);
    setYearDialogOpen(false);
    toast.success(`Switched to program year ${pendingYear}`);
  };

  // "Export as PDF" previously just toasted "coming soon." Building a real
  // PDF renderer would mean adding a new dependency for what the browser
  // already does natively: printing this page (with `.panel-print-hidden`
  // elements — the header controls — hidden via @media print, see the
  // stylesheet block below) and choosing "Save as PDF" is a real, honest
  // PDF export with no new library.
  const handleExportPdf = () => {
    // Let the dropdown menu finish closing before the print snapshot is
    // taken so it doesn't show up over the report (it's also hidden via
    // `print:hidden` below as a second safeguard).
    setTimeout(() => window.print(), 150);
  };

  // "Export as Excel" previously just toasted "coming soon." A true .xlsx
  // workbook would need a new dependency; a CSV (which Excel opens natively)
  // is the same honest-export pattern already used elsewhere in this app
  // (Staff export, ReportBuilder, Billing) and needs no new library.
  const handleExportExcel = () => {
    const rows: Record<string, string | number>[] = [
      { Section: "Enrollment", Metric: "Active Children", Value: activeChildren },
      { Section: "Enrollment", Metric: "Enrolled (by classroom)", Value: totalEnrolledInClassrooms },
      { Section: "Enrollment", Metric: "Total Capacity", Value: totalCapacity },
      {
        Section: "Attendance",
        Metric: "Present (last 30 days)",
        Value: `${attendanceTotals.present} of ${attendanceTotals.total}`,
      },
      { Section: "Health", Metric: "Records Tracked", Value: healthTotal },
      ...healthStatusData.map((s) => ({ Section: "Health — Status", Metric: s.name, Value: s.value })),
      ...enrollmentByClassroom.map((c) => ({
        Section: "Enrollment — By Classroom",
        Metric: c.name,
        Value: `${c.enrolled} of ${c.capacity}`,
      })),
      ...healthByType.map((t) => ({
        Section: "Health — By Type",
        Metric: t.label,
        Value: `${t.ok} of ${t.total} compliant`,
      })),
    ];
    downloadCsv(`performance-panel-${programYear}-${new Date().toISOString().slice(0, 10)}.csv`, objectsToCsv(rows));
    toast.success("Exported panel data");
  };

  // ---- Enrollment ----
  const totalCapacity = useMemo(
    () => (classrooms ?? []).reduce((sum, c) => sum + (c.capacity ?? 0), 0),
    [classrooms]
  );
  const totalEnrolledInClassrooms = useMemo(
    () => (classrooms ?? []).reduce((sum, c) => sum + (c.enrolledCount ?? 0), 0),
    [classrooms]
  );
  const activeChildren = useMemo(
    () => (children ?? []).filter((c) => c.status === "active").length,
    [children]
  );

  const enrollmentByClassroom = useMemo(
    () =>
      (classrooms ?? []).map((c) => ({
        name: c.name,
        enrolled: c.enrolledCount ?? 0,
        capacity: c.capacity ?? 0,
        color: c.color ?? "#3b82f6",
      })),
    [classrooms]
  );

  // ---- Attendance: daily % present over the last 30 days ----
  const attendanceTrend = useMemo(() => {
    if (!attendanceRows) return [];
    const byDay = new Map<string, { date: Date; present: number; total: number }>();
    for (const row of attendanceRows) {
      const d = new Date(row.date);
      const key = d.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, { date: d, present: 0, total: 0 });
      const bucket = byDay.get(key)!;
      bucket.total += 1;
      if (row.status === "present" || row.status === "half_day") bucket.present += 1;
    }
    return Array.from(byDay.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((b) => ({
        name: b.date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
        rate: b.total > 0 ? Math.round((b.present / b.total) * 100) : 0,
      }));
  }, [attendanceRows]);

  const attendanceTotals = useMemo(() => {
    const rows = attendanceRows ?? [];
    const present = rows.filter((r) => r.status === "present" || r.status === "half_day").length;
    return { present, total: rows.length };
  }, [attendanceRows]);

  // ---- Health: status breakdown + per-type compliance ----
  const healthStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const rec of healthRecords ?? []) {
      const status = rec.status ?? "unknown";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, value]) => ({
      name: HEALTH_STATUS_META[status]?.label ?? formatTypeLabel(status),
      value,
      color: HEALTH_STATUS_META[status]?.color ?? "#94a3b8",
    }));
  }, [healthRecords]);

  const healthTotal = healthStatusData.reduce((sum, s) => sum + s.value, 0);

  const healthByType = useMemo(() => {
    const byType = new Map<string, { total: number; ok: number }>();
    for (const rec of healthRecords ?? []) {
      if (!byType.has(rec.type)) byType.set(rec.type, { total: 0, ok: 0 });
      const bucket = byType.get(rec.type)!;
      bucket.total += 1;
      if (rec.status === "up_to_date" || rec.status === "exempt") bucket.ok += 1;
    }
    return Array.from(byType.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([type, { total, ok }]) => ({ type, label: formatTypeLabel(type), total, ok }));
  }, [healthRecords]);

  return (
    <div className="h-full flex flex-col bg-[#FBF6EE] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-card border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-1.5">
              My Performance Panel (Current) <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">Comprehensive program performance tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-[11px] text-muted-foreground">
          <div className="text-right">
            <p className="font-bold text-foreground">{programYear.replace("-", " - ")}</p>
            <p className="font-medium text-muted-foreground">Refreshed Today • {refreshedAt}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 border-border bg-card shadow-sm rounded-xl hover:bg-muted print:hidden">
                <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel>Panel Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openYearDialog}>
                <CalendarDays className="mr-2 h-4 w-4" /> Change Program Year
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="mr-2 h-4 w-4" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Change Program Year dialog */}
      <Dialog open={yearDialogOpen} onOpenChange={setYearDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Program Year</DialogTitle>
            <DialogDescription>
              Choose which program year this panel's header reflects.
            </DialogDescription>
          </DialogHeader>
          <Select value={pendingYear} onValueChange={setPendingYear}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {recentProgramYears().map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYearDialogOpen(false)}>Cancel</Button>
            <Button onClick={applyProgramYear}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1600px] mx-auto">

          {/* Section: Enrollment */}
          <PanelCard
            title="Enrollment"
            isLoading={classroomsLoading}
            isEmpty={!classroomsLoading && totalCapacity === 0}
            emptyText="No classrooms have been configured for this location."
          >
            <DonutChart
              completed={totalEnrolledInClassrooms}
              total={totalCapacity}
              color="#166534"
              label="Enrolled"
              subLabel="Vacancies"
            />
          </PanelCard>

          <PanelCard
            title="Enrollment by Classroom"
            isLoading={classroomsLoading}
            isEmpty={!classroomsLoading && enrollmentByClassroom.length === 0}
            emptyText="No classrooms have been configured for this location."
          >
            <div className="w-full h-full flex flex-col justify-center">
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrollmentByClassroom} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} interval={0} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 11 }} />
                    <Bar dataKey="enrolled" name="Enrolled" radius={[4, 4, 0, 0]} barSize={20} isAnimationActive={false}>
                      {enrollmentByClassroom.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-center gap-3 text-[9px] text-muted-foreground font-bold flex-wrap">
                {enrollmentByClassroom.map((c) => (
                  <span key={c.name} className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} /> {c.name}: {c.enrolled}/{c.capacity}
                  </span>
                ))}
              </div>
            </div>
          </PanelCard>

          <PanelCard
            title="Active Participants"
            isLoading={childrenLoading}
            isEmpty={!childrenLoading && (children?.length ?? 0) === 0}
            emptyText="No participants are enrolled at this location."
          >
            <DonutChart
              completed={activeChildren}
              total={children?.length ?? 0}
              color="#3b82f6"
              label="Active"
              subLabel="Other"
            />
          </PanelCard>

          {/* Section: Attendance */}
          <PanelCard
            title="Attendance (Last 30 Days)"
            isLoading={attendanceLoading}
            isEmpty={!attendanceLoading && attendanceTotals.total === 0}
            emptyText="No attendance has been recorded in the last 30 days."
          >
            <DonutChart
              completed={attendanceTotals.present}
              total={attendanceTotals.total}
              color="#166534"
              label="Present"
              subLabel="Absent"
            />
          </PanelCard>

          <PanelCard
            title="Daily Attendance Rate (30 Days)"
            isLoading={attendanceLoading}
            isEmpty={!attendanceLoading && attendanceTrend.length === 0}
            emptyText="No attendance has been recorded in the last 30 days."
          >
            <div className="w-full h-full flex flex-col justify-center">
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} />
                    <Tooltip formatter={(v) => [`${v}%`, "Present"]} contentStyle={{ borderRadius: "8px", fontSize: 11 }} />
                    <Bar dataKey="rate" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={8} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-center gap-3 text-[9px] text-muted-foreground font-bold">
                <span className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Avg:{" "}
                  {attendanceTrend.length > 0
                    ? Math.round(attendanceTrend.reduce((s, d) => s + d.rate, 0) / attendanceTrend.length)
                    : 0}
                  % present
                </span>
              </div>
            </div>
          </PanelCard>

          {/* Section: Health */}
          <PanelCard
            title="Health Compliance Breakdown"
            isLoading={healthLoading}
            isEmpty={!healthLoading && healthStatusData.length === 0}
            emptyText="No health records exist for this location."
          >
            <div className="w-full h-full flex flex-col justify-center">
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={healthStatusData} innerRadius={0} outerRadius={40} dataKey="value" isAnimationActive={false}>
                      {healthStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 px-4 text-[8px] text-muted-foreground font-bold">
                {healthStatusData.map((e) => (
                  <div key={e.name} className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                    {e.name}: {e.value} ({healthTotal > 0 ? Math.round((e.value / healthTotal) * 100) : 0}%)
                  </div>
                ))}
              </div>
            </div>
          </PanelCard>

          {/* Per-type health requirement donuts */}
          {healthLoading && healthByType.length === 0 ? (
            <PanelCard title="Health Requirements" isLoading />
          ) : (
            healthByType.map((t) => (
              <PanelCard key={t.type} title={t.label} isEmpty={t.total === 0} emptyText={`No ${t.label} records exist.`}>
                <DonutChart
                  completed={t.ok}
                  total={t.total}
                  color={t.ok === t.total ? "#166534" : t.ok / Math.max(t.total, 1) >= 0.7 ? "#f59e0b" : "#ef4444"}
                  label="Up to Date"
                  subLabel="Needs Action"
                />
              </PanelCard>
            ))
          )}

        </div>
      </div>
    </div>
  );
}
