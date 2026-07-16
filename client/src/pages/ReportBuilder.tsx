import { useState } from "react";
import { BarChart3, Plus, Edit2, Trash2, Download, Eye, Loader2, Copy } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { objectsToCsv, downloadCsv } from "@/lib/csv";

const reportTypes = [
  { id: "enrollment", label: "Enrollment", description: "Track enrollment numbers and capacity" },
  { id: "attendance", label: "Attendance", description: "Analyze attendance patterns and absences" },
  { id: "health", label: "Health", description: "Monitor health screenings and compliance" },
  { id: "compliance", label: "Compliance", description: "Licensing, state, and (if enabled) Head Start PIR reporting" },
  { id: "financial", label: "Financial", description: "Tuition and payment tracking" },
  { id: "custom", label: "Custom", description: "Build your own report" },
] as const;

type ReportType = (typeof reportTypes)[number]["id"];

const COLUMN_OPTIONS = ["Name", "Date", "Status", "Count", "Percentage", "Notes"];

const emptyDraft = { reportName: "", reportType: "enrollment" as ReportType, columns: [...COLUMN_OPTIONS] };

/** Result of trpc.reportBuilder.run — see server/moduleDb.ts runCustomReport. */
type RunResult = {
  reportName: string;
  reportType: string;
  columns: string[] | null;
  rows: Record<string, unknown>[];
  generatedAt: string | Date;
};

export function ReportBuilder() {
  const orgId = ORGANIZATION_ID;
  const utils = trpc.useUtils();
  const confirm = useConfirm();

  const { data: reports, isLoading } = trpc.reportBuilder.list.useQuery(orgId);
  const allReports = reports ?? [];

  const [showBuilder, setShowBuilder] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

  const [viewResult, setViewResult] = useState<RunResult | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<"view" | "download" | null>(null);

  const createReport = trpc.reportBuilder.create.useMutation({
    onSuccess: async () => {
      await utils.reportBuilder.list.invalidate(orgId);
      toast.success(duplicating ? "Report duplicated" : "Report created");
      setShowBuilder(false);
      setDraft(emptyDraft);
      setDuplicating(false);
    },
    onError: (e) => toast.error(e.message || "Could not save report"),
  });

  const runReport = trpc.reportBuilder.run.useMutation({
    onError: (e) => toast.error(e.message || "Could not run report"),
  });

  const deleteReport = trpc.reportBuilder.delete.useMutation({
    onSuccess: async () => {
      await utils.reportBuilder.list.invalidate(orgId);
      toast.success("Report deleted");
    },
    onError: (e) => toast.error(e.message || "Could not delete report"),
  });

  const handleCreateReport = () => {
    if (!draft.reportName.trim()) {
      toast.error("Give the report a name.");
      return;
    }
    createReport.mutate({
      organizationId: orgId,
      reportName: draft.reportName.trim(),
      reportType: draft.reportType,
      columns: draft.columns,
    });
  };

  const openNewReport = () => {
    setDuplicating(false);
    setDraft(emptyDraft);
    setShowBuilder(true);
  };

  // "Edit" has no backing update endpoint on the server — being honest about
  // that, this duplicates the report as a new one pre-filled with its settings
  // rather than pretending to edit it in place.
  const openDuplicate = (report: (typeof allReports)[number]) => {
    setDuplicating(true);
    setDraft({
      reportName: `Copy of ${report.reportName}`,
      reportType: (report.reportType as ReportType) ?? "custom",
      columns: (report.columns as string[] | null) ?? [...COLUMN_OPTIONS],
    });
    setShowBuilder(true);
  };

  const toggleColumn = (col: string) => {
    setDraft((d) => ({
      ...d,
      columns: d.columns.includes(col) ? d.columns.filter((c) => c !== col) : [...d.columns, col],
    }));
  };

  const runAndView = (report: (typeof allReports)[number]) => {
    setRunningId(report.id);
    setPendingAction("view");
    runReport.mutate(report.id, {
      onSuccess: (result) => {
        setViewResult(result as RunResult);
        setRunningId(null);
        setPendingAction(null);
      },
      onError: () => {
        setRunningId(null);
        setPendingAction(null);
      },
    });
  };

  const runAndDownload = (report: (typeof allReports)[number]) => {
    setRunningId(report.id);
    setPendingAction("download");
    runReport.mutate(report.id, {
      onSuccess: (result) => {
        const rows = (result as RunResult).rows ?? [];
        if (!rows.length) {
          toast.message("This report has no data to export yet.");
        } else {
          downloadCsv(
            `${(result as RunResult).reportName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`,
            objectsToCsv(rows)
          );
          toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
        }
        setRunningId(null);
        setPendingAction(null);
      },
      onError: () => {
        setRunningId(null);
        setPendingAction(null);
      },
    });
  };

  const handleDelete = async (report: (typeof allReports)[number]) => {
    const ok = await confirm({
      title: `Delete "${report.reportName}"?`,
      description: "This report definition will be permanently removed.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) deleteReport.mutate(report.id);
  };

  const resultColumns = viewResult && viewResult.rows.length > 0 ? Object.keys(viewResult.rows[0]) : [];

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Report Builder</h1>
            </div>
            <button onClick={openNewReport} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
              <Plus className="w-5 h-5" />
              New Report
            </button>
          </div>
        </div>

        {/* Report Templates */}
        <h2 className="text-2xl font-bold text-foreground mb-4">Quick Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {reportTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => { setDuplicating(false); setDraft({ ...emptyDraft, reportType: type.id }); setShowBuilder(true); }}
              className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md hover:border-[#A7C4AD] transition-all text-left"
            >
              <h3 className="font-semibold text-foreground mb-1">{type.label}</h3>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </button>
          ))}
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-4">My Reports</h2>
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Report Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Last Run</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 align-middle" />
                      Loading reports...
                    </td>
                  </tr>
                )}
                {!isLoading && allReports.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        icon={BarChart3}
                        title="No reports yet"
                        description="Pick a template above or use “New Report” to build your first one — it'll show up here."
                      />
                    </td>
                  </tr>
                )}
                {allReports.map((report) => {
                  const busy = runningId === report.id;
                  return (
                    <tr key={report.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{report.reportName}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {report.lastRunAt ? new Date(report.lastRunAt).toLocaleDateString() : "Never run"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            title="View"
                            disabled={busy}
                            onClick={() => runAndView(report)}
                            className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                          >
                            {busy && pendingAction === "view" ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <button
                            title="Download"
                            disabled={busy}
                            onClick={() => runAndDownload(report)}
                            className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                          >
                            {busy && pendingAction === "download" ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Download className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <button title="Duplicate (there's no in-place edit yet)" onClick={() => openDuplicate(report)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button title="Delete" onClick={() => handleDelete(report)} disabled={deleteReport.isPending} className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Report Builder Modal (create, or duplicate-as-new) */}
        {showBuilder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">{duplicating ? "Duplicate Report" : "Create New Report"}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Report Name</label>
                  <input
                    type="text"
                    value={draft.reportName}
                    onChange={(e) => setDraft((d) => ({ ...d, reportName: e.target.value }))}
                    placeholder="e.g., Monthly Enrollment Summary"
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Report Type</label>
                  <select
                    value={draft.reportType}
                    onChange={(e) => setDraft((d) => ({ ...d, reportType: e.target.value as ReportType }))}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {reportTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Select Columns</label>
                  <div className="grid grid-cols-2 gap-2">
                    {COLUMN_OPTIONS.map((col) => (
                      <label key={col} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={draft.columns.includes(col)}
                          onChange={() => toggleColumn(col)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-sm text-muted-foreground">{col}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    The columns actually shown when you run the report depend on its type — this list is used to remember your preference.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={() => { setShowBuilder(false); setDuplicating(false); }} className="flex-1 bg-muted hover:bg-muted text-muted-foreground px-4 py-2 rounded-xl transition-colors font-medium">Cancel</button>
                  <button
                    onClick={handleCreateReport}
                    disabled={createReport.isPending}
                    className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground px-4 py-2 rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {createReport.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {duplicating ? "Save Copy" : "Create Report"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Result Dialog */}
        <Dialog open={viewResult != null} onOpenChange={(o) => { if (!o) setViewResult(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewResult?.reportName}</DialogTitle>
              <DialogDescription>
                {viewResult && `Generated ${new Date(viewResult.generatedAt).toLocaleString()} • ${viewResult.rows.length} row${viewResult.rows.length === 1 ? "" : "s"}`}
              </DialogDescription>
            </DialogHeader>
            {viewResult && viewResult.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data available for this report yet.</p>
            ) : viewResult ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {resultColumns.map((col) => (
                        <th key={col} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {viewResult.rows.map((row, i) => (
                      <tr key={i}>
                        {resultColumns.map((col) => (
                          <td key={col} className="px-4 py-2 text-foreground">{String(row[col] ?? "—")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <DialogFooter>
              {viewResult && viewResult.rows.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    downloadCsv(
                      `${viewResult.reportName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`,
                      objectsToCsv(viewResult.rows)
                    );
                  }}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" /> Download CSV
                </Button>
              )}
              <Button onClick={() => setViewResult(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
