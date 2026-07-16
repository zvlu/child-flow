import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Home, Phone, Mail, MapPin, Calendar, CheckCircle2, Clock, Users, Heart, BookOpen, Loader2, Pencil, Sparkles, Target } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { Glossary } from "@/components/Glossary";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  home_visit: "Home Visit",
  office_visit: "Office Visit",
  phone_call: "Phone Call",
  email: "Email",
  referral: "Referral",
  coordinated_services: "Coordinated Services",
  monthly_contact: "Monthly Contact",
  other: "Other",
};

function serviceIcon(type: string) {
  if (type === "home_visit") return <Home className="h-5 w-5 text-primary" />;
  if (type === "phone_call") return <Phone className="h-5 w-5 text-primary" />;
  if (type === "email") return <Mail className="h-5 w-5 text-primary" />;
  return <Users className="h-5 w-5 text-primary" />;
}

export default function FamilyServices() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("families");
  const searchParams = useSearch();
  const [logOpen, setLogOpen] = useState(false);
  const [resourceDetail, setResourceDetail] = useState<{ category: string; resources: string[] } | null>(null);
  const [logFamilyId, setLogFamilyId] = useState<string>("");
  const [logType, setLogType] = useState<string>("");
  const [logDescription, setLogDescription] = useState("");
  const [logFollowUp, setLogFollowUp] = useState(false);
  const [logFollowUpDate, setLogFollowUpDate] = useState("");

  // Edit-family dialog: any staff member can edit every field of a family in
  // their org. Form holds all editable family columns as strings.
  const emptyEditForm = {
    id: 0,
    primaryContactName: "", primaryContactPhone: "", primaryContactEmail: "",
    secondaryContactName: "", secondaryContactPhone: "",
    address: "", city: "", state: "", zipCode: "", notes: "",
  };
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const setEditField = (k: keyof typeof emptyEditForm, v: string) => setEditForm(prev => ({ ...prev, [k]: v }));

  const utils = trpc.useUtils();
  const { data: families, isLoading: familiesLoading } = trpc.families.list.useQuery(ORGANIZATION_ID);

  // Deep link from global search (?family=<id>): pre-filter to that family.
  useEffect(() => {
    const id = new URLSearchParams(searchParams).get("family");
    if (!id || !families) return;
    const fam = families.find((f) => f.id === Number(id));
    if (fam) {
      setSearch(fam.primaryContactName);
      setTab("families");
    }
  }, [searchParams, families]);
  const { data: children } = trpc.children.list.useQuery(ORGANIZATION_ID);
  const { data: services, isLoading: servicesLoading } = trpc.familyServices.list.useQuery({ organizationId: ORGANIZATION_ID });
  const { data: staffList } = trpc.staff.list.useQuery(ORGANIZATION_ID);
  const advocateName = (id: number | null | undefined) => {
    if (id == null) return null;
    const s = (staffList ?? []).find((m: any) => m.id === id);
    return s ? `${s.firstName} ${s.lastName}` : null;
  };

  const createService = trpc.familyServices.create.useMutation({
    onSuccess: () => {
      utils.familyServices.list.invalidate();
      toast.success("Service contact logged successfully.");
      setLogOpen(false);
      setLogFamilyId("");
      setLogType("");
      setLogDescription("");
      setLogFollowUp(false);
      setLogFollowUpDate("");
    },
    onError: (error) => toast.error(`Failed to log contact: ${error.message}`),
  });

  // AI case summary (LLM digest of case notes with goal links)
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryFamilyName, setSummaryFamilyName] = useState("");
  const summarize = trpc.familyCaseNotes.summarize.useMutation({
    onSuccess: () => setSummaryOpen(true),
    onError: (error) => toast.error(error.message || "Could not generate the summary."),
  });
  const requestSummary = (family: { id: number; primaryContactName: string }) => {
    setSummaryFamilyName(family.primaryContactName);
    summarize.mutate({ familyId: family.id });
  };

  const updateFamily = trpc.families.update.useMutation({
    onSuccess: () => {
      utils.families.list.invalidate(ORGANIZATION_ID);
      toast.success("Family information updated.");
      setEditOpen(false);
    },
    onError: (error) => toast.error(`Failed to update family: ${error.message}`),
  });

  const openEditDialog = (family: NonNullable<typeof families>[number]) => {
    setEditForm({
      id: family.id,
      primaryContactName: family.primaryContactName ?? "",
      primaryContactPhone: family.primaryContactPhone ?? "",
      primaryContactEmail: family.primaryContactEmail ?? "",
      secondaryContactName: family.secondaryContactName ?? "",
      secondaryContactPhone: family.secondaryContactPhone ?? "",
      address: family.address ?? "",
      city: family.city ?? "",
      state: family.state ?? "",
      zipCode: family.zipCode ?? "",
      notes: family.notes ?? "",
    });
    setEditOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.primaryContactName.trim()) {
      toast.error("Primary contact name is required.");
      return;
    }
    updateFamily.mutate(editForm);
  };

  const childrenByFamily = useMemo(() => {
    const map = new Map<number, string[]>();
    (children ?? []).forEach((c) => {
      if (!c.familyId) return;
      const list = map.get(c.familyId) ?? [];
      list.push(`${c.firstName} ${c.lastName}`);
      map.set(c.familyId, list);
    });
    return map;
  }, [children]);

  const servicesByFamily = useMemo(() => {
    const map = new Map<number, NonNullable<typeof services>>();
    (services ?? []).forEach((s) => {
      const list = map.get(s.familyId) ?? [];
      list.push(s);
      map.set(s.familyId, list);
    });
    return map;
  }, [services]);

  const familyNameById = useMemo(() => {
    const map = new Map<number, string>();
    (families ?? []).forEach((f) => map.set(f.id, f.primaryContactName));
    return map;
  }, [families]);

  const now = new Date();
  const allServices = services ?? [];
  const homeVisitsMtd = allServices.filter((s) => {
    if (s.type !== "home_visit") return false;
    const d = new Date(s.serviceDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const needsFollowUp = allServices.filter((s) => Number(s.followUpRequired) === 1).length;

  const filtered = (families ?? []).filter((f) => {
    const kids = childrenByFamily.get(f.id) ?? [];
    return (
      f.primaryContactName.toLowerCase().includes(search.toLowerCase()) ||
      kids.some((c) => c.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const sortedServices = [...allServices].sort(
    (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
  );

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logFamilyId || !logType || !logDescription.trim()) {
      toast.error("Please select a family, contact type, and add a description.");
      return;
    }
    createService.mutate({
      organizationId: ORGANIZATION_ID,
      familyId: Number(logFamilyId),
      type: logType,
      serviceDate: new Date(),
      description: logDescription.trim(),
      followUpRequired: logFollowUp ? 1 : 0,
      followUpDate: logFollowUp && logFollowUpDate ? new Date(logFollowUpDate) : undefined,
      recordedBy: 1,
    });
  };

  const openLogDialog = (familyId?: number) => {
    if (familyId) setLogFamilyId(String(familyId));
    setLogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-1.5">Family Services <Glossary term="CFCR" /></h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage family partnerships, goals, and community resources. View advocate workload in Reports → Staff Activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-2" onClick={() => openLogDialog()}><Plus className="h-4 w-4" />Log Contact</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Families Served", value: families?.length ?? 0, icon: Users, color: "text-primary" },
          { label: "Home Visits (MTD)", value: homeVisitsMtd, icon: Home, color: "text-blue-600" },
          { label: "Services Logged", value: allServices.length, icon: Calendar, color: "text-green-600" },
          { label: "Needs Follow-up", value: needsFollowUp, icon: Clock, color: "text-amber-600" },
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
          <TabsTrigger value="contacts">Service Contacts</TabsTrigger>
          <TabsTrigger value="resources">Community Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="families" className="mt-4 space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search families..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {familiesLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-sm">Loading families...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold text-foreground">No families found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map(family => {
                const kids = childrenByFamily.get(family.id) ?? [];
                const famServices = servicesByFamily.get(family.id) ?? [];
                const lastContact = famServices.length > 0
                  ? new Date(Math.max(...famServices.map(s => new Date(s.serviceDate).getTime())))
                  : null;
                const familyNeedsFollowUp = famServices.some(s => Number(s.followUpRequired) === 1);
                const homeVisits = famServices.filter(s => s.type === "home_visit").length;
                const serviceTypes = Array.from(new Set(famServices.map(s => SERVICE_TYPE_LABELS[s.type] ?? s.type)));
                const addressLine = [family.address, family.city, family.state].filter(Boolean).join(", ");
                return (
                  <Card key={family.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-11 w-11 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {family.primaryContactName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-foreground">{family.primaryContactName}</h3>
                            <Badge className={!familyNeedsFollowUp ? "bg-green-100 text-green-700 hover:bg-green-100 text-xs" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs"}>
                              {!familyNeedsFollowUp ? "Active" : "Needs Follow-up"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Children: {kids.length > 0 ? kids.join(", ") : "None enrolled"}
                          </p>
                          {(() => {
                            const adv = advocateName((family as any).familyAdvocateId);
                            return (
                              <p className="mt-1 inline-flex items-center gap-1 text-xs">
                                {adv ? (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">Advocate: {adv}</span>
                                ) : (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">No advocate assigned</span>
                                )}
                              </p>
                            );
                          })()}
                          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                            {family.primaryContactPhone && (
                              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{family.primaryContactPhone}</div>
                            )}
                            {family.primaryContactEmail && (
                              <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{family.primaryContactEmail}</div>
                            )}
                            {addressLine && (
                              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{addressLine}</div>
                            )}
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5" />
                              Last contact: {lastContact ? lastContact.toLocaleDateString() : "No contacts yet"}
                            </div>
                          </div>
                          {serviceTypes.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {serviceTypes.map(t => (
                                <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 flex items-center gap-4 text-xs">
                            <span className="text-muted-foreground">Home Visits: <strong className="text-foreground">{homeVisits}</strong></span>
                            <span className="text-muted-foreground">Services: <strong className="text-foreground">{famServices.length}</strong></span>
                            <span className="text-muted-foreground">Children: <strong className="text-foreground">{kids.length}</strong></span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" asChild>
                          <a href={family.primaryContactPhone ? `tel:${family.primaryContactPhone}` : undefined}>
                            <Phone className="h-3.5 w-3.5" />Call
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => openLogDialog(family.id)}>
                          <Home className="h-3.5 w-3.5" />Log Visit
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => openEditDialog(family)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs gap-1"
                          disabled={summarize.isPending}
                          onClick={() => requestSummary(family)}
                        >
                          {summarize.isPending && summaryFamilyName === family.primaryContactName ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          AI Summary
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Service Contacts</CardTitle>
              <CardDescription>Home visits, phone check-ins, referrals, and follow-ups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {servicesLoading ? (
                <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mb-2" />
                  <p className="text-sm">Loading service contacts...</p>
                </div>
              ) : sortedServices.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <h3 className="font-semibold text-foreground">No service contacts yet</h3>
                  <p className="text-sm text-muted-foreground">Log a contact to start tracking family services.</p>
                </div>
              ) : (
                sortedServices.map((service) => {
                  const followUp = Number(service.followUpRequired) === 1;
                  return (
                    <div key={service.id} className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {serviceIcon(service.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">
                          {familyNameById.get(service.familyId) ?? `Family #${service.familyId}`}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {SERVICE_TYPE_LABELS[service.type] ?? service.type}
                          {service.description ? <> &bull; {service.description}</> : null}
                        </p>
                        {service.outcome && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic truncate">Outcome: {service.outcome}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-medium text-foreground">{new Date(service.serviceDate).toLocaleDateString()}</p>
                        {followUp ? (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs mt-1">
                            Follow-up{service.followUpDate ? `: ${new Date(service.followUpDate).toLocaleDateString()}` : " required"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs mt-1">
                            <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />Completed
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
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
                    <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setResourceDetail(cat)}>View Resources</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Resource Detail Dialog — these categories don't carry a URL/phone in
          this catalog yet, so the honest fix is to surface what's actually on
          the card (category + its resource list) in a focused view. */}
      <Dialog open={resourceDetail != null} onOpenChange={(o) => { if (!o) setResourceDetail(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{resourceDetail?.category}</DialogTitle>
            <DialogDescription>Resources available to families in this category.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 py-2">
            {(resourceDetail?.resources ?? []).map(r => (
              <li key={r} className="flex items-center gap-2 text-sm rounded-lg border border-border px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Contact your Family Advocate to make a referral for any of these resources.
          </p>
        </DialogContent>
      </Dialog>

      {/* Log Contact Dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleLogSubmit}>
            <DialogHeader>
              <DialogTitle>Log Service Contact</DialogTitle>
              <DialogDescription>Record a home visit, phone call, referral, or other family service.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Family</label>
                  <Select value={logFamilyId} onValueChange={setLogFamilyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select family..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(families ?? []).map(f => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.primaryContactName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Contact Type</label>
                  <Select value={logType} onValueChange={setLogType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Description</label>
                <Textarea
                  value={logDescription}
                  onChange={e => setLogDescription(e.target.value)}
                  placeholder="What was discussed or provided?"
                  className="min-h-[100px]"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={logFollowUp}
                    onChange={e => setLogFollowUp(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Follow-up required
                </label>
                {logFollowUp && (
                  <Input
                    type="date"
                    value={logFollowUpDate}
                    onChange={e => setLogFollowUpDate(e.target.value)}
                    className="max-w-[180px]"
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createService.isPending}>
                {createService.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Contact
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Family Dialog — any staff member can edit all info for a family in their org */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Family</DialogTitle>
              <DialogDescription>Update contact and address details. Changes save for everyone on your team.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Primary Contact Name</label>
                <Input value={editForm.primaryContactName} onChange={e => setEditField("primaryContactName", e.target.value)} placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Primary Phone</label>
                  <Input value={editForm.primaryContactPhone} onChange={e => setEditField("primaryContactPhone", e.target.value)} placeholder="(555) 555-1234" />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Primary Email</label>
                  <Input value={editForm.primaryContactEmail} onChange={e => setEditField("primaryContactEmail", e.target.value)} placeholder="parent@email.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Secondary Contact</label>
                  <Input value={editForm.secondaryContactName} onChange={e => setEditField("secondaryContactName", e.target.value)} placeholder="Full name" />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Secondary Phone</label>
                  <Input value={editForm.secondaryContactPhone} onChange={e => setEditField("secondaryContactPhone", e.target.value)} placeholder="(555) 555-5678" />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Address</label>
                <Input value={editForm.address} onChange={e => setEditField("address", e.target.value)} placeholder="Street address" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2 col-span-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase">City</label>
                  <Input value={editForm.city} onChange={e => setEditField("city", e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">State</label>
                  <Input value={editForm.state} maxLength={2} onChange={e => setEditField("state", e.target.value.toUpperCase())} placeholder="CT" />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Zip</label>
                  <Input value={editForm.zipCode} onChange={e => setEditField("zipCode", e.target.value)} />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground uppercase">Notes</label>
                <Textarea value={editForm.notes} onChange={e => setEditField("notes", e.target.value)} placeholder="Anything the team should know…" className="min-h-[80px]" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateFamily.isPending}>
                {updateFamily.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI case summary */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Case summary — {summaryFamilyName}
            </DialogTitle>
            <DialogDescription>
              AI digest of {summarize.data?.noteCount ?? 0} case notes. Verify details against the record before
              acting on them.
            </DialogDescription>
          </DialogHeader>
          {summarize.data && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-foreground">{summarize.data.summary}</p>
              {summarize.data.themes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {summarize.data.themes.map((t) => (
                    <span key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {summarize.data.goalSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Goal connections</p>
                  {summarize.data.goalSuggestions.map((g, i) => (
                    <div key={i} className="flex gap-2 rounded-lg border border-border p-3">
                      <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {g.title}{" "}
                          {g.goalId == null && (
                            <Badge variant="outline" className="ml-1 text-[10px]">
                              Suggested new goal
                            </Badge>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{g.rationale}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
