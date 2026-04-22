// @ts-check
import { test, expect } from '@playwright/test';
import { setupFullApp } from './helpers.js';

test.describe('06 — Eficiência Module', () => {
  test.beforeEach(async ({ page }) => {
    await setupFullApp(page);
    // Navegar para a tab de Eficiência
    await page.click('.mod-tab[data-mod="eficiencia"]');
    await page.waitForTimeout(500);
  });

  test('módulo de eficiência deve estar visível', async ({ page }) => {
    await expect(page.locator('#module-eficiencia')).toHaveClass(/active/);
  });

  test('deve ter botões de filtro rápido (3, 6, 12 meses)', async ({ page }) => {
    await expect(page.locator('text=3 meses')).toBeVisible();
    await expect(page.locator('text=6 meses')).toBeVisible();
    await expect(page.locator('text=1 ano')).toBeVisible();
  });

  test('deve ter botão Calcular', async ({ page }) => {
    const btn = page.locator('#module-eficiencia .btn-blue');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Calcular');
  });

  test('deve ter dropdown de sprints selecionadas', async ({ page }) => {
    await expect(page.locator('#ef-sprint-graph-wrap')).toBeVisible();
  });

  test('estado inicial deve mostrar mensagem de empty state', async ({ page }) => {
    await expect(page.locator('#ef-content')).toContainText('Selecione');
  });
});

test.describe('07 — Qualidade Module', () => {
  test.beforeEach(async ({ page }) => {
    await setupFullApp(page);
    // Navegar para a tab de Qualidade
    await page.click('.mod-tab[data-mod="qualidade"]');
    await page.waitForTimeout(500);
  });

  test('módulo de qualidade deve estar visível', async ({ page }) => {
    await expect(page.locator('#module-qualidade')).toHaveClass(/active/);
  });

  test('deve ter botão Carregar', async ({ page }) => {
    const btn = page.locator('#module-qualidade .btn-blue').first();
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Carregar');
  });

  test('estado inicial deve mostrar empty state', async ({ page }) => {
    await expect(page.locator('#qual-content')).toContainText('Carregar');
  });

  test('seção de análise LLM deve estar escondida inicialmente', async ({ page }) => {
    await expect(page.locator('#qual-llm-section')).toBeHidden();
  });
});
