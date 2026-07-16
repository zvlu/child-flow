import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, MessageSquare, Mail, Plus,
  MoreHorizontal, Send, User, Clock,
  Archive, Reply, Forward,
  Megaphone,
  History as HistoryIcon, Smartphone
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useOrgModules } from "@/hooks/useOrgModules";
import { FamilyChat } from "@/components/FamilyChat";

/** Wire shapes from server/messaging.ts — same REST API FamilyChat.tsx and the iOS apps use. */
type Conversation = {
  id: string;
  familyName: string;
  childName: string;
  participantNames: string[];
  lastMessage: string;
  lastMessageDate: string;
  unreadCount: number;
  isActive: boolean;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  home_visit: "Home Visit",
  office_visit: "Office Visit",
  phone_call: "Phone Call",
  email: "Email",
  referral: "Referral",
  coordinated_services: "Coordinated Services",
  monthly_contact: "Monthly Contact",
  other: "Other",
};

export default function Communication() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [isNewLogOpen, setIsNewLogOpen] = useState(false);
  // Contact logs are backed by familyServices (family-advocate workflows) — a Head Start module feature.
  const hasHeadStart = useOrgModules().has("head_start");
  const rawSearch = useSearch();

  // Command palette's "Send Program Broadcast" deep-links here with
  // ?action=broadcast — land directly on the Broadcasts tab.
  const [selectedTab, setSelectedTab] = useState(() =>
    new URLSearchParams(rawSearch).get("action") === "broadcast" ? "broadcast" : "chat"
  );

  const queryClient = useQueryClient();

  // API Queries & Mutations
  const utils = trpc.useUtils();
  const { data: historyLogs, isLoading: isHistoryLoading } = trpc.messaging.list.useQuery({ organizationId: ORGANIZATION_ID });
  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID);
  const { data: staffList } = trpc.staff.list.useQuery(ORGANIZATION_ID);
  const { data: serviceLogs, isLoading: isLogsLoading } = trpc.familyServices.list.useQuery(
    { organizationId: ORGANIZATION_ID },
    { enabled: hasHeadStart }
  );
  const [msgFamilyId, setMsgFamilyId] = useState("");
  const [logFamilyId, setLogFamilyId] = useState("");

  // Real two-way conversation inbox — the same conversations shown in the
  // Family Chat tab, just listed rather than opened into a thread.
  const conversationsQuery = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => api<Conversation[]>("/api/messaging/conversations"),
    refetchInterval: 15_000,
  });
  const conversations = conversationsQuery.data ?? [];

  // Archive has no backing field on `conversations` (isActive means "the
  // family's one active thread", not per-viewer archived) — hiding locally is
  // the honest option rather than faking server persistence.
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());

  const sendMessageMutation = trpc.messaging.send.useMutation({
    onSuccess: (data) => {
      // Honest about delivery: no provider is wired, so messages are queued.
      toast.success(data?.delivered ? "Message sent." : "Message queued — it will send once delivery is set up.");
      utils.messaging.list.invalidate();
      setIsNewMessageOpen(false);
      setMsgFamilyId("");
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error.message}`);
    }
  });

  const broadcastMutation = trpc.messaging.broadcast.useMutation({
    onSuccess: (data) => {
      toast.success(data.delivered
        ? `Broadcast sent to ${data.count} families.`
        : `Broadcast queued for ${data.count} families.`);
      utils.messaging.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Broadcast failed: ${error.message}`);
    }
  });

  const createLogMutation = trpc.familyServices.create.useMutation({
    onSuccess: () => {
      toast.success("Contact log entry saved.");
      utils.familyServices.list.invalidate();
      setIsNewLogOpen(false);
      setLogFamilyId("");
    },
    onError: (error) => {
      toast.error(`Failed to save log: ${error.message}`);
    }
  });

  // Reply / Forward compose — both send through the real messaging endpoints.
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<"reply" | "forward">("reply");
  const [composeConversation, setComposeConversation] = useState<Conversation | null>(null);
  const [composeFamilyId, setComposeFamilyId] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const invalidateConversations = () => queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });

  const replyMutation = useMutation({
    mutationFn: (input: { conversationId: string; body: string }) =>
      api("/api/messaging/messages", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success("Reply sent");
      setComposeOpen(false);
      invalidateConversations();
    },
    onError: (e: Error) => toast.error(e.message || "Could not send reply"),
  });

  const forwardMutation = useMutation({
    mutationFn: (input: { familyId: number; body: string }) =>
      api("/api/messaging/conversations", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      toast.success("Message forwarded");
      setComposeOpen(false);
      invalidateConversations();
    },
    onError: (e: Error) => toast.error(e.message || "Could not forward message"),
  });

  const openReply = (conv: Conversation) => {
    setComposeMode("reply");
    setComposeConversation(conv);
    setComposeFamilyId("");
    setComposeBody("");
    setComposeOpen(true);
  };

  const openForward = (conv: Conversation) => {
    setComposeMode("forward");
    setComposeConversation(conv);
    setComposeFamilyId("");
    setComposeBody(conv.lastMessage ? `Fwd: "${conv.lastMessage}"\n\n` : "");
    setComposeOpen(true);
  };

  const submitCompose = () => {
    const body = composeBody.trim();
    if (!body) { toast.error("Write a message first."); return; }
    if (composeMode === "reply") {
      if (!composeConversation) return;
      replyMutation.mutate({ conversationId: composeConversation.id, body });
    } else {
      if (!composeFamilyId) { toast.error("Choose a family to forward to."); return; }
      forwardMutation.mutate({ familyId: Number(composeFamilyId), body });
    }
  };

  const archiveConversation = (conv: Conversation) => {
    setArchivedIds((prev) => new Set(prev).add(conv.id));
    toast.success("Archived from this view", {
      description: "Local only — the message still exists and will reappear in Family Chat.",
    });
  };

  // Filtered Data
  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return conversations
      .filter((c) => !archivedIds.has(c.id))
      .filter((c) =>
        !q || c.familyName.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
      );
  }, [conversations, archivedIds, searchQuery]);

  const staffName = (id: number | null | undefined) => {
    if (id == null) return "Staff";
    const s = (staffList ?? []).find((m: any) => m.id === id);
    return s ? `${s.firstName} ${s.lastName}` : "Staff";
  };
  const familyName = (id: number) => (families ?? []).find((f) => f.id === id)?.primaryContactName ?? "Family";

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (serviceLogs ?? []).filter((l) =>
      !q ||
      familyName(l.familyId).toLowerCase().includes(q) ||
      (l.description ?? "").toLowerCase().includes(q)
    );
  }, [serviceLogs, searchQuery, families]);

  const [logDetail, setLogDetail] = useState<NonNullable<typeof serviceLogs>[number] | null>(null);

  const filteredHistory = useMemo(() => {
    if (!historyLogs) return [];
    return historyLogs.filter(h =>
      h.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.subject && h.subject.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [historyLogs, searchQuery]);

  // Handlers
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const family = (families ?? []).find((f) => String(f.id) === msgFamilyId);
    if (!family) { toast.error("Please choose a recipient family."); return; }
    sendMessageMutation.mutate({
      organizationId: ORGANIZATION_ID,
      recipientId: family.id,
      to: family.primaryContactEmail || family.primaryContactPhone || "",
      subject: formData.get("subject") as string,
      content: formData.get("content") as string,
      type: "email"
    });
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const family = (families ?? []).find((f) => String(f.id) === logFamilyId);
    if (!family) { toast.error("Please choose a family."); return; }
    createLogMutation.mutate({
      organizationId: ORGANIZATION_ID,
      familyId: family.id,
      type: formData.get("type") as any,
      serviceDate: new Date(),
      description: formData.get("outcome") as string,
      outcome: "Logged via Communication Center",
    });
  };

  const handleBroadcast = () => {
    broadcastMutation.mutate({
      organizationId: ORGANIZATION_ID,
      content: "Important Program Update: Please check your email for details.",
      channels: ["sms", "email"]
    });
  };

  return (
    <div className="p-6 space-y-6 bg-[#FBF6EE] min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Communication Center</h1>
            <p className="text-sm text-muted-foreground font-medium">Centralized family engagement and outreach</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isNewMessageOpen} onOpenChange={setIsNewMessageOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-md hover:shadow-lg transition-all">
                <Plus className="h-4 w-4" /> New Message
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-xl">
              <form onSubmit={handleSendMessage}>
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Compose New Message</DialogTitle>
                  <DialogDescription className="font-medium">Send a secure message or email to a family.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Recipient Family</label>
                    <Select value={msgFamilyId} onValueChange={setMsgFamilyId}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select a family..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {(families ?? []).map((f) => (
                          <SelectItem key={f.id} value={String(f.id)}>{f.primaryContactName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Subject</label>
                    <Input name="subject" placeholder="e.g., Upcoming Field Trip" className="rounded-xl" required />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Message Content</label>
                    <Textarea name="content" placeholder="Type your message here..." className="rounded-xl min-h-[120px]" required />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsNewMessageOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                  <Button type="submit" className="rounded-xl gap-2 font-bold px-6" disabled={sendMessageMutation.isPending}>
                    {sendMessageMutation.isPending ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send Message
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={selectedTab} className="w-full" onValueChange={setSelectedTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-card border border-border p-1 rounded-xl w-fit shadow-sm">
            <TabsTrigger value="chat" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              Family Chat
            </TabsTrigger>
            <TabsTrigger value="messages" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              Inbox <Badge className="ml-2 bg-card/20 text-white border-none h-4 px-1.5">{conversations.filter(c => c.unreadCount > 0 && !archivedIds.has(c.id)).length}</Badge>
            </TabsTrigger>
            {hasHeadStart && <TabsTrigger value="logs" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Contact Logs</TabsTrigger>}
            <TabsTrigger value="history" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">History</TabsTrigger>
            <TabsTrigger value="broadcast" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Broadcasts</TabsTrigger>
          </TabsList>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${selectedTab}...`}
              className="pl-10 rounded-xl border-none shadow-sm bg-card focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Live thread chat with families — same backend as the iOS app */}
        <TabsContent value="chat" className="mt-0">
          <FamilyChat />
        </TabsContent>

        <TabsContent value="messages" className="mt-0">
          <Card className="border-none shadow-sm rounded-xl overflow-hidden bg-card">
            <CardContent className="p-0">
              {conversationsQuery.isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Clock className="h-8 w-8 text-primary animate-spin mb-2" />
                  <p className="text-sm text-muted-foreground font-bold">Loading conversations...</p>
                </div>
              ) : filteredConversations.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {filteredConversations.map((conv) => {
                    const unread = conv.unreadCount > 0;
                    return (
                      <div key={conv.id} className={cn(
                        "p-5 hover:bg-muted/80 transition-all group flex items-start gap-4 border-l-4",
                        unread ? "border-primary bg-primary/5" : "border-transparent"
                      )}>
                        <div className={cn(
                          "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                          unread ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                        )}>
                          <User className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <h3 className={cn("text-sm font-bold", unread ? "text-foreground" : "text-muted-foreground")}>
                                {conv.familyName}
                              </h3>
                              {conv.childName && (
                                <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tighter h-4 px-1.5 bg-muted text-muted-foreground">
                                  {conv.childName}
                                </Badge>
                              )}
                              {unread && (
                                <Badge className="text-[9px] font-bold h-4 px-1.5">{conv.unreadCount} new</Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-bold">{timeLabel(conv.lastMessageDate)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate leading-relaxed">{conv.lastMessage || "No messages yet"}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl w-40">
                              <DropdownMenuItem className="gap-2 font-medium" onClick={() => openReply(conv)}>
                                <Reply className="h-4 w-4" /> Reply
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 font-medium" onClick={() => openForward(conv)}>
                                <Forward className="h-4 w-4" /> Forward
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 font-medium" onClick={() => archiveConversation(conv)}>
                                <Archive className="h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-slate-200" />
                  </div>
                  <h3 className="text-foreground font-bold">No messages found</h3>
                  <p className="text-muted-foreground text-sm font-medium">
                    {conversations.length === 0 ? "Conversations with families will show up here." : "Try adjusting your search."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {hasHeadStart && (
        <TabsContent value="logs" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLogsLoading ? (
              <div className="col-span-full py-20 flex flex-col items-center justify-center">
                <Clock className="h-8 w-8 text-primary animate-spin mb-2" />
                <p className="text-sm text-muted-foreground font-bold">Loading contact logs...</p>
              </div>
            ) : filteredLogs.length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  icon={MessageSquare}
                  title={searchQuery ? "No contact logs match your search" : "No contact logs yet"}
                  description={searchQuery ? "Try a different name or clear the search." : "Calls, home visits, and check-ins you log will show up here. Add one with the card below."}
                />
              </div>
            )}
            {filteredLogs.map((log) => (
              <Card key={log.id} className="border-none shadow-sm rounded-xl hover:shadow-md transition-all bg-card group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={cn(
                      "rounded-full text-[9px] font-bold uppercase tracking-wider px-2",
                      log.type === "home_visit" ? "bg-green-600" : log.type === "phone_call" ? "bg-blue-500" : "bg-purple-500"
                    )}>
                      {SERVICE_TYPE_LABELS[log.type] ?? log.type}
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold">
                      <Clock className="h-3 w-3" /> {new Date(log.serviceDate).toLocaleDateString()}
                    </div>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground">{familyName(log.familyId)}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground">Logged by {staffName(log.recordedBy)}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-xl p-3 mb-4">
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed italic">"{log.description}"</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cn(
                      "rounded-full text-[9px] font-bold",
                      Number(log.followUpRequired) === 1 ? "text-amber-600 border-amber-100 bg-amber-50" : "text-green-600 border-green-100 bg-green-50"
                    )}>
                      {Number(log.followUpRequired) === 1 ? "Follow-up Required" : "Completed"}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-primary font-bold text-[11px] h-8 rounded-xl hover:bg-primary/5" onClick={() => setLogDetail(log)}>
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Dialog open={isNewLogOpen} onOpenChange={setIsNewLogOpen}>
              <DialogTrigger asChild>
                <Card className="border-2 border-dashed border-border shadow-none rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-card hover:border-primary/50 hover:shadow-sm transition-all group">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
                    <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors">Add Contact Log</p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-1">Record a new family interaction</p>
                </Card>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-xl">
                <form onSubmit={handleAddLog}>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">New Contact Log Entry</DialogTitle>
                    <DialogDescription className="font-medium">Document an interaction with a family member.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Family</label>
                        <Select value={logFamilyId} onValueChange={setLogFamilyId}>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select family..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {(families ?? []).map((f) => (
                              <SelectItem key={f.id} value={String(f.id)}>{f.primaryContactName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Contact Type</label>
                        <Select name="type" required>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="phone_call">Phone Call</SelectItem>
                            <SelectItem value="home_visit">Home Visit</SelectItem>
                            <SelectItem value="office_visit">Office Visit</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Outcome / Notes</label>
                      <Textarea name="outcome" placeholder="What was discussed? Any follow-up needed?" className="rounded-xl min-h-[100px]" required />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsNewLogOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                    <Button type="submit" className="rounded-xl font-bold px-6" disabled={createLogMutation.isPending}>
                      {createLogMutation.isPending ? <Clock className="h-4 w-4 animate-spin" /> : "Save Log Entry"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>
        )}

        <TabsContent value="history" className="mt-0">
          <Card className="border-none shadow-sm rounded-xl overflow-hidden bg-card">
            <CardContent className="p-0">
              {isHistoryLoading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <Clock className="h-8 w-8 text-primary animate-spin mb-2" />
                  <p className="text-sm text-muted-foreground font-bold">Loading communication history...</p>
                </div>
              ) : filteredHistory.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {filteredHistory.map((h: any) => (
                    <div key={h.id} className="p-5 hover:bg-muted/80 transition-all flex items-start gap-4">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                        h.type === 'sms' ? "bg-blue-50 text-blue-500" : "bg-purple-50 text-purple-500"
                      )}>
                        {h.type === 'sms' ? <Smartphone className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-foreground">
                              {h.type === 'sms' ? 'SMS Message' : h.subject || 'Email Notification'}
                            </h3>
                            <Badge className={cn(
                              "text-[9px] font-bold uppercase tracking-tighter h-4 px-1.5",
                              h.status === 'sent' ? "bg-green-500" : h.status === 'failed' ? "bg-red-500" : "bg-amber-500"
                            )}>
                              {h.status}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-bold">
                            {new Date(h.sentAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{h.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <HistoryIcon className="h-8 w-8 text-slate-200" />
                  </div>
                  <h3 className="text-foreground font-bold">No communication history</h3>
                  <p className="text-muted-foreground text-sm font-medium">Past SMS and Email logs will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="broadcast" className="mt-0">
          <Card className="border-none shadow-sm rounded-xl bg-card overflow-hidden">
            <div className="p-8 flex flex-col items-center text-center max-w-lg mx-auto">
              <div className="h-20 w-20 rounded-xl bg-amber-50 flex items-center justify-center mb-6">
                <Megaphone className="h-10 w-10 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Program-Wide Broadcasts</h2>
              <p className="text-sm text-muted-foreground font-medium mb-8 leading-relaxed">
                Send urgent alerts, weather closures, or program updates to all families simultaneously via SMS and Email.
              </p>
              <Button
                className="rounded-full px-8 py-6 h-auto text-base font-bold gap-3 shadow-lg shadow-primary/20"
                onClick={handleBroadcast}
                disabled={broadcastMutation.isPending}
              >
                {broadcastMutation.isPending ? <Clock className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Create New Broadcast
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reply / Forward compose */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {composeMode === "reply" ? `Reply to ${composeConversation?.familyName ?? "family"}` : "Forward message"}
            </DialogTitle>
            <DialogDescription className="font-medium">
              {composeMode === "reply"
                ? "Sends into the existing conversation thread with this family."
                : "Sends the quoted message (or your edits) as a new message to another family."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {composeMode === "forward" && (
              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Forward to Family</label>
                <Select value={composeFamilyId} onValueChange={setComposeFamilyId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select a family..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {(families ?? []).map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.primaryContactName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Message</label>
              <Textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Type your message..."
                className="rounded-xl min-h-[120px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setComposeOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button
              onClick={submitCompose}
              disabled={replyMutation.isPending || forwardMutation.isPending}
              className="rounded-xl gap-2 font-bold px-6"
            >
              {(replyMutation.isPending || forwardMutation.isPending) ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {composeMode === "reply" ? "Send Reply" : "Forward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Log detail */}
      <Dialog open={logDetail != null} onOpenChange={(o) => { if (!o) setLogDetail(null); }}>
        <DialogContent className="sm:max-w-[500px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{logDetail ? familyName(logDetail.familyId) : ""}</DialogTitle>
            <DialogDescription className="font-medium">
              {logDetail && `${SERVICE_TYPE_LABELS[logDetail.type] ?? logDetail.type} • ${new Date(logDetail.serviceDate).toLocaleDateString()}`}
            </DialogDescription>
          </DialogHeader>
          {logDetail && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Logged by</span><span className="font-medium">{staffName(logDetail.recordedBy)}</span></div>
              <div>
                <p className="text-muted-foreground mb-1">Notes</p>
                <p className="bg-muted rounded-xl p-3">{logDetail.description}</p>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Follow-up</span>
                <span className="font-medium">
                  {Number(logDetail.followUpRequired) === 1
                    ? `Required${logDetail.followUpDate ? ` by ${new Date(logDetail.followUpDate).toLocaleDateString()}` : ""}`
                    : "Not required"}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setLogDetail(null)} className="rounded-xl font-bold">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
