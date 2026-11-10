import { describe, expect, it } from "vitest";

import { formatMoneyBR } from "@/lib/money";

describe("formatMoneyBR", () => {
  it("formata com milhar e vírgula", () => {
    expect(formatMoneyBR("1234.5")).toBe("R$ 1.234,50");
  });
  it("formata zero", () => {
    expect(formatMoneyBR("0")).toBe("R$ 0,00");
  });
  it("preserva centavos", () => {
    expect(formatMoneyBR("11.50")).toBe("R$ 11,50");
  });
});
