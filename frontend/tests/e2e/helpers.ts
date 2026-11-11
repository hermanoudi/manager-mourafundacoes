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

export async function createUser(role: "admin" | "office" | "operator", name = `Usuário ${role}`) {
  const api = await adminApi();
  const email = `${role}-${uid()}@moura.test`.toLowerCase();
  const res = await api.post("/api/users", { data: { name, email, password: PASSWORD, role } });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()) as { id: number };
  await api.dispose();
  return { id, name, email, password: PASSWORD };
}

/** Cria um usuário do papel e entra pela API (o cookie fica no contexto do navegador). */
export async function loginAs(page: Page, role: "admin" | "office" | "operator", name?: string) {
  const user = await createUser(role, name);
  await loginWith(page, user);
  return user;
}

export async function loginWith(page: Page, user: { email: string; password: string }) {
  const res = await page.request.post("/api/auth/login", { data: user });
  expect(res.ok()).toBeTruthy();
}

const ADDRESS = {
  zip_code: "38400000", street: "Av. Rondon Pacheco", number: "100", complement: null,
  district: "Tibery", city: "Uberlândia", state: "MG", ibge_city_code: null,
};

export async function createCustomer(name = uniqueName("Cliente")) {
  const api = await adminApi();
  const res = await api.post("/api/customers", {
    data: { document: uniqueCnpj().raw, name, address: ADDRESS },
  });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()) as { id: number };
  await api.dispose();
  return { id, name };
}

export async function createRig(name = uniqueName("Rig"), maxDiameterCm = 80) {
  const api = await adminApi();
  const res = await api.post("/api/drill-rigs", {
    data: { name, max_diameter_cm: maxDiameterCm, max_depth_m: "20", status: "active" },
  });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()) as { id: number };
  await api.dispose();
  return { id, name };
}

export async function createJob(customerId: number, name = uniqueName("Obra")) {
  const api = await adminApi();
  const res = await api.post("/api/jobs", {
    data: { name, customer_id: customerId, address: ADDRESS },
  });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()) as { id: number };
  await api.dispose();
  return { id, name };
}

export async function allocateJob(jobId: number, rigIds: number[], operatorIds: number[]) {
  const api = await adminApi();
  const res = await api.put(`/api/jobs/${jobId}/allocation`, {
    data: { rig_ids: rigIds, operator_ids: operatorIds },
  });
  expect(res.ok()).toBeTruthy();
  await api.dispose();
}

/** Tabela própria da obra (a global é alterada por outros testes). */
export async function setJobPrices(jobId: number, diameters: number[]) {
  const api = await adminApi();
  const res = await api.put(`/api/jobs/${jobId}/prices`, {
    data: {
      mobilization_fee: "500.00",
      minimum_amount: null,
      max_tabled_depth_m: "20",
      items: diameters.map((d) => ({ diameter_cm: d, price_per_m: "10.00" })),
    },
  });
  expect(res.ok()).toBeTruthy();
  await api.dispose();
}

export async function startJob(jobId: number) {
  const api = await adminApi();
  const res = await api.patch(`/api/jobs/${jobId}`, { data: { status: "in_progress" } });
  expect(res.ok()).toBeTruthy();
  await api.dispose();
}

export async function countMeasurements(jobId: number): Promise<number> {
  const api = await adminApi();
  const res = await api.get(`/api/measurements?job_id=${jobId}`);
  expect(res.ok()).toBeTruthy();
  const { total } = (await res.json()) as { total: number };
  await api.dispose();
  return total;
}

export async function firstMeasurement(jobId: number) {
  const api = await adminApi();
  const list = await api.get(`/api/measurements?job_id=${jobId}`);
  expect(list.ok()).toBeTruthy();
  const { items } = (await list.json()) as { items: { id: number }[] };
  const res = await api.get(`/api/measurements/${items[0].id}`);
  expect(res.ok()).toBeTruthy();
  const m = (await res.json()) as { id: number; status: string; lines: { depth_m: string }[] };
  await api.dispose();
  return m;
}

export const CEP_BODY = {
  cep: "38400-000",
  logradouro: "Avenida Rondon Pacheco",
  bairro: "Tibery",
  localidade: "Uberlândia",
  uf: "MG",
  ibge: "3170206",
};
