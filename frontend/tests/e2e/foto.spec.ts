import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { countMeasurements, firstMeasurement, jobInProgress, loginWith, noHorizontalScroll } from "./helpers";

// Backend com NOTES_EXTRACTOR=fake: E-1 30 8,5 · E-2 30 12,0 · E-3 40 "ilegível".
const FIXTURE = path.join(__dirname, "fixtures", "anotacao.jpg");
const PHOTOS = "**/api/jobs/*/photos";

const line = (page: Page, n: number) => page.getByRole("group", { name: `Linha ${n}` });
const lines = (page: Page) => page.getByRole("group", { name: /^Linha \d+$/ });
const photoInput = (page: Page) => page.locator('input[type="file"]');
const sendButton = (page: Page) => page.getByRole("button", { name: "Enviar", exact: true });

async function openForm(page: Page) {
  const { job, op } = await jobInProgress();
  await loginWith(page, op);
  await page.goto(`/obras/${job.id}/medicoes/nova`);
  await expect(page.getByRole("button", { name: "Foto das anotações" })).toBeVisible();
  return job;
}

async function expectPhotoLoaded(page: Page) {
  const img = page.getByRole("img", { name: "Foto da folha de medição" });
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0)))
    .toBeGreaterThan(0);
}

test("foto das anotações: revisa a linha ilegível, corrige e envia com a foto", async ({ page }) => {
  const job = await openForm(page);
  await photoInput(page).setInputFiles(FIXTURE);

  await expect(lines(page)).toHaveCount(3);
  await expect(line(page, 1).getByLabel("Estaca")).toHaveValue("E-1");
  await expect(line(page, 1).getByLabel("Profundidade (m)")).toHaveValue("8,50");
  await expect(line(page, 2).getByLabel("Profundidade (m)")).toHaveValue("12,00");
  await expect(line(page, 3).getByLabel("Estaca")).toHaveValue("E-3");
  await expect(line(page, 3)).toContainText("Profundidade não reconhecida (ilegível)");
  await expect(page.getByText("Confira as linhas lidas da foto antes de enviar")).toBeVisible();
  await expect(sendButton(page)).toBeDisabled();
  await noHorizontalScroll(page);

  await line(page, 3).getByLabel("Profundidade (m)").fill("10");
  await expect(line(page, 3)).not.toContainText("não reconhecida");
  await expect(page.getByText("Total: 3 estacas · 30,50 m")).toBeVisible();
  await sendButton(page).click();

  await expect(page).toHaveURL(/\/medicoes\/\d+$/);
  await expect(page.getByTestId("measurement-status")).toHaveText("Enviada");
  await expect(page.getByTestId("measurement-total")).toContainText("30,50 m");
  await expectPhotoLoaded(page);
  await noHorizontalScroll(page);
  const m = await firstMeasurement(job.id);
  expect(m.photo_id).not.toBeNull();
  expect(m.lines.map((l) => l.depth_m)).toEqual(["8.50", "12.00", "10.00"]);
});

test("remover a linha ilegível também libera o envio", async ({ page }) => {
  const job = await openForm(page);
  await photoInput(page).setInputFiles(FIXTURE);
  await expect(lines(page)).toHaveCount(3);
  await expect(sendButton(page)).toBeDisabled();
  await page.getByRole("button", { name: "Remover linha 3" }).click();
  await expect(sendButton(page)).toBeEnabled();
  await sendButton(page).click();
  await expect(page.getByTestId("measurement-total")).toContainText("20,50 m");
  expect(await countMeasurements(job.id)).toBe(1);
});

test("falha na leitura: avisa e a digitação continua, com a foto anexada", async ({ page }) => {
  const job = await openForm(page);
  // Resposta real (foto gravada de verdade), mas como se a IA tivesse falhado.
  await page.route(PHOTOS, async (route) => {
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      json: { ...(await res.json()), extraction: null, extraction_error: "extraction_failed" },
    });
  });
  await photoInput(page).setInputFiles(FIXTURE);
  await expect(page.getByText("Não foi possível ler a foto. Digite as linhas.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar ler de novo" })).toBeVisible();
  await expect(lines(page)).toHaveCount(1);

  await line(page, 1).getByLabel("Estaca").fill("E-7");
  await line(page, 1).getByLabel("Profundidade (m)").fill("9");
  await expect(page.getByText("Total: 1 estaca · 9,00 m")).toBeVisible();
  await sendButton(page).click();
  await expect(page.getByTestId("measurement-status")).toHaveText("Enviada");
  await expectPhotoLoaded(page);
  expect((await firstMeasurement(job.id)).photo_id).not.toBeNull();
});

test("tentar ler de novo usa a foto já enviada, sem reenviar", async ({ page }) => {
  await openForm(page);
  let uploads = 0;
  await page.route(PHOTOS, async (route) => {
    uploads++;
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      json: { ...(await res.json()), extraction: null, extraction_error: "extraction_failed" },
    });
  });
  await photoInput(page).setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Tentar ler de novo" }).click();
  await expect(lines(page)).toHaveCount(3);
  await expect(page.getByText("Não foi possível ler a foto. Digite as linhas.")).toHaveCount(0);
  expect(uploads).toBe(1);
});

test("foto grande demais é recusada no aparelho", async ({ page }) => {
  await openForm(page);
  let uploads = 0;
  await page.route(PHOTOS, (route) => {
    uploads++;
    return route.continue();
  });
  // Não decodificável (vai o original) e acima de 4 MB.
  await photoInput(page).setInputFiles({
    name: "grande.heic", mimeType: "image/heic", buffer: Buffer.alloc(5 * 1024 * 1024, 1),
  });
  await expect(page.getByText("Foto muito grande. Tente outra foto ou digite as linhas.")).toBeVisible();
  await expect(lines(page)).toHaveCount(1);
  expect(uploads).toBe(0);
});
