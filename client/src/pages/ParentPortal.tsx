import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Apple, Moon, Droplet, Sparkles, MessageSquare, Camera, Bell, Loader2, Heart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const TYPE_META: Record<string, { icon: typeof Apple; tint: string; label: string }> = {
  meal: { icon: Apple, tint: "text-green-600 bg-green-100", label: "Meal" },
  nap: { icon: Moon, tint: "text-indigo-600 bg-indigo-100", label: "Nap" },
  diaper: { icon: Droplet, tint: "text-amber-600 bg-amber-100", label: "Diaper" },
  activity: { icon: Sparkles, tint: "text-primary bg-primary/10", label: "Activity" },
  note: { icon: MessageSquare, tint: "text-blue-600 bg-blue-100", label: "Note" },
  photo: { icon: Camera, tint: "text-pink-600 bg-pink-100", label: "Photo" },
};

function dayLabel(d: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function ParentPortal() {
  const { user } = useAuth();
  const isParent = user?.role === "parent";

  const { data: activities, isLoading } = trpc.parentPortal.myActivities.useQuery(undefined, { enabled: isParent });
  const { data: notifications } = trpc.parentPortal.myNotifications.useQuery(undefined, { enabled: isParent });

  const grouped = useMemo(() => {
    const byDay = new Map<string, NonNullable<typeof activities>>();
    for (const a of activities ?? []) {
      const key = dayLabel(new Date(a.timestamp));
      if (!byDay.has(key)) byDay.set(key, [] as any);
      byDay.get(key)!.push(a);
    }
    return Array.from(byDay.entries());
  }, [activities]);

  const unread = (notifications ?? []).filter((n) => n.isRead === 0);

  // Staff/admin previewing the page (no familyId) — the parent routes are
  // parent-only, so show a friendly explanation instead of an error.
  if (!isParent) {
    return (
      <div className="p-6">
        <Card className="max-w-xl mx-auto mt-10">
          <CardContent className="p-8 text-center">
            <Heart className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-foreground">Family View</h1>
            <p className="text-muted-foreground text-sm mt-2">
              This is the live daily report families see — meals, naps, activities and photos as staff log them.
              Sign in with a family account to view a child's day. Staff log moments from <span className="font-medium text-foreground">Daily Reports</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Your Family's Day</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      {unread.length > 0 && (
        <div className="space-y-2">
          {unread.map((n) => (
            <Card key={n.id} className="border-primary/20 bg-primary/5">
              <CardContent className="p-3 flex items-start gap-3">
                <Bell className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{n.message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No moments yet today</p>
          <p className="text-sm mt-1">Your child's teachers will share meals, naps, and activities here.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, rows]) => (
            <div key={day}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{day}</p>
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {rows.map((a) => {
                    const meta = TYPE_META[a.activityType] ?? TYPE_META.activity;
                    const Icon = meta.icon;
                    return (
                      <div key={a.id} className="flex items-start gap-3 p-4">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${meta.tint}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">{a.childName}</span>
                            <Badge variant="secondary" className="text-[10px] uppercase">{meta.label}</Badge>
                          </div>
                          <p className="text-sm text-foreground mt-0.5">{a.description}</p>
                          {(() => {
                            const m = a as { mediaUrl?: string | null; mediaType?: string | null };
                            if (!m.mediaUrl) return null;
                            return m.mediaType === "video"
                              ? <video src={m.mediaUrl} controls className="mt-2 rounded-lg max-h-64 border border-border" />
                              : <img src={m.mediaUrl} alt="" className="mt-2 rounded-lg max-h-64 border border-border" />;
                          })()}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(a.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {a.staffName}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
