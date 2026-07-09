import { trpc } from "@/lib/trpc";

/**
 * Authentication state derived from the server session.
 *
 * Reflects the real session established via the OAuth cookie flow
 * (see server/_core/oauth.ts). `auth.me` is a public procedure that returns the
 * current user or `null` when there is no valid session — so an unauthenticated
 * visitor resolves cleanly to `isAuthenticated: false` rather than an error.
 */
export function useAuth() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const logoutMutation = trpc.auth.logout.useMutation();

  const user = meQuery.data ?? null;

  return {
    user,
    loading: meQuery.isLoading,
    error: meQuery.error ?? null,
    isAuthenticated: !!user,
    refresh: () => meQuery.refetch().then(() => undefined),
    logout: async () => {
      try {
        await logoutMutation.mutateAsync();
      } finally {
        window.location.href = "/signin";
      }
    },
  };
}
