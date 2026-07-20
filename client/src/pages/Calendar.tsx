import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight,
  Clock, MapPin, AlertCircle, Edit, Trash2, MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  eventType: "holiday" | "school_event" | "parent_event" | "staff_training" | "deadline" | "other";
  startDate: Date;
  endDate?: Date;
  location?: string;
  allDay: boolean;
  color: string;
}

type ViewMode = "month" | "week" | "day";
const EVENT_TYPES = ["holiday", "school_event", "parent_event", "staff_training", "deadline", "other"] as const;
const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const emptyForm = { title: "", eventType: "school_event", date: "", location: "", description: "" };

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfWeek = (d: Date) => {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
};

const eventTypeColor = (type: string) => {
  switch (type) {
    case "holiday": return "bg-red-100 text-red-700 border-red-200";
    case "school_event": return "bg-green-100 text-green-700 border-green-200";
    case "parent_event": return "bg-amber-100 text-amber-700 border-amber-200";
    case "staff_training": return "bg-purple-100 text-purple-700 border-purple-200";
    case "deadline": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-blue-100 text-blue-700 border-blue-200";
  }
};
const eventTypeLabel = (type: string) => type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const utils = trpc.useUtils();

  const { data: rawEvents = [] } = trpc.calendar.list.useQuery(ORGANIZATION_ID);
  const events: CalendarEvent[] = (rawEvents as any[]).map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description ?? "",
    eventType: e.eventType ?? "other",
    startDate: new Date(e.startDate),
    endDate: e.endDate ? new Date(e.endDate) : undefined,
    location: e.location ?? undefined,
    allDay: e.allDay === 1,
    color: e.color ?? "#3b82f6",
  }));

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => utils.calendar.list.invalidate(ORGANIZATION_ID);
  const createEvent = trpc.calendar.create.useMutation({
    onSuccess: () => { invalidate(); toast.success("Event created"); closeDialog(); },
    onError: (err) => toast.error(err.message || "Couldn't create event"),
  });
  const updateEvent = trpc.calendar.update.useMutation({
    onSuccess: () => { invalidate(); toast.success("Event updated"); closeDialog(); },
    onError: (err) => toast.error(err.message || "Couldn't update event"),
  });
  const deleteEvent = trpc.calendar.delete.useMutation({
    onSuccess: () => { invalidate(); toast.success("Event deleted"); closeDialog(); },
    onError: (err) => toast.error(err.message || "Couldn't delete event"),
  });
  const confirm = useConfirm();
  const confirmDeleteEvent = async (id: number, title?: string) => {
    if (await confirm({
      title: "Delete this event?",
      description: title ? `"${title}" will be removed from the calendar.` : "This event will be removed from the calendar.",
      confirmLabel: "Delete",
      destructive: true,
    })) deleteEvent.mutate(id);
  };

  const closeDialog = () => { setShowDialog(false); setEditingId(null); setForm(emptyForm); };
  const openCreate = (date?: Date) => {
    setEditingId(null);
    setForm({ ...emptyForm, date: date ? toISODate(date) : toISODate(new Date()) });
    setShowDialog(true);
  };
  const openEdit = (ev: CalendarEvent) => {
    setEditingId(ev.id);
    setForm({ title: ev.title, eventType: ev.eventType, date: toISODate(ev.startDate), location: ev.location ?? "", description: ev.description ?? "" });
    setShowDialog(true);
  };
  const submit = () => {
    if (!form.title.trim() || !form.date) { toast.error("Title and date are required"); return; }
    const startDate = new Date(`${form.date}T09:00:00`);
    const common = {
      title: form.title.trim(),
      eventType: form.eventType as (typeof EVENT_TYPES)[number],
      startDate,
      location: form.location.trim() || undefined,
      description: form.description.trim() || undefined,
    };
    if (editingId) updateEvent.mutate({ id: editingId, ...common });
    else createEvent.mutate({ organizationId: ORGANIZATION_ID, ...common });
  };

  const shift = (dir: number) => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const eventsForDate = (date: Date) =>
    events.filter((e) => sameDay(e.startDate, date)).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const headerLabel = () => {
    if (view === "month") return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === "day") return currentDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
    const s = startOfWeek(currentDate); const e = new Date(s); e.setDate(e.getDate() + 6);
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  // ---- Event chip (clickable) ----
  const EventChip = ({ ev, dense }: { ev: CalendarEvent; dense?: boolean }) => (
    <button
      onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
      className={`block w-full text-left ${dense ? "text-[10px] px-2 py-1" : "text-xs px-2 py-1.5"} font-bold rounded-md truncate border hover:brightness-95 transition ${eventTypeColor(ev.eventType)}`}
      title={ev.title}
    >
      {!dense && !ev.allDay && <span className="opacity-70 mr-1">{ev.startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
      {ev.title}
    </button>
  );

  // ---- Month grid ----
  const renderMonth = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    return (
      <>
        <div className="grid grid-cols-7 gap-2 mb-4">
          {daysOfWeek.map((d) => (
            <div key={d} className="text-center font-bold text-muted-foreground text-sm uppercase tracking-widest py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((date, i) => {
            const dayEvents = date ? eventsForDate(date) : [];
            const isToday = date && sameDay(date, new Date());
            return (
              <div
                key={i}
                onClick={() => date && openCreate(date)}
                className={`rounded-xl border-2 min-h-[120px] p-2 transition-all ${
                  date ? (isToday ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted cursor-pointer") : "border-transparent bg-muted"
                }`}
              >
                {date && (
                  <div className="space-y-1">
                    <p className={`font-bold text-sm ${isToday ? "text-primary" : "text-muted-foreground"}`}>{date.getDate()}</p>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((ev) => <EventChip key={ev.id} ev={ev} dense />)}
                      {dayEvents.length > 3 && <div className="text-[9px] font-bold text-muted-foreground px-2">+{dayEvents.length - 3} more</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // ---- Week view ----
  const renderWeek = () => {
    const s = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d; });
    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map((date) => {
          const dayEvents = eventsForDate(date);
          const isToday = sameDay(date, new Date());
          return (
            <div key={date.toISOString()} onClick={() => openCreate(date)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCreate(date); } }}
              aria-label={`Add event on ${date.toLocaleDateString()}`}
              className={`rounded-xl border-2 min-h-[360px] p-2 cursor-pointer transition-all ${isToday ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted"}`}>
              <p className={`text-center font-bold text-xs uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}>{daysOfWeek[date.getDay()]}</p>
              <p className={`text-center font-bold text-lg mb-2 ${isToday ? "text-primary" : "text-muted-foreground"}`}>{date.getDate()}</p>
              <div className="space-y-1">
                {dayEvents.map((ev) => <EventChip key={ev.id} ev={ev} dense />)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ---- Day view ----
  const renderDay = () => {
    const dayEvents = eventsForDate(currentDate);
    return (
      <div className="space-y-2" onClick={() => openCreate(currentDate)}>
        {dayEvents.length === 0 ? (
          <div
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCreate(currentDate); } }}
            aria-label={`Add event on ${currentDate.toLocaleDateString()}`}
            className="py-16 text-center cursor-pointer">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-bold">No events — click to add one</p>
          </div>
        ) : (
          dayEvents.map((ev) => (
            <button key={ev.id} onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
              className={`w-full text-left p-4 rounded-xl border-2 hover:shadow-sm transition ${eventTypeColor(ev.eventType)}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold">{ev.title}</span>
                <Badge className={`${eventTypeColor(ev.eventType)} rounded-full text-[10px] font-bold`}>{eventTypeLabel(ev.eventType)}</Badge>
              </div>
              <div className="text-xs font-bold opacity-75 mt-1 flex gap-3">
                {!ev.allDay && <span>{ev.startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
                {ev.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.location}</span>}
              </div>
              {ev.description && <p className="text-xs opacity-80 mt-1">{ev.description}</p>}
            </button>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Program Calendar</h1>
            <p className="text-sm text-muted-foreground font-medium">Track school events, holidays, and important dates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex rounded-full bg-muted p-1">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-full text-sm font-bold capitalize transition ${view === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-muted-foreground"}`}>
                {v}
              </button>
            ))}
          </div>
          <Button onClick={() => openCreate()} className="rounded-full gap-2 shadow-md hover:shadow-lg transition-all font-bold">
            <Plus className="h-4 w-4" /> New Event
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main calendar */}
        <div className="lg:col-span-2">
          <Card className="rounded-xl border-border shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border bg-gradient-to-r from-background to-muted/50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-foreground">{headerLabel()}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())} className="rounded-lg font-bold text-xs hover:bg-muted">Today</Button>
                  <Button variant="ghost" size="icon" onClick={() => shift(-1)} className="rounded-lg h-9 w-9 hover:bg-muted"><ChevronLeft className="h-5 w-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => shift(1)} className="rounded-lg h-9 w-9 hover:bg-muted"><ChevronRight className="h-5 w-5" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {view === "month" && renderMonth()}
              {view === "week" && renderWeek()}
              {view === "day" && renderDay()}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming sidebar */}
        <div className="space-y-6">
          <Card className="rounded-xl border-border shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border bg-gradient-to-r from-background to-muted/50 pb-3">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {events.filter((e) => e.startDate >= new Date(new Date().setHours(0, 0, 0, 0))).sort((a, b) => a.startDate.getTime() - b.startDate.getTime()).slice(0, 8).map((ev) => (
                <div key={ev.id} className="p-3 rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all group cursor-pointer" onClick={() => openEdit(ev)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{ev.title}</p>
                      <Badge className={`${eventTypeColor(ev.eventType)} rounded-full text-[10px] font-bold mt-1`}>{eventTypeLabel(ev.eventType)}</Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="rounded-lg h-7 w-7 text-muted-foreground hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem className="rounded-lg font-bold gap-2" onClick={() => openEdit(ev)}><Edit className="h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg font-bold gap-2 text-red-600" onClick={() => confirmDeleteEvent(ev.id, ev.title)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1 text-[11px] font-bold text-muted-foreground">
                    <div className="flex items-center gap-1.5"><CalendarIcon className="h-3 w-3" />{ev.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    {ev.location && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {ev.location}</div>}
                  </div>
                  {ev.description && <p className="text-[10px] text-muted-foreground font-medium mt-2 line-clamp-2">{ev.description}</p>}
                </div>
              ))}
              {events.filter((e) => e.startDate >= new Date(new Date().setHours(0, 0, 0, 0))).length === 0 && (
                <div className="py-8 text-center"><AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground font-bold">No upcoming events</p></div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border bg-gradient-to-r from-background to-muted/50 pb-3">
              <CardTitle className="text-sm font-bold text-foreground uppercase tracking-widest">Event Types</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {[{ type: "holiday", label: "Holiday" }, { type: "school_event", label: "School Event" }, { type: "parent_event", label: "Parent Event" }, { type: "staff_training", label: "Staff Training" }, { type: "deadline", label: "Deadline" }].map((item) => (
                <div key={item.type} className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${item.type === "holiday" ? "bg-red-500" : item.type === "school_event" ? "bg-green-500" : item.type === "parent_event" ? "bg-amber-500" : item.type === "staff_training" ? "bg-purple-500" : "bg-red-500"}`} />
                  <span className="text-sm font-bold text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => (o ? setShowDialog(true) : closeDialog())}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">Title</Label>
              <Input id="ev-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Fall Festival" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{eventTypeLabel(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-date">Date</Label>
                <Input id="ev-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-loc">Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="ev-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Playground" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="ev-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
          </div>
          <div className="flex justify-between gap-2 mt-2">
            <div>
              {editingId && (
                <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => confirmDeleteEvent(editingId, form.title)} disabled={deleteEvent.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={submit} disabled={createEvent.isPending || updateEvent.isPending}>
                {editingId ? (updateEvent.isPending ? "Saving…" : "Save Changes") : (createEvent.isPending ? "Creating…" : "Create Event")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
