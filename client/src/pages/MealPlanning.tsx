import { useState } from "react";
import { Apple, Plus, Edit2, Trash2, CheckCircle2, Calendar } from "lucide-react";

export function MealPlanning() {
  const [mealPlans, setMealPlans] = useState([
    { id: 1, week: "Jan 20-24", classroom: "Preschool A", status: "approved", mealsServed: 75 },
    { id: 2, week: "Jan 13-17", classroom: "Preschool A", status: "served", mealsServed: 72 },
    { id: 3, week: "Jan 20-24", classroom: "Toddlers B", status: "draft", mealsServed: 0 },
  ]);

  const [selectedPlan, setSelectedPlan] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const mealDetails = {
    1: [
      { day: "Monday", breakfast: "Oatmeal, fruit, milk", lunch: "Chicken, rice, veggies", snack: "Yogurt, crackers" },
      { day: "Tuesday", breakfast: "Pancakes, berries, juice", lunch: "Pasta, sauce, salad", snack: "Cheese, apple" },
      { day: "Wednesday", breakfast: "Eggs, toast, fruit", lunch: "Fish, sweet potato, greens", snack: "Hummus, pita" },
      { day: "Thursday", breakfast: "Cereal, banana, milk", lunch: "Turkey, brown rice, broccoli", snack: "Nuts, raisins" },
      { day: "Friday", breakfast: "Waffles, strawberries, juice", lunch: "Beef, potatoes, carrots", snack: "Fruit, granola" },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Apple className="w-8 h-8 text-teal-600" />
              <h1 className="text-4xl font-bold text-slate-900">CACFP Meal Planning</h1>
            </div>
            <button onClick={() => setShowModal(true)} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
              <Plus className="w-5 h-5" />
              New Meal Plan
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-600 text-sm font-medium">Total Plans</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{mealPlans.length}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-600 text-sm font-medium">Meals Served (This Week)</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{mealPlans.filter(m => m.status === "served").reduce((sum, m) => sum + m.mealsServed, 0)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-600 text-sm font-medium">CACFP Compliant</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">100%</p>
          </div>
        </div>

        {/* Meal Plans */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {mealPlans.map((plan) => (
            <div key={plan.id} onClick={() => setSelectedPlan(plan.id)} className={`rounded-2xl shadow-sm border-2 p-6 cursor-pointer transition-all ${selectedPlan === plan.id ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-300"}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{plan.week}</h3>
                  <p className="text-sm text-slate-600">{plan.classroom}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${plan.status === "approved" ? "bg-green-100 text-green-700" : plan.status === "served" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                  {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                </div>
              </div>
              <p className="text-sm text-slate-600">{plan.mealsServed} meals served</p>
            </div>
          ))}
        </div>

        {/* Meal Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Weekly Menu</h2>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><Edit2 className="w-5 h-5 text-slate-600" /></button>
              <button className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><Trash2 className="w-5 h-5 text-red-600" /></button>
            </div>
          </div>

          <div className="space-y-4">
            {mealDetails[selectedPlan as keyof typeof mealDetails]?.map((meal, idx) => (
              <div key={idx} className="border border-slate-200 rounded-xl p-4">
                <h3 className="font-semibold text-slate-900 mb-3">{meal.day}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-600 font-medium mb-1">BREAKFAST</p>
                    <p className="text-sm text-slate-900">{meal.breakfast}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 font-medium mb-1">LUNCH</p>
                    <p className="text-sm text-slate-900">{meal.lunch}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600 font-medium mb-1">SNACK</p>
                    <p className="text-sm text-slate-900">{meal.snack}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-green-900">CACFP Compliant</p>
              <p className="text-sm text-green-800">This menu meets all CACFP nutrition requirements for reimbursement.</p>
            </div>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Create New Meal Plan</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Classroom</label>
                    <select className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500">
                      <option>Preschool A</option>
                      <option>Toddlers B</option>
                      <option>Infants</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Week Starting</label>
                    <input type="date" className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl transition-colors font-medium">Cancel</button>
                  <button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl transition-colors font-medium">Create Plan</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
