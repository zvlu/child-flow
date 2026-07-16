import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileSignature, Handshake, Home, Loader2, Plus, Search, Target, X, CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { dateInputToLocal } from "@/lib/date";

type FpaStatus = "none" | "draft" | "active" | "review_due" | "completed" | "expired";

const STATUS_META: Record<FpaStatus, { label: string; badge: string }> = {
  none: { label: "No FPA", badge: "bg-muted text-muted-foreground border-border hover:bg-muted" },
  draft: { label: "Draft", badge: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" },
  active: { label: "Active", badge: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" },
  review_due: { label: "Review Due", badge: "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100" },
  completed: { label: "Completed", badge: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
  expired: { label: "Expired", badge: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100" },
};

export default function FamilyPartnership() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FpaStatus | "all">("all");
  const [editingFamilyId, setEditingFamilyId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const listQuery = trpc.fpa.list.useQuery({ organizationId: ORGANIZATION_ID });

  const rows = useMemo(() => {
    const list = listQuery.data ?? [];
    return list.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search && !r.familyName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [listQuery.data, statusFilter, search]);

  const stats = useMemo(() => {
    const list = listQuery.data ?? [];
    return {
      total: list.length,
      active: list.filter((r) => r.status === "active").length,
      missing: list.filter((r) => r.status === "none").length,
      fullySigned: list.filter((r) => r.parentSigned && r.staffSigned).length,
    };
  }, [listQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Handshake className="h-6 w-6 text-primary" />
            Family Partnership Agreements
          </h1>
          <p className="text-sm text-muted-foreground">
            Head Start §1302.52 — strengths, goals, home visits, and signatures per family
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Families", value: stats.total, cls: "" },
          { label: "Active FPAs", value: stats.active, cls: "text-green-600" },
          { label: "No agreement yet", value: stats.missing, cls: stats.missing > 0 ? "text-orange-600" : "text-green-600" },
          { label: "Fully signed", value: stats.fullySigned, cls: "" },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className={`text-3xl ${c.cls}`}>{listQuery.isLoading ? "—" : c.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search family…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-56"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FpaStatus | "all")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_META) as FpaStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Family list */}
      {listQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            No families match the current filter.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => {
            const meta = STATUS_META[r.status as FpaStatus];
            const goalPct = r.goalsTotal > 0 ? Math.round((r.goalsCompleted / r.goalsTotal) * 100) : 0;
            const visitPct = r.targetVisits > 0 ? Math.min(100, Math.round((r.visitsLogged / r.targetVisits) * 100)) : 0;
            return (
              <Card key={r.familyId} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setEditingFamilyId(r.familyId)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{r.familyName}</CardTitle>
                    <Badge className={`${meta.badge} text-xs`}>{meta.label}</Badge>
                  </div>
                  {r.reviewDate && (
                    <CardDescription>
                      Review: {new Date(r.reviewDate).toLocaleDateString()}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Target className="h-3.5 w-3.5" /> Goals
                      </span>
                      <span>{r.goalsCompleted}/{r.goalsTotal} complete</span>
                    </div>
                    <Progress value={goalPct} className="h-1.5" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Home className="h-3.5 w-3.5" /> Home visits
                      </span>
                      <span>{r.visitsLogged}/{r.targetVisits}</span>
                    </div>
                    <Progress value={visitPct} className="h-1.5" />
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <FileSignature className="h-3.5 w-3.5" />
                      Parent {r.parentSigned ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileSignature className="h-3.5 w-3.5" />
                      Staff {r.staffSigned ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editingFamilyId != null && (
        <FpaEditorDialog
          familyId={editingFamilyId}
          onClose={() => {
            setEditingFamilyId(null);
            utils.fpa.list.invalidate();
          }}
        />
      )}
    </div>
  );
}

function FpaEditorDialog({ familyId, onClose }: { familyId: number; onClose: () => void }) {
  const detailQuery = trpc.fpa.detail.useQuery({ organizationId: ORGANIZATION_ID, familyId });
  const upsertMutation = trpc.fpa.upsert.useMutation();

  const [status, setStatus] = useState<Exclude<FpaStatus, "none">>("draft");
  const [strengths, setStrengths] = useState<string[]>([]);
  const [newStrength, setNewStrength] = useState("");
  const [needs, setNeeds] = useState("");
  const [targetVisits, setTargetVisits] = useState(2);
  const [reviewDate, setReviewDate] = useState("");
  const [parentSigned, setParentSigned] = useState(false);
  const [staffSigned, setStaffSigned] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const d = detailQuery.data;

  useEffect(() => {
    if (!d || hydrated) return;
    const a = d.agreement;
    if (a) {
      setStatus(a.status);
      setStrengths(Array.isArray(a.strengths) ? a.strengths : []);
      setNeeds(a.needsAssessment ?? "");
      setTargetVisits(a.targetVisits);
      setReviewDate(a.reviewDate ? new Date(a.reviewDate).toISOString().slice(0, 10) : "");
      setParentSigned(a.parentSigned === 1);
      setStaffSigned(a.staffSigned === 1);
    }
    setHydrated(true);
  }, [d, hydrated]);

  const addStrength = () => {
    const s = newStrength.trim();
    if (!s) return;
    if (strengths.includes(s)) return toast.error("Already added");
    setStrengths([...strengths, s]);
    setNewStrength("");
  };

  const save = async () => {
    try {
      await upsertMutation.mutateAsync({
        organizationId: ORGANIZATION_ID,
        familyId,
        status,
        strengths,
        needsAssessment: needs || null,
        targetVisits,
        reviewDate: reviewDate ? (dateInputToLocal(reviewDate) ?? null) : null,
        parentSigned,
        staffSigned,
      });
      toast.success("Family Partnership Agreement saved");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save agreement");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            {d?.familyName ?? "Family"} — Partnership Agreement
          </DialogTitle>
          <DialogDescription>
            §1302.52: identify strengths, set goals, plan visits, collect signatures.
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["draft", "active", "review_due", "completed", "expired"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Review date</Label>
                <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Family strengths</Label>
              <div className="flex flex-wrap gap-1.5">
                {strengths.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1">
                    {s}
                    <button onClick={() => setStrengths(strengths.filter((x) => x !== s))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {strengths.length === 0 && (
                  <span className="text-xs text-muted-foreground">None recorded yet</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Strong extended-family support"
                  value={newStrength}
                  onChange={(e) => setNewStrength(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStrength())}
                />
                <Button type="button" variant="outline" size="icon" onClick={addStrength}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Needs assessment</Label>
              <Textarea
                rows={3}
                placeholder="Housing, employment, education, health needs identified with the family…"
                value={needs}
                onChange={(e) => setNeeds(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <Label>Target home visits</Label>
                <Input
                  type="number" min={1} max={52}
                  value={targetVisits}
                  onChange={(e) => setTargetVisits(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <Button
                type="button"
                variant={parentSigned ? "default" : "outline"}
                onClick={() => setParentSigned(!parentSigned)}
              >
                <FileSignature className="h-4 w-4 mr-1.5" />
                Parent {parentSigned ? "signed ✓" : "signature"}
              </Button>
              <Button
                type="button"
                variant={staffSigned ? "default" : "outline"}
                onClick={() => setStaffSigned(!staffSigned)}
              >
                <FileSignature className="h-4 w-4 mr-1.5" />
                Staff {staffSigned ? "signed ✓" : "signature"}
              </Button>
            </div>

            {/* Read-only context: goals + visits */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Target className="h-4 w-4" /> Goals ({d?.goals.length ?? 0})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-40 overflow-y-auto">
                  {(d?.goals ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No goals yet — add them in Family Services.
                    </p>
                  )}
                  {(d?.goals ?? []).map((g) => (
                    <div key={g.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate">{g.title}</span>
                        <span className="text-muted-foreground shrink-0">{g.progress}%</span>
                      </div>
                      <Progress value={g.progress} className="h-1" />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1.5">
                    <Home className="h-4 w-4" /> Home visits ({d?.visits.length ?? 0})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 max-h-40 overflow-y-auto">
                  {(d?.visits ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No home visits logged — record them in Family Services.
                    </p>
                  )}
                  {(d?.visits ?? []).map((v) => (
                    <div key={v.id} className="text-xs">
                      <div className="font-medium">{new Date(v.serviceDate).toLocaleDateString()}</div>
                      <div className="text-muted-foreground line-clamp-2">{v.description}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={upsertMutation.isPending || detailQuery.isLoading}>
            {upsertMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Save agreement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
