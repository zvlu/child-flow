import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  Baby, Users, ClipboardCheck, Heart, AlertTriangle, TrendingUp, TrendingDown,
  Calendar, CheckCircle2, Clock, ArrowRight, BookOpen, Home, ShieldCheck,
  Activity, Star, Bell
} from "lucide-react";

// Mock data for demo
const attendanceData = [
  { day: "Mon", present: 42, absent: 5 },
  { day: "Tue", present: 45, absent: 3 },
  { day: "Wed", present: 40, absent: 7 },
  { day: "Thu", present: 44, absent: 4 },
  { day: "Fri", present: 38, absent: 9 },
];

const enrollmentTrend = [
  { month: "Sep", enrolled: 38 },
  { month: "Oct", enrolled: 42 },
  { month: "Nov", enrolled: 44 },
  { month: "Dec", enrolled: 43 },
  { month: "Jan", enrolled: 46 },
  { month: "Feb", enrolled: 47 },
];

const healthStatus = [
  { name: "Up to Date", value: 38, color: "#22c55e" },
  { name: "Due Soon", value: 7, color: "#f59e0b" },
  { name: "Overdue", value: 3, color: "#ef4444" },
];

const alerts = [
  { id: 1, type: "health", message: "3 children have overdue immunizations", severity: "high", time: "Today" },
  { id: 2, type: "attendance", message: "Attendance below 85% for 4 children this month", severity: "medium", time: "Today" },
  { id: 3, type: "enrollment", message: "5 applications pending review", severity: "low", time: "2 days ago" },
  { id: 4, type: "compliance", message: "PIR submission due in 14 days", severity: "medium", time: "Ongoing" },
];

const recentActivity = [
  { id: 1, action: "Attendance recorded", detail: "Room A — 15 present", time: "9:02 AM", icon: ClipboardCheck },
  { id: 2, action: "Health record updated", detail: "Emma Johnson — Dental exam", time: "8:45 AM", icon: Heart },
  { id: 3, action: "New enrollment", detail: "Marcus Williams — Waitlist approved", time: "Yesterday", icon: BookOpen },
  { id: 4, action: "Family visit logged", detail: "Rodriguez family — Home visit", time: "Yesterday", icon: Home },
];

const quickActions = [
  { label: "Take Attendance", href: "/attendance", icon: ClipboardCheck, color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" },
  { label: "Add Child", href: "/enrollment", icon: Baby, color: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200" },
  { label: "Health Records", href: "/health", icon: Heart, color: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200" },
  { label: "Family Services", href: "/family-services", icon: Home, color: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200" },
  { label: "Run Report", href: "/reports", icon: Activity, color: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200" },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck, color: "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200" },
];

const kpiCards = [
  {
    title: "Total Enrolled",
    value: "47",
    subtext: "+2 this month",
    href: "/children",
    borderClass: "border-l-primary",
    iconBgClass: "bg-primary/10",
    iconClass: "text-primary",
    subtextClass: "text-xs text-green-600 flex items-center gap-1 mt-1",
    icon: Baby,
    trendIcon: TrendingUp,
  },
  {
    title: "Present Today",
    value: "42",
    subtext: "89% attendance rate",
    href: "/attendance",
    borderClass: "border-l-blue-500",
    iconBgClass: "bg-blue-50",
    iconClass: "text-blue-500",
    subtextClass: "text-xs text-muted-foreground mt-1",
    icon: ClipboardCheck,
  },
  {
    title: "Staff Members",
    value: "12",
    subtext: "10 active today",
    href: "/staff",
    borderClass: "border-l-purple-500",
    iconBgClass: "bg-purple-50",
    iconClass: "text-purple-500",
    subtextClass: "text-xs text-muted-foreground mt-1",
    icon: Users,
  },
  {
    title: "Pending Actions",
    value: "8",
    subtext: "3 urgent",
    href: "/action-queue",
    borderClass: "border-l-amber-500",
    iconBgClass: "bg-amber-50",
    iconClass: "text-amber-500",
    subtextClass: "text-xs text-red-500 flex items-center gap-1 mt-1",
    icon: Bell,
    trendIcon: AlertTriangle,
  },
];

const severityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function Dashboard() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const TrendIcon = card.trendIcon;

          return (
            <Link key={card.title} href={card.href}>
              <a className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                <Card className={`border-l-4 ${card.borderClass} transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer`}>
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
                <Link key={action.href} href={action.href}>
                  <a className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-150 cursor-pointer ${action.color}`}>
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
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
                <CardTitle className="text-base">This Week's Attendance</CardTitle>
                <CardDescription>Daily present vs. absent</CardDescription>
              </div>
              <Link href="/attendance">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View All <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={attendanceData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: 12 }}
                />
                <Bar dataKey="present" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} name="Present" />
                <Bar dataKey="absent" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} name="Absent" opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Health Status */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Health Status</CardTitle>
                <CardDescription>Immunization compliance</CardDescription>
              </div>
              <Link href="/health">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  View <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
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
                Action Items
              </CardTitle>
              <Badge variant="secondary">{alerts.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <Link key={alert.id} href="/action-queue">
                <a className={`flex items-start gap-3 p-3 rounded-lg border text-sm transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${severityColors[alert.severity]}`}>
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-xs opacity-70 mt-0.5">{alert.time}</p>
                  </div>
                </a>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{item.time}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Enrollment Trend */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Enrollment Trend</CardTitle>
              <CardDescription>Monthly enrollment count — current program year</CardDescription>
            </div>
            <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
              <TrendingUp className="h-4 w-4" />
              +23.7% YoY
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={enrollmentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[30, 55]} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: 12 }} />
              <Line type="monotone" dataKey="enrolled" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--color-chart-1)" }} name="Enrolled" />
            </LineChart>
          </ResponsiveContainer>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Health Screenings", value: 92, color: "bg-green-500" },
              { label: "Immunizations", value: 81, color: "bg-amber-500" },
              { label: "Family Contacts", value: 96, color: "bg-green-500" },
              { label: "PIR Readiness", value: 74, color: "bg-amber-500" },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">{item.label}</span>
                  <span className="font-bold">{item.value}%</span>
                </div>
                <Progress value={item.value} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
