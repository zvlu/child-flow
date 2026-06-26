import { useState } from "react";
import { BarChart3, Plus, Edit2, Trash2, Download, Eye } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export function ReportBuilder() {
  const [reports, setReports] = useState([
    { id: 1, name: "Monthly Enrollment Report", type: "enrollment", lastRun: "2025-01-20", frequency: "monthly" },
    { id: 2, name: "Attendance Trends", type: "attendance", lastRun: "2025-01-19", frequency: "weekly" },
    { id: 3, name: "Health Compliance Status", type: "health", lastRun: "2025-01-15", frequency: "monthly" },
    { id: 4, name: "Financial Summary", type: "financial", lastRun: "2025-01-20", frequency: "monthly" },
  ]);

  const [showBuilder, setShowBuilder] = useState(false);
  const [newReport, setNewReport] = useState({ name: "", type: "enrollment", frequency: "monthly" });

  const reportTypes = [
    { id: "enrollment", label: "Enrollment", description: "Track enrollment numbers and capacity" },
    { id: "attendance", label: "Attendance", description: "Analyze attendance patterns and absences" },
    { id: "health", label: "Health", description: "Monitor health screenings and compliance" },
    { id: "compliance", label: "Compliance", description: "Federal reporting and PIR data" },
    { id: "financial", label: "Financial", description: "Tuition and payment tracking" },
    { id: "custom", label: "Custom", description: "Build your own report" },
  ];

  const handleCreateReport = () => {
    if (newReport.name) {
      setReports([...reports, { id: reports.length + 1, ...newReport, lastRun: new Date().toISOString().split("T")[0] }]);
      setNewReport({ name: "", type: "enrollment", frequency: "monthly" });
      setShowBuilder(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-[#4F7C5D]" />
              <h1 className="text-4xl font-bold text-foreground">Report Builder</h1>
            </div>
            <button onClick={() => setShowBuilder(true)} className="bg-[#4F7C5D] hover:bg-[#3C5E47] text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
              <Plus className="w-5 h-5" />
              New Report
            </button>
          </div>
        </div>

        {/* Report Templates */}
        {!showBuilder && (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-4">Quick Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {reportTypes.map((type) => (
                <button key={type.id} onClick={() => { setNewReport({ ...newReport, type: type.id }); setShowBuilder(true); }} className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md hover:border-[#A7C4AD] transition-all text-left">
                  <h3 className="font-semibold text-foreground mb-1">{type.label}</h3>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </button>
              ))}
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-4">My Reports</h2>
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Report Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Frequency</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Last Run</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState
                            icon={BarChart3}
                            title="No reports yet"
                            description="Pick a template above or use “New Report” to build your first one — it'll show up here."
                          />
                        </td>
                      </tr>
                    )}
                    {reports.map((report) => (
                      <tr key={report.id} className="border-b border-border hover:bg-muted transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-foreground">{report.name}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{report.type.charAt(0).toUpperCase() + report.type.slice(1)}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{report.frequency.charAt(0).toUpperCase() + report.frequency.slice(1)}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{report.lastRun}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-muted rounded-lg transition-colors"><Eye className="w-4 h-4 text-muted-foreground" /></button>
                            <button className="p-2 hover:bg-muted rounded-lg transition-colors"><Download className="w-4 h-4 text-muted-foreground" /></button>
                            <button className="p-2 hover:bg-muted rounded-lg transition-colors"><Edit2 className="w-4 h-4 text-muted-foreground" /></button>
                            <button className="p-2 hover:bg-muted rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-600" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Report Builder Modal */}
        {showBuilder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Create New Report</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Report Name</label>
                  <input type="text" value={newReport.name} onChange={(e) => setNewReport({ ...newReport, name: e.target.value })} placeholder="e.g., Monthly Enrollment Summary" className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Report Type</label>
                    <select value={newReport.type} onChange={(e) => setNewReport({ ...newReport, type: e.target.value })} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]">
                      {reportTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Frequency</label>
                    <select value={newReport.frequency} onChange={(e) => setNewReport({ ...newReport, frequency: e.target.value })} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Select Columns</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Name", "Date", "Status", "Count", "Percentage", "Notes"].map((col) => (
                      <label key={col} className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                        <span className="text-sm text-muted-foreground">{col}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowBuilder(false)} className="flex-1 bg-muted hover:bg-muted text-muted-foreground px-4 py-2 rounded-xl transition-colors font-medium">Cancel</button>
                  <button onClick={handleCreateReport} className="flex-1 bg-[#4F7C5D] hover:bg-[#3C5E47] text-white px-4 py-2 rounded-xl transition-colors font-medium">Create Report</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
