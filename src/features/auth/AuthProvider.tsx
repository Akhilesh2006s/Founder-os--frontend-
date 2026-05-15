"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { getMe } from "./auth-api";
import type { AuthUser } from "./types";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isLoading,
      isAuthenticated: Boolean(meQuery.data),
      refetch: () => {
        void meQuery.refetch();
      }
    }),
    [meQuery.data, meQuery.isLoading, meQuery]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

