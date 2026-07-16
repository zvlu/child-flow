import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, FileText, Loader2, Lock, RotateCcw, Search, Check, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

/** What the editor needs from each catalog row (a subset of pirQuestions + value). */
interface PirQuestion {
  code: string;
  section: string;
  subsection: string | null;
  label: string;
  valueType: "integer" | "percent" | "boolean" | "enum" | "text";
  subject: string;
  options: string[] | null;
  paired: "enrollment" | "eoy" | null;
  value: string | null;
}

/** Recent PIR program years, current first. The PIR year starts in the fall. */
function recentProgramYears(): string[] {
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return [0, 1, 2, 3].map((o) => {
    const y = startYear - o;
    return `${y}-${y + 1}`;
  });
}

const isAnswered = (v: string) => v !== "";

export default function PirReportEditor() {
  const years = useMemo(() => recentProgramYears(), []);
  const [year, setYearState] = useState(years[0]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [showSmartFill, setShowSmartFill] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const utils = trpc.useUtils();
  const reportQuery = trpc.compliance.getReport.useQuery({ organizationId: ORGANIZATION_ID, year });

  const setValue = trpc.compliance.setPirValue.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const submit = trpc.compliance.submitReport.useMutation({
    onSuccess: () => {
      toast.success(`PIR ${year} submitted`);
      utils.compliance.getReport.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const reopen = trpc.compliance.reopenReport.useMutation({
    onSuccess: () => {
      toast.success(`PIR ${year} reopened for edits`);
      utils.compliance.getReport.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Switching year starts a clean overlay so one year's edits never bleed into another.
  const setYear = (y: string) => {
    setYearState(y);
    setEdits({});
  };

  const data = reportQuery.data;
  const status = data?.report?.status ?? "draft";
  const locked = status !== "draft";
  const canEdit = isAdmin && !locked;

  const valueOf = (q: PirQuestion) => edits[q.code] ?? q.value ?? "";

  // Field is visible if it matches the search text and (when filtering) is unanswered.
  const term = search.trim().toLowerCase();
  const matches = (q: PirQuestion) =>
    (!term || q.label.toLowerCase().includes(term) || (q.subsection ?? "").toLowerCase().includes(term)) &&
    (!onlyUnanswered || (edits[q.code] ?? q.value ?? "") === "");

  const saveStatus = setValue.isPending
    ? { icon: <Loader2 className="h-3 w-3 animate-spin" />, text: "Saving…" }
    : Object.keys(edits).length > 0
      ? { icon: <Check className="h-3 w-3 text-green-600" />, text: "All changes saved" }
      : { icon: null, text: "Autosaves as you type" };

  const commit = (q: PirQuestion, value: string) => {
    setEdits((p) => ({ ...p, [q.code]: value }));
    setValue.mutate({ organizationId: ORGANIZATION_ID, year, section: q.section, questionId: q.code, value });
  };

  // Live completion across all fields, merging unsaved edits over server values.
  const { answered, total } = useMemo(() => {
    const qs = (data?.questions ?? []) as PirQuestion[];
    let a = 0;
    for (const q of qs) if (isAnswered(edits[q.code] ?? q.value ?? "")) a++;
    return { answered: a, total: qs.length };
  }, [data, edits]);
  const pct = total ? Math.round((answered / total) * 100) : 0;

  // Group catalog by section → subsection, preserving catalog order.
  const sections = useMemo(() => {
    const qs = (data?.questions ?? []) as PirQuestion[];
    const map = new Map<string, Map<string, PirQuestion[]>>();
    for (const q of qs) {
      if (!map.has(q.section)) map.set(q.section, new Map());
      const subs = map.get(q.section)!;
      const subKey = q.subsection ?? "General";
      if (!subs.has(subKey)) subs.set(subKey, []);
      subs.get(subKey)!.push(q);
    }
    return Array.from(map.entries()).map(([title, subs]) => {
      const subEntries = Array.from(subs.entries());
      const flat = subEntries.flatMap(([, list]) => list);
      const done = flat.filter((q) => isAnswered(edits[q.code] ?? q.value ?? "")).length;
      return { title, subs: subEntries, done, count: flat.length };
    });
  }, [data, edits]);

  const statusBadge = () => {
    if (status === "submitted") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">Submitted</Badge>;
    if (status === "accepted") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Accepted</Badge>;
    return <Badge variant="secondary">Draft</Badge>;
  };

  const renderInput = (q: PirQuestion) => {
    const v = valueOf(q);
    if (q.valueType === "boolean") {
      return <Switch checked={v === "true"} disabled={!canEdit} onCheckedChange={(c) => commit(q, c ? "true" : "false")} />;
    }
    if (q.valueType === "enum" && q.options) {
      return (
        <Select value={v || undefined} disabled={!canEdit} onValueChange={(val) => commit(q, val)}>
          <SelectTrigger className="h-8 w-full max-w-[240px] text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {q.options.map((o) => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (q.valueType === "text") {
      return (
        <Textarea
          key={`${year}:${q.code}`}
          defaultValue={v}
          disabled={!canEdit}
          rows={2}
          className="text-xs"
          onBlur={(e) => { if (e.target.value !== (q.value ?? "")) commit(q, e.target.value); }}
        />
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <Input
          key={`${year}:${q.code}`}
          type="number"
          inputMode="numeric"
          defaultValue={v}
          disabled={!canEdit}
          className="h-8 w-28 text-xs"
          onBlur={(e) => { if (e.target.value !== (q.value ?? "")) commit(q, e.target.value); }}
        />
        {q.valueType === "percent" && <span className="text-xs text-muted-foreground">%</span>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Overview / actions */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-10 w-10 text-primary opacity-30" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">PIR Completion</p>
                  {statusBadge()}
                </div>
                <p className="text-3xl font-bold text-primary mt-0.5">{pct}%</p>
                <p className="text-xs text-muted-foreground">{answered} of {total} fields entered</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              {canEdit && (
                <Button size="sm" variant="outline" className="gap-2 border-primary/40 text-primary hover:text-primary"
                  onClick={() => setShowSmartFill(true)}>
                  <Sparkles className="h-4 w-4" />Smart Fill
                </Button>
              )}
              {locked ? (
                <Button size="sm" variant="outline" className="gap-2" disabled={!isAdmin || reopen.isPending}
                  onClick={() => reopen.mutate({ organizationId: ORGANIZATION_ID, year })}>
                  <RotateCcw className="h-4 w-4" />Reopen
                </Button>
              ) : (
                <Button size="sm" className="gap-2" disabled={!isAdmin || submit.isPending}
                  onClick={() => submit.mutate({ organizationId: ORGANIZATION_ID, year })}>
                  {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Submit PIR
                </Button>
              )}
            </div>
          </div>
          <Progress value={pct} className="h-2 mt-4" />
          {!isAdmin && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Lock className="h-3 w-3" />Read-only — PIR edits require an admin account.</p>}
          {locked && isAdmin && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Lock className="h-3 w-3" />Report is {status}. Reopen to make changes.</p>}
        </CardContent>
      </Card>

      {/* Find-a-field controls — so nobody has to scroll 158 rows or be trained where things live. */}
      {total > 0 && (
        <div className="flex flex-wrap items-center gap-3 sticky top-2 z-10 bg-background/80 backdrop-blur rounded-lg border border-border px-3 py-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fields (e.g. dental, enrollment, staff)…"
              className="h-9 pl-8"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
            <Switch checked={onlyUnanswered} onCheckedChange={setOnlyUnanswered} />
            Only unanswered
          </label>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
            {saveStatus.icon}{saveStatus.text}
          </span>
        </div>
      )}

      {reportQuery.isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading PIR…
        </div>
      )}

      {!reportQuery.isLoading && total === 0 && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          No PIR questions found. Seed the catalog first: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">npx tsx scripts/seed-pir-questions.ts</code>
        </CardContent></Card>
      )}

      {/* Section-grouped fields (filtered by the search / unanswered controls) */}
      {(() => {
        const visibleSections = sections
          .map((section) => ({
            ...section,
            visibleSubs: section.subs
              .map(([subTitle, qs]) => [subTitle, qs.filter(matches)] as const)
              .filter(([, qs]) => qs.length > 0),
          }))
          .filter((s) => s.visibleSubs.length > 0);

        if (!reportQuery.isLoading && total > 0 && visibleSections.length === 0) {
          return (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">
              No fields match {search ? <>“{search}”</> : "this filter"}.{" "}
              <button className="text-primary underline" onClick={() => { setSearch(""); setOnlyUnanswered(false); }}>Clear filters</button>
            </CardContent></Card>
          );
        }

        return visibleSections.map((section) => (
          <Card key={section.title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-foreground">{section.title}</h3>
                <span className="text-xs font-medium text-muted-foreground">{section.done}/{section.count}</span>
              </div>
              <Progress value={section.count ? Math.round((section.done / section.count) * 100) : 0} className="h-1.5 mb-4" />
              <div className="space-y-5">
                {section.visibleSubs.map(([subTitle, qs]) => (
                  <div key={subTitle}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{subTitle}</p>
                    <div className="space-y-1">
                      {qs.map((q) => (
                        <div key={q.code} className="flex items-start justify-between gap-4 p-2.5 rounded-lg odd:bg-muted/30">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">{q.label}</p>
                            {q.paired && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{q.paired === "eoy" ? "end of year" : "at enrollment"}</span>}
                          </div>
                          <div className="flex-shrink-0">{renderInput(q)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ));
      })()}

      {showSmartFill && (
        <SmartFillDialog
          year={year}
          onClose={(applied) => {
            setShowSmartFill(false);
            if (applied) {
              setEdits({});
              utils.compliance.getReport.invalidate();
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * Smart Fill — reviews values computed from live program data (enrollment,
 * attendance, health records, family services) and applies the checked ones.
 */
function SmartFillDialog({ year, onClose }: { year: string; onClose: (applied: boolean) => void }) {
  const suggestionsQuery = trpc.compliance.autoPopulate.useQuery({
    organizationId: ORGANIZATION_ID,
    year,
  });
  const applyMutation = trpc.compliance.applyAutoPopulate.useMutation();

  const suggestions = suggestionsQuery.data ?? [];
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const toggle = (code: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const selected = suggestions.filter((s) => !excluded.has(s.code));
  const overwrites = selected.filter((s) => s.currentValue != null && s.currentValue !== s.value).length;

  const apply = async () => {
    try {
      const result = await applyMutation.mutateAsync({
        organizationId: ORGANIZATION_ID,
        year,
        items: selected.map((s) => ({ section: s.section, questionId: s.code, value: s.value })),
      });
      toast.success(`Smart Fill applied ${result.applied} PIR fields`);
      onClose(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Smart Fill failed");
    }
  };

  // Group by section for display.
  const bySection = new Map<string, typeof suggestions>();
  for (const s of suggestions) {
    if (!bySection.has(s.section)) bySection.set(s.section, []);
    bySection.get(s.section)!.push(s);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Smart Fill — PIR {year}
          </DialogTitle>
          <DialogDescription>
            Values computed from your live program data. Review, uncheck anything you don't
            trust, then apply. Nothing is written until you click Apply.
          </DialogDescription>
        </DialogHeader>

        {suggestionsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />Computing from program data…
          </div>
        ) : suggestions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Not enough program data yet — add children, attendance, and health records first.
          </p>
        ) : (
          <div className="space-y-5">
            {Array.from(bySection.entries()).map(([section, items]) => (
              <div key={section}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {section}
                </p>
                <div className="space-y-1">
                  {items.map((s) => {
                    const isOverwrite = s.currentValue != null && s.currentValue !== s.value;
                    return (
                      <label
                        key={s.code}
                        className="flex items-start gap-3 p-2.5 rounded-lg odd:bg-muted/30 cursor-pointer"
                      >
                        <Checkbox
                          checked={!excluded.has(s.code)}
                          onCheckedChange={() => toggle(s.code)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{s.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {s.source}
                            {s.confidence === "medium" && " · verify before submitting"}
                          </p>
                          {isOverwrite && (
                            <p className="text-[11px] text-orange-600">
                              Replaces current answer: {s.currentValue}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-semibold">{s.value}</span>
                          <Badge
                            variant="outline"
                            className={`ml-2 text-[10px] ${s.confidence === "high" ? "border-green-300 text-green-700" : "border-yellow-300 text-yellow-700"}`}
                          >
                            {s.confidence}
                          </Badge>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
          <Button
            onClick={apply}
            disabled={selected.length === 0 || applyMutation.isPending}
            className="gap-2"
          >
            {applyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply {selected.length} field{selected.length === 1 ? "" : "s"}
            {overwrites > 0 && ` (${overwrites} overwrite${overwrites === 1 ? "" : "s"})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
