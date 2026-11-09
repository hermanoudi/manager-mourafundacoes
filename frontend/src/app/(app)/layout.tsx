"use client";

import { useLogout, useMe } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  const logout = useLogout();
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b bg-white p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="truncate text-sm">{me?.name}</span>
        <button onClick={logout} className="min-h-11 rounded-lg px-3 text-sm font-medium">
          Sair
        </button>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
