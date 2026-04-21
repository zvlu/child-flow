import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { CheckCircle2, XCircle, Clock, AlertCircle, Save, Download, CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const children = [
  { id: 1, name: "Emma Johnson", classroom: "Room A", status: "present" },
  { id: 2, name: "Marcus Williams", classroom: "Room A", status: "absent" },
  { id: 3, name: "Sofia Rodriguez", classroom: "Room A", status: "present" },
  { id: 4, name: "Jaylen Brown", classroom: "Room B", status: "present" },
  { id: 5, name: "Aaliyah Davis", classroom: "Room B", status: "excused" },
  { id: 6, name: "Noah Martinez", classroom: "Room B", status: "present" },
  { id: 7, name: "Zoe Thompson", classroom: "Room C", status: "absent" },
  { id: 8, name: "Elijah Garcia", classroom: "Room C", status: "present" },
  { id: 9, name: "Mia Anderson", classroom: "Room C", status: "present" },
  { id: 10, name: "Liam Jackson", classroom: "Room A", status: "half_day" },
];

const weeklyData = [
  { day: "Mon 4/14", present: 42, absent: 5 },
  { day: "Tue 4/15", present: 45, absent: 3 },
  { day: "Wed 4/16", present: 40, absent: 7 },
  { day: "Thu 4/17", present: 44, absent: 4 },
  { day: "Fri 4/18", present: 38, absent: 9 },
];

const statusConfig = {
  present: { label: "Present", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2, iconColor: "text-green-500" },
  absent: { label: "Absent", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle, iconColor: "text-red-500" },
  excused: { label: "Excused", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle, iconColor: "text-yellow-500" },
  half_day: { label: "Half Day", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock, iconColor: "text-blue-500" },
};

export default function Attendance() {
  const [date, setDate] = useState<Date>(new Date());
  const [classroom, setClassroom] = useState("all");
  const [attendance, setAttendance] = useState<Record<number, string>>(
    Object.fromEntries(children.map(c => [c.id, c.status]))
  );

  const filtered = children.filter(c => classroom === "all" || c.classroom === classroom);
  const presentCount = Object.values(attendance).filter(s => s === "present").length;
  const absentCount = Object.values(attendance).filter(s => s === "absent").length;
  const excusedCount = Object.values(attendance).filter(s => s === "excused").length;
  const halfDayCount = Object.values(attendance).filter(s => s === "half_day").length;
  const rate = Math.round((presentCount / children.length) * 100);

  const setStatus = (id: number, status: string) => {
    setAttendance(prev => ({ ...prev, [id]: status }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2"><Download className="h-4 w-4" />Export</Button>
          <Button size="sm" className="gap-2"><Save className="h-4 w-4" />Save Attendance</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total", value: children.length, color: "text-foreground", bg: "bg-muted/30" },
          { label: "Present", value: presentCount, color: "text-green-600", bg: "bg-green-50" },
          { label: "Absent", value: absentCount, color: "text-red-600", bg: "bg-red-50" },
          { label: "Excused", value: excusedCount, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Rate", value: `${rate}%`, color: rate >= 90 ? "text-green-600" : rate >= 80 ? "text-yellow-600" : "text-red-600", bg: "bg-primary/5" },
        ].map(stat => (
          <Card key={stat.label} className={stat.bg}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today's Attendance</TabsTrigger>
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={classroom} onValueChange={setClassroom}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Classroom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classrooms</SelectItem>
                <SelectItem value="Room A">Room A</SelectItem>
                <SelectItem value="Room B">Room B</SelectItem>
                <SelectItem value="Room C">Room C</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filtered.length} children</span>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {filtered.map(child => {
                  const currentStatus = attendance[child.id] || "present";
                  const initials = child.name.split(" ").map(n => n[0]).join("");
                  return (
                    <div key={child.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/20 transition-colors">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{child.name}</p>
                        <p className="text-xs text-muted-foreground">{child.classroom}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {Object.entries(statusConfig).map(([key, cfg]) => {
                          const Icon = cfg.icon;
                          const isSelected = currentStatus === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setStatus(child.id, key)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                                isSelected ? cfg.color : "bg-background text-muted-foreground border-border hover:bg-muted/30"
                              )}
                            >
                              <Icon className={cn("h-3.5 w-3.5", isSelected ? cfg.iconColor : "text-muted-foreground")} />
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Weekly Attendance Overview</CardTitle>
              <CardDescription>April 14 - 18, 2025</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weeklyData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                  <Bar dataKey="present" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} name="Present" />
                  <Bar dataKey="absent" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} name="Absent" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <div className="flex gap-6">
            <Card className="w-fit">
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  className="rounded-md"
                />
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">42</p>
                    <p className="text-xs text-muted-foreground">Present</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">5</p>
                    <p className="text-xs text-muted-foreground">Absent</p>
                  </div>
                  <div className="text-center p-3 bg-primary/5 rounded-lg">
                    <p className="text-2xl font-bold text-primary">89%</p>
                    <p className="text-xs text-muted-foreground">Rate</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Click a date on the calendar to view or edit attendance records for that day.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
