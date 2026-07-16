import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Heart,
  FileText,
  ShieldCheck,
  Settings,
  Search,
  Plus,
  MessageSquare,
  BarChart3,
  BookOpen,
  UserCog,
  Baby,
  Loader2,
  Megaphone,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOrgModules } from "@/hooks/useOrgModules";

// `headStart: true` marks entries that only make sense for Head Start-funded
// programs (§1302 compliance) — filtered out below for core-only orgs so a
// generic daycare never sees PIR/compliance vocabulary in ⌘K.
const NAV_COMMANDS = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Children", path: "/children", icon: Baby },
  { label: "Attendance", path: "/attendance", icon: Calendar },
  { label: "Enrollment", path: "/enrollment", icon: BookOpen },
  { label: "Health Records", path: "/health", icon: Heart },
  { label: "Communication Center", path: "/communication", icon: MessageSquare },
  { label: "Staff Management", path: "/staff", icon: UserCog },
  { label: "Performance Panel", path: "/performance", icon: BarChart3 },
  { label: "Compliance & PIR", path: "/compliance", icon: ShieldCheck, headStart: true },
  { label: "Program Settings", path: "/settings", icon: Settings },
];

const QUICK_ACTIONS = [
  { label: "Enroll New Child", path: "/children?action=new", icon: Plus },
  { label: "Import Roster Data", path: "/data-import", icon: FileText },
  { label: "Message a Family", path: "/communication", icon: MessageSquare },
  { label: "Send Program Broadcast", path: "/communication?action=broadcast", icon: Megaphone },
  { label: "Generate PIR Report", path: "/reports?action=generate", icon: FileText, headStart: true },
];

const STATUS_TONE: Record<string, string> = {
  active: "text-primary",
  inactive: "text-muted-foreground",
  graduated: "text-blue-600",
  withdrawn: "text-red-600",
};

/**
 * ⌘K palette with two modes: an empty query shows navigation and quick
 * actions; typing switches to live record search across children, families,
 * and staff (top 5 per group), each result jumping straight to its page.
 * Filtering is manual (shouldFilter=false) so we control ranking and caps.
 */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [, setLocation] = useLocation();

  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const enabled = open && isStaff;
  const hasHeadStart = useOrgModules().has("head_start");

  const childrenQuery = trpc.children.list.useQuery(ORGANIZATION_ID, { enabled, staleTime: 60_000 });
  const familiesQuery = trpc.families.list.useQuery(ORGANIZATION_ID, { enabled, staleTime: 60_000 });
  const staffQuery = trpc.staff.list.useQuery(ORGANIZATION_ID, { enabled, staleTime: 60_000 });
  const searching = query.trim().length > 0;
  const loading = searching && (childrenQuery.isLoading || familiesQuery.isLoading || staffQuery.isLoading);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset to navigation mode each time the palette opens.
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const runCommand = (path: string) => {
    setOpen(false);
    setLocation(path);
  };

  const q = query.trim().toLowerCase();
  const match = (...parts: (string | null | undefined)[]) =>
    parts.some((p) => (p ?? "").toLowerCase().includes(q));

  const childResults = searching
    ? ((childrenQuery.data ?? []) as any[]).filter((c) => match(c.firstName, c.lastName, `${c.firstName} ${c.lastName}`)).slice(0, 5)
    : [];
  const familyResults = searching
    ? ((familiesQuery.data ?? []) as any[]).filter((f) => match(f.primaryContactName, f.primaryContactEmail)).slice(0, 5)
    : [];
  const staffResults = searching
    ? ((staffQuery.data ?? []) as any[]).filter((s) => match(s.firstName, s.lastName, `${s.firstName} ${s.lastName}`, s.position)).slice(0, 5)
    : [];
  const availableNav = NAV_COMMANDS.filter((n) => hasHeadStart || !n.headStart);
  const availableActions = QUICK_ACTIONS.filter((a) => hasHeadStart || !a.headStart);
  const navResults = searching ? availableNav.filter((n) => n.label.toLowerCase().includes(q)) : availableNav;
  const actionResults = searching ? availableActions.filter((a) => a.label.toLowerCase().includes(q)) : availableActions;

  const noResults =
    searching && !loading &&
    childResults.length + familyResults.length + staffResults.length + navResults.length + actionResults.length === 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-card/10 hover:bg-card/20 rounded-full transition-all border border-white/20 group"
      >
        <Search className="h-3.5 w-3.5 text-white/70" />
        <span className="font-medium text-white/80">Quick Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/20 bg-card/10 px-1.5 font-mono text-[10px] font-medium text-white/60 opacity-100 ml-2">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Search children, families, staff, or commands…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          )}
          {noResults && <CommandEmpty>No results found for "{query.trim()}"</CommandEmpty>}

          {childResults.length > 0 && (
            <>
              <CommandGroup heading="Children">
                {childResults.map((c) => (
                  <CommandItem key={`child-${c.id}`} value={`child-${c.id}`} onSelect={() => runCommand(`/children/${c.id}`)}>
                    <Baby className="mr-2 h-4 w-4" />
                    <span className="flex-1">
                      {c.firstName} {c.lastName}
                    </span>
                    {c.status && (
                      <span className={`text-xs capitalize ${STATUS_TONE[c.status] ?? "text-muted-foreground"}`}>{c.status}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {familyResults.length > 0 && (
            <>
              <CommandGroup heading="Families">
                {familyResults.map((f) => (
                  <CommandItem key={`family-${f.id}`} value={`family-${f.id}`} onSelect={() => runCommand(`/family-services?family=${f.id}`)}>
                    <Users className="mr-2 h-4 w-4" />
                    <span className="flex-1">{f.primaryContactName}</span>
                    {f.primaryContactPhone && <span className="text-xs text-muted-foreground">{f.primaryContactPhone}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {staffResults.length > 0 && (
            <>
              <CommandGroup heading="Staff">
                {staffResults.map((s) => (
                  <CommandItem key={`staff-${s.id}`} value={`staff-${s.id}`} onSelect={() => runCommand("/staff")}>
                    <UserCog className="mr-2 h-4 w-4" />
                    <span className="flex-1">
                      {s.firstName} {s.lastName}
                    </span>
                    {(s.position || s.role) && (
                      <span className="text-xs capitalize text-muted-foreground">{s.position || s.role}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {navResults.length > 0 && (
            <CommandGroup heading="Navigation">
              {navResults.map((n) => (
                <CommandItem key={n.path} value={`nav-${n.path}`} onSelect={() => runCommand(n.path)}>
                  <n.icon className="mr-2 h-4 w-4" />
                  <span>{n.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {actionResults.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Quick Actions">
                {actionResults.map((a) => (
                  <CommandItem key={a.label} value={`action-${a.label}`} onSelect={() => runCommand(a.path)}>
                    <a.icon className="mr-2 h-4 w-4" />
                    <span>{a.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
