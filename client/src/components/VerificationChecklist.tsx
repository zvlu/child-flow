import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardCheck, Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

/** Wire shapes shared with the iOS ERSEA checklist (see enrollmentVerificationsRest.ts). */
type AdultVerification = {
  firstName: boolean; lastName: boolean; dateOfBirth: boolean; gender: boolean;
  race: boolean; ethnicity: boolean; relationship: boolean; educationLevel: boolean;
  employmentStatus: boolean; address: boolean; phone: boolean; email: boolean;
};

type ChildDocVerification = {
  firstName: boolean; lastName: boolean; dateOfBirth: boolean; gender: boolean;
  race: boolean; ethnicity: boolean; primaryLanguage: boolean; birthCertificate: boolean;
  proofOfIncome: boolean; immunizationRecords: boolean; physicalExam: boolean;
};

type VerificationStatus = "Pending" | "In Progress" | "Complete" | "Needs Info";

type Verification = {
  id: string;
  childName: string;
  applicationDate: string;
  verifiedBy: string;
  verifiedDate: string | null;
  primaryAdult: AdultVerification;
  secondaryAdult: AdultVerification | null;
  childChecklist: ChildDocVerification;
  status: VerificationStatus;
  notes: string;
};

const emptyAdult = (): AdultVerification => ({
  firstName: false, lastName: false, dateOfBirth: false, gender: false,
  race: false, ethnicity: false, relationship: false, educationLevel: false,
  employmentStatus: false, address: false, phone: false, email: false,
});

const emptyChild = (): ChildDocVerification => ({
  firstName: false, lastName: false, dateOfBirth: false, gender: false,
  race: false, ethnicity: false, primaryLanguage: false, birthCertificate: false,
  proofOfIncome: false, immunizationRecords: false, physicalExam: false,
});

const ADULT_ITEMS: { key: keyof AdultVerification; label: string }[] = [
  { key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" },
  { key: "dateOfBirth", label: "Date of birth" }, { key: "gender", label: "Gender" },
  { key: "race", label: "Race" }, { key: "ethnicity", label: "Ethnicity" },
  { key: "relationship", label: "Relationship to child" }, { key: "educationLevel", label: "Education level" },
  { key: "employmentStatus", label: "Employment status" }, { key: "address", label: "Address" },
  { key: "phone", label: "Phone" }, { key: "email", label: "Email" },
];

const CHILD_ITEMS: { key: keyof ChildDocVerification; label: string }[] = [
  { key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" },
  { key: "dateOfBirth", label: "Date of birth" }, { key: "gender", label: "Gender" },
  { key: "race", label: "Race" }, { key: "ethnicity", label: "Ethnicity" },
  { key: "primaryLanguage", label: "Primary language" }, { key: "birthCertificate", label: "Birth certificate" },
  { key: "proofOfIncome", label: "Proof of income" }, { key: "immunizationRecords", label: "Immunization records" },
  { key: "physicalExam", label: "Physical exam" },
];

const STATUS_META: Record<VerificationStatus, string> = {
  Pending: "bg-gray-100 text-gray-700 border-gray-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  Complete: "bg-green-100 text-green-700 border-green-200",
  "Needs Info": "bg-amber-100 text-amber-700 border-amber-200",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function counted(v: Verification) {
  const bools = [
    ...Object.values(v.primaryAdult ?? {}),
    ...(v.secondaryAdult ? Object.values(v.secondaryAdult) : []),
    ...Object.values(v.childChecklist ?? {}),
  ].filter((x) => typeof x === "boolean");
  return { done: bools.filter(Boolean).length, total: bools.length };
}

/**
 * ERSEA application-verification checklist — web parity with the iOS screen,
 * against the same REST endpoints, so a checklist started at a home visit on
 * the iPad can be finished at a desk (and vice versa).
 */
export function VerificationChecklist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Verification | null>(null);
  const [filter, setFilter] = useState<VerificationStatus | "all">("all");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSecondAdult, setNewSecondAdult] = useState(false);

  const listQuery = useQuery({
    queryKey: ["enrollment", "verifications"],
    queryFn: () => api<Verification[]>("/api/enrollment/verifications"),
  });

  const save = useMutation({
    mutationFn: (v: Verification) =>
      api<Verification>(`/api/enrollment/verifications/${encodeURIComponent(v.id)}`, {
        method: "POST",
        body: JSON.stringify(v),
      }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["enrollment", "verifications"] });
      setSelected((cur) => (cur && cur.id === saved.id ? saved : cur));
    },
    onError: (e) => toast.error(e.message || "Could not save the checklist"),
  });

  const rows = listQuery.data ?? [];
  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const statusCounts = useMemo(() => {
    const counts = { Pending: 0, "In Progress": 0, Complete: 0, "Needs Info": 0 } as Record<VerificationStatus, number>;
    for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [rows]);

  /** Persist a field change; completing everything flips status + stamps the verifier. */
  const update = (patch: Partial<Verification>) => {
    if (!selected) return;
    let next: Verification = { ...selected, ...patch };
    const { done, total } = counted(next);
    if (done === total && next.status !== "Needs Info") {
      next = { ...next, status: "Complete", verifiedBy: next.verifiedBy || user?.name || "Staff", verifiedDate: next.verifiedDate ?? new Date().toISOString() };
    } else if (done > 0 && next.status === "Pending") {
      next = { ...next, status: "In Progress" };
    }
    setSelected(next);
    save.mutate(next);
  };

  const createNew = () => {
    const name = newName.trim();
    if (!name) return;
    const v: Verification = {
      id: crypto.randomUUID(),
      childName: name,
      applicationDate: new Date().toISOString(),
      verifiedBy: "",
      verifiedDate: null,
      primaryAdult: emptyAdult(),
      secondaryAdult: newSecondAdult ? emptyAdult() : null,
      childChecklist: emptyChild(),
      status: "Pending",
      notes: "",
    };
    save.mutate(v, {
      onSuccess: () => {
        setNewOpen(false);
        setNewName("");
        setNewSecondAdult(false);
        toast.success(`Verification started for ${name}`);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            All ({rows.length})
          </Button>
          {(Object.keys(STATUS_META) as VerificationStatus[]).map((s) => (
            <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>
              {s} ({statusCounts[s]})
            </Button>
          ))}
        </div>
        <Button size="sm" className="gap-1" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4" /> New Verification
        </Button>
      </div>

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "No verifications yet. Start one when an application's eligibility documents arrive."
              : "Nothing matches this filter."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((v) => {
            const { done, total } = counted(v);
            return (
              <button key={v.id} type="button" className="text-left" onClick={() => setSelected(v)}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">{v.childName}</p>
                      <Badge variant="outline" className={STATUS_META[v.status]}>
                        {v.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Applied {new Date(v.applicationDate).toLocaleDateString()}
                      {v.verifiedBy && ` · Verified by ${v.verifiedBy}`}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Progress value={(done / Math.max(total, 1)) * 100} className="h-1.5 flex-1" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {done}/{total}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail: the actual checklist */}
      <Dialog open={selected != null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" /> {selected.childName}
                </DialogTitle>
                <DialogDescription>
                  {(() => {
                    const { done, total } = counted(selected);
                    return `${done} of ${total} items verified`;
                  })()}
                  {selected.verifiedDate && ` · completed ${new Date(selected.verifiedDate).toLocaleDateString()}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">Status</span>
                  <Select value={selected.status} onValueChange={(s) => update({ status: s as VerificationStatus })}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_META) as VerificationStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                <ChecklistSection
                  title="Primary Adult"
                  items={ADULT_ITEMS}
                  values={selected.primaryAdult}
                  onToggle={(key, val) => update({ primaryAdult: { ...selected.primaryAdult, [key]: val } })}
                />

                {selected.secondaryAdult ? (
                  <ChecklistSection
                    title="Secondary Adult"
                    items={ADULT_ITEMS}
                    values={selected.secondaryAdult}
                    onToggle={(key, val) => update({ secondaryAdult: { ...selected.secondaryAdult!, [key]: val } })}
                  />
                ) : (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => update({ secondaryAdult: emptyAdult() })}>
                    <UserPlus className="h-4 w-4" /> Add secondary adult
                  </Button>
                )}

                <ChecklistSection
                  title="Child Information & Documents"
                  items={CHILD_ITEMS}
                  values={selected.childChecklist}
                  onToggle={(key, val) => update({ childChecklist: { ...selected.childChecklist, [key]: val } })}
                />

                <div>
                  <p className="mb-1.5 text-sm font-medium text-foreground">Notes</p>
                  <Textarea
                    defaultValue={selected.notes}
                    rows={2}
                    placeholder="e.g., waiting on income documentation from employer"
                    onBlur={(e) => e.target.value !== selected.notes && update({ notes: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New verification */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a verification</DialogTitle>
            <DialogDescription>
              Track the ERSEA eligibility documents for an applicant. Progress syncs with the iOS app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Child's full name" />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={newSecondAdult} onCheckedChange={(v) => setNewSecondAdult(v === true)} />
              Include a secondary adult checklist
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button disabled={!newName.trim() || save.isPending} onClick={createNew}>
              {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChecklistSection<K extends string>({
  title,
  items,
  values,
  onToggle,
}: {
  title: string;
  items: { key: K; label: string }[];
  values: Record<K, boolean>;
  onToggle: (key: K, value: boolean) => void;
}) {
  const done = items.filter((i) => values[i.key]).length;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <span className="text-xs text-muted-foreground">
          {done}/{items.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <label
            key={item.key}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary/60"
          >
            <Checkbox checked={values[item.key]} onCheckedChange={(v) => onToggle(item.key, v === true)} />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  );
}
