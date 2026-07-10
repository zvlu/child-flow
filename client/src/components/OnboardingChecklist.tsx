import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ChevronRight, Rocket, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

const DISMISS_KEY = "sprout.onboarding.dismissed";

type Step = {
  key: string;
  label: string;
  detail: string;
  href: string;
  done: boolean;
};

/**
 * First-run setup guide shown at the top of the dashboard until the org has
 * real data in every core area. Progress is detected live from the same
 * queries the rest of the app uses — finish a step anywhere and it checks
 * itself off here. Admins can dismiss it early; that choice sticks per-browser.
 */
export function OnboardingChecklist() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  const { data: children } = trpc.children.list.useQuery(ORGANIZATION_ID);
  const { data: classrooms } = trpc.classrooms.list.useQuery(ORGANIZATION_ID);
  const { data: stats } = trpc.dashboard.stats.useQuery(ORGANIZATION_ID);
  const { data: invitations } = trpc.families.invitations.useQuery(ORGANIZATION_ID);

  // Wait for the core queries before judging progress — otherwise the
  // checklist flashes "0 of 5" at every load.
  const loaded = children !== undefined && classrooms !== undefined && stats !== undefined;
  if (!loaded || dismissed) return null;

  const attendanceRecorded = (stats.attendanceToday.recorded ?? 0) > 0;

  const steps: Step[] = [
    {
      key: "roster",
      label: "Import your roster",
      detail: "Bring over children, families, and health records from one spreadsheet.",
      href: "/data-import",
      done: (children?.length ?? 0) > 0,
    },
    {
      key: "classrooms",
      label: "Set up classrooms",
      detail: "Create your rooms so children and staff can be assigned.",
      href: "/classrooms",
      done: (classrooms?.length ?? 0) > 0,
    },
    {
      key: "staff",
      label: "Add your staff",
      detail: "Teachers and admins get role-based access to exactly what they need.",
      href: "/staff",
      done: (stats.staffCount ?? 0) > 0,
    },
    {
      key: "families",
      label: "Invite families",
      detail: "Send invite codes so parents can join the family app in their language.",
      href: "/children",
      done: (invitations?.length ?? 0) > 0,
    },
    {
      key: "attendance",
      label: "Record attendance",
      detail: "Take your first daily attendance — trends and alerts start here.",
      href: "/attendance",
      done: attendanceRecorded,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const nextStep = steps.find((s) => !s.done);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Rocket className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-base">Get your program set up</CardTitle>
              <CardDescription>
                {doneCount} of {steps.length} steps done
                {nextStep ? <> — next up: {nextStep.label.toLowerCase()}</> : null}
              </CardDescription>
            </div>
          </div>
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss setup checklist">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Progress value={(doneCount / steps.length) * 100} className="mt-2 h-1.5" />
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => (
          <Link key={step.key} href={step.href}>
            <button
              type="button"
              className={`group flex h-full w-full flex-col rounded-lg border p-3 text-left transition-colors ${
                step.done
                  ? "border-transparent bg-transparent opacity-70"
                  : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04]"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={step.done ? "line-through decoration-muted-foreground/50" : undefined}>
                  {step.label}
                </span>
              </span>
              <span className="mt-1 flex-1 text-xs text-muted-foreground">{step.detail}</span>
              {!step.done && (
                <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-primary">
                  Start <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </button>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
