import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Heart,
  Home,
  UserCog,
  BarChart3,
  ShieldCheck,
  Settings,
  Menu,
  X,
  ChevronRight,
  Bell,
  Sun,
  Moon,
  LogOut,
  UserCircle,
  Baby,
  BookOpen,
  Printer,
  MessageSquare,
  Zap,
  Briefcase,
  FileText,
  Wrench,
  ListTodo,
  MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CommandPalette } from "./CommandPalette";

const topNavItems = [
  { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { path: "/communication", label: "Communication", icon: MessageSquare },
  { path: "/entry-express", label: "Entry Express", icon: Zap },
  { path: "/management", label: "Management", icon: Briefcase },
  { path: "/performance", label: "Performance Panel", icon: BarChart3 },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/services", label: "Services", icon: Home },
  { path: "/setup", label: "Setup", icon: Wrench },
  { path: "/todo", label: "To-Do List", icon: ListTodo },
];

const sideNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/performance", label: "Performance Panel", icon: BarChart3 },
  { path: "/enrollment", label: "Enrollment", icon: BookOpen },
  { path: "/children", label: "Children", icon: Baby },
  { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { path: "/health", label: "Health Records", icon: Heart },
  { path: "/family-services", label: "Family Services", icon: Home },
  { path: "/staff", label: "Staff", icon: UserCog },
  { path: "/documents", label: "Documents", icon: FileText },
  { path: "/bulk-actions", label: "Bulk Actions", icon: Zap },
  { path: "/ai-insights", label: "AI Insights", icon: Zap },
  { path: "/billing", label: "Billing", icon: FileText },
  { path: "/parent-portal", label: "Parent Portal", icon: Home },
  { path: "/meal-planning", label: "Meal Planning", icon: FileText },
  { path: "/staff-operations", label: "Staff Ops", icon: UserCog },
  { path: "/report-builder", label: "Report Builder", icon: BarChart3 },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/compliance", label: "Compliance", icon: ShieldCheck },
  { path: "/settings", label: "Settings", icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location] = useLocation();
  const { user, logout, loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const { theme, setTheme } = useTheme();
  const loginUrl = getLoginUrl();

  const handleTopNavAction = (label: string) => {
    toast.info(`${label} module selected`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to continue</p>
          <a href={loginUrl}>
            <Button>Sign In</Button>
          </a>
        </div>
      </div>
    );
  }

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "CF";

  return (
    <div className="flex h-screen bg-background overflow-hidden flex-col">
      {/* Top Navigation Bar - Matching ChildPlus Style */}
      <header className="h-12 bg-[#5b4a8c] text-white flex items-center px-4 gap-2 flex-shrink-0 shadow-md z-20">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Baby className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">ChildFlow</span>
        </div>
        
        <nav className="flex-1 flex items-center h-full overflow-x-auto no-scrollbar">
          {topNavItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.label} href={item.path}>
                <a 
                  className={cn(
                    "px-3 h-full flex items-center text-[11px] font-bold transition-colors whitespace-nowrap",
                    isActive 
                      ? "bg-white/20 border-b-2 border-white" 
                      : "hover:bg-white/10 text-white/80 hover:text-white"
                  )}
                >
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 ml-4">
          <div className="hidden md:block">
            <CommandPalette />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10" onClick={() => handleTopNavAction("Print")}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10" onClick={() => handleTopNavAction("User Profile")}>
            <UserCircle className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                Toggle Theme
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200 ease-in-out flex-shrink-0 border-r border-sidebar-border",
            sidebarOpen ? "w-64" : "w-16"
          )}
        >
          <div className="flex items-center h-12 px-4 border-b border-sidebar-border justify-between">
            {sidebarOpen && <span className="text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">Main Menu</span>}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
            >
              {sidebarOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-2">
            <ul className="space-y-1">
              {sideNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path || (item.path !== "/dashboard" && location.startsWith(item.path));
                return (
                  <li key={item.path}>
                    <Link href={item.path}>
                      <a
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-bold transition-all duration-150",
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        {sidebarOpen && <span className="flex-1 truncate">{item.label}</span>}
                      </a>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User section */}
          {sidebarOpen && (
            <div className="p-3 border-t border-sidebar-border">
              <div className="flex items-center gap-3 w-full p-2 rounded-lg bg-sidebar-accent/50">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-sidebar-foreground truncate">{user?.name || "User"}</p>
                  <p className="text-[10px] text-sidebar-foreground/50 truncate uppercase font-bold tracking-tighter">{user?.role || "Staff"}</p>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Page Header (Breadcrumb style) */}
          <header className="h-10 border-b border-border bg-white flex items-center px-6 gap-4 flex-shrink-0">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ChildFlow</span>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <h2 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">
                {sideNavItems.find(i => location === i.path || (i.path !== "/dashboard" && location.startsWith(i.path)))?.label || "Dashboard"}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                <CalendarIcon className="h-3 w-3" />
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 relative">
                <Bell className="h-3.5 w-3.5 text-slate-400" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-destructive rounded-full" />
              </Button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-[#f8fafc]">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function CalendarIcon(props: any) {
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
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}
