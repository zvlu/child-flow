import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LayoutGrid, AlertCircle, Plus, MoreHorizontal,
  Clock, CheckCircle2, AlertTriangle, Search,
  MessageSquare, Heart, FileText, User, Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";

export default function ClassroomDashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  // Stable "today" so the attendance query key doesn't churn between renders.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { data: classrooms, isLoading: classroomsLoading } = trpc.classrooms.list.useQuery(ORGANIZATION_ID);
  const { data: children, isLoading: childrenLoading } = trpc.children.list.useQuery(ORGANIZATION_ID);
  const { data: classroomMap } = trpc.children.classroomMap.useQuery(ORGANIZATION_ID);
  const { data: todayAttendance } = trpc.attendance.getByDate.useQuery({
    organizationId: ORGANIZATION_ID,
    date: today,
  });
  const { data: notes } = trpc.notes.list.useQuery({ organizationId: ORGANIZATION_ID });

  const isLoading = classroomsLoading || childrenLoading;

  // childId -> today's attendance status
  const attendanceByChild = useMemo(() => {
    const m = new Map<number, string>();
    for (const row of todayAttendance ?? []) m.set(row.childId, row.status);
    return m;
  }, [todayAttendance]);

  // childId -> notes
  const notesByChild = useMemo(() => {
    const m = new Map<number, NonNullable<typeof notes>>();
    for (const note of notes ?? []) {
      if (!m.has(note.childId)) m.set(note.childId, []);
      m.get(note.childId)!.push(note);
    }
    return m;
  }, [notes]);

  // Assemble classroom cards with their rosters from children + classroomMap.
  const classroomCards = useMemo(() => {
    const childById = new Map((children ?? []).map((c) => [c.id, c]));
    const rosterByClassroom = new Map<number, NonNullable<typeof children>>();
    for (const entry of classroomMap ?? []) {
      const child = childById.get(entry.childId);
      if (!child) continue;
      if (!rosterByClassroom.has(entry.classroomId)) rosterByClassroom.set(entry.classroomId, []);
      rosterByClassroom.get(entry.classroomId)!.push(child);
    }
    const q = searchQuery.trim().toLowerCase();
    return (classrooms ?? []).map((room) => {
      let students = rosterByClassroom.get(room.id) ?? [];
      if (q) {
        students = students.filter((s) =>
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
        );
      }
      return { ...room, students };
    });
  }, [classrooms, children, classroomMap, searchQuery]);

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-700 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case "present":
      case "half_day":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "absent":
      case "excused":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  const getAge = (dob: Date | string | null) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px] bg-[#f8fafc]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc] min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <LayoutGrid className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Classrooms</h1>
            <p className="text-sm text-slate-500 font-medium">Manage your assigned classrooms and student caseload</p>
          </div>
        </div>
        <Button
          className="rounded-full gap-2 shadow-md hover:shadow-lg transition-all font-bold"
          onClick={() => toast.info("New classroom feature coming soon")}
        >
          <Plus className="h-4 w-4" /> New Classroom
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search students by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-2xl border-slate-200 focus:border-primary focus:ring-primary"
        />
      </div>

      {/* Classrooms Grid */}
      {classroomCards.length === 0 ? (
        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardContent className="p-12 text-center text-slate-400 font-medium">
            No classrooms found for this organization.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {classroomCards.map((classroom) => (
            <div key={classroom.id} className="space-y-4">
              {/* Classroom Header Card */}
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="h-12 w-12 rounded-2xl shadow-sm"
                        style={{ backgroundColor: classroom.color ?? "#3b82f6" }}
                      />
                      <div>
                        <CardTitle className="text-xl font-bold text-slate-900">{classroom.name}</CardTitle>
                        <p className="text-sm text-slate-500 font-medium">{classroom.ageGroup ?? "All ages"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{classroom.enrolledCount}</p>
                        <p className="text-xs font-bold uppercase text-slate-400 tracking-widest">of {classroom.capacity ?? "—"}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-slate-400 hover:text-slate-600">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl">
                          <DropdownMenuItem className="rounded-lg font-bold">Edit Classroom</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg font-bold">View Reports</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="rounded-lg font-bold text-red-600">Archive</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {classroom.teacherName && (
                    <div className="flex items-center gap-3 mt-4 text-sm">
                      <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                        <User className="h-4 w-4" /> {classroom.teacherName}
                      </div>
                      {classroom.assistantName && (
                        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
                          <User className="h-4 w-4" /> {classroom.assistantName}
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-6">
                  {/* Students Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {classroom.students.length === 0 && searchQuery.trim() !== "" && (
                      <div className="col-span-full text-center text-sm text-slate-400 font-medium py-4">
                        No students match "{searchQuery}" in this classroom.
                      </div>
                    )}
                    {classroom.students.map((student) => {
                      const studentNotes = notesByChild.get(student.id) ?? [];
                      const pinnedNotes = studentNotes.filter((n) => n.isPinned === 1);
                      const attendanceStatus = attendanceByChild.get(student.id);
                      const age = getAge(student.dateOfBirth);

                      return (
                        <div
                          key={student.id}
                          className="rounded-2xl border border-slate-200 bg-white hover:shadow-md hover:border-primary/30 transition-all overflow-hidden group"
                        >
                          {/* Student Header */}
                          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {student.firstName[0]}{student.lastName[0]}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{student.firstName} {student.lastName}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                  {age != null ? `Age ${age}` : "Age unknown"}
                                </p>
                              </div>
                            </div>
                            {getStatusIcon(attendanceStatus)}
                          </div>

                          {/* Pinned Notes Section */}
                          {pinnedNotes.length > 0 && (
                            <div className="p-4 border-b border-slate-100 bg-gradient-to-b from-amber-50/50 to-transparent space-y-2">
                              {pinnedNotes.map((note) => (
                                <div key={note.id} className={`p-2.5 rounded-xl border ${getPriorityColor(note.priority)} flex items-start gap-2`}>
                                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs leading-tight">{note.title}</p>
                                    <p className="text-[10px] opacity-75 font-medium">{note.category ?? "General"}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Quick Actions */}
                          <div className="p-4 flex items-center gap-2 bg-slate-50/30">
                            <Link href="/health">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 rounded-lg font-bold text-xs h-8 gap-1.5 hover:bg-primary/10 hover:text-primary transition-all"
                              >
                                <Heart className="h-3.5 w-3.5" /> Health
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 rounded-lg font-bold text-xs h-8 gap-1.5 hover:bg-primary/10 hover:text-primary transition-all"
                              onClick={() => toast.info("Quick notes coming soon")}
                            >
                              <MessageSquare className="h-3.5 w-3.5" /> Note
                            </Button>
                            <Link href={`/children/${student.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 rounded-lg font-bold text-xs h-8 gap-1.5 hover:bg-primary/10 hover:text-primary transition-all"
                              >
                                <FileText className="h-3.5 w-3.5" /> Profile
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add Student Button */}
                    <button
                      onClick={() => toast.info("Add student feature coming soon")}
                      className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center min-h-[180px] group"
                    >
                      <div className="text-center">
                        <div className="h-12 w-12 rounded-xl bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center mx-auto mb-2 transition-all">
                          <Plus className="h-6 w-6 text-slate-400 group-hover:text-primary transition-all" />
                        </div>
                        <p className="font-bold text-slate-600 group-hover:text-primary transition-all">Add Student</p>
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
