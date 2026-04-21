import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, Download, FileText, TrendingUp } from "lucide-react";

const pirSections = [
  {
    section: "Section A: Enrollment", completion: 100, status: "complete",
    items: [
      { label: "Total funded enrollment", value: "51", status: "complete" },
      { label: "Children enrolled", value: "47", status: "complete" },
      { label: "Average daily attendance", value: "89.4%", status: "complete" },
      { label: "Children with disabilities", value: "8", status: "complete" },
    ]
  },
  {
    section: "Section B: Family & Community Partnerships", completion: 85, status: "in_progress",
    items: [
      { label: "Families receiving services", value: "47", status: "complete" },
      { label: "Home visits completed", value: "94", status: "complete" },
      { label: "Parent meetings held", value: "47", status: "complete" },
      { label: "Families with goals set", value: "40", status: "in_progress" },
    ]
  },
  {
    section: "Section C: Health", completion: 78, status: "in_progress",
    items: [
      { label: "Physical exams completed", value: "44/47", status: "in_progress" },
      { label: "Dental exams completed", value: "38/47", status: "needs_attention" },
      { label: "Vision screenings", value: "45/47", status: "in_progress" },
      { label: "Hearing screenings", value: "46/47", status: "in_progress" },
      { label: "Immunizations current", value: "40/47", status: "needs_attention" },
    ]
  },
  {
    section: "Section D: Education", completion: 92, status: "in_progress",
    items: [
      { label: "Children with assessments", value: "45/47", status: "in_progress" },
      { label: "Curriculum implemented", value: "Yes", status: "complete" },
      { label: "CLASS observations completed", value: "3/3", status: "complete" },
      { label: "Child outcomes data entered", value: "45/47", status: "in_progress" },
    ]
  },
  {
    section: "Section E: Staff", completion: 95, status: "in_progress",
    items: [
      { label: "Lead teachers with CDA or higher", value: "3/3", status: "complete" },
      { label: "Staff with required training hours", value: "6/8", status: "in_progress" },
      { label: "Background checks current", value: "8/8", status: "complete" },
      { label: "Staff-to-child ratios met", value: "Yes", status: "complete" },
    ]
  },
];

const monitoringItems = [
  { area: "Child-to-Staff Ratio", status: "compliant", lastReview: "Nov 1, 2024", notes: "All classrooms within required ratios" },
  { area: "Health & Safety Checks", status: "compliant", lastReview: "Nov 1, 2024", notes: "Monthly safety inspections completed" },
  { area: "Fiscal Management", status: "compliant", lastReview: "Oct 15, 2024", notes: "Budget on track, no findings" },
  { area: "Program Governance", status: "compliant", lastReview: "Oct 1, 2024", notes: "Policy council meetings held monthly" },
  { area: "Transportation Safety", status: "needs_attention", lastReview: "Oct 20, 2024", notes: "2 buses due for safety inspection" },
  { area: "Food Service", status: "compliant", lastReview: "Nov 1, 2024", notes: "CACFP records up to date" },
];

const overallCompletion = Math.round(pirSections.reduce((a, s) => a + s.completion, 0) / pirSections.length);

const statusBadge = (status: string) => {
  if (status === "complete" || status === "compliant") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Complete</Badge>;
  if (status === "in_progress") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-xs">In Progress</Badge>;
  if (status === "needs_attention") return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Needs Attention</Badge>;
  return <Badge variant="secondary" className="text-xs">Pending</Badge>;
};

export default function Compliance() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance & PIR</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Program Information Report and federal compliance tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" />Export PIR</Button>
          <Button size="sm" className="gap-2"><FileText className="h-4 w-4" />Submit PIR</Button>
        </div>
      </div>

      {/* Overall Status */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="col-span-2 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">PIR Overall Completion</p>
                <p className="text-4xl font-bold text-primary mt-1">{overallCompletion}%</p>
              </div>
              <ShieldCheck className="h-12 w-12 text-primary opacity-20" />
            </div>
            <Progress value={overallCompletion} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">Program Year 2024-2025 &bull; Due: Jan 31, 2025</p>
          </CardContent>
        </Card>
        {[
          { label: "Sections Complete", value: pirSections.filter(s => s.completion === 100).length, icon: CheckCircle2, color: "text-green-600" },
          { label: "In Progress", value: pirSections.filter(s => s.completion < 100 && s.completion > 0).length, icon: Clock, color: "text-blue-600" },
          { label: "Monitoring Alerts", value: monitoringItems.filter(m => m.status === "needs_attention").length, icon: AlertTriangle, color: "text-amber-600" },
        ].map(stat => {
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

      <Tabs defaultValue="pir">
        <TabsList>
          <TabsTrigger value="pir">PIR Sections</TabsTrigger>
          <TabsTrigger value="monitoring">Program Monitoring</TabsTrigger>
          <TabsTrigger value="history">Compliance History</TabsTrigger>
        </TabsList>

        <TabsContent value="pir" className="mt-4 space-y-4">
          {pirSections.map(section => (
            <Card key={section.section}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{section.section}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-foreground">{section.completion}%</span>
                    {statusBadge(section.status)}
                  </div>
                </div>
                <Progress value={section.completion} className="h-1.5 mb-4" />
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map(item => (
                    <div key={item.label} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{item.value}</span>
                        {item.status === "complete" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : item.status === "needs_attention" ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="monitoring" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Program Monitoring Checklist</CardTitle>
              <CardDescription>Ongoing compliance monitoring across program areas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {monitoringItems.map((item, i) => (
                <div key={i} className={`flex items-start gap-4 p-4 rounded-lg border ${item.status === "needs_attention" ? "border-amber-200 bg-amber-50" : "border-border"}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {item.status === "compliant" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-foreground">{item.area}</p>
                      {statusBadge(item.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Last reviewed: {item.lastReview}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs flex-shrink-0">Update</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Compliance History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { year: "2023-2024", pirScore: "97%", findings: 0, status: "Excellent" },
                  { year: "2022-2023", pirScore: "94%", findings: 1, status: "Good" },
                  { year: "2021-2022", pirScore: "91%", findings: 2, status: "Good" },
                  { year: "2020-2021", pirScore: "88%", findings: 3, status: "Satisfactory" },
                ].map(record => (
                  <div key={record.year} className="flex items-center gap-4 p-4 rounded-lg border border-border">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">Program Year {record.year}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">PIR Score: {record.pirScore} &bull; Findings: {record.findings}</p>
                    </div>
                    <Badge className={record.findings === 0 ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-blue-100 text-blue-700 hover:bg-blue-100"}>
                      {record.status}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-xs gap-1"><Download className="h-3.5 w-3.5" />PDF</Button>
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
