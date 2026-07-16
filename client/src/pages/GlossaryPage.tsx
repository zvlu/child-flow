import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, BookText } from "lucide-react";
import { GLOSSARY } from "@/components/Glossary";

/**
 * A searchable reference of every acronym/term used across the app, in plain
 * English — so staff can look anything up instead of needing training.
 */
export default function GlossaryPage() {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const entries = Object.entries(GLOSSARY)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([k, g]) => !term || k.toLowerCase().includes(term) || g.full.toLowerCase().includes(term) || g.plain.toLowerCase().includes(term));

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Glossary</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Plain-English definitions for the terms you'll see around the app.</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms…" className="pl-9" />
      </div>

      <div className="space-y-3">
        {entries.map(([key, g]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-bold text-foreground">{key}</span>
                <span className="text-sm text-muted-foreground">— {g.full}</span>
              </div>
              <p className="text-sm text-foreground mt-1">{g.plain}</p>
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No terms match "{q}".</p>
        )}
      </div>
    </div>
  );
}
