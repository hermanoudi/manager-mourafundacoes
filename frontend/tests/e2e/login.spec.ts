import { expect, test } from "@playwright/test";

import { E2E_PASSWORD } from "./global-setup";

test("login e logout", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-mail").fill(" E2E-Admin@Moura.test ");
  await page.getByLabel("Senha").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
  await expect(page.getByText("E2E Admin").first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("senha errada mostra mensagem", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("e2e-admin@moura.test");
  await page.getByLabel("Senha").fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("E-mail ou senha inválidos");
});

test("sem scroll horizontal", async ({ page }) => {
  await page.goto("/login");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(overflow).toBe(true);
});

test("assets do PWA públicos", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(manifest.status()).toBe(200);
  expect(await manifest.text()).toContain('"display":"standalone"');
  const icon = await request.get("/icons/icon-192.png", { maxRedirects: 0 });
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");
});
