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
  await page.getByRole("button", { name: "Editar preços" }).click();
  await page.getByLabel("Preço por metro, 40 cm").fill("11,5");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Tabela salva")).toBeVisible();
  await page.reload();
  await expect(page.getByText("R$ 11,50")).toBeVisible();
  await page.getByRole("button", { name: "Editar preços" }).click();
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

  await expect(page.getByText("Planejada").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Para iniciar a obra" })).toBeVisible();
  await page.getByRole("tab", { name: "Preços" }).click();
  await expect(page).toHaveURL(/\?aba=precos$/);
  await expect(page.getByRole("heading", { name: "Tabela contratada" })).toBeVisible();
  await noHorizontalScroll(page);

  await page.getByRole("button", { name: "Iniciar obra" }).click();
  await expect(
    page.getByText("Aloque ao menos uma perfuratriz e um operador antes de iniciar a obra"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Alocar equipe" }).click();
  await expect(page.getByRole("tab", { name: "Equipe" })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel(rig.name).check();
  await page.getByLabel(op.name).check();
  await page.getByRole("button", { name: "Salvar alocação" }).click();
  await expect(page.getByText("Alocação salva")).toBeVisible();

  await page.getByRole("button", { name: "Iniciar obra" }).click();
  await expect(page.getByTestId("job-status")).toHaveText("Em execução");
  await expect(page.getByRole("link", { name: "Lançar medição" })).toHaveAttribute(
    "href", /\/obras\/\d+\/medicoes\/nova$/,
  );
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
  await expect(page.getByRole("tab", { name: "Preços" })).toHaveCount(0);
  await expect(page.getByText("Tabela contratada")).toHaveCount(0);
  await expect(page.getByText("R$")).toHaveCount(0);
  await noHorizontalScroll(page);

  await page.goto(`/obras/${other.id}`);
  await expect(page.getByText("Registro não encontrado")).toBeVisible();
  await page.goto("/tabela-precos");
  await expect(page.getByText("Você não tem acesso a esta página")).toBeVisible();
});

test("admin alcança Usuários pelo menu Mais no mobile, sem scroll horizontal", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "barra inferior só existe no mobile");
  await loginAs(page, "admin");
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Principal" }).locator("visible=true");
  await expect(nav.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  expect(await nav.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await noHorizontalScroll(page);

  const more = nav.getByRole("button", { name: "Mais" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Mais opções" })).toHaveCount(0);

  await more.click();
  await page.getByRole("dialog", { name: "Mais opções" }).getByRole("link", { name: "Usuários" }).click();
  await expect(page).toHaveURL(/\/usuarios$/);
  await expect(page.getByRole("dialog", { name: "Mais opções" })).toHaveCount(0);
  await noHorizontalScroll(page);
});

test("operador não tem menu Mais", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "barra inferior só existe no mobile");
  await loginAs(page, "operator");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Mais" })).toHaveCount(0);
});
