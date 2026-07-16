import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle, ArrowRight, Briefcase, CheckCircle2, ChevronRight, Loader2,
  MessageSquare, Send, Sparkles, UserPlus, Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useIsAdmin } from "@/_core/hooks/useIsAdmin";

function scoreTone(score: number) {
  if (score >= 85) return "text-green-600";
  if (score >= 65) return "text-emerald-600";
  if (score >= 45) return "text-amber-600";
  return "text-red-600";
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

/**
 * Case-load management. Supervisors (admins) get the control tower —
 * per-advocate accountability cards, the unassigned queue, balanced
 * assignment suggestions, and an AI weekly summary. Advocates get a
 * focused, urgency-sorted "My Case Load" queue with one-tap broadcast
 * to exactly their families.
 */
export default function Caseloads() {
  const isAdmin = useIsAdmin();
  const utils = trpc.useUtils();

  // ---- Supervisor data (admin only) ----
  const overviewQuery = trpc.caseloads.overview.useQuery(ORGANIZATION_ID, { enabled: isAdmin });
  const suggestionsQuery = trpc.caseloads.suggestions.useQuery(ORGANIZATION_ID, { enabled: false });
  const overview = overviewQuery.data;

  // ---- Advocate data ----
  const mineQuery = trpc.caseloads.mine.useQuery(ORGANIZATION_ID);
  const mine = mineQuery.data ?? [];

  // ---- Assignment state ----
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [assignTo, setAssignTo] = useState("");
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const invalidate = () => {
    utils.caseloads.overview.invalidate(ORGANIZATION_ID);
    utils.caseloads.mine.invalidate(ORGANIZATION_ID);
    utils.families.list.invalidate(ORGANIZATION_ID);
  };

  const assign = trpc.caseloads.assign.useMutation({
    onSuccess: (res) => {
      invalidate();
      setSelected(new Set());
      toast.success(`${res.updated} famil${res.updated === 1 ? "y" : "ies"} assigned`);
      if (res.overCapacityWarning) toast.warning(res.overCapacityWarning);
    },
    onError: (e) => toast.error(e.message || "Assignment failed"),
  });

  const applySuggestions = async () => {
    const res = await suggestionsQuery.refetch();
    const suggestions = res.data ?? [];
    if (suggestions.length === 0) {
      toast.message("Nothing to suggest — every family is assigned or every advocate is at capacity.");
      return;
    }
    // Group by advocate so it's one mutation per advocate.
    const byAdvocate = new Map<number, number[]>();
    for (const s of suggestions) {
      byAdvocate.set(s.advocateId, [...(byAdvocate.get(s.advocateId) ?? []), s.familyId]);
    }
    for (const [advocateId, familyIds] of Array.from(byAdvocate.entries())) {
      await assign.mutateAsync({ organizationId: ORGANIZATION_ID, familyIds, advocateId });
    }
    toast.success(`Applied ${suggestions.length} balanced assignment${suggestions.length === 1 ? "" : "s"}`);
  };

  // ---- AI weekly summary ----
  const [summaryOpen, setSummaryOpen] = useState(false);
  const summary = trpc.caseloads.supervisorSummary.useMutation({
    onSuccess: () => setSummaryOpen(true),
    onError: (e) => toast.error(e.message || "Could not generate the summary"),
  });

  // ---- Broadcast to my case load ----
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const sendBroadcast = async () => {
    const body = broadcastBody.trim();
    if (!body) return;
    setBroadcastSending(true);
    try {
      const res = await fetch("/api/messaging/broadcast", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, audience: "caseload" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data as { error?: string } | null)?.error ?? "Broadcast failed");
      }
      const data = (await res.json()) as { sentCount?: number };
      toast.success(`Message sent to ${data.sentCount ?? "your"} families`);
      setBroadcastOpen(false);
      setBroadcastBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Broadcast failed");
    } finally {
      setBroadcastSending(false);
    }
  };

  const urgencyBadge = (u: 0 | 1 | 2) =>
    u === 2 ? (
      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Overdue</Badge>
    ) : u === 1 ? (
      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Needs attention</Badge>
    ) : (
      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">Steady</Badge>
    );

  const myCaseloadView = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {mine.length === 0
            ? "No families are assigned to you yet."
            : `${mine.length} famil${mine.length === 1 ? "y" : "ies"} in your care, most urgent first.`}
        </p>
        {mine.length > 0 && (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setBroadcastOpen(true)}>
            <MessageSquare className="h-4 w-4" /> Message my families
          </Button>
        )}
      </div>

      {mineQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : mine.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            When a supervisor assigns families to you, they show up here as your working queue.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {mine.map((f) => (
            <Link key={f.id} href={`/family-services?family=${f.id}`} asChild>
              <a className="flex flex-wrap items-center gap-3 rounded-xl border border-transparent bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{f.name}</p>
                    {urgencyBadge(f.urgency)}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {f.childCount} {f.childCount === 1 ? "child" : "children"}
                    {f.city ? ` · ${f.city}` : ""} · Last visit {fmtDate(f.lastVisit)}
                    {f.openGoals > 0 ? ` · ${f.openGoals} open goal${f.openGoals === 1 ? "" : "s"}` : ""}
                  </p>
                  {f.urgencyReason && (
                    <p className={cn("mt-1 text-xs font-medium", f.urgency === 2 ? "text-red-600" : "text-amber-600")}>
                      {f.urgencyReason}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Briefcase className="h-6 w-6 text-primary" /> Case Loads
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin
            ? "Who's carrying what — assignments, coverage, and where your advocates need support."
            : "The families in your care, sorted by who needs you next."}
        </p>
      </div>

      {!isAdmin ? (
        myCaseloadView
      ) : (
        <Tabs defaultValue="tower">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="tower" className="rounded-none border-b-2 border-transparent bg-transparent px-4 pb-2.5 pt-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
              Control Tower
            </TabsTrigger>
            <TabsTrigger value="mine" className="rounded-none border-b-2 border-transparent bg-transparent px-4 pb-2.5 pt-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
              My Case Load
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tower" className="mt-6 space-y-6">
            {overviewQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : overview ? (
              <>
                {/* Advocate accountability cards */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    Advocates <span className="ml-1 font-normal text-muted-foreground">limit {overview.caseloadLimit} families each</span>
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={summary.isPending}
                    onClick={() => summary.mutate(ORGANIZATION_ID)}
                  >
                    {summary.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    AI Weekly Summary
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {overview.advocates.filter((a) => a.familyCount > 0).map((a) => (
                    <Card key={a.staffId} className={cn("border-transparent shadow-sm", a.overCapacity && "border-red-300 bg-red-50/40")}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground">{a.name}</p>
                            <p className="text-xs text-muted-foreground">{a.position ?? "Staff"}</p>
                          </div>
                          <span className={cn("text-2xl font-bold", scoreTone(a.healthScore))}>{a.healthScore}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {a.familyCount}/{overview.caseloadLimit} families
                            {a.overCapacity && (
                              <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-red-600">
                                <AlertTriangle className="h-3 w-3" /> over capacity
                              </span>
                            )}
                          </span>
                          <span>{a.contactCoverage}% contacted this month</span>
                        </div>
                        <Progress value={Math.min(100, (a.familyCount / overview.caseloadLimit) * 100)} className="mt-1.5 h-1.5" />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {a.followUpsDue > 0 ? (
                            <span className="font-medium text-amber-600">{a.followUpsDue} follow-up{a.followUpsDue === 1 ? "" : "s"} due</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> follow-ups clear</span>
                          )}
                          {" · "}{a.openGoals} open goals
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {overview.advocates.filter((a) => a.familyCount > 0).length === 0 && (
                    <Card className="sm:col-span-2 lg:col-span-3">
                      <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        No advocate carries a case load yet — assign families from the queue below.
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Unassigned queue */}
                <Card className={cn("border-transparent shadow-sm", overview.unassigned.length > 0 && "border-amber-300 bg-amber-50/40")}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Users className="h-4 w-4" /> Unassigned Families
                          <Badge variant="secondary">{overview.unassigned.length}</Badge>
                        </CardTitle>
                        <CardDescription>
                          {overview.unassigned.length === 0
                            ? "Every family has an advocate. Nice."
                            : "Nobody owns these relationships yet — assign them below or let suggestions balance the loads."}
                        </CardDescription>
                      </div>
                      {overview.unassigned.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={assign.isPending || suggestionsQuery.isFetching}
                          onClick={applySuggestions}
                        >
                          {suggestionsQuery.isFetching || assign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          Auto-balance
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  {overview.unassigned.length > 0 && (
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Checkbox
                          checked={selected.size === overview.unassigned.length && selected.size > 0}
                          onCheckedChange={(v) =>
                            setSelected(v === true ? new Set(overview.unassigned.map((f) => f.id)) : new Set())
                          }
                          aria-label="Select all unassigned families"
                        />
                        <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                        <Select value={assignTo} onValueChange={setAssignTo}>
                          <SelectTrigger className="h-8 w-56 text-sm">
                            <SelectValue placeholder="Assign to advocate…" />
                          </SelectTrigger>
                          <SelectContent>
                            {overview.advocates.map((a) => (
                              <SelectItem key={a.staffId} value={String(a.staffId)}>
                                {a.name} ({a.familyCount})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="gap-1"
                          disabled={selected.size === 0 || !assignTo || assign.isPending}
                          onClick={() =>
                            assign.mutate({
                              organizationId: ORGANIZATION_ID,
                              familyIds: Array.from(selected),
                              advocateId: Number(assignTo),
                            })
                          }
                        >
                          {assign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                          Assign
                        </Button>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {overview.unassigned.map((f) => (
                          <label
                            key={f.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40"
                          >
                            <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} />
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{f.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {f.childCount} {f.childCount === 1 ? "child" : "children"}
                              {f.city ? ` · ${f.city}` : ""}
                            </span>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* Compliance heatmap */}
                <Card className="border-transparent shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Coverage by Advocate</CardTitle>
                    <CardDescription>Monthly contact coverage (visits, calls, coordinated services), open goals, and follow-ups.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="py-2 pr-4">Advocate</th>
                            <th className="py-2 pr-4">Families</th>
                            <th className="py-2 pr-4">Contacted this month</th>
                            <th className="py-2 pr-4">Follow-ups due</th>
                            <th className="py-2 pr-4">Open goals</th>
                            <th className="py-2">Health</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.advocates.filter((a) => a.familyCount > 0).map((a) => (
                            <tr key={a.staffId} className="border-b border-border/60">
                              <td className="py-2 pr-4 font-medium text-foreground">{a.name}</td>
                              <td className="py-2 pr-4">{a.familyCount}{a.overCapacity && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-red-500" />}</td>
                              <td className={cn("py-2 pr-4", a.contactCoverage >= 80 ? "text-green-600" : a.contactCoverage >= 50 ? "text-amber-600" : "text-red-600")}>
                                {a.contactedThisMonth} ({a.contactCoverage}%)
                              </td>
                              <td className={cn("py-2 pr-4", a.followUpsDue > 0 ? "text-amber-600" : "text-muted-foreground")}>{a.followUpsDue}</td>
                              <td className="py-2 pr-4 text-muted-foreground">{a.openGoals}</td>
                              <td className={cn("py-2 font-semibold", scoreTone(a.healthScore))}>{a.healthScore}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="mine" className="mt-6">
            {myCaseloadView}
          </TabsContent>
        </Tabs>
      )}

      {/* AI weekly summary */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Weekly Supervisor Summary
            </DialogTitle>
            <DialogDescription>AI digest of this month's case-load metrics. Verify before acting.</DialogDescription>
          </DialogHeader>
          {summary.data && (
            <div className="space-y-4 text-sm">
              <p className="leading-relaxed text-foreground">{summary.data.summary}</p>
              {summary.data.doingWell.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase text-green-700">Going well</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {summary.data.doingWell.map((s, i) => <li key={i}>· {s}</li>)}
                  </ul>
                </div>
              )}
              {summary.data.needsSupport.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-700">Needs support</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {summary.data.needsSupport.map((s, i) => <li key={i}>· {s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcast to my case load */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message your families</DialogTitle>
            <DialogDescription>
              Goes to every family assigned to you, in each family's language, via the family app.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={broadcastBody}
            onChange={(e) => setBroadcastBody(e.target.value)}
            rows={4}
            placeholder="e.g., Reminder: parent conferences are next week — pick a time that works for you!"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
            <Button disabled={!broadcastBody.trim() || broadcastSending} onClick={sendBroadcast} className="gap-1">
              {broadcastSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
