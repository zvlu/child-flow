import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One consistent, friendly "nothing here yet" block. Mirrors the empty-state
 * pattern already used across the app (centered faded icon + title + plain
 * one-liner), so staff never hit a blank screen wondering what to do. Pass an
 * `action` (usually the same button that creates the first record) to turn the
 * dead end into a next step.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-14 px-6", className)}>
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground/60" />
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
