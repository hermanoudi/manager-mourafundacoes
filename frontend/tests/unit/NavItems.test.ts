import { describe, expect, it } from "vitest";

import { navFor, splitNav } from "@/components/NavItems";

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

describe("splitNav", () => {
  const names = (r: ReturnType<typeof splitNav>) => [r.primary.map((i) => i.label), r.more.map((i) => i.label)];
  it("operador (4 itens) não tem Mais", () => {
    expect(names(splitNav(navFor("operator")))).toEqual([
      ["Início", "Obras", "Medições", "Perfuratrizes"], [],
    ]);
  });
  it("escritório (6 itens) mostra 4 e manda o resto para Mais", () => {
    expect(names(splitNav(navFor("office")))).toEqual([
      ["Início", "Obras", "Medições", "Tabela de preços"], ["Clientes", "Perfuratrizes"],
    ]);
  });
  it("admin (7 itens) manda Usuários para Mais", () => {
    const [, more] = names(splitNav(navFor("admin")));
    expect(more).toEqual(["Clientes", "Perfuratrizes", "Usuários"]);
  });
});
