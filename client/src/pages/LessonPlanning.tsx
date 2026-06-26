import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BookOpen, Plus, ChevronLeft, Loader2, Trash2, CalendarDays, Send, Undo2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";

const DAYS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
] as const;

const DOMAINS = [
  { value: "social_emotional", label: "Social-Emotional", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "language_literacy", label: "Language & Literacy", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "cognition", label: "Cognition", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "physical", label: "Physical", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "creative_arts", label: "Creative Arts", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "approaches_to_learning", label: "Approaches to Learning", color: "bg-teal-100 text-teal-700 border-teal-200" },
];
const DOMAIN_META = Object.fromEntries(DOMAINS.map((d) => [d.value, d]));

function weekLabel(d: string | Date) {
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : `Week of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}
function mondayOfThisWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function LessonPlanning() {
  const utils = trpc.useUtils();
  const [openPlanId, setOpenPlanId] = useState<number | null>(null);

  // New-plan dialog
  const [newOpen, setNewOpen] = useState(false);
  const [npClassroom, setNpClassroom] = useState("");
  const [npWeek, setNpWeek] = useState(mondayOfThisWeek());
  const [npTheme, setNpTheme] = useState("");

  // Add-activity dialog
  const [actOpen, setActOpen] = useState(false);
  const [actDay, setActDay] = useState<string>("monday");
  const [actTitle, setActTitle] = useState("");
  const [actDesc, setActDesc] = useState("");
  const [actDomain, setActDomain] = useState("");

  const { data: plans, isLoading } = trpc.lessonPlanning.list.useQuery(ORGANIZATION_ID);
  const { data: classrooms } = trpc.classrooms.list.useQuery(ORGANIZATION_ID);
  const { data: plan } = trpc.lessonPlanning.get.useQuery(openPlanId!, { enabled: openPlanId != null });

  const createPlan = trpc.lessonPlanning.createPlan.useMutation({
    onSuccess: (res) => {
      utils.lessonPlanning.list.invalidate();
      toast.success("Lesson plan created");
      setNewOpen(false); setNpClassroom(""); setNpTheme("");
      setOpenPlanId(res.id);
    },
    onError: (e) => toast.error(e.message),
  });
  const updatePlan = trpc.lessonPlanning.updatePlan.useMutation({
    onSuccess: () => { utils.lessonPlanning.list.invalidate(); utils.lessonPlanning.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const addActivity = trpc.lessonPlanning.addActivity.useMutation({
    onSuccess: () => {
      utils.lessonPlanning.get.invalidate();
      toast.success("Activity added");
      setActOpen(false); setActTitle(""); setActDesc(""); setActDomain("");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteActivity = trpc.lessonPlanning.deleteActivity.useMutation({
    onSuccess: () => utils.lessonPlanning.get.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const submitNewPlan = () => {
    if (!npClassroom) { toast.error("Pick a classroom"); return; }
    createPlan.mutate({ organizationId: ORGANIZATION_ID, classroomId: Number(npClassroom), weekStartDate: npWeek, theme: npTheme || undefined });
  };
  const submitActivity = () => {
    if (openPlanId == null) return;
    if (!actTitle.trim()) { toast.error("Activity needs a title"); return; }
    addActivity.mutate({
      lessonPlanId: openPlanId,
      dayOfWeek: actDay as any,
      title: actTitle.trim(),
      description: actDesc.trim() || undefined,
      domain: (actDomain || undefined) as any,
    });
  };

  // ---- Detail view ----
  if (openPlanId != null && plan) {
    const byDay = (day: string) => (plan.activities ?? []).filter((a: any) => a.dayOfWeek === day);
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setOpenPlanId(null)}>
              <ChevronLeft className="h-4 w-4" /> Plans
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{plan.classroomName}</h1>
              <p className="text-muted-foreground text-sm">{weekLabel(plan.weekStartDate)}{plan.theme ? ` · ${plan.theme}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={plan.status === "published" ? "default" : "secondary"}>{plan.status === "published" ? "Published" : "Draft"}</Badge>
            {plan.status === "draft" ? (
              <Button size="sm" className="gap-2" disabled={updatePlan.isPending}
                onClick={() => updatePlan.mutate({ id: plan.id, status: "published" })}>
                <Send className="h-4 w-4" /> Publish
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="gap-2" disabled={updatePlan.isPending}
                onClick={() => updatePlan.mutate({ id: plan.id, status: "draft" })}>
                <Undo2 className="h-4 w-4" /> Unpublish
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {DAYS.map((d) => (
            <Card key={d.value}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm text-foreground">{d.label}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setActDay(d.value); setActOpen(true); }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {byDay(d.value).length === 0 && <p className="text-xs text-muted-foreground py-2">No activities</p>}
                  {byDay(d.value).map((a: any) => {
                    const dm = a.domain ? DOMAIN_META[a.domain] : null;
                    return (
                      <div key={a.id} className="group rounded-lg border border-border p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{a.title}</p>
                          <button onClick={() => deleteActivity.mutate({ id: a.id, lessonPlanId: plan.id })}
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                        {dm && <Badge className={`mt-1.5 text-[10px] ${dm.color} hover:${dm.color}`}>{dm.label}</Badge>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <ActivityDialog
          open={actOpen} onOpenChange={setActOpen}
          day={actDay} setDay={setActDay}
          title={actTitle} setTitle={setActTitle}
          desc={actDesc} setDesc={setActDesc}
          domain={actDomain} setDomain={setActDomain}
          onSubmit={submitActivity} pending={addActivity.isPending}
        />
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lesson Planning</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Plan each classroom's week with activities aligned to developmental domains.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" />New Plan</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (plans ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No lesson plans yet</p>
          <p className="text-sm mt-1">Create one to start planning a classroom's week.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(plans ?? []).map((p: any) => (
            <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenPlanId(p.id)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{p.classroomName}</h3>
                  <Badge variant={p.status === "published" ? "default" : "secondary"} className="text-xs">{p.status === "published" ? "Published" : "Draft"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{weekLabel(p.weekStartDate)}</p>
                {p.theme && <p className="text-sm text-foreground mt-2">Theme: <span className="font-medium">{p.theme}</span></p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New plan dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>New Lesson Plan</DialogTitle>
            <DialogDescription>Pick a classroom and the week to plan.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Classroom</label>
              <Select value={npClassroom} onValueChange={setNpClassroom}>
                <SelectTrigger><SelectValue placeholder="Select classroom…" /></SelectTrigger>
                <SelectContent>
                  {(classrooms ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Week starting</label>
              <Input type="date" value={npWeek} onChange={(e) => setNpWeek(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Theme (optional)</label>
              <Input value={npTheme} onChange={(e) => setNpTheme(e.target.value)} placeholder="e.g. All About Me" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={submitNewPlan} disabled={createPlan.isPending}>
              {createPlan.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityDialog(props: {
  open: boolean; onOpenChange: (v: boolean) => void;
  day: string; setDay: (v: string) => void;
  title: string; setTitle: (v: string) => void;
  desc: string; setDesc: (v: string) => void;
  domain: string; setDomain: (v: string) => void;
  onSubmit: () => void; pending: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Add Activity</DialogTitle>
          <DialogDescription>Plan an activity and tag the domain it develops.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Day</label>
              <Select value={props.day} onValueChange={props.setDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Domain</label>
              <Select value={props.domain} onValueChange={props.setDomain}>
                <SelectTrigger><SelectValue placeholder="Optional…" /></SelectTrigger>
                <SelectContent>{DOMAINS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Title</label>
            <Input value={props.title} onChange={(e) => props.setTitle(e.target.value)} placeholder="e.g. Sensory bin exploration" />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Description</label>
            <Textarea value={props.desc} onChange={(e) => props.setDesc(e.target.value)} placeholder="What will children do?" className="min-h-[70px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>Cancel</Button>
          <Button onClick={props.onSubmit} disabled={props.pending}>
            {props.pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Add Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
