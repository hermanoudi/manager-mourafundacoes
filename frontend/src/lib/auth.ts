"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";

export type Role = "admin" | "office" | "operator";
export type UserOut = { id: number; name: string; email: string; role: Role; active: boolean };

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<UserOut>("/api/auth/me"),
    staleTime: 60_000,
    retry: false,
  });
}

export function login(email: string, password: string) {
  return api<UserOut>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    await api("/api/auth/logout", { method: "POST" });
    qc.clear();
    window.location.assign("/login");
  };
}

export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
