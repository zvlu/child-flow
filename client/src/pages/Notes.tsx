import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotebookPen, Search, Loader2, Baby, Users, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { formatDate } from "@/lib/date";

type Filter = "all" | "child" | "family";
type GroupBy = "recent" | "person" | "date";

interface NoteItem {
  id: string;
  kind: "child" | "family";
  subjectId: number;
  subjectName: string;
  title: string;
  body: string;
  tag: string | null;
  priority: string | null;
  confidentiality: "standard" | "sensitive";
  author: string | null;
  createdAt: Date;
  href: string;
}

/** Friendly day bucket for date grouping. */
function dayLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Earlier this week";
  if (diff < 30) return "Earlier this month";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function NoteCard({ n, onOpen }: { n: NoteItem; onOpen: (href: string) => void }) {
  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={() => onOpen(n.href)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(n.href); }}
    >
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${n.kind === "child" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
            {n.kind === "child" ? <Baby className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground truncate">{n.subjectName}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-sm text-foreground/80 truncate capitalize">{n.title}</span>
              {n.priority && ["high", "critical"].includes(n.priority) && (
                <Badge variant="secondary" className={n.priority === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                  {n.priority}
                </Badge>
              )}
              {n.confidentiality === "sensitive" && (
                <Badge variant="secondary" className="gap-1 bg-red-50 text-red-600"><Lock className="h-3 w-3" />Sensitive</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {n.author ? `${n.author} · ` : ""}{formatDate(n.createdAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Notes() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<Filter>("all");
  const [group, setGroup] = useState<GroupBy>("recent");
  const [search, setSearch] = useState("");

  const { data: notes, isLoading } = trpc.notes.recent.useQuery({ organizationId: ORGANIZATION_ID });

  const filtered = useMemo<NoteItem[]>(() => {
    const q = search.trim().toLowerCase();
    return ((notes ?? []) as NoteItem[]).filter((n) => {
      if (filter !== "all" && n.kind !== filter) return false;
      if (!q) return true;
      return (
        n.subjectName.toLowerCase().includes(q) ||
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        (n.author ?? "").toLowerCase().includes(q)
      );
    });
  }, [notes, filter, search]);

  // Sectioned view for the "organized" group modes. Person → alphabetical by
  // subject; Date → newest day-buckets first (filtered is already newest-first).
  const sections = useMemo(() => {
    if (group === "recent") return null;
    const map = new Map<string, NoteItem[]>();
    for (const n of filtered) {
      const key = group === "person" ? n.subjectName : dayLabel(new Date(n.createdAt));
      const arr = map.get(key);
      if (arr) arr.push(n);
      else map.set(key, [n]);
    }
    const entries = Array.from(map.entries()).map(([label, items]) => ({ label, items }));
    return group === "person" ? entries.sort((a, b) => a.label.localeCompare(b.label)) : entries;
  }, [filtered, group]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <NotebookPen className="h-6 w-6 text-primary" />
          Notes
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Every case note across children and families. Browse the live feed, or organize by person or date.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="child">Children</TabsTrigger>
              <TabsTrigger value="family">Families</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={group} onValueChange={(v) => setGroup(v as GroupBy)}>
            <TabsList>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="person">By person</TabsTrigger>
              <TabsTrigger value="date">By date</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search notes, people, authors…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          {(notes?.length ?? 0) === 0 ? "No notes yet. Add one from any child or family record." : "No notes match your search."}
        </CardContent></Card>
      ) : sections ? (
        <div className="space-y-6">
          {sections.map((s) => (
            <div key={s.label} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {s.label} <span className="text-muted-foreground/60">· {s.items.length}</span>
              </h3>
              {s.items.map((n) => <NoteCard key={n.id} n={n} onOpen={navigate} />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => <NoteCard key={n.id} n={n} onOpen={navigate} />)}
        </div>
      )}
    </div>
  );
}
