import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ChevronRight, Rocket, X } from "lucide-react";
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
      <CardContent className="space-y-1.5">
        {steps.map((step, i) => (
          <Link key={step.key} href={step.href} asChild>
            <a
              className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                step.done
                  ? "border-transparent opacity-60"
                  : "border-border bg-card hover:border-primary/40 hover:bg-primary/[0.04]"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                }`}
              >
                {step.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{step.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{step.detail}</span>
              </span>
              {!step.done && (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary">
                  Start
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </a>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
