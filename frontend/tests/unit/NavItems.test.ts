import { describe, expect, it } from "vitest";

import { navFor } from "@/components/NavItems";

const labels = (role: "admin" | "office" | "operator") => navFor(role).map((i) => i.label);

describe("navFor", () => {
  it("operador não vê Clientes nem Usuários", () => {
    expect(labels("operator")).not.toContain("Clientes");
    expect(labels("operator")).not.toContain("Usuários");
    expect(labels("operator")).toContain("Perfuratrizes");
  });
  it("operador vê Obras e Medições mas não Tabela de preços", () => {
    expect(labels("operator")).toContain("Obras");
    expect(labels("operator")).toContain("Medições");
    expect(labels("operator")).not.toContain("Tabela de preços");
  });
  it("escritório vê Clientes, Obras, Medições e Tabela de preços mas não Usuários", () => {
    expect(labels("office")).toContain("Clientes");
    expect(labels("office")).toContain("Obras");
    expect(labels("office")).toContain("Medições");
    expect(labels("office")).toContain("Tabela de preços");
    expect(labels("office")).not.toContain("Usuários");
  });
  it("admin vê tudo, com Obras logo após Início", () => {
    expect(labels("admin")).toEqual([
      "Início", "Obras", "Medições", "Tabela de preços", "Clientes", "Perfuratrizes", "Usuários",
    ]);
  });
});
