import { useState } from "react";
import { DollarSign, Plus, Eye, Send, Download, Filter } from "lucide-react";

export function Billing() {
  const [invoices, setInvoices] = useState([
    { id: 1, number: "INV-2025-001", family: "Johnson Family", amount: 1200, dueDate: "2025-02-15", status: "paid", createdDate: "2025-01-20" },
    { id: 2, number: "INV-2025-002", family: "Chen Family", amount: 950, dueDate: "2025-02-15", status: "sent", createdDate: "2025-01-20" },
    { id: 3, number: "INV-2025-003", family: "Rodriguez Family", amount: 1200, dueDate: "2025-02-15", status: "overdue", createdDate: "2025-01-10" },
    { id: 4, number: "INV-2025-004", family: "Williams Family", amount: 850, dueDate: "2025-02-20", status: "draft", createdDate: "2025-01-19" },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const statusColors = {
    paid: "bg-green-100 text-green-700",
    sent: "bg-blue-100 text-blue-700",
    overdue: "bg-red-100 text-red-700",
    draft: "bg-gray-100 text-gray-700",
  };

  const filteredInvoices = filterStatus === "all" ? invoices : invoices.filter(i => i.status === filterStatus);
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const pendingAmount = invoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-teal-600" />
              <h1 className="text-4xl font-bold text-slate-900">Billing & Payments</h1>
            </div>
            <button onClick={() => setShowModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
              <Plus className="w-5 h-5" />
              New Invoice
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-600 text-sm font-medium">Total Revenue</p>
            <p className="text-3xl font-bold text-green-600 mt-2">${totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-2">From paid invoices</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-600 text-sm font-medium">Pending Amount</p>
            <p className="text-3xl font-bold text-orange-600 mt-2">${pendingAmount.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-2">Awaiting payment</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-600 text-sm font-medium">Total Invoices</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{invoices.length}</p>
            <p className="text-xs text-slate-500 mt-2">This month</p>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="all">All Invoices</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Invoice #</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Family</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Due Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{invoice.number}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{invoice.family}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">${invoice.amount}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{invoice.dueDate}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[invoice.status as keyof typeof statusColors]}`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><Eye className="w-4 h-4 text-slate-600" /></button>
                        {invoice.status !== "paid" && <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><Send className="w-4 h-4 text-slate-600" /></button>}
                        <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><Download className="w-4 h-4 text-slate-600" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Invoice Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Create New Invoice</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Family</label>
                    <select className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500">
                      <option>Select family...</option>
                      <option>Johnson Family</option>
                      <option>Chen Family</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
                    <input type="number" placeholder="1200.00" className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Due Date</label>
                    <input type="date" className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                    <input type="text" placeholder="Tuition for January..." className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-colors font-medium">Cancel</button>
                  <button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl transition-colors font-medium">Create Invoice</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
