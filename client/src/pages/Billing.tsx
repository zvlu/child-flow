import { useState } from "react";
import { DollarSign, Plus, Eye, Download, Filter, CreditCard, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useIsAdmin } from "@/_core/hooks/useIsAdmin";
import { TuitionPlans, ArAgingCards } from "@/components/TuitionPlans";
import { toast } from "sonner";
import { formatDate } from "@/lib/date";

const statusColors = {
  paid: "bg-green-100 text-green-700",
  sent: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-700",
  cancelled: "bg-muted text-muted-foreground",
};

const paymentMethodLabels: Record<string, string> = {
  credit_card: "Credit Card",
  ach: "ACH",
  check: "Check",
  cash: "Cash",
};

function formatMoney(amount: string | number) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return "$0.00";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function Billing() {
  const utils = trpc.useUtils();
  const { data: invoices, isLoading } = trpc.billing.invoices.useQuery(ORGANIZATION_ID);
  const { data: payments, isLoading: paymentsLoading } = trpc.billing.payments.useQuery(ORGANIZATION_ID);
  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID);

  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  // New invoice form state
  const [familyId, setFamilyId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  // Record payment state
  const isAdmin = useIsAdmin();
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("credit_card");

  const createInvoice = trpc.billing.createInvoice.useMutation({
    onSuccess: () => {
      utils.billing.invoices.invalidate(ORGANIZATION_ID);
      toast.success("Invoice created");
      setShowModal(false);
      setFamilyId("");
      setAmount("");
      setDueDate("");
      setDescription("");
    },
    onError: (err) => toast.error(err.message || "Failed to create invoice"),
  });

  const recordPayment = trpc.billing.recordPayment.useMutation({
    onSuccess: () => {
      utils.billing.invoices.invalidate(ORGANIZATION_ID);
      utils.billing.payments.invalidate(ORGANIZATION_ID);
      toast.success("Payment recorded — invoice marked paid");
      setPaymentInvoiceId(null);
    },
    onError: (err) => toast.error(err.message || "Failed to record payment"),
  });

  const allInvoices = invoices ?? [];
  const filteredInvoices =
    filterStatus === "all" ? allInvoices : allInvoices.filter((i) => i.status === filterStatus);
  const totalRevenue = allInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + parseFloat(i.amount || "0"), 0);
  const pendingAmount = allInvoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + parseFloat(i.amount || "0"), 0);

  const nextInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const max = allInvoices.reduce((m, inv) => {
      const match = /(\d+)\s*$/.exec(inv.invoiceNumber || "");
      return match ? Math.max(m, parseInt(match[1], 10)) : m;
    }, 0);
    return `INV-${year}-${String(max + 1).padStart(4, "0")}`;
  };

  const handleCreateInvoice = () => {
    if (!familyId) return toast.error("Please select a family");
    const parsed = parseFloat(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) return toast.error("Please enter a valid amount");
    if (!dueDate) return toast.error("Please select a due date");
    createInvoice.mutate({
      organizationId: ORGANIZATION_ID,
      familyId: Number(familyId),
      invoiceNumber: nextInvoiceNumber(),
      amount: parsed.toFixed(2),
      dueDate,
      description: description || undefined,
    });
  };

  const paymentInvoice = allInvoices.find((i) => i.id === paymentInvoiceId);

  const handleRecordPayment = () => {
    if (!paymentInvoice) return;
    recordPayment.mutate({
      invoiceId: paymentInvoice.id,
      organizationId: ORGANIZATION_ID,
      amount: paymentInvoice.amount,
      paymentMethod: paymentMethod as "credit_card" | "ach" | "check" | "cash",
    });
  };

  const invoiceNumberById = (id: number) =>
    allInvoices.find((i) => i.id === id)?.invoiceNumber || `#${id}`;

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Billing & Payments</h1>
            </div>
            {isAdmin && (
              <button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
                <Plus className="w-5 h-5" />
                New Invoice
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <p className="text-muted-foreground text-sm font-medium">Total Revenue</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{formatMoney(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-2">From paid invoices</p>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <p className="text-muted-foreground text-sm font-medium">Pending Amount</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">{formatMoney(pendingAmount)}</p>
            <p className="text-xs text-muted-foreground mt-2">Awaiting payment</p>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <p className="text-muted-foreground text-sm font-medium">Total Invoices</p>
            <p className="text-3xl font-bold text-foreground mt-2">{allInvoices.length}</p>
            <p className="text-xs text-muted-foreground mt-2">All time</p>
          </div>
        </div>

        {/* Recurring tuition + receivables aging */}
        <div className="space-y-6 mb-8">
          <TuitionPlans isAdmin={isAdmin} />
          <ArAgingCards />
        </div>

        {/* Filter */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="all">All Invoices</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Invoice #</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Family</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Due Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 align-middle" />
                      Loading invoices...
                    </td>
                  </tr>
                )}
                {!isLoading && filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                      No invoices found{filterStatus !== "all" ? " for this status" : ""}.
                    </td>
                  </tr>
                )}
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border hover:bg-muted transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{invoice.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{invoice.familyName || "—"}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-foreground">{formatMoney(invoice.amount)}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(invoice.dueDate)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[invoice.status as keyof typeof statusColors] || "bg-gray-100 text-gray-700"}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button title={invoice.description || "View invoice"} className="p-2 hover:bg-muted rounded-lg transition-colors"><Eye className="w-4 h-4 text-muted-foreground" /></button>
                        {isAdmin && invoice.status !== "paid" && invoice.status !== "cancelled" && (
                          <button
                            title="Record payment"
                            onClick={() => { setPaymentInvoiceId(invoice.id); setPaymentMethod("credit_card"); }}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                          >
                            <CreditCard className="w-4 h-4 text-primary" />
                          </button>
                        )}
                        <button title="Download" className="p-2 hover:bg-muted rounded-lg transition-colors"><Download className="w-4 h-4 text-muted-foreground" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payments History */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">Payment History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Invoice</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Method</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {paymentsLoading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 align-middle" />
                      Loading payments...
                    </td>
                  </tr>
                )}
                {!paymentsLoading && (payments ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No payments recorded yet.</td>
                  </tr>
                )}
                {(payments ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-border hover:bg-muted transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{invoiceNumberById(p.invoiceId)}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-foreground">{formatMoney(p.amount)}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{paymentMethodLabels[p.paymentMethod] || p.paymentMethod}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        {p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : "Completed"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(p.transactionDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Invoice Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Create New Invoice</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Family</label>
                    <select value={familyId} onChange={(e) => setFamilyId(e.target.value)} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Select family...</option>
                      {(families ?? []).map((f) => (
                        <option key={f.id} value={f.id}>{f.primaryContactName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Amount</label>
                    <input type="number" min="0" step="0.01" placeholder="1200.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Due Date</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
                    <input type="text" placeholder="Tuition for January..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowModal(false)} className="flex-1 bg-muted hover:bg-muted text-muted-foreground px-4 py-2 rounded-xl transition-colors font-medium">Cancel</button>
                  <button onClick={handleCreateInvoice} disabled={createInvoice.isPending} className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl transition-colors font-medium">
                    {createInvoice.isPending ? "Creating..." : "Create Invoice"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Record Payment Modal */}
        {paymentInvoice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Record Payment</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {paymentInvoice.invoiceNumber} · {paymentInvoice.familyName} · {formatMoney(paymentInvoice.amount)}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="credit_card">Credit Card</option>
                    <option value="ach">ACH</option>
                    <option value="check">Check</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setPaymentInvoiceId(null)} className="flex-1 bg-muted hover:bg-muted text-muted-foreground px-4 py-2 rounded-xl transition-colors font-medium">Cancel</button>
                  <button onClick={handleRecordPayment} disabled={recordPayment.isPending} className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl transition-colors font-medium">
                    {recordPayment.isPending ? "Recording..." : "Record Payment"}
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
