import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileText, CheckCircle2, AlertTriangle, Loader2, Users, Heart, Baby, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { toast } from "sonner";
import { objectsToCsv, downloadCsv, parseCsvToObjects } from "@/lib/csv";

const GENDERS = new Set(["male", "female", "other", "prefer_not_to_say"]);
const STATUSES = new Set(["active", "inactive", "graduated", "withdrawn"]);

/** First non-empty value among several normalized-header aliases. */
const pick = (o: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (o[k]) return o[k];
  return "";
};

const parseDate = (raw: string): Date | undefined => {
  if (!raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
};

type ParsedRow = {
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  status?: "active" | "inactive" | "graduated" | "withdrawn";
  notes?: string;
  familyContactName?: string;
  familyContactPhone?: string;
  familyContactEmail?: string;
  secondaryContactName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  health?: {
    physicalDate?: Date;
    immunizationDate?: Date;
    dentalDate?: Date;
    visionDate?: Date;
    hearingDate?: Date;
  };
  healthProvider?: string;
  _problem?: string;
};

/** Map one CSV object (normalized headers) onto an import row, tolerating many column spellings. */
function mapRow(o: Record<string, string>): ParsedRow {
  const firstName = pick(o, "firstname", "first", "childfirstname", "childfirst").trim();
  const lastName = pick(o, "lastname", "last", "childlastname", "childlast").trim();
  const dob = parseDate(pick(o, "dateofbirth", "dob", "birthdate", "birthday"));
  const genderRaw = pick(o, "gender", "sex").toLowerCase().replace(/\s+/g, "_");
  const statusRaw = pick(o, "status", "enrollmentstatus").toLowerCase();

  const health: NonNullable<ParsedRow["health"]> = {};
  const physical = parseDate(pick(o, "physicaldate", "physical", "physicalexam", "lastphysical"));
  const imm = parseDate(pick(o, "immunizationdate", "immunizations", "immunizationsdate", "lastimmunization", "shots"));
  const dental = parseDate(pick(o, "dentaldate", "dental", "dentalexam", "lastdental"));
  const vision = parseDate(pick(o, "visiondate", "vision", "visionscreening"));
  const hearing = parseDate(pick(o, "hearingdate", "hearing", "hearingscreening"));
  if (physical) health.physicalDate = physical;
  if (imm) health.immunizationDate = imm;
  if (dental) health.dentalDate = dental;
  if (vision) health.visionDate = vision;
  if (hearing) health.hearingDate = hearing;

  const row: ParsedRow = {
    firstName,
    lastName,
    dateOfBirth: dob,
    gender: GENDERS.has(genderRaw) ? (genderRaw as ParsedRow["gender"]) : undefined,
    status: STATUSES.has(statusRaw) ? (statusRaw as ParsedRow["status"]) : undefined,
    notes: pick(o, "notes", "comments") || undefined,
    familyContactName:
      pick(o, "parentguardian", "parentguardianname", "parentname", "guardianname", "primarycontact", "primarycontactname", "parent", "guardian", "contactname", "familycontact").trim() || undefined,
    familyContactPhone: pick(o, "parentphone", "phone", "contactphone", "primarycontactphone", "guardianphone", "familyphone").trim() || undefined,
    familyContactEmail: pick(o, "parentemail", "email", "contactemail", "primarycontactemail", "guardianemail", "familyemail").trim() || undefined,
    secondaryContactName: pick(o, "secondarycontact", "secondarycontactname", "parent2", "guardian2").trim() || undefined,
    address: pick(o, "address", "street", "streetaddress").trim() || undefined,
    city: pick(o, "city").trim() || undefined,
    state: pick(o, "state", "st").trim().slice(0, 2).toUpperCase() || undefined,
    zipCode: pick(o, "zip", "zipcode", "postalcode").trim() || undefined,
    health: Object.keys(health).length ? health : undefined,
    healthProvider: pick(o, "provider", "healthprovider", "doctor", "pediatrician").trim() || undefined,
  };

  if (!firstName || !lastName) row._problem = "Missing child first or last name";
  return row;
}

const TEMPLATE_ROWS = [
  {
    "First Name": "Sofia",
    "Last Name": "Ramirez",
    "Date of Birth": "2021-03-12",
    Gender: "female",
    Status: "active",
    "Parent/Guardian": "Elena Ramirez",
    "Parent Phone": "555-201-3344",
    "Parent Email": "elena.ramirez@example.com",
    Address: "42 Maple St",
    City: "Hartford",
    State: "CT",
    Zip: "06103",
    "Physical Date": "2025-09-01",
    "Immunization Date": "2025-09-01",
    "Dental Date": "2025-10-15",
    Provider: "Dr. Chen, Hartford Pediatrics",
    Notes: "",
  },
  {
    "First Name": "Mateo",
    "Last Name": "Ramirez",
    "Date of Birth": "2022-11-02",
    Gender: "male",
    Status: "active",
    "Parent/Guardian": "Elena Ramirez",
    "Parent Phone": "555-201-3344",
    "Parent Email": "elena.ramirez@example.com",
    Address: "42 Maple St",
    City: "Hartford",
    State: "CT",
    Zip: "06103",
    "Physical Date": "2025-09-01",
    "Immunization Date": "",
    "Dental Date": "",
    Provider: "Dr. Chen, Hartford Pediatrics",
    Notes: "Sibling of Sofia — same family, linked automatically",
  },
];

export default function DataImport() {
  const [csvText, setCsvText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const rows = useMemo(() => (csvText.trim() ? parseCsvToObjects(csvText).map(mapRow) : []), [csvText]);
  const validRows = rows.filter((r) => !r._problem);
  const familyCount = useMemo(() => {
    const keys = new Set<string>();
    for (const r of validRows) {
      const k = r.familyContactEmail?.toLowerCase() || (r.familyContactName ? `${r.familyContactName.toLowerCase()}|${r.familyContactPhone ?? ""}` : null);
      if (k) keys.add(k);
    }
    return keys.size;
  }, [validRows]);
  const healthCount = validRows.reduce((n, r) => n + Object.keys(r.health ?? {}).length, 0);

  const importMutation = trpc.dataImport.roster.useMutation({
    onSuccess: (res) => {
      utils.children.list.invalidate(ORGANIZATION_ID);
      utils.families.list.invalidate(ORGANIZATION_ID);
      toast.success(
        `Imported ${res.childrenCreated} children, ${res.familiesCreated} new families (${res.familiesMatched} matched), ${res.healthRecordsCreated} health records` +
          (res.skippedDuplicates ? ` — ${res.skippedDuplicates} already on the roster, skipped` : "")
      );
      if (res.errors.length) {
        toast.warning(`${res.errors.length} row${res.errors.length === 1 ? "" : "s"} failed — see details below`);
      } else {
        setCsvText("");
      }
    },
    onError: (e) => toast.error(e.message || "Import failed"),
  });

  const readFile = async (file: File) => {
    try {
      setCsvText(await file.text());
    } catch {
      toast.error("Could not read that file.");
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await readFile(file);
  };

  const downloadTemplate = () => {
    downloadCsv("roster-import-template.csv", objectsToCsv(TEMPLATE_ROWS));
    toast.success("Template downloaded — fill it in and drop it back here");
  };

  const submit = () => {
    if (!validRows.length) {
      toast.error("No valid rows to import. Each row needs a child first and last name.");
      return;
    }
    importMutation.mutate({
      organizationId: ORGANIZATION_ID,
      rows: validRows.map(({ _problem, ...r }) => r),
    });
  };

  const result = importMutation.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Import</h1>
        <p className="mt-1 text-muted-foreground">
          Migrate your whole roster from one spreadsheet — children, family contacts, and health exam
          dates. Siblings sharing a parent contact are linked to the same family automatically.
        </p>
      </div>

      {/* Step 1: get the file in */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> 1. Add your spreadsheet
          </CardTitle>
          <CardDescription>
            Drop a CSV exported from Excel, Google Sheets, or your old system. Column names are
            matched flexibly (&ldquo;DOB&rdquo;, &ldquo;Date of Birth&rdquo;, and
            &ldquo;Birthdate&rdquo; all work).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) await readFile(file);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drag & drop your CSV here</p>
            <p className="text-xs text-muted-foreground">or</p>
            <div className="flex flex-wrap justify-center gap-2">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <FileText className="mr-1 h-4 w-4" /> Choose file
              </Button>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-1 h-4 w-4" /> Download template
              </Button>
            </div>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={4}
            placeholder="…or paste CSV text here, header row first"
            className="w-full rounded-md border bg-background p-3 font-mono text-xs"
          />
        </CardContent>
      </Card>

      {/* Step 2: preview */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" /> 2. Check the preview
            </CardTitle>
            <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Baby className="h-3.5 w-3.5" /> {validRows.length} children
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {familyCount} families
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" /> {healthCount} health records
              </span>
              {rows.length - validRows.length > 0 && (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> {rows.length - validRows.length} rows will be skipped
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Child</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Family contact</TableHead>
                    <TableHead>Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((r, i) => (
                    <TableRow key={i} className={r._problem ? "opacity-60" : undefined}>
                      <TableCell>
                        {r._problem ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" aria-label={r._problem} />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.firstName || "—"} {r.lastName}
                        {r._problem && <p className="text-xs font-normal text-amber-600">{r._problem}</p>}
                      </TableCell>
                      <TableCell>{r.dateOfBirth ? r.dateOfBirth.toISOString().slice(0, 10) : "—"}</TableCell>
                      <TableCell>
                        {r.familyContactName || r.familyContactEmail || "—"}
                        {r.familyContactPhone && (
                          <span className="block text-xs text-muted-foreground">{r.familyContactPhone}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(r.health ?? {}).map((k) => (
                            <Badge key={k} variant="secondary" className="text-xs">
                              {k.replace("Date", "")}
                            </Badge>
                          ))}
                          {!r.health && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 100 && (
                <p className="border-t p-2 text-center text-xs text-muted-foreground">
                  Showing first 100 of {rows.length} rows — all valid rows will be imported.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: import */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRight className="h-4 w-4" /> 3. Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={submit} disabled={importMutation.isPending || !validRows.length} size="lg">
              {importMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Import {validRows.length}{" "}
                  {validRows.length === 1 ? "child" : "children"}
                </>
              )}
            </Button>

            {result && (
              <div className="rounded-md border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Import complete</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  <li>{result.childrenCreated} children created</li>
                  <li>
                    {result.familiesCreated} families created, {result.familiesMatched} linked to existing families
                  </li>
                  <li>{result.healthRecordsCreated} health records added</li>
                  {result.skippedDuplicates > 0 && (
                    <li>{result.skippedDuplicates} skipped — already on the roster (same name and birth date)</li>
                  )}
                </ul>
                {result.errors.length > 0 && (
                  <div className="mt-2 text-amber-700">
                    <p className="font-medium">Rows with errors:</p>
                    <ul className="mt-1 space-y-0.5">
                      {result.errors.map((e) => (
                        <li key={e.rowIndex}>
                          Row {e.rowIndex + 1}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
