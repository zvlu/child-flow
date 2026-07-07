import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { ORGANIZATION_ID } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Briefcase,
  MessageSquare,
  AlertTriangle,
  Zap,
  FileText,
  MoreHorizontal,
  CalendarDays,
  DollarSign,
  UtensilsCrossed,
  Clock,
  FileSignature,
  Layers,
  School,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CommandPalette } from "./CommandPalette";
import {
  TOP_NAV_PRIMARY_COUNT,
  ALL_SIDE_NAV_ITEMS,
  applyTopNav,
  applySideNav,
} from "@/config/nav";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [location, navigate] = useLocation();
  const { user, logout, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  // Apply the signed-in user's saved layout (hide + reorder); falls back to
  // app defaults when there are no preferences.
  const navPrefs = (user as any)?.settings?.navigation ?? null;
  const navRole = ((user as any)?.role ?? "staff") as "admin" | "staff" | "parent";
  const isOwner = Boolean((user as any)?.isOwner);
  const effectiveTopNav = applyTopNav(navPrefs, navRole);
  const effectiveSideSections = applySideNav(navPrefs, navRole);
  const topNavPrimaryItems = effectiveTopNav.slice(0, TOP_NAV_PRIMARY_COUNT);
  const topNavOverflowItems = effectiveTopNav.slice(TOP_NAV_PRIMARY_COUNT);

  const handleTopNavAction = (label: string) => {
    toast.info(`${label} module selected`);
  };

  const isTopNavActive = (path: string) => location === path || location.startsWith(`${path}/`);
  const isNavItemActive = (path: string) => location === path || (path !== "/dashboard" && location.startsWith(path));
  const allSideNavItems = ALL_SIDE_NAV_ITEMS;
  const moreToolsItems = [
    { path: "/bulk-actions", label: "Bulk Actions", icon: Zap },
    { path: "/billing", label: "Billing", icon: FileText },
    { path: "/parent-portal", label: "Parent Portal", icon: Home },
    { path: "/meal-planning", label: "Meal Planning", icon: FileText },
    { path: "/staff-operations", label: "Staff Ops", icon: UserCog },
    { path: "/report-builder", label: "Report Builder", icon: BarChart3 },
  ];
  const activeMoreTool = moreToolsItems.some((item) => isNavItemActive(item.path));
  const showMoreTools = moreToolsOpen || activeMoreTool;
  const { data: healthFollowUps = [] } = trpc.health.followUps.useQuery(
    { organizationId: ORGANIZATION_ID, dueWithinDays: 30 },
    { refetchInterval: 60_000 }
  );
  const overdueCount = healthFollowUps.filter((item) => item.severity === "overdue").length;

  // Aggregated notifications for the bell (health, attendance, absences,
  // messages, documents) — same engine as the dashboard, refreshed each minute.
  const { data: bellAlerts = [] } = trpc.dashboard.alerts.useQuery(undefined, { refetchInterval: 60_000 });
  const alertHref = (a: { type: string; filter?: string }) => {
    switch (a.type) {
      case "health": return `/health?status=${a.filter === "Overdue" ? "overdue" : "due_soon"}`;
      case "attendance": return "/attendance";
      case "absence": return "/action-queue";
      case "message": return "/communication";
      case "document": return "/documents";
      default: return "/dashboard";
    }
  };
  const alertAccent = (type: string) =>
    type === "health" || type === "attendance" ? "text-destructive"
    : type === "absence" ? "text-amber-600"
    : type === "message" ? "text-blue-600" : "text-muted-foreground";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "S";

  return (
    <div className="flex h-screen bg-background overflow-hidden flex-col">
      {/* Top Navigation Bar - Matching ChildPlus Style */}
      <header className="h-14 bg-[#2E4034] text-white flex items-center px-3 md:px-4 gap-2 flex-shrink-0 shadow-md z-20">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/85 hover:text-white hover:bg-card/10 md:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded-lg bg-card/20 flex items-center justify-center">
            <Baby className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">Sprout</span>
        </div>
        
        <nav className="hidden md:flex flex-1 items-center h-full min-w-0 overflow-x-auto no-scrollbar">
          {topNavPrimaryItems.map((item) => {
            const isActive = isTopNavActive(item.path);
            return (
              <Link key={item.label} href={item.path} asChild>
                <a 
                  className={cn(
                    "px-3 md:px-4 h-full flex items-center text-xs font-semibold transition-colors whitespace-nowrap border-b-2 border-transparent",
                    isActive 
                      ? "bg-card/20 text-white border-white"
                      : "hover:bg-card/10 text-white/85 hover:text-white"
                  )}
                >
                  {item.label}
                </a>
              </Link>
            );
          })}

          {topNavOverflowItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-full rounded-none px-3 md:px-4 text-xs font-semibold text-white/85 hover:text-white hover:bg-card/10 border-b-2 border-transparent",
                    topNavOverflowItems.some((item) => isTopNavActive(item.path)) && "bg-card/20 text-white border-white"
                  )}
                >
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-xl">
                {topNavOverflowItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isTopNavActive(item.path);
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link href={item.path} asChild>
                        <a className={cn("flex items-center gap-2", isActive && "font-semibold")}>
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </a>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>

        <div className="flex items-center gap-2 md:gap-3 ml-auto md:ml-4 shrink-0">
          <div className="hidden xl:block">
            <CommandPalette />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-card/10" onClick={() => handleTopNavAction("Print")}>
            <Printer className="h-4 w-4" />
          </Button>
          {/* Account menu — identity, settings, theme, sign out. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 gap-2 px-1.5 text-white/85 hover:text-white hover:bg-card/10"
                aria-label="Account menu"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={(user as any)?.avatarUrl ?? undefined} alt={user?.name ?? "Account"} />
                  <AvatarFallback className="text-[11px] bg-white/15 text-white">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden lg:block max-w-[120px] truncate text-xs font-medium">
                  {user?.name ?? "Account"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl">
              <div className="px-3 py-2">
                <p className="text-sm font-medium truncate">{user?.name ?? "Signed in"}</p>
                {user?.email && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
                <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mt-1">
                  {(user as any)?.role ?? "staff"}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <UserCircle className="h-4 w-4 mr-2" />
                Account &amp; Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                Toggle Theme
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-red-600 focus:text-red-600"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {mobileNavOpen && (
          <button
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
        )}
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed top-14 bottom-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200 ease-in-out",
            "w-72 md:static md:top-auto md:bottom-auto md:left-auto md:z-auto",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            sidebarOpen ? "md:w-64" : "md:w-16"
          )}
        >
          <div className="flex items-center h-12 px-4 border-b border-sidebar-border justify-between">
            {sidebarOpen && <span className="text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">Main Menu</span>}
            <button
              onClick={() => setMobileNavOpen(false)}
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors md:hidden"
              aria-label="Close mobile navigation"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:inline-flex p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
              aria-label="Toggle sidebar width"
            >
              {sidebarOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-2">
            <div className="space-y-4">
              {effectiveSideSections.map((section) => (
                <div key={section.title}>
                  {sidebarOpen && (
                    <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">
                      {section.title}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isNavItemActive(item.path);
                      return (
                        <li key={item.path}>
                          <Link href={item.path} asChild>
                            <a
                              onClick={() => setMobileNavOpen(false)}
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
                </div>
              ))}

              {isOwner && (
                <div>
                  {sidebarOpen && (
                    <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">Platform</p>
                  )}
                  <ul className="space-y-1">
                    <li>
                      <Link href="/org-admin" asChild>
                        <a
                          onClick={() => setMobileNavOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-bold transition-all duration-150",
                            isNavItemActive("/org-admin")
                              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <Building2 className="h-4 w-4 flex-shrink-0" />
                          {sidebarOpen && <span className="flex-1 truncate">Organizations</span>}
                        </a>
                      </Link>
                    </li>
                  </ul>
                </div>
              )}

              <div className="pt-1">
                {sidebarOpen ? (
                  <>
                    <button
                      onClick={() => setMoreToolsOpen(!moreToolsOpen)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-bold transition-all duration-150",
                        activeMoreTool
                          ? "bg-sidebar-primary/15 text-sidebar-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Briefcase className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 text-left">More tools</span>
                      <ChevronRight className={cn("h-4 w-4 transition-transform", showMoreTools && "rotate-90")} />
                    </button>
                    {showMoreTools && (
                      <ul className="space-y-1 mt-1 pl-2">
                        {moreToolsItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = isNavItemActive(item.path);
                          return (
                            <li key={item.path}>
                              <Link href={item.path} asChild>
                                <a
                                  onClick={() => setMobileNavOpen(false)}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all duration-150",
                                    isActive
                                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                  )}
                                >
                                  <Icon className="h-4 w-4 flex-shrink-0" />
                                  <span className="flex-1 truncate">{item.label}</span>
                                </a>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setMoreToolsOpen(!moreToolsOpen)}
                    className={cn(
                      "w-full flex items-center justify-center px-3 py-2 rounded-xl transition-all duration-150",
                      activeMoreTool
                        ? "bg-sidebar-primary/15 text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    aria-label="Toggle more tools"
                  >
                    <Briefcase className="h-4 w-4 flex-shrink-0" />
                  </button>
                )}
              </div>
            </div>
          </nav>

          {/* User section */}
          {sidebarOpen && (
            <div className="p-3 border-t border-sidebar-border">
              <div className="flex items-center gap-3 w-full p-2 rounded-lg bg-sidebar-accent/50">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  {(user as any)?.avatarUrl ? (
                    <AvatarImage src={(user as any).avatarUrl} alt={user?.name || "Profile picture"} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-sidebar-foreground truncate">{user?.name || "User"}</p>
                  <p className="text-[10px] text-sidebar-foreground/50 truncate uppercase font-bold tracking-tighter">{user?.role || "Staff"}</p>
                </div>
                <button
                  onClick={() => logout()}
                  className="p-1.5 rounded-md text-sidebar-foreground/60 hover:text-red-500 hover:bg-sidebar-accent transition-colors flex-shrink-0"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Page Header (Breadcrumb style) */}
          <header className="h-10 border-b border-border bg-card flex items-center px-3 md:px-6 gap-3 md:gap-4 flex-shrink-0">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Sprout</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <h2 className="text-[11px] font-bold text-foreground uppercase tracking-widest">
                {allSideNavItems.find((i) => isNavItemActive(i.path))?.label || "Dashboard"}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 relative" aria-label={`Notifications${bellAlerts.length ? `, ${bellAlerts.length} new` : ""}`}>
                    <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                    {bellAlerts.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center text-[9px] font-bold text-white bg-destructive rounded-full">
                        {bellAlerts.length > 9 ? "9+" : bellAlerts.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-96 rounded-xl">
                  <div className="px-3 py-2 border-b">
                    <p className="text-sm font-semibold">Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {bellAlerts.length === 0 ? "You're all caught up" : `${bellAlerts.length} item${bellAlerts.length === 1 ? "" : "s"} need attention`}
                    </p>
                  </div>
                  {bellAlerts.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      Nothing needs your attention right now.
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {bellAlerts.map((alert) => (
                        <DropdownMenuItem key={alert.id} asChild>
                          <Link href={alertHref(alert)} asChild>
                            <a className="flex flex-col items-start gap-0.5 py-2 cursor-pointer">
                              <span className={cn("text-[11px] font-semibold uppercase tracking-wide", alertAccent(alert.type))}>
                                {alert.type}
                              </span>
                              <span className="text-sm leading-tight font-medium">{alert.title}</span>
                              <span className="text-xs text-muted-foreground leading-tight">{alert.description}</span>
                            </a>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" asChild>
                      <a className="text-sm font-medium cursor-pointer">Open dashboard</a>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-[#FBF6EE]">
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
