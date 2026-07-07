import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { School, Loader2, Plus, NotebookPen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { dateInputToLocal } from "@/lib/date";

/** CLASS® Pre-K: three domains, ten dimensions, scored 1–7. */
const CLASS_DOMAINS: Record<string, { label: string; short: string; dims: Record<string, string>; competitive: number; reversed?: string[] }> = {
  emotional_support: {
    label: "Emotional Support", short: "ES", competitive: 6,
    dims: {
      positive_climate: "Positive Climate",
      negative_climate: "Negative Climate (low = good)",
      teacher_sensitivity: "Teacher Sensitivity",
      regard_perspectives: "Regard for Student Perspectives",
    },
    reversed: ["negative_climate"],
  },
  classroom_organization: {
    label: "Classroom Organization", short: "CO", competitive: 6,
    dims: {
      behavior_management: "Behavior Management",
      productivity: "Productivity",
      instructional_formats: "Instructional Learning Formats",
    },
  },
  instructional_support: {
    label: "Instructional Support", short: "IS", competitive: 3,
    dims: {
      concept_development: "Concept Development",
      quality_feedback: "Quality of Feedback",
      language_modeling: "Language Modeling",
    },
  },
};

const ECERS_SUBSCALES: Record<string, string> = {
  space_furnishings: "Space & Furnishings",
  personal_care: "Personal Care Routines",
  language_literacy: "Language & Literacy",
  learning_activities: "Learning Activities",
  interaction: "Interaction",
  program_structure: "Program Structure",
};

/** Domain average with reversed dimensions flipped (8 − score). */
function domainAverage(scores: Record<string, number>, domainKey: string): number | null {
  const domain = CLASS_DOMAINS[domainKey];
  const vals: number[] = [];
  for (const dim of Object.keys(domain.dims)) {
    const raw = scores[dim];
    if (raw == null) continue;
    vals.push(domain.reversed?.includes(dim) ? 8 - raw : raw);
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export default function ClassroomQuality() {
  const utils = trpc.useUtils();
  const listQuery = trpc.classroomQuality.list.useQuery({ organizationId: ORGANIZATION_ID });
  const classroomsQuery = trpc.classrooms.list.useQuery(ORGANIZATION_ID);
  const [showNew, setShowNew] = useState(false);

  const assessments = listQuery.data ?? [];
  const classAssessments = assessments.filter((a) => a.tool === "class");

  // Latest CLASS domain averages across the newest assessment per classroom.
  const latest = useMemo(() => {
    const byClassroom = new Map<number, (typeof classAssessments)[number]>();
    for (const a of classAssessments) {
      if (!byClassroom.has(a.classroomId)) byClassroom.set(a.classroomId, a); // list is date-desc
    }
    const per = Array.from(byClassroom.values());
    const avg = (key: string) => {
      const vals = per.map((a) => domainAverage(a.scores, key)).filter((v): v is number => v != null);
      return vals.length ? Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 10) / 10 : null;
    };
    return {
      emotional_support: avg("emotional_support"),
      classroom_organization: avg("classroom_organization"),
      instructional_support: avg("instructional_support"),
      classroomsObserved: per.length,
    };
  }, [classAssessments]);

  // Program-wide trend: each CLASS assessment becomes a data point per domain.
  const trend = useMemo(
    () =>
      [...classAssessments]
        .sort((a, b) => new Date(a.assessmentDate).getTime() - new Date(b.assessmentDate).getTime())
        .map((a) => ({
          date: new Date(a.assessmentDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          ES: domainAverage(a.scores, "emotional_support"),
          CO: domainAverage(a.scores, "classroom_organization"),
          IS: domainAverage(a.scores, "instructional_support"),
        })),
    [classAssessments]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <School className="h-6 w-6 text-primary" />
            Classroom Quality
          </h1>
          <p className="text-sm text-muted-foreground">
            CLASS® and ECERS observations — OHS uses CLASS in federal reviews; track it before they do
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" />Record Observation
        </Button>
      </div>

      {/* CLASS domain summary vs competitive thresholds */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Object.entries(CLASS_DOMAINS).map(([key, d]) => {
          const v = latest[key as keyof typeof latest] as number | null;
          const ok = v != null && v >= d.competitive;
          return (
            <Card key={key} className={v != null && !ok ? "border-orange-200" : ""}>
              <CardHeader className="pb-2">
                <CardDescription>{d.label}</CardDescription>
                <CardTitle className={`text-3xl ${v == null ? "" : ok ? "text-green-600" : "text-orange-600"}`}>
                  {v ?? "—"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Competitive threshold: {d.competitive}.0 · {latest.classroomsObserved} classroom{latest.classroomsObserved === 1 ? "" : "s"} observed
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trend chart */}
      {trend.length >= 2 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">CLASS domain trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[1, 7]} fontSize={11} />
                <Tooltip />
                <ReferenceLine y={6} strokeDasharray="4 4" stroke="#94a3b8" />
                <ReferenceLine y={3} strokeDasharray="4 4" stroke="#94a3b8" />
                <Line type="monotone" dataKey="ES" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="CO" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="IS" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-1">
              Dashed lines: competitive thresholds (ES/CO 6.0 · IS 3.0)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Assessment history */}
      {listQuery.isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : assessments.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No observations yet. Record a CLASS or ECERS observation to start the quality trend.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{a.classroomName}</h3>
                    <Badge variant="outline" className="text-xs uppercase">{a.tool}</Badge>
                    {a.tool === "class" &&
                      Object.entries(CLASS_DOMAINS).map(([key, d]) => {
                        const v = domainAverage(a.scores, key);
                        if (v == null) return null;
                        const ok = v >= d.competitive;
                        return (
                          <Badge key={key} className={`text-xs ${ok ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100"}`}>
                            {d.short} {v}
                          </Badge>
                        );
                      })}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.assessmentDate).toLocaleDateString()}{a.observer ? ` · ${a.observer}` : ""}
                  </span>
                </div>
                {a.tool === "ecers" && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {Object.entries(ECERS_SUBSCALES).map(([k, label]) =>
                      a.scores[k] != null ? <span key={k}>{label}: <b className="text-foreground">{a.scores[k]}</b></span> : null
                    )}
                  </div>
                )}
                {a.coachingNotes && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <NotebookPen className="h-3.5 w-3.5 shrink-0 mt-0.5" />{a.coachingNotes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showNew && (
        <ObservationDialog
          classroomList={(classroomsQuery.data ?? []) as Array<{ id: number; name: string }>}
          onClose={(changed) => { setShowNew(false); if (changed) utils.classroomQuality.list.invalidate(); }}
        />
      )}
    </div>
  );
}

function ScoreSelect({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <Select value={value != null ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-8 w-16 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
      <SelectContent>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ObservationDialog({
  classroomList,
  onClose,
}: {
  classroomList: Array<{ id: number; name: string }>;
  onClose: (changed: boolean) => void;
}) {
  const [classroomId, setClassroomId] = useState("");
  const [tool, setTool] = useState<"class" | "ecers">("class");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [observer, setObserver] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  const createMut = trpc.classroomQuality.create.useMutation({
    onSuccess: () => { toast.success("Observation recorded"); onClose(true); },
    onError: (e) => toast.error(e.message),
  });

  const setScore = (dim: string, v: number) => setScores((p) => ({ ...p, [dim]: v }));

  const save = () => {
    if (!classroomId) return toast.error("Select a classroom.");
    if (Object.keys(scores).length === 0) return toast.error("Enter at least one score.");
    createMut.mutate({
      organizationId: ORGANIZATION_ID,
      classroomId: Number(classroomId),
      tool,
      assessmentDate: dateInputToLocal(date) ?? new Date(),
      observer: observer.trim() || null,
      scores,
      coachingNotes: notes.trim() || null,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record a Classroom Observation</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Classroom</Label>
              <Select value={classroomId} onValueChange={setClassroomId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {classroomList.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tool</Label>
              <Select value={tool} onValueChange={(v) => { setTool(v as any); setScores({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">CLASS®</SelectItem>
                  <SelectItem value="ecers">ECERS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Observer</Label><Input value={observer} onChange={(e) => setObserver(e.target.value)} placeholder="Name" /></div>
          </div>

          {tool === "class" ? (
            Object.entries(CLASS_DOMAINS).map(([key, d]) => (
              <div key={key} className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{d.label}</p>
                {Object.entries(d.dims).map(([dim, label]) => (
                  <div key={dim} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{label}</span>
                    <ScoreSelect value={scores[dim]} onChange={(v) => setScore(dim, v)} />
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ECERS subscales (1–7)</p>
              {Object.entries(ECERS_SUBSCALES).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{label}</span>
                  <ScoreSelect value={scores[k]} onChange={(v) => setScore(k, v)} />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Coaching notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Strengths observed, growth areas, coaching plan…" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button onClick={save} disabled={createMut.isPending} className="gap-2">
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save Observation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
