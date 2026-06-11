import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LayoutGrid, AlertCircle, Plus, MoreHorizontal,
  Clock, CheckCircle2, AlertTriangle, Search,
  MessageSquare, Heart, FileText, User, Loader2,
  ArrowRightLeft, UserMinus, GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";

export default function ClassroomDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOverTarget, setDragOverTarget] = useState<number | "unassigned" | null>(null);

  // Stable "today" so the attendance query key doesn't churn between renders.
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const utils = trpc.useUtils();
  const { data: classrooms, isLoading: classroomsLoading } = trpc.classrooms.list.useQuery(ORGANIZATION_ID);
  const { data: children, isLoading: childrenLoading } = trpc.children.list.useQuery(ORGANIZATION_ID);
  const { data: classroomMap } = trpc.children.classroomMap.useQuery(ORGANIZATION_ID);
  const { data: todayAttendance } = trpc.attendance.getByDate.useQuery({
    organizationId: ORGANIZATION_ID,
    date: today,
  });
  const { data: notes } = trpc.notes.list.useQuery({ organizationId: ORGANIZATION_ID });

  const assignChild = trpc.classrooms.assignChild.useMutation({
    onSuccess: () => {
      utils.children.classroomMap.invalidate(ORGANIZATION_ID);
      utils.classrooms.list.invalidate(ORGANIZATION_ID);
    },
    onError: (err) => toast.error(`Couldn't move student: ${err.message}`),
  });

  const isLoading = classroomsLoading || childrenLoading;

  // childId -> today's attendance status
  const attendanceByChild = useMemo(() => {
    const m = new Map<number, string>();
    for (const row of todayAttendance ?? []) m.set(row.childId, row.status ?? "unknown");
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

  const matchesSearch = (s: { firstName: string; lastName: string }) => {
    const q = searchQuery.trim().toLowerCase();
    return !q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q);
  };

  // Children with no active room assignment — the ones needing action.
  const unassignedStudents = useMemo(() => {
    const assigned = new Set((classroomMap ?? []).map((m) => m.childId));
    return (children ?? []).filter((c) => !assigned.has(c.id) && matchesSearch(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, classroomMap, searchQuery]);

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
    return (classrooms ?? []).map((room) => ({
      ...room,
      students: (rosterByClassroom.get(room.id) ?? []).filter(matchesSearch),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classrooms, children, classroomMap, searchQuery]);

  const roomById = useMemo(
    () => new Map((classrooms ?? []).map((r) => [r.id, r])),
    [classrooms]
  );

  const currentRoomOf = (childId: number) =>
    (classroomMap ?? []).find((m) => m.childId === childId)?.classroomId ?? null;

  /** Move a child; toClassroomId null = unassign. Guards capacity. */
  const moveStudent = (childId: number, toClassroomId: number | null, childName: string) => {
    if (currentRoomOf(childId) === toClassroomId) return;
    if (toClassroomId != null) {
      const room = roomById.get(toClassroomId);
      if (room && room.capacity != null && room.enrolledCount >= room.capacity) {
        toast.error(`${room.name} is at capacity (${room.capacity}).`);
        return;
      }
    }
    assignChild.mutate(
      { childId, classroomId: toClassroomId },
      {
        onSuccess: () => {
          const dest = toClassroomId != null ? roomById.get(toClassroomId)?.name : null;
          toast.success(dest ? `${childName} moved to ${dest}` : `${childName} unassigned`);
        },
      }
    );
  };

  // --- Drag and drop (native HTML5; student cards are the draggables) ---
  const onDragStartStudent = (e: React.DragEvent, childId: number, name: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ childId, name }));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDropInto = (target: number | "unassigned") => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget(null);
    try {
      const { childId, name } = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveStudent(childId, target === "unassigned" ? null : target, name);
    } catch {
      /* not a student drag */
    }
  };
  const dragOverProps = (target: number | "unassigned") => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget(target);
    },
    onDragLeave: () => setDragOverTarget((t) => (t === target ? null : t)),
    onDrop: onDropInto(target),
  });

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

  /** The move menu shared by every student card (keyboard/no-drag fallback). */
  const MoveMenu = ({ childId, name, currentRoomId }: { childId: number; name: string; currentRoomId: number | null }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-slate-400 hover:text-slate-600">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-slate-400">Move to room</DropdownMenuLabel>
        {(classrooms ?? [])
          .filter((r) => r.id !== currentRoomId)
          .map((r) => {
            const full = r.capacity != null && r.enrolledCount >= r.capacity;
            return (
              <DropdownMenuItem
                key={r.id}
                disabled={full}
                className="rounded-lg font-bold gap-2"
                onClick={() => moveStudent(childId, r.id, name)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                {r.name} ({r.enrolledCount}/{r.capacity ?? "—"}){full ? " · full" : ""}
              </DropdownMenuItem>
            );
          })}
        {currentRoomId != null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="rounded-lg font-bold text-red-600 gap-2"
              onClick={() => moveStudent(childId, null, name)}
            >
              <UserMinus className="h-3.5 w-3.5" /> Remove from room
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const StudentCard = ({ student, currentRoomId }: { student: NonNullable<typeof children>[number]; currentRoomId: number | null }) => {
    const studentNotes = notesByChild.get(student.id) ?? [];
    const pinnedNotes = studentNotes.filter((n) => n.isPinned === 1);
    const attendanceStatus = attendanceByChild.get(student.id);
    const age = getAge(student.dateOfBirth);
    const name = `${student.firstName} ${student.lastName}`;

    return (
      <div
        draggable
        onDragStart={(e) => onDragStartStudent(e, student.id, name)}
        className="rounded-2xl border border-slate-200 bg-white hover:shadow-md hover:border-primary/30 transition-all overflow-hidden group cursor-grab active:cursor-grabbing"
      >
        {/* Student Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="h-4 w-4 text-slate-300 flex-shrink-0" />
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
              {student.firstName[0]}{student.lastName[0]}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 truncate">{name}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {age != null ? `Age ${age}` : "Age unknown"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {getStatusIcon(attendanceStatus)}
            <MoveMenu childId={student.id} name={name} currentRoomId={currentRoomId} />
          </div>
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
            <p className="text-sm text-slate-500 font-medium">
              Drag students between rooms, or use a card's menu to move them
            </p>
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

      {/* Unassigned students — first because they need action. Also a drop
          target for removing a child from their room. */}
      {(unassignedStudents.length > 0 || dragOverTarget != null) && (
        <Card
          {...dragOverProps("unassigned")}
          className={`rounded-3xl border-2 border-dashed shadow-sm transition-all ${
            dragOverTarget === "unassigned"
              ? "border-amber-400 bg-amber-50"
              : unassignedStudents.length > 0
                ? "border-amber-300 bg-amber-50/40"
                : "border-slate-200"
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-amber-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Needs Room Assignment ({unassignedStudents.length})
              <span className="text-xs font-medium text-amber-600/70 ml-2">
                drop a student here to unassign them
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {unassignedStudents.length === 0 ? (
              <p className="text-sm text-slate-400 font-medium py-2">Every student has a room. 🎉</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unassignedStudents.map((student) => (
                  <StudentCard key={student.id} student={student} currentRoomId={null} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Classrooms */}
      {classroomCards.length === 0 ? (
        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardContent className="p-12 text-center text-slate-400 font-medium">
            No classrooms found for this organization.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {classroomCards.map((classroom) => {
            const capacity = classroom.capacity ?? 0;
            const fillRatio = capacity > 0 ? classroom.enrolledCount / capacity : 0;
            const isFull = capacity > 0 && classroom.enrolledCount >= capacity;
            const barColor = isFull ? "bg-red-500" : fillRatio >= 0.85 ? "bg-amber-500" : "bg-emerald-500";

            return (
              <div key={classroom.id} className="space-y-4">
                <Card
                  {...dragOverProps(classroom.id)}
                  className={`rounded-3xl shadow-sm overflow-hidden transition-all ${
                    dragOverTarget === classroom.id
                      ? isFull
                        ? "border-2 border-red-400 bg-red-50/40"
                        : "border-2 border-primary bg-primary/5"
                      : "border border-slate-200"
                  }`}
                >
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
                      <div className="text-right min-w-[140px]">
                        <p className="text-sm font-bold text-slate-700">
                          {classroom.enrolledCount}
                          <span className="text-slate-400"> / {capacity || "—"}</span>
                          {isFull && <span className="ml-2 text-xs font-bold text-red-500 uppercase">Full</span>}
                        </p>
                        <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${Math.min(100, Math.round(fillRatio * 100))}%` }}
                          />
                        </div>
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
                      {classroom.students.map((student) => (
                        <StudentCard key={student.id} student={student} currentRoomId={classroom.id} />
                      ))}

                      {/* Drop hint / empty room state */}
                      {classroom.students.length === 0 && searchQuery.trim() === "" && (
                        <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 text-center text-sm text-slate-400 font-medium py-8">
                          No students yet — drag one here or use a student card's menu.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
