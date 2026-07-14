import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, MessageSquare, Phone, Mail, Plus, 
  MoreHorizontal, Filter, Send, User, Clock,
  CheckCircle2, AlertCircle, Trash2, Archive,
  Reply, Forward, FileText, Users, Megaphone,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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

const initialMessages = [
  { id: 1, sender: "Maria Rodriguez", subject: "Absence Note - Marcus", preview: "Marcus will be out today due to a doctor's appointment...", time: "10:30 AM", unread: true, type: "Message", category: "Attendance" },
  { id: 2, sender: "John Smith", subject: "Field Trip Permission", preview: "I've signed the digital permission slip for the zoo trip...", time: "Yesterday", unread: false, type: "Email", category: "Forms" },
  { id: 3, sender: "Sarah Chen", subject: "Health Record Update", preview: "Attached is the updated immunization record for Leo...", time: "2 days ago", unread: false, type: "Message", category: "Health" },
  { id: 4, sender: "David Wilson", subject: "Tuition Question", preview: "I had a question regarding the latest invoice for April...", time: "3 days ago", unread: false, type: "Email", category: "Billing" },
];

// Relative to today so this log doesn't read as "Apr 2024" forever — it used
// to be a fixed date that just got more stale-looking every month.
const logDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const initialLogs = [
  { id: 1, family: "Johnson Family", staff: "Lisa T.", type: "Phone Call", outcome: "Discussed enrollment paperwork", date: logDaysAgo(2), status: "Completed" },
  { id: 2, family: "Williams Family", staff: "Patricia L.", type: "Home Visit", outcome: "Completed initial family assessment", date: logDaysAgo(4), status: "Completed" },
  { id: 3, family: "Garcia Family", staff: "Lisa T.", type: "Office Visit", outcome: "Resource referral for housing", date: logDaysAgo(7), status: "Follow-up Required" },
];

export default function Communication() {
  const [messages, setMessages] = useState(initialMessages);
  const [logs, setLogs] = useState(initialLogs);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [isNewLogOpen, setIsNewLogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("messages");
  // Contact logs are backed by familyServices (family-advocate workflows) — a Head Start module feature.
  const hasHeadStart = useOrgModules().has("head_start");

  // API Queries & Mutations
  const utils = trpc.useUtils();
  const { data: historyLogs, isLoading: isHistoryLoading } = trpc.messaging.list.useQuery({ organizationId: ORGANIZATION_ID });
  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID);
  const [msgFamilyId, setMsgFamilyId] = useState("");
  const [logFamilyId, setLogFamilyId] = useState("");

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

  // Filtered Data
  const filteredMessages = useMemo(() => {
    return messages.filter(m => 
      m.sender.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.subject.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, searchQuery]);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => 
      l.family.toLowerCase().includes(searchQuery.toLowerCase()) || 
      l.outcome.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [logs, searchQuery]);

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

  const markAsRead = (id: number) => {
    setMessages(messages.map(m => m.id === id ? { ...m, unread: false } : m));
    toast.info("Message marked as read");
  };

  const deleteMessage = (id: number) => {
    const idx = messages.findIndex(m => m.id === id);
    if (idx === -1) return;
    const removed = messages[idx];
    setMessages(messages.filter(m => m.id !== id));
    toast.success("Message deleted", {
      action: {
        label: "Undo",
        onClick: () => setMessages(prev => {
          const next = [...prev];
          next.splice(Math.min(idx, next.length), 0, removed);
          return next;
        }),
      },
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

      <Tabs defaultValue="chat" className="w-full" onValueChange={setSelectedTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-card border border-border p-1 rounded-xl w-fit shadow-sm">
            <TabsTrigger value="chat" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              Family Chat
            </TabsTrigger>
            <TabsTrigger value="messages" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              Inbox <Badge className="ml-2 bg-card/20 text-white border-none h-4 px-1.5">{messages.filter(m => m.unread).length}</Badge>
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
              {filteredMessages.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {filteredMessages.map((msg) => (
                    <div key={msg.id} className={cn(
                      "p-5 hover:bg-muted/80 transition-all cursor-pointer group flex items-start gap-4 border-l-4",
                      msg.unread ? "border-primary bg-primary/5" : "border-transparent"
                    )}>
                      <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                        msg.unread ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                      )}>
                        <User className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h3 className={cn("text-sm font-bold", msg.unread ? "text-foreground" : "text-muted-foreground")}>
                              {msg.sender}
                            </h3>
                            <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tighter h-4 px-1.5 bg-muted text-muted-foreground">
                              {msg.category}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-bold">{msg.time}</span>
                        </div>
                        <p className={cn("text-sm font-bold mb-1 truncate", msg.unread ? "text-foreground" : "text-muted-foreground")}>
                          {msg.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate leading-relaxed">{msg.preview}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {msg.unread && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10" onClick={() => markAsRead(msg.id)}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl w-40">
                            <DropdownMenuItem className="gap-2 font-medium"><Reply className="h-4 w-4" /> Reply</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 font-medium"><Forward className="h-4 w-4" /> Forward</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 font-medium"><Archive className="h-4 w-4" /> Archive</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 font-medium text-destructive" onClick={() => deleteMessage(msg.id)}>
                              <Trash2 className="h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-slate-200" />
                  </div>
                  <h3 className="text-foreground font-bold">No messages found</h3>
                  <p className="text-muted-foreground text-sm font-medium">Try adjusting your search or filters.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {hasHeadStart && (
        <TabsContent value="logs" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLogs.length === 0 && (
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
                      log.type === "Phone Call" ? "bg-blue-500" : log.type === "Home Visit" ? "bg-green-600" : "bg-purple-500"
                    )}>
                      {log.type}
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold">
                      <Clock className="h-3 w-3" /> {log.date}
                    </div>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground">{log.family}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground">Logged by {log.staff}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-xl p-3 mb-4">
                    <p className="text-xs text-muted-foreground font-medium leading-relaxed italic">"{log.outcome}"</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cn(
                      "rounded-full text-[9px] font-bold",
                      log.status === "Completed" ? "text-green-600 border-green-100 bg-green-50" : "text-amber-600 border-amber-100 bg-amber-50"
                    )}>
                      {log.status}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-primary font-bold text-[11px] h-8 rounded-xl hover:bg-primary/5">
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
              
              <div className="mt-12 w-full text-left">
                <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-widest mb-4">Recent Broadcasts</h3>
                <div className="space-y-3">
                  {[
                    { title: "Weather Alert: School Closed", date: logDaysAgo(9), reach: "100% Families" },
                    { title: "Reminder: Spring Festival", date: logDaysAgo(35), reach: "98% Families" }
                  ].map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border">
                      <div>
                        <p className="text-sm font-bold text-foreground">{b.title}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">{b.date}</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full text-[10px] font-bold bg-card border-border">{b.reach}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
