import { useMemo, useState } from "react";
import { Clock, LogIn, LogOut, AlertCircle, CheckCircle2, Plus, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useIsAdmin } from "@/_core/hooks/useIsAdmin";
import { toast } from "sonner";

function formatTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysUntil(value: string | Date) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return 0;
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

const emptyCertForm = {
  staffId: "",
  certificationType: "",
  issueDate: "",
  expiryDate: "",
  certificationNumber: "",
};

export function StaffOperations() {
  const isAdmin = useIsAdmin();
  const [showCertModal, setShowCertModal] = useState(false);
  const [certForm, setCertForm] = useState(emptyCertForm);

  const utils = trpc.useUtils();
  const { data: staff, isLoading: staffLoading } = trpc.staff.list.useQuery(ORGANIZATION_ID);
  const { data: entries, isLoading: entriesLoading } = trpc.staffOps.timeClock.useQuery({
    organizationId: ORGANIZATION_ID,
    sinceDays: 7,
  });
  const { data: certifications, isLoading: certsLoading } = trpc.staffOps.certifications.useQuery(ORGANIZATION_ID);

  const clockIn = trpc.staffOps.clockIn.useMutation({
    onSuccess: () => {
      utils.staffOps.timeClock.invalidate();
      toast.success("Clocked in");
    },
    onError: (err) => toast.error(`Clock in failed: ${err.message}`),
  });

  const clockOut = trpc.staffOps.clockOut.useMutation({
    onSuccess: () => {
      utils.staffOps.timeClock.invalidate();
      toast.success("Clocked out");
    },
    onError: (err) => toast.error(`Clock out failed: ${err.message}`),
  });

  const createCertification = trpc.staffOps.createCertification.useMutation({
    onSuccess: () => {
      utils.staffOps.certifications.invalidate();
      toast.success("Certification added");
      setShowCertModal(false);
      setCertForm(emptyCertForm);
    },
    onError: (err) => toast.error(`Failed to add certification: ${err.message}`),
  });

  const activeStaff = (staff ?? []).filter((s) => s.isActive === 1);
  const today = new Date();

  const certExpiredCount = (certifications ?? []).filter((c) => c.status === "expired").length;
  const certExpiringSoonCount = (certifications ?? []).filter((c) => c.status === "expiring_soon").length;
  const certActiveCount = (certifications ?? []).filter((c) => c.status === "active").length;

  const timeByStaff = useMemo(() => {
    const map = new Map<
      number,
      { openEntry?: NonNullable<typeof entries>[number]; todayEntry?: NonNullable<typeof entries>[number]; weekHours: number }
    >();
    for (const entry of entries ?? []) {
      const info = map.get(entry.staffId) ?? { weekHours: 0 };
      if (!entry.clockOutTime) {
        info.openEntry = entry;
      }
      const entryDay = new Date(entry.clockInTime ?? entry.date);
      if (!isNaN(entryDay.getTime()) && isSameDay(entryDay, today)) {
        if (!info.todayEntry || new Date(entry.clockInTime).getTime() > new Date(info.todayEntry.clockInTime).getTime()) {
          info.todayEntry = entry;
        }
      }
      if (entry.hoursWorked) {
        const hours = parseFloat(String(entry.hoursWorked));
        if (!isNaN(hours)) info.weekHours += hours;
      }
      map.set(entry.staffId, info);
    }
    return map;
  }, [entries]);

  const submitCertification = () => {
    if (!certForm.staffId || !certForm.certificationType.trim() || !certForm.issueDate || !certForm.expiryDate) {
      toast.error("Staff member, certification, issue date, and expiry date are required");
      return;
    }
    createCertification.mutate({
      staffId: Number(certForm.staffId),
      certificationType: certForm.certificationType.trim(),
      issueDate: certForm.issueDate,
      expiryDate: certForm.expiryDate,
      certificationNumber: certForm.certificationNumber.trim() || undefined,
    });
  };

  const isLoadingClock = staffLoading || entriesLoading;

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Staff Operations</h1>
          </div>
        </div>

        {/* Time Clock Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Time Clock</h2>
          {isLoadingClock ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading time clock…
            </div>
          ) : activeStaff.length === 0 ? (
            <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center text-muted-foreground">
              No active staff members found.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeStaff.map((member) => {
                const info = timeByStaff.get(member.id);
                const clockedIn = Boolean(info?.openEntry);
                const displayEntry = info?.openEntry ?? info?.todayEntry;
                const hasTodayActivity = Boolean(displayEntry);
                return (
                  <div
                    key={member.id}
                    className={`rounded-xl shadow-sm border-2 p-6 ${clockedIn ? "border-green-300 bg-green-50" : "border-border bg-card"}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{member.firstName} {member.lastName}</h3>
                        <p className="text-sm text-muted-foreground">{member.position || member.role}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${clockedIn ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {clockedIn ? "Clocked In" : "Clocked Out"}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2">
                        <LogIn className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          In: {hasTodayActivity ? formatTime(displayEntry?.clockInTime) : "Not clocked in today"}
                        </span>
                      </div>
                      {displayEntry?.clockOutTime && (
                        <div className="flex items-center gap-2">
                          <LogOut className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Out: {formatTime(displayEntry.clockOutTime)}</span>
                        </div>
                      )}
                      {displayEntry?.hoursWorked && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Hours: {parseFloat(String(displayEntry.hoursWorked)).toFixed(1)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          This week: {(info?.weekHours ?? 0).toFixed(1)} hrs
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {clockedIn ? (
                        <button
                          onClick={() => info?.openEntry && clockOut.mutate(info.openEntry.id)}
                          disabled={clockOut.isPending}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                        >
                          <LogOut className="w-4 h-4" />
                          Clock Out
                        </button>
                      ) : (
                        <button
                          onClick={() => clockIn.mutate(member.id)}
                          disabled={clockIn.isPending}
                          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                        >
                          <LogIn className="w-4 h-4" />
                          Clock In
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Certifications Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-foreground">Certifications & Training</h2>
            {isAdmin && (
              <button
                onClick={() => setShowCertModal(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl transition-colors font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Certification
              </button>
            )}
          </div>
          {!certsLoading && (certifications ?? []).length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-xl font-bold text-foreground">{certExpiredCount}</p>
                  <p className="text-xs text-muted-foreground">Expired</p>
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                <div>
                  <p className="text-xl font-bold text-foreground">{certExpiringSoonCount}</p>
                  <p className="text-xs text-muted-foreground">Expiring within 60 days</p>
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xl font-bold text-foreground">{certActiveCount}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </div>
          )}
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            {certsLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading certifications…
              </div>
            ) : (certifications ?? []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No certifications on file yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Staff Member</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Certification</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Expires</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Days Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(certifications ?? []).map((cert) => (
                      <tr key={cert.id} className="border-b border-border hover:bg-muted transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-foreground">{cert.staffName}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{cert.certificationType}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(cert.expiryDate).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            {cert.status === "active" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                            {cert.status === "expiring_soon" && <AlertCircle className="w-4 h-4 text-orange-600" />}
                            {cert.status === "expired" && <AlertCircle className="w-4 h-4 text-red-600" />}
                            <span className={`font-medium ${cert.status === "active" ? "text-green-700" : cert.status === "expiring_soon" ? "text-orange-700" : "text-red-700"}`}>
                              {cert.status === "active" ? "Active" : cert.status === "expiring_soon" ? "Expiring Soon" : "Expired"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-foreground">{daysUntil(cert.expiryDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Add Certification Modal */}
        {showCertModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-lg max-w-lg w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Add Certification</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Staff Member</label>
                  <select
                    value={certForm.staffId}
                    onChange={(e) => setCertForm((f) => ({ ...f, staffId: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Choose a staff member...</option>
                    {(staff ?? []).map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Certification Type</label>
                  <input
                    type="text"
                    placeholder="e.g. CPR/First Aid, CDA"
                    value={certForm.certificationType}
                    onChange={(e) => setCertForm((f) => ({ ...f, certificationType: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Issue Date</label>
                    <input
                      type="date"
                      value={certForm.issueDate}
                      onChange={(e) => setCertForm((f) => ({ ...f, issueDate: e.target.value }))}
                      className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Expiry Date</label>
                    <input
                      type="date"
                      value={certForm.expiryDate}
                      onChange={(e) => setCertForm((f) => ({ ...f, expiryDate: e.target.value }))}
                      className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Certification Number (optional)</label>
                  <input
                    type="text"
                    value={certForm.certificationNumber}
                    onChange={(e) => setCertForm((f) => ({ ...f, certificationNumber: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => { setShowCertModal(false); setCertForm(emptyCertForm); }}
                    className="flex-1 bg-muted hover:bg-muted text-muted-foreground px-4 py-2 rounded-xl transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitCertification}
                    disabled={createCertification.isPending}
                    className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {createCertification.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Certification
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
