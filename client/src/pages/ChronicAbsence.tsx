import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, ClipboardCopy, ExternalLink, Loader2, TrendingDown, Users, Target, Search,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";

type Risk = "severe" | "high" | "at_risk" | "watch";

const RISK_META: Record<Risk, { label: string; badge: string; bar: string }> = {
  severe: { label: "Severe", badge: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100", bar: "bg-red-500" },
  high: { label: "High", badge: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100", bar: "bg-orange-500" },
  at_risk: { label: "At Risk", badge: "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100", bar: "bg-yellow-500" },
  watch: { label: "Watch", badge: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100", bar: "bg-blue-500" },
};

function outreachMessage(childName: string, rate: number): string {
  const first = childName.split(" ")[0];
  return (
    `Hi! We've missed ${first} at school — attendance is at ${rate}% over the last month, ` +
    `and we want to make sure everything is okay. Regular attendance helps ${first} get the ` +
    `most out of the program. Is there anything making it hard to get to school — transportation, ` +
    `schedule, health? We're here to help. Please call or reply anytime.`
  );
}

export default function ChronicAbsence() {
  const [windowDays, setWindowDays] = useState(30);
  const [riskFilter, setRiskFilter] = useState<Risk | "all">("all");
  const [search, setSearch] = useState("");

  const summaryQuery = trpc.chronicAbsence.summary.useQuery({
    organizationId: ORGANIZATION_ID,
    windowDays,
  });

  const alerts = useMemo(() => {
    const list = summaryQuery.data?.alerts ?? [];
    return list.filter((a) => {
      if (riskFilter !== "all" && a.riskLevel !== riskFilter) return false;
      if (search && !a.childName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [summaryQuery.data, riskFilter, search]);

  const copyOutreach = async (childName: string, rate: number) => {
    await navigator.clipboard.writeText(outreachMessage(childName, rate));
    toast.success("Outreach message copied — paste it into Communication");
  };

  const s = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-orange-500" />
            Chronic Absence
          </h1>
          <p className="text-sm text-muted-foreground">
            Head Start §1302.16 — children below the 85% attendance benchmark, last {windowDays} days
          </p>
        </div>
        <Select value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Target className="h-4 w-4" /> Program attendance
            </CardDescription>
            <CardTitle className={`text-3xl ${(s?.programRate ?? 100) >= 85 ? "text-green-600" : "text-red-600"}`}>
              {s ? `${s.programRate}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Benchmark: 85%</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Children tracked
            </CardDescription>
            <CardTitle className="text-3xl">{s?.childrenTracked ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Active children with attendance records</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Below benchmark
            </CardDescription>
            <CardTitle className={`text-3xl ${(s?.belowBenchmark ?? 0) > 0 ? "text-orange-600" : "text-green-600"}`}>
              {s?.belowBenchmark ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Under 85% — needs a cause analysis</CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search child…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-56"
          />
        </div>
        {(["all", "severe", "high", "at_risk", "watch"] as const).map((r) => (
          <Button
            key={r}
            size="sm"
            variant={riskFilter === r ? "default" : "outline"}
            onClick={() => setRiskFilter(r)}
          >
            {r === "all" ? "All" : RISK_META[r].label}
          </Button>
        ))}
      </div>

      {/* Alert list */}
      {summaryQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            {riskFilter === "all" && !search
              ? "No children are below the attendance watch threshold. 🎉"
              : "No children match the current filter."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {alerts.map((a) => {
            const meta = RISK_META[a.riskLevel as Risk];
            return (
              <Card key={a.childId}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {a.childName}
                        <Badge className={`${meta.badge} text-xs`}>{meta.label}</Badge>
                      </CardTitle>
                      <CardDescription>{a.familyName}</CardDescription>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${a.attendanceRate < 75 ? "text-red-600" : "text-orange-600"}`}>
                        {a.attendanceRate}%
                      </div>
                      <div className="text-[11px] text-muted-foreground">{a.totalDays} days tracked</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 4-week trend */}
                  <div className="flex items-end gap-2 h-14">
                    {a.weeklyTrend.map((w) => (
                      <div key={w.label} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-muted rounded-sm relative h-10 overflow-hidden">
                          <div
                            className={`absolute bottom-0 w-full rounded-sm ${w.rate >= 85 ? "bg-green-400" : meta.bar}`}
                            style={{ height: `${Math.max(w.rate, w.days > 0 ? 6 : 0)}%` }}
                            title={`${w.rate}% (${w.days} days)`}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{w.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Present: <b className="text-foreground">{a.presentDays}</b></span>
                    <span>Absent: <b className="text-red-600">{a.absentDays}</b></span>
                    <span>Excused: <b className="text-foreground">{a.excusedDays}</b></span>
                    {a.halfDays > 0 && <span>Half days: <b className="text-foreground">{a.halfDays}</b></span>}
                    {a.lastAbsence && (
                      <span>Last absence: <b className="text-foreground">{new Date(a.lastAbsence).toLocaleDateString()}</b></span>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => copyOutreach(a.childName, a.attendanceRate)}>
                      <ClipboardCopy className="h-3.5 w-3.5 mr-1.5" /> Copy outreach message
                    </Button>
                    <Link href={`/children/${a.childId}`}>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Child record
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
