import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type QueueStatus = "urgent" | "pending" | "completed";

type QueueItem = {
  id: number;
  title: string;
  owner: string;
  area: string;
  due: string;
  status: QueueStatus;
  detail: string;
};

const queueItems: QueueItem[] = [
  {
    id: 1,
    title: "Overdue immunization follow-up",
    owner: "Health Team",
    area: "Health",
    due: "Today",
    status: "urgent",
    detail: "3 children need immediate record updates before compliance cutoff.",
  },
  {
    id: 2,
    title: "Attendance below target review",
    owner: "Program Director",
    area: "Attendance",
    due: "Tomorrow",
    status: "pending",
    detail: "4 children under 85% attendance need intervention notes.",
  },
  {
    id: 3,
    title: "PIR pre-submission checklist",
    owner: "Compliance Lead",
    area: "Compliance",
    due: "This week",
    status: "pending",
    detail: "Validate enrollment and family-services snapshots.",
  },
  {
    id: 4,
    title: "Family outreach callbacks",
    owner: "Family Services",
    area: "Services",
    due: "Completed",
    status: "completed",
    detail: "All callback tasks from last week were resolved.",
  },
];

const statusMeta: Record<QueueStatus, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700 border-red-200" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 border-amber-200" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
};

export function ActionQueue() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatus | "all">("all");

  const filteredItems = useMemo(() => {
    return queueItems.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        item.title.toLowerCase().includes(q) ||
        item.owner.toLowerCase().includes(q) ||
        item.area.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter]);

  const urgentCount = queueItems.filter((i) => i.status === "urgent").length;
  const pendingCount = queueItems.filter((i) => i.status === "pending").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Action Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prioritized work items linked to dashboard health, attendance, and compliance metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            {urgentCount} urgent
          </Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            {pendingCount} pending
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex gap-3 flex-wrap">
          <div className="relative min-w-[260px] flex-1">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, owner, area, or detail"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["all", "urgent", "pending", "completed"] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        {filteredItems.map((item) => (
          <Card key={item.id} className="transition-shadow hover:shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{item.title}</CardTitle>
                <Badge variant="outline" className={statusMeta[item.status].className}>
                  {statusMeta[item.status].label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{item.detail}</p>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{item.area}</span> · {item.owner}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {item.status === "urgent" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  ) : item.status === "pending" ? (
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  )}
                  {item.due}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
