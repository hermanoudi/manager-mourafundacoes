import { expect, test, type Page } from "@playwright/test";

import {
  allocateJob, createCustomer, createJob, createRig, createUser, loginAs, loginWith, uniqueName,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.route("https://viacep.com.br/**", (route) => route.fulfill({ status: 500, body: "" }));
});

async function noHorizontalScroll(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

test("office edita a tabela de preços", async ({ page }) => {
  await loginAs(page, "office");
  await page.goto("/tabela-precos");
  await page.getByLabel("Preço por metro, 40 cm").fill("11,5");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Salvo")).toBeVisible();
  await page.reload();
  await expect(page.getByText("R$ 11,50")).toBeVisible();
  await expect(page.getByLabel("Preço por metro, 40 cm")).toHaveValue("11,50");
  await noHorizontalScroll(page);
});

test("office cria obra, aloca e inicia", async ({ page }) => {
  const customer = await createCustomer();
  const rig = await createRig();
  const op = await createUser("operator", uniqueName("Operador"));
  await loginAs(page, "office");

  const jobName = uniqueName("Obra UI");
  await page.goto("/obras/nova");
  await page.getByLabel("Nome da obra").fill(jobName);
  await page.getByLabel("Pesquisar por nome").fill(customer.name);
  await page.getByLabel("Cliente").selectOption({ label: customer.name });
  await page.getByLabel("CEP").fill("38400-000");
  await page.getByLabel("Rua").fill("Av. Rondon Pacheco");
  await page.getByLabel("Número").fill("100");
  await page.getByLabel("Bairro").fill("Tibery");
  await page.getByLabel("Cidade").fill("Uberlândia");
  await page.getByLabel("UF").fill("MG");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page).toHaveURL(/\/obras\/\d+$/);

  await expect(page.getByRole("heading", { name: "Tabela contratada" })).toBeVisible();
  await expect(page.getByText("Planejada").first()).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByRole("button", { name: "Iniciar obra" }).click();
  await expect(
    page.getByText("Aloque ao menos uma perfuratriz e um operador antes de iniciar a obra"),
  ).toBeVisible();

  await page.getByLabel(rig.name).check();
  await page.getByLabel(op.name).check();
  await page.getByRole("button", { name: "Salvar alocação" }).click();
  await expect(page.getByText("Alocação salva")).toBeVisible();

  await page.getByRole("button", { name: "Iniciar obra" }).click();
  await expect(page.getByTestId("job-status")).toHaveText("Em execução");
  await expect(page.getByRole("link", { name: "Lançar medição" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar obra" })).toHaveCount(0);
  await noHorizontalScroll(page);
});

test("operador alocado vê a obra sem preços; não alocada é 404", async ({ page }) => {
  const customer = await createCustomer();
  const rig = await createRig();
  const op = await createUser("operator", uniqueName("Operador"));
  const mine = await createJob(customer.id);
  const other = await createJob(customer.id);
  await allocateJob(mine.id, [rig.id], [op.id]);

  await loginWith(page, op);
  await page.goto("/obras");
  await expect(page.getByText(mine.name).locator("visible=true")).toBeVisible();
  await expect(page.getByText(other.name)).toHaveCount(0);
  await page.getByText(mine.name).locator("visible=true").click();
  await expect(page).toHaveURL(new RegExp(`/obras/${mine.id}$`));
  await expect(page.getByRole("heading", { name: mine.name })).toBeVisible();
  await expect(page.getByText("Tabela contratada")).toHaveCount(0);
  await expect(page.getByText("R$")).toHaveCount(0);
  await noHorizontalScroll(page);

  await page.goto(`/obras/${other.id}`);
  await expect(page.getByText("Registro não encontrado")).toBeVisible();
  await page.goto("/tabela-precos");
  await expect(page.getByText("Você não tem acesso a esta página")).toBeVisible();
});
