import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, Bell, Lock, Users, Building2, Save, Check } from "lucide-react";

export default function Settings() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage program settings, users, and preferences</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200">
            <Check className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Saved successfully</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="program">
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="program">Program</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Program Settings */}
        <TabsContent value="program" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Program Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="program-name">Program Name</Label>
                  <Input id="program-name" defaultValue="Springfield Head Start" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="program-id">Program ID</Label>
                  <Input id="program-id" defaultValue="IL-001" disabled className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="director">Program Director</Label>
                  <Input id="director" defaultValue="Lisa Thompson" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="director-email">Director Email</Label>
                  <Input id="director-email" type="email" defaultValue="l.thompson@childflow.org" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Program Address</Label>
                <Input id="address" defaultValue="123 Education Lane, Springfield, IL 62701" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" defaultValue="(555) 111-0000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="info@childflow.org" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Total Capacity</Label>
                  <Input id="capacity" type="number" defaultValue="51" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classrooms">Number of Classrooms</Label>
                  <Input id="classrooms" type="number" defaultValue="3" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="program-year">Program Year</Label>
                <Select defaultValue="2024-2025">
                  <SelectTrigger id="program-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                    <SelectItem value="2023-2024">2023-2024</SelectItem>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full gap-2"><Save className="h-4 w-4" />Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Program Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="open-time">Opening Time</Label>
                  <Input id="open-time" type="time" defaultValue="08:00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="close-time">Closing Time</Label>
                  <Input id="close-time" type="time" defaultValue="17:00" />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full gap-2"><Save className="h-4 w-4" />Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Management */}
        <TabsContent value="users" className="mt-4 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Staff Users</h3>
            <Button size="sm" className="gap-2"><Users className="h-4 w-4" />Add User</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {[
                  { name: "Lisa Thompson", role: "Program Director", email: "l.thompson@childflow.org", status: "active", permissions: "Full Access" },
                  { name: "Patricia Lee", role: "Lead Teacher", email: "p.lee@childflow.org", status: "active", permissions: "Classroom" },
                  { name: "Angela Davis", role: "Teacher Assistant", email: "a.davis@childflow.org", status: "active", permissions: "Classroom" },
                  { name: "Jennifer Kim", role: "Family Service Worker", email: "j.kim@childflow.org", status: "active", permissions: "Family Services" },
                  { name: "David Martinez", role: "Health Coordinator", email: "d.martinez@childflow.org", status: "active", permissions: "Health" },
                ].map(user => (
                  <div key={user.email} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                    <div>
                      <p className="font-medium text-sm text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.role} • {user.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">{user.permissions}</Badge>
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Active</Badge>
                      <Button variant="ghost" size="sm" className="text-xs">Edit</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Health Screening Reminders", description: "Get alerts when health screenings are due or overdue" },
                { label: "Attendance Alerts", description: "Notify when attendance falls below threshold" },
                { label: "Enrollment Updates", description: "Updates on applications and waitlist changes" },
                { label: "Family Services Reminders", description: "Reminders for home visits and parent meetings" },
                { label: "Staff Training Alerts", description: "Notifications about training requirements" },
                { label: "Compliance Reminders", description: "PIR submission and compliance deadline alerts" },
                { label: "Daily Digest", description: "Receive a daily summary of key metrics" },
                { label: "Email Notifications", description: "Receive notifications via email" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
              <Button onClick={handleSave} className="w-full gap-2"><Save className="h-4 w-4" />Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Password & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" placeholder="••••••••" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" placeholder="••••••••" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input id="confirm-password" type="password" placeholder="••••••••" />
              </div>
              <Button className="w-full gap-2"><Save className="h-4 w-4" />Update Password</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium text-sm text-foreground">Enable 2FA</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Add an extra layer of security to your account</p>
                </div>
                <Switch />
              </div>
              <p className="text-xs text-muted-foreground">Two-factor authentication requires you to verify your identity using a second method when logging in.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Active Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { device: "Chrome on Windows", location: "Springfield, IL", lastActive: "Just now" },
                { device: "Safari on macOS", location: "Springfield, IL", lastActive: "2 hours ago" },
              ].map((session, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm text-foreground">{session.device}</p>
                    <p className="text-xs text-muted-foreground">{session.location} • {session.lastActive}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-destructive">Sign Out</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
