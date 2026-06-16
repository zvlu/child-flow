import { useState } from "react";
import { Upload, FileText, Download, Trash2, Plus, Filter, Search } from "lucide-react";

export function DocumentManagement() {
  const [documents, setDocuments] = useState([
    {
      id: 1,
      childName: "Emma Johnson",
      documentType: "Birth Certificate",
      fileName: "emma_birth_cert.pdf",
      uploadedDate: "2025-01-15",
      expiryDate: null,
      uploadedBy: "Sarah Miller",
      fileSize: "2.4 MB",
    },
    {
      id: 2,
      childName: "Liam Chen",
      documentType: "Immunization Record",
      fileName: "liam_immunizations.pdf",
      uploadedDate: "2025-01-10",
      expiryDate: "2026-01-10",
      uploadedBy: "John Smith",
      fileSize: "1.8 MB",
    },
    {
      id: 3,
      childName: "Sophia Rodriguez",
      documentType: "Consent Form",
      fileName: "sophia_consent.pdf",
      uploadedDate: "2024-12-20",
      expiryDate: null,
      uploadedBy: "Maria Garcia",
      fileSize: "0.9 MB",
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const documentTypes = [
    "Birth Certificate",
    "Immunization Record",
    "Consent Form",
    "Medical Record",
    "Assessment",
    "Other",
  ];

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.childName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      filterType === "all" || doc.documentType === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Document Management
          </h1>
          <p className="text-slate-600">
            Securely store and manage digital documents for children and families
          </p>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-slate-200">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 flex gap-4 w-full md:w-auto">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by child name or file..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]"
              >
                <option value="all">All Types</option>
                {documentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-[#4F7C5D] hover:bg-[#3C5E47] text-white px-6 py-2 rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Upload Document
            </button>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-[#E7F0E9] p-3 rounded-xl">
                    <FileText className="w-6 h-6 text-[#4F7C5D]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {doc.childName}
                    </h3>
                    <p className="text-sm text-slate-600">{doc.documentType}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-sm font-mono text-slate-700 truncate">
                    {doc.fileName}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{doc.fileSize}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-slate-600 text-xs">Uploaded</p>
                    <p className="font-medium text-slate-900">
                      {doc.uploadedDate}
                    </p>
                  </div>
                  {doc.expiryDate && (
                    <div>
                      <p className="text-slate-600 text-xs">Expires</p>
                      <p className="font-medium text-red-600">
                        {doc.expiryDate}
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500">
                  Uploaded by: {doc.uploadedBy}
                </p>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-xl flex items-center justify-center transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredDocuments.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No documents found
            </h3>
            <p className="text-slate-600">
              Upload your first document to get started
            </p>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Upload Document
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Child
                  </label>
                  <select className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]">
                    <option>Emma Johnson</option>
                    <option>Liam Chen</option>
                    <option>Sophia Rodriguez</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Document Type
                  </label>
                  <select className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]">
                    {documentTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    File
                  </label>
                  <div className="border-2 border-dashed border-[#A7C4AD] rounded-xl p-6 text-center cursor-pointer hover:border-[#5E8C6A] transition-colors">
                    <Upload className="w-8 h-8 text-[#4F7C5D] mx-auto mb-2" />
                    <p className="text-sm text-slate-700 font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-slate-500">
                      PDF, DOC, DOCX up to 10MB
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button className="flex-1 bg-[#4F7C5D] hover:bg-[#3C5E47] text-white px-4 py-2 rounded-xl transition-colors font-medium">
                    Upload
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
