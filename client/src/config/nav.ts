import {
  LayoutDashboard, Users, ClipboardCheck, Heart, Home, UserCog, BarChart3,
  ShieldCheck, Settings, Baby, BookOpen, FileText, CalendarDays, DollarSign,
  UtensilsCrossed, Clock, FileSignature, Layers, School, AlertTriangle, Zap,
  MessageSquare, type LucideIcon,
} from "lucide-react";

export type NavItem = { path: string; label: string; icon: LucideIcon };
export type NavSection = { title: string; items: NavItem[] };

/**
 * Canonical navigation. These are the *defaults*; a user's saved preferences
 * (users.settings.navigation) reorder and hide items on top of these, and
 * "Reset to default" simply clears those preferences.
 */
export const TOP_NAV_ITEMS: NavItem[] = [
  { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { path: "/communication", label: "Communication", icon: MessageSquare },
  { path: "/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/action-queue", label: "Action Queue", icon: AlertTriangle },
  { path: "/performance", label: "Performance Panel", icon: BarChart3 },
  { path: "/billing", label: "Billing", icon: DollarSign },
  { path: "/meal-planning", label: "Meal Planning", icon: UtensilsCrossed },
  { path: "/staff-operations", label: "Staff Operations", icon: Clock },
  { path: "/bulk-actions", label: "Bulk Actions", icon: Layers },
];

/** How many *visible* top-nav items render inline before the rest collapse into "More". */
export const TOP_NAV_PRIMARY_COUNT = 5;

export const SIDE_NAV_SECTIONS: NavSection[] = [
  {
    title: "Core",
    items: [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { path: "/children", label: "Children", icon: Baby },
      { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
      { path: "/staff", label: "Staff", icon: UserCog },
      { path: "/family-services", label: "Family Services", icon: Home },
      { path: "/classrooms", label: "Classrooms", icon: School },
    ],
  },
  {
    title: "Operations",
    items: [
      { path: "/enrollment", label: "Enrollment", icon: BookOpen },
      { path: "/health", label: "Health Records", icon: Heart },
      { path: "/calendar", label: "Calendar", icon: CalendarDays },
      { path: "/documents", label: "Documents", icon: FileText },
      { path: "/digital-documents", label: "E-Signatures", icon: FileSignature },
      { path: "/action-queue", label: "Action Queue", icon: AlertTriangle },
      { path: "/bulk-actions", label: "Bulk Actions", icon: Layers },
      { path: "/compliance", label: "Compliance", icon: ShieldCheck },
    ],
  },
  {
    title: "Business",
    items: [
      { path: "/billing", label: "Billing", icon: DollarSign },
      { path: "/meal-planning", label: "Meal Planning", icon: UtensilsCrossed },
      { path: "/staff-operations", label: "Staff Operations", icon: Clock },
      { path: "/parent-portal", label: "Parent Portal", icon: Users },
    ],
  },
  {
    title: "Insights",
    items: [
      { path: "/performance", label: "Performance Panel", icon: BarChart3 },
      { path: "/reports", label: "Reports", icon: FileText },
      { path: "/report-builder", label: "Report Builder", icon: Zap },
      { path: "/ai-insights", label: "AI Insights", icon: Zap },
      { path: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Per-surface customization: a desired path order and a set of hidden paths. */
export type NavSurfacePrefs = { order?: string[]; hidden?: string[] };
export type NavPreferences = { topNav?: NavSurfacePrefs; sideNav?: NavSurfacePrefs };

/**
 * Stable sort by the user's saved order. Items missing from `order` keep their
 * canonical relative position (they sort after ordered items, in original order).
 */
export function sortByOrder<T extends { path: string }>(items: T[], order: string[] | undefined): T[] {
  if (!order || order.length === 0) return items;
  const rank = (p: string) => {
    const i = order.indexOf(p);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => rank(a.item.path) - rank(b.item.path) || a.i - b.i)
    .map(({ item }) => item);
}

/** Effective top-nav items after applying hide + order preferences. */
export function applyTopNav(prefs: NavPreferences | null | undefined): NavItem[] {
  const hidden = new Set(prefs?.topNav?.hidden ?? []);
  return sortByOrder(TOP_NAV_ITEMS.filter((i) => !hidden.has(i.path)), prefs?.topNav?.order);
}

/**
 * Effective side-nav sections after applying hide + order. Sorting is global
 * (a single order array) but each section only contains its own items, so items
 * stay within their section while honoring the user's order. Empty sections drop.
 */
export function applySideNav(prefs: NavPreferences | null | undefined): NavSection[] {
  const hidden = new Set(prefs?.sideNav?.hidden ?? []);
  const order = prefs?.sideNav?.order;
  return SIDE_NAV_SECTIONS
    .map((section) => ({ ...section, items: sortByOrder(section.items.filter((i) => !hidden.has(i.path)), order) }))
    .filter((section) => section.items.length > 0);
}

/** All side-nav items, ignoring preferences — used for breadcrumb label lookup. */
export const ALL_SIDE_NAV_ITEMS: NavItem[] = SIDE_NAV_SECTIONS.flatMap((s) => s.items);
