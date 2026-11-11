import { expect, test } from "@playwright/test";

import { loginAs, PASSWORD } from "./helpers";

/**
 * A lista de usuários é paginada e ordenada por nome, sem busca. Nome único que fica na 1ª página
 * em qualquer banco: começa com dígito (antes das letras dos outros testes) e a chave decresce com
 * o tempo (o mais novo vem antes dos criados em execuções anteriores).
 */
function firstSortingName() {
  const key = (1e13 - Date.now()).toString(36).padStart(9, "0");
  return `0${key}${Math.floor(Math.random() * 1e4)} Operador`;
}

test("admin cria operador, desativa e o login falha", async ({ page, browser }) => {
  await loginAs(page, "admin");
  const name = firstSortingName();
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
