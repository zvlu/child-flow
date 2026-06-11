import { useAuth } from "./useAuth";

/**
 * True only for administrator accounts. Use to hide admin-only actions
 * (invoicing, payments, meal-plan approval, staff & certification management).
 * The server enforces every permission independently — this is UX, not
 * security.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return (user as { role?: string } | null)?.role === "admin";
}
