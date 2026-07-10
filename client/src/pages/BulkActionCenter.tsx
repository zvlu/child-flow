import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  Users,
  Zap,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

const ACTION_LABELS: Record<string, string> = {
  bulk_attendance: "Bulk Attendance",
  bulk_health_screening: "Bulk Health Screening",
  bulk_notes: "Bulk Notes",
  bulk_enrollment: "Bulk Enrollment",
};

const ATTENDANCE_STATUSES = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
  { value: "half_day", label: "Half Day" },
];

export function BulkActionCenter() {
  const utils = trpc.useUtils();
  const { data: logs = [], isLoading } = trpc.bulkActions.logs.useQuery(ORGANIZATION_ID);
  const { data: classrooms = [] } = trpc.classrooms.list.useQuery(ORGANIZATION_ID);

  const [showModal, setShowModal] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("present");

  const bulkAttendance = trpc.bulkActions.bulkAttendance.useMutation({
    onSuccess: (data) => {
      const label = ATTENDANCE_STATUSES.find((s) => s.value === attendanceStatus)?.label ?? attendanceStatus;
      toast.success(`Marked ${data.affected} ${data.affected === 1 ? "child" : "children"} ${label}.`);
      utils.bulkActions.logs.invalidate();
      setShowModal(false);
      setSelectedClassroom("");
    },
    onError: (e) => toast.error(e.message || "Bulk action failed"),
  });

  // Only Bulk Attendance is wired to a backend mutation today; the rest are
  // surfaced honestly as "coming soon" rather than faking a result.
  const actionTypes = [
    { id: "attendance", label: "Bulk Attendance", icon: CheckCircle2, color: "bg-blue-100 text-blue-600", ready: true },
    { id: "health", label: "Bulk Health Screening", icon: AlertCircle, color: "bg-green-100 text-green-600", ready: false },
    { id: "notes", label: "Bulk Notes", icon: Users, color: "bg-purple-100 text-purple-600", ready: false },
    { id: "enrollment", label: "Bulk Enrollment", icon: Zap, color: "bg-orange-100 text-orange-600", ready: false },
  ];

  const totalProcessed = logs.reduce((sum, a) => sum + (a.recordCount ?? 0), 0);
  const completedCount = logs.filter((a) => a.status === "completed").length;

  const getStatusBadge = (status: string | null) => {
    if (status === "completed") {
      return (
        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />Completed
        </span>
      );
    }
    if (status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
          <Clock className="w-4 h-4" />Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
        <AlertCircle className="w-4 h-4" />Failed
      </span>
    );
  };

  const openAction = (action: (typeof actionTypes)[number]) => {
    if (!action.ready) {
      toast.message(`${action.label} is coming soon.`);
      return;
    }
    setSelectedClassroom("");
    setAttendanceStatus("present");
    setShowModal(true);
  };

  const applyAttendance = () => {
    if (!selectedClassroom) {
      toast.error("Choose a classroom first.");
      return;
    }
    bulkAttendance.mutate({
      organizationId: ORGANIZATION_ID,
      classroomId: Number(selectedClassroom),
      date: new Date(),
      status: attendanceStatus as "present" | "absent" | "excused" | "half_day",
    });
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Bulk Action Center</h1>
          <p className="text-muted-foreground">
            Save time by performing actions on entire classrooms at once
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Actions</p>
                <p className="text-3xl font-bold text-foreground mt-1">{logs.length}</p>
              </div>
              <BarChart3 className="w-12 h-12 text-primary-foreground" />
            </div>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Completed</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{completedCount}</p>
              </div>
              <CheckCircle2 className="w-12 h-12 text-green-100" />
            </div>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Children Processed</p>
                <p className="text-3xl font-bold text-foreground mt-1">{totalProcessed}</p>
              </div>
              <Users className="w-12 h-12 text-purple-100" />
            </div>
          </div>
        </div>

        {/* Action Types */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {actionTypes.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => openAction(action)}
                  className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md hover:border-[#A7C4AD] transition-all text-left relative"
                >
                  <div className={`${action.color} w-12 h-12 rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-foreground">{action.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {action.ready ? "Apply to entire classroom" : "Coming soon"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action History */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-2xl font-bold text-foreground">Recent Actions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Action</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Classroom</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Records</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Performed By</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
                )}
                {!isLoading && logs.length === 0 && (
                  <tr><td colSpan={6}>
                    <EmptyState icon={BarChart3} title="No bulk actions yet" description="Run a Quick Action above and it'll be logged here." />
                  </td></tr>
                )}
                {logs.map((action) => (
                  <tr key={action.id} className="border-b border-border hover:bg-muted transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{ACTION_LABELS[action.actionType] ?? action.actionType}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{action.classroomName}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      <span className="bg-muted px-3 py-1 rounded-full">{action.recordCount} children</span>
                    </td>
                    <td className="px-6 py-4 text-sm">{getStatusBadge(action.status)}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{action.performedByName}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {action.actionDate ? new Date(action.actionDate).toLocaleDateString() : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bulk Attendance Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Bulk Attendance</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Select Classroom</label>
                  <select
                    value={selectedClassroom}
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                  >
                    <option value="">Choose a classroom...</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Attendance Status</label>
                  <div className="grid grid-cols-2 gap-3">
                    {ATTENDANCE_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setAttendanceStatus(s.value)}
                        className={`p-3 border rounded-xl transition-colors text-sm font-medium ${
                          attendanceStatus === s.value
                            ? "border-[#5E8C6A] bg-[#F1F6F2] text-accent-foreground"
                            : "border-border hover:border-[#5E8C6A] hover:bg-[#F1F6F2]"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-900">
                    ℹ️ This marks every child in the selected classroom for today.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-muted hover:bg-muted text-muted-foreground px-4 py-2 rounded-xl transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyAttendance}
                    disabled={bulkAttendance.isPending}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl transition-colors font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    {bulkAttendance.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Apply to Classroom
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
