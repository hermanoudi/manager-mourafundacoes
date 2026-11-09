import { describe, expect, it } from "vitest";

import { navFor } from "@/components/NavItems";

const labels = (role: "admin" | "office" | "operator") => navFor(role).map((i) => i.label);

describe("navFor", () => {
  it("operador não vê Clientes nem Usuários", () => {
    expect(labels("operator")).not.toContain("Clientes");
    expect(labels("operator")).not.toContain("Usuários");
    expect(labels("operator")).toContain("Perfuratrizes");
  });
  it("escritório vê Clientes mas não Usuários", () => {
    expect(labels("office")).toContain("Clientes");
    expect(labels("office")).not.toContain("Usuários");
  });
  it("admin vê tudo", () => {
    expect(labels("admin")).toEqual(["Início", "Clientes", "Perfuratrizes", "Usuários"]);
  });
});
