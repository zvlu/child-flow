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
  Home, 
  FileText, 
  ShieldCheck, 
  Settings,
  Search,
  Plus,
  MessageSquare,
  BarChart3,
  BookOpen,
  UserCog,
  Baby
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [, setLocation] = useLocation();

  // Live record search: children and families load once the palette opens
  // (staff only) and cmdk's fuzzy filter matches them alongside commands.
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const { data: children } = trpc.children.list.useQuery(ORGANIZATION_ID, {
    enabled: open && isStaff,
    staleTime: 60_000,
  });
  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID, {
    enabled: open && isStaff,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (path: string) => {
    setOpen(false);
    setLocation(path);
  };

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
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search children, families, or commands..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {(children?.length ?? 0) > 0 && (
            <>
              <CommandGroup heading="Children">
                {children!.map((c) => (
                  <CommandItem
                    key={`child-${c.id}`}
                    value={`child ${c.firstName} ${c.lastName}`}
                    onSelect={() => runCommand(`/children/${c.id}`)}
                  >
                    <Baby className="mr-2 h-4 w-4" />
                    <span>
                      {c.firstName} {c.lastName}
                    </span>
                    {c.status && c.status !== "active" && (
                      <span className="ml-2 text-xs capitalize text-muted-foreground">{c.status}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          {(families?.length ?? 0) > 0 && (
            <>
              <CommandGroup heading="Families">
                {families!.map((f) => (
                  <CommandItem
                    key={`family-${f.id}`}
                    value={`family ${f.primaryContactName}`}
                    onSelect={() => runCommand(`/family-services?family=${f.id}`)}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>{f.primaryContactName}</span>
                    {f.city && <span className="ml-2 text-xs text-muted-foreground">{f.city}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => runCommand("/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/performance")}>
              <BarChart3 className="mr-2 h-4 w-4" />
              <span>Performance Panel</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/enrollment")}>
              <BookOpen className="mr-2 h-4 w-4" />
              <span>Enrollment</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/children")}>
              <Baby className="mr-2 h-4 w-4" />
              <span>Children Management</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/attendance")}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Attendance</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/health")}>
              <Heart className="mr-2 h-4 w-4" />
              <span>Health Records</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/communication")}>
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Communication Center</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/staff")}>
              <UserCog className="mr-2 h-4 w-4" />
              <span>Staff Management</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/compliance")}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              <span>Compliance</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => runCommand("/children?action=new")}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Enroll New Child</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/data-import")}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Import Roster Data</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/communication")}>
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Message a Family</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/communication?action=broadcast")}>
              <Megaphone className="mr-2 h-4 w-4" />
              <span>Send Program Broadcast</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand("/reports?action=generate")}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Generate PIR Report</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem onSelect={() => runCommand("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Program Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function Megaphone(props: any) {
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
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  )
}
