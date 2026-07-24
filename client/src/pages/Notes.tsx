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

export default function Notes() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const { data: notes, isLoading } = trpc.notes.recent.useQuery({ organizationId: ORGANIZATION_ID });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (notes ?? []).filter((n) => {
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <NotebookPen className="h-6 w-6 text-primary" />
          Notes
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Every case note across children and families, newest first. A note appears here the moment it's submitted.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="child">Children</TabsTrigger>
            <TabsTrigger value="family">Families</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm">
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
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <Card
              key={n.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              role="link"
              tabIndex={0}
              onClick={() => navigate(n.href)}
              onKeyDown={(e) => { if (e.key === "Enter") navigate(n.href); }}
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
          ))}
        </div>
      )}
    </div>
  );
}
