import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, Home, Phone, Mail, MapPin, Calendar, CheckCircle2, Clock, Users, Heart, BookOpen } from "lucide-react";

const families = [
  {
    id: 1, primaryContact: "Sarah Johnson", children: ["Emma Johnson"], phone: "(555) 234-5678",
    email: "sarah.johnson@email.com", address: "123 Oak St, Springfield, IL",
    incomeLevel: "Below 100% FPL", householdSize: 4, language: "English",
    lastContact: "2024-11-01", nextContact: "2024-12-01",
    goals: ["Employment support", "GED completion"],
    services: ["Food assistance", "Housing support"],
    homeVisits: 3, parentMeetings: 2, status: "active",
  },
  {
    id: 2, primaryContact: "James Williams", children: ["Marcus Williams"], phone: "(555) 345-6789",
    email: "james.williams@email.com", address: "456 Maple Ave, Springfield, IL",
    incomeLevel: "Below 100% FPL", householdSize: 3, language: "English",
    lastContact: "2024-10-15", nextContact: "2024-11-15",
    goals: ["Job training", "Transportation assistance"],
    services: ["Job placement", "Transportation vouchers"],
    homeVisits: 2, parentMeetings: 1, status: "active",
  },
  {
    id: 3, primaryContact: "Maria Rodriguez", children: ["Sofia Rodriguez"], phone: "(555) 456-7890",
    email: "maria.rodriguez@email.com", address: "789 Pine Rd, Springfield, IL",
    incomeLevel: "Below 130% FPL", householdSize: 5, language: "Spanish",
    lastContact: "2024-11-05", nextContact: "2024-12-05",
    goals: ["English language learning", "Healthcare access"],
    services: ["ESL classes", "Health insurance enrollment"],
    homeVisits: 4, parentMeetings: 3, status: "active",
  },
  {
    id: 4, primaryContact: "Tanya Brown", children: ["Jaylen Brown"], phone: "(555) 567-8901",
    email: "tanya.brown@email.com", address: "321 Elm St, Springfield, IL",
    incomeLevel: "Below 100% FPL", householdSize: 2, language: "English",
    lastContact: "2024-09-20", nextContact: "2024-10-20",
    goals: ["Stable housing", "Mental health support"],
    services: ["Housing assistance", "Counseling referral"],
    homeVisits: 1, parentMeetings: 1, status: "needs_contact",
  },
];

const upcomingContacts = [
  { family: "Johnson Family", type: "Home Visit", date: "Nov 15, 2024", coordinator: "Ms. Davis" },
  { family: "Williams Family", type: "Phone Check-in", date: "Nov 15, 2024", coordinator: "Ms. Davis" },
  { family: "Rodriguez Family", type: "Parent Meeting", date: "Nov 18, 2024", coordinator: "Mr. Chen" },
  { family: "Brown Family", type: "Home Visit", date: "Nov 20, 2024", coordinator: "Ms. Davis" },
];

export default function FamilyServices() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("families");

  const filtered = families.filter(f =>
    f.primaryContact.toLowerCase().includes(search.toLowerCase()) ||
    f.children.some(c => c.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Family Services</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage family partnerships, goals, and community resources</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Log Contact</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Families Served", value: families.length, icon: Users, color: "text-primary" },
          { label: "Home Visits (MTD)", value: families.reduce((a, f) => a + f.homeVisits, 0), icon: Home, color: "text-blue-600" },
          { label: "Parent Meetings", value: families.reduce((a, f) => a + f.parentMeetings, 0), icon: Calendar, color: "text-green-600" },
          { label: "Needs Contact", value: families.filter(f => f.status === "needs_contact").length, icon: Clock, color: "text-amber-600" },
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="families">Family Records</TabsTrigger>
          <TabsTrigger value="contacts">Upcoming Contacts</TabsTrigger>
          <TabsTrigger value="resources">Community Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="families" className="mt-4 space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search families..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(family => (
              <Card key={family.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-11 w-11 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {family.primaryContact.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground">{family.primaryContact}</h3>
                        <Badge className={family.status === "active" ? "bg-green-100 text-green-700 hover:bg-green-100 text-xs" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs"}>
                          {family.status === "active" ? "Active" : "Needs Contact"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Children: {family.children.join(", ")}</p>
                      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{family.phone}</div>
                        <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{family.address}</div>
                        <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />Last contact: {family.lastContact}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {family.goals.map(goal => (
                          <span key={goal} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{goal}</span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">Home Visits: <strong className="text-foreground">{family.homeVisits}</strong></span>
                        <span className="text-muted-foreground">Meetings: <strong className="text-foreground">{family.parentMeetings}</strong></span>
                        <span className="text-muted-foreground">Language: <strong className="text-foreground">{family.language}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1"><Phone className="h-3.5 w-3.5" />Call</Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1"><Home className="h-3.5 w-3.5" />Log Visit</Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1"><BookOpen className="h-3.5 w-3.5" />View File</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upcoming Family Contacts</CardTitle>
              <CardDescription>Scheduled home visits, phone check-ins, and parent meetings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingContacts.map((contact, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {contact.type === "Home Visit" ? <Home className="h-5 w-5 text-primary" /> :
                     contact.type === "Phone Check-in" ? <Phone className="h-5 w-5 text-primary" /> :
                     <Users className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">{contact.family}</p>
                    <p className="text-xs text-muted-foreground">{contact.type} &bull; {contact.coordinator}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{contact.date}</p>
                    <Badge variant="outline" className="text-xs mt-1">Scheduled</Badge>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs">Complete</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { category: "Food Assistance", resources: ["SNAP Benefits", "WIC Program", "Local Food Bank"], icon: Heart, color: "text-red-500 bg-red-50" },
              { category: "Housing Support", resources: ["Section 8 Vouchers", "Emergency Housing", "Utility Assistance"], icon: Home, color: "text-blue-500 bg-blue-50" },
              { category: "Education", resources: ["Adult ESL Classes", "GED Program", "Vocational Training"], icon: BookOpen, color: "text-green-500 bg-green-50" },
              { category: "Healthcare", resources: ["Medicaid Enrollment", "CHIP Program", "Community Health Center"], icon: Heart, color: "text-purple-500 bg-purple-50" },
              { category: "Employment", resources: ["Job Placement Services", "Resume Assistance", "Interview Coaching"], icon: Users, color: "text-amber-500 bg-amber-50" },
              { category: "Mental Health", resources: ["Counseling Services", "Crisis Hotline", "Support Groups"], icon: Heart, color: "text-pink-500 bg-pink-50" },
            ].map(cat => {
              const Icon = cat.icon;
              return (
                <Card key={cat.category} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${cat.color.split(" ")[1]}`}>
                        <Icon className={`h-5 w-5 ${cat.color.split(" ")[0]}`} />
                      </div>
                      <h3 className="font-semibold text-sm">{cat.category}</h3>
                    </div>
                    <ul className="space-y-1.5">
                      {cat.resources.map(r => (
                        <li key={r} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline" size="sm" className="w-full mt-3 text-xs">View Resources</Button>
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
