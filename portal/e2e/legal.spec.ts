import { test, expect } from "@playwright/test";

// Paginas legais (Termos e Privacidade) e os pontos que linkam para elas.
test.describe("documentos legais", () => {
  test("Termos de Uso carrega com titulo, CNPJ e seção de reembolso", async ({ page }) => {
    await page.goto("/termos");
    await expect(page.getByRole("heading", { name: "Termos de Uso", level: 1 })).toBeVisible();
    await expect(page.getByText("64.572.784/0001-05")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Direito de arrependimento/i })).toBeVisible();
  });

  test("Política de Privacidade carrega com titulo e LGPD", async ({ page }) => {
    await page.goto("/privacidade");
    await expect(page.getByRole("heading", { name: "Política de Privacidade", level: 1 })).toBeVisible();
    await expect(page.getByText(/13\.709\/2018/)).toBeVisible();
    // O fix do em dash: o item de sub-processador usa dois pontos, sem travessao.
    await expect(page.getByText(/Mercado Pago/).first()).toBeVisible();
  });

  test("rodape de um doc cruza para o outro", async ({ page }) => {
    await page.goto("/termos");
    await page.locator(".legal-foot").getByRole("link", { name: "Política de Privacidade" }).click();
    await expect(page).toHaveURL(/\/privacidade/);
    await expect(page.getByRole("heading", { name: "Política de Privacidade", level: 1 })).toBeVisible();
  });

  test("checkbox do checkout linka para Termos e Privacidade", async ({ page }) => {
    await page.goto("/checkout?plano=essencial");
    await expect(page.locator('a[href="/termos"]')).toBeVisible();
    await expect(page.locator('a[href="/privacidade"]')).toBeVisible();
  });

  test("rodape da landing tem os links legais", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('.foot-legal a[href="/termos"]')).toHaveText(/Termos de Uso/);
    await expect(page.locator('.foot-legal a[href="/privacidade"]')).toHaveText(/Política de Privacidade/);
  });
});
