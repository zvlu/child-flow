import { useState } from "react";
import { FileText, CheckCircle2, Clock, AlertCircle, Upload, Eye, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export function DigitalDocuments() {
  const [documents, setDocuments] = useState([
    { id: 1, type: "Enrollment Form", family: "Johnson Family", status: "signed", signedBy: "Sarah Johnson", signedDate: "2025-01-15", expiresAt: "2026-01-15" },
    { id: 2, type: "Health Consent", family: "Chen Family", status: "pending", signedBy: null, signedDate: null, expiresAt: "2025-02-15" },
    { id: 3, type: "Waiver", family: "Rodriguez Family", status: "signed", signedBy: "Maria Rodriguez", signedDate: "2025-01-10", expiresAt: "2026-01-10" },
    { id: 4, type: "Emergency Contact Form", family: "Williams Family", status: "pending", signedBy: null, signedDate: null, expiresAt: "2025-02-20" },
    { id: 5, type: "Photo Release", family: "Martinez Family", status: "signed", signedBy: "Juan Martinez", signedDate: "2025-01-12", expiresAt: "2026-01-12" },
  ]);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const statusIcons = {
    signed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
    pending: { icon: Clock, color: "text-orange-600", bg: "bg-orange-100" },
    expired: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
  };

  const filteredDocuments = filterStatus === "all" ? documents : documents.filter(d => d.status === filterStatus);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-[#4F7C5D]" />
              <h1 className="text-4xl font-bold text-foreground">Digital Documents</h1>
            </div>
            <button onClick={() => setShowUploadModal(true)} className="bg-[#4F7C5D] hover:bg-[#3C5E47] text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
              <Upload className="w-5 h-5" />
              Upload Document
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <p className="text-muted-foreground text-sm font-medium">Total Documents</p>
            <p className="text-3xl font-bold text-foreground mt-2">{documents.length}</p>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <p className="text-muted-foreground text-sm font-medium">Signed</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{documents.filter(d => d.status === "signed").length}</p>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <p className="text-muted-foreground text-sm font-medium">Pending Signature</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">{documents.filter(d => d.status === "pending").length}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-6">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]">
            <option value="all">All Documents</option>
            <option value="signed">Signed</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Documents Table */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Document Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Family</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Signed By</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Expires</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={FileText}
                        title="No documents match this filter"
                        description="Try a different status above, or upload a new document to get started."
                      />
                    </td>
                  </tr>
                )}
                {filteredDocuments.map((doc) => {
                  const StatusIcon = statusIcons[doc.status as keyof typeof statusIcons].icon;
                  const statusStyle = statusIcons[doc.status as keyof typeof statusIcons];
                  return (
                    <tr key={doc.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{doc.type}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{doc.family}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`${statusStyle.bg} p-1 rounded-lg`}>
                            <StatusIcon className={`w-4 h-4 ${statusStyle.color}`} />
                          </div>
                          <span className="font-medium text-foreground">{doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{doc.signedBy || "—"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{doc.expiresAt}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button className="p-2 hover:bg-muted rounded-lg transition-colors"><Eye className="w-4 h-4 text-muted-foreground" /></button>
                          <button className="p-2 hover:bg-muted rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-600" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Upload Document</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Document Type</label>
                  <select className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]">
                    <option>Enrollment Form</option>
                    <option>Health Consent</option>
                    <option>Waiver</option>
                    <option>Photo Release</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Family</label>
                  <select className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]">
                    <option>Select family...</option>
                    <option>Johnson Family</option>
                    <option>Chen Family</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Upload File</label>
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-[#5E8C6A] transition-colors cursor-pointer">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Drag and drop or click to upload</p>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowUploadModal(false)} className="flex-1 bg-muted hover:bg-muted text-muted-foreground px-4 py-2 rounded-xl transition-colors font-medium">Cancel</button>
                  <button className="flex-1 bg-[#4F7C5D] hover:bg-[#3C5E47] text-white px-4 py-2 rounded-xl transition-colors font-medium">Upload</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
