import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Filter,
  BarChart3,
  Users,
  Zap,
} from "lucide-react";

export function BulkActionCenter() {
  const [actions, setActions] = useState([
    {
      id: 1,
      actionType: "Bulk Attendance",
      classroom: "Preschool A",
      recordCount: 18,
      status: "completed",
      performedBy: "Sarah Miller",
      date: "2025-01-20",
      completedAt: "2025-01-20 09:30 AM",
    },
    {
      id: 2,
      actionType: "Bulk Health Screening",
      classroom: "Toddlers B",
      recordCount: 12,
      status: "completed",
      performedBy: "John Smith",
      date: "2025-01-19",
      completedAt: "2025-01-19 02:15 PM",
    },
    {
      id: 3,
      actionType: "Bulk Notes",
      classroom: "Infants",
      recordCount: 8,
      status: "pending",
      performedBy: "Maria Garcia",
      date: "2025-01-20",
      completedAt: null,
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState("attendance");
  const [selectedClassroom, setSelectedClassroom] = useState("");

  const classrooms = ["Infants", "Toddlers A", "Toddlers B", "Preschool A", "Preschool B"];
  const actionTypes = [
    { id: "attendance", label: "Bulk Attendance", icon: CheckCircle2, color: "bg-blue-100 text-blue-600" },
    { id: "health", label: "Bulk Health Screening", icon: AlertCircle, color: "bg-green-100 text-green-600" },
    { id: "notes", label: "Bulk Notes", icon: Users, color: "bg-purple-100 text-purple-600" },
    { id: "enrollment", label: "Bulk Enrollment", icon: Zap, color: "bg-orange-100 text-orange-600" },
  ];

  const getStatusBadge = (status: string) => {
    if (status === "completed") {
      return (
        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Completed
        </span>
      );
    } else if (status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
          <Clock className="w-4 h-4" />
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
        <AlertCircle className="w-4 h-4" />
        Failed
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Bulk Action Center
          </h1>
          <p className="text-slate-600">
            Save time by performing actions on entire classrooms at once
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Total Actions</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {actions.length}
                </p>
              </div>
              <BarChart3 className="w-12 h-12 text-[#E7F0E9]" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Completed</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {actions.filter((a) => a.status === "completed").length}
                </p>
              </div>
              <CheckCircle2 className="w-12 h-12 text-green-100" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm font-medium">Children Processed</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {actions.reduce((sum, a) => sum + a.recordCount, 0)}
                </p>
              </div>
              <Users className="w-12 h-12 text-purple-100" />
            </div>
          </div>
        </div>

        {/* Action Types */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {actionTypes.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    setSelectedAction(action.id);
                    setShowModal(true);
                  }}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-[#A7C4AD] transition-all text-left"
                >
                  <div className={`${action.color} w-12 h-12 rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{action.label}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Apply to entire classroom
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action History */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900">Recent Actions</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Classroom
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Records
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Performed By
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {actions.map((action) => (
                  <tr
                    key={action.id}
                    className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {action.actionType}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {action.classroom}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className="bg-slate-100 px-3 py-1 rounded-full">
                        {action.recordCount} children
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getStatusBadge(action.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {action.performedBy}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {action.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bulk Action Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                {actionTypes.find((a) => a.id === selectedAction)?.label}
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Classroom
                  </label>
                  <select
                    value={selectedClassroom}
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]"
                  >
                    <option value="">Choose a classroom...</option>
                    {classrooms.map((classroom) => (
                      <option key={classroom} value={classroom}>
                        {classroom}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAction === "attendance" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Attendance Status
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {["Present", "Absent", "Excused", "Half Day"].map(
                        (status) => (
                          <button
                            key={status}
                            className="p-3 border border-slate-300 rounded-xl hover:border-[#5E8C6A] hover:bg-[#F1F6F2] transition-colors text-sm font-medium"
                          >
                            {status}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}

                {selectedAction === "health" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Health Screening Type
                    </label>
                    <select className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]">
                      <option>Immunization</option>
                      <option>Dental</option>
                      <option>Physical</option>
                      <option>Vision</option>
                      <option>Hearing</option>
                    </select>
                  </div>
                )}

                {selectedAction === "notes" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Note Content
                    </label>
                    <textarea
                      placeholder="Enter note to apply to all children in this classroom..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A] resize-none"
                      rows={4}
                    />
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-900">
                    ℹ️ This action will affect all {selectedClassroom ? `children in ${selectedClassroom}` : "children in the selected classroom"}.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button className="flex-1 bg-[#4F7C5D] hover:bg-[#3C5E47] text-white px-4 py-2 rounded-xl transition-colors font-medium">
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
