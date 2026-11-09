import { expect, test } from "@playwright/test";

import { loginAs, uniqueName } from "./helpers";

test("office cria perfuratriz e muda status", async ({ page }) => {
  await loginAs(page, "office");
  const name = uniqueName("Perfuratriz");
  await page.goto("/perfuratrizes/novo");
  for (const removed of ["Fabricante", "Modelo", "Nº de série"]) {
    await expect(page.getByLabel(removed)).toHaveCount(0);
  }
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("Diâmetro máx. (cm)").fill("80");
  await page.getByLabel("Profundidade máx. (m)").fill("22,5");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/perfuratrizes\/\d+$/);
  await expect(page.getByText("22,50 m")).toBeVisible();

  await page.getByLabel("Status").selectOption("maintenance");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Salvo")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("maintenance");
});

test("nome duplicado mostra erro", async ({ page }) => {
  await loginAs(page, "office");
  const name = uniqueName("Dupla");
  for (const n of [name, name.toUpperCase()]) {
    await page.goto("/perfuratrizes/novo");
    await page.getByLabel("Nome").fill(n);
    await page.getByLabel("Diâmetro máx. (cm)").fill("60");
    await page.getByLabel("Profundidade máx. (m)").fill("15");
    await page.getByRole("button", { name: "Salvar" }).click();
  }
  await expect(page.getByText("Já existe uma perfuratriz com este nome")).toBeVisible();
});

test("operador vê a lista mas não o botão de criar", async ({ page }) => {
  await loginAs(page, "operator");
  await page.goto("/perfuratrizes");
  await expect(page.getByRole("heading", { name: "Perfuratrizes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nova perfuratriz" })).toHaveCount(0);
});
