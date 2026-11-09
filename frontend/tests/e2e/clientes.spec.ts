import { expect, test, type Page } from "@playwright/test";

import { CEP_BODY, loginAs, uniqueCnpj, uniqueName } from "./helpers";

async function fillAddress(page: Page) {
  await page.getByLabel("CEP").fill("38400-000");
  await page.getByLabel("Rua").fill("Av. Rondon Pacheco");
  await page.getByLabel("Número").fill("100");
  await page.getByLabel("Bairro").fill("Tibery");
  await page.getByLabel("Cidade").fill("Uberlândia");
  await page.getByLabel("UF").fill("MG");
}

test.beforeEach(async ({ page }) => {
  await page.route("https://viacep.com.br/**", (route) => route.fulfill({ status: 500, body: "" }));
});

test("office cadastra, bloqueia duplicado, busca e edita", async ({ page }) => {
  await loginAs(page, "office");
  const { masked, raw } = uniqueCnpj();
  const name = uniqueName("Conel");

  await page.goto("/clientes/novo");
  await page.getByLabel("CPF/CNPJ").fill(raw);
  await page.getByLabel("Nome / Razão social").fill(name);
  await fillAddress(page);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/clientes$/);
  await page.getByLabel("Buscar").fill(name);
  await expect(page.getByText(masked).locator("visible=true")).toBeVisible();

  await page.goto("/clientes/novo");
  await page.getByLabel("CPF/CNPJ").fill(raw);
  await page.getByLabel("Nome / Razão social").fill("Outro nome");
  await fillAddress(page);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Já existe um cliente com este CPF/CNPJ")).toBeVisible();

  await page.goto("/clientes");
  await page.getByLabel("Buscar").fill(name);
  await page.getByText(name).locator("visible=true").click();
  await expect(page).toHaveURL(/\/clientes\/\d+$/);
  await page.getByLabel("Telefone").fill("(34) 99999-0000");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Salvo")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Telefone")).toHaveValue("(34) 99999-0000");
});

test("operador não vê clientes", async ({ page }) => {
  await loginAs(page, "operator");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Clientes" })).toHaveCount(0);
  await page.goto("/clientes");
  await expect(page.getByText("Você não tem acesso a esta página")).toBeVisible();
});

test("ViaCEP preenche o endereço", async ({ page }) => {
  await page.route("https://viacep.com.br/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(CEP_BODY) }),
  );
  await loginAs(page, "office");
  await page.goto("/clientes/novo");
  await page.getByLabel("CEP").fill("38400-000");
  await page.getByLabel("CEP").blur();
  await expect(page.getByLabel("Rua")).toHaveValue("Avenida Rondon Pacheco");
  await expect(page.getByLabel("Bairro")).toHaveValue("Tibery");
  await expect(page.getByLabel("Cidade")).toHaveValue("Uberlândia");
  await expect(page.getByLabel("UF")).toHaveValue("MG");
  await expect(page.getByLabel("Código IBGE")).toHaveValue("3170206");
});

test("falha do ViaCEP não bloqueia o formulário", async ({ page }) => {
  await loginAs(page, "office");
  const { raw } = uniqueCnpj();
  await page.goto("/clientes/novo");
  await page.getByLabel("CPF/CNPJ").fill(raw);
  await page.getByLabel("Nome / Razão social").fill(uniqueName("Sem CEP"));
  await fillAddress(page);
  await page.getByLabel("CEP").blur();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/clientes$/);
});
