import { useState } from "react";
import { Clock, LogIn, LogOut, AlertCircle, CheckCircle2, Calendar } from "lucide-react";

export function StaffOperations() {
  const [staffTimeLogs, setStaffTimeLogs] = useState([
    { id: 1, name: "Sarah Miller", role: "Teacher", clockIn: "8:00 AM", clockOut: "4:30 PM", hoursWorked: 8.5, status: "clocked_out", date: "2025-01-20" },
    { id: 2, name: "John Smith", role: "Teacher", clockIn: "8:15 AM", clockOut: null, hoursWorked: null, status: "clocked_in", date: "2025-01-20" },
    { id: 3, name: "Maria Garcia", role: "Assistant", clockIn: "9:00 AM", clockOut: "3:00 PM", hoursWorked: 6, status: "clocked_out", date: "2025-01-20" },
    { id: 4, name: "David Lee", role: "Teacher", clockIn: "8:00 AM", clockOut: "4:30 PM", hoursWorked: 8.5, status: "clocked_out", date: "2025-01-20" },
  ]);

  const [certifications, setCertifications] = useState([
    { id: 1, staff: "Sarah Miller", cert: "CPR/First Aid", expiresAt: "2025-03-15", status: "active", daysLeft: 54 },
    { id: 2, staff: "John Smith", cert: "CDA", expiresAt: "2025-02-01", status: "expiring_soon", daysLeft: 12 },
    { id: 3, staff: "Maria Garcia", cert: "CPR/First Aid", expiresAt: "2024-12-20", status: "expired", daysLeft: 0 },
  ]);

  const handleClockIn = (staffId: number) => {
    const now = new Date().toLocaleTimeString();
    setStaffTimeLogs(logs => logs.map(log => log.id === staffId ? { ...log, clockIn: now, status: "clocked_in" } : log));
  };

  const handleClockOut = (staffId: number) => {
    const now = new Date().toLocaleTimeString();
    setStaffTimeLogs(logs => logs.map(log => log.id === staffId ? { ...log, clockOut: now, status: "clocked_out", hoursWorked: 8.5 } : log));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-8 h-8 text-teal-600" />
            <h1 className="text-4xl font-bold text-slate-900">Staff Operations</h1>
          </div>
        </div>

        {/* Time Clock Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Time Clock</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {staffTimeLogs.map((staff) => (
              <div key={staff.id} className={`rounded-2xl shadow-sm border-2 p-6 ${staff.status === "clocked_in" ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{staff.name}</h3>
                    <p className="text-sm text-slate-600">{staff.role}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${staff.status === "clocked_in" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>
                    {staff.status === "clocked_in" ? "Clocked In" : "Clocked Out"}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <LogIn className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-600">In: {staff.clockIn}</span>
                  </div>
                  {staff.clockOut && (
                    <div className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-slate-600" />
                      <span className="text-sm text-slate-600">Out: {staff.clockOut}</span>
                    </div>
                  )}
                  {staff.hoursWorked && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-600" />
                      <span className="text-sm text-slate-600">Hours: {staff.hoursWorked}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {staff.status === "clocked_in" ? (
                    <button onClick={() => handleClockOut(staff.id)} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl transition-colors font-medium flex items-center justify-center gap-2">
                      <LogOut className="w-4 h-4" />
                      Clock Out
                    </button>
                  ) : (
                    <button onClick={() => handleClockIn(staff.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl transition-colors font-medium flex items-center justify-center gap-2">
                      <LogIn className="w-4 h-4" />
                      Clock In
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Certifications Section */}
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Certifications & Training</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Staff Member</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Certification</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Expires</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {certifications.map((cert) => (
                    <tr key={cert.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{cert.staff}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{cert.cert}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{cert.expiresAt}</td>
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
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">{cert.daysLeft}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
