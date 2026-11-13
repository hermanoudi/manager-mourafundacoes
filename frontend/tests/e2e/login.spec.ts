import { expect, test } from "@playwright/test";

import { E2E_PASSWORD } from "./global-setup";

test("login e logout", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-mail").fill(" E2E-Admin@Moura.test ");
  await page.getByLabel("Senha", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Olá, E2E" })).toBeVisible();
  await expect(page.getByText("E2E Admin").locator("visible=true")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Olá, E2E" })).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("senha errada mostra mensagem", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("e2e-admin@moura.test");
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada-123");
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
  const logo = await request.get("/brand/logo.png", { maxRedirects: 0 });
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"]).toContain("image/png");
});

test("logo da marca aparece na tela de login", async ({ page }) => {
  await page.goto("/login");
  const logo = page.getByRole("img", { name: "Moura Fundações" });
  await expect(logo).toBeVisible();
  const loaded = await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  expect(loaded).toBe(true);
});

test("olho mostra e oculta a senha digitada", async ({ page }) => {
  await page.goto("/login");
  const senha = page.getByLabel("Senha", { exact: true });
  await senha.fill("minha-senha-123");
  await expect(senha).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(senha).toHaveAttribute("type", "text");
  await expect(senha).toHaveValue("minha-senha-123");
  await page.getByRole("button", { name: "Ocultar senha" }).click();
  await expect(senha).toHaveAttribute("type", "password");
});

test("tela de login usa a cor da marca", async ({ page }) => {
  await page.goto("/login");
  const bg = await page.getByRole("button", { name: "Entrar" }).evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(bg).toBe("rgb(139, 28, 49)"); // #8b1c31
});
