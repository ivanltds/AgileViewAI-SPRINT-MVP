// @ts-check
import { test, expect } from '@playwright/test';
import { goToApp } from './helpers.js';

test.describe('04 — LLM CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.click('#nav-llm');
  });

  test('deve mostrar painel de IA & Tokens', async ({ page }) => {
    await expect(page.locator('#panel-llm')).toHaveClass(/active/);
    await expect(page.locator('text=IA & Tokens LLM')).toBeVisible();
  });

  test('deve abrir modal de novo token', async ({ page }) => {
    await page.click('text=+ Novo token');
    await expect(page.locator('#modal-llm')).toHaveClass(/open/);
  });

  test('deve criar token OpenAI', async ({ page }) => {
    await page.click('text=+ Novo token');
    await page.selectOption('#lf-provider', 'openai');
    await page.fill('#lf-token', 'sk-test123456789');
    await page.click('#modal-llm .btn-blue');
    await expect(page.locator('#modal-llm')).not.toHaveClass(/open/);
    await expect(page.locator('#llm-list')).toContainText('openai');
  });

  test('deve ativar um token LLM', async ({ page }) => {
    // Criar token primeiro
    await page.click('text=+ Novo token');
    await page.selectOption('#lf-provider', 'claude');
    await page.fill('#lf-token', 'sk-claude-test');
    await page.click('#modal-llm .btn-blue');
    await page.waitForTimeout(500);

    // Clicar em Ativar
    const activateBtn = page.locator('text=Ativar').first();
    if (await activateBtn.isVisible()) {
      await activateBtn.click();
      await expect(page.locator('.llm-card.act')).toBeVisible();
    }
  });
});
