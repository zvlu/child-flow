import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Gauge, Loader2, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { cn } from "@/lib/utils";
import { useOrgModules } from "@/hooks/useOrgModules";
import { useAuth } from "@/_core/hooks/useAuth";

const GRADE_META: Record<string, { label: string; badge: string; ring: string }> = {
  strong: { label: "Review-ready", badge: "bg-green-100 text-green-700 border-green-200", ring: "text-green-600" },
  on_track: { label: "On track", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", ring: "text-emerald-600" },
  at_risk: { label: "Needs work", badge: "bg-amber-100 text-amber-700 border-amber-200", ring: "text-amber-600" },
  critical: { label: "At risk", badge: "bg-red-100 text-red-700 border-red-200", ring: "text-red-600" },
};

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-muted" />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * score) / 100}
          className={cn("transition-all duration-700", GRADE_META[grade]?.ring ?? "text-primary")}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground">{score}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

/**
 * Audit Readiness Score. `compact` renders the dashboard tile (ring + top
 * fix-first item); the full card breaks down every Performance Standard.
 * Only renders for Head Start orgs — the score is defined by the standards.
 */
export function AuditReadiness({ compact = false }: { compact?: boolean }) {
  const modules = useOrgModules();
  const { user } = useAuth();
  // Program-wide compliance posture is leadership information — directors and
  // admins only. Staff see their own slice of compliance on their work pages.
  const isAdmin = user?.role === "admin";
  const hasHeadStart = modules.has("head_start");
  const enabled = isAdmin && hasHeadStart;
  const query = trpc.compliance.auditReadiness.useQuery(ORGANIZATION_ID, {
    enabled,
    staleTime: 60_000,
  });

  if (!enabled) return null;

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (!query.data) return null;

  const { score, grade, sections } = query.data;
  const meta = GRADE_META[grade] ?? GRADE_META.on_track;
  const scored = sections.filter((s) => s.score != null);
  const weakest = [...scored].sort((a, b) => a.score! - b.score!)[0];

  if (compact) {
    return (
      <Card className="border-l-4 border-l-primary">
        <CardContent className="flex items-center gap-4 p-4">
          <ScoreRing score={score} grade={grade} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">Audit Readiness</p>
              <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
            </div>
            {weakest && weakest.score! < 100 ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Biggest lift: <span className="font-medium text-foreground">{weakest.label}</span> ({weakest.score}) — {weakest.detail}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Every tracked standard is in good shape.</p>
            )}
            <Link href="/compliance">
              <Button variant="ghost" size="sm" className="mt-1 -ml-2 gap-1 text-xs">
                Full breakdown <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Audit Readiness
          <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
        </CardTitle>
        <CardDescription>
          Computed live from your program data across the Performance Standards — the score a federal
          reviewer would effectively be checking today.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={score} grade={grade} />
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Gauge className="h-3 w-3" /> weighted across {scored.length} areas
            </p>
          </div>
          <div className="flex-1 space-y-3">
            {sections.map((s) => (
              <Link key={s.id} href={s.href}>
                <a className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {s.label} <span className="ml-1 text-xs text-muted-foreground">{s.standard}</span>
                    </p>
                    <span className={cn("text-sm font-semibold", s.score == null ? "text-muted-foreground" : s.score >= 90 ? "text-green-600" : s.score >= 70 ? "text-emerald-600" : s.score >= 50 ? "text-amber-600" : "text-red-600")}>
                      {s.score == null ? "—" : s.score}
                    </span>
                  </div>
                  {s.score != null && <Progress value={s.score} className="mt-2 h-1.5" />}
                  <p className="mt-1.5 text-xs text-muted-foreground">{s.detail}</p>
                </a>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
