import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Edit, Heart, Phone, Mail, MapPin, CheckCircle2 } from "lucide-react";

interface ChildDetailProps { id: string; }

const mockChild = {
  id: 1, firstName: "Emma", lastName: "Johnson", dob: "2021-03-15", age: "3y 1m",
  gender: "Female", classroom: "Room A", teacher: "Ms. Patricia Lee",
  enrollmentDate: "2023-09-05", status: "active", race: "White", ethnicity: "Non-Hispanic",
  primaryLanguage: "English", iep: false, ifsp: false,
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/children">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{child.firstName} {child.lastName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>
              <span className="text-sm text-muted-foreground">{child.age} &bull; {child.classroom} &bull; {child.teacher}</span>
            </div>
          </div>
        </div>
        <Button size="sm" className="gap-2"><Edit className="h-4 w-4" /> Edit Profile</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Attendance Rate", value: `${child.attendance.rate}%`, color: "text-green-600" },
          { label: "Days Present", value: child.attendance.daysPresent, color: "text-foreground" },
          { label: "Health Status", value: "Current", color: "text-green-600" },
          { label: "Enrolled Since", value: child.enrollmentDate, color: "text-foreground" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="family">Family</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Child Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  ["Date of Birth", child.dob], ["Age", child.age], ["Gender", child.gender],
                  ["Race", child.race], ["Ethnicity", child.ethnicity], ["Primary Language", child.primaryLanguage],
                  ["IEP", child.iep ? "Yes" : "No"], ["IFSP", child.ifsp ? "Yes" : "No"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Enrollment Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  ["Enrollment Date", child.enrollmentDate], ["Classroom", child.classroom],
                  ["Teacher", child.teacher], ["Status", "Active"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Notes and Observations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {child.notes.map((note, i) => (
                <div key={i} className="border-l-2 border-primary/30 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-primary">{note.author}</span>
                    <span className="text-xs text-muted-foreground">{note.date}</span>
                  </div>
                  <p className="text-sm text-foreground">{note.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4 text-red-500" />Health Screenings</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  ["Last Physical", child.health.lastPhysical, "Next: " + child.health.nextPhysical],
                  ["Last Dental", child.health.lastDental, "Next: " + child.health.nextDental],
                  ["Last Vision", child.health.lastVision, "Next: " + child.health.nextVision],
                  ["Last Hearing", child.health.lastHearing, ""],
                ].map(([label, date, next]) => (
                  <div key={label} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{label}</p>
                      {next && <p className="text-xs text-muted-foreground">{next}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{date}</span>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Medical Information</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  ["Immunization Status", "Current"], ["Blood Type", child.health.bloodType],
                  ["Allergies", child.health.allergies], ["Medications", child.health.medications],
                  ["Special Needs", child.health.specialNeeds],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Attendance Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="text-center"><p className="text-3xl font-bold text-green-600">{child.attendance.daysPresent}</p><p className="text-sm text-muted-foreground">Days Present</p></div>
                <div className="text-center"><p className="text-3xl font-bold text-red-500">{child.attendance.daysAbsent}</p><p className="text-sm text-muted-foreground">Days Absent</p></div>
                <div className="text-center"><p className="text-3xl font-bold text-yellow-500">{child.attendance.daysExcused}</p><p className="text-sm text-muted-foreground">Excused</p></div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span>Overall Rate</span><span className="font-bold">{child.attendance.rate}%</span></div>
                <Progress value={child.attendance.rate} className="h-3" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments" className="mt-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Developmental Assessments (ASQ-3)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {child.assessments.map((a, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{a.domain}</span>
                        <Badge className={a.status === "On Track" ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"}>{a.status}</Badge>
                      </div>
                      <Progress value={(a.score / 60) * 100} className="h-2" />
                    </div>
                    <span className="text-sm font-bold w-12 text-right">{a.score}/60</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="family" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Primary Contact</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="font-semibold text-base">{child.family.primaryContact}</div>
                <div className="text-muted-foreground">{child.family.relationship}</div>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{child.family.phone}</div>
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{child.family.email}</div>
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{child.family.address}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Family Eligibility</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Income Level</span><span className="font-medium">{child.family.incomeLevel}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Household Size</span><span className="font-medium">{child.family.householdSize} members</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
