// @ts-check
import { test, expect } from '@playwright/test';
import { setupFullApp } from './helpers.js';

test.describe('08 — Board History (Timeline)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER ${msg.type().toUpperCase()}: ${msg.text()}`));
    await setupFullApp(page);
    await page.waitForSelector('.bl-row', { timeout: 15000 });
  });

  test('deve carregar e exibir a linha do tempo com sucesso após expansão', async ({ page }) => {
    // Sobrescrever o handler padrão de revisões com dados reais
    await page.route('**/revisions**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          value: [
            { fields: { 'System.BoardColumn': 'Novo',         'System.ChangedDate': '2024-01-01T10:00:00Z' } },
            { fields: { 'System.BoardColumn': 'Em Progresso', 'System.ChangedDate': '2024-01-02T10:00:00Z' } }
          ]
        })
      });
    });

    // Expandir linha do backlog
    await page.locator('.bl-row').first().click();
    // Clicar no botão Board History
    const historyBtn = page.locator('.tl-header-subtle').first();
    await expect(historyBtn).toBeVisible({ timeout: 5000 });
    await historyBtn.click();

    // Validar trilha
    const track = page.locator('.tl-track').first();
    await expect(track).toBeVisible({ timeout: 8000 });
    await expect(track).toContainText('Novo');
    await expect(track).toContainText('Em Progresso');
  });

  test('deve exibir mensagem quando API retorna erro (sem histórico disponível)', async ({ page }) => {
    // O EficienciaAPI.getRevisions captura erros HTTP e retorna [] por design
    // (tolerância a falhas). O UI exibe "Sem histórico." quando revisions=[].
    await page.unroute('**/revisions**');
    await page.route('**/revisions**', async route => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    // Expandir e clicar
    await page.locator('.bl-row').first().click();
    const historyBtn = page.locator('.tl-header-subtle').first();
    await expect(historyBtn).toBeVisible({ timeout: 5000 });
    await historyBtn.click();

    // Track fica visível com a mensagem correspondente a [] revisões
    const track = page.locator('.tl-track').first();
    await expect(track).toBeVisible({ timeout: 10000 });
    // Comportamento documentado: API 500 → revisions=[] → "Sem histórico."
    await expect(track).toContainText(/Sem hist.rico/);
  });

  test('deve usar cache ao alternar visibilidade do histórico', async ({ page }) => {
    let callCount = 0;
    await page.route('**/revisions**', async route => {
      callCount++;
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          value: [{ fields: { 'System.BoardColumn': 'Novo', 'System.ChangedDate': '2024-01-01T10:00:00Z' } }]
        })
      });
    });

    await page.locator('.bl-row').first().click();
    const historyBtn = page.locator('.tl-header-subtle').first();
    const track = page.locator('.tl-track').first();

    // 1ª expansão — deve chamar a API
    await historyBtn.click();
    await expect(track).toBeVisible({ timeout: 8000 });
    expect(callCount).toBe(1);

    // Recolher
    await historyBtn.click();
    await expect(track).not.toBeVisible();

    // 2ª expansão — cache (callCount permanece 1)
    await historyBtn.click();
    await expect(track).toBeVisible();
    expect(callCount).toBe(1);
  });
});
