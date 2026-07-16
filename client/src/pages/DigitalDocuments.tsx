import { useMemo, useState } from "react";
import { FileText, CheckCircle2, Clock, AlertCircle, Upload, Eye, PenLine, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

const DOC_TYPES = [
  { value: "enrollment", label: "Enrollment Form" },
  { value: "consent", label: "Consent" },
  { value: "waiver", label: "Waiver" },
  { value: "health_form", label: "Health Form" },
] as const;
const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t.label]));

const statusIcons: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  signed: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100" },
  pending: { icon: Clock, color: "text-orange-600", bg: "bg-orange-100" },
  expired: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
};

export function DigitalDocuments() {
  const orgId = ORGANIZATION_ID;
  const utils = trpc.useUtils();
  const confirm = useConfirm();

  const { data: documents = [], isLoading } = trpc.digitalDocuments.list.useQuery(orgId);
  const { data: families = [] } = trpc.families.list.useQuery(orgId);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({ documentType: "enrollment", familyId: "", documentUrl: "", expiresAt: "" });

  const familyName = useMemo(
    () => new Map(families.map((f) => [f.id, f.primaryContactName])),
    [families],
  );

  const create = trpc.digitalDocuments.create.useMutation({
    onSuccess: () => {
      utils.digitalDocuments.list.invalidate();
      toast.success("Document added.");
      setShowUploadModal(false);
      setForm({ documentType: "enrollment", familyId: "", documentUrl: "", expiresAt: "" });
    },
    onError: (e) => toast.error(e.message || "Couldn't add document"),
  });

  const sign = trpc.digitalDocuments.sign.useMutation({
    onSuccess: () => { utils.digitalDocuments.list.invalidate(); toast.success("Marked as signed."); },
    onError: (e) => toast.error(e.message || "Couldn't sign document"),
  });

  const filtered = filterStatus === "all" ? documents : documents.filter((d) => d.status === filterStatus);
  const signedCount = documents.filter((d) => d.status === "signed").length;
  const pendingCount = documents.filter((d) => d.status === "pending").length;

  const submit = () => {
    if (!form.familyId) { toast.error("Choose a family."); return; }
    create.mutate({
      organizationId: orgId,
      familyId: Number(form.familyId),
      documentType: form.documentType as (typeof DOC_TYPES)[number]["value"],
      documentUrl: form.documentUrl.trim() || `manual://${form.documentType}`,
      expiresAt: form.expiresAt || undefined,
    });
  };

  const onOpen = (doc: (typeof documents)[number]) => {
    if (doc.documentUrl && /^https?:\/\//.test(doc.documentUrl)) {
      window.open(doc.documentUrl, "_blank", "noopener");
    } else {
      toast.message("No file attached — this is a recorded document (file storage isn't connected).");
    }
  };

  const onSign = async (doc: (typeof documents)[number]) => {
    const signer = familyName.get(doc.familyId) ?? "Family";
    if (await confirm({
      title: "Mark as signed?",
      description: `Record that ${signer} signed this ${DOC_LABEL[doc.documentType] ?? "document"}.`,
      confirmLabel: "Mark signed",
    })) sign.mutate({ id: doc.id, signedBy: signer });
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Digital Documents</h1>
            </div>
            <button onClick={() => setShowUploadModal(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
              <Upload className="w-5 h-5" />Add Document
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
            <p className="text-3xl font-bold text-green-600 mt-2">{signedCount}</p>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <p className="text-muted-foreground text-sm font-medium">Pending Signature</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">{pendingCount}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-6">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground">
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
                {isLoading && (
                  <tr><td colSpan={6} className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={FileText}
                        title={documents.length === 0 ? "No documents yet" : "No documents match this filter"}
                        description={documents.length === 0 ? "Add a document to send for signature." : "Try a different status above."}
                      />
                    </td>
                  </tr>
                )}
                {filtered.map((doc) => {
                  const style = statusIcons[doc.status ?? "pending"] ?? statusIcons.pending;
                  const StatusIcon = style.icon;
                  return (
                    <tr key={doc.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-foreground">{DOC_LABEL[doc.documentType] ?? doc.documentType}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{familyName.get(doc.familyId) ?? `Family #${doc.familyId}`}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`${style.bg} p-1 rounded-lg`}><StatusIcon className={`w-4 h-4 ${style.color}`} /></div>
                          <span className="font-medium text-foreground">{(doc.status ?? "pending").charAt(0).toUpperCase() + (doc.status ?? "pending").slice(1)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{doc.signedBy || "—"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString() : "—"}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button onClick={() => onOpen(doc)} className="p-2 hover:bg-muted rounded-lg transition-colors" aria-label="Open document"><Eye className="w-4 h-4 text-muted-foreground" /></button>
                          {doc.status !== "signed" && (
                            <button onClick={() => onSign(doc)} disabled={sign.isPending} className="p-2 hover:bg-muted rounded-lg transition-colors" aria-label="Mark as signed"><PenLine className="w-4 h-4 text-primary" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Document Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Add Document</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Document Type</label>
                  <select value={form.documentType} onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value }))} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground">
                    {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Family</label>
                  <select value={form.familyId} onChange={(e) => setForm((f) => ({ ...f, familyId: e.target.value }))} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground">
                    <option value="">Select family...</option>
                    {families.map((f) => <option key={f.id} value={String(f.id)}>{f.primaryContactName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Link (optional)</label>
                  <input type="url" placeholder="https://… (where the form lives)" value={form.documentUrl} onChange={(e) => setForm((f) => ({ ...f, documentUrl: e.target.value }))} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground" />
                  <p className="text-xs text-muted-foreground mt-1">File uploads aren't connected yet — paste a link, or just record the document for signature tracking.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Expires (Optional)</label>
                  <input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowUploadModal(false)} className="flex-1 bg-muted hover:bg-muted/80 text-muted-foreground px-4 py-2 rounded-xl transition-colors font-medium">Cancel</button>
                  <button onClick={submit} disabled={create.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl transition-colors font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
                    {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}Add
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
