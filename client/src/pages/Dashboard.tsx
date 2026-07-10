import { useMemo } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  Baby, Users, ClipboardCheck, Heart, AlertTriangle, TrendingUp,
  Calendar, ArrowRight, Home, ShieldCheck,
  Activity, Bell, Loader2
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useActionItems } from "@/hooks/useActionItems";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

const quickActions = [
  { label: "Take Attendance", href: "/attendance", icon: ClipboardCheck, color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" },
  { label: "Add Child", href: "/enrollment", icon: Baby, color: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200" },
  { label: "Health Records", href: "/health", icon: Heart, color: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200" },
  { label: "Family Services", href: "/family-services", icon: Home, color: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200" },
  { label: "Run Report", href: "/reports", icon: Activity, color: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200" },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck, color: "bg-[#F1F6F2] text-[#3C5E47] hover:bg-[#E7F0E9] border-[#CFE0D3]" },
];

const severityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

const HEALTH_STATUS_COLORS: Record<string, string> = {
  up_to_date: "#22c55e",
  due_soon: "#f59e0b",
  overdue: "#ef4444",
  exempt: "#8b5cf6",
  not_required: "#94a3b8",
};

const HEALTH_STATUS_LABELS: Record<string, string> = {
  up_to_date: "Up to Date",
  due_soon: "Due Soon",
  overdue: "Overdue",
  exempt: "Exempt",
  not_required: "Not Required",
};

function formatTypeLabel(type: string) {
  return type
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function Dashboard() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Stable date boundaries so query keys do not churn on each render.
  const { rangeStart, rangeEnd } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - 13);
    start.setHours(0, 0, 0, 0);
    return { rangeStart: start, rangeEnd: end };
  }, []);

  const reduced = useReducedMotion() ?? false;
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(ORGANIZATION_ID);
  // Unified action feed (shared with the Action Queue page) — health
  // follow-ups, AI insights, documents, credentials, chronic absence.
  const { items: actionItems } = useActionItems();
  const { data: attendanceRows } = trpc.attendance.getRange.useQuery({
    organizationId: ORGANIZATION_ID,
    start: rangeStart,
    end: rangeEnd,
  });
  const { data: healthRecords } = trpc.health.list.useQuery({ organizationId: ORGANIZATION_ID });
  const { data: children } = trpc.children.list.useQuery(ORGANIZATION_ID);

  // ---- KPI cards (derived from dashboard.stats) ----
  const kpiCards = useMemo(() => {
    const attendanceRate = stats?.attendanceToday?.rate;
    return [
      {
        title: "Total Enrolled",
        value: stats ? String(stats.activeChildren) : "—",
        subtext: stats ? `${stats.totalChildren} total on record` : "Loading...",
        href: "/children?status=active",
        borderClass: "border-l-primary",
        iconBgClass: "bg-primary/10",
        iconClass: "text-primary",
        subtextClass: "text-xs text-green-600 flex items-center gap-1 mt-1",
        icon: Baby,
        trendIcon: TrendingUp,
      },
      {
        title: "Present Today",
        value: stats ? String(stats.attendanceToday.present) : "—",
        subtext: stats
          ? attendanceRate != null
            ? `${attendanceRate}% attendance rate`
            : "No attendance recorded yet"
          : "Loading...",
        href: "/attendance",
        borderClass: "border-l-blue-500",
        iconBgClass: "bg-blue-50",
        iconClass: "text-blue-500",
        subtextClass: "text-xs text-muted-foreground mt-1",
        icon: ClipboardCheck,
        trendIcon: undefined as typeof TrendingUp | undefined,
      },
      {
        title: "Staff Members",
        value: stats ? String(stats.staffCount) : "—",
        subtext: stats ? `${stats.pendingSignatures} signatures pending` : "Loading...",
        href: "/staff",
        borderClass: "border-l-purple-500",
        iconBgClass: "bg-purple-50",
        iconClass: "text-purple-500",
        subtextClass: "text-xs text-muted-foreground mt-1",
        icon: Users,
        trendIcon: undefined as typeof TrendingUp | undefined,
      },
      {
        title: "Pending Actions",
        value: stats ? String(stats.openActionItems) : "—",
        subtext: stats ? `${stats.health.overdue} overdue health items` : "Loading...",
        href: "/action-queue",
        borderClass: "border-l-amber-500",
        iconBgClass: "bg-amber-50",
        iconClass: "text-amber-500",
        subtextClass: "text-xs text-red-500 flex items-center gap-1 mt-1",
        icon: Bell,
        trendIcon: AlertTriangle as typeof TrendingUp | undefined,
      },
    ];
  }, [stats]);

  // ---- Attendance chart: last 14 days grouped by day ----
  const attendanceData = useMemo(() => {
    if (!attendanceRows || attendanceRows.length === 0) return [];
    const byDay = new Map<string, { date: Date; present: number; absent: number }>();
    for (const row of attendanceRows) {
      const d = new Date(row.date);
      const key = d.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, { date: d, present: 0, absent: 0 });
      const bucket = byDay.get(key)!;
      if (row.status === "present" || row.status === "half_day") bucket.present += 1;
      else bucket.absent += 1;
    }
    return Array.from(byDay.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((b) => ({
        day: b.date.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
        present: b.present,
        absent: b.absent,
      }));
  }, [attendanceRows]);

  // ---- Health status pie: count records by status ----
  const healthStatus = useMemo(() => {
    if (!healthRecords) return [];
    const counts = new Map<string, number>();
    for (const rec of healthRecords) {
      const status = rec.status ?? "unknown";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, value]) => ({
      name: HEALTH_STATUS_LABELS[status] ?? formatTypeLabel(status),
      value,
      color: HEALTH_STATUS_COLORS[status] ?? "#94a3b8",
    }));
  }, [healthRecords]);

  // ---- "Needs attention today": top open items from the unified feed ----
  const alerts = useMemo(() => {
    return actionItems
      .filter((item) => item.status !== "completed")
      .map((item) => ({
        id: item.id,
        message: item.title,
        severity: (item.status === "urgent" ? "high" : "medium") as "high" | "medium" | "low",
        time: item.due,
        href: item.href ?? "/action-queue",
      }));
  }, [actionItems]);

  // ---- Upcoming events (from dashboard.stats) ----
  const upcomingEvents = stats?.upcomingEvents ?? [];

  // ---- Enrollment trend: cumulative enrollment per month (last 6 months) ----
  const enrollmentTrend = useMemo(() => {
    if (!children || children.length === 0) return [];
    const now = new Date();
    const months: { label: string; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      months.push({
        label: new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleDateString("en-US", { month: "short" }),
        end,
      });
    }
    return months.map((m) => ({
      month: m.label,
      enrolled: children.filter(
        (c) => c.enrollmentDate && new Date(c.enrollmentDate).getTime() <= m.end.getTime() && c.status !== "withdrawn"
      ).length,
    }));
  }, [children]);

  const enrollmentGrowth = useMemo(() => {
    if (enrollmentTrend.length < 2) return null;
    const first = enrollmentTrend[0].enrolled;
    const last = enrollmentTrend[enrollmentTrend.length - 1].enrolled;
    if (first === 0) return null;
    return Math.round(((last - first) / first) * 1000) / 10;
  }, [enrollmentTrend]);

  // ---- Compliance overview: % up to date per health record type ----
  const complianceItems = useMemo(() => {
    if (!healthRecords || healthRecords.length === 0) return [];
    const byType = new Map<string, { total: number; ok: number }>();
    for (const rec of healthRecords) {
      if (rec.status === "not_required") continue;
      if (!byType.has(rec.type)) byType.set(rec.type, { total: 0, ok: 0 });
      const bucket = byType.get(rec.type)!;
      bucket.total += 1;
      if (rec.status === "up_to_date" || rec.status === "exempt") bucket.ok += 1;
    }
    return Array.from(byType.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 4)
      .map(([type, { total, ok }]) => {
        const value = total > 0 ? Math.round((ok / total) * 100) : 0;
        return {
          label: formatTypeLabel(type),
          value,
          color: value >= 90 ? "bg-green-500" : value >= 70 ? "bg-amber-500" : "bg-red-500",
        };
      });
  }, [healthRecords]);

  if (statsLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-green-700 border-green-300 bg-green-50">
            <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
            Program Active
          </Badge>
        </div>
      </div>

      {/* First-run setup guide — renders only while setup is incomplete */}
      <OnboardingChecklist />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const TrendIcon = card.trendIcon;

          return (
            <Link key={card.title} href={card.href} asChild>
              <a className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                <motion.div
                  whileHover={reduced ? undefined : { y: -4, scale: 1.01 }}
                  whileTap={reduced ? undefined : { scale: 0.99 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                >
                <Card className={`border-l-4 ${card.borderClass} transition-shadow duration-150 hover:shadow-lg cursor-pointer`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{card.value}</p>
                        <p className={card.subtextClass}>
                          {TrendIcon && <TrendIcon className="h-3 w-3" />}
                          {card.subtext}
                        </p>
                      </div>
                      <div className={`h-12 w-12 rounded-xl ${card.iconBgClass} flex items-center justify-center`}>
                        <Icon className={`h-6 w-6 ${card.iconClass}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                </motion.div>
              </a>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href} asChild>
                  <a className="block">
                    <motion.div
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer ${action.color}`}
                      whileHover={reduced ? undefined : { y: -3, scale: 1.04 }}
                      whileTap={reduced ? undefined : { scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 320, damping: 20 }}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
                    </motion.div>
                  </a>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attendance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Attendance</CardTitle>
                <CardDescription>Daily present vs. absent — last 14 days</CardDescription>
              </div>
              <Link href="/attendance">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View All <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {attendanceData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                No attendance recorded in the last 14 days.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={attendanceData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: 12 }}
                  />
                  <Bar dataKey="present" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} name="Present" />
                  <Bar dataKey="absent" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} name="Absent" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Health Status */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Health Status</CardTitle>
                <CardDescription>
                  {stats?.health.complianceRate != null
                    ? `${stats.health.complianceRate}% compliant`
                    : "Record compliance"}
                </CardDescription>
              </div>
              <Link href="/health">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {healthStatus.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                No health records yet.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={healthStatus} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {healthStatus.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {healthStatus.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Needs Attention Today
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{alerts.length}</Badge>
                <Link href="/action-queue">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    View all <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No open action items. Nice work!</p>
            ) : (
              alerts.slice(0, 5).map((alert) => (
                <Link key={alert.id} href={alert.href} asChild>
                  <a className={`flex items-start gap-3 p-3 rounded-lg border text-sm transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${severityColors[alert.severity]}`}>
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{alert.message}</p>
                      <p className="text-xs opacity-70 mt-0.5">{alert.time}</p>
                    </div>
                  </a>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No upcoming events scheduled.</p>
            ) : (
              upcomingEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-start gap-3">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: event.color ? `${event.color}20` : undefined }}
                  >
                    <Calendar className="h-4 w-4" style={{ color: event.color ?? "var(--color-primary)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTypeLabel(event.eventType ?? "event")}
                      {event.location ? ` — ${event.location}` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(event.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enrollment Trend */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Enrollment Trend</CardTitle>
              <CardDescription>Cumulative enrollment — last 6 months</CardDescription>
            </div>
            {enrollmentGrowth != null && (
              <div className={`flex items-center gap-1 text-sm font-medium ${enrollmentGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                <TrendingUp className="h-4 w-4" />
                {enrollmentGrowth >= 0 ? "+" : ""}{enrollmentGrowth}% over period
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {enrollmentTrend.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
              No enrollment data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={enrollmentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: 12 }} />
                <Line type="monotone" dataKey="enrolled" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--color-chart-1)" }} name="Enrolled" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Compliance Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Compliance Overview
            </CardTitle>
            <Link href="/compliance">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Full Report <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {complianceItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">No health requirement data yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {complianceItems.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground font-medium">{item.label}</span>
                    <span className="font-bold">{item.value}%</span>
                  </div>
                  <Progress value={item.value} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
