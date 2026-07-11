import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, LogIn, LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

type ChildRow = { id: number; firstName: string; lastName: string; status: string | null };

function initials(c: ChildRow) {
  return `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
}

function timeOf(d: string | Date | null | undefined) {
  return d ? new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
}

/**
 * Kiosk mode — the tablet at the classroom door. Full-screen, giant touch
 * targets, no app chrome. A staff member signs in once and leaves the page
 * open; parents (or staff at drop-off) tap their child to check in/out.
 * State refreshes every 30s so several door tablets stay in sync.
 */
export default function Kiosk() {
  // Chromeless route (no AppLayout), so gate on auth ourselves — this also
  // guarantees the active-org binding is synced before queries fire.
  const { loading: authLoading, user } = useAuth();

  const [classroomId, setClassroomId] = useState<string>("all");
  const [pending, setPending] = useState<ChildRow | null>(null);
  const [clock, setClock] = useState(new Date());
  const utils = trpc.useUtils();

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ready = !authLoading && !!user;
  const { data: children } = trpc.children.list.useQuery(ORGANIZATION_ID, { refetchInterval: 60_000, enabled: ready });
  const { data: classrooms } = trpc.classrooms.list.useQuery(ORGANIZATION_ID, { enabled: ready });
  const { data: classroomMap } = trpc.children.classroomMap.useQuery(ORGANIZATION_ID, { enabled: ready });
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0); // noon avoids TZ edge cases in the date-range query
    return d;
  }, []);
  const { data: todays } = trpc.attendance.getByDate.useQuery(
    { organizationId: ORGANIZATION_ID, date: today },
    { refetchInterval: 30_000, enabled: ready }
  );

  const mark = trpc.attendance.mark.useMutation({
    onSuccess: (_res, vars) => {
      utils.attendance.getByDate.invalidate();
      const child = (children ?? []).find((c) => c.id === vars.childId);
      const name = child ? child.firstName : "Child";
      toast.success(vars.action === "check_in" ? `${name} checked in — have a great day!` : `${name} checked out — see you tomorrow!`);
      setPending(null);
    },
    onError: (e) => toast.error(e.message || "That didn't save — please try again"),
  });

  const classroomByChild = useMemo(() => {
    const m = new Map<number, { id: number; name: string }>();
    (classroomMap ?? []).forEach((r: any) => m.set(r.childId, { id: r.classroomId, name: r.classroomName }));
    return m;
  }, [classroomMap]);

  const attendanceByChild = useMemo(() => {
    const m = new Map<number, any>();
    (todays ?? []).forEach((a: any) => m.set(a.childId, a));
    return m;
  }, [todays]);

  const roster = useMemo(() => {
    const active = ((children ?? []) as ChildRow[]).filter((c) => c.status === "active");
    const scoped =
      classroomId === "all" ? active : active.filter((c) => classroomByChild.get(c.id)?.id === Number(classroomId));
    return scoped.sort((a, b) => a.firstName.localeCompare(b.firstName));
  }, [children, classroomId, classroomByChild]);

  const checkedIn = roster.filter((c) => {
    const a = attendanceByChild.get(c.id);
    return a?.status === "present" && a?.checkInTime && !a?.checkOutTime;
  }).length;

  const stateOf = (c: ChildRow): "out" | "in" | "done" => {
    const a = attendanceByChild.get(c.id);
    if (!a?.checkInTime) return "out";
    return a.checkOutTime ? "done" : "in";
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Kiosk header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <img src="/brand/logo-mark-192.png" alt="Sprout" className="h-14 w-14 rounded-2xl" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Good morning!</h1>
            <p className="text-sm text-muted-foreground">Tap your child's name to check in or out</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {clock.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
            <p className="text-xs text-muted-foreground">
              {clock.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <Select value={classroomId} onValueChange={setClassroomId}>
            <SelectTrigger className="h-12 w-48 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classrooms</SelectItem>
              {(classrooms ?? []).map((r: any) => (
                <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href="/attendance">
            <Button variant="ghost" size="icon" aria-label="Exit kiosk mode">
              <X className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Roster grid */}
      <main className="flex-1 overflow-y-auto p-6">
        {roster.length === 0 ? (
          <p className="py-20 text-center text-lg text-muted-foreground">No active children in this classroom.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {roster.map((c) => {
              const st = stateOf(c);
              const a = attendanceByChild.get(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPending(c)}
                  className={cn(
                    "flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 transition-all active:scale-95",
                    st === "in" && "border-primary bg-primary/10",
                    st === "done" && "border-border bg-muted opacity-60",
                    st === "out" && "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold",
                      st === "in" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    )}
                  >
                    {initials(c)}
                  </span>
                  <span className="text-center text-base font-semibold leading-tight text-foreground">
                    {c.firstName}
                    <br />
                    {c.lastName}
                  </span>
                  {st === "in" && (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" /> In since {timeOf(a?.checkInTime)}
                    </span>
                  )}
                  {st === "done" && (
                    <span className="text-xs font-medium text-muted-foreground">Out at {timeOf(a?.checkOutTime)}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-card px-6 py-3 text-center text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{checkedIn}</span> of {roster.length} children currently here
      </footer>

      {/* Confirm action */}
      <Dialog open={pending != null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-sm">
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl">
                  {pending.firstName} {pending.lastName}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 pt-2">
                {stateOf(pending) !== "in" ? (
                  <Button
                    size="lg"
                    className="h-16 gap-2 text-lg"
                    disabled={mark.isPending}
                    onClick={() => mark.mutate({ organizationId: ORGANIZATION_ID, childId: pending.id, action: "check_in" })}
                  >
                    <LogIn className="h-5 w-5" /> Check In
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="h-16 gap-2 text-lg"
                    disabled={mark.isPending}
                    onClick={() => mark.mutate({ organizationId: ORGANIZATION_ID, childId: pending.id, action: "check_out" })}
                  >
                    <LogOut className="h-5 w-5" /> Check Out
                  </Button>
                )}
                <Button variant="ghost" size="lg" onClick={() => setPending(null)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
