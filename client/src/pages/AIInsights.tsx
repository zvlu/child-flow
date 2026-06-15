import { useState } from "react";
import {
  Sparkles,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  Zap,
  X,
  Filter,
} from "lucide-react";

export function AIInsights() {
  const [insights, setInsights] = useState([
    {
      id: 1,
      childName: "Emma Johnson",
      insightType: "health_alert",
      title: "Immunization Due Soon",
      content:
        "Emma's MMR booster is due in 7 days. Consider scheduling an appointment to avoid any enrollment delays.",
      priority: "high",
      actionRequired: true,
      generatedAt: "2025-01-20 10:30 AM",
    },
    {
      id: 2,
      childName: "Liam Chen",
      insightType: "compliance_flag",
      title: "Missing Parent Conference",
      content:
        "Liam has not had a mid-year parent conference yet. Schedule one before the deadline on February 15th.",
      priority: "critical",
      actionRequired: true,
      generatedAt: "2025-01-20 09:15 AM",
    },
    {
      id: 3,
      childName: "Sophia Rodriguez",
      insightType: "behavioral_note",
      title: "Positive Social Development",
      content:
        "Sophia has shown significant improvement in peer interactions over the past month. Continue current strategies.",
      priority: "low",
      actionRequired: false,
      generatedAt: "2025-01-19 03:45 PM",
    },
    {
      id: 4,
      childName: "Noah Williams",
      insightType: "case_summary",
      title: "Monthly Progress Summary",
      content:
        "Noah has made progress in fine motor skills and language development. Consider introducing more advanced activities.",
      priority: "medium",
      actionRequired: false,
      generatedAt: "2025-01-19 02:20 PM",
    },
    {
      id: 5,
      childName: "Ava Martinez",
      insightType: "recommendation",
      title: "Recommended Assessment",
      content:
        "Based on recent observations, Ava may benefit from a speech and language assessment. Consult with the coordinator.",
      priority: "medium",
      actionRequired: true,
      generatedAt: "2025-01-18 11:00 AM",
    },
  ]);

  const [filterPriority, setFilterPriority] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  const insightTypes = [
    { id: "case_summary", label: "Case Summary", icon: "📋", color: "bg-blue-100 text-blue-600" },
    { id: "compliance_flag", label: "Compliance Flag", icon: "⚠️", color: "bg-red-100 text-red-600" },
    { id: "health_alert", label: "Health Alert", icon: "🏥", color: "bg-green-100 text-green-600" },
    { id: "behavioral_note", label: "Behavioral Note", icon: "👤", color: "bg-purple-100 text-purple-600" },
    { id: "recommendation", label: "Recommendation", icon: "💡", color: "bg-yellow-100 text-yellow-600" },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "border-l-4 border-red-600 bg-red-50";
      case "high":
        return "border-l-4 border-orange-600 bg-orange-50";
      case "medium":
        return "border-l-4 border-yellow-600 bg-yellow-50";
      default:
        return "border-l-4 border-green-600 bg-green-50";
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      critical: "bg-red-100 text-red-700",
      high: "bg-orange-100 text-orange-700",
      medium: "bg-yellow-100 text-yellow-700",
      low: "bg-green-100 text-green-700",
    };
    return colors[priority as keyof typeof colors] || colors.low;
  };

  const getInsightIcon = (type: string) => {
    const insight = insightTypes.find((i) => i.id === type);
    return insight?.icon || "✨";
  };

  const filteredInsights = insights
    .filter((i) => !dismissedIds.includes(i.id))
    .filter((i) => filterPriority === "all" || i.priority === filterPriority)
    .filter((i) => filterType === "all" || i.insightType === filterType);

  const handleDismiss = (id: number) => {
    setDismissedIds([...dismissedIds, id]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-[#4F7C5D]" />
            <h1 className="text-4xl font-bold text-slate-900">AI Insights</h1>
          </div>
          <p className="text-slate-600">
            AI-powered recommendations and alerts for your program
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Total Insights</p>
                <p className="text-2xl font-bold text-slate-900">
                  {filteredInsights.length}
                </p>
              </div>
              <Sparkles className="w-10 h-10 text-[#E7F0E9]" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Action Required</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredInsights.filter((i) => i.actionRequired).length}
                </p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-100" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Critical Priority</p>
                <p className="text-2xl font-bold text-orange-600">
                  {filteredInsights.filter((i) => i.priority === "critical").length}
                </p>
              </div>
              <Zap className="w-10 h-10 text-orange-100" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Priority
              </label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]"
              >
                <option value="all">All Types</option>
                {insightTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Insights List */}
        <div className="space-y-4">
          {filteredInsights.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No insights found
              </h3>
              <p className="text-slate-600">
                All systems are running smoothly!
              </p>
            </div>
          ) : (
            filteredInsights.map((insight) => (
              <div
                key={insight.id}
                className={`rounded-2xl shadow-sm border border-slate-200 p-6 ${getPriorityColor(
                  insight.priority
                )}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">
                        {getInsightIcon(insight.insightType)}
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {insight.title}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {insight.childName}
                        </p>
                      </div>
                    </div>

                    <p className="text-slate-700 mb-3">{insight.content}</p>

                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${getPriorityBadge(
                          insight.priority
                        )}`}
                      >
                        {insight.priority.charAt(0).toUpperCase() +
                          insight.priority.slice(1)}{" "}
                        Priority
                      </span>

                      {insight.actionRequired && (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-700">
                          ⚡ Action Required
                        </span>
                      )}

                      <span className="text-xs text-slate-500 ml-auto">
                        {insight.generatedAt}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDismiss(insight.id)}
                    className="ml-4 p-2 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-[#F1F6F2] border border-[#CFE0D3] rounded-2xl p-6">
          <div className="flex gap-4">
            <Sparkles className="w-6 h-6 text-[#4F7C5D] flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-[#24382B] mb-1">
                How AI Insights Work
              </h3>
              <p className="text-sm text-[#2E4838]">
                Child-flow uses AI to analyze your program data and generate
                actionable insights. Our system monitors compliance deadlines,
                health requirements, developmental milestones, and behavioral
                patterns to help you stay ahead of challenges.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
