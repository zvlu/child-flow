import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import PirReportEditor from "@/components/PirReportEditor";
import PirReportView from "@/components/PirReportView";
import { Glossary } from "@/components/Glossary";
import { AuditReadiness } from "@/components/AuditReadiness";
import { ReviewBinderButton } from "@/components/ReviewBinder";
import { formatDateLong } from "@/lib/date";

/** Badge for a single checklist item — unreviewed items read "Never Reviewed"
 * rather than fabricating a compliant/pending status before anyone's looked. */
const monitoringBadge = (item: { isCompliant: boolean; reviewedAt: string | null }) => {
  if (!item.reviewedAt) return <Badge variant="secondary" className="text-xs">Never Reviewed</Badge>;
  if (item.isCompliant) return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Compliant</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Needs Attention</Badge>;
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
  // Previously local-state-only ("Mark Reviewed" did nothing server-side, and
  // items were seeded with a fake pre-filled "compliant" history). Now backed
  // by the complianceChecklist router — items start unreviewed for real.
  const utils = trpc.useUtils();
  const checklistQuery = trpc.complianceChecklist.list.useQuery({ organizationId: ORGANIZATION_ID });
  const markReviewedMutation = trpc.complianceChecklist.markReviewed.useMutation({
    onSuccess: () => {
      utils.complianceChecklist.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const markReviewed = (item: { itemKey: string; label: string }) => {
    markReviewedMutation.mutate(
      { organizationId: ORGANIZATION_ID, itemKey: item.itemKey },
      { onSuccess: () => toast.success(`${item.label} marked reviewed`) }
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-1.5">Compliance & PIR <Glossary term="PIR" /></h1>
          <p className="text-muted-foreground text-sm mt-0.5">Program Information Report and federal compliance tracking</p>
        </div>
        <ReviewBinderButton />
      </div>

      {/* Live per-standard readiness score */}
      <AuditReadiness />

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
              {checklistQuery.isLoading && (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading checklist…
                </div>
              )}
              {!checklistQuery.isLoading && (checklistQuery.data ?? []).map((item) => {
                const isReviewed = !!item.reviewedAt;
                const needsAttention = !isReviewed || !item.isCompliant;
                const isPending =
                  markReviewedMutation.isPending && markReviewedMutation.variables?.itemKey === item.itemKey;
                return (
                  <div
                    key={item.itemKey}
                    className={`flex items-start gap-4 p-4 rounded-lg border ${needsAttention ? "border-amber-200 bg-amber-50" : "border-border"}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {needsAttention ? (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-foreground">{item.label}</p>
                        {monitoringBadge(item)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{item.category}</p>
                      {item.note && <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last reviewed: {item.reviewedAt ? formatDateLong(item.reviewedAt) : "Never reviewed"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs flex-shrink-0"
                      disabled={isReviewed || isPending}
                      onClick={() => markReviewed(item)}
                    >
                      {isPending ? "Reviewing…" : isReviewed ? "Reviewed" : "Mark Reviewed"}
                    </Button>
                  </div>
                );
              })}
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
