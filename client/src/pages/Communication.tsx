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
  Reply, Forward, FileText, Users, Megaphone
} from "lucide-react";
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

const initialMessages = [
  { id: 1, sender: "Maria Rodriguez", subject: "Absence Note - Marcus", preview: "Marcus will be out today due to a doctor's appointment...", time: "10:30 AM", unread: true, type: "Message", category: "Attendance" },
  { id: 2, sender: "John Smith", subject: "Field Trip Permission", preview: "I've signed the digital permission slip for the zoo trip...", time: "Yesterday", unread: false, type: "Email", category: "Forms" },
  { id: 3, sender: "Sarah Chen", subject: "Health Record Update", preview: "Attached is the updated immunization record for Leo...", time: "2 days ago", unread: false, type: "Message", category: "Health" },
  { id: 4, sender: "David Wilson", subject: "Tuition Question", preview: "I had a question regarding the latest invoice for April...", time: "3 days ago", unread: false, type: "Email", category: "Billing" },
];

const initialLogs = [
  { id: 1, family: "Johnson Family", staff: "Lisa T.", type: "Phone Call", outcome: "Discussed enrollment paperwork", date: "Apr 20, 2024", status: "Completed" },
  { id: 2, family: "Williams Family", staff: "Patricia L.", type: "Home Visit", outcome: "Completed initial family assessment", date: "Apr 18, 2024", status: "Completed" },
  { id: 3, family: "Garcia Family", staff: "Lisa T.", type: "Office Visit", outcome: "Resource referral for housing", date: "Apr 15, 2024", status: "Follow-up Required" },
];

export default function Communication() {
  const [messages, setMessages] = useState(initialMessages);
  const [logs, setLogs] = useState(initialLogs);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [isNewLogOpen, setIsNewLogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState("messages");

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

  // Handlers
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent successfully to the family!");
    setIsNewMessageOpen(false);
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Contact log entry saved.");
    setIsNewLogOpen(false);
  };

  const markAsRead = (id: number) => {
    setMessages(messages.map(m => m.id === id ? { ...m, unread: false } : m));
    toast.info("Message marked as read");
  };

  const deleteMessage = (id: number) => {
    setMessages(messages.filter(m => m.id !== id));
    toast.error("Message deleted");
  };

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc] min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Communication Center</h1>
            <p className="text-sm text-slate-500 font-medium">Centralized family engagement and outreach</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isNewMessageOpen} onOpenChange={setIsNewMessageOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full gap-2 shadow-md hover:shadow-lg transition-all">
                <Plus className="h-4 w-4" /> New Message
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-3xl">
              <form onSubmit={handleSendMessage}>
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Compose New Message</DialogTitle>
                  <DialogDescription className="font-medium">Send a secure message or email to a family.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label className="text-xs font-bold uppercase text-slate-400">Recipient Family</label>
                    <Select required>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select a family..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="johnson">Johnson Family</SelectItem>
                        <SelectItem value="garcia">Garcia Family</SelectItem>
                        <SelectItem value="williams">Williams Family</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-bold uppercase text-slate-400">Subject</label>
                    <Input placeholder="e.g., Upcoming Field Trip" className="rounded-xl" required />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs font-bold uppercase text-slate-400">Message Content</label>
                    <Textarea placeholder="Type your message here..." className="rounded-xl min-h-[120px]" required />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-500 flex items-center gap-2">
                      <input type="checkbox" className="rounded border-slate-300" />
                      Also send as Email notification
                    </label>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsNewMessageOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                  <Button type="submit" className="rounded-xl gap-2 font-bold px-6">
                    <Send className="h-4 w-4" /> Send Message
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="messages" className="w-full" onValueChange={setSelectedTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-white border border-slate-200 p-1 rounded-2xl w-fit shadow-sm">
            <TabsTrigger value="messages" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
              Inbox <Badge className="ml-2 bg-white/20 text-white border-none h-4 px-1.5">{messages.filter(m => m.unread).length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="logs" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Contact Logs</TabsTrigger>
            <TabsTrigger value="broadcast" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Broadcasts</TabsTrigger>
          </TabsList>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={`Search ${selectedTab}...`} 
              className="pl-10 rounded-2xl border-none shadow-sm bg-white focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value="messages" className="mt-0">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardContent className="p-0">
              {filteredMessages.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {filteredMessages.map((msg) => (
                    <div key={msg.id} className={cn(
                      "p-5 hover:bg-slate-50/80 transition-all cursor-pointer group flex items-start gap-4 border-l-4",
                      msg.unread ? "border-primary bg-primary/5" : "border-transparent"
                    )}>
                      <div className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm",
                        msg.unread ? "bg-primary text-white" : "bg-slate-100 text-slate-400"
                      )}>
                        <User className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <h3 className={cn("text-sm font-bold", msg.unread ? "text-slate-900" : "text-slate-600")}>
                              {msg.sender}
                            </h3>
                            <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tighter h-4 px-1.5 bg-slate-100 text-slate-500">
                              {msg.category}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-slate-400 font-bold">{msg.time}</span>
                        </div>
                        <p className={cn("text-sm font-bold mb-1 truncate", msg.unread ? "text-slate-900" : "text-slate-700")}>
                          {msg.subject}
                        </p>
                        <p className="text-xs text-slate-500 truncate leading-relaxed">{msg.preview}</p>
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
                              <MoreHorizontal className="h-4 w-4 text-slate-400" />
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
                  <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-slate-200" />
                  </div>
                  <h3 className="text-slate-900 font-bold">No messages found</h3>
                  <p className="text-slate-400 text-sm font-medium">Try adjusting your search or filters.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="border-none shadow-sm rounded-3xl hover:shadow-md transition-all bg-white group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={cn(
                      "rounded-full text-[9px] font-bold uppercase tracking-wider px-2",
                      log.type === "Phone Call" ? "bg-blue-500" : log.type === "Home Visit" ? "bg-green-600" : "bg-purple-500"
                    )}>
                      {log.type}
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                      <Clock className="h-3 w-3" /> {log.date}
                    </div>
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900">{log.family}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="h-3 w-3 text-slate-500" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">Logged by {log.staff}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 rounded-2xl p-3 mb-4">
                    <p className="text-xs text-slate-700 font-medium leading-relaxed italic">"{log.outcome}"</p>
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
                <Card className="border-2 border-dashed border-slate-200 shadow-none rounded-3xl flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-white hover:border-primary/50 hover:shadow-sm transition-all group">
                  <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-colors">
                    <Plus className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-sm font-bold text-slate-500 group-hover:text-primary transition-colors">Add Contact Log</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Record a new family interaction</p>
                </Card>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-3xl">
                <form onSubmit={handleAddLog}>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">New Contact Log Entry</DialogTitle>
                    <DialogDescription className="font-medium">Document an interaction with a family member.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-slate-400">Family</label>
                        <Select required>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select family..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="johnson">Johnson Family</SelectItem>
                            <SelectItem value="garcia">Garcia Family</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs font-bold uppercase text-slate-400">Contact Type</label>
                        <Select required>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="phone">Phone Call</SelectItem>
                            <SelectItem value="home">Home Visit</SelectItem>
                            <SelectItem value="office">Office Visit</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-bold uppercase text-slate-400">Outcome / Notes</label>
                      <Textarea placeholder="What was discussed? Any follow-up needed?" className="rounded-xl min-h-[100px]" required />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-bold uppercase text-slate-400">Status</label>
                      <Select defaultValue="completed">
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="followup">Follow-up Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsNewLogOpen(false)} className="rounded-xl font-bold">Cancel</Button>
                    <Button type="submit" className="rounded-xl font-bold px-6">Save Log Entry</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>

        <TabsContent value="broadcast" className="mt-0">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <div className="p-8 flex flex-col items-center text-center max-w-lg mx-auto">
              <div className="h-20 w-20 rounded-3xl bg-amber-50 flex items-center justify-center mb-6">
                <Megaphone className="h-10 w-10 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Program-Wide Broadcasts</h2>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
                Send urgent alerts, weather closures, or program updates to all families simultaneously via SMS and Email.
              </p>
              <Button className="rounded-full px-8 py-6 h-auto text-base font-bold gap-3 shadow-lg shadow-primary/20" onClick={() => handleAction("New Broadcast")}>
                <Plus className="h-5 w-5" /> Create New Broadcast
              </Button>
              
              <div className="mt-12 w-full text-left">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-4">Recent Broadcasts</h3>
                <div className="space-y-3">
                  {[
                    { title: "Weather Alert: School Closed", date: "Jan 15, 2024", reach: "100% Families" },
                    { title: "Reminder: Spring Festival", date: "Mar 10, 2024", reach: "98% Families" }
                  ].map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{b.title}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{b.date}</p>
                      </div>
                      <Badge variant="secondary" className="rounded-full text-[10px] font-bold bg-white border-slate-200">{b.reach}</Badge>
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
