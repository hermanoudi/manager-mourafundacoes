import { expect, test } from "@playwright/test";

import { loginAs, PASSWORD, uniqueName } from "./helpers";

test("admin cria operador, desativa e o login falha", async ({ page, browser }) => {
  await loginAs(page, "admin");
  const name = uniqueName("Operador");
  const email = `${name.toLowerCase().replace(/\s+/g, "-")}@moura.test`;

  await page.goto("/usuarios");
  await page.getByRole("button", { name: "Novo usuário" }).click();
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByLabel("Papel").selectOption("operator");
  await page.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.getByText(email).locator("visible=true")).toBeVisible();

  await page.getByRole("button", { name: `Desativar ${name}` }).click();
  await expect(page.getByRole("button", { name: `Ativar ${name}` })).toBeVisible();

  const ctx = await browser.newContext({ baseURL: "http://localhost:3000" });
  const p2 = await ctx.newPage();
  await p2.goto("/login");
  await p2.getByLabel("E-mail").fill(email);
  await p2.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await p2.getByRole("button", { name: "Entrar" }).click();
  await expect(p2.locator("form [role=alert]")).toHaveText("E-mail ou senha inválidos");
  await ctx.close();
});

test("office não acessa usuários", async ({ page }) => {
  await loginAs(page, "office");
  await page.goto("/usuarios");
  await expect(page.getByText("Você não tem acesso a esta página")).toBeVisible();
});
