import type { Role } from "@/lib/auth";

export type NavItem = { href: string; label: string; icon: string; roles: Role[] };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: "home", roles: ["admin", "office", "operator"] },
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
