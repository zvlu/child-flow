import { describe, expect, it } from "vitest";
import {
  TOP_NAV_ITEMS, visibleToRole, sortByOrder, applyTopNav, applySideNav,
  topNavForRole, sideNavForRole, type NavItem,
} from "./nav";

const item = (path: string, roles?: any): NavItem => ({ path, label: path, icon: (() => null) as any, roles });
const paths = (items: NavItem[]) => items.map((i) => i.path);
const allSidePaths = (secs: { items: NavItem[] }[]) => secs.flatMap((s) => s.items.map((i) => i.path));

describe("visibleToRole", () => {
  it("defaults (no roles) to admin + staff, not parent", () => {
    const i = item("/x");
    expect(visibleToRole(i, "admin")).toBe(true);
    expect(visibleToRole(i, "staff")).toBe(true);
    expect(visibleToRole(i, "parent")).toBe(false);
  });
  it("admin-only items hide from staff and parent", () => {
    const i = item("/x", ["admin"]);
    expect(visibleToRole(i, "admin")).toBe(true);
    expect(visibleToRole(i, "staff")).toBe(false);
    expect(visibleToRole(i, "parent")).toBe(false);
  });
  it("parent-visible items include parent", () => {
    expect(visibleToRole(item("/x", ["admin", "staff", "parent"]), "parent")).toBe(true);
  });
});

describe("sortByOrder", () => {
  it("orders by the given paths, keeping unlisted items in place at the end", () => {
    const items = [item("/a"), item("/b"), item("/c")];
    expect(paths(sortByOrder(items, ["/c", "/a"]))).toEqual(["/c", "/a", "/b"]);
  });
  it("is a no-op without an order", () => {
    const items = [item("/a"), item("/b")];
    expect(paths(sortByOrder(items, undefined))).toEqual(["/a", "/b"]);
  });
});

describe("applyTopNav role filtering", () => {
  it("admin sees Billing and Bulk Actions; staff does not", () => {
    const admin = paths(applyTopNav(null, "admin"));
    const staff = paths(applyTopNav(null, "staff"));
    expect(admin).toContain("/billing");
    expect(admin).toContain("/bulk-actions");
    expect(staff).not.toContain("/billing");
    expect(staff).not.toContain("/bulk-actions");
  });
  it("parent sees only parent-visible top items", () => {
    expect(paths(applyTopNav(null, "parent")).sort()).toEqual(["/calendar", "/communication"]);
  });
  it("applies hide then order on top of role filtering", () => {
    const out = paths(applyTopNav({ topNav: { hidden: ["/attendance"], order: ["/calendar"] } }, "admin"));
    expect(out).not.toContain("/attendance");
    expect(out[0]).toBe("/calendar");
  });
});

describe("applySideNav role filtering", () => {
  it("parent only sees the family-facing items, empty sections dropped", () => {
    const secs = applySideNav(null, "parent");
    expect(allSidePaths(secs).sort()).toEqual(
      ["/calendar", "/communication", "/dashboard", "/documents", "/glossary", "/parent-portal", "/settings"].sort()
    );
  });
  it("staff loses admin-only items (Compliance, Billing, Bulk Actions)", () => {
    const p = allSidePaths(applySideNav(null, "staff"));
    expect(p).not.toContain("/compliance");
    expect(p).not.toContain("/billing");
    expect(p).not.toContain("/bulk-actions");
    expect(p).toContain("/children");
  });
});

describe("forRole helpers (settings UI)", () => {
  it("topNavForRole matches the canonical visible set", () => {
    expect(topNavForRole("admin").length).toBe(TOP_NAV_ITEMS.length);
    expect(topNavForRole("parent").length).toBeLessThan(TOP_NAV_ITEMS.length);
  });
  it("sideNavForRole drops empty sections for parent", () => {
    const secs = sideNavForRole("parent");
    expect(secs.every((s) => s.items.length > 0)).toBe(true);
  });
});
