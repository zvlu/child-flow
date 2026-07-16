import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red — use for deletes/removals. */
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

/**
 * App-wide confirmation gate for destructive actions, so a single misclick can
 * never delete a family's record. Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete this?", destructive: true })) del.mutate(...)
 */
export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(o) => { if (!o) settle(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts.title ?? "Are you sure?"}</AlertDialogTitle>
            {opts.description && <AlertDialogDescription>{opts.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>{opts.cancelLabel ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => settle(true)}
              className={cn(opts.destructive && "bg-destructive text-white hover:bg-destructive/90")}
            >
              {opts.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
