import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Apple, Moon, Droplet, Sparkles, MessageSquare, Camera, Loader2, Send, ImagePlus, X, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

type ActivityType = "meal" | "nap" | "diaper" | "activity" | "note" | "photo";

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: typeof Apple; tint: string }[] = [
  { value: "meal", label: "Meal", icon: Apple, tint: "text-green-600 bg-green-100" },
  { value: "nap", label: "Nap", icon: Moon, tint: "text-indigo-600 bg-indigo-100" },
  { value: "diaper", label: "Diaper", icon: Droplet, tint: "text-amber-600 bg-amber-100" },
  { value: "activity", label: "Activity", icon: Sparkles, tint: "text-primary bg-primary/10" },
  { value: "note", label: "Note", icon: MessageSquare, tint: "text-blue-600 bg-blue-100" },
  { value: "photo", label: "Photo", icon: Camera, tint: "text-pink-600 bg-pink-100" },
];
const TYPE_META = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.value, t]));

const PLACEHOLDERS: Record<ActivityType, string> = {
  meal: "Ate most of lunch — chicken, rice, and broccoli",
  nap: "Napped from 1:00–2:30 PM",
  diaper: "Diaper changed — dry",
  activity: "Painted at the art table and named every color",
  note: "Had a wonderful day and made a new friend",
  photo: "Caption for today's photo",
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

/** Read an image File and downscale it to a compact JPEG data URL for storage. */
async function fileToDataUrl(file: File, maxDim = 1000, quality = 0.7): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Read a file (e.g. a short video) as a data URL without resizing. */
function fileToDataUrlRaw(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function dayLabel(d: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function DailyReports() {
  const [childId, setChildId] = useState("");
  const [type, setType] = useState<ActivityType>("activity");
  const [description, setDescription] = useState("");
  const [classroomFilter, setClassroomFilter] = useState("all");
  const [feedChild, setFeedChild] = useState("all");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoType, setPhotoType] = useState<"image" | "video">("image");

  const utils = trpc.useUtils();
  const { data: children } = trpc.children.list.useQuery(ORGANIZATION_ID);
  const { data: classroomMap } = trpc.children.classroomMap.useQuery(ORGANIZATION_ID);
  const { data: activities, isLoading } = trpc.parentPortal.activities.useQuery({ organizationId: ORGANIZATION_ID });

  const confirm = useConfirm();
  const deleteMoment = trpc.parentPortal.deleteActivity.useMutation({
    onSuccess: () => {
      utils.parentPortal.activities.invalidate();
      toast.success("Moment removed from the feed");
    },
    onError: (e) => toast.error(e.message || "Couldn't remove that moment"),
  });

  const log = trpc.parentPortal.logActivity.useMutation({
    onSuccess: () => {
      utils.parentPortal.activities.invalidate();
      setDescription("");
      setPhoto(null);
      toast.success("Moment added to the feed");
    },
    onError: (e) => toast.error(e.message || "Couldn't save that moment"),
  });

  const classroomByChild = useMemo(() => {
    const m = new Map<number, string>();
    (classroomMap ?? []).forEach((r: any) => m.set(r.childId, r.classroomName));
    return m;
  }, [classroomMap]);

  const classroomOptions = useMemo(
    () => Array.from(new Set((classroomMap ?? []).map((r: any) => r.classroomName).filter(Boolean))).sort(),
    [classroomMap]
  );

  // Children available to log for, honoring the classroom filter.
  const logChildren = useMemo(
    () => (children ?? []).filter((c: any) => classroomFilter === "all" || classroomByChild.get(c.id) === classroomFilter),
    [children, classroomFilter, classroomByChild]
  );

  const submit = () => {
    if (!childId) { toast.error("Pick a child first"); return; }
    const desc = description.trim() || (type === "photo" && photo ? (photoType === "video" ? "Shared a video" : "Shared a photo") : "");
    if (!desc) { toast.error(type === "photo" ? "Add a photo or a caption" : "Add a short description"); return; }
    log.mutate({
      childId: Number(childId),
      activityType: type,
      description: desc,
      mediaUrl: type === "photo" ? (photo ?? undefined) : undefined,
    });
  };

  // Feed, filtered by classroom + child, grouped by day.
  const grouped = useMemo(() => {
    const rows = (activities ?? []).filter((a: any) => {
      if (feedChild !== "all" && a.childId !== Number(feedChild)) return false;
      if (classroomFilter !== "all" && classroomByChild.get(a.childId) !== classroomFilter) return false;
      return true;
    });
    const byDay = new Map<string, any[]>();
    for (const a of rows) {
      const key = dayLabel(new Date(a.timestamp));
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(a);
    }
    return Array.from(byDay.entries());
  }, [activities, feedChild, classroomFilter, classroomByChild]);

  const todayCount = (activities ?? []).filter((a: any) => dayLabel(new Date(a.timestamp)) === "Today").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Daily Reports</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Log meals, naps, activities and moments — families see them in real time. {todayCount} logged today.
        </p>
      </div>

      {/* Quick log */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={classroomFilter} onValueChange={(v) => { setClassroomFilter(v); setChildId(""); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Classroom" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classrooms</SelectItem>
                {classroomOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Select a child…" /></SelectTrigger>
              <SelectContent>
                {logChildren.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map((t) => {
              const Icon = t.icon;
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"}`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </div>

          {type === "photo" && (
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted/50">
                <ImagePlus className="h-4 w-4" /> {photo ? "Change photo / video" : "Choose photo or video"}
                <input type="file" accept="image/*,video/*" className="hidden" onChange={async (e) => {
                  const input = e.target; const f = input.files?.[0]; input.value = "";
                  if (!f) return;
                  try {
                    if (f.type.startsWith("video/")) { setPhoto(await fileToDataUrlRaw(f)); setPhotoType("video"); }
                    else { setPhoto(await fileToDataUrl(f)); setPhotoType("image"); }
                  } catch { toast.error("Couldn't read that file"); }
                }} />
              </label>
              {photo && (
                <div className="relative">
                  {photoType === "video"
                    ? <video src={photo} className="h-14 w-24 rounded-lg object-cover border border-border" muted />
                    : <img src={photo} alt="preview" className="h-14 w-14 rounded-lg object-cover border border-border" />}
                  <button onClick={() => setPhoto(null)} className="absolute -top-1.5 -right-1.5 bg-background border border-border rounded-full p-0.5 text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder={PLACEHOLDERS[type]}
              className="flex-1"
            />
            <Button onClick={submit} disabled={log.isPending} className="gap-2">
              {log.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feed filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Showing</span>
        <Select value={feedChild} onValueChange={setFeedChild}>
          <SelectTrigger className="w-56 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All children</SelectItem>
            {(children ?? []).map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Live feed */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No moments yet</p>
          <p className="text-sm mt-1">Log the first one above — it appears here and for families instantly.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, rows]) => (
            <div key={day}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{day}</p>
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {rows.map((a: any) => {
                    const meta = TYPE_META[a.activityType] ?? TYPE_META.activity;
                    const Icon = meta.icon;
                    return (
                      <div key={a.id} className="group flex items-start gap-3 p-4">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${meta.tint}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/children/${a.childId}`}
                              className="font-semibold text-sm text-foreground hover:text-primary hover:underline underline-offset-2"
                            >
                              {a.childName}
                            </Link>
                            <Badge variant="secondary" className="text-[10px] uppercase">{meta.label}</Badge>
                          </div>
                          <p className="text-sm text-foreground mt-0.5">{a.description}</p>
                          {a.mediaUrl && (a.mediaType === "video"
                            ? <video src={a.mediaUrl} controls className="mt-2 rounded-lg max-h-56 border border-border" />
                            : <img src={a.mediaUrl} alt="" className="mt-2 rounded-lg max-h-56 border border-border" />)}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(a.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {a.staffName}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remove this moment"
                            className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive transition-opacity"
                            disabled={deleteMoment.isPending}
                            onClick={async () => {
                              if (await confirm({
                                title: "Remove this moment?",
                                description: `It disappears from the feed and from ${a.childName}'s family app immediately.`,
                                destructive: true,
                              })) {
                                deleteMoment.mutate({ id: a.id });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Link href={`/children/${a.childId}`} aria-label={`Open ${a.childName}'s profile`}>
                            <Avatar className="h-7 w-7 transition-transform hover:scale-105">
                              <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-semibold">{initials(a.childName)}</AvatarFallback>
                            </Avatar>
                          </Link>
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
