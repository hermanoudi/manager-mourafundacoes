import { expect, test, type Page } from "@playwright/test";

import {
  allocateJob, countMeasurements, createUser, firstMeasurement, jobInProgress, loginAs, loginWith,
  noHorizontalScroll, uniqueName,
} from "./helpers";

const line = (page: Page, n: number) => page.getByRole("group", { name: `Linha ${n}` });

/** Abre o lançamento pela tela da obra e preenche duas estacas: 8,5 m e 12 m. */
async function fillTwoPiles(page: Page, jobId: number) {
  await page.goto(`/obras/${jobId}`);
  await page.getByRole("link", { name: "Lançar medição" }).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${jobId}/medicoes/nova`));
  await line(page, 1).getByLabel("Estaca").fill("E-1");
  await line(page, 1).getByLabel("Profundidade (m)").fill("8,5");
  await page.getByRole("button", { name: "Adicionar estaca" }).click();
  await expect(line(page, 2).getByLabel("Estaca")).toHaveValue("E-2");
  await line(page, 2).getByLabel("Profundidade (m)").fill("12");
  await expect(page.getByText("Total: 2 estacas · 20,50 m")).toBeVisible();
}

async function expectSubmitted(page: Page, total: string) {
  await expect(page).toHaveURL(/\/medicoes\/\d+$/);
  await expect(page.getByTestId("measurement-status")).toHaveText("Enviada");
  await expect(page.getByTestId("measurement-total")).toContainText(total);
}

test("operador lança duas estacas e envia", async ({ page }) => {
  const { job, op } = await jobInProgress();
  await loginWith(page, op);
  await fillTwoPiles(page, job.id);
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expectSubmitted(page, "20,50 m");
  await expect(page.getByRole("cell", { name: "E-2", exact: true })).toBeVisible();
  await noHorizontalScroll(page);
  expect(await countMeasurements(job.id)).toBe(1);
});

test("admin lança duas estacas e a medição já nasce aprovada", async ({ page }) => {
  const { job } = await jobInProgress();
  await loginAs(page, "admin");
  await fillTwoPiles(page, job.id);
  await expect(page.getByRole("button", { name: "Enviar", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Lançar e aprovar" }).click();
  await expect(page).toHaveURL(/\/medicoes\/\d+$/);
  await expect(page.getByTestId("measurement-status")).toHaveText("Aprovada");
  await expect(page.getByTestId("measurement-total")).toContainText("20,50 m");
  expect(await countMeasurements(job.id)).toBe(1);
});

test("admin lança no nome do operador e o rascunho passa a ser dele", async ({ page }) => {
  const { job, rig, op } = await jobInProgress();
  const op2 = await createUser("operator", uniqueName("Operador"));
  await allocateJob(job.id, [rig.id], [op.id, op2.id]);
  const admin = await loginAs(page, "admin", uniqueName("Admin"));
  await fillTwoPiles(page, job.id);
  await noHorizontalScroll(page);

  // Com dois operadores na obra, o admin precisa escolher.
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Selecione o operador")).toBeVisible();
  await page.getByLabel("Operador").selectOption({ label: op2.name });
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page).toHaveURL(/\/medicoes\/\d+$/);
  const detailUrl = page.url();
  const fact = (label: string) => page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
  await expect(fact("Lançada por")).toHaveText(op2.name);
  await expect(fact("Digitada por")).toHaveText(admin.name);

  // O operador vê como dele e envia.
  await loginWith(page, op2);
  await page.goto(detailUrl);
  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page.getByLabel("Operador")).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expectSubmitted(page, "20,50 m");
  expect(await countMeasurements(job.id)).toBe(1);
});

test("sem conexão: rascunho fica no aparelho e o reenvio não duplica", async ({ page }) => {
  const { job, op } = await jobInProgress();
  await loginWith(page, op);
  await fillTwoPiles(page, job.id);

  await page.route("**/api/measurements", (r) => r.abort());
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Sem conexão — a medição ficou salva neste aparelho")).toBeVisible();
  expect(await countMeasurements(job.id)).toBe(0);

  await page.reload();
  await page.goto(`/obras/${job.id}`);
  const drafts = page.getByRole("region", { name: "Rascunhos neste aparelho" });
  await expect(drafts.getByRole("link")).toHaveCount(1);
  await noHorizontalScroll(page);

  await page.unroute("**/api/measurements");
  await drafts.getByRole("link").click();
  await expect(line(page, 2).getByLabel("Profundidade (m)")).toHaveValue("12");
  await page.getByRole("button", { name: "Reenviar" }).click();
  await expectSubmitted(page, "20,50 m");
  expect(await countMeasurements(job.id)).toBe(1);

  await page.goto(`/obras/${job.id}`);
  await expect(page.getByRole("region", { name: "Rascunhos neste aparelho" })).toHaveCount(0);
});

test("resposta perdida: o reenvio devolve a mesma medição", async ({ page }) => {
  const { job, op } = await jobInProgress();
  await loginWith(page, op);
  await fillTwoPiles(page, job.id);

  await page.route("**/api/measurements", async (route) => {
    await route.fetch();
    await route.abort();
  });
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Sem conexão — a medição ficou salva neste aparelho")).toBeVisible();
  expect(await countMeasurements(job.id)).toBe(1);

  await page.unroute("**/api/measurements");
  await page.getByRole("button", { name: "Reenviar" }).click();
  await expectSubmitted(page, "20,50 m");
  expect(await countMeasurements(job.id)).toBe(1);
});

test("resposta perdida + edição local: avisa e não descarta o rascunho em silêncio", async ({ page }) => {
  const { job, op } = await jobInProgress();
  await loginWith(page, op);
  await fillTwoPiles(page, job.id);

  await page.route("**/api/measurements", async (route) => {
    await route.fetch();
    await route.abort();
  });
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Sem conexão — a medição ficou salva neste aparelho")).toBeVisible();
  await page.unroute("**/api/measurements");

  await line(page, 2).getByLabel("Profundidade (m)").fill("13");
  await page.getByRole("button", { name: "Reenviar" }).click();
  const warning = "Esta medição já tinha sido enviada; suas alterações não foram aplicadas.";
  await expect(page.getByRole("alert").filter({ hasText: warning })).toBeVisible();
  await expect(page).toHaveURL(/\/medicoes\/nova/);
  expect(await countMeasurements(job.id)).toBe(1);
  expect((await firstMeasurement(job.id)).lines.map((l) => l.depth_m)).toEqual(["8.50", "12.00"]);

  await page.goto(`/obras/${job.id}`);
  const drafts = page.getByRole("region", { name: "Rascunhos neste aparelho" });
  await expect(drafts.getByRole("link")).toHaveCount(1);
  await drafts.getByRole("link").click();
  await expect(line(page, 2).getByLabel("Profundidade (m)")).toHaveValue("13");
  await page.getByRole("button", { name: "Reenviar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: warning })).toBeVisible();
  await page.getByRole("button", { name: "Descartar rascunho local" }).click();
  await expectSubmitted(page, "20,50 m");

  await page.goto(`/obras/${job.id}`);
  await expect(page.getByRole("heading", { name: job.name })).toBeVisible();
  await expect(page.getByRole("region", { name: "Rascunhos neste aparelho" })).toHaveCount(0);
  expect(await countMeasurements(job.id)).toBe(1);
});

test("office rejeita com motivo, operador corrige e reenvia, office aprova", async ({ page }) => {
  const { job, op } = await jobInProgress();
  const office = await createUser("office", uniqueName("Escritório"));
  await loginWith(page, op);
  await fillTwoPiles(page, job.id);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expectSubmitted(page, "20,50 m");
  const detailUrl = page.url();

  const filter = (name: string) =>
    page.getByRole("group", { name: "Filtrar por status" }).getByRole("button", { name });
  await page.goto("/medicoes");
  await expect(filter("Todas")).toHaveAttribute("aria-pressed", "true");

  await loginWith(page, office);
  await page.goto("/medicoes");
  await expect(filter("Enviadas")).toHaveAttribute("aria-pressed", "true");
  await page.getByText(job.name).locator("visible=true").first().click();
  await expect(page).toHaveURL(detailUrl);
  await page.getByRole("button", { name: "Rejeitar" }).click();
  await page.getByRole("button", { name: "Confirmar rejeição" }).click();
  await expect(page.getByText("Informe o motivo da rejeição")).toBeVisible();
  await page.getByLabel("Motivo da rejeição").fill("Profundidade da E-2 errada");
  await page.getByRole("button", { name: "Confirmar rejeição" }).click();
  await expect(page.getByTestId("measurement-status")).toHaveText("Rejeitada");

  await loginWith(page, op);
  await page.goto(detailUrl);
  await expect(page.getByText("Profundidade da E-2 errada")).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole("link", { name: "Editar" }).click();
  await expect(line(page, 2).getByLabel("Profundidade (m)")).toHaveValue("12,00");
  await line(page, 2).getByLabel("Profundidade (m)").fill("13");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expectSubmitted(page, "21,50 m");
  await expect(page).toHaveURL(detailUrl);
  expect(await countMeasurements(job.id)).toBe(1);

  await loginWith(page, office);
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByTestId("measurement-status")).toHaveText("Aprovada");
  await expect(page.getByRole("button", { name: "Rejeitar" })).toHaveCount(0);

  await loginWith(page, op);
  await page.goto(detailUrl);
  await expect(page.getByTestId("measurement-status")).toHaveText("Aprovada");
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reenviar" })).toHaveCount(0);
});

test("admin corrige e aprova, e exclui a medição de um operador", async ({ page }) => {
  const { job, op } = await jobInProgress();
  await loginWith(page, op);
  await fillTwoPiles(page, job.id);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expectSubmitted(page, "20,50 m");
  const detailUrl = page.url();

  const reject = async () => {
    await page.getByRole("button", { name: "Rejeitar" }).click();
    await page.getByLabel("Motivo da rejeição").fill("Conferir a E-2");
    await page.getByRole("button", { name: "Confirmar rejeição" }).click();
    await expect(page.getByTestId("measurement-status")).toHaveText("Rejeitada");
  };

  await loginAs(page, "admin");
  await page.goto(detailUrl);
  await reject();
  await expect(page.getByRole("button", { name: "Lançar e aprovar" })).toBeVisible();
  await page.getByRole("link", { name: "Editar" }).click();
  await line(page, 2).getByLabel("Profundidade (m)").fill("13");
  // Enviada pelo admin, a medição do operador já sai aprovada.
  await page.getByRole("button", { name: "Lançar e aprovar" }).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.getByTestId("measurement-status")).toHaveText("Aprovada");
  await expect(page.getByTestId("measurement-total")).toContainText("21,50 m");
  await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);

  // Outra medição, rejeitada, para excluir.
  await loginWith(page, op);
  await page.goto(`/obras/${job.id}`);
  await page.getByRole("link", { name: "Lançar medição" }).click();
  await line(page, 1).getByLabel("Estaca").fill("E-9");
  await line(page, 1).getByLabel("Profundidade (m)").fill("7");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expectSubmitted(page, "7,00 m");
  const secondUrl = page.url();
  await loginAs(page, "admin");
  await page.goto(secondUrl);
  await reject();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page).toHaveURL(new RegExp(`/obras/${job.id}\\?aba=medicoes`));
  expect(await countMeasurements(job.id)).toBe(1);
});
