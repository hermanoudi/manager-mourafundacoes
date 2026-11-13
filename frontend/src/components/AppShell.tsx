"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useLogout, useMe } from "@/lib/auth";

import { navFor, splitNav, type NavItem } from "./NavItems";

const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  users: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0z",
  rig: "M11 2h2v14h-2zM6 16h12l2 6H4zM8 6h8v2H8z",
  key: "M7 14a4 4 0 1 1 3.9-5H21v3h-2v2h-3v-2h-5.1A4 4 0 0 1 7 14z",
  more: "M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  job: "M3 21V9l6-4v4l6-4v4l6-4v16zM6 17h3v-3H6zM11 17h3v-3h-3z",
  ruler: "M2 8h20v8H2zM5 8v4h2V8zM9 8v3h2V8zM13 8v4h2V8zM17 8v3h2V8z",
  price: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v1.5h2V11h-4v1h2.5a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.500 1.500H13V18h-2v-1.500H9V14h4v-1h-2.500A1.500 1.500 0 0 1 9 11.500V10a1.500 1.500 0 0 1 1.500-1.500H11z",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d={ICONS[name] ?? ICONS.home} />
    </svg>
  );
}

const TAB =
  "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center text-xs leading-tight";

/** Barra inferior: até 4 abas; o restante fica no menu "Mais". */
function MobileNav({ items, active }: { items: NavItem[]; active: (href: string) => boolean }) {
  const { primary, more } = splitNav(items);
  const [open, setOpen] = useState(false);
  const moreActive = more.some((i) => active(i.href));
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Foco entra no menu ao abrir e volta para "Mais" ao fechar (Esc, fundo ou escolha).
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const opener = trigger.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab" || !panel.current) return;
      // Prende o Tab entre os itens do menu e o botão "Mais".
      const stops = [...panel.current.querySelectorAll<HTMLElement>("a"), opener].filter(
        (el): el is HTMLElement => !!el,
      );
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default bg-black/30 md:hidden"
          />
          <div
            ref={panel}
            role="dialog"
            aria-label="Mais opções"
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 space-y-1 border-t bg-white p-2 shadow-lg md:hidden"
          >
            {more.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                aria-current={active(i.href) ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 ${
                  active(i.href) ? "bg-brand-soft font-medium text-brand" : "hover:bg-stone-100"
                }`}
              >
                <Icon name={i.icon} />
                {i.label}
              </Link>
            ))}
          </div>
        </>
      )}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 flex overflow-hidden border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {primary.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setOpen(false)}
            aria-current={active(i.href) ? "page" : undefined}
            className={`${TAB} ${active(i.href) ? "font-medium text-brand" : "text-stone-600"}`}
          >
            <Icon name={i.icon} />
            {i.label}
          </Link>
        ))}
        {more.length > 0 && (
          <button
            ref={trigger}
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((o) => !o)}
            className={`${TAB} ${moreActive || open ? "font-medium text-brand" : "text-stone-600"}`}
          >
            <Icon name="more" />
            Mais
          </button>
        )}
      </nav>
    </>
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
        <div className="mb-4 px-3 py-2">
          <Image src="/brand/logo.png" alt="Moura Fundações" width={239} height={81} unoptimized className="h-10 w-auto" />
        </div>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active(i.href) ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 font-display text-lg font-semibold ${
                active(i.href) ? "bg-stone-100 text-brand underline decoration-2 underline-offset-4" : "text-secondary-dark hover:bg-stone-100"
              }`}
            >
              <Icon name={i.icon} />
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="border-t px-3 pt-3 text-sm">
          <div className="truncate">{me?.name}</div>
          <button onClick={logout} className="btn-label mt-1 min-h-11 text-brand">
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b bg-white px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
          <Image src="/brand/logo.png" alt="Moura Fundações" width={239} height={81} unoptimized className="h-8 w-auto" />
          <span className="min-w-0 flex-1 truncate text-right text-sm">{me?.name}</span>
          <button onClick={logout} className="min-h-11 min-w-11 px-2 text-sm font-medium text-brand">
            Sair
          </button>
        </header>
        <main className="flex-1 p-4 pb-24 md:pb-4">{children}</main>
        <MobileNav items={items} active={active} />
      </div>
    </div>
  );
}
