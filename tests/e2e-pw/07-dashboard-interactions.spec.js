// @ts-check
import { test, expect } from '@playwright/test';
import { setupFullApp } from './helpers.js';

test.describe('07 — Dashboard Interactions (Ultimate Stability)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await setupFullApp(page);
    await page.waitForSelector('#panel-dashboard.active', { timeout: 10000 });
  });

  test('deve carregar lotes de 20 itens via Lazy Loading (Trigger Manual)', async ({ page }) => {
    // 1. Injetar 50 itens
    await page.evaluate(() => {
      const largeBacklog = Array.from({ length: 50 }, (_, i) => ({
        id: 3000 + i,
        title: `Big Task ${i}`,
        type: 'Story',
        state: 'Active',
        estimativa: 5,
        childRem: 2,
        fields: { 'System.WorkItemType': 'User Story', 'System.State': 'Active' }
      }));
      const data = window.APP.sprintData;
      data.backlog = largeBacklog;
      window.DashboardBuilderInstance.renderBacklog(data, false);
    });

    const rows = page.locator('#bl-tbody .bl-row');
    await expect(rows).toHaveCount(20);

    // 2. Disparar manualmente a intersecção no objeto IntersectionObserver mockado ou real
    // Como o sentinel existe, vamos forçar o appendBatch via DashboardBuilderInstance
    await page.evaluate(() => {
      window.DashboardBuilderInstance._appendBatch('bl-sentinel', 'bl-tbody');
    });

    // 3. Verificar se carregou mais 20 (Total 40)
    await expect(rows).toHaveCount(40);
  });

  test('deve resetar o scroll e re-renderizar ao ordenar por coluna', async ({ page }) => {
    await page.evaluate(() => {
      const data = window.APP.sprintData;
      data.backlog = [
        { id: 999, title: 'Zebra Task', state: 'Active', type: 'Story' },
        { id: 100, title: 'Alpha Task', state: 'Active', type: 'Story' }
      ];
      window.DashboardBuilderInstance.renderBacklog(data, false);
    });

    const thTitle = page.locator('th', { hasText: 'Título' });
    await thTitle.click();
    await page.waitForTimeout(500);

    const firstRowTitle = page.locator('#bl-tbody .bl-row td').nth(2);
    await expect(firstRowTitle).toContainText('Alpha Task');
  });

  test('trocar de time deve limpar os contêineres e mostrar skeletons/loaders', async ({ page }) => {
    await page.click('.mod-tab[data-mod="eficiencia"]');
    await page.waitForSelector('#module-eficiencia.active');

    // Trocar de time
    await page.locator('#db-team-btn').click();
    const betaItem = page.locator('.db-tmi', { hasText: 'Time Beta' });
    await betaItem.click();
    
    // Verificamos o loader que definimos em legacy.js (spinner) ou a mensagem de eficiência
    const efContent = page.locator('#ef-content');
    await expect(efContent).toContainText(/Selecione sprints/i, { timeout: 3000 });
  });
});
