import { useMemo } from "react";

/**
 * MOCK AUTH HOOK FOR TESTING
 * This version bypasses actual authentication to allow direct testing of the UI.
 */
export function useAuth() {
  const state = useMemo(() => {
    const mockUser = {
      id: "test-user-id",
      name: "Test Administrator",
      email: "admin@childflow.org",
      role: "admin"
    };
    
    return {
      user: mockUser,
      loading: false,
      error: null,
      isAuthenticated: true, // Always authenticated for testing
    };
  }, []);

  return {
    ...state,
    refresh: () => Promise.resolve(),
    logout: () => {
      window.location.href = "/";
      return Promise.resolve();
    },
  };
}
