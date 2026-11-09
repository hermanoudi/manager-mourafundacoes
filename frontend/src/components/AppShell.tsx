"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLogout, useMe } from "@/lib/auth";

import { navFor } from "./NavItems";

const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  users: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0z",
  rig: "M11 2h2v14h-2zM6 16h12l2 6H4zM8 6h8v2H8z",
  key: "M7 14a4 4 0 1 1 3.9-5H21v3h-2v2h-3v-2h-5.1A4 4 0 0 1 7 14z",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d={ICONS[name] ?? ICONS.home} />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  const logout = useLogout();
  const pathname = usePathname();
  const items = me ? navFor(me.role) : [];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="flex flex-1 md:flex-row flex-col">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-white p-3 md:flex">
        <div className="mb-4 px-3 py-2 text-lg font-semibold text-brand">Moura Gestão</div>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active(i.href) ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 ${
                active(i.href) ? "bg-amber-50 font-medium text-brand" : "hover:bg-stone-100"
              }`}
            >
              <Icon name={i.icon} />
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="border-t px-3 pt-3 text-sm">
          <div className="truncate">{me?.name}</div>
          <button onClick={logout} className="mt-1 min-h-11 font-medium text-brand">
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b bg-white px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
          <span className="truncate text-sm">{me?.name}</span>
          <button onClick={logout} className="min-h-11 px-2 text-sm font-medium text-brand">
            Sair
          </button>
        </header>
        <main className="flex-1 p-4 pb-24 md:pb-4">{children}</main>
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 flex border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active(i.href) ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                active(i.href) ? "font-medium text-brand" : "text-stone-600"
              }`}
            >
              <Icon name={i.icon} />
              {i.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
