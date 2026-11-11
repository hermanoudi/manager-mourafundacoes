import { afterEach, describe, expect, it, vi } from "vitest";

import { newUuid } from "@/lib/uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("newUuid", () => {
  it("usa crypto.randomUUID quando existe", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-2222-4333-8444-555555555555",
      getRandomValues: (a: Uint8Array) => a,
    });
    expect(newUuid()).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("gera v4 com getRandomValues sem crypto.randomUUID (contexto inseguro)", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) });
    const ids = new Set(Array.from({ length: 50 }, () => newUuid()));
    for (const id of ids) expect(id).toMatch(V4);
    expect(ids.size).toBe(50);
  });

  it("acerta versão e variante mesmo com bytes 0xff", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.fill(0xff) });
    expect(newUuid()).toMatch(V4);
  });
});
