import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Settings as SettingsIcon, Bell, Lock, Users, Building2, Save, UserCircle, Loader2, Plus, Trash2, ShieldCheck, LayoutGrid, ChevronUp, ChevronDown, RotateCcw, Eye, EyeOff, Camera } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsAdmin } from "@/_core/hooks/useIsAdmin";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  TOP_NAV_PRIMARY_COUNT, sortByOrder, topNavForRole, sideNavForRole,
  type NavItem, type NavSection, type NavRole,
} from "@/config/nav";

const roleLabel: Record<string, string> = { admin: "Administrator", staff: "Staff", parent: "Parent" };

const staffRoleLabel: Record<string, string> = {
  admin: "Administrator", teacher: "Teacher", assistant: "Assistant", coordinator: "Coordinator",
};

// Notification preferences keyed by a stable id (persisted in users.settings).
// A missing value is treated as ON, so existing accounts default to opted-in.
const NOTIFICATION_PREFS = [
  { id: "health_screening", label: "Health Screening Reminders", description: "Get alerts when health screenings are due or overdue" },
  { id: "attendance", label: "Attendance Alerts", description: "Notify when attendance falls below threshold" },
  { id: "enrollment", label: "Enrollment Updates", description: "Updates on applications and waitlist changes" },
  { id: "family_services", label: "Family Services Reminders", description: "Reminders for home visits and parent meetings" },
  { id: "staff_training", label: "Staff Training Alerts", description: "Notifications about training requirements" },
  { id: "compliance", label: "Compliance Reminders", description: "PIR submission and compliance deadline alerts" },
  { id: "daily_digest", label: "Daily Digest", description: "Receive a daily summary of key metrics" },
  { id: "email", label: "Email Notifications", description: "Receive notifications via email" },
] as const;

const ROLE_COLORS = ["sage", "peach", "indigo", "amber", "red", "blue"] as const;
type RoleColor = (typeof ROLE_COLORS)[number];

const roleColorClasses: Record<RoleColor, string> = {
  sage: "bg-primary/10 text-primary border-primary/20",
  peach: "bg-orange-100 text-orange-700 border-orange-200",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  red: "bg-red-100 text-red-700 border-red-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function Settings() {
  const { user, loading, refresh } = useAuth();
  const isAdmin = useIsAdmin();

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

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
      </div>

      <Tabs defaultValue="account">
        <TabsList className={`grid w-full ${isAdmin ? "grid-cols-6 max-w-3xl" : "grid-cols-4 max-w-xl"}`}>
          <TabsTrigger value="account">Account</TabsTrigger>
          {isAdmin && <TabsTrigger value="program">Program</TabsTrigger>}
          {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Account — the real signed-in user, with an editable display name */}
        <TabsContent value="account" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-primary" />
                My Account
              </CardTitle>
              <CardDescription>Your profile as it appears across Sprout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : !user ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  You're not signed in. <a href="/" className="text-primary font-medium">Return to sign in</a>.
                </div>
              ) : (
                <AccountForm user={user} initials={initials} onSaved={refresh} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Program Settings (admin only) */}
        {isAdmin && (
        <TabsContent value="program" className="mt-4 space-y-4">
          <ProgramSettings />
          <PlanUsageCard />
        </TabsContent>
        )}

        {/* User Management (admin only) — real staff + custom role labels */}
        {isAdmin && (
        <TabsContent value="users" className="mt-4 space-y-6">
          <CustomRolesManager />
          <StaffUsers />
        </TabsContent>
        )}

        {/* Layout — customize the sidebar + top nav (all roles) */}
        <TabsContent value="layout" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <NavigationSettings key={(user as any)?.id ?? "anon"} settings={user?.settings} role={((user as any)?.role ?? "staff") as NavRole} onSaved={refresh} disabled={!user} />
          )}
        </TabsContent>

        {/* Notifications — persisted per user */}
        <TabsContent value="notifications" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <NotificationPreferences settings={user?.settings} onSaved={refresh} disabled={!user} />
          )}
        </TabsContent>

        {/* Security — real password change + persisted 2FA */}
        <TabsContent value="security" className="mt-4 space-y-4">
          <PasswordCard hasPassword={Boolean((user as any)?.hasPassword)} disabled={!user} />
          <TwoFactorCard enabled={Boolean(user?.settings?.twoFactorEnabled)} onSaved={refresh} disabled={!user} />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Active Sessions</CardTitle>
              <CardDescription>This is the device you're currently signed in on.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium text-sm text-foreground">This device</p>
                  <p className="text-xs text-muted-foreground">
                    Last signed in {user?.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString() : "—"}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">Current</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------- Account ----------------------------- */

/**
 * Read an image File, center-crop to a square and downscale to `size`px, then
 * return a compact JPEG data URL. Keeps avatars small enough to live in the DB
 * column and travel over tRPC.
 */
async function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode failed"));
    i.src = sourceUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas context");
  const min = Math.min(img.width, img.height);
  const sx = (img.width - min) / 2;
  const sy = (img.height - min) / 2;
  ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function AccountForm({ user, initials, onSaved }: { user: any; initials: string; onSaved: () => Promise<void> }) {
  const [name, setName] = useState<string>(user.name ?? "");
  useEffect(() => { setName(user.name ?? ""); }, [user.name]);

  const [avatar, setAvatar] = useState<string | null>(user.avatarUrl ?? null);
  useEffect(() => { setAvatar(user.avatarUrl ?? null); }, [user.avatarUrl]);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => { await onSaved(); toast.success("Profile updated"); },
    onError: (e) => toast.error(e.message || "Could not update profile"),
  });

  const setAvatarMut = trpc.auth.setAvatar.useMutation({
    onSuccess: async () => { await onSaved(); },
    onError: (e) => { setAvatar(user.avatarUrl ?? null); toast.error(e.message || "Could not update picture"); },
  });

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatar(dataUrl); // optimistic preview
      setAvatarMut.mutate({ avatarUrl: dataUrl }, { onSuccess: () => toast.success("Profile picture updated") });
    } catch {
      toast.error("Could not read that image. Try a different file.");
    }
  };

  const onRemoveAvatar = () => {
    setAvatar(null);
    setAvatarMut.mutate({ avatarUrl: null }, { onSuccess: () => toast.success("Profile picture removed") });
  };

  const trimmed = name.trim();
  const dirty = trimmed !== (user.name ?? "") && trimmed.length > 0;

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-16 w-16">
            {avatar ? <AvatarImage src={avatar} alt={user.name || "Profile picture"} className="object-cover" /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>
          <button
            type="button"
            data-icon-button
            onClick={() => fileRef.current?.click()}
            disabled={setAvatarMut.isPending}
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow ring-2 ring-card disabled:opacity-60"
            aria-label="Change profile picture"
          >
            {setAvatarMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{user.name || "Unnamed user"}</p>
          <p className="text-sm text-muted-foreground">{user.email || "No email on file"}</p>
          <Badge className="mt-1 bg-primary/10 text-primary hover:bg-primary/10 text-xs">
            {roleLabel[user.role] ?? user.role ?? "Member"}
          </Badge>
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={setAvatarMut.isPending} onClick={() => fileRef.current?.click()}>
              <Camera className="h-3.5 w-3.5" />{avatar ? "Change photo" : "Upload photo"}
            </Button>
            {avatar && (
              <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-destructive" disabled={setAvatarMut.isPending} onClick={onRemoveAvatar}>
                <Trash2 className="h-3.5 w-3.5" />Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="display-name">Display name</Label>
          <Input id="display-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground">Email</Label>
          <p className="text-sm font-medium pt-2">{user.email || "—"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground">Role</Label>
          <p className="text-sm font-medium">{roleLabel[user.role] ?? "—"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground">Account ID</Label>
          <p className="text-sm font-medium font-mono">{user.id ?? "—"}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <p className="text-xs text-muted-foreground">
          Your email and role are managed by your program administrator.
        </p>
        <Button
          size="sm"
          className="gap-2"
          disabled={!dirty || updateProfile.isPending}
          onClick={() => updateProfile.mutate({ name: trimmed })}
        >
          {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>
    </>
  );
}

/* --------------------------- Notifications --------------------------- */

function NotificationPreferences({ settings, onSaved, disabled }: { settings: any; onSaved: () => Promise<void>; disabled: boolean }) {
  const stored: Record<string, boolean> = settings?.notifications ?? {};
  // Missing value defaults to ON.
  const initial = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const p of NOTIFICATION_PREFS) out[p.id] = stored[p.id] ?? true;
    return out;
  }, [settings]);

  const [prefs, setPrefs] = useState<Record<string, boolean>>(initial);
  useEffect(() => { setPrefs(initial); }, [initial]);

  const save = trpc.auth.updateSettings.useMutation({
    onSuccess: async () => { await onSaved(); toast.success("Notification preferences saved"); },
    onError: (e) => toast.error(e.message || "Could not save preferences"),
  });

  const dirty = NOTIFICATION_PREFS.some(p => prefs[p.id] !== initial[p.id]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          Notification Preferences
        </CardTitle>
        <CardDescription>Choose which alerts you want to receive. Saved to your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {NOTIFICATION_PREFS.map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <p className="font-medium text-sm text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
            <Switch
              checked={prefs[item.id] ?? true}
              disabled={disabled}
              onCheckedChange={(v) => setPrefs(prev => ({ ...prev, [item.id]: v }))}
            />
          </div>
        ))}
        <Button
          className="w-full gap-2"
          disabled={disabled || !dirty || save.isPending}
          onClick={() => save.mutate({ notifications: prefs })}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Security ------------------------------ */

function PasswordCard({ hasPassword, disabled }: { hasPassword: boolean; disabled: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const change = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated");
      setCurrent(""); setNext(""); setConfirm("");
    },
    onError: (e) => toast.error(e.message || "Could not update password"),
  });

  const submit = () => {
    if (next.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (next !== confirm) { toast.error("Passwords do not match"); return; }
    if (hasPassword && !current) { toast.error("Enter your current password"); return; }
    change.mutate({ currentPassword: hasPassword ? current : undefined, newPassword: next });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          Password & Security
        </CardTitle>
        <CardDescription>
          {hasPassword ? "Change the password you use to sign in." : "Set a password to enable email sign-in."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPassword && (
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input id="current-password" type="password" placeholder="••••••••" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input id="new-password" type="password" placeholder="At least 8 characters" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input id="confirm-password" type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button className="w-full gap-2" disabled={disabled || change.isPending} onClick={submit}>
          {change.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {hasPassword ? "Update Password" : "Set Password"}
        </Button>
      </CardContent>
    </Card>
  );
}

function TwoFactorCard({ enabled, onSaved, disabled }: { enabled: boolean; onSaved: () => Promise<void>; disabled: boolean }) {
  const save = trpc.auth.updateSettings.useMutation({
    onSuccess: async (res) => { await onSaved(); toast.success(res.settings?.twoFactorEnabled ? "Two-factor enabled" : "Two-factor disabled"); },
    onError: (e) => toast.error(e.message || "Could not update setting"),
  });

  return (
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
          <Switch
            checked={enabled}
            disabled={disabled || save.isPending}
            onCheckedChange={(v) => save.mutate({ twoFactorEnabled: v })}
          />
        </div>
        <p className="text-xs text-muted-foreground">Two-factor authentication requires you to verify your identity using a second method when logging in.</p>
      </CardContent>
    </Card>
  );
}

/* --------------------------- Custom Roles --------------------------- */

function CustomRolesManager() {
  const utils = trpc.useUtils();
  const rolesQuery = trpc.roles.list.useQuery(ORGANIZATION_ID);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; accessLevel: "staff" | "admin"; color: RoleColor }>(
    { name: "", description: "", accessLevel: "staff", color: "sage" }
  );

  const create = trpc.roles.create.useMutation({
    onSuccess: () => { utils.roles.list.invalidate(); setOpen(false); setForm({ name: "", description: "", accessLevel: "staff", color: "sage" }); toast.success("Role created"); },
    onError: (e) => toast.error(e.message || "Could not create role"),
  });
  const remove = trpc.roles.delete.useMutation({
    onSuccess: () => { utils.roles.list.invalidate(); toast.success("Role removed"); },
    onError: (e) => toast.error(e.message || "Could not remove role"),
  });
  const confirm = useConfirm();
  const confirmRemove = async (role: { id: number; name: string }) => {
    if (await confirm({
      title: `Remove the "${role.name}" role?`,
      description: "Staff currently assigned this role label will keep their access tier, but the label will be gone.",
      confirmLabel: "Remove",
      destructive: true,
    })) remove.mutate({ id: role.id, organizationId: ORGANIZATION_ID });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Custom Roles
            </CardTitle>
            <CardDescription>Name the positions in your program (e.g. Family Advocate). Each maps to an access level.</CardDescription>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add Role</Button>
        </div>
      </CardHeader>
      <CardContent>
        {rolesQuery.isLoading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (rolesQuery.data?.length ?? 0) === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No custom roles yet. Add one like <span className="font-medium text-foreground">Family Advocate</span> to get started.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {rolesQuery.data!.map(role => (
              <div key={role.id} className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${roleColorClasses[(role.color as RoleColor)] ?? roleColorClasses.sage}`}>
                <span className="font-medium">{role.name}</span>
                <span className="text-[10px] uppercase tracking-wide opacity-70">{role.accessLevel}</span>
                <button
                  className="opacity-50 hover:opacity-100 transition-opacity"
                  title={`Remove ${role.name}`}
                  disabled={remove.isPending}
                  onClick={() => confirmRemove(role)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Custom Role</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role name</Label>
              <Input id="role-name" placeholder="Family Advocate" value={form.name} maxLength={100} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description (optional)</Label>
              <Input id="role-desc" placeholder="Supports families with resources and referrals" value={form.description} maxLength={500} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Access level</Label>
                <Select value={form.accessLevel} onValueChange={(v) => setForm(f => ({ ...f, accessLevel: v as "staff" | "admin" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff — program data access</SelectItem>
                    <SelectItem value="admin">Admin — full administration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Badge color</Label>
                <Select value={form.color} onValueChange={(v) => setForm(f => ({ ...f, color: v as RoleColor }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_COLORS.map(c => (
                      <SelectItem key={c} value={c}><span className="capitalize">{c}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="gap-2"
              disabled={!form.name.trim() || create.isPending}
              onClick={() => create.mutate({
                organizationId: ORGANIZATION_ID,
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                accessLevel: form.accessLevel,
                color: form.color,
              })}
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ----------------------------- Staff list ----------------------------- */

function StaffUsers() {
  const staffQuery = trpc.staff.list.useQuery(ORGANIZATION_ID);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Staff Users</h3>
      <Card>
        <CardContent className="p-0">
          {staffQuery.isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (staffQuery.data?.length ?? 0) === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No staff members yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {staffQuery.data!.map(member => (
                <div key={member.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-foreground">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.position || staffRoleLabel[member.role ?? "teacher"]}{member.email ? ` • ${member.email}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">{staffRoleLabel[member.role ?? "teacher"]}</Badge>
                    <Badge className={`text-xs ${member.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-muted text-muted-foreground hover:bg-muted"}`}>
                      {member.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Add and edit staff from the <a href="/staff" className="text-primary font-medium">Staff</a> page.</p>
    </div>
  );
}

/* ---------------------------- Program (admin) ---------------------------- */
// Program-wide details are presentational here; persisting them is tracked
// separately (the organizations table doesn't yet carry these columns).
function ProgramSettings() {
  const orgQuery = trpc.organizations.get.useQuery(ORGANIZATION_ID);
  const org = orgQuery.data;

  const blank = { name: "", director: "", directorEmail: "", phone: "", address: "", maxChildren: "", classroomCount: "" };
  const [form, setForm] = useState(blank);
  useEffect(() => {
    if (!org) return;
    setForm({
      name: org.name ?? "",
      director: org.director ?? "",
      directorEmail: org.directorEmail ?? "",
      phone: org.phone ?? "",
      address: org.address ?? "",
      maxChildren: org.maxChildren != null ? String(org.maxChildren) : "",
      classroomCount: org.classroomCount != null ? String(org.classroomCount) : "",
    });
  }, [org]);

  const update = trpc.organizations.update.useMutation({
    onSuccess: async () => { await orgQuery.refetch(); toast.success("Program settings saved"); },
    onError: (e) => toast.error(e.message || "Could not save program settings"),
  });

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const baseline = org
    ? {
        name: org.name ?? "", director: org.director ?? "", directorEmail: org.directorEmail ?? "",
        phone: org.phone ?? "", address: org.address ?? "",
        maxChildren: org.maxChildren != null ? String(org.maxChildren) : "",
        classroomCount: org.classroomCount != null ? String(org.classroomCount) : "",
      }
    : blank;
  const dirty = !!org && JSON.stringify(form) !== JSON.stringify(baseline);

  const onSave = () => {
    if (!form.name.trim()) { toast.error("Program name is required."); return; }
    update.mutate({
      id: ORGANIZATION_ID,
      name: form.name.trim(),
      director: form.director.trim() || null,
      directorEmail: form.directorEmail.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      maxChildren: form.maxChildren.trim() === "" ? undefined : Number(form.maxChildren),
      classroomCount: form.classroomCount.trim() === "" ? null : Number(form.classroomCount),
    });
  };

  if (orgQuery.isLoading) {
    return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  }
  if (!org) {
    return <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Couldn't load your program details.</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Program Information</CardTitle>
        <CardDescription>Contact and capacity details for {org.name}. Changes save to your program.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="program-name">Program Name</Label><Input id="program-name" value={form.name} maxLength={255} onChange={set("name")} /></div>
          <div className="space-y-2"><Label htmlFor="program-id">Program ID</Label><Input id="program-id" value={org.agencyId} disabled className="bg-muted" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="director">Program Director</Label><Input id="director" value={form.director} maxLength={160} onChange={set("director")} /></div>
          <div className="space-y-2"><Label htmlFor="director-email">Director Email</Label><Input id="director-email" type="email" value={form.directorEmail} maxLength={320} onChange={set("directorEmail")} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="phone">Program Phone</Label><Input id="phone" value={form.phone} maxLength={32} onChange={set("phone")} /></div>
          <div className="space-y-2"><Label htmlFor="address">Program Address</Label><Input id="address" value={form.address} maxLength={400} onChange={set("address")} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="capacity">Total Capacity</Label><Input id="capacity" type="number" min={0} value={form.maxChildren} onChange={set("maxChildren")} /></div>
          <div className="space-y-2"><Label htmlFor="classrooms">Number of Classrooms</Label><Input id="classrooms" type="number" min={0} value={form.classroomCount} onChange={set("classroomCount")} /></div>
        </div>
        <Button onClick={onSave} disabled={!dirty || update.isPending} className="w-full gap-2">
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Plan & Usage ----------------------------- */

const TIERS: Record<string, { label: string; perChild: number; base: number }> = {
  starter: { label: "Starter", perChild: 3, base: 0 },
  professional: { label: "Professional", perChild: 2.5, base: 49 },
  enterprise: { label: "Enterprise", perChild: 2, base: 199 },
};
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function UsageBar({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const over = max != null && used > max;
  const near = pct >= 90;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${over ? "text-destructive" : ""}`}>{used}{max != null ? ` / ${max}` : ""}</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${over || near ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${max ? Math.max(pct, 4) : 0}%` }} />
      </div>
    </div>
  );
}

function PlanUsageCard() {
  const orgId = ORGANIZATION_ID;
  const usageQuery = trpc.organizations.usage.useQuery(orgId);
  const u = usageQuery.data;

  const [tier, setTier] = useState<string>("starter");
  const [maxStaff, setMaxStaff] = useState<string>("");
  useEffect(() => { if (u) { setTier(u.subscriptionTier); setMaxStaff(u.maxStaff != null ? String(u.maxStaff) : ""); } }, [u]);

  const update = trpc.organizations.update.useMutation({
    onSuccess: async () => { await usageQuery.refetch(); toast.success("Plan updated"); },
    onError: (e) => toast.error(e.message || "Could not update plan"),
  });

  if (usageQuery.isLoading) return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  if (!u) return null;

  const dirty = tier !== u.subscriptionTier || (maxStaff === "" ? u.maxStaff != null : Number(maxStaff) !== u.maxStaff);
  const rate = TIERS[tier] ?? TIERS.starter;
  const estimate = rate.base + u.children * rate.perChild;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Plan & Usage</CardTitle>
        <CardDescription>Subscription tier, capacity limits, and current usage. Limits are enforced when adding children or staff.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Subscription Tier</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIERS).map(([v, t]) => <SelectItem key={v} value={v}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Staff Limit</Label><Input type="number" min={0} value={maxStaff} onChange={(e) => setMaxStaff(e.target.value)} /></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <UsageBar label="Children enrolled" used={u.children} max={u.maxChildren} />
          <UsageBar label="Staff" used={u.staff} max={maxStaff === "" ? null : Number(maxStaff)} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Estimated monthly cost</p>
            <p className="text-xs text-muted-foreground">{rate.label}: {usd(rate.base)} base + {u.children} × {usd(rate.perChild)}/child</p>
          </div>
          <p className="text-xl font-bold text-primary">{usd(estimate)}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">Capacity (children) is set as “Total Capacity” above. Estimate is illustrative.</p>

        <div className="flex justify-end">
          <Button disabled={!dirty || update.isPending} className="gap-2" onClick={() => update.mutate({ id: orgId, subscriptionTier: tier as any, maxStaff: maxStaff === "" ? undefined : Number(maxStaff) })}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Plan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------- Layout / Navigation --------------------------- */

function reorder<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const j = idx + dir;
  if (j < 0 || j >= arr.length) return arr;
  const copy = [...arr];
  [copy[idx], copy[j]] = [copy[j], copy[idx]];
  return copy;
}

function NavigationSettings({ settings, role, onSaved, disabled }: { settings: any; role: NavRole; onSaved: () => Promise<void>; disabled: boolean }) {
  const nav = settings?.navigation;
  // Only the items this role can actually see are customizable.
  const roleTop = topNavForRole(role);
  const roleSections = sideNavForRole(role);

  // Local working copy: full item lists in the saved order (hidden items kept so
  // they can be re-enabled), plus the hidden sets.
  const [topItems, setTopItems] = useState<NavItem[]>(() => sortByOrder(roleTop, nav?.topNav?.order));
  const [topHidden, setTopHidden] = useState<Set<string>>(() => new Set<string>(nav?.topNav?.hidden ?? []));
  const [sideSections, setSideSections] = useState<NavSection[]>(
    () => roleSections.map(s => ({ ...s, items: sortByOrder(s.items, nav?.sideNav?.order) }))
  );
  const [sideHidden, setSideHidden] = useState<Set<string>>(() => new Set<string>(nav?.sideNav?.hidden ?? []));

  const save = trpc.auth.updateSettings.useMutation({
    onSuccess: async () => { await onSaved(); toast.success("Navigation layout saved"); },
    onError: (e) => toast.error(e.message || "Could not save layout"),
  });

  const buildNavigation = () => ({
    topNav: { order: topItems.map(i => i.path), hidden: Array.from(topHidden) },
    sideNav: { order: sideSections.flatMap(s => s.items.map(i => i.path)), hidden: Array.from(sideHidden) },
  });

  // Compare current working copy to what's saved to drive the Save button.
  const savedSerialized = JSON.stringify({
    t: sortByOrder(roleTop, nav?.topNav?.order).map(i => i.path),
    th: [...(nav?.topNav?.hidden ?? [])].sort(),
    s: roleSections.flatMap(s => sortByOrder(s.items, nav?.sideNav?.order)).map(i => i.path),
    sh: [...(nav?.sideNav?.hidden ?? [])].sort(),
  });
  const currentSerialized = JSON.stringify({
    t: topItems.map(i => i.path),
    th: Array.from(topHidden).sort(),
    s: sideSections.flatMap(s => s.items.map(i => i.path)),
    sh: Array.from(sideHidden).sort(),
  });
  const dirty = currentSerialized !== savedSerialized;
  const hasCustomization = Boolean(nav?.topNav || nav?.sideNav) || topHidden.size > 0 || sideHidden.size > 0 || dirty;

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, path: string) => {
    const next = new Set(set);
    next.has(path) ? next.delete(path) : next.add(path);
    setter(next);
  };

  const reset = () => {
    setTopItems(topNavForRole(role));
    setTopHidden(new Set());
    setSideSections(sideNavForRole(role).map(s => ({ ...s })));
    setSideHidden(new Set());
    // Persist the cleared state (server drops the navigation key -> defaults).
    save.mutate({ navigation: {} });
  };

  const Row = ({ item, hidden, onToggle, onUp, onDown, isFirst, isLast, dim }: {
    item: NavItem; hidden: boolean; onToggle: () => void; onUp: () => void; onDown: () => void;
    isFirst: boolean; isLast: boolean; dim?: boolean;
  }) => {
    const Icon = item.icon;
    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border border-border ${hidden ? "opacity-50" : ""}`}>
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-sm font-medium truncate">{item.label}{dim && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">More</span>}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isFirst} onClick={onUp} aria-label={`Move ${item.label} up`}><ChevronUp className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isLast} onClick={onDown} aria-label={`Move ${item.label} down`}><ChevronDown className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle} aria-label={hidden ? `Show ${item.label}` : `Hide ${item.label}`}>
            {hidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
          </Button>
        </div>
      </div>
    );
  };

  const visibleTopCount = topItems.filter(i => !topHidden.has(i.path)).length;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" />Customize Navigation</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Reorder and hide items in your top bar and side menu. Saved to your account.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled || save.isPending || !hasCustomization} onClick={reset}>
          <RotateCcw className="h-4 w-4" />Reset to default
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top Navigation Bar</CardTitle>
          <CardDescription>The first {TOP_NAV_PRIMARY_COUNT} visible items show in the bar; the rest collapse under “More”.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {topItems.map((item, i) => (
            <Row
              key={item.path}
              item={item}
              hidden={topHidden.has(item.path)}
              isFirst={i === 0}
              isLast={i === topItems.length - 1}
              dim={!topHidden.has(item.path) && topItems.filter((x, xi) => xi <= i && !topHidden.has(x.path)).length > TOP_NAV_PRIMARY_COUNT}
              onToggle={() => toggle(topHidden, setTopHidden, item.path)}
              onUp={() => setTopItems(prev => reorder(prev, i, -1))}
              onDown={() => setTopItems(prev => reorder(prev, i, 1))}
            />
          ))}
          <p className="text-xs text-muted-foreground pt-1">{visibleTopCount} of {topItems.length} items visible.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Side Menu</CardTitle>
          <CardDescription>Reorder within each section and hide items you don’t use.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {sideSections.map((section, si) => (
            <div key={section.title} className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{section.title}</p>
              {section.items.map((item, ii) => (
                <Row
                  key={item.path}
                  item={item}
                  hidden={sideHidden.has(item.path)}
                  isFirst={ii === 0}
                  isLast={ii === section.items.length - 1}
                  onToggle={() => toggle(sideHidden, setSideHidden, item.path)}
                  onUp={() => setSideSections(prev => prev.map((s, x) => x !== si ? s : { ...s, items: reorder(s.items, ii, -1) }))}
                  onDown={() => setSideSections(prev => prev.map((s, x) => x !== si ? s : { ...s, items: reorder(s.items, ii, 1) }))}
                />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="gap-2" disabled={disabled || !dirty || save.isPending} onClick={() => save.mutate({ navigation: buildNavigation() })}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Layout
        </Button>
      </div>
    </>
  );
}
