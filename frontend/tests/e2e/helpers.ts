import { expect, request as pwRequest, type Page } from "@playwright/test";

import { E2E_EMAIL, E2E_PASSWORD } from "./global-setup";

const BASE = "http://localhost:3000";
export const PASSWORD = "senha-forte-123";

let counter = 0;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1e4)}`;

export const uniqueName = (prefix: string) => `${prefix} ${uid()}`;

function cnpjDigit(nums: number[], weights: number[]): number {
  const rest = nums.reduce((s, n, i) => s + n * weights[i], 0) % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** CNPJ numérico válido e único por chamada, já mascarado. */
export function uniqueCnpj(): { masked: string; raw: string } {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10));
  const nums = [...base, 0, 0, 0, 1];
  const d1 = cnpjDigit(nums, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = cnpjDigit([...nums, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const raw = [...nums, d1, d2].join("");
  const masked = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
  return { masked, raw };
}

export async function adminApi() {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const res = await ctx.post("/api/auth/login", { data: { email: E2E_EMAIL, password: E2E_PASSWORD } });
  expect(res.ok()).toBeTruthy();
  return ctx;
}

export async function createUser(role: "admin" | "office" | "operator") {
  const api = await adminApi();
  const email = `${role}-${uid()}@moura.test`.toLowerCase();
  const res = await api.post("/api/users", {
    data: { name: `Usuário ${role}`, email, password: PASSWORD, role },
  });
  expect(res.status()).toBe(201);
  await api.dispose();
  return { email, password: PASSWORD };
}

/** Cria um usuário do papel e entra pela API (o cookie fica no contexto do navegador). */
export async function loginAs(page: Page, role: "admin" | "office" | "operator") {
  const { email, password } = await createUser(role);
  const res = await page.request.post("/api/auth/login", { data: { email, password } });
  expect(res.ok()).toBeTruthy();
}

export const CEP_BODY = {
  cep: "38400-000",
  logradouro: "Avenida Rondon Pacheco",
  bairro: "Tibery",
  localidade: "Uberlândia",
  uf: "MG",
  ibge: "3170206",
};
