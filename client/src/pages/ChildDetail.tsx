import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, Edit, Heart, Phone, Mail, MapPin, 
  CheckCircle2, Users, Baby, ChevronRight, Plus,
  User, Calendar, Home, FileText, ShieldCheck, Clock, MessageSquare
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface ChildDetailProps { id: string; }

const mockChild = {
  id: 1, firstName: "Emma", lastName: "Johnson", dob: "2021-03-15", age: "3y 1m",
  gender: "Female", classroom: "Room A", teacher: "Ms. Patricia Lee",
  enrollmentDate: "2023-09-05", status: "active", race: "White", ethnicity: "Non-Hispanic",
  primaryLanguage: "English", iep: false, ifsp: false, familyId: 101,
  family: {
    primaryContact: "Sarah Johnson", relationship: "Mother",
    phone: "(555) 234-5678", email: "sarah.johnson@email.com",
    address: "123 Oak Street, Springfield, IL 62701",
    secondaryContact: "Michael Johnson", secondaryRelationship: "Father",
    secondaryPhone: "(555) 234-9012",
    incomeLevel: "Below 100% FPL", householdSize: 4,
  },
  health: {
    lastPhysical: "2024-01-15", nextPhysical: "2025-01-15",
    lastDental: "2024-06-10", nextDental: "2024-12-10",
    lastVision: "2024-02-20", nextVision: "2025-02-20",
    lastHearing: "2024-02-20",
    immunizationStatus: "current",
    allergies: "None known", medications: "None",
    specialNeeds: "None", bloodType: "A+",
  },
  attendance: { rate: 94, daysPresent: 47, daysAbsent: 3, daysExcused: 0 },
  assessments: [
    { date: "2024-10-15", tool: "ASQ-3", domain: "Communication", score: 50, status: "On Track" },
    { date: "2024-10-15", tool: "ASQ-3", domain: "Gross Motor", score: 55, status: "On Track" },
    { date: "2024-10-15", tool: "ASQ-3", domain: "Fine Motor", score: 45, status: "Monitor" },
    { date: "2024-10-15", tool: "ASQ-3", domain: "Problem Solving", score: 60, status: "On Track" },
    { date: "2024-10-15", tool: "ASQ-3", domain: "Personal-Social", score: 50, status: "On Track" },
  ],
  notes: [
    { date: "2024-11-01", author: "Ms. Lee", note: "Emma is making excellent progress in language development. She is now using 3-4 word sentences consistently." },
    { date: "2024-10-15", author: "Health Coordinator", note: "Annual physical completed. All immunizations up to date." },
  ],
};

export default function ChildDetail({ id }: ChildDetailProps) {
  const child = mockChild;
  const initials = `${child.firstName[0]}${child.lastName[0]}`;

  // Sibling Query
  const { data: siblings, isLoading: isSiblingsLoading } = trpc.children.siblings.useQuery(child.familyId);

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc] min-h-full">
      <div className="flex items-center gap-4">
        <Link href="/children">
          <Button variant="ghost" size="sm" className="gap-2 rounded-full font-bold">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-14 w-14 rounded-2xl border-2 border-primary/10">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{child.firstName} {child.lastName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-green-100 text-green-700 border-green-200 rounded-full px-3 font-bold">Active</Badge>
              <span className="text-sm text-slate-500 font-medium">{child.age} &bull; {child.classroom} &bull; {child.teacher}</span>
            </div>
          </div>
        </div>
        <Button size="sm" className="gap-2 rounded-full font-bold shadow-md"><Edit className="h-4 w-4" /> Edit Profile</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Attendance Rate", value: `${child.attendance.rate}%`, color: "text-green-600" },
              { label: "Days Present", value: child.attendance.daysPresent, color: "text-slate-700" },
              { label: "Health Status", value: "Current", color: "text-green-600" },
              { label: "Enrolled Since", value: child.enrollmentDate, color: "text-slate-700" },
            ].map(stat => (
              <Card key={stat.label} className="rounded-2xl border-slate-200 shadow-sm">
                <CardContent className="p-4 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{stat.label}</p>
                  <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="bg-white border border-slate-200 p-1 rounded-2xl w-fit shadow-sm mb-6">
              <TabsTrigger value="profile" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Profile</TabsTrigger>
              <TabsTrigger value="health" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Health</TabsTrigger>
              <TabsTrigger value="attendance" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Attendance</TabsTrigger>
              <TabsTrigger value="assessments" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Assessments</TabsTrigger>
              <TabsTrigger value="family" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Family</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> Child Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3 text-sm">
                    {[
                      ["Date of Birth", child.dob], ["Age", child.age], ["Gender", child.gender],
                      ["Race", child.race], ["Ethnicity", child.ethnicity], ["Primary Language", child.primaryLanguage],
                      ["IEP", child.iep ? "Yes" : "No"], ["IFSP", child.ifsp ? "Yes" : "No"],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">{label as string}</span>
                        <span className="font-bold text-slate-700">{value as string}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Enrollment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3 text-sm">
                    {[
                      ["Enrollment Date", child.enrollmentDate], ["Classroom", child.classroom],
                      ["Teacher", child.teacher], ["Status", "Active"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">{label}</span>
                        <span className="font-bold text-slate-700">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" /> Notes and Observations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {child.notes.map((note, i) => (
                    <div key={i} className="border-l-4 border-primary/20 pl-4 py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">{note.author}</span>
                        <span className="text-[10px] font-bold text-slate-400">{note.date}</span>
                      </div>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">{note.note}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="health" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" /> Health Screenings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-sm">
                    {[
                      ["Last Physical", child.health.lastPhysical, "Next: " + child.health.nextPhysical],
                      ["Last Dental", child.health.lastDental, "Next: " + child.health.nextDental],
                      ["Last Vision", child.health.lastVision, "Next: " + child.health.nextVision],
                      ["Last Hearing", child.health.lastHearing, ""],
                    ].map(([label, date, next]) => (
                      <div key={label} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div>
                          <p className="font-bold text-slate-700">{label}</p>
                          {next && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{next}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-600">{date}</span>
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Medical Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3 text-sm">
                    {[
                      ["Immunization Status", "Current"], ["Blood Type", child.health.bloodType],
                      ["Allergies", child.health.allergies], ["Medications", child.health.medications],
                      ["Special Needs", child.health.specialNeeds],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">{label}</span>
                        <span className="font-bold text-slate-700">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="attendance" className="mt-0">
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Attendance Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="text-center p-4 rounded-2xl bg-green-50 border border-green-100">
                      <p className="text-3xl font-bold text-green-600">{child.attendance.daysPresent}</p>
                      <p className="text-[10px] font-bold uppercase text-green-700/60 tracking-widest mt-1">Days Present</p>
                    </div>
                    <div className="text-center p-4 rounded-2xl bg-red-50 border border-red-100">
                      <p className="text-3xl font-bold text-red-500">{child.attendance.daysAbsent}</p>
                      <p className="text-[10px] font-bold uppercase text-red-700/60 tracking-widest mt-1">Days Absent</p>
                    </div>
                    <div className="text-center p-4 rounded-2xl bg-amber-50 border border-amber-100">
                      <p className="text-3xl font-bold text-amber-500">{child.attendance.daysExcused}</p>
                      <p className="text-[10px] font-bold uppercase text-amber-700/60 tracking-widest mt-1">Excused</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">Overall Attendance Rate</span>
                      <span className="font-bold text-primary">{child.attendance.rate}%</span>
                    </div>
                    <Progress value={child.attendance.rate} className="h-3 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assessments" className="mt-0">
              <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Developmental Assessments (ASQ-3)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {child.assessments.map((a, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-sm font-bold text-slate-700">{a.domain}</span>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{a.date}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={cn(
                            "rounded-full px-3 font-bold border-none",
                            a.status === "On Track" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {a.status}
                          </Badge>
                          <span className="text-sm font-bold text-slate-800 w-12 text-right">{a.score}/60</span>
                        </div>
                      </div>
                      <Progress value={(a.score / 60) * 100} className="h-2 rounded-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="family" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Home className="h-4 w-4 text-primary" /> Primary Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-sm">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="font-bold text-lg text-slate-800">{child.family.primaryContact}</div>
                      <div className="text-xs font-bold text-primary uppercase tracking-widest mt-0.5">{child.family.relationship}</div>
                    </div>
                    <div className="space-y-3 px-2">
                      <div className="flex items-center gap-3 font-bold text-slate-600">
                        <Phone className="h-4 w-4 text-slate-400" /> {child.family.phone}
                      </div>
                      <div className="flex items-center gap-3 font-bold text-slate-600">
                        <Mail className="h-4 w-4 text-slate-400" /> {child.family.email}
                      </div>
                      <div className="flex items-start gap-3 font-bold text-slate-600">
                        <MapPin className="h-4 w-4 text-slate-400 mt-0.5" /> {child.family.address}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Family Eligibility
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4 text-sm">
                    <div className="flex justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Income Level</span>
                      <span className="font-bold text-slate-700">{child.family.incomeLevel}</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Household Size</span>
                      <span className="font-bold text-slate-700">{child.family.householdSize} members</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar: Sibling Grouping */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-primary/20 shadow-md overflow-hidden bg-primary/5">
            <CardHeader className="border-b border-primary/10 bg-primary/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                  <Users className="h-5 w-5" /> Sibling Group
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-primary hover:bg-primary/20">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-primary/70 font-bold text-[11px] uppercase tracking-tight">Linked to this family</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {isSiblingsLoading ? (
                <div className="py-4 text-center text-sm text-slate-400 font-bold">Loading siblings...</div>
              ) : siblings && siblings.length > 1 ? (
                siblings.filter((s: any) => s.id !== child.id).map((sibling: any) => (
                  <Link key={sibling.id} href={`/children/${sibling.id}`}>
                    <a className="flex items-center justify-between p-3 rounded-2xl bg-white border border-primary/10 hover:border-primary/30 hover:shadow-sm transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {sibling.firstName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 group-hover:text-primary transition-colors">{sibling.firstName} {sibling.lastName}</p>
                          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tighter">
                            {sibling.status} • {sibling.gender}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                    </a>
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Users className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-500 font-bold">No siblings linked</p>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">Add a sibling to share family data</p>
                  <Button variant="outline" size="sm" className="mt-4 rounded-full font-bold text-xs border-slate-200 hover:bg-primary hover:text-white hover:border-primary transition-all">
                    Link Sibling
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
              <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-widest">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Button variant="ghost" className="w-full justify-start rounded-xl font-bold text-slate-600 hover:text-primary hover:bg-primary/5">
                <Plus className="h-4 w-4 mr-2" /> Add Health Record
              </Button>
              <Button variant="ghost" className="w-full justify-start rounded-xl font-bold text-slate-600 hover:text-primary hover:bg-primary/5">
                <Plus className="h-4 w-4 mr-2" /> Log Attendance
              </Button>
              <Button variant="ghost" className="w-full justify-start rounded-xl font-bold text-slate-600 hover:text-primary hover:bg-primary/5">
                <Plus className="h-4 w-4 mr-2" /> New Assessment
              </Button>
              <Button variant="ghost" className="w-full justify-start rounded-xl font-bold text-slate-600 hover:text-primary hover:bg-primary/5">
                <Printer className="h-4 w-4 mr-2" /> Print Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BarChart3(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  )
}

function Printer(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  )
}
