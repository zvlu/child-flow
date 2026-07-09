import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Clock, Filter, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";

type QueueStatus = "urgent" | "pending" | "completed";

type QueueItem = {
  id: string;
  title: string;
  owner: string;
  area: string;
  due: string;
  status: QueueStatus;
  detail: string;
  href?: string;
  insightId?: number;
};

const statusMeta: Record<QueueStatus, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700 border-red-200" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700 border-amber-200" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700 border-green-200" },
};

function formatTypeLabel(type: string) {
  return type
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "No due date";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ActionQueue() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatus | "all">("all");

  const { data: followUps, isLoading: followUpsLoading } = trpc.health.followUps.useQuery({
    organizationId: ORGANIZATION_ID,
  });
  const { data: insights, isLoading: insightsLoading } = trpc.aiInsights.list.useQuery({
    organizationId: ORGANIZATION_ID,
  });
  const { data: documents, isLoading: documentsLoading } = trpc.digitalDocuments.list.useQuery(ORGANIZATION_ID);
  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID);
  const { data: certifications, isLoading: certsLoading } = trpc.staffOps.certifications.useQuery(ORGANIZATION_ID);

  const isLoading = followUpsLoading || insightsLoading || documentsLoading || certsLoading;

  const utils = trpc.useUtils();
  const dismissInsight = trpc.aiInsights.dismiss.useMutation({
    onSuccess: () => {
      utils.aiInsights.list.invalidate();
      toast.success("Insight marked as resolved");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to resolve insight");
    },
  });

  const queueItems = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];

    // Health follow-ups: overdue and due-soon screenings/immunizations.
    for (const fu of followUps ?? []) {
      items.push({
        id: `health-${fu.recordId}`,
        title: `${formatTypeLabel(fu.type)} follow-up — ${fu.childName}`,
        owner: fu.childName,
        area: "Health",
        due:
          fu.severity === "overdue"
            ? `Overdue (was due ${formatDate(fu.expiryDate)})`
            : `Due ${formatDate(fu.expiryDate)} (${fu.daysUntilDue} days)`,
        status: fu.severity === "overdue" ? "urgent" : "pending",
        detail: fu.message || `${formatTypeLabel(fu.type)} record needs attention before the compliance cutoff.`,
        href: "/health",
      });
    }

    // AI insights flagged as requiring action.
    for (const ins of insights ?? []) {
      if (ins.actionRequired !== 1) continue;
      items.push({
        id: `insight-${ins.id}`,
        title: ins.title,
        owner: ins.childName ?? "Program-wide",
        area: "AI Insight",
        due: `Flagged ${formatDate(ins.generatedAt)}`,
        status: ins.priority === "critical" || ins.priority === "high" ? "urgent" : "pending",
        detail: ins.content,
        insightId: ins.id,
      });
    }

    // Digital documents: pending or expired signatures; signed show as completed.
    const familyById = new Map((families ?? []).map((f) => [f.id, f]));
    for (const doc of documents ?? []) {
      const familyName = familyById.get(doc.familyId)?.primaryContactName ?? `Family #${doc.familyId}`;
      if (doc.status === "pending" || doc.status === "expired") {
        items.push({
          id: `doc-${doc.id}`,
          title: `${formatTypeLabel(doc.documentType)} signature ${doc.status === "expired" ? "expired" : "needed"} — ${familyName}`,
          owner: familyName,
          area: "Documents",
          due: doc.expiresAt ? `Expires ${formatDate(doc.expiresAt)}` : "No expiration",
          status: doc.status === "expired" ? "urgent" : "pending",
          detail:
            doc.status === "expired"
              ? `The ${formatTypeLabel(doc.documentType)} document expired and must be re-sent for signature.`
              : `The ${formatTypeLabel(doc.documentType)} document is awaiting a signature from ${familyName}.`,
          href: "/digital-documents",
        });
      } else if (doc.status === "signed") {
        items.push({
          id: `doc-${doc.id}`,
          title: `${formatTypeLabel(doc.documentType)} signed — ${familyName}`,
          owner: familyName,
          area: "Documents",
          due: doc.signedBy ? `Signed by ${doc.signedBy}` : "Signed",
          status: "completed",
          detail: `The ${formatTypeLabel(doc.documentType)} document has been completed.`,
          href: "/digital-documents",
        });
      }
    }

    // Staff certifications: expired or expiring within 60 days need renewal.
    for (const cert of certifications ?? []) {
      if (cert.status === "active") continue;
      items.push({
        id: `cert-${cert.id}`,
        title: `${cert.certificationType} ${cert.status === "expired" ? "expired" : "expiring soon"} — ${cert.staffName}`,
        owner: cert.staffName,
        area: "Staff",
        due:
          cert.status === "expired"
            ? `Expired ${formatDate(cert.expiryDate)}`
            : `Expires ${formatDate(cert.expiryDate)}`,
        status: cert.status === "expired" ? "urgent" : "pending",
        detail:
          cert.status === "expired"
            ? `${cert.staffName}'s ${cert.certificationType} certification has expired and needs renewal.`
            : `${cert.staffName}'s ${cert.certificationType} certification expires soon — renew before it lapses.`,
        href: "/staff-operations",
      });
    }

    const rank: Record<QueueStatus, number> = { urgent: 0, pending: 1, completed: 2 };
    return items.sort((a, b) => rank[a.status] - rank[b.status]);
  }, [followUps, insights, documents, families, certifications]);

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
  }, [queueItems, search, statusFilter]);

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

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {queueItems.length === 0
              ? "Nothing in the queue — all caught up!"
              : "No items match the current search or filter."}
          </CardContent>
        </Card>
      ) : (
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
                  <div className="flex items-center gap-3">
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
                    {item.insightId != null && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={dismissInsight.isPending}
                        onClick={() => dismissInsight.mutate(item.insightId!)}
                      >
                        {dismissInsight.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Mark Resolved"
                        )}
                      </Button>
                    )}
                    {item.href && (
                      <Link href={item.href}>
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
