// @ts-check
import { test, expect } from '@playwright/test';
import { setupFullApp } from './helpers.js';

test.describe('09 — Floating Chat', () => {
  test.beforeEach(async ({ page }) => {
    await setupFullApp(page);
  });

  test('FAB do chat deve estar visível', async ({ page }) => {
    await expect(page.locator('#fc-fab')).toBeVisible();
  });

  test('clicar no FAB deve abrir o painel do chat', async ({ page }) => {
    await page.click('#fc-fab');
    await expect(page.locator('#fc-panel')).toHaveClass(/open/);
  });

  test('painel deve ter header com título', async ({ page }) => {
    await page.click('#fc-fab');
    await expect(page.locator('#fc-title')).toContainText('AgileViewAI');
  });

  test('painel deve ter botões de nova conversa, histórico e fechar', async ({ page }) => {
    await page.click('#fc-fab');
    const header = page.locator('.fc-header');
    const buttons = header.locator('.fc-hbtn');
    await expect(buttons).toHaveCount(3);
  });

  test('painel deve ter área de input e botão enviar', async ({ page }) => {
    await page.click('#fc-fab');
    await expect(page.locator('#fc-textarea')).toBeVisible();
    await expect(page.locator('#fc-send-btn')).toBeVisible();
  });

  test('área de mensagens deve ter welcome message', async ({ page }) => {
    await page.click('#fc-fab');
    const msgs = page.locator('#fc-messages');
    // Aguardar conteúdo
    await page.waitForTimeout(500);
    const text = await msgs.textContent();
    expect(text.length).toBeGreaterThan(0);
  });

  test('clicar no X deve fechar o painel', async ({ page }) => {
    await page.click('#fc-fab');
    await expect(page.locator('#fc-panel')).toHaveClass(/open/);
    // Fechar
    await page.locator('.fc-header .fc-hbtn').last().click();
    await expect(page.locator('#fc-panel')).not.toHaveClass(/open/);
  });

  test('sidebar de conversas deve iniciar collapsed', async ({ page }) => {
    await page.click('#fc-fab');
    await expect(page.locator('#fc-sidebar')).toHaveClass(/collapsed/);
  });

  test('clicar em histórico deve expandir sidebar', async ({ page }) => {
    await page.click('#fc-fab');
    // Botão de histórico é o segundo fc-hbtn
    await page.locator('.fc-header .fc-hbtn').nth(1).click();
    await expect(page.locator('#fc-sidebar')).not.toHaveClass(/collapsed/);
  });

  test('digitar mensagem e enviar deve criar bubble do user', async ({ page }) => {
    await page.click('#fc-fab');
    await page.fill('#fc-textarea', 'Teste de mensagem');
    await page.click('#fc-send-btn');
    // Deve ter mensagem do user
    await page.waitForTimeout(1000);
    const userMsg = page.locator('.fc-msg-user');
    await expect(userMsg.first()).toContainText('Teste de mensagem');
  });
});
