import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search, Clock, CheckCircle2, XCircle, ArrowRight, Users, BookOpen, AlertCircle } from "lucide-react";

const waitlistApplications = [
  { id: 1, childName: "Destiny Williams", dob: "2021-08-12", age: "3y 2m", parent: "Keisha Williams", phone: "(555) 123-4567", appliedDate: "2024-10-01", priority: "high", income: "Below 100% FPL", status: "pending", notes: "Single parent, working full-time" },
  { id: 2, childName: "Tyler Johnson", dob: "2021-05-20", age: "3y 5m", parent: "Mark Johnson", phone: "(555) 234-5678", appliedDate: "2024-10-05", priority: "medium", income: "Below 130% FPL", status: "pending", notes: "Foster child" },
  { id: 3, childName: "Isabella Cruz", dob: "2021-11-30", age: "2y 11m", parent: "Ana Cruz", phone: "(555) 345-6789", appliedDate: "2024-10-10", priority: "high", income: "Below 100% FPL", status: "pending", notes: "Spanish-speaking family, IEP needed" },
  { id: 4, childName: "Ethan Moore", dob: "2021-03-08", age: "3y 7m", parent: "Sandra Moore", phone: "(555) 456-7890", appliedDate: "2024-09-15", priority: "low", income: "Below 185% FPL", status: "reviewing", notes: "" },
  { id: 5, childName: "Amara Okafor", dob: "2021-07-22", age: "3y 3m", parent: "Chioma Okafor", phone: "(555) 567-8901", appliedDate: "2024-09-20", priority: "medium", income: "Below 100% FPL", status: "approved", notes: "Awaiting classroom assignment" },
];

const enrolledThisYear = [
  { name: "Emma Johnson", date: "2023-09-05", classroom: "Room A" },
  { name: "Marcus Williams", date: "2023-09-05", classroom: "Room A" },
  { name: "Sofia Rodriguez", date: "2023-09-05", classroom: "Room A" },
  { name: "Jaylen Brown", date: "2023-09-12", classroom: "Room C" },
  { name: "Aaliyah Davis", date: "2023-09-12", classroom: "Room B" },
];

const priorityBadge = (priority: string) => {
  if (priority === "high") return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">High Priority</Badge>;
  if (priority === "medium") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100 text-xs">Medium</Badge>;
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 text-xs">Low</Badge>;
};

const statusBadge = (status: string) => {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Approved</Badge>;
  if (status === "reviewing") return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-xs">Reviewing</Badge>;
  if (status === "denied") return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Denied</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100 text-xs">Pending</Badge>;
};

export default function Enrollment() {
  const [search, setSearch] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  const filtered = waitlistApplications.filter(a =>
    a.childName.toLowerCase().includes(search.toLowerCase()) ||
    a.parent.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = waitlistApplications.filter(a => a.status === "pending").length;
  const approvedCount = waitlistApplications.filter(a => a.status === "approved").length;
  const reviewingCount = waitlistApplications.filter(a => a.status === "reviewing").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enrollment</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage applications, waitlist, and enrollment processes</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />New Application</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>New Enrollment Application</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Child First Name</Label>
                    <Input placeholder="First name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Child Last Name</Label>
                    <Input placeholder="Last name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Parent/Guardian Name</Label>
                    <Input placeholder="Full name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input placeholder="(555) 000-0000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Home Address</Label>
                  <Input placeholder="Street address, city, state, zip" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Household Income Level</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below_100">Below 100% FPL</SelectItem>
                        <SelectItem value="below_130">100-130% FPL</SelectItem>
                        <SelectItem value="below_185">130-185% FPL</SelectItem>
                        <SelectItem value="above_185">Above 185% FPL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Household Size</Label>
                    <Input type="number" placeholder="Number of people" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowNewForm(false)}>Cancel</Button>
                  <Button onClick={() => setShowNewForm(false)}>Submit Application</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Applications", value: waitlistApplications.length, icon: BookOpen, color: "text-primary" },
          { label: "Pending Review", value: pendingCount, icon: Clock, color: "text-yellow-600" },
          { label: "Under Review", value: reviewingCount, icon: AlertCircle, color: "text-blue-600" },
          { label: "Approved", value: approvedCount, icon: CheckCircle2, color: "text-green-600" },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                  <Icon className={`h-8 w-8 opacity-20 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="waitlist">
        <TabsList>
          <TabsTrigger value="waitlist">Waitlist & Applications</TabsTrigger>
          <TabsTrigger value="enrolled">Currently Enrolled</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Planning</TabsTrigger>
        </TabsList>

        <TabsContent value="waitlist" className="mt-4 space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search applications..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {filtered.map(app => (
                  <div key={app.id} className="p-5 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {app.childName.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{app.childName}</h3>
                          {priorityBadge(app.priority)}
                          {statusBadge(app.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          DOB: {app.dob} &bull; Age: {app.age} &bull; Parent: {app.parent} &bull; {app.phone}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Income: {app.income} &bull; Applied: {app.appliedDate}
                        </p>
                        {app.notes && <p className="text-xs text-primary mt-1">{app.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {app.status === "pending" && (
                          <>
                            <Button variant="outline" size="sm" className="text-xs gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />Approve
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs gap-1">
                              <XCircle className="h-3.5 w-3.5 text-red-500" />Deny
                            </Button>
                          </>
                        )}
                        {app.status === "approved" && (
                          <Button size="sm" className="text-xs gap-1">
                            Enroll <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {app.status === "reviewing" && (
                          <Button variant="outline" size="sm" className="text-xs">Review</Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrolled" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recently Enrolled — Current Program Year</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {enrolledThisYear.map((child, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {child.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{child.name}</p>
                    <p className="text-xs text-muted-foreground">Enrolled: {child.date} &bull; {child.classroom}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Enrolled</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capacity" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { room: "Room A", enrolled: 16, capacity: 17, teacher: "Ms. Patricia Lee" },
              { room: "Room B", enrolled: 16, capacity: 17, teacher: "Mr. Robert Chen" },
              { room: "Room C", enrolled: 15, capacity: 17, teacher: "Mr. Michael Torres" },
            ].map(room => {
              const pct = Math.round((room.enrolled / room.capacity) * 100);
              return (
                <Card key={room.room}>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-foreground">{room.room}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{room.teacher}</p>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Enrolled</span>
                        <span className="font-bold">{room.enrolled}/{room.capacity}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 95 ? "bg-red-500" : pct >= 85 ? "bg-yellow-500" : "bg-green-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{room.capacity - room.enrolled} open slot{room.capacity - room.enrolled !== 1 ? "s" : ""}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
