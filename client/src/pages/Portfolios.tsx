import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FolderHeart, Plus, Loader2, Trash2, CalendarDays } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

const DOMAINS = [
  { value: "social_emotional", label: "Social-Emotional", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "language_literacy", label: "Language & Literacy", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "cognition", label: "Cognition", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "physical", label: "Physical", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "creative_arts", label: "Creative Arts", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "approaches_to_learning", label: "Approaches to Learning", color: "bg-teal-100 text-teal-700 border-teal-200" },
];
const DOMAIN_META = Object.fromEntries(DOMAINS.map((d) => [d.value, d]));

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export default function Portfolios() {
  const utils = trpc.useUtils();
  const [childId, setChildId] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [observation, setObservation] = useState("");
  const [domain, setDomain] = useState("");
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 10));

  const { data: children } = trpc.children.list.useQuery(ORGANIZATION_ID);
  const { data: entries, isLoading } = trpc.portfolios.byChild.useQuery(Number(childId), { enabled: !!childId });

  const create = trpc.portfolios.create.useMutation({
    onSuccess: () => {
      utils.portfolios.byChild.invalidate();
      toast.success("Observation added to portfolio");
      setAddOpen(false); setTitle(""); setObservation(""); setDomain("");
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.portfolios.delete.useMutation({
    onSuccess: () => utils.portfolios.byChild.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const confirm = useConfirm();
  const confirmDelete = async (entry: any) => {
    if (await confirm({
      title: "Delete this portfolio entry?",
      description: `"${entry.title}" will be permanently removed from this child's portfolio.`,
      confirmLabel: "Delete",
      destructive: true,
    })) del.mutate(entry.id);
  };

  const childName = useMemo(
    () => (children ?? []).find((c: any) => String(c.id) === childId),
    [children, childId]
  );

  const filtered = (entries ?? []).filter((e: any) => domainFilter === "all" || e.domain === domainFilter);

  const submit = () => {
    if (!childId) { toast.error("Pick a child"); return; }
    if (!title.trim()) { toast.error("Give the observation a title"); return; }
    create.mutate({
      organizationId: ORGANIZATION_ID,
      childId: Number(childId),
      title: title.trim(),
      observation: observation.trim() || undefined,
      domain: (domain || undefined) as any,
      observedAt,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Child Portfolios</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Document each child's growth over time with observations tagged to developmental domains.</p>
        </div>
        <Button size="sm" className="gap-2" disabled={!childId} onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />Add Observation
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={childId} onValueChange={setChildId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select a child to view their portfolio…" /></SelectTrigger>
          <SelectContent>
            {(children ?? []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
        {childId && (
          <Select value={domainFilter} onValueChange={setDomainFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All domains</SelectItem>
              {DOMAINS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {!childId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FolderHeart className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Select a child</p>
          <p className="text-sm mt-1">Choose a child above to view and build their developmental portfolio.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FolderHeart className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No observations yet{childName ? ` for ${childName.firstName}` : ""}</p>
          <p className="text-sm mt-1">Add the first observation to start their portfolio.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((e: any) => {
            const dm = e.domain ? DOMAIN_META[e.domain] : null;
            return (
              <Card key={e.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{e.title}</h3>
                        {dm && <Badge className={`text-[10px] ${dm.color} hover:${dm.color}`}>{dm.label}</Badge>}
                      </div>
                      {e.observation && <p className="text-sm text-muted-foreground mt-1">{e.observation}</p>}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />{fmtDate(e.observedAt ?? e.createdAt)}
                        {e.authorName && (
                          <>
                            <span>·</span>
                            <Avatar className="h-5 w-5"><AvatarFallback className="bg-muted text-[9px] font-semibold">{initials(e.authorName)}</AvatarFallback></Avatar>
                            <span>{e.authorName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button onClick={() => confirmDelete(e)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add observation dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Observation</DialogTitle>
            <DialogDescription>Capture a moment of growth{childName ? ` for ${childName.firstName} ${childName.lastName}` : ""}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Wrote their name independently" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Domain</label>
                <Select value={domain} onValueChange={setDomain}>
                  <SelectTrigger><SelectValue placeholder="Optional…" /></SelectTrigger>
                  <SelectContent>{DOMAINS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Date observed</label>
                <Input type="date" value={observedAt} onChange={(e) => setObservedAt(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Observation</label>
              <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="What did you observe? What does it show about their development?" className="min-h-[90px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Add to Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
