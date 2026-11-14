import { describe, expect, it } from "vitest";

import { formatDecimalBR, formatMoneyInputBR, isMoneyBR, toApiDecimal, toApiMoney } from "@/lib/format";

describe("format", () => {
  it("toApiDecimal converte pt-BR para API", () => {
    expect(toApiDecimal("1.234,5")).toBe("1234.5");
    expect(toApiDecimal("22,5")).toBe("22.5");
    expect(toApiDecimal("22.5")).toBe("22.5");
  });
  it("formatDecimalBR exibe vírgula", () => {
    expect(formatDecimalBR("22.50")).toBe("22,50");
  });
});

describe("dinheiro", () => {
  it("isMoneyBR aceita valores com e sem ponto de milhar", () => {
    for (const v of ["0", "400", "400,5", "400,00", "1500", "1.500", "1.500,00", "12.345.678,90"]) {
      expect(isMoneyBR(v), v).toBe(true);
    }
  });
  it("isMoneyBR recusa milhar mal agrupado e mais de 2 casas", () => {
    for (const v of ["", "1.50", "1.5000", "15.00,00", "1,500", "1,5,0", ".500", "1.500,", "abc"]) {
      expect(isMoneyBR(v), v).toBe(false);
    }
  });
  it("toApiMoney trata ponto como separador de milhar", () => {
    expect(toApiMoney("1.500")).toBe("1500");
    expect(toApiMoney("1.500,00")).toBe("1500.00");
    expect(toApiMoney("12.345.678,9")).toBe("12345678.9");
    expect(toApiMoney("400,5")).toBe("400.5");
    expect(toApiMoney(" 400 ")).toBe("400");
  });
  it("formatMoneyInputBR exibe valor da API com milhar e 2 casas", () => {
    expect(formatMoneyInputBR("1500.00")).toBe("1.500,00");
    expect(formatMoneyInputBR("400")).toBe("400,00");
    expect(formatMoneyInputBR("10.5")).toBe("10,50");
    expect(formatMoneyInputBR("1234567.89")).toBe("1.234.567,89");
  });
});
