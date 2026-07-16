import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, Loader2, Search, Stethoscope,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";

type DState = "complete" | "due_soon" | "overdue" | "pending";

const STATE_META: Record<DState, { label: string; badge: string }> = {
  complete: { label: "Complete", badge: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" },
  due_soon: { label: "Due Soon", badge: "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100" },
  overdue: { label: "Overdue", badge: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100" },
  pending: { label: "Pending", badge: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" },
};

function DeadlineChip({
  title,
  item,
}: {
  title: string;
  item: { state: DState; deadline: string; daysLeft: number };
}) {
  const meta = STATE_META[item.state];
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <div>
        <div className="text-xs font-medium">{title}</div>
        <div className="text-[11px] text-muted-foreground">
          {item.state === "complete"
            ? "On file"
            : item.daysLeft < 0
              ? `${Math.abs(item.daysLeft)} days past deadline`
              : `${item.daysLeft} days left · due ${new Date(item.deadline).toLocaleDateString()}`}
        </div>
      </div>
      <Badge className={`${meta.badge} text-xs shrink-0`}>{meta.label}</Badge>
    </div>
  );
}

export default function HealthDeadlines() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "action" | "complete">("action");

  const query = trpc.healthDeadlines.summary.useQuery({ organizationId: ORGANIZATION_ID });
  const s = query.data;

  const items = useMemo(() => {
    const list = s?.items ?? [];
    return list.filter((c) => {
      const complete = c.screening.state === "complete" && c.dental.state === "complete";
      if (filter === "action" && complete) return false;
      if (filter === "complete" && !complete) return false;
      if (search && !c.childName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [s, filter, search]);

  const screeningPct = s && s.childrenTracked > 0 ? Math.round((s.screeningComplete / s.childrenTracked) * 100) : 0;
  const dentalPct = s && s.childrenTracked > 0 ? Math.round((s.dentalComplete / s.childrenTracked) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-primary" />
          Health Deadlines
        </h1>
        <p className="text-sm text-muted-foreground">
          Head Start §1302.42 — 45-day health screening and 90-day dental determination from enrollment
        </p>
      </div>

      {/* Program summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Stethoscope className="h-4 w-4" /> 45-day screening
            </CardDescription>
            <CardTitle className="text-3xl">{s ? `${screeningPct}%` : "—"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={screeningPct} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {s ? `${s.screeningComplete}/${s.childrenTracked} children complete` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> 90-day dental
            </CardDescription>
            <CardTitle className="text-3xl">{s ? `${dentalPct}%` : "—"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={dentalPct} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              {s ? `${s.dentalComplete}/${s.childrenTracked} children complete` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Needs action
            </CardDescription>
            <CardTitle className={`text-3xl ${(s?.overdueCount ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
              {s ? s.overdueCount + s.dueSoonCount : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {s ? `${s.overdueCount} overdue · ${s.dueSoonCount} due within 14 days` : ""}
          </CardContent>
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
        {([
          ["action", "Needs action"],
          ["all", "All"],
          ["complete", "Complete"],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* List */}
      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            {filter === "action"
              ? "No outstanding deadlines — every child is compliant. 🎉"
              : "No children match the current filter."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((c) => (
            <Card key={c.childId}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{c.childName}</CardTitle>
                    <CardDescription>
                      Enrolled {new Date(c.enrollmentDate).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Link href={`/health?child=${c.childId}`}>
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Records
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <DeadlineChip title="45-day screening" item={c.screening as any} />
                <DeadlineChip title="90-day dental" item={c.dental as any} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
