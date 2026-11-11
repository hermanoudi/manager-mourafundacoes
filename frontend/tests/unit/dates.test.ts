import { describe, expect, it } from "vitest";

import { formatDateBR, todaySP } from "@/lib/dates";

describe("todaySP", () => {
  it("usa o dia de São Paulo, não o de UTC", () => {
    expect(todaySP(new Date("2026-11-11T02:30:00Z"))).toBe("2026-11-10");
  });
  it("vira o dia à meia-noite de São Paulo", () => {
    expect(todaySP(new Date("2026-11-11T03:00:00Z"))).toBe("2026-11-11");
  });
});

describe("formatDateBR", () => {
  it("formata YYYY-MM-DD como DD/MM/YYYY", () => {
    expect(formatDateBR("2026-11-10")).toBe("10/11/2026");
  });
  it("mostra traço para data vazia", () => {
    expect(formatDateBR(null)).toBe("—");
  });
});
