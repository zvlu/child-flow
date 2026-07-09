import { useAuth } from "@/_core/hooks/useAuth";
import { ORGANIZATION_ID } from "@/const";
import { trpc } from "@/lib/trpc";
import { hasModule, type ModuleId } from "@shared/modules";

/**
 * Which optional feature modules (e.g. Head Start compliance) the current
 * organization has enabled. Backed by `organizations.get`, so Settings' cache
 * invalidation after a toggle updates nav/routes live.
 *
 * While loading we report `false` for every module — gated UI appears once the
 * org loads rather than flashing and disappearing. Parents get core-only UI.
 * (The server enforces access regardless; this is presentation.)
 */
export function useOrgModules() {
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "staff";
  // NOTE: single-tenant placeholder org id, same as the rest of the client.
  const orgQuery = trpc.organizations.get.useQuery(ORGANIZATION_ID, {
    enabled: isStaff,
    staleTime: 5 * 60 * 1000,
  });

  return {
    has: (id: ModuleId) => isStaff && hasModule(orgQuery.data, id),
    isLoading: isStaff && orgQuery.isLoading,
    /** Query failed — "module off" can't be trusted; gates should offer a retry instead of a lock screen. */
    isError: isStaff && orgQuery.isError,
    refetch: () => orgQuery.refetch(),
  };
}
