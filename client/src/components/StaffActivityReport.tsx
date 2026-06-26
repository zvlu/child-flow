import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";
import {
  Download, Loader2, ArrowLeft, Users, Activity, CalendarClock, ClipboardList, Calendar,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { objectsToCsv, downloadCsv } from "@/lib/csv";
import { Glossary } from "@/components/Glossary";

const TYPE_LABELS: Record<string, string> = {
  home_visit: "Home Visit",
  office_visit: "Office Visit",
  phone_call: "Phone Call",
  email: "Email",
  referral: "Referral",
  coordinated_services: "Coordinated Services",
  monthly_contact: "Monthly Contact",
  other: "Other",
};
// Compact headers for the workload table (it has one column per type).
const TYPE_SHORT: Record<string, string> = {
  home_visit: "Home", office_visit: "Office", phone_call: "Phone", email: "Email",
  referral: "Referral", coordinated_services: "Coord.", monthly_contact: "Monthly", other: "Other",
};

type Preset = "month" | "lastMonth" | "90d" | "year";
const PRESET_LABELS: Record<Preset, string> = {
  month: "This month", lastMonth: "Last month", "90d": "Last 90 days", year: "This year",
};

function rangeFor(preset: Preset): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (preset === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
  if (preset === "lastMonth") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
    };
  }
  if (preset === "90d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    return { start, end };
  }
  return { start: new Date(now.getFullYear(), 0, 1), end };
}

const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

export function StaffActivityReport() {
  const orgId = ORGANIZATION_ID;
  const [preset, setPreset] = useState<Preset>("month");
  const [selectedStaff, setSelectedStaff] = useState<number | null>(null);
  const range = useMemo(() => rangeFor(preset), [preset]);

  const { data, isLoading } = trpc.familyServices.staffActivity.useQuery({
    organizationId: orgId,
    start: range.start,
    end: range.end,
    staffId: selectedStaff,
  });

  const types = data?.types ?? [];
  const staff = data?.staff ?? [];
  const totals = data?.totals;
  const detail = data?.detail ?? [];
  const selected = selectedStaff != null ? staff.find((s) => s.staffId === selectedStaff) ?? null : null;

  const activeCount = staff.filter((s) => s.total > 0).length;
  const chartData = useMemo(
    () => staff.filter((s) => s.total > 0).slice(0, 10).map((s) => ({ name: s.name.split(" ")[0], total: s.total })),
    [staff],
  );

  const exportSummary = () => {
    if (!staff.length) { toast.message("No staff activity to export yet."); return; }
    const rows = staff.map((s) => ({
      Staff: s.name,
      Position: s.position ?? "",
      ...Object.fromEntries(types.map((t) => [TYPE_LABELS[t] ?? t, s.byType[t] ?? 0])),
      Total: s.total,
      "Last Activity": s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : "",
    }));
    downloadCsv(`staff-activity-${preset}.csv`, objectsToCsv(rows));
    toast.success(`Exported ${rows.length} staff row${rows.length === 1 ? "" : "s"}`);
  };

  const exportDetail = () => {
    if (!detail.length) { toast.message("No contacts to export."); return; }
    const rows = detail.map((d) => ({
      Date: new Date(d.serviceDate).toLocaleDateString(),
      Family: d.familyName,
      Type: TYPE_LABELS[d.type] ?? d.type,
      Description: d.description ?? "",
      Outcome: d.outcome ?? "",
      "Follow-up": d.followUpRequired ? (d.followUpDate ? new Date(d.followUpDate).toLocaleDateString() : "Required") : "",
    }));
    downloadCsv(`contacts-${selected?.name.replace(/\s+/g, "-").toLowerCase() ?? "staff"}-${preset}.csv`, objectsToCsv(rows));
    toast.success(`Exported ${rows.length} contact${rows.length === 1 ? "" : "s"}`);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
            Staff Activity <Glossary term="CFCR" />
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Family-advocate workload — contacts logged per staff member. Each contact feeds that family's record.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
                <SelectItem key={p} value={p}>{PRESET_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={selected ? exportDetail : exportSummary}>
            <Download className="h-4 w-4" />Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <p className="text-sm">Loading staff activity…</p>
        </div>
      ) : selected ? (
        /* ---------- Single advocate's contact log ---------- */
        <div className="space-y-4">
          <button
            onClick={() => setSelectedStaff(null)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />All staff
          </button>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials(selected.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{selected.name}</h3>
                  <p className="text-xs text-muted-foreground">{selected.position || "Staff"} · {PRESET_LABELS[preset]}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{selected.total}</p>
                  <p className="text-xs text-muted-foreground">contacts</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {types.filter((t) => (selected.byType[t] ?? 0) > 0).map((t) => (
                  <span key={t} className="text-xs bg-muted text-foreground px-2.5 py-1 rounded-full">
                    {TYPE_LABELS[t]}: <strong>{selected.byType[t]}</strong>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact log</CardTitle>
              <CardDescription>Every contact {selected.name} logged in this period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No contacts logged in this period.</p>
                </div>
              ) : (
                detail.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{d.familyName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <Badge variant="outline" className="mr-1.5 text-[10px] py-0">{TYPE_LABELS[d.type] ?? d.type}</Badge>
                        {d.description}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-foreground">{new Date(d.serviceDate).toLocaleDateString()}</p>
                      {d.followUpRequired && (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] mt-1">Follow-up</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ---------- Supervisor view: everyone side by side ---------- */
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Contacts", value: totals?.total ?? 0, icon: Activity, color: "text-primary" },
              { label: "Staff Active", value: `${activeCount}/${staff.length}`, icon: Users, color: "text-blue-600" },
              { label: "Monthly Contacts", value: totals?.byType["monthly_contact"] ?? 0, icon: CalendarClock, color: "text-green-600" },
              { label: "Home Visits", value: totals?.byType["home_visit"] ?? 0, icon: ClipboardList, color: "text-amber-600" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                        <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                      </div>
                      <Icon className={`h-7 w-7 opacity-20 ${s.color}`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Contacts by Staff</CardTitle>
                <CardDescription>Total contacts logged — {PRESET_LABELS[preset].toLowerCase()}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 34)}>
                  <BarChart data={chartData} layout="vertical" barCategoryGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                    <RTooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
                    <Bar dataKey="total" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} name="Contacts" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Workload by Staff</CardTitle>
              <CardDescription>Tap a row to see that advocate's full contact log</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {staff.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center">
                  <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No staff found for this organization.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-4 py-2.5 font-medium text-muted-foreground">Staff</th>
                        {types.map((t) => (
                          <th key={t} className="px-2 py-2.5 font-medium text-muted-foreground text-center whitespace-nowrap">{TYPE_SHORT[t] ?? t}</th>
                        ))}
                        <th className="px-3 py-2.5 font-medium text-muted-foreground text-center">Total</th>
                        <th className="px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Last</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((s) => (
                        <tr
                          key={s.staffId ?? "unassigned"}
                          onClick={() => s.staffId != null && setSelectedStaff(s.staffId)}
                          className={`border-b border-border last:border-0 transition-colors ${s.staffId != null ? "cursor-pointer hover:bg-muted/30" : ""}`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{initials(s.name)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground truncate">{s.name}</p>
                                {s.position && <p className="text-[11px] text-muted-foreground truncate">{s.position}</p>}
                              </div>
                            </div>
                          </td>
                          {types.map((t) => (
                            <td key={t} className={`px-2 py-2.5 text-center tabular-nums ${(s.byType[t] ?? 0) === 0 ? "text-muted-foreground/40" : "text-foreground"}`}>
                              {s.byType[t] ?? 0}
                            </td>
                          ))}
                          <td className="px-3 py-2.5 text-center font-bold text-foreground tabular-nums">{s.total}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {s.lastActivity ? new Date(s.lastActivity).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
