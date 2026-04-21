import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Heart, 
  Home, 
  UserCircle, 
  FileText, 
  ShieldCheck, 
  Settings,
  Search,
  Plus,
  MessageSquare,
  BarChart3
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();

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

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-full transition-all border border-slate-200 group"
      >
        <Search className="h-4 w-4" />
        <span className="font-medium">Quick Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100 ml-2">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => runCommand(() => navigate("/dashboard"))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/performance"))}>
              <BarChart3 className="mr-2 h-4 w-4" />
              <span>Performance Panel</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/children"))}>
              <Users className="mr-2 h-4 w-4" />
              <span>Children Management</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/attendance"))}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Attendance</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/health"))}>
              <Heart className="mr-2 h-4 w-4" />
              <span>Health Records</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/communication"))}>
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Communication Center</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick Actions">
            <CommandItem onSelect={() => runCommand(() => navigate("/children?action=new"))}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Enroll New Child</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/communication?action=broadcast"))}>
              <Megaphone className="mr-2 h-4 w-4" />
              <span>Send Program Broadcast</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/reports?action=generate"))}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Generate PIR Report</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
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
