import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Loader2, Printer } from "lucide-react";

interface PirQuestion {
  code: string;
  section: string;
  subsection: string | null;
  label: string;
  valueType: "integer" | "percent" | "boolean" | "enum" | "text";
  options: string[] | null;
  paired: "enrollment" | "eoy" | null;
  value: string | null;
}

/** Render a stored value for reading. Returns null when unanswered. */
function display(q: PirQuestion): string | null {
  const v = q.value;
  if (v === "" || v == null) return null;
  if (q.valueType === "boolean") return v === "true" ? "Yes" : "No";
  if (q.valueType === "percent") return `${v}%`;
  return v;
}

export default function PirReportView({ year }: { year: string }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const query = trpc.compliance.getReport.useQuery({ organizationId: ORGANIZATION_ID, year });
  const data = query.data;

  const sections = useMemo(() => {
    const qs = (data?.questions ?? []) as PirQuestion[];
    const map = new Map<string, Map<string, PirQuestion[]>>();
    for (const q of qs) {
      if (!map.has(q.section)) map.set(q.section, new Map());
      const subs = map.get(q.section)!;
      const key = q.subsection ?? "General";
      if (!subs.has(key)) subs.set(key, []);
      subs.get(key)!.push(q);
    }
    return Array.from(map.entries()).map(([title, subs]) => ({
      title,
      subs: Array.from(subs.entries()),
    }));
  }, [data]);

  const onPrint = () => {
    const el = printRef.current;
    el?.classList.add("pir-print-active");
    window.print();
    el?.classList.remove("pir-print-active");
  };

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading report…
      </div>
    );
  }

  const pct = data?.totalQuestions ? Math.round((data.answeredQuestions / data.totalQuestions) * 100) : 0;
  const status = data?.report?.status ?? "draft";
  const submittedAt = data?.report?.submittedAt ? new Date(data.report.submittedAt) : null;

  return (
    <div ref={printRef} className="pir-printable rounded-lg border border-border bg-card">
      {/* Document toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div>
          <p className="text-sm font-semibold text-foreground">Program Information Report &middot; {year}</p>
          <p className="text-xs text-muted-foreground">
            {data?.answeredQuestions ?? 0} of {data?.totalQuestions ?? 0} fields ({pct}%)
            {submittedAt && ` · submitted ${submittedAt.toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex items-center gap-3 pir-no-print">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={showEmpty} onCheckedChange={setShowEmpty} />
            Show empty fields
          </label>
          <Button variant="outline" size="sm" className="gap-2" onClick={onPrint}>
            <Printer className="h-4 w-4" />Print / Save PDF
          </Button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-6">
        {sections.map((section) => {
          // Subsections with at least one visible field (respecting the toggle).
          const visibleSubs = section.subs
            .map(([subTitle, qs]) => [subTitle, qs.filter((q) => showEmpty || display(q) !== null)] as const)
            .filter(([, qs]) => qs.length > 0);
          if (visibleSubs.length === 0) return null;
          return (
            <div key={section.title}>
              <h4 className="font-semibold text-foreground text-sm mb-3">{section.title}</h4>
              <div className="space-y-4">
                {visibleSubs.map(([subTitle, qs]) => (
                  <div key={subTitle}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{subTitle}</p>
                    <dl className="divide-y divide-border/60">
                      {qs.map((q) => {
                        const shown = display(q);
                        return (
                          <div key={q.code} className="flex items-baseline justify-between gap-4 py-1.5">
                            <dt className="text-sm text-muted-foreground min-w-0">
                              {q.label}
                              {q.paired && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">{q.paired === "eoy" ? "(EOY)" : "(enroll)"}</span>}
                            </dt>
                            <dd className={`text-sm font-medium flex-shrink-0 tabular-nums ${shown === null ? "text-muted-foreground/40" : "text-foreground"}`}>
                              {shown ?? "—"}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {pct === 0 && (
          <p className="text-sm text-muted-foreground">No data entered for this report year yet.</p>
        )}
      </div>
    </div>
  );
}
