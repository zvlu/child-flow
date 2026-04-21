import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Download, FileText, BarChart3, TrendingUp, Users, Heart, ClipboardCheck, ShieldCheck } from "lucide-react";

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
  { name: "Staff Training Report", description: "Training hours, certifications, and compliance", icon: TrendingUp, color: "text-teal-500 bg-teal-50" },
  { name: "Income Eligibility Report", description: "Family income levels and eligibility verification", icon: FileText, color: "text-indigo-500 bg-indigo-50" },
];

export default function Reports() {
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
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" />Export All</Button>
        </div>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">Analytics Dashboard</TabsTrigger>
          <TabsTrigger value="templates">Report Templates</TabsTrigger>
          <TabsTrigger value="saved">Saved Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          {/* Attendance Trend */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Attendance Rate Trend</CardTitle>
                  <CardDescription>Monthly average attendance rate — 2024-2025 program year</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-2 text-xs"><Download className="h-3.5 w-3.5" />Export</Button>
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
                    <Button variant="outline" size="sm" className="w-full mt-4 text-xs gap-1 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <FileText className="h-3.5 w-3.5" />Generate Report
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
                      <Button variant="ghost" size="sm" className="text-xs gap-1">
                        <Download className="h-3.5 w-3.5" />Download
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs">Re-run</Button>
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
