import {
  LayoutDashboard, Users, ClipboardCheck, Heart, Home, UserCog, BarChart3,
  ShieldCheck, Settings, Baby, BookOpen, FileText, CalendarDays, DollarSign,
  UtensilsCrossed, Clock, FileSignature, Layers, School, AlertTriangle, Zap,
  MessageSquare, HandHeart, type LucideIcon,
} from "lucide-react";

export type NavRole = "admin" | "staff" | "parent";
/**
 * `roles` controls who sees the item:
 *   - omitted        → admin + staff (the default for program-work items)
 *   - ["admin"]      → admin only (financials, compliance, bulk ops)
 *   - includes "parent" → also visible to family/parent accounts
 */
export type NavItem = { path: string; label: string; icon: LucideIcon; roles?: NavRole[] };
export type NavSection = { title: string; items: NavItem[] };

const PARENT_OK: NavRole[] = ["admin", "staff", "parent"];
const ADMIN_ONLY: NavRole[] = ["admin"];

/**
 * Canonical navigation. These are the *defaults*; role filtering applies first,
 * then a user's saved preferences (users.settings.navigation) reorder and hide
 * items on top, and "Reset to default" simply clears those preferences.
 */
export const TOP_NAV_ITEMS: NavItem[] = [
  { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { path: "/communication", label: "Communication", icon: MessageSquare, roles: PARENT_OK },
  { path: "/calendar", label: "Calendar", icon: CalendarDays, roles: PARENT_OK },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/action-queue", label: "Action Queue", icon: AlertTriangle },
  { path: "/performance", label: "Performance Panel", icon: BarChart3 },
  { path: "/billing", label: "Billing", icon: DollarSign, roles: ADMIN_ONLY },
  { path: "/meal-planning", label: "Meal Planning", icon: UtensilsCrossed },
  { path: "/staff-operations", label: "Staff Operations", icon: Clock },
  { path: "/bulk-actions", label: "Bulk Actions", icon: Layers, roles: ADMIN_ONLY },
];

/** How many *visible* top-nav items render inline before the rest collapse into "More". */
export const TOP_NAV_PRIMARY_COUNT = 5;

export const SIDE_NAV_SECTIONS: NavSection[] = [
  {
    title: "Core",
    items: [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: PARENT_OK },
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
      { path: "/calendar", label: "Calendar", icon: CalendarDays, roles: PARENT_OK },
      { path: "/documents", label: "Documents", icon: FileText, roles: PARENT_OK },
      { path: "/digital-documents", label: "E-Signatures", icon: FileSignature },
      { path: "/action-queue", label: "Action Queue", icon: AlertTriangle },
      { path: "/bulk-actions", label: "Bulk Actions", icon: Layers, roles: ADMIN_ONLY },
      { path: "/compliance", label: "Compliance", icon: ShieldCheck, roles: ADMIN_ONLY },
    ],
  },
  {
    title: "Business",
    items: [
      { path: "/billing", label: "Billing", icon: DollarSign, roles: ADMIN_ONLY },
      { path: "/in-kind", label: "In-Kind", icon: HandHeart },
      { path: "/meal-planning", label: "Meal Planning", icon: UtensilsCrossed },
      { path: "/staff-operations", label: "Staff Operations", icon: Clock },
      { path: "/parent-portal", label: "Parent Portal", icon: Users, roles: PARENT_OK },
    ],
  },
  {
    title: "Insights",
    items: [
      { path: "/performance", label: "Performance Panel", icon: BarChart3 },
      { path: "/reports", label: "Reports", icon: FileText },
      { path: "/report-builder", label: "Report Builder", icon: Zap },
      { path: "/ai-insights", label: "AI Insights", icon: Zap },
      { path: "/settings", label: "Settings", icon: Settings, roles: PARENT_OK },
    ],
  },
];

/** Per-surface customization: a desired path order and a set of hidden paths. */
export type NavSurfacePrefs = { order?: string[]; hidden?: string[] };
export type NavPreferences = { topNav?: NavSurfacePrefs; sideNav?: NavSurfacePrefs };

/** Whether a role may see an item. No `roles` → admin + staff (not parent). */
export function visibleToRole(item: NavItem, role: NavRole): boolean {
  return item.roles ? item.roles.includes(role) : role !== "parent";
}

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

/** Canonical top-nav items visible to a role (ignores prefs) — for the settings UI. */
export function topNavForRole(role: NavRole): NavItem[] {
  return TOP_NAV_ITEMS.filter((i) => visibleToRole(i, role));
}

/** Canonical side-nav sections visible to a role (ignores prefs) — for the settings UI. */
export function sideNavForRole(role: NavRole): NavSection[] {
  return SIDE_NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((i) => visibleToRole(i, role)) }))
    .filter((section) => section.items.length > 0);
}

/** Effective top-nav items after applying role visibility, then hide + order. */
export function applyTopNav(prefs: NavPreferences | null | undefined, role: NavRole): NavItem[] {
  const hidden = new Set(prefs?.topNav?.hidden ?? []);
  const base = TOP_NAV_ITEMS.filter((i) => visibleToRole(i, role) && !hidden.has(i.path));
  return sortByOrder(base, prefs?.topNav?.order);
}

/**
 * Effective side-nav sections after applying role visibility, then hide + order.
 * Sorting is global (a single order array) but each section only contains its own
 * items, so items stay within their section while honoring the user's order.
 */
export function applySideNav(prefs: NavPreferences | null | undefined, role: NavRole): NavSection[] {
  const hidden = new Set(prefs?.sideNav?.hidden ?? []);
  const order = prefs?.sideNav?.order;
  return SIDE_NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: sortByOrder(section.items.filter((i) => visibleToRole(i, role) && !hidden.has(i.path)), order),
    }))
    .filter((section) => section.items.length > 0);
}

/** All side-nav items, ignoring preferences/role — used for breadcrumb label lookup. */
export const ALL_SIDE_NAV_ITEMS: NavItem[] = SIDE_NAV_SECTIONS.flatMap((s) => s.items);
