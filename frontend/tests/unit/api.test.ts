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

  it("envia JSON com content-type application/json", async () => {
    mockFetch(200, { ok: true });
    await api("/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("não define content-type com FormData (o navegador põe o boundary do multipart)", async () => {
    mockFetch(201, { ok: true });
    await api("/x", { method: "POST", body: new FormData() });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).has("content-type")).toBe(false);
  });

  it("retorna JSON em sucesso e undefined em 204", async () => {
    mockFetch(200, { ok: true });
    expect(await api("/api/x")).toEqual({ ok: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await api("/api/auth/logout", { method: "POST" })).toBeUndefined();
  });
});
