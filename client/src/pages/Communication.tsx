import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, MessageSquare, Phone, Mail, Plus, 
  MoreHorizontal, Filter, Send, User, Clock,
  CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const messages = [
  { id: 1, sender: "Maria Rodriguez", subject: "Absence Note - Marcus", preview: "Marcus will be out today due to a doctor's appointment...", time: "10:30 AM", unread: true, type: "Message" },
  { id: 2, sender: "John Smith", subject: "Field Trip Permission", preview: "I've signed the digital permission slip for the zoo trip...", time: "Yesterday", unread: false, type: "Email" },
  { id: 3, sender: "Sarah Chen", subject: "Health Record Update", preview: "Attached is the updated immunization record for Leo...", time: "2 days ago", unread: false, type: "Message" },
];

const contactLogs = [
  { id: 1, family: "Johnson Family", staff: "Lisa T.", type: "Phone Call", outcome: "Discussed enrollment paperwork", date: "Apr 20, 2024" },
  { id: 2, family: "Williams Family", staff: "Patricia L.", type: "Home Visit", outcome: "Completed initial family assessment", date: "Apr 18, 2024" },
  { id: 3, family: "Garcia Family", staff: "Lisa T.", type: "Office Visit", outcome: "Resource referral for housing", date: "Apr 15, 2024" },
];

export default function Communication() {
  const [searchQuery, setSearchQuery] = useState("");

  const handleAction = (action: string) => {
    toast.success(`${action} initiated`);
  };

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc] min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Communication Center</h1>
          <p className="text-sm text-slate-500">Manage messages, contact logs, and family outreach.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="rounded-full gap-2" onClick={() => handleAction("New Message")}>
            <Plus className="h-4 w-4" /> New Message
          </Button>
        </div>
      </div>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList className="bg-white border border-slate-200 p-1 rounded-xl mb-6">
          <TabsTrigger value="messages" className="rounded-lg px-6">Messages</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-lg px-6">Contact Logs</TabsTrigger>
          <TabsTrigger value="broadcast" className="rounded-lg px-6">Broadcasts</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-4">
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search messages..." 
                    className="pl-10 rounded-xl border-slate-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" className="rounded-xl">
                  <Filter className="h-4 w-4 text-slate-500" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-50">
                {messages.map((msg) => (
                  <div key={msg.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`text-sm font-bold ${msg.unread ? 'text-slate-900' : 'text-slate-600'}`}>
                          {msg.sender}
                          {msg.unread && <Badge className="ml-2 bg-primary text-[10px] h-4">New</Badge>}
                        </h3>
                        <span className="text-[11px] text-slate-400 font-medium">{msg.time}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mb-1 truncate">{msg.subject}</p>
                      <p className="text-xs text-slate-500 truncate">{msg.preview}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      <MoreHorizontal className="h-4 w-4 text-slate-400" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contactLogs.map((log) => (
              <Card key={log.id} className="border-none shadow-sm rounded-2xl hover:shadow-md transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {log.type}
                    </Badge>
                    <span className="text-[10px] text-slate-400 font-bold">{log.date}</span>
                  </div>
                  <CardTitle className="text-sm font-bold mt-2">{log.family}</CardTitle>
                  <CardDescription className="text-[11px] font-medium">Logged by {log.staff}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-600 leading-relaxed">{log.outcome}</p>
                  <div className="mt-4 flex justify-end">
                    <Button variant="ghost" size="sm" className="text-primary font-bold text-[11px] h-8">
                      View Full Log
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="border-2 border-dashed border-slate-200 shadow-none rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleAction("Add Log")}>
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                <Plus className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-xs font-bold text-slate-500">Add Contact Log</p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
