import { describe, expect, it } from "vitest";

import { formatDocument } from "@/lib/documents";

describe("formatDocument", () => {
  it("máscara CNPJ alfanumérico", () => {
    expect(formatDocument("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
  it("máscara CPF", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
  });
  it("máscara CNPJ numérico", () => {
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
  });
  it("aplica máscara progressiva e normaliza minúsculas", () => {
    expect(formatDocument("5299")).toBe("529.9");
    expect(formatDocument("12.abc.345/01de-35")).toBe("12.ABC.345/01DE-35");
  });
});
