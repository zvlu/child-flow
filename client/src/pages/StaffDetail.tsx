import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Mail, Phone, Briefcase, Users, School, Award, Loader2, UserCog, Activity } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useIsAdmin } from "@/_core/hooks/useIsAdmin";
import { ROLE_LABELS as roleLabels } from "@shared/roles";
import { roleColors } from "./Staff";

/** Turn an audit-log row into a one-line, human-readable activity entry. */
function activityLabel(a: { action: string; resourceType: string; resourceId?: string | null; detail?: string | null }): string {
  const what = a.detail || a.resourceId || a.resourceType;
  switch (a.action) {
    case "view": return `Viewed ${what}`;
    case "login": return "Signed in";
    case "logout": return "Signed out";
    case "create": return `Created ${a.resourceType}${a.resourceId ? ` #${a.resourceId}` : ""}`;
    case "update": return `Updated ${a.resourceType}${a.resourceId ? ` #${a.resourceId}` : ""}`;
    case "delete": return `Deleted ${a.resourceType}${a.resourceId ? ` #${a.resourceId}` : ""}`;
    case "access_denied": return `Blocked from ${what}`;
    default: return `${a.action} ${a.resourceType}`;
  }
}

interface StaffDetailProps { id: string; }

function initials(first?: string, last?: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

export default function StaffDetail({ id }: StaffDetailProps) {
  const staffId = Number(id);
  const [, navigate] = useLocation();
  const isAdmin = useIsAdmin();

  const { data: staffList, isLoading } = trpc.staff.list.useQuery(ORGANIZATION_ID, { enabled: !isNaN(staffId) });
  const { data: certifications } = trpc.staffOps.certifications.useQuery(ORGANIZATION_ID, { enabled: !isNaN(staffId) });
  const { data: classrooms } = trpc.classrooms.list.useQuery(ORGANIZATION_ID, { enabled: !isNaN(staffId) });
  const { data: customRoles } = trpc.roles.list.useQuery(ORGANIZATION_ID, { enabled: !isNaN(staffId) });
  const { data: myRole } = trpc.staff.myRole.useQuery();

  const member = staffList?.find((s) => s.id === staffId);
  const supervisor = member?.supervisorId != null ? staffList?.find((s) => s.id === member.supervisorId) : undefined;
  const directReports = (staffList ?? []).filter((s) => s.supervisorId === staffId && s.id !== staffId);
  const memberCerts = (certifications ?? []).filter((c) => c.staffId === staffId);
  const customRole = member?.customRoleId != null ? customRoles?.find((r) => r.id === member.customRoleId) : undefined;
  const classroom = (classrooms ?? []).find(
    (c) => (c as { teacherId?: number | null }).teacherId === staffId || (c as { assistantId?: number | null }).assistantId === staffId,
  );

  // Activity is visible only along the reporting line: an admin, or someone
  // above this employee in the supervisor chain. Walk the chain upward and
  // check if the signed-in user's staff id is one of the ancestors. The server
  // enforces the same rule on activity.forStaff — this just shapes the UI.
  const ancestorIds = useMemo(() => {
    const byId = new Map((staffList ?? []).map((s) => [s.id, s]));
    const out = new Set<number>();
    let cur = member?.supervisorId ?? null;
    let guard = 0;
    while (cur != null && !out.has(cur) && guard++ < 50) {
      out.add(cur);
      cur = byId.get(cur)?.supervisorId ?? null;
    }
    return out;
  }, [staffList, member]);
  const canViewActivity = isAdmin || (myRole?.staffId != null && ancestorIds.has(myRole.staffId));

  const { data: activity, isLoading: activityLoading } = trpc.activity.forStaff.useQuery(
    { organizationId: ORGANIZATION_ID, staffId },
    { enabled: !isNaN(staffId) && canViewActivity },
  );

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!member) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/staff"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Back to Staff</Button></Link>
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">This employee couldn't be found.</CardContent></Card>
      </div>
    );
  }

  const roleLabel = customRole?.name || member.position || roleLabels[member.role ?? "teacher"] || member.role;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link href="/staff"><Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />Back to Staff</Button></Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16 flex-shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
            {initials(member.firstName, member.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{member.firstName} {member.lastName}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge className={`${roleColors[member.role ?? "teacher"] || "bg-muted text-muted-foreground"}`}>{roleLabel}</Badge>
            {member.role && roleLabels[member.role] && roleLabel !== roleLabels[member.role] && (
              <span className="text-xs text-muted-foreground">({roleLabels[member.role]})</span>
            )}
            {member.isActive !== 1 && <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
          </div>
        </div>
      </div>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />Contact & Position</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {member.position && <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-foreground" />{member.position}</div>}
          {member.email
            ? <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-primary hover:underline"><Mail className="h-4 w-4" />{member.email}</a>
            : <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />No email on file</div>}
          {member.phone
            ? <a href={`tel:${member.phone}`} className="flex items-center gap-2 text-primary hover:underline"><Phone className="h-4 w-4" />{member.phone}</a>
            : <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />No phone on file</div>}
          {classroom && (
            <Link href="/classrooms" className="flex items-center gap-2 text-primary hover:underline">
              <School className="h-4 w-4" />{classroom.name}
              {(classroom as { teacherId?: number | null }).teacherId === staffId ? " · Lead teacher" : " · Assistant"}
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Reporting line */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><UserCog className="h-4 w-4 text-primary" />Reporting Line</CardTitle>
          <CardDescription>Where this employee sits in the org chart.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Reports to</p>
            {supervisor ? (
              <button className="text-primary hover:underline" onClick={() => navigate(`/staff/${supervisor.id}`)}>
                {supervisor.firstName} {supervisor.lastName}{supervisor.position ? ` · ${supervisor.position}` : ""}
              </button>
            ) : <p className="text-muted-foreground">No supervisor (top of org).</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Direct reports ({directReports.length})</p>
            {directReports.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {directReports.map((r) => (
                  <button key={r.id} className="rounded-full border px-3 py-1 text-xs hover:bg-accent" onClick={() => navigate(`/staff/${r.id}`)}>
                    {r.firstName} {r.lastName}
                  </button>
                ))}
              </div>
            ) : <p className="text-muted-foreground">No direct reports.</p>}
          </div>
        </CardContent>
      </Card>

      {/* App Activity — reporting-line-gated oversight view */}
      {canViewActivity && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />App Activity</CardTitle>
            <CardDescription>Recent in-app activity. Visible to you because you're in {member.firstName}'s reporting line.</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (activity?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
            ) : (
              <ul className="divide-y">
                {activity!.slice(0, 50).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-foreground truncate">{activityLabel(a)}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Certifications */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" />Certifications</CardTitle></CardHeader>
        <CardContent>
          {memberCerts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {memberCerts.map((c) => (
                <Badge key={c.id} variant="outline" className="text-xs">{c.certificationType}</Badge>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No certifications on file.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
