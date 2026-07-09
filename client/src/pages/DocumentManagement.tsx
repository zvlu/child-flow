import { useMemo, useState } from "react";
import { FileText, Download, Trash2, Plus, Search, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

const DOC_TYPES = [
  { value: "birth_certificate", label: "Birth Certificate" },
  { value: "immunization_record", label: "Immunization Record" },
  { value: "consent_form", label: "Consent Form" },
  { value: "medical_record", label: "Medical Record" },
  { value: "assessment", label: "Assessment" },
  { value: "iep", label: "IEP / IFSP" },
  { value: "enrollment", label: "Enrollment Docs" },
  { value: "other", label: "Other" },
] as const;
const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t.label]));

function fileSizeLabel(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`;
  return `${bytes} B`;
}

export function DocumentManagement() {
  const orgId = ORGANIZATION_ID;
  const utils = trpc.useUtils();
  const confirm = useConfirm();

  const { data: documents = [], isLoading } = trpc.documents.list.useQuery({ organizationId: orgId });
  const { data: children = [] } = trpc.children.list.useQuery(orgId);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [form, setForm] = useState({ childId: "", documentType: "birth_certificate", fileName: "", fileUrl: "", expiryDate: "" });

  const nameById = useMemo(
    () => new Map(children.map((c) => [c.id, `${c.firstName} ${c.lastName}`])),
    [children],
  );
  // childId is nullable — a document can be uploaded (from the iOS app) before
  // it's filed to a child's profile.
  const childNameFor = (childId: number | null): string | undefined =>
    childId != null ? nameById.get(childId) : undefined;

  const create = trpc.documents.create.useMutation({
    onSuccess: () => {
      utils.documents.list.invalidate();
      toast.success("Document recorded.");
      setShowUploadModal(false);
      setForm({ childId: "", documentType: "birth_certificate", fileName: "", fileUrl: "", expiryDate: "" });
    },
    onError: (e) => toast.error(e.message || "Couldn't save document"),
  });

  const del = trpc.documents.delete.useMutation({
    onSuccess: () => { utils.documents.list.invalidate(); toast.success("Document removed."); },
    onError: (e) => toast.error(e.message || "Couldn't remove document"),
  });

  const filtered = documents.filter((doc) => {
    const childName = childNameFor(doc.childId) ?? "";
    const matchesSearch =
      childName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || doc.documentType === filterType;
    return matchesSearch && matchesType;
  });

  const submit = () => {
    if (!form.childId) { toast.error("Choose a child."); return; }
    if (!form.fileName.trim()) { toast.error("Enter a document name."); return; }
    create.mutate({
      organizationId: orgId,
      childId: Number(form.childId),
      documentType: form.documentType as (typeof DOC_TYPES)[number]["value"],
      fileName: form.fileName.trim(),
      // No binary storage is wired; store the provided link or a manual marker.
      fileUrl: form.fileUrl.trim() || `manual://${form.fileName.trim()}`,
      expiryDate: form.expiryDate ? new Date(`${form.expiryDate}T00:00:00`) : undefined,
    });
  };

  const onDownload = (doc: (typeof documents)[number]) => {
    if (doc.fileUrl && /^https?:\/\//.test(doc.fileUrl)) {
      window.open(doc.fileUrl, "_blank", "noopener");
    } else {
      toast.message("No file attached — this is a recorded document (file storage isn't connected).");
    }
  };

  const onDelete = async (doc: (typeof documents)[number]) => {
    if (await confirm({
      title: "Remove this document?",
      description: `"${doc.fileName}" for ${childNameFor(doc.childId) ?? "this child"} will be permanently removed.`,
      confirmLabel: "Remove",
      destructive: true,
    })) del.mutate(doc.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Document Management</h1>
          <p className="text-muted-foreground">Securely store and manage documents for children and families</p>
        </div>

        {/* Action Bar */}
        <div className="bg-card rounded-xl shadow-sm p-6 mb-6 border border-border">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 flex gap-4 w-full md:w-auto">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-muted-foreground w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by child name or file..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A] bg-background text-foreground"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A] bg-background text-foreground"
              >
                <option value="all">All Types</option>
                {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-[#4F7C5D] hover:bg-[#3C5E47] text-white px-6 py-2 rounded-xl flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />Add Document
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl shadow-sm border border-border p-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No documents found</h3>
            <p className="text-muted-foreground">
              {documents.length === 0 ? "Add your first document to get started." : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((doc) => (
              <div key={doc.id} className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-4">
                  <div className="bg-[#E7F0E9] p-3 rounded-xl">
                    <FileText className="w-6 h-6 text-[#4F7C5D]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{childNameFor(doc.childId) ?? (doc.childId != null ? `Child #${doc.childId}` : "Unassigned")}</h3>
                    <p className="text-sm text-muted-foreground">{DOC_LABEL[doc.documentType] ?? doc.documentType}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="bg-muted p-3 rounded-xl">
                    <p className="text-sm font-mono text-muted-foreground truncate">{doc.fileName}</p>
                    {doc.fileSize ? <p className="text-xs text-muted-foreground mt-1">{fileSizeLabel(doc.fileSize)}</p> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Added</p>
                      <p className="font-medium text-foreground">{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "—"}</p>
                    </div>
                    {doc.expiryDate && (
                      <div>
                        <p className="text-muted-foreground text-xs">Expires</p>
                        <p className="font-medium text-red-600">{new Date(doc.expiryDate).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => onDownload(doc)} className="flex-1 bg-muted hover:bg-muted/80 text-muted-foreground px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors">
                    <Download className="w-4 h-4" />Open
                  </button>
                  <button onClick={() => onDelete(doc)} disabled={del.isPending} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-xl flex items-center justify-center transition-colors" aria-label="Remove document">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Document Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">Add Document</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Child</label>
                  <select
                    value={form.childId}
                    onChange={(e) => setForm((f) => ({ ...f, childId: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A] bg-background text-foreground"
                  >
                    <option value="">Choose a child...</option>
                    {children.map((c) => <option key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Document Type</label>
                  <select
                    value={form.documentType}
                    onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A] bg-background text-foreground"
                  >
                    {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Document name</label>
                  <input
                    type="text" placeholder="e.g., emma_birth_cert.pdf"
                    value={form.fileName}
                    onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A] bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Link (optional)</label>
                  <input
                    type="url" placeholder="https://… (where the file lives)"
                    value={form.fileUrl}
                    onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A] bg-background text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">File uploads aren't connected yet — paste a link, or just record the document.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A] bg-background text-foreground"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowUploadModal(false)} className="flex-1 bg-muted hover:bg-muted/80 text-muted-foreground px-4 py-2 rounded-xl transition-colors font-medium">Cancel</button>
                  <button onClick={submit} disabled={create.isPending} className="flex-1 bg-[#4F7C5D] hover:bg-[#3C5E47] text-white px-4 py-2 rounded-xl transition-colors font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
                    {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}Save
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
