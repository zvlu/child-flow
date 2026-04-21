import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Heart, Eye, Stethoscope, Syringe, AlertTriangle, CheckCircle2, Clock, Download } from "lucide-react";

const healthRecords = [
  { id: 1, name: "Emma Johnson", age: "3y 1m", classroom: "Room A",
    physical: { date: "2024-01-15", due: "2025-01-15", status: "current" },
    dental: { date: "2024-06-10", due: "2024-12-10", status: "due_soon" },
    vision: { date: "2024-02-20", due: "2025-02-20", status: "current" },
    hearing: { date: "2024-02-20", due: "2025-02-20", status: "current" },
    immunizations: "current", allergies: "None" },
  { id: 2, name: "Marcus Williams", age: "3y 5m", classroom: "Room A",
    physical: { date: "2023-11-08", due: "2024-11-08", status: "overdue" },
    dental: { date: "2024-05-15", due: "2024-11-15", status: "overdue" },
    vision: { date: "2023-11-08", due: "2024-11-08", status: "overdue" },
    hearing: { date: "2023-11-08", due: "2024-11-08", status: "overdue" },
    immunizations: "overdue", allergies: "Peanuts" },
  { id: 3, name: "Sofia Rodriguez", age: "2y 10m", classroom: "Room A",
    physical: { date: "2024-06-22", due: "2025-06-22", status: "current" },
    dental: { date: "2024-07-10", due: "2025-01-10", status: "current" },
    vision: { date: "2024-06-22", due: "2025-06-22", status: "current" },
    hearing: { date: "2024-06-22", due: "2025-06-22", status: "current" },
    immunizations: "current", allergies: "None" },
  { id: 4, name: "Jaylen Brown", age: "3y 7m", classroom: "Room C",
    physical: { date: "2024-09-14", due: "2025-09-14", status: "current" },
    dental: { date: "2024-03-20", due: "2024-09-20", status: "overdue" },
    vision: { date: "2024-09-14", due: "2025-09-14", status: "current" },
    hearing: { date: "2024-09-14", due: "2025-09-14", status: "current" },
    immunizations: "due_soon", allergies: "Latex" },
  { id: 5, name: "Aaliyah Davis", age: "3y 3m", classroom: "Room B",
    physical: { date: "2024-01-30", due: "2025-01-30", status: "current" },
    dental: { date: "2024-07-30", due: "2025-01-30", status: "due_soon" },
    vision: { date: "2024-01-30", due: "2025-01-30", status: "current" },
    hearing: { date: "2024-01-30", due: "2025-01-30", status: "current" },
    immunizations: "current", allergies: "None" },
];

const immunizationSchedule = [
  { vaccine: "DTaP", doses: 5, completed: 4, due: "2024-12-15" },
  { vaccine: "IPV", doses: 4, completed: 4, due: null },
  { vaccine: "MMR", doses: 2, completed: 2, due: null },
  { vaccine: "Varicella", doses: 2, completed: 1, due: "2025-01-20" },
  { vaccine: "Hib", doses: 4, completed: 4, due: null },
  { vaccine: "PCV13", doses: 4, completed: 4, due: null },
  { vaccine: "Hep A", doses: 2, completed: 2, due: null },
  { vaccine: "Hep B", doses: 3, completed: 3, due: null },
  { vaccine: "Flu", doses: 1, completed: 0, due: "2024-11-01" },
];

const statusBadge = (status: string) => {
  if (status === "current") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Current</Badge>;
  if (status === "due_soon") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100 text-xs">Due Soon</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Overdue</Badge>;
};

export default function Health() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = healthRecords.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ||
      (filter === "overdue" && (r.physical.status === "overdue" || r.dental.status === "overdue" || r.immunizations === "overdue")) ||
      (filter === "due_soon" && (r.physical.status === "due_soon" || r.dental.status === "due_soon" || r.immunizations === "due_soon")) ||
      (filter === "current" && r.physical.status === "current" && r.dental.status === "current" && r.immunizations === "current");
    return matchSearch && matchFilter;
  });

  const overdueCount = healthRecords.filter(r => r.physical.status === "overdue" || r.dental.status === "overdue" || r.immunizations === "overdue").length;
  const dueSoonCount = healthRecords.filter(r => r.physical.status === "due_soon" || r.dental.status === "due_soon" || r.immunizations === "due_soon").length;
  const currentCount = healthRecords.filter(r => r.physical.status === "current" && r.dental.status === "current" && r.immunizations === "current").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Health Records</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track screenings, immunizations, and medical information</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" />Export</Button>
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Add Record</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Children", value: healthRecords.length, color: "text-foreground", icon: Heart },
          { label: "All Current", value: currentCount, color: "text-green-600", icon: CheckCircle2 },
          { label: "Due Soon", value: dueSoonCount, color: "text-yellow-600", icon: Clock },
          { label: "Overdue", value: overdueCount, color: "text-red-600", icon: AlertTriangle },
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

      <Tabs defaultValue="screenings">
        <TabsList>
          <TabsTrigger value="screenings">Screenings</TabsTrigger>
          <TabsTrigger value="immunizations">Immunizations</TabsTrigger>
          <TabsTrigger value="allergies">Allergies & Medical</TabsTrigger>
        </TabsList>

        <TabsContent value="screenings" className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search children..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="due_soon">Due Soon</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Child</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 flex items-center gap-1"><Stethoscope className="h-3 w-3" />Physical</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Dental</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Vision</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Hearing</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3"><Syringe className="h-3 w-3 inline mr-1" />Immunizations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(record => {
                      const initials = record.name.split(" ").map(n => n[0]).join("");
                      return (
                        <tr key={record.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-sm">{record.name}</p>
                                <p className="text-xs text-muted-foreground">{record.age} &bull; {record.classroom}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div>{statusBadge(record.physical.status)}</div>
                            <p className="text-xs text-muted-foreground mt-1">{record.physical.date}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div>{statusBadge(record.dental.status)}</div>
                            <p className="text-xs text-muted-foreground mt-1">{record.dental.date}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div>{statusBadge(record.vision.status)}</div>
                            <p className="text-xs text-muted-foreground mt-1">{record.vision.date}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div>{statusBadge(record.hearing.status)}</div>
                            <p className="text-xs text-muted-foreground mt-1">{record.hearing.date}</p>
                          </td>
                          <td className="px-4 py-4">{statusBadge(record.immunizations)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="immunizations" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Immunization Schedule Tracker</CardTitle>
              <CardDescription>Emma Johnson &mdash; select a child to view their schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {immunizationSchedule.map(vax => {
                  const pct = (vax.completed / vax.doses) * 100;
                  const complete = vax.completed === vax.doses;
                  return (
                    <div key={vax.vaccine} className="flex items-center gap-4">
                      <div className="w-20 text-sm font-medium">{vax.vaccine}</div>
                      <div className="flex-1">
                        <div className="flex gap-1">
                          {Array.from({ length: vax.doses }).map((_, i) => (
                            <div
                              key={i}
                              className={`h-6 flex-1 rounded text-xs flex items-center justify-center font-medium ${i < vax.completed ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}
                            >
                              {i + 1}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="w-28 text-right">
                        {complete ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Complete</Badge>
                        ) : vax.due ? (
                          <span className="text-xs text-muted-foreground">Due: {vax.due}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allergies" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Allergies and Medical Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {healthRecords.filter(r => r.allergies !== "None").map(record => (
                  <div key={record.id} className="flex items-center gap-4 p-4 rounded-lg border border-red-200 bg-red-50">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-foreground">{record.name}</p>
                      <p className="text-sm text-red-700">Allergy: {record.allergies}</p>
                    </div>
                  </div>
                ))}
                {healthRecords.filter(r => r.allergies === "None").length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {healthRecords.filter(r => r.allergies === "None").length} children have no known allergies
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
