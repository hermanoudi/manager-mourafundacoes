import type { Role } from "@/lib/auth";

export type NavItem = { href: string; label: string; icon: string; roles: Role[] };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: "home", roles: ["admin", "office", "operator"] },
  { href: "/obras", label: "Obras", icon: "job", roles: ["admin", "office", "operator"] },
  { href: "/medicoes", label: "Medições", icon: "ruler", roles: ["admin", "office", "operator"] },
  { href: "/tabela-precos", label: "Tabela de preços", icon: "price", roles: ["admin", "office"] },
  { href: "/clientes", label: "Clientes", icon: "users", roles: ["admin", "office"] },
  {
    href: "/perfuratrizes",
    label: "Perfuratrizes",
    icon: "rig",
    roles: ["admin", "office", "operator"],
  },
  { href: "/usuarios", label: "Usuários", icon: "key", roles: ["admin"] },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

/** Abas principais (até `max`) e o restante, que vai para o menu "Mais" no mobile. */
export function splitNav(items: NavItem[], max = 4): { primary: NavItem[]; more: NavItem[] } {
  if (items.length <= max) return { primary: items, more: [] };
  return { primary: items.slice(0, max), more: items.slice(max) };
}
