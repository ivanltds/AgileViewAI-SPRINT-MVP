// @ts-check
import { test, expect } from '@playwright/test';
import { setupFullApp } from './helpers.js';

test.describe('12 — Store Resilience & Quota Handling', () => {
  test.beforeEach(async ({ page }) => {
    await setupFullApp(page);
    await page.waitForSelector('.bl-row', { timeout: 15000 });
  });

  test('deve manter o funcionamento do Dashboard mesmo se o localStorage falhar (QuotaExceeded)', async ({ page }) => {
    // 1. Simular falha catastrófica de quota no localStorage
    await page.evaluate(() => {
      // @ts-ignore
      localStorage.setItem = () => {
        const err = new Error('Quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      };
      console.log('E2E: localStorage.setItem agora lança QuotaExceededError');
    });

    // 2. Tentar salvar novos dados via Store
    await page.evaluate(() => {
      const data = window.Store.getSprintCache();
      data.syncedAt = '2099-01-01T12:00:00Z'; // Dado ultra-futurista para teste
      window.Store.saveSprintCache(data);
    });

    // 3. Verificar que o Dashboard reflete a mudança (vindo da memória)
    // Procuramos por '2099' no topbar info
    const topbarInfo = page.locator('#db-topbar-info');
    await expect(topbarInfo).toContainText(/2099/);

    // 4. Verificar via Store diagnostic que estamos em memória
    // Use window.Store.getStorageStatus()
    const status = await page.evaluate(() => window.Store.getStorageStatus());
    expect(status.memKeys).toContain('avai_sprint_cache');
  });

  test('deve otimizar o tamanho dos dados antes de salvar (Data Culling)', async ({ page }) => {
    await page.evaluate(() => {
      const data = window.Store.getSprintCache();
      // Injetamos dados pesados
      data.backlog[0]._raw = 'A'.repeat(1000); 
      data.backlog[0].metadata = { extra: 'stuff' };
      window.Store.saveSprintCache(data);
    });

    // Ao recuperar, os campos pesados devem ter sumido
    const savedData = await page.evaluate(() => window.Store.getSprintCache());
    expect(savedData.backlog[0]._raw).toBeUndefined();
    expect(savedData.backlog[0].metadata).toBeUndefined();
  });
});
