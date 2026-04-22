import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  LayoutGrid, Users, AlertCircle, Plus, MoreHorizontal,
  Clock, CheckCircle2, AlertTriangle, Zap, Search,
  ChevronRight, MessageSquare, Heart, FileText, User
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Mock data for classrooms and students
const mockClassrooms = [
  {
    id: 1,
    name: "Blue Room",
    ageGroup: "Toddlers (18-36 months)",
    capacity: 12,
    enrolled: 11,
    teacher: "Ms. Patricia Lee",
    color: "#3b82f6",
    students: [
      {
        id: 1,
        firstName: "Emma",
        lastName: "Johnson",
        dob: "2022-03-15",
        status: "present",
        notes: [
          { id: 1, title: "Severe Peanut Allergy", priority: "critical", category: "Allergy", isPinned: true },
          { id: 2, title: "Uses EpiPen", priority: "high", category: "Medical", isPinned: true },
        ],
      },
      {
        id: 2,
        firstName: "Marcus",
        lastName: "Rodriguez",
        dob: "2022-05-20",
        status: "present",
        notes: [
          { id: 3, title: "Speech Therapy 2x/week", priority: "high", category: "General", isPinned: true },
        ],
      },
      {
        id: 3,
        firstName: "Sophia",
        lastName: "Chen",
        dob: "2022-07-10",
        status: "absent",
        notes: [
          { id: 4, title: "Excused absence - Doctor appointment", priority: "medium", category: "General", isPinned: false },
        ],
      },
      {
        id: 4,
        firstName: "Liam",
        lastName: "O'Brien",
        dob: "2022-08-05",
        status: "present",
        notes: [],
      },
    ],
  },
  {
    id: 2,
    name: "Green Room",
    ageGroup: "Preschool (3-4 years)",
    capacity: 15,
    enrolled: 14,
    teacher: "Mr. David Wilson",
    color: "#10b981",
    students: [
      {
        id: 5,
        firstName: "Olivia",
        lastName: "Garcia",
        dob: "2021-02-14",
        status: "present",
        notes: [
          { id: 5, title: "IEP Meeting - March 15", priority: "high", category: "General", isPinned: true },
        ],
      },
      {
        id: 6,
        firstName: "Noah",
        lastName: "Williams",
        dob: "2021-04-22",
        status: "present",
        notes: [
          { id: 6, title: "Needs extra support with transitions", priority: "medium", category: "Behavior", isPinned: true },
        ],
      },
    ],
  },
];

export default function ClassroomDashboard() {
  const [selectedClassroom, setSelectedClassroom] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const getPriorityColor = (priority: string) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "absent":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

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
        <Button className="rounded-full gap-2 shadow-md hover:shadow-lg transition-all font-bold">
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
      <div className="space-y-6">
        {mockClassrooms.map((classroom) => (
          <div key={classroom.id} className="space-y-4">
            {/* Classroom Header Card */}
            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-2xl shadow-sm"
                      style={{ backgroundColor: classroom.color }}
                    />
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900">{classroom.name}</CardTitle>
                      <p className="text-sm text-slate-500 font-medium">{classroom.ageGroup}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{classroom.enrolled}</p>
                      <p className="text-xs font-bold uppercase text-slate-400 tracking-widest">of {classroom.capacity}</p>
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
                <div className="flex items-center gap-3 mt-4 text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <User className="h-4 w-4" /> {classroom.teacher}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {/* Students Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classroom.students.map((student) => {
                    const pinnedNotes = student.notes.filter(n => n.isPinned);
                    const hasNotes = student.notes.length > 0;

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
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Age {new Date().getFullYear() - new Date(student.dob).getFullYear()}</p>
                            </div>
                          </div>
                          {getStatusIcon(student.status)}
                        </div>

                        {/* Pinned Notes Section */}
                        {pinnedNotes.length > 0 && (
                          <div className="p-4 border-b border-slate-100 bg-gradient-to-b from-amber-50/50 to-transparent space-y-2">
                            {pinnedNotes.map((note) => (
                              <div key={note.id} className={`p-2.5 rounded-xl border ${getPriorityColor(note.priority)} flex items-start gap-2`}>
                                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-bold text-xs leading-tight">{note.title}</p>
                                  <p className="text-[10px] opacity-75 font-medium">{note.category}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Quick Actions */}
                        <div className="p-4 flex items-center gap-2 bg-slate-50/30">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 rounded-lg font-bold text-xs h-8 gap-1.5 hover:bg-primary/10 hover:text-primary transition-all"
                          >
                            <Heart className="h-3.5 w-3.5" /> Health
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 rounded-lg font-bold text-xs h-8 gap-1.5 hover:bg-primary/10 hover:text-primary transition-all"
                          >
                            <MessageSquare className="h-3.5 w-3.5" /> Note
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 rounded-lg font-bold text-xs h-8 gap-1.5 hover:bg-primary/10 hover:text-primary transition-all"
                          >
                            <FileText className="h-3.5 w-3.5" /> Profile
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Student Button */}
                  <button
                    onClick={() => toast.info("Add student feature coming soon")}
                    className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center min-h-[280px] group"
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
    </div>
  );
}
