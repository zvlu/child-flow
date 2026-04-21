import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Plus, Filter, Baby, Heart, ClipboardCheck, Home,
  ChevronRight, Download, Upload, MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const mockChildren = [
  { id: 1, firstName: "Emma", lastName: "Johnson", dob: "2021-03-15", age: "3y 1m", classroom: "Room A", status: "active", healthStatus: "current", attendanceRate: 94, familyContact: "Sarah Johnson" },
  { id: 2, firstName: "Marcus", lastName: "Williams", dob: "2020-11-08", age: "3y 5m", classroom: "Room B", status: "active", healthStatus: "due_soon", attendanceRate: 88, familyContact: "James Williams" },
  { id: 3, firstName: "Sofia", lastName: "Rodriguez", dob: "2021-06-22", age: "2y 10m", classroom: "Room A", status: "active", healthStatus: "current", attendanceRate: 97, familyContact: "Maria Rodriguez" },
  { id: 4, firstName: "Jaylen", lastName: "Brown", dob: "2020-09-14", age: "3y 7m", classroom: "Room C", status: "active", healthStatus: "overdue", attendanceRate: 72, familyContact: "Tanya Brown" },
  { id: 5, firstName: "Aaliyah", lastName: "Davis", dob: "2021-01-30", age: "3y 3m", classroom: "Room B", status: "active", healthStatus: "current", attendanceRate: 91, familyContact: "Kevin Davis" },
  { id: 6, firstName: "Noah", lastName: "Martinez", dob: "2020-07-05", age: "3y 9m", classroom: "Room C", status: "active", healthStatus: "current", attendanceRate: 85, familyContact: "Carmen Martinez" },
  { id: 7, firstName: "Zoe", lastName: "Thompson", dob: "2021-04-18", age: "3y 0m", classroom: "Room A", status: "inactive", healthStatus: "due_soon", attendanceRate: 60, familyContact: "David Thompson" },
  { id: 8, firstName: "Elijah", lastName: "Garcia", dob: "2020-12-01", age: "3y 4m", classroom: "Room B", status: "active", healthStatus: "current", attendanceRate: 96, familyContact: "Rosa Garcia" },
];

const healthBadge = (status: string) => {
  if (status === "current") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Current</Badge>;
  if (status === "due_soon") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">Due Soon</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Overdue</Badge>;
};

const statusBadge = (status: string) => {
  if (status === "active") return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>;
  return <Badge variant="secondary">Inactive</Badge>;
};

export default function Children() {
  const [search, setSearch] = useState("");
  const [classroomFilter, setClassroomFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = mockChildren.filter(c => {
    const matchSearch = `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase());
    const matchClassroom = classroomFilter === "all" || c.classroom === classroomFilter;
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchClassroom && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Children</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{filtered.length} of {mockChildren.length} children</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Link href="/enrollment">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add Child
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active", value: mockChildren.filter(c => c.status === "active").length, color: "text-green-600" },
          { label: "Health Current", value: mockChildren.filter(c => c.healthStatus === "current").length, color: "text-green-600" },
          { label: "Health Due Soon", value: mockChildren.filter(c => c.healthStatus === "due_soon").length, color: "text-yellow-600" },
          { label: "Health Overdue", value: mockChildren.filter(c => c.healthStatus === "overdue").length, color: "text-red-600" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search children..."
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={classroomFilter} onValueChange={setClassroomFilter}>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Children Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">Child</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Age</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Classroom</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Health</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Attendance</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Family Contact</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(child => {
                  const initials = `${child.firstName[0]}${child.lastName[0]}`;
                  return (
                    <tr key={child.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-sm text-foreground">{child.firstName} {child.lastName}</p>
                            <p className="text-xs text-muted-foreground">DOB: {child.dob}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-foreground">{child.age}</td>
                      <td className="px-4 py-4 text-sm text-foreground">{child.classroom}</td>
                      <td className="px-4 py-4">{statusBadge(child.status)}</td>
                      <td className="px-4 py-4">{healthBadge(child.healthStatus)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${child.attendanceRate >= 90 ? "bg-green-500" : child.attendanceRate >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
                              style={{ width: `${child.attendanceRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{child.attendanceRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{child.familyContact}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <Link href={`/children/${child.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs">
                              View <ChevronRight className="h-3 w-3" />
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Edit Profile</DropdownMenuItem>
                              <DropdownMenuItem>Health Records</DropdownMenuItem>
                              <DropdownMenuItem>Attendance History</DropdownMenuItem>
                              <DropdownMenuItem>Family Info</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">Withdraw</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Baby className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No children found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
