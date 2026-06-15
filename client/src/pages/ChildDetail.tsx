import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Edit, Heart, Phone, Mail, MapPin,
  CheckCircle2, Users, Baby, ChevronRight, Plus,
  User, Calendar, Home, FileText, ShieldCheck, MessageSquare, Loader2, AlertCircle
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FlagChips } from "@/components/FlagChips";

interface ChildDetailProps { id: string; }

function formatDate(x: string | Date | null | undefined): string {
  if (!x) return "—";
  const d = new Date(x);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function formatAge(dob: string | Date | null | undefined): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) months = 0;
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

const capitalize = (s: string | null | undefined) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—";

const healthTypeLabel: Record<string, string> = {
  immunization: "Immunization", dental: "Dental", physical: "Physical",
  vision: "Vision", hearing: "Hearing", lead: "Lead Screening",
  hemoglobin: "Hemoglobin", other: "Other",
};

const healthRecordBadge = (status: string) => {
  if (status === "up_to_date") return <Badge className="bg-green-100 text-green-700 border-none rounded-full px-3 font-bold">Up to Date</Badge>;
  if (status === "due_soon") return <Badge className="bg-amber-100 text-amber-700 border-none rounded-full px-3 font-bold">Due Soon</Badge>;
  if (status === "overdue") return <Badge className="bg-red-100 text-red-700 border-none rounded-full px-3 font-bold">Overdue</Badge>;
  if (status === "exempt") return <Badge className="bg-slate-100 text-slate-600 border-none rounded-full px-3 font-bold">Exempt</Badge>;
  return <Badge className="bg-slate-100 text-slate-600 border-none rounded-full px-3 font-bold">Not Required</Badge>;
};

const childStatusBadge = (status: string | undefined) => {
  if (status === "active") return <Badge className="bg-green-100 text-green-700 border-green-200 rounded-full px-3 font-bold">Active</Badge>;
  if (status === "graduated") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 rounded-full px-3 font-bold">Graduated</Badge>;
  if (status === "withdrawn") return <Badge className="bg-red-100 text-red-700 border-red-200 rounded-full px-3 font-bold">Withdrawn</Badge>;
  return <Badge className="bg-slate-100 text-slate-600 border-slate-200 rounded-full px-3 font-bold">Inactive</Badge>;
};

export default function ChildDetail({ id }: ChildDetailProps) {
  const childId = Number(id);
  const utils = trpc.useUtils();

  const { data: child, isLoading: isChildLoading } = trpc.children.getById.useQuery(childId, {
    enabled: !isNaN(childId),
  });

  const { data: healthRecords, isLoading: isHealthLoading } = trpc.health.list.useQuery(
    { organizationId: ORGANIZATION_ID, childId },
    { enabled: !isNaN(childId) }
  );
  const { data: notes, isLoading: isNotesLoading } = trpc.notes.list.useQuery(
    { organizationId: ORGANIZATION_ID, childId },
    { enabled: !isNaN(childId) }
  );
  const { data: allFlags } = trpc.children.flags.useQuery(ORGANIZATION_ID);
  const childFlagList = (allFlags ?? []).filter((f: any) => f.childId === childId);
  const { data: documents, isLoading: isDocumentsLoading } = trpc.documents.list.useQuery(
    { organizationId: ORGANIZATION_ID, childId },
    { enabled: !isNaN(childId) }
  );
  const { data: educationRecords, isLoading: isEducationLoading } = trpc.education.list.useQuery(
    { organizationId: ORGANIZATION_ID, childId },
    { enabled: !isNaN(childId) }
  );
  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID);
  const { data: classroomMap } = trpc.children.classroomMap.useQuery(ORGANIZATION_ID);
  const { data: classrooms } = trpc.classrooms.list.useQuery(ORGANIZATION_ID);

  const familyId = child?.familyId ?? undefined;
  const { data: contacts } = trpc.families.contacts.useQuery(familyId as number, {
    enabled: typeof familyId === "number",
  });
  const { data: siblings, isLoading: isSiblingsLoading } = trpc.children.siblings.useQuery(
    familyId as number,
    { enabled: typeof familyId === "number" }
  );

  const attendanceRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    return { start, end };
  }, []);
  const { data: attendanceRecords } = trpc.attendance.getRange.useQuery({
    organizationId: ORGANIZATION_ID,
    start: attendanceRange.start,
    end: attendanceRange.end,
  });

  // Mutations
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [notePriority, setNotePriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate({ organizationId: ORGANIZATION_ID, childId });
      toast.success("Note added");
      setShowNoteDialog(false);
      setNoteTitle("");
      setNoteContent("");
      setNotePriority("medium");
    },
    onError: (err) => toast.error(err.message || "Failed to add note"),
  });

  const [showAssessmentDialog, setShowAssessmentDialog] = useState(false);
  const [assessTitle, setAssessTitle] = useState("");
  const [assessType, setAssessType] = useState<"assessment" | "parent_conference" | "home_visit" | "individual_plan">("assessment");
  const [assessDate, setAssessDate] = useState("");
  const [assessScore, setAssessScore] = useState("");
  const [assessDescription, setAssessDescription] = useState("");
  const createEducation = trpc.education.create.useMutation({
    onSuccess: () => {
      utils.education.list.invalidate({ organizationId: ORGANIZATION_ID, childId });
      toast.success("Assessment added");
      setShowAssessmentDialog(false);
      setAssessTitle("");
      setAssessDate("");
      setAssessScore("");
      setAssessDescription("");
    },
    onError: (err) => toast.error(err.message || "Failed to add assessment"),
  });

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editStatus, setEditStatus] = useState<"active" | "inactive" | "graduated" | "withdrawn">("active");
  const [editNotes, setEditNotes] = useState("");
  const updateChild = trpc.children.update.useMutation({
    onSuccess: () => {
      utils.children.getById.invalidate(childId);
      utils.children.list.invalidate(ORGANIZATION_ID);
      toast.success("Profile updated");
      setShowEditDialog(false);
    },
    onError: (err) => toast.error(err.message || "Failed to update profile"),
  });

  // Derived data
  const family = useMemo(
    () => (families ?? []).find((f: any) => f.id === child?.familyId),
    [families, child]
  );
  const classroomEntry = useMemo(
    () => (classroomMap ?? []).find((row: any) => row.childId === childId),
    [classroomMap, childId]
  );
  const classroom = useMemo(
    () => (classrooms ?? []).find((c: any) => c.id === classroomEntry?.classroomId),
    [classrooms, classroomEntry]
  );

  const attendance = useMemo(() => {
    const mine = (attendanceRecords ?? []).filter((r: any) => r.childId === childId);
    const present = mine.filter((r: any) => r.status === "present").length;
    const halfDays = mine.filter((r: any) => r.status === "half_day").length;
    const absent = mine.filter((r: any) => r.status === "absent").length;
    const excused = mine.filter((r: any) => r.status === "excused").length;
    const total = mine.length;
    const rate = total > 0 ? Math.round(((present + halfDays * 0.5) / total) * 100) : null;
    return { present: present + halfDays, absent, excused, total, rate };
  }, [attendanceRecords, childId]);

  const overallHealthStatus = useMemo(() => {
    const records = healthRecords ?? [];
    if (records.some((r: any) => r.status === "overdue")) return { label: "Overdue", color: "text-red-600" };
    if (records.some((r: any) => r.status === "due_soon")) return { label: "Due Soon", color: "text-amber-600" };
    return { label: "Current", color: "text-green-600" };
  }, [healthRecords]);

  const allergyNotes = useMemo(
    () => (notes ?? []).filter((n: any) => (n.category ?? "").toLowerCase() === "allergy"),
    [notes]
  );

  if (isChildLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh] bg-[#FBF6EE]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!child) {
    return (
      <div className="p-6 bg-[#FBF6EE] min-h-full">
        <div className="text-center py-20">
          <Baby className="h-14 w-14 mx-auto mb-4 text-slate-300" />
          <h2 className="text-xl font-bold text-slate-800">Child not found</h2>
          <p className="text-sm text-slate-500 mt-1">This record may have been removed.</p>
          <Link href="/children">
            <Button variant="outline" className="mt-6 gap-2 rounded-full font-bold">
              <ArrowLeft className="h-4 w-4" /> Back to Children
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const initials = `${child.firstName?.[0] ?? ""}${child.lastName?.[0] ?? ""}`;
  const age = formatAge(child.dateOfBirth);
  const classroomName = classroomEntry?.classroomName ?? "Unassigned";
  const teacherName = classroom?.teacherName ?? "—";

  const sortedNotes = [...(notes ?? [])].sort((a: any, b: any) => {
    if ((b.isPinned ?? 0) !== (a.isPinned ?? 0)) return (b.isPinned ?? 0) - (a.isPinned ?? 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="p-6 space-y-6 bg-[#FBF6EE] min-h-full">
      <div className="flex items-center gap-4">
        <Link href="/children">
          <Button variant="ghost" size="sm" className="gap-2 rounded-full font-bold">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-14 w-14 rounded-2xl border-2 border-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{child.firstName} {child.lastName}</h1>
            <div className="flex items-center gap-2 mt-1">
              {childStatusBadge(child.status)}
              <span className="text-sm text-slate-500 font-medium">{age} &bull; {classroomName} &bull; {teacherName}</span>
            </div>
            {childFlagList.length > 0 && (
              <div className="mt-2"><FlagChips flags={childFlagList} /></div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          className="gap-2 rounded-full font-bold shadow-md"
          onClick={() => {
            setEditStatus((child.status as any) ?? "active");
            setEditNotes(child.notes ?? "");
            setShowEditDialog(true);
          }}
        >
          <Edit className="h-4 w-4" /> Edit Profile
        </Button>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>General Notes</Label>
              <Textarea
                placeholder="Notes about this child..."
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button
                disabled={updateChild.isPending}
                onClick={() => updateChild.mutate({ id: childId, status: editStatus, notes: editNotes })}
              >
                {updateChild.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="Note title" value={noteTitle} onChange={e => setNoteTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea placeholder="Observation or note details..." value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={notePriority} onValueChange={(v) => setNotePriority(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
              <Button
                disabled={createNote.isPending || !noteTitle.trim() || !noteContent.trim()}
                onClick={() => createNote.mutate({
                  organizationId: ORGANIZATION_ID,
                  childId,
                  title: noteTitle.trim(),
                  content: noteContent.trim(),
                  priority: notePriority,
                })}
              >
                {createNote.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Assessment Dialog */}
      <Dialog open={showAssessmentDialog} onOpenChange={setShowAssessmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="e.g. ASQ-3 Communication" value={assessTitle} onChange={e => setAssessTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={assessType} onValueChange={(v) => setAssessType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assessment">Assessment</SelectItem>
                    <SelectItem value="parent_conference">Parent Conference</SelectItem>
                    <SelectItem value="home_visit">Home Visit</SelectItem>
                    <SelectItem value="individual_plan">Individual Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={assessDate} onChange={e => setAssessDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Score (optional)</Label>
                <Input placeholder="e.g. 50" value={assessScore} onChange={e => setAssessScore(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea placeholder="Details..." value={assessDescription} onChange={e => setAssessDescription(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAssessmentDialog(false)}>Cancel</Button>
              <Button
                disabled={createEducation.isPending || !assessTitle.trim() || !assessDate}
                onClick={() => createEducation.mutate({
                  organizationId: ORGANIZATION_ID,
                  childId,
                  type: assessType,
                  title: assessTitle.trim(),
                  description: assessDescription.trim() || undefined,
                  assessmentDate: new Date(assessDate),
                  score: assessScore.trim() || undefined,
                })}
              >
                {createEducation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Assessment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Attendance Rate", value: attendance.rate !== null ? `${attendance.rate}%` : "—", color: "text-green-600" },
              { label: "Days Present", value: attendance.present, color: "text-slate-700" },
              { label: "Health Status", value: overallHealthStatus.label, color: overallHealthStatus.color },
              { label: "Enrolled Since", value: formatDate(child.enrollmentDate), color: "text-slate-700" },
            ].map(stat => (
              <Card key={stat.label} className="rounded-2xl border-slate-200 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{stat.label}</p>
                  <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="bg-white border border-slate-200 p-1 rounded-2xl w-fit shadow-sm mb-6">
              <TabsTrigger value="profile" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Profile</TabsTrigger>
              <TabsTrigger value="health" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Health</TabsTrigger>
              <TabsTrigger value="attendance" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Attendance</TabsTrigger>
              <TabsTrigger value="assessments" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Assessments</TabsTrigger>
              <TabsTrigger value="documents" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Documents</TabsTrigger>
              <TabsTrigger value="family" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Family</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> Child Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3 text-sm">
                    {[
                      ["Date of Birth", formatDate(child.dateOfBirth)],
                      ["Age", age],
                      ["Gender", capitalize(child.gender)],
                      ["Status", capitalize(child.status)],
                      ["Family Contact", family?.primaryContactName ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">{label as string}</span>
                        <span className="font-bold text-slate-700">{value as string}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Enrollment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3 text-sm">
                    {[
                      ["Enrollment Date", formatDate(child.enrollmentDate)],
                      ["Classroom", classroomName],
                      ["Teacher", teacherName],
                      ["Status", capitalize(child.status)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">{label}</span>
                        <span className="font-bold text-slate-700">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" /> Notes and Observations
                    </CardTitle>
                    <Button size="sm" variant="outline" className="rounded-full font-bold gap-1 text-xs" onClick={() => setShowNoteDialog(true)}>
                      <Plus className="h-3.5 w-3.5" /> Add Note
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {isNotesLoading ? (
                    <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : sortedNotes.length === 0 ? (
                    <p className="text-sm text-slate-400 font-medium text-center py-6">No notes yet. Add the first observation.</p>
                  ) : (
                    sortedNotes.map((note: any) => (
                      <div key={note.id} className="border-l-4 border-primary/20 pl-4 py-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">{note.title}</span>
                          <span className="text-[10px] font-bold text-slate-400">{formatDate(note.createdAt)}</span>
                          {note.priority && ["high", "critical"].includes(note.priority) && (
                            <Badge className={cn(
                              "rounded-full px-2 text-[10px] font-bold border-none",
                              note.priority === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {capitalize(note.priority)}
                            </Badge>
                          )}
                          {Boolean(note.isPinned) && (
                            <Badge className="rounded-full px-2 text-[10px] font-bold border-none bg-primary/10 text-primary">Pinned</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{note.content}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" /> Health Records
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-sm">
                    {isHealthLoading ? (
                      <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                    ) : (healthRecords ?? []).length === 0 ? (
                      <p className="text-sm text-slate-400 font-medium text-center py-6">No health records on file.</p>
                    ) : (
                      (healthRecords ?? []).map((rec: any) => (
                        <div key={rec.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <div>
                            <p className="font-bold text-slate-700">{healthTypeLabel[rec.type] ?? capitalize(rec.type)}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                              {formatDate(rec.recordDate)}
                              {rec.expiryDate ? ` • Expires: ${formatDate(rec.expiryDate)}` : ""}
                              {rec.provider ? ` • ${rec.provider}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {healthRecordBadge(rec.status)}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Medical Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-sm">
                    <div className="flex justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider self-center">Overall Status</span>
                      <span className={cn("font-bold", overallHealthStatus.color)}>{overallHealthStatus.label}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Allergies
                      </span>
                      {allergyNotes.length === 0 ? (
                        <p className="font-bold text-slate-700">None known</p>
                      ) : (
                        allergyNotes.map((n: any) => (
                          <div key={n.id}>
                            <p className="font-bold text-slate-700">{n.title}</p>
                            <p className="text-xs text-slate-500 font-medium">{n.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">General Notes</span>
                      <p className="font-bold text-slate-700">{child.notes || "None"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="attendance" className="mt-0">
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Attendance Summary (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="text-center p-4 rounded-2xl bg-green-50 border border-green-100">
                      <p className="text-3xl font-bold text-green-600">{attendance.present}</p>
                      <p className="text-[10px] font-bold uppercase text-green-700/60 tracking-widest mt-1">Days Present</p>
                    </div>
                    <div className="text-center p-4 rounded-2xl bg-red-50 border border-red-100">
                      <p className="text-3xl font-bold text-red-500">{attendance.absent}</p>
                      <p className="text-[10px] font-bold uppercase text-red-700/60 tracking-widest mt-1">Days Absent</p>
                    </div>
                    <div className="text-center p-4 rounded-2xl bg-amber-50 border border-amber-100">
                      <p className="text-3xl font-bold text-amber-500">{attendance.excused}</p>
                      <p className="text-[10px] font-bold uppercase text-amber-700/60 tracking-widest mt-1">Excused</p>
                    </div>
                  </div>
                  {attendance.rate !== null ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Overall Attendance Rate</span>
                        <span className="font-bold text-primary">{attendance.rate}%</span>
                      </div>
                      <Progress value={attendance.rate} className="h-3 rounded-full" />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 font-medium text-center">No attendance recorded in the last 30 days.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assessments" className="mt-0">
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" /> Developmental Records
                    </CardTitle>
                    <Button size="sm" variant="outline" className="rounded-full font-bold gap-1 text-xs" onClick={() => setShowAssessmentDialog(true)}>
                      <Plus className="h-3.5 w-3.5" /> New Assessment
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {isEducationLoading ? (
                    <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : (educationRecords ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 font-medium text-center py-6">No assessments recorded yet.</p>
                  ) : (
                    (educationRecords ?? []).map((a: any) => {
                      const numericScore = a.score != null ? parseFloat(String(a.score)) : NaN;
                      return (
                        <div key={a.id} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-sm font-bold text-slate-700">{a.title}</span>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                {capitalize(a.type)} • {formatDate(a.assessmentDate)}
                              </p>
                              {a.description && <p className="text-xs text-slate-500 font-medium mt-0.5">{a.description}</p>}
                            </div>
                            {a.score != null && a.score !== "" && (
                              <span className="text-sm font-bold text-slate-800 text-right">{a.score}</span>
                            )}
                          </div>
                          {!isNaN(numericScore) && (
                            <Progress value={Math.min(Math.max(numericScore, 0), 100)} className="h-2 rounded-full" />
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {isDocumentsLoading ? (
                    <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : (documents ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 font-medium text-center py-6">No documents on file.</p>
                  ) : (
                    (documents ?? []).map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-700 truncate">{doc.fileName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                              {capitalize(doc.documentType)} • Uploaded {formatDate(doc.uploadedAt)}
                              {doc.expiryDate ? ` • Expires ${formatDate(doc.expiryDate)}` : ""}
                            </p>
                          </div>
                        </div>
                        {doc.fileUrl && (
                          <Button asChild variant="ghost" size="sm" className="rounded-full font-bold text-xs flex-shrink-0">
                            <a href={doc.fileUrl} target="_blank" rel="noreferrer">View</a>
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="family" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Home className="h-4 w-4 text-primary" /> Primary Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-sm">
                    {!family ? (
                      <p className="text-sm text-slate-400 font-medium text-center py-6">No family linked to this child.</p>
                    ) : (
                      <>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="font-bold text-lg text-slate-800">{family.primaryContactName}</div>
                          <div className="text-xs font-bold text-primary uppercase tracking-widest mt-0.5">Primary Contact</div>
                        </div>
                        <div className="space-y-3 px-2">
                          <div className="flex items-center gap-3 font-bold text-slate-600">
                            <Phone className="h-4 w-4 text-slate-400" /> {family.primaryContactPhone || "—"}
                          </div>
                          <div className="flex items-center gap-3 font-bold text-slate-600">
                            <Mail className="h-4 w-4 text-slate-400" /> {family.primaryContactEmail || "—"}
                          </div>
                          <div className="flex items-start gap-3 font-bold text-slate-600">
                            <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                            {[family.address, family.city, family.state, family.zipCode].filter(Boolean).join(", ") || "—"}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Authorized Contacts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3 text-sm">
                    {(contacts ?? []).length === 0 ? (
                      <p className="text-sm text-slate-400 font-medium text-center py-6">No additional contacts on file.</p>
                    ) : (
                      (contacts ?? []).map((contact: any) => (
                        <div key={contact.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700">{contact.contactName}</span>
                            {Boolean(contact.isPrimary) && (
                              <Badge className="rounded-full px-2 text-[10px] font-bold border-none bg-primary/10 text-primary">Primary</Badge>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{contact.relationship || "Contact"}</p>
                          <div className="mt-2 space-y-1 text-xs font-bold text-slate-600">
                            {contact.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-slate-400" /> {contact.phone}</div>}
                            {contact.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-slate-400" /> {contact.email}</div>}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar: Sibling Grouping */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-primary/20 shadow-md overflow-hidden bg-primary/5">
            <CardHeader className="border-b border-primary/10 bg-primary/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                  <Users className="h-5 w-5" /> Sibling Group
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-primary hover:bg-primary/20">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-primary/70 font-bold text-[11px] uppercase tracking-tight">Linked to this family</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {isSiblingsLoading ? (
                <div className="py-4 text-center text-sm text-slate-400 font-bold">Loading siblings...</div>
              ) : siblings && siblings.filter((s: any) => s.id !== childId).length > 0 ? (
                siblings.filter((s: any) => s.id !== childId).map((sibling: any) => (
                  <Link key={sibling.id} href={`/children/${sibling.id}`}>
                    <a className="flex items-center justify-between p-3 rounded-2xl bg-white border border-primary/10 hover:border-primary/30 hover:shadow-sm transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {sibling.firstName?.[0] ?? "?"}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 group-hover:text-primary transition-colors">{sibling.firstName} {sibling.lastName}</p>
                          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tighter">
                            {sibling.status} • {sibling.gender ?? "—"}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                    </a>
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Users className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500 font-bold">No siblings linked</p>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">Add a sibling to share family data</p>
                  <Button variant="outline" size="sm" className="mt-4 rounded-full font-bold text-xs border-slate-200 hover:bg-primary hover:text-white hover:border-primary transition-all">
                    Link Sibling
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
              <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-widest">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Button variant="ghost" className="w-full justify-start rounded-xl font-bold text-slate-600 hover:text-primary hover:bg-primary/5" onClick={() => setShowNoteDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Note
              </Button>
              <Link href="/attendance">
                <Button variant="ghost" className="w-full justify-start rounded-xl font-bold text-slate-600 hover:text-primary hover:bg-primary/5">
                  <Plus className="h-4 w-4 mr-2" /> Log Attendance
                </Button>
              </Link>
              <Button variant="ghost" className="w-full justify-start rounded-xl font-bold text-slate-600 hover:text-primary hover:bg-primary/5" onClick={() => setShowAssessmentDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> New Assessment
              </Button>
              <Button variant="ghost" className="w-full justify-start rounded-xl font-bold text-slate-600 hover:text-primary hover:bg-primary/5" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" /> Print Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BarChart3(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  )
}

function Printer(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  )
}
