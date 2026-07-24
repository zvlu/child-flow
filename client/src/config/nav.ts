import {
  LayoutDashboard, Users, ClipboardCheck, Heart, Home, UserCog, BarChart3,
  ShieldCheck, Settings, Baby, BookOpen, FileText, CalendarDays, DollarSign,
  UtensilsCrossed, Clock, FileSignature, Layers, School, AlertTriangle, Zap,
  MessageSquare, HandHeart, ClipboardList, Sparkles, NotebookPen, FolderHeart, Landmark, BookText,
  TrendingDown, Handshake, CalendarClock, Accessibility, PiggyBank, Upload, Briefcase, type LucideIcon,
} from "lucide-react";

import type { ModuleId } from "@shared/modules";

export type NavRole = "admin" | "staff" | "parent";
/**
 * `roles` controls who sees the item:
 *   - omitted        → admin + staff (the default for program-work items)
 *   - ["admin"]      → admin only (financials, compliance, bulk ops)
 *   - includes "parent" → also visible to family/parent accounts
 * `module` additionally hides the item unless the org has that feature module
 * enabled (e.g. Head Start compliance).
 */
export type NavItem = { path: string; label: string; icon: LucideIcon; roles?: NavRole[]; module?: ModuleId };
export type NavSection = { title: string; items: NavItem[]; /** Collapsible sidebar cluster: start expanded? */ defaultOpen?: boolean };

/** Modules the org has enabled, as consumed by the nav filters. */
export type EnabledModules = { has: (id: ModuleId) => boolean };
export const ALL_MODULES: EnabledModules = { has: () => true };

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
    title: "Operations",
    defaultOpen: true,
    items: [
      { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: PARENT_OK },
      { path: "/children", label: "Children", icon: Baby },
      { path: "/notes", label: "Notes", icon: NotebookPen },
      { path: "/attendance", label: "Attendance", icon: ClipboardCheck },
      { path: "/daily-reports", label: "Daily Reports", icon: Sparkles },
      { path: "/health", label: "Health Records", icon: Heart },
      { path: "/classrooms", label: "Classrooms", icon: School },
      { path: "/staff", label: "Staff", icon: UserCog },
      { path: "/assessments", label: "Assessments", icon: ClipboardList },
      { path: "/lesson-planning", label: "Lesson Planning", icon: NotebookPen },
      { path: "/portfolios", label: "Portfolios", icon: FolderHeart },
      { path: "/meal-planning", label: "Meal Planning", icon: UtensilsCrossed },
      { path: "/calendar", label: "Calendar", icon: CalendarDays, roles: PARENT_OK },
    ],
  },
  {
    title: "Family",
    defaultOpen: true,
    items: [
      { path: "/enrollment", label: "Enrollment", icon: BookOpen },
      { path: "/data-import", label: "Data Import", icon: Upload, roles: ADMIN_ONLY },
      { path: "/family-services", label: "Family Services", icon: Home, module: "head_start" },
      { path: "/caseloads", label: "Case Loads", icon: Briefcase, module: "head_start" },
      { path: "/family-partnership", label: "Partnership Agreements", icon: Handshake, module: "head_start" },
      { path: "/communication", label: "Communication", icon: MessageSquare, roles: PARENT_OK },
      { path: "/parent-portal", label: "Parent Portal", icon: Users, roles: PARENT_OK },
    ],
  },
  {
    title: "Compliance",
    defaultOpen: false,
    items: [
      { path: "/compliance", label: "Compliance & PIR", icon: ShieldCheck, roles: ADMIN_ONLY, module: "head_start" },
      { path: "/health-deadlines", label: "Health Deadlines", icon: CalendarClock, module: "head_start" },
      { path: "/chronic-absence", label: "Chronic Absence", icon: TrendingDown, module: "head_start" },
      { path: "/disability-services", label: "Disability Services", icon: Accessibility, module: "head_start" },
      { path: "/policy-council", label: "Policy Council", icon: Landmark, module: "head_start" },
      { path: "/classroom-quality", label: "Classroom Quality", icon: BarChart3, module: "head_start" },
      { path: "/in-kind", label: "In-Kind", icon: HandHeart, module: "head_start" },
      { path: "/digital-documents", label: "E-Signatures", icon: FileSignature },
      { path: "/documents", label: "Documents", icon: FileText, roles: PARENT_OK },
    ],
  },
  {
    title: "Insights & Admin",
    defaultOpen: false,
    items: [
      { path: "/performance", label: "Performance Panel", icon: BarChart3 },
      { path: "/action-queue", label: "Action Queue", icon: AlertTriangle },
      { path: "/approvals", label: "Approvals", icon: ClipboardCheck, roles: ADMIN_ONLY },
      { path: "/reports", label: "Reports", icon: FileText },
      { path: "/report-builder", label: "Report Builder", icon: Zap },
      { path: "/ai-insights", label: "AI Insights", icon: Zap },
      { path: "/billing", label: "Billing", icon: DollarSign, roles: ADMIN_ONLY },
      { path: "/subsidies", label: "Subsidies", icon: Landmark },
      { path: "/grant-budget", label: "Grant & Budget", icon: PiggyBank, roles: ADMIN_ONLY, module: "head_start" },
      { path: "/staff-operations", label: "Staff Operations", icon: Clock },
      { path: "/bulk-actions", label: "Bulk Actions", icon: Layers, roles: ADMIN_ONLY },
      { path: "/glossary", label: "Glossary", icon: BookText, roles: PARENT_OK },
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

/** Whether the org's enabled modules allow an item. No `module` → always. */
export function visibleToModules(item: NavItem, modules: EnabledModules): boolean {
  return item.module ? modules.has(item.module) : true;
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
export function topNavForRole(role: NavRole, modules: EnabledModules = ALL_MODULES): NavItem[] {
  return TOP_NAV_ITEMS.filter((i) => visibleToRole(i, role) && visibleToModules(i, modules));
}

/** Canonical side-nav sections visible to a role (ignores prefs) — for the settings UI. */
export function sideNavForRole(role: NavRole, modules: EnabledModules = ALL_MODULES): NavSection[] {
  return SIDE_NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((i) => visibleToRole(i, role) && visibleToModules(i, modules)) }))
    .filter((section) => section.items.length > 0);
}

/** Effective top-nav items after applying role + module visibility, then hide + order. */
export function applyTopNav(prefs: NavPreferences | null | undefined, role: NavRole, modules: EnabledModules = ALL_MODULES): NavItem[] {
  const hidden = new Set(prefs?.topNav?.hidden ?? []);
  const base = TOP_NAV_ITEMS.filter((i) => visibleToRole(i, role) && visibleToModules(i, modules) && !hidden.has(i.path));
  return sortByOrder(base, prefs?.topNav?.order);
}

/**
 * Effective side-nav sections after applying role + module visibility, then
 * hide + order. Sorting is global (a single order array) but each section only
 * contains its own items, so items stay within their section while honoring
 * the user's order.
 */
export function applySideNav(prefs: NavPreferences | null | undefined, role: NavRole, modules: EnabledModules = ALL_MODULES): NavSection[] {
  const hidden = new Set(prefs?.sideNav?.hidden ?? []);
  const order = prefs?.sideNav?.order;
  return SIDE_NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: sortByOrder(section.items.filter((i) => visibleToRole(i, role) && visibleToModules(i, modules) && !hidden.has(i.path)), order),
    }))
    .filter((section) => section.items.length > 0);
}

/** All side-nav items, ignoring preferences/role — used for breadcrumb label lookup. */
export const ALL_SIDE_NAV_ITEMS: NavItem[] = SIDE_NAV_SECTIONS.flatMap((s) => s.items);
