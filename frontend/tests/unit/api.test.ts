import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api } from "@/lib/api";

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

describe("api()", () => {
  const assign = vi.fn();
  beforeEach(() => {
    assign.mockReset();
    vi.stubGlobal("location", { pathname: "/clientes", search: "", assign });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rejeita ApiError com status e code do corpo", async () => {
    mockFetch(409, { detail: "Documento já cadastrado", code: "duplicate_document" });
    const err = (await api("/api/customers", { method: "POST" }).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("duplicate_document");
  });

  it("redireciona para /login?next= em 401", async () => {
    mockFetch(401, { detail: "Não autenticado", code: "not_authenticated" });
    await api("/api/customers").catch(() => undefined);
    expect(assign).toHaveBeenCalledWith("/login?next=%2Fclientes");
  });

  it("não redireciona em 401 no login", async () => {
    mockFetch(401, { detail: "E-mail ou senha inválidos", code: "invalid_credentials" });
    const err = (await api("/api/auth/login", { method: "POST" }).catch((e) => e)) as ApiError;
    expect(err.code).toBe("invalid_credentials");
    expect(assign).not.toHaveBeenCalled();
  });

  it("retorna JSON em sucesso e undefined em 204", async () => {
    mockFetch(200, { ok: true });
    expect(await api("/api/x")).toEqual({ ok: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await api("/api/auth/logout", { method: "POST" })).toBeUndefined();
  });
});
