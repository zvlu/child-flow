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

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [, setLocation] = useLocation();

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
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/20 group"
      >
        <Search className="h-3.5 w-3.5 text-white/70" />
        <span className="font-medium text-white/80">Quick Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/20 bg-white/10 px-1.5 font-mono text-[10px] font-medium text-white/60 opacity-100 ml-2">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
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
