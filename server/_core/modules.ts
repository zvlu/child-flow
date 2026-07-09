import { hasModule, type ModuleId } from "@shared/modules";
import type { User } from "../../drizzle/schema";
import { getOrganizationById } from "../db";
import { isPlatformOwner } from "./env";

/**
 * Short-TTL cache of org enabledModules so per-request gating (tRPC middleware
 * and iOS REST mirrors) doesn't hit the DB every call. Busted explicitly when
 * Settings toggles a module.
 */
const MODULE_CACHE_TTL_MS = 60_000;
const moduleCache = new Map<number, { modules: unknown; expires: number }>();

export const MODULE_DISABLED_ERR_MSG = "This feature isn't enabled for your program.";

export function invalidateModuleCache(orgId: number) {
  moduleCache.delete(orgId);
}

export async function orgHasModule(orgId: number, id: ModuleId): Promise<boolean> {
  const now = Date.now();
  const hit = moduleCache.get(orgId);
  if (hit && hit.expires > now) return hasModule({ enabledModules: hit.modules }, id);
  const org = await getOrganizationById(orgId);
  moduleCache.set(orgId, { modules: org?.enabledModules, expires: now + MODULE_CACHE_TTL_MS });
  return hasModule(org, id);
}

/**
 * REST-side gate: does this user's org have the module? Platform owner is
 * exempt. Use in the iOS REST mirrors after the role check.
 */
export async function userHasModule(user: User, id: ModuleId): Promise<boolean> {
  if (isPlatformOwner(user.openId)) return true;
  if (user.organizationId == null) return false;
  return orgHasModule(user.organizationId, id);
}
