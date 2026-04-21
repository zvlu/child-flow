import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Mail, Phone, Award, BookOpen, Calendar, MoreHorizontal, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

const staffMembers = [
  { id: 1, name: "Patricia Lee", role: "Lead Teacher", classroom: "Room A", email: "p.lee@childflow.org", phone: "(555) 111-2222", status: "active", hireDate: "2019-08-15", certifications: ["CDA", "First Aid/CPR"], trainingHours: 24, requiredHours: 24, education: "BA Early Childhood Education" },
  { id: 2, name: "Robert Chen", role: "Lead Teacher", classroom: "Room B", email: "r.chen@childflow.org", phone: "(555) 222-3333", status: "active", hireDate: "2021-01-10", certifications: ["CDA", "First Aid/CPR"], trainingHours: 18, requiredHours: 24, education: "AA Child Development" },
  { id: 3, name: "Angela Davis", role: "Teacher Assistant", classroom: "Room A", email: "a.davis@childflow.org", phone: "(555) 333-4444", status: "active", hireDate: "2022-09-01", certifications: ["First Aid/CPR"], trainingHours: 20, requiredHours: 24, education: "HS Diploma + CDA in progress" },
  { id: 4, name: "Michael Torres", role: "Lead Teacher", classroom: "Room C", email: "m.torres@childflow.org", phone: "(555) 444-5555", status: "active", hireDate: "2020-03-15", certifications: ["CDA", "First Aid/CPR", "CLASS Observer"], trainingHours: 24, requiredHours: 24, education: "BA Education" },
  { id: 5, name: "Jennifer Kim", role: "Family Service Worker", classroom: "N/A", email: "j.kim@childflow.org", phone: "(555) 555-6666", status: "active", hireDate: "2021-06-01", certifications: ["First Aid/CPR"], trainingHours: 16, requiredHours: 20, education: "BA Social Work" },
  { id: 6, name: "David Martinez", role: "Health Coordinator", classroom: "N/A", email: "d.martinez@childflow.org", phone: "(555) 666-7777", status: "active", hireDate: "2018-11-01", certifications: ["RN", "First Aid/CPR"], trainingHours: 20, requiredHours: 20, education: "BSN Nursing" },
  { id: 7, name: "Lisa Thompson", role: "Program Director", classroom: "N/A", email: "l.thompson@childflow.org", phone: "(555) 777-8888", status: "active", hireDate: "2015-07-01", certifications: ["CDA", "First Aid/CPR", "CLASS Observer"], trainingHours: 24, requiredHours: 24, education: "MA Early Childhood Administration" },
  { id: 8, name: "Carlos Reyes", role: "Teacher Assistant", classroom: "Room B", email: "c.reyes@childflow.org", phone: "(555) 888-9999", status: "active", hireDate: "2023-08-15", certifications: ["First Aid/CPR"], trainingHours: 8, requiredHours: 24, education: "HS Diploma" },
];

const roleColors: Record<string, string> = {
  "Lead Teacher": "bg-blue-100 text-blue-700 border-blue-200",
  "Teacher Assistant": "bg-green-100 text-green-700 border-green-200",
  "Family Service Worker": "bg-purple-100 text-purple-700 border-purple-200",
  "Health Coordinator": "bg-red-100 text-red-700 border-red-200",
  "Program Director": "bg-amber-100 text-amber-700 border-amber-200",
};

const trainingEvents = [
  { title: "Trauma-Informed Care", date: "Nov 20, 2024", hours: 3, required: true },
  { title: "Child Assessment Strategies", date: "Dec 5, 2024", hours: 2, required: true },
  { title: "Family Engagement Best Practices", date: "Dec 12, 2024", hours: 2, required: false },
  { title: "CPR/First Aid Renewal", date: "Jan 15, 2025", hours: 4, required: true },
];

export default function Staff() {
  const [search, setSearch] = useState("");

  const filtered = staffMembers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{staffMembers.length} staff members</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" />Export</Button>
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Add Staff</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Staff", value: staffMembers.length },
          { label: "Lead Teachers", value: staffMembers.filter(s => s.role === "Lead Teacher").length },
          { label: "Training Complete", value: staffMembers.filter(s => s.trainingHours >= s.requiredHours).length },
          { label: "Training Needed", value: staffMembers.filter(s => s.trainingHours < s.requiredHours).length },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="directory">
        <TabsList>
          <TabsTrigger value="directory">Staff Directory</TabsTrigger>
          <TabsTrigger value="training">Training & Development</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-4 space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search staff..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(member => (
              <Card key={member.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {member.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground">{member.name}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Profile</DropdownMenuItem>
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem>Training Records</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <Badge className={`text-xs mt-1 ${roleColors[member.role] || "bg-gray-100 text-gray-700"} hover:bg-opacity-100`}>
                        {member.role}
                      </Badge>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {member.classroom !== "N/A" && <p>Classroom: {member.classroom}</p>}
                        <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{member.email}</div>
                        <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{member.phone}</div>
                        <p>Hired: {member.hireDate}</p>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Training Hours</span>
                          <span className={member.trainingHours >= member.requiredHours ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                            {member.trainingHours}/{member.requiredHours}
                          </span>
                        </div>
                        <Progress value={(member.trainingHours / member.requiredHours) * 100} className="h-1.5" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="training" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Upcoming Training Events
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {trainingEvents.map((event, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{event.title}</p>
                      {event.required && <Badge className="text-xs bg-red-100 text-red-700 hover:bg-red-100">Required</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{event.date} &bull; {event.hours} hours</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">Register</Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Training Hours Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {staffMembers.map(member => (
                  <div key={member.id} className="flex items-center gap-4">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {member.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium truncate">{member.name}</span>
                        <span className={`text-xs font-medium ${member.trainingHours >= member.requiredHours ? "text-green-600" : "text-amber-600"}`}>
                          {member.trainingHours}/{member.requiredHours} hrs
                        </span>
                      </div>
                      <Progress value={(member.trainingHours / member.requiredHours) * 100} className="h-1.5" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Staff Certifications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Staff Member</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Role</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Education</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Certifications</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {staffMembers.map(member => (
                      <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                {member.name.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{member.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={`text-xs ${roleColors[member.role] || ""} hover:bg-opacity-100`}>{member.role}</Badge>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{member.education}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {member.certifications.map(cert => (
                              <Badge key={cert} variant="outline" className="text-xs">{cert}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
