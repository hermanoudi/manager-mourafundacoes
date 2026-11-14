import { describe, expect, it } from "vitest";

import { displayPhone, formatPhone, isValidPhone, normalizePhone } from "@/lib/phone";

describe("telefone", () => {
  it("formatPhone aplica máscara progressiva de fixo e celular", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("3")).toBe("(3");
    expect(formatPhone("343")).toBe("(34) 3");
    expect(formatPhone("3432101234")).toBe("(34) 3210-1234");
    expect(formatPhone("34999990000")).toBe("(34) 99999-0000");
    expect(formatPhone("(34) 99999-00001234")).toBe("(34) 99999-0000");
  });
  it("normalizePhone guarda só os dígitos", () => {
    expect(normalizePhone("(34) 99999-0000")).toBe("34999990000");
  });
  it("isValidPhone aceita vazio, fixo (10) e celular (11)", () => {
    expect(isValidPhone("")).toBe(true);
    expect(isValidPhone("(34) 3210-1234")).toBe(true);
    expect(isValidPhone("(34) 99999-0000")).toBe(true);
    expect(isValidPhone("(34) 9999")).toBe(false);
  });
  it("displayPhone formata dígitos e preserva texto legado", () => {
    expect(displayPhone("34999990000")).toBe("(34) 99999-0000");
    expect(displayPhone("(34) 3210-1234")).toBe("(34) 3210-1234");
    expect(displayPhone("ramal 12")).toBe("ramal 12");
    expect(displayPhone(null)).toBe("—");
  });
});
