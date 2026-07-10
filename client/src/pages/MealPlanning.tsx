import { useState } from "react";
import { Apple, Plus, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Glossary } from "@/components/Glossary";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useIsAdmin } from "@/_core/hooks/useIsAdmin";
import { toast } from "sonner";

const MEAL_TYPE_ORDER = ["breakfast", "snack", "lunch", "afternoon_snack"] as const;
const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "BREAKFAST",
  snack: "AM SNACK",
  lunch: "LUNCH",
  afternoon_snack: "PM SNACK",
};
const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

function formatWeek(weekStartDate: string | Date) {
  const start = new Date(weekStartDate);
  if (Number.isNaN(start.getTime())) return "Unknown week";
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function formatMonth(m: string | Date) {
  const d = new Date(typeof m === "string" && /^\d{4}-\d{2}$/.test(m) ? `${m}-01T00:00:00` : m);
  if (Number.isNaN(d.getTime())) return String(m);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatMoney(amount: string | number | null | undefined) {
  const n = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  if (n == null || Number.isNaN(n)) return "$0.00";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MealPlanning() {
  const utils = trpc.useUtils();
  const { data: plans, isLoading: plansLoading } = trpc.meals.plans.useQuery(ORGANIZATION_ID);
  const { data: classrooms } = trpc.classrooms.list.useQuery(ORGANIZATION_ID);
  const { data: cacfpReports } = trpc.meals.cacfpReports.useQuery(ORGANIZATION_ID);

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  // New plan form state
  const [newClassroomId, setNewClassroomId] = useState("");
  const [newWeekStart, setNewWeekStart] = useState("");
  const [copyFromSelected, setCopyFromSelected] = useState(false);

  const allPlans = plans ?? [];
  const effectivePlanId = selectedPlanId ?? allPlans[0]?.id ?? null;
  const selectedPlan = allPlans.find((p) => p.id === effectivePlanId);

  const { data: items, isLoading: itemsLoading } = trpc.meals.items.useQuery(
    effectivePlanId as number,
    { enabled: effectivePlanId != null }
  );

  const isAdmin = useIsAdmin();
  const updateStatus = trpc.meals.updatePlanStatus.useMutation({
    onSuccess: () => {
      utils.meals.plans.invalidate(ORGANIZATION_ID);
      toast.success("Plan status updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update plan status"),
  });

  const createPlan = trpc.meals.createPlan.useMutation({
    onSuccess: () => {
      utils.meals.plans.invalidate(ORGANIZATION_ID);
      toast.success("Meal plan created");
      setShowModal(false);
      setNewClassroomId("");
      setNewWeekStart("");
      setCopyFromSelected(false);
    },
    onError: (err) => toast.error(err.message || "Failed to create meal plan"),
  });

  const planItems = items ?? [];
  const compliantPct =
    planItems.length > 0
      ? Math.round((planItems.filter((i) => i.cacfpCompliant).length / planItems.length) * 100)
      : null;
  const totalMealsServed = (cacfpReports ?? []).reduce((sum, r) => sum + (r.mealsServed || 0), 0);

  const itemsByDay = DAY_ORDER.map((day) => ({
    day,
    meals: MEAL_TYPE_ORDER.map((type) => ({
      type,
      item: planItems.find((i) => i.dayOfWeek === day && i.mealType === type),
    })).filter((m) => m.item),
  })).filter((d) => d.meals.length > 0);

  const mealTypesPresent = MEAL_TYPE_ORDER.filter((t) => planItems.some((i) => i.mealType === t));

  const handleCreatePlan = () => {
    if (!newClassroomId) return toast.error("Please select a classroom");
    if (!newWeekStart) return toast.error("Please select a week start date");
    const copiedItems =
      copyFromSelected && planItems.length > 0
        ? planItems.map((i) => ({
            dayOfWeek: i.dayOfWeek as (typeof DAY_ORDER)[number],
            mealType: i.mealType as (typeof MEAL_TYPE_ORDER)[number],
            description: i.description,
            servings: i.servings ?? undefined,
          }))
        : [];
    createPlan.mutate({
      organizationId: ORGANIZATION_ID,
      classroomId: Number(newClassroomId),
      weekStartDate: newWeekStart,
      items: copiedItems,
    });
  };

  const reportStatusColors: Record<string, string> = {
    approved: "bg-green-100 text-green-700",
    submitted: "bg-blue-100 text-blue-700",
    draft: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Apple className="w-8 h-8 text-primary" />
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">CACFP Meal Planning <Glossary term="CACFP" /></h1>
            </div>
            <button onClick={() => setShowModal(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
              <Plus className="w-5 h-5" />
              New Meal Plan
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <p className="text-muted-foreground text-sm font-medium">Total Plans</p>
            <p className="text-3xl font-bold text-foreground mt-2">{allPlans.length}</p>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <p className="text-muted-foreground text-sm font-medium">Meals Served (CACFP Reports)</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{totalMealsServed.toLocaleString()}</p>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <p className="text-muted-foreground text-sm font-medium">CACFP Compliant (Selected Plan)</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{compliantPct != null ? `${compliantPct}%` : "—"}</p>
          </div>
        </div>

        {/* Meal Plans */}
        {plansLoading ? (
          <div className="bg-card rounded-xl shadow-sm border border-border p-10 text-center text-muted-foreground mb-8">
            <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 align-middle" />
            Loading meal plans...
          </div>
        ) : allPlans.length === 0 ? (
          <div className="bg-card rounded-xl shadow-sm border border-border p-10 text-center mb-8">
            <Apple className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No meal plans yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {allPlans.map((plan) => (
              <div key={plan.id} onClick={() => setSelectedPlanId(plan.id)} className={`rounded-xl shadow-sm border-2 p-6 cursor-pointer transition-all ${effectivePlanId === plan.id ? "border-[#5E8C6A] bg-[#F1F6F2]" : "border-border bg-card hover:border-[#A7C4AD]"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{formatWeek(plan.weekStartDate)}</h3>
                    <p className="text-sm text-muted-foreground">{plan.classroomName || `Classroom #${plan.classroomId}`}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${plan.status === "approved" ? "bg-green-100 text-green-700" : plan.status === "served" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                    {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Week of {new Date(plan.weekStartDate).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Meal Details */}
        {selectedPlan && (
          <div className="bg-card rounded-xl shadow-sm border border-border p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Weekly Menu</h2>
              <div className="flex gap-2">
                {isAdmin && selectedPlan.status === "draft" && (
                  <button
                    onClick={() => updateStatus.mutate({ id: selectedPlan.id, status: "approved" })}
                    disabled={updateStatus.isPending}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    {updateStatus.isPending ? "Updating..." : "Approve Plan"}
                  </button>
                )}
                {selectedPlan.status === "approved" && (
                  <button
                    onClick={() => updateStatus.mutate({ id: selectedPlan.id, status: "served" })}
                    disabled={updateStatus.isPending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    {updateStatus.isPending ? "Updating..." : "Mark Served"}
                  </button>
                )}
                {selectedPlan.status === "served" && (
                  <span className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-100 text-blue-700">Served</span>
                )}
              </div>
            </div>

            {itemsLoading ? (
              <div className="py-10 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 align-middle" />
                Loading menu...
              </div>
            ) : itemsByDay.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">No menu items in this plan yet.</div>
            ) : (
              <div className="space-y-4">
                {itemsByDay.map(({ day, meals }) => (
                  <div key={day} className="border border-border rounded-xl p-4">
                    <h3 className="font-semibold text-foreground mb-3">{DAY_LABELS[day]}</h3>
                    <div className={`grid grid-cols-1 ${["", "md:grid-cols-1", "md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4"][Math.min(Math.max(mealTypesPresent.length, 1), 4)]} gap-4`}>
                      {meals.map(({ type, item }) => (
                        <div key={type}>
                          <p className="text-xs text-muted-foreground font-medium mb-1">{MEAL_TYPE_LABELS[type]}</p>
                          <p className="text-sm text-foreground">{item!.description}</p>
                          {item!.servings != null && (
                            <p className="text-xs text-muted-foreground mt-1">{item!.servings} servings</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {planItems.length > 0 && (
              compliantPct === 100 ? (
                <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-green-900">CACFP Compliant</p>
                    <p className="text-sm text-green-800">This menu meets all CACFP nutrition requirements for reimbursement.</p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-orange-900">Partially CACFP Compliant</p>
                    <p className="text-sm text-orange-800">{compliantPct}% of menu items meet CACFP nutrition requirements. Review non-compliant items before submission.</p>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* CACFP Reports */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">CACFP Monthly Reports</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Month</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Meals Served</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Reimbursement</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {(cacfpReports ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No CACFP reports yet.</td>
                  </tr>
                )}
                {(cacfpReports ?? []).map((report) => (
                  <tr key={report.id} className="border-b border-border hover:bg-muted transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">{formatMonth(report.reportMonth)}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{(report.mealsServed || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-foreground">{formatMoney(report.reimbursementAmount)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${reportStatusColors[report.status] || "bg-gray-100 text-gray-700"}`}>
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Create New Meal Plan</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Classroom</label>
                    <select value={newClassroomId} onChange={(e) => setNewClassroomId(e.target.value)} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="">Select classroom...</option>
                      {(classrooms ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">Week Starting</label>
                    <input type="date" value={newWeekStart} onChange={(e) => setNewWeekStart(e.target.value)} className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>
                {selectedPlan && planItems.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={copyFromSelected} onChange={(e) => setCopyFromSelected(e.target.checked)} className="rounded border-border text-primary focus:ring-ring" />
                    Copy menu items from selected plan ({formatWeek(selectedPlan.weekStartDate)}, {selectedPlan.classroomName})
                  </label>
                )}
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowModal(false)} className="flex-1 bg-muted hover:bg-muted text-muted-foreground px-4 py-2 rounded-xl transition-colors font-medium">Cancel</button>
                  <button onClick={handleCreatePlan} disabled={createPlan.isPending} className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-4 py-2 rounded-xl transition-colors font-medium">
                    {createPlan.isPending ? "Creating..." : "Create Plan"}
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
