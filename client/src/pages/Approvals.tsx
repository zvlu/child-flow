import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Loader2, ClipboardCheck, UserPlus, ShieldCheck, UserCog, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useIsAdmin } from "@/_core/hooks/useIsAdmin";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/date";

type ApprovalStatus = "pending" | "approved" | "denied";

const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  custom_role: { label: "New role", icon: ShieldCheck },
  staff_hire: { label: "New hire", icon: UserPlus },
  staff_role_change: { label: "Role change", icon: UserCog },
};

/** Friendly title/detail from a request's type + its parked JSON payload. */
function describe(type: string, payloadRaw: string): { title: string; detail: string } {
  let p: Record<string, unknown> = {};
  try { p = JSON.parse(payloadRaw) as Record<string, unknown>; } catch { /* leave empty */ }
  switch (type) {
    case "custom_role":
      return { title: String(p.name ?? "New role"), detail: `${String(p.accessLevel ?? "staff")}-access role` };
    case "staff_hire":
      return { title: `${String(p.firstName ?? "")} ${String(p.lastName ?? "")}`.trim() || "New hire", detail: `role: ${String(p.role ?? "teacher")}` };
    case "staff_role_change":
      return { title: "Role / access change", detail: p.role ? `new role: ${String(p.role)}` : "custom role change" };
    default:
      return { title: "Request", detail: type };
  }
}

export default function Approvals() {
  const isAdmin = useIsAdmin();
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const [status, setStatus] = useState<ApprovalStatus>("pending");

  const { data: rows, isLoading } = trpc.approvals.list.useQuery({ organizationId: ORGANIZATION_ID, status });

  const approve = trpc.approvals.approve.useMutation({
    onSuccess: () => {
      utils.approvals.list.invalidate();
      utils.staff.list.invalidate();
      utils.roles.list.invalidate();
      toast.success("Request approved");
    },
    onError: (e) => toast.error(e.message || "Could not approve"),
  });
  const deny = trpc.approvals.deny.useMutation({
    onSuccess: () => { utils.approvals.list.invalidate(); toast.success("Request denied"); },
    onError: (e) => toast.error(e.message || "Could not deny"),
  });

  const list = rows ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          Approvals
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {isAdmin
            ? "Requests from managers awaiting your sign-off — hires, role changes, and new admin-access roles."
            : "The status of requests you've submitted for approval."}
        </p>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as ApprovalStatus)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="denied">Denied</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No {status} requests.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const meta = TYPE_META[r.type] ?? { label: r.type, icon: ClipboardCheck };
            const Icon = meta.icon;
            const { title, detail } = describe(r.type, r.payload);
            return (
              <Card key={r.id}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">{title}</span>
                      <Badge variant="secondary" className="shrink-0">{meta.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{detail}</p>
                    {r.requestReason && <p className="text-xs text-muted-foreground mt-1 italic">“{r.requestReason}”</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">Submitted {formatDate(r.createdAt)}</p>
                    {r.status !== "pending" && r.decisionNote && (
                      <p className="text-xs text-muted-foreground mt-0.5">Note: {r.decisionNote}</p>
                    )}
                  </div>
                  {r.status === "pending" && isAdmin ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deny.isPending}
                        onClick={async () => {
                          if (await confirm({ title: "Deny this request?", description: "The change won't be applied.", confirmLabel: "Deny", destructive: true })) {
                            deny.mutate({ id: r.id, organizationId: ORGANIZATION_ID });
                          }
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />Deny
                      </Button>
                      <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate({ id: r.id, organizationId: ORGANIZATION_ID })}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Approve
                      </Button>
                    </div>
                  ) : (
                    <Badge
                      variant="secondary"
                      className={`shrink-0 ${r.status === "approved" ? "bg-green-100 text-green-700" : r.status === "denied" ? "bg-red-100 text-red-700" : ""}`}
                    >
                      {r.status}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
