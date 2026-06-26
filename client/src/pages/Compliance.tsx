import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import PirReportEditor from "@/components/PirReportEditor";
import PirReportView from "@/components/PirReportView";
import { Glossary } from "@/components/Glossary";

const monitoringItems = [
  { area: "Child-to-Staff Ratio", status: "compliant", lastReview: "Nov 1, 2024", notes: "All classrooms within required ratios" },
  { area: "Health & Safety Checks", status: "compliant", lastReview: "Nov 1, 2024", notes: "Monthly safety inspections completed" },
  { area: "Fiscal Management", status: "compliant", lastReview: "Oct 15, 2024", notes: "Budget on track, no findings" },
  { area: "Program Governance", status: "compliant", lastReview: "Oct 1, 2024", notes: "Policy council meetings held monthly" },
  { area: "Transportation Safety", status: "needs_attention", lastReview: "Oct 20, 2024", notes: "2 buses due for safety inspection" },
  { area: "Food Service", status: "compliant", lastReview: "Nov 1, 2024", notes: "CACFP records up to date" },
];

const monitoringBadge = (status: string) => {
  if (status === "compliant") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Compliant</Badge>;
  if (status === "needs_attention") return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Needs Attention</Badge>;
  return <Badge variant="secondary" className="text-xs">Pending</Badge>;
};

const reportBadge = (status: string) => {
  if (status === "submitted") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-xs">Submitted</Badge>;
  if (status === "accepted") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Accepted</Badge>;
  return <Badge variant="secondary" className="text-xs">Draft</Badge>;
};

/** Inline, view-in-place PIR report history — click a year to unfold the full report. */
function ComplianceHistory() {
  const reportsQuery = trpc.compliance.listReports.useQuery({ organizationId: ORGANIZATION_ID });
  const [openYear, setOpenYear] = useState<string | null>(null);
  const reports = reportsQuery.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          PIR Report History
        </CardTitle>
        <CardDescription>Every program year's report — click to read it right here, no download.</CardDescription>
      </CardHeader>
      <CardContent>
        {reportsQuery.isLoading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading reports…
          </div>
        )}
        {!reportsQuery.isLoading && reports.length === 0 && (
          <p className="text-sm text-muted-foreground py-6">No PIR reports yet. Start one in the <span className="font-medium">PIR Report</span> tab.</p>
        )}
        <div className="space-y-3">
          {reports.map((r) => {
            const pct = r.total ? Math.round((r.answered / r.total) * 100) : 0;
            const open = openYear === r.year;
            return (
              <div key={r.year} className="rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setOpenYear(open ? null : r.year)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                  aria-expanded={open}
                >
                  <ChevronRight className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">Program Year {r.year}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.answered} of {r.total} fields entered &bull; {pct}%
                      {r.submittedAt && ` · submitted ${new Date(r.submittedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {reportBadge(r.status)}
                </button>
                {open && (
                  <div className="border-t border-border bg-muted/20 p-4">
                    <PirReportView year={r.year} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Compliance() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-1.5">Compliance & PIR <Glossary term="PIR" /></h1>
          <p className="text-muted-foreground text-sm mt-0.5">Program Information Report and federal compliance tracking</p>
        </div>
      </div>

      <Tabs defaultValue="pir">
        <TabsList>
          <TabsTrigger value="pir">PIR Report</TabsTrigger>
          <TabsTrigger value="monitoring">Program Monitoring</TabsTrigger>
          <TabsTrigger value="history">Report History</TabsTrigger>
        </TabsList>

        <TabsContent value="pir" className="mt-4">
          <PirReportEditor />
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
                      {monitoringBadge(item.status)}
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
          <ComplianceHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
