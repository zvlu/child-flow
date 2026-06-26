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
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";

export function AIInsights() {
  const utils = trpc.useUtils();
  const { data: insights = [], isLoading } = trpc.aiInsights.list.useQuery({ organizationId: ORGANIZATION_ID });
  const dismiss = trpc.aiInsights.dismiss.useMutation({
    onSuccess: () => { utils.aiInsights.list.invalidate(); },
    onError: (e) => toast.error(e.message || "Couldn't dismiss insight"),
  });

  const [filterPriority, setFilterPriority] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const insightTypes = [
    { id: "case_summary", label: "Case Summary", icon: "📋", color: "bg-blue-100 text-blue-600" },
    { id: "compliance_flag", label: "Compliance Flag", icon: "⚠️", color: "bg-red-100 text-red-600" },
    { id: "health_alert", label: "Health Alert", icon: "🏥", color: "bg-green-100 text-green-600" },
    { id: "behavioral_note", label: "Behavioral Note", icon: "👤", color: "bg-purple-100 text-purple-600" },
    { id: "recommendation", label: "Recommendation", icon: "💡", color: "bg-yellow-100 text-yellow-600" },
  ];

  const getPriorityColor = (priority: string | null) => {
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

  const getPriorityBadge = (priority: string | null) => {
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
    .filter((i) => filterPriority === "all" || i.priority === filterPriority)
    .filter((i) => filterType === "all" || i.insightType === filterType);

  const handleDismiss = (id: number) => {
    dismiss.mutate(id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-8 h-8 text-[#4F7C5D]" />
            <h1 className="text-4xl font-bold text-foreground">AI Insights</h1>
          </div>
          <p className="text-muted-foreground">
            AI-powered recommendations and alerts for your program
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-xl shadow-sm border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Insights</p>
                <p className="text-2xl font-bold text-foreground">
                  {filteredInsights.length}
                </p>
              </div>
              <Sparkles className="w-10 h-10 text-[#E7F0E9]" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-sm border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Action Required</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredInsights.filter((i) => i.actionRequired).length}
                </p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-100" />
            </div>
          </div>

          <div className="bg-card rounded-xl shadow-sm border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Critical Priority</p>
                <p className="text-2xl font-bold text-orange-600">
                  {filteredInsights.filter((i) => i.priority === "critical").length}
                </p>
              </div>
              <Zap className="w-10 h-10 text-orange-100" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Priority
              </label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5E8C6A]"
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
            <div className="bg-card rounded-xl shadow-sm border border-border p-12 text-center">
              <Sparkles className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No insights found
              </h3>
              <p className="text-muted-foreground">
                All systems are running smoothly!
              </p>
            </div>
          ) : (
            filteredInsights.map((insight) => (
              <div
                key={insight.id}
                className={`rounded-xl shadow-sm border border-border p-6 ${getPriorityColor(
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
                        <h3 className="text-lg font-semibold text-foreground">
                          {insight.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {insight.childName}
                        </p>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-3">{insight.content}</p>

                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${getPriorityBadge(
                          insight.priority
                        )}`}
                      >
                        {(insight.priority ?? "low").charAt(0).toUpperCase() +
                          (insight.priority ?? "low").slice(1)}{" "}
                        Priority
                      </span>

                      {Number(insight.actionRequired) === 1 && (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-700">
                          ⚡ Action Required
                        </span>
                      )}

                      <span className="text-xs text-muted-foreground ml-auto">
                        {insight.generatedAt ? new Date(insight.generatedAt).toLocaleString() : ""}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDismiss(insight.id)}
                    className="ml-4 p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-[#F1F6F2] border border-[#CFE0D3] rounded-xl p-6">
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
