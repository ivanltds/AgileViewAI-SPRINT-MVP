// @ts-check
import { test, expect } from '@playwright/test';
import { goToApp } from './helpers.js';

test.describe('02 — Navegação', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
  });

  test('sidebar deve ter 5 itens de navegação', async ({ page }) => {
    const navItems = page.locator('.nav-item');
    await expect(navItems).toHaveCount(5);
  });

  test('dashboard deve estar ativo por padrão', async ({ page }) => {
    await expect(page.locator('#nav-dashboard')).toHaveClass(/active/);
    await expect(page.locator('#panel-dashboard')).toHaveClass(/active/);
  });

  test('clicar em Times deve navegar para o painel correto', async ({ page }) => {
    await page.click('#nav-teams');
    await expect(page.locator('#panel-teams')).toHaveClass(/active/);
    await expect(page.locator('#panel-dashboard')).not.toHaveClass(/active/);
  });

  test('clicar em IA & Tokens deve navegar para o painel correto', async ({ page }) => {
    await page.click('#nav-llm');
    await expect(page.locator('#panel-llm')).toHaveClass(/active/);
  });

  test('clicar em Treinamento deve navegar para o painel correto', async ({ page }) => {
    await page.click('#nav-rag');
    await expect(page.locator('#panel-rag')).toHaveClass(/active/);
  });

  test('clicar em Configurações deve navegar para o painel correto', async ({ page }) => {
    await page.click('#nav-settings');
    await expect(page.locator('#panel-settings')).toHaveClass(/active/);
  });

  test('dashboard tabs (Sprint/Eficiência/Qualidade) devem funcionar', async ({ page }) => {
    // Sprint ativo por padrão
    const sprintTab = page.locator('.mod-tab[data-mod="sprint"]');
    await expect(sprintTab).toHaveClass(/active/);
    await expect(page.locator('#module-sprint')).toHaveClass(/active/);

    // Clicar em Eficiência
    await page.click('.mod-tab[data-mod="eficiencia"]');
    await expect(page.locator('#module-eficiencia')).toHaveClass(/active/);
    await expect(page.locator('#module-sprint')).not.toHaveClass(/active/);

    // Clicar em Qualidade
    await page.click('.mod-tab[data-mod="qualidade"]');
    await expect(page.locator('#module-qualidade')).toHaveClass(/active/);

    // Voltar para Sprint
    await page.click('.mod-tab[data-mod="sprint"]');
    await expect(page.locator('#module-sprint')).toHaveClass(/active/);
  });

  test('sidebar deve marcar item ativo ao navegar', async ({ page }) => {
    await page.click('#nav-teams');
    await expect(page.locator('#nav-teams')).toHaveClass(/active/);
    await expect(page.locator('#nav-dashboard')).not.toHaveClass(/active/);
  });
});

test.describe('02b — Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await goToApp(page);
  });

  test('bottom nav deve estar visível no mobile', async ({ page }) => {
    await expect(page.locator('#mobile-bottom-nav')).toBeVisible();
  });

  test('sidebar deve estar oculta no mobile', async ({ page }) => {
    await expect(page.locator('#sidebar')).toBeHidden();
  });

  test('clicar em Times no bottom nav deve navegar', async ({ page }) => {
    await page.click('#mbn-teams');
    await expect(page.locator('#panel-teams')).toHaveClass(/active/);
  });
});
