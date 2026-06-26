import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Download, FileText, BarChart3, TrendingUp, Users, Heart, ClipboardCheck, ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { objectsToCsv, downloadCsv } from "@/lib/csv";
import { StaffActivityReport } from "@/components/StaffActivityReport";

const attendanceByMonth = [
  { month: "Sep", rate: 88 }, { month: "Oct", rate: 91 }, { month: "Nov", rate: 87 },
  { month: "Dec", rate: 84 }, { month: "Jan", rate: 90 }, { month: "Feb", rate: 92 },
  { month: "Mar", rate: 89 }, { month: "Apr", rate: 91 },
];

const enrollmentByClassroom = [
  { classroom: "Room A", enrolled: 16, capacity: 17 },
  { classroom: "Room B", enrolled: 16, capacity: 17 },
  { classroom: "Room C", enrolled: 15, capacity: 17 },
];

const healthCompliance = [
  { name: "Physical Exams", compliant: 44, total: 47 },
  { name: "Dental Exams", compliant: 38, total: 47 },
  { name: "Vision Screening", compliant: 45, total: 47 },
  { name: "Hearing Screening", compliant: 46, total: 47 },
  { name: "Immunizations", compliant: 40, total: 47 },
];

const demographicsData = [
  { name: "White", value: 12 },
  { name: "Black/African American", value: 18 },
  { name: "Hispanic/Latino", value: 11 },
  { name: "Asian", value: 4 },
  { name: "Two or More Races", value: 2 },
];

const COLORS = ["#4ade80", "#60a5fa", "#f59e0b", "#a78bfa", "#f87171"];

const savedReports = [
  { name: "Monthly Attendance Summary", type: "Attendance", lastRun: "Nov 1, 2024", format: "PDF" },
  { name: "Health Compliance Report", type: "Health", lastRun: "Oct 31, 2024", format: "Excel" },
  { name: "PIR Data Extract", type: "Compliance", lastRun: "Oct 15, 2024", format: "CSV" },
  { name: "Family Services Log", type: "Family Services", lastRun: "Nov 1, 2024", format: "PDF" },
  { name: "Staff Training Hours", type: "Staff", lastRun: "Oct 30, 2024", format: "Excel" },
];

const reportTemplates = [
  { name: "Program Information Report (PIR)", description: "Annual federal reporting for Head Start programs", icon: ShieldCheck, color: "text-red-500 bg-red-50" },
  { name: "Attendance Report", description: "Daily, weekly, and monthly attendance summaries", icon: ClipboardCheck, color: "text-blue-500 bg-blue-50" },
  { name: "Health Screening Report", description: "Compliance tracking for all health screenings", icon: Heart, color: "text-pink-500 bg-pink-50" },
  { name: "Enrollment Report", description: "Current enrollment, waitlist, and capacity data", icon: Users, color: "text-green-500 bg-green-50" },
  { name: "Family Services Report", description: "Home visits, contacts, and service referrals", icon: FileText, color: "text-purple-500 bg-purple-50" },
  { name: "Child Assessment Report", description: "Developmental assessment results and trends", icon: BarChart3, color: "text-amber-500 bg-amber-50" },
  { name: "Staff Training Report", description: "Training hours, certifications, and compliance", icon: TrendingUp, color: "text-[#5E8C6A] bg-[#F1F6F2]" },
  { name: "Income Eligibility Report", description: "Family income levels and eligibility verification", icon: FileText, color: "text-indigo-500 bg-indigo-50" },
];

export default function Reports() {
  const orgId = ORGANIZATION_ID;
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [busy, setBusy] = useState<string | null>(null);

  const today = () => new Date().toISOString().slice(0, 10);
  const runExport = async (key: string, fileBase: string, fetcher: () => Promise<any[]>) => {
    setBusy(key);
    try {
      const rows = await fetcher();
      if (!rows || rows.length === 0) { toast.message("No data to export yet."); return; }
      downloadCsv(`${fileBase}-${today()}.csv`, objectsToCsv(rows as Record<string, any>[]));
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} to CSV`);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setBusy(null);
    }
  };

  // Each export pulls live data on demand via the query cache's imperative fetch.
  const fetchAttendance = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return utils.attendance.getRange.fetch({ organizationId: orgId, start, end });
  };
  const exporters: Record<string, { file: string; fetch: () => Promise<any[]> }> = {
    "Attendance Report": { file: "attendance-30d", fetch: fetchAttendance },
    "Health Screening Report": { file: "health-screenings", fetch: () => utils.health.list.fetch({ organizationId: orgId }) },
    "Enrollment Report": { file: "enrollment-applications", fetch: () => utils.enrollment.list.fetch(orgId) },
    "Family Services Report": { file: "family-services", fetch: () => utils.familyServices.list.fetch({ organizationId: orgId }) },
    "Child Assessment Report": { file: "assessments", fetch: () => utils.education.list.fetch({ organizationId: orgId }) },
    "Staff Training Report": { file: "certifications", fetch: () => utils.staffOps.certifications.fetch(orgId) },
    "Income Eligibility Report": {
      file: "income-eligibility",
      fetch: async () => {
        const apps = await utils.enrollment.list.fetch(orgId);
        return apps.map((a) => ({
          child: `${a.childFirstName} ${a.childLastName}`,
          incomeLevel: a.incomeLevel ?? "",
          householdSize: a.householdSize ?? "",
          status: a.status,
        }));
      },
    },
  };

  const onTemplate = (name: string) => {
    if (name.includes("PIR")) { navigate("/compliance"); return; }
    const ex = exporters[name];
    if (!ex) { toast.message("This report isn't available yet."); return; }
    runExport(name, ex.file, ex.fetch);
  };

  // Saved-report "Download" maps the report type to a live CSV export.
  const onSavedDownload = (type: string) => {
    const byType: Record<string, { file: string; fetch: () => Promise<any[]> }> = {
      Attendance: exporters["Attendance Report"],
      Health: exporters["Health Screening Report"],
      "Family Services": exporters["Family Services Report"],
      Staff: exporters["Staff Training Report"],
      Compliance: { file: "children-roster", fetch: () => utils.children.list.fetch(orgId) },
    };
    const ex = byType[type] ?? { file: "children-roster", fetch: () => utils.children.list.fetch(orgId) };
    runExport(`saved-${type}`, ex.file, ex.fetch);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Generate reports, view analytics, and export data</p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="2024-2025">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024-2025">2024-2025</SelectItem>
              <SelectItem value="2023-2024">2023-2024</SelectItem>
              <SelectItem value="2022-2023">2022-2023</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" disabled={busy === "all"} onClick={() => runExport("all", "children-roster", () => utils.children.list.fetch(orgId))}>
            {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Export All
          </Button>
        </div>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">Analytics Dashboard</TabsTrigger>
          <TabsTrigger value="staff-activity">Staff Activity</TabsTrigger>
          <TabsTrigger value="templates">Report Templates</TabsTrigger>
          <TabsTrigger value="saved">Saved Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="staff-activity" className="mt-4">
          <StaffActivityReport />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          {/* Attendance Trend */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Attendance Rate Trend</CardTitle>
                  <CardDescription>Monthly average attendance rate — 2024-2025 program year</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-2 text-xs" disabled={busy === "Attendance Report"} onClick={() => onTemplate("Attendance Report")}>
                  {busy === "Attendance Report" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={attendanceByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[75, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "Attendance Rate"]} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                  <Line type="monotone" dataKey="rate" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Enrollment by Classroom */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Enrollment by Classroom</CardTitle>
                <CardDescription>Current enrollment vs. capacity</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={enrollmentByClassroom} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="classroom" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                    <Bar dataKey="enrolled" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} name="Enrolled" />
                    <Bar dataKey="capacity" fill="var(--color-border)" radius={[4, 4, 0, 0]} name="Capacity" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Demographics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Child Demographics</CardTitle>
                <CardDescription>Race/ethnicity breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={demographicsData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                        {demographicsData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {demographicsData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[index % COLORS.length] }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Health Compliance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Health Compliance Overview</CardTitle>
              <CardDescription>Number of children with completed screenings</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={healthCompliance} layout="vertical" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12 }} domain={[0, 50]} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={130} />
                  <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                  <Bar dataKey="compliant" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} name="Compliant" />
                  <Bar dataKey="total" fill="var(--color-border)" radius={[0, 4, 4, 0]} name="Total" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reportTemplates.map(template => {
              const Icon = template.icon;
              const [iconColor, bgColor] = template.color.split(" ");
              return (
                <Card key={template.name} className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardContent className="p-5">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${bgColor}`}>
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground leading-tight">{template.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{template.description}</p>
                    <Button variant="outline" size="sm" disabled={busy === template.name} onClick={() => onTemplate(template.name)} className="w-full mt-4 text-xs gap-1 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {busy === template.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                      {template.name.includes("PIR") ? "Open PIR" : "Generate CSV"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="saved" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recently Generated Reports</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {savedReports.map((report, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">{report.name}</p>
                      <p className="text-xs text-muted-foreground">{report.type} &bull; Last run: {report.lastRun}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{report.format}</Badge>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-xs gap-1" disabled={busy === `saved-${report.type}`} onClick={() => onSavedDownload(report.type)}>
                        {busy === `saved-${report.type}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Download
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => onSavedDownload(report.type)}>Re-run</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
