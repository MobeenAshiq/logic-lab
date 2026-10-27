"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import type { MfaState, Role, SessionResponse } from "@/types/api";

export function portalHome(role: Role) {
  if (role === "admin" || role === "super_admin") return "/admin";
  if (role === "mentor") return "/mentor";
  return "/student";
}

/** Where to go after login / 2FA: the requested page if it belongs to the user's portal. */
export function afterLoginPath(role: Role, mfa: MfaState, next?: string | null) {
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  if (mfa !== "none") {
    return `/mfa${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;
  }
  const home = portalHome(role);
  if (safeNext && (safeNext.startsWith(home) || !/^\/(student|mentor|admin)/.test(safeNext))) {
    return safeNext;
  }
  return home;
}

export const ME_KEY = ["me"] as const;

/** The logged-in user, or null when logged out. Never redirects. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api<SessionResponse>("/me", { requireAuth: false });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST", requireAuth: false }),
    onSettled: () => {
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });
}

export function isAdmin(role: Role | undefined) {
  return role === "admin" || role === "super_admin";
}
