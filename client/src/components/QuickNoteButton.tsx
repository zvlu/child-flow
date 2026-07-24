import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotebookPen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

type Priority = "low" | "medium" | "high" | "critical";

/**
 * Global "Quick Note" — capture a case note about any child from anywhere in
 * the app, without navigating to that child's record first. Lives in the app
 * header. On save the note is created and appears immediately in the Notes
 * feed. Part of "case-notes-everywhere".
 */
export function QuickNoteButton() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const { data: children } = trpc.children.list.useQuery(ORGANIZATION_ID, { enabled: open });

  const reset = () => { setChildId(""); setTitle(""); setContent(""); setPriority("medium"); };
  const create = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.recent.invalidate();
      utils.notes.list.invalidate();
      toast.success("Note added", { action: { label: "View notes", onClick: () => navigate("/notes") } });
      setOpen(false);
      reset();
    },
    onError: (e) => toast.error(e.message || "Couldn't add note"),
  });

  // Parents don't file case notes (the server denies it too).
  if (user?.role === "parent") return null;

  const canSave = childId !== "" && Boolean(title.trim()) && Boolean(content.trim());

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setOpen(true)} aria-label="Quick note">
        <NotebookPen className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Note</span>
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quick note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Child</Label>
              <Select value={childId} onValueChange={setChildId}>
                <SelectTrigger><SelectValue placeholder="Select a child" /></SelectTrigger>
                <SelectContent>
                  {(children ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qn-title">Title</Label>
              <Input id="qn-title" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Behavior observation" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qn-content">Note</Label>
              <Textarea id="qn-content" value={content} rows={4} onChange={(e) => setContent(e.target.value)} placeholder="What did you observe?" />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!canSave || create.isPending}
              onClick={() => create.mutate({ organizationId: ORGANIZATION_ID, childId: Number(childId), title: title.trim(), content: content.trim(), priority })}
            >
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
