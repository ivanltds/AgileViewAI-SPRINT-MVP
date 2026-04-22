// @ts-check
import { test, expect } from '@playwright/test';
import { setupFullApp } from './helpers.js';

test.describe('05 — Dashboard Sprint', () => {
  test.beforeEach(async ({ page }) => {
    await setupFullApp(page);
    await page.waitForSelector('#panel-dashboard.active', { timeout: 10000 });
  });

  // ═══ TOPBAR ═══
  test('dropdown de time deve existir e abrir ao clicar', async ({ page }) => {
    const btn = page.locator('#db-team-btn');
    await expect(btn).toBeVisible();
    await btn.click();
    
    const menu = page.locator('#db-team-menu');
    await expect(menu).toHaveClass(/open/);
    await expect(menu).toContainText('Time Alpha');
  });

  test('selecionar time no dropdown deve trocar o time ativo e carregar dados', async ({ page }) => {
    await page.locator('#db-team-btn').click();
    const betaItem = page.locator('.db-tmi', { hasText: 'Time Beta' });
    await betaItem.click();
    
    const teamName = page.locator('#db-team-btn-name');
    await expect(teamName).toHaveText('Time Beta', { timeout: 10000 });
  });

  // ═══ KPI CARDS ═══
  test('cards principais de KPI devem estar visíveis', async ({ page }) => {
    // Usar regex para ignorar o 'i' do tooltip
    await expect(page.locator('.kpi-card', { hasText: /Capacidade/i })).toBeVisible();
    await expect(page.locator('.kpi-card', { hasText: /Alocação/i })).toBeVisible();
    await expect(page.locator('.kpi-card', { hasText: /Progresso/i })).toBeVisible();
  });

  test('KPI de capacidade deve mostrar valor do mock', async ({ page }) => {
    const capCard = page.locator('.kpi-card', { hasText: /Capacidade/i });
    // O mock no helpers.js define capacityTotal: 20
    await expect(capCard.locator('.kpi-val')).toHaveText('20h');
  });

  // ═══ TABS E MÓDULOS ═══
  test('modulo "sprint" deve estar ativo por padrão', async ({ page }) => {
    await expect(page.locator('#module-sprint')).toHaveClass(/active/);
  });

  test('mudar para aba "Eficiência" deve carregar painel correto', async ({ page }) => {
    // Clique na aba de Eficiência
    await page.click('.mod-tab[data-mod="eficiencia"]');
    await expect(page.locator('#module-eficiencia')).toHaveClass(/active/);
  });

  test('seção de acompanhamento de membros deve estar visível', async ({ page }) => {
    const membersSection = page.locator('#db-members');
    await expect(membersSection).toBeVisible();
  });
});
