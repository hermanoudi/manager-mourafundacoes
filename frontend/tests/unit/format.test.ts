import { describe, expect, it } from "vitest";

import { formatDecimalBR, toApiDecimal } from "@/lib/format";

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
