import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Accessibility, AlertTriangle, CheckCircle2, Clock, FileSignature, Loader2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { dateInputToLocal } from "@/lib/date";

const PLAN_LABELS: Record<string, string> = { iep: "IEP", ifsp: "IFSP", section_504: "504 Plan" };

const STATUS_META: Record<string, { label: string; badge: string }> = {
  active: { label: "Active", badge: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" },
  pending_evaluation: { label: "Pending Evaluation", badge: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" },
  expired: { label: "Expired", badge: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100" },
  exited: { label: "Exited", badge: "bg-muted text-muted-foreground border-border hover:bg-muted" },
};

const TRANSITION_STEPS: Record<string, string> = {
  records_consent: "Records-transfer consent signed",
  lea_meeting: "Transition meeting with LEA held",
  school_registration: "Kindergarten registration info shared",
  school_visit: "Receiving-school visit scheduled",
  progress_summary: "Final progress summary delivered",
};

const RIGHTS_LANGUAGES = ["English", "Español", "Kreyòl Ayisyen", "简体中文", "Tiếng Việt", "العربية"];

export default function DisabilityServices() {
  const utils = trpc.useUtils();
  const summaryQuery = trpc.disabilityServices.summary.useQuery({ organizationId: ORGANIZATION_ID });
  const childrenQuery = trpc.children.list.useQuery(ORGANIZATION_ID);
  const s = summaryQuery.data;

  const [showEditor, setShowEditor] = useState(false);
  const refresh = () => utils.disabilityServices.summary.invalidate();

  const setTransitionMut = trpc.disabilityServices.setTransition.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  const rightsMut = trpc.disabilityServices.markParentRights.useMutation({
    onSuccess: () => { refresh(); toast.success("Parent rights notification recorded"); },
    onError: (e) => toast.error(e.message),
  });

  const toggleStep = (rec: { id: number; transitionChecklist: string[] | null }, step: string) => {
    const current = new Set(rec.transitionChecklist ?? []);
    if (current.has(step)) current.delete(step);
    else current.add(step);
    setTransitionMut.mutate({ id: rec.id, organizationId: ORGANIZATION_ID, steps: Array.from(current) });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Accessibility className="h-6 w-6 text-primary" />
            Disability Services
          </h1>
          <p className="text-sm text-muted-foreground">
            Head Start §1302.60–63 — IEP/IFSP coordination, the 10% enrollment requirement, and kindergarten transitions
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowEditor(true)}>
          <Plus className="h-4 w-4" />Add Plan
        </Button>
      </div>

      {/* Compliance cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className={s && !s.meetsTenPercent ? "border-orange-200" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              {s?.meetsTenPercent ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-orange-500" />}
              10% requirement
            </CardDescription>
            <CardTitle className={`text-3xl ${s ? (s.meetsTenPercent ? "text-green-600" : "text-orange-600") : ""}`}>
              {s ? `${s.pctOfEnrollment}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {s ? `${s.childrenWithPlans} of ${s.activeEnrollment} enrolled children` : "Children with active plans"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Reviews due in 30 days</CardDescription>
            <CardTitle className={`text-3xl ${(s?.expiringSoon ?? 0) > 0 ? "text-orange-600" : "text-green-600"}`}>
              {s?.expiringSoon ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Annual review / expiration approaching</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><FileSignature className="h-4 w-4" />Parent rights pending</CardDescription>
            <CardTitle className={`text-3xl ${(s?.parentRightsPending ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}>
              {s?.parentRightsPending ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Must be notified in the family's language</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Plans on record</CardDescription>
            <CardTitle className="text-3xl">{s?.records.length ?? "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All statuses, all plan types</CardContent>
        </Card>
      </div>

      {/* Records */}
      {summaryQuery.isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (s?.records.length ?? 0) === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No IEP/IFSP records yet. Add each child's plan to track the 10% requirement and review deadlines.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {s!.records.map((rec) => {
            const meta = STATUS_META[rec.status] ?? STATUS_META.active;
            const daysLeft = rec.expirationDate
              ? Math.ceil((new Date(rec.expirationDate).getTime() - Date.now()) / (24 * 3600 * 1000))
              : null;
            const done = new Set(rec.transitionChecklist ?? []);
            return (
              <Card key={rec.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {rec.childName}
                        <Badge variant="outline" className="text-xs">{PLAN_LABELS[rec.planType]}</Badge>
                        <Badge className={`${meta.badge} text-xs`}>{meta.label}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {rec.primaryDisability ?? "Disability not specified"}
                        {rec.leaAgency && <> · LEA: {rec.leaAgency}{rec.leaContact ? ` (${rec.leaContact})` : ""}</>}
                      </CardDescription>
                    </div>
                    {daysLeft != null && rec.status === "active" && (
                      <div className={`text-right text-xs font-semibold ${daysLeft < 0 ? "text-red-600" : daysLeft <= 30 ? "text-orange-600" : "text-muted-foreground"}`}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d to review`}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Parent rights */}
                  {rec.parentRightsNotifiedAt ? (
                    <p className="text-xs text-green-700 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Parent rights notified {new Date(rec.parentRightsNotifiedAt).toLocaleDateString()}
                      {rec.parentRightsLanguage && ` (${rec.parentRightsLanguage})`}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />Parent rights not yet documented
                      </span>
                      <Select onValueChange={(lang) => rightsMut.mutate({ id: rec.id, organizationId: ORGANIZATION_ID, language: lang })}>
                        <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Record — language" /></SelectTrigger>
                        <SelectContent>
                          {RIGHTS_LANGUAGES.map((l) => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Transition checklist */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Kindergarten transition ({done.size}/{Object.keys(TRANSITION_STEPS).length})
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {Object.entries(TRANSITION_STEPS).map(([step, label]) => (
                        <button
                          key={step}
                          onClick={() => toggleStep(rec, step)}
                          disabled={setTransitionMut.isPending}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                            done.has(step)
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-border text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          {done.has(step) ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Clock className="h-3.5 w-3.5 shrink-0" />}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {rec.notes && <p className="text-xs text-muted-foreground">{rec.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showEditor && (
        <PlanEditorDialog
          childList={(childrenQuery.data ?? []) as Array<{ id: number; firstName: string; lastName: string }>}
          onClose={(changed) => { setShowEditor(false); if (changed) refresh(); }}
        />
      )}
    </div>
  );
}

function PlanEditorDialog({
  childList,
  onClose,
}: {
  childList: Array<{ id: number; firstName: string; lastName: string }>;
  onClose: (changed: boolean) => void;
}) {
  const [childId, setChildId] = useState("");
  const [planType, setPlanType] = useState<"iep" | "ifsp" | "section_504">("iep");
  const [status, setStatus] = useState<"pending_evaluation" | "active" | "expired" | "exited">("active");
  const [disability, setDisability] = useState("");
  const [effective, setEffective] = useState("");
  const [expiration, setExpiration] = useState("");
  const [leaAgency, setLeaAgency] = useState("");
  const [leaContact, setLeaContact] = useState("");
  const [notes, setNotes] = useState("");

  const upsertMut = trpc.disabilityServices.upsert.useMutation({
    onSuccess: () => { toast.success("Plan saved"); onClose(true); },
    onError: (e) => toast.error(e.message),
  });

  const save = () => {
    if (!childId) return toast.error("Select a child.");
    upsertMut.mutate({
      organizationId: ORGANIZATION_ID,
      childId: Number(childId),
      planType,
      status,
      primaryDisability: disability.trim() || null,
      effectiveDate: effective ? dateInputToLocal(effective) : null,
      expirationDate: expiration ? dateInputToLocal(expiration) : null,
      leaAgency: leaAgency.trim() || null,
      leaContact: leaContact.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add IEP / IFSP / 504 Plan</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Child</Label>
              <Select value={childId} onValueChange={setChildId}>
                <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
                <SelectContent>
                  {childList.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plan type</Label>
              <Select value={planType} onValueChange={(v) => setPlanType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="iep">IEP (3–5, LEA)</SelectItem>
                  <SelectItem value="ifsp">IFSP (0–3, Part C)</SelectItem>
                  <SelectItem value="section_504">Section 504</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Primary disability</Label>
              <Input value={disability} onChange={(e) => setDisability(e.target.value)} placeholder="e.g. Speech/language impairment" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Effective date</Label><Input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} /></div>
            <div className="space-y-2"><Label>Annual review / expires</Label><Input type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>LEA / Part C agency</Label><Input value={leaAgency} onChange={(e) => setLeaAgency(e.target.value)} placeholder="Agency name" /></div>
            <div className="space-y-2"><Label>LEA contact</Label><Input value={leaContact} onChange={(e) => setLeaContact(e.target.value)} placeholder="Name / phone" /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Services provided, accommodations…" /></div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button onClick={save} disabled={upsertMut.isPending} className="gap-2">
              {upsertMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save Plan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
