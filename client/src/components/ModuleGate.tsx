import { Button } from "@/components/ui/button";
import { useOrgModules } from "@/hooks/useOrgModules";
import { useAuth } from "@/_core/hooks/useAuth";
import { MODULE_LABELS, type ModuleId } from "@shared/modules";
import { Lock } from "lucide-react";
import { useLocation } from "wouter";

/**
 * Route-level guard for optional feature modules. The server enforces access
 * on every gated procedure; this provides friendly UX for direct links and
 * stale bookmarks instead of a wall of FORBIDDEN toasts.
 */
export default function ModuleGate({ module, children }: { module: ModuleId; children: React.ReactNode }) {
  const { has, isLoading, isError, refetch } = useOrgModules();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) return null;
  if (has(module)) return <>{children}</>;

  // Couldn't load the org at all — don't claim the module is off.
  if (isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-xl font-semibold">Couldn't load your program</h1>
          <p className="text-sm text-muted-foreground">We couldn't check which features are enabled. Check your connection and try again.</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  const isAdmin = (user as any)?.role === "admin";
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-muted p-3">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">{MODULE_LABELS[module]} isn't enabled</h1>
        <p className="text-sm text-muted-foreground">
          This page is part of the {MODULE_LABELS[module]} module, which isn't turned on for your program.
          {isAdmin ? " You can enable it in Settings under Program." : " Ask your program administrator to enable it."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          {isAdmin && <Button onClick={() => navigate("/settings")}>Open Settings</Button>}
        </div>
      </div>
    </div>
  );
}
