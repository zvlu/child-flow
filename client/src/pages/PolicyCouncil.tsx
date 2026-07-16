import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Landmark, Loader2, Plus, Users, CalendarDays, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { dateInputToLocal } from "@/lib/date";

const ROLE_LABELS: Record<string, string> = {
  chair: "Chair",
  vice_chair: "Vice Chair",
  secretary: "Secretary",
  treasurer: "Treasurer",
  member: "Member",
};

export default function PolicyCouncil() {
  const utils = trpc.useUtils();
  const membersQuery = trpc.policyCouncil.members.useQuery({ organizationId: ORGANIZATION_ID });
  const meetingsQuery = trpc.policyCouncil.meetings.useQuery({ organizationId: ORGANIZATION_ID });

  const members = membersQuery.data ?? [];
  const meetings = meetingsQuery.data ?? [];
  const active = members.filter((m) => m.status === "active");
  const parents = active.filter((m) => m.memberType === "parent").length;
  const parentMajority = active.length > 0 && parents > active.length / 2;

  const thisYear = new Date().getFullYear();
  const meetingsThisYear = meetings.filter((m) => new Date(m.meetingDate).getFullYear() === thisYear).length;
  const openActionItems = useMemo(
    () => meetings.reduce((acc, m) => acc + (m.actionItems?.length ?? 0), 0),
    [meetings]
  );

  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddMeeting, setShowAddMeeting] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Policy Council
          </h1>
          <p className="text-sm text-muted-foreground">
            Head Start §1302.50–51 — parent governance body with elected leadership and documented meetings
          </p>
        </div>
      </div>

      {/* Compliance summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><Users className="h-4 w-4" />Active members</CardDescription>
            <CardTitle className="text-3xl">{membersQuery.isLoading ? "—" : active.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{parents} parents · {active.length - parents} community reps</CardContent>
        </Card>
        <Card className={active.length > 0 && !parentMajority ? "border-red-200" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              {parentMajority ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-orange-500" />}
              Parent majority
            </CardDescription>
            <CardTitle className={`text-3xl ${parentMajority ? "text-green-600" : active.length > 0 ? "text-red-600" : ""}`}>
              {active.length > 0 ? `${Math.round((parents / active.length) * 100)}%` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">§1302.50 requires parents hold the majority of seats</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />Meetings in {thisYear}</CardDescription>
            <CardTitle className="text-3xl">{meetingsQuery.isLoading ? "—" : meetingsThisYear}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{meetings.length} total on record</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Action items</CardDescription>
            <CardTitle className="text-3xl">{meetingsQuery.isLoading ? "—" : openActionItems}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Across all recorded meetings</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="meetings">Meetings & Minutes</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" onClick={() => setShowAddMember(true)}>
              <Plus className="h-4 w-4" />Add Member
            </Button>
          </div>
          {membersQuery.isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : members.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No members yet. Add the elected parents and community representatives.
            </CardContent></Card>
          ) : (
            <MemberList members={members} onChanged={() => utils.policyCouncil.members.invalidate()} />
          )}
        </TabsContent>

        <TabsContent value="meetings" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" onClick={() => setShowAddMeeting(true)}>
              <Plus className="h-4 w-4" />Record Meeting
            </Button>
          </div>
          {meetingsQuery.isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : meetings.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No meetings recorded. Minutes and attendance live here for federal review.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{m.title}</h3>
                        {m.quorumMet === 1 ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Quorum met</Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 text-xs">No quorum</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.meetingDate).toLocaleDateString()} · {m.attendeeCount} attendees
                      </span>
                    </div>
                    {m.minutes && <p className="text-sm text-muted-foreground whitespace-pre-line">{m.minutes}</p>}
                    {(m.actionItems?.length ?? 0) > 0 && (
                      <div className="space-y-1 pt-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action items</p>
                        {m.actionItems!.map((a, i) => (
                          <p key={i} className="text-xs text-foreground flex items-start gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />{a}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showAddMember && <AddMemberDialog onClose={(changed) => { setShowAddMember(false); if (changed) utils.policyCouncil.members.invalidate(); }} />}
      {showAddMeeting && <AddMeetingDialog onClose={(changed) => { setShowAddMeeting(false); if (changed) utils.policyCouncil.meetings.invalidate(); }} />}
    </div>
  );
}

function MemberList({
  members,
  onChanged,
}: {
  members: Array<{ id: number; name: string; memberType: string; councilRole: string; status: string; termStart: Date | string | null; termEnd: Date | string | null }>;
  onChanged: () => void;
}) {
  const updateMut = trpc.policyCouncil.updateMember.useMutation({
    onSuccess: onChanged,
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {members.map((m) => (
        <Card key={m.id} className={m.status === "ended" ? "opacity-60" : ""}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{m.name}</p>
                <Badge variant="outline" className="text-xs">{ROLE_LABELS[m.councilRole] ?? m.councilRole}</Badge>
                <Badge
                  className={
                    m.memberType === "parent"
                      ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs"
                      : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-xs"
                  }
                >
                  {m.memberType === "parent" ? "Parent" : "Community Rep"}
                </Badge>
              </div>
              {m.termStart && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Term: {new Date(m.termStart).toLocaleDateString()}
                  {m.termEnd ? ` – ${new Date(m.termEnd).toLocaleDateString()}` : " – present"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {m.status === "active" ? (
                <>
                  <Select
                    value={m.councilRole}
                    onValueChange={(role) => updateMut.mutate({ id: m.id, organizationId: ORGANIZATION_ID, councilRole: role as any })}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm" variant="ghost" className="text-xs text-muted-foreground"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: m.id, organizationId: ORGANIZATION_ID, status: "ended" })}
                  >
                    End term
                  </Button>
                </>
              ) : (
                <Badge variant="secondary" className="text-xs">Term ended</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AddMemberDialog({ onClose }: { onClose: (changed: boolean) => void }) {
  const [name, setName] = useState("");
  const [memberType, setMemberType] = useState<"parent" | "community_rep">("parent");
  const [councilRole, setCouncilRole] = useState("member");
  const [termStart, setTermStart] = useState(new Date().toISOString().slice(0, 10));

  const addMut = trpc.policyCouncil.addMember.useMutation({
    onSuccess: () => { toast.success("Member added"); onClose(true); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Council Member</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={memberType} onValueChange={(v) => setMemberType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parent (enrolled child)</SelectItem>
                  <SelectItem value="community_rep">Community representative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={councilRole} onValueChange={setCouncilRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Term start</Label><Input type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button
              disabled={!name.trim() || addMut.isPending}
              className="gap-2"
              onClick={() =>
                addMut.mutate({
                  organizationId: ORGANIZATION_ID,
                  name: name.trim(),
                  memberType,
                  councilRole: councilRole as any,
                  termStart: dateInputToLocal(termStart),
                })
              }
            >
              {addMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Add Member
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddMeetingDialog({ onClose }: { onClose: (changed: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState("0");
  const [quorum, setQuorum] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");

  const addMut = trpc.policyCouncil.addMeeting.useMutation({
    onSuccess: () => { toast.success("Meeting recorded"); onClose(true); },
    onError: (e) => toast.error(e.message),
  });

  const addItem = () => {
    const v = newItem.trim();
    if (!v) return;
    setActionItems((p) => [...p, v]);
    setNewItem("");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Record a Meeting</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. October Policy Council Meeting" /></div>
          <div className="grid grid-cols-3 gap-4 items-end">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Attendees</Label><Input type="number" min={0} value={attendees} onChange={(e) => setAttendees(e.target.value)} /></div>
            <Button type="button" variant={quorum ? "default" : "outline"} onClick={() => setQuorum(!quorum)} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />{quorum ? "Quorum met" : "Quorum?"}
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Minutes</Label>
            <Textarea rows={4} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Decisions made, votes taken, budget items reviewed…" />
          </div>
          <div className="space-y-2">
            <Label>Action items</Label>
            {actionItems.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="flex-1">{a}</span>
                <button onClick={() => setActionItems((p) => p.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="e.g. Share revised budget with council"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())} />
              <Button type="button" variant="outline" size="icon" onClick={addItem}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button
              disabled={!title.trim() || addMut.isPending}
              className="gap-2"
              onClick={() =>
                addMut.mutate({
                  organizationId: ORGANIZATION_ID,
                  meetingDate: dateInputToLocal(date) ?? new Date(),
                  title: title.trim(),
                  minutes: minutes.trim() || null,
                  attendeeCount: Number(attendees) || 0,
                  quorumMet: quorum,
                  actionItems,
                })
              }
            >
              {addMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save Meeting
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
