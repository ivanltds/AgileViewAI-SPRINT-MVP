// @ts-check
import { test, expect } from '@playwright/test';
import { setupFullApp } from './helpers.js';

test.describe('11 — Dashboard Member Filtering & Colors (TDD)', () => {
  test.beforeEach(async ({ page }) => {
    await setupFullApp(page);
    await page.waitForSelector('.mbr-table', { timeout: 15000 });
  });

  test('deve filtrar gestores da lista principal e exibi-los apenas no acompanhamento', async ({ page }) => {
    const membersTable = page.locator('.mbr-table tbody');
    await expect(membersTable).not.toContainText('Carlos Mendes');
    await expect(membersTable).not.toContainText('Ana Lima');
    await expect(membersTable).toContainText('João Silva');
    await expect(membersTable).toContainText('Maria Santos');
    
    const trackingList = page.locator('.tracking-list');
    await expect(trackingList).toContainText('Carlos Mendes');
    await expect(trackingList).toContainText('Ana Lima');
    await expect(trackingList).not.toContainText('João Silva');
  });

  test('deve exibir estatísticas individuais corretas para cada membro', async ({ page }) => {
    const joaoRow = page.locator('.mbr-row', { hasText: 'João Silva' });
    await expect(joaoRow).toContainText('20% alocado');
    await expect(joaoRow).toContainText('(4h / 20h)');
    
    const mariaRow = page.locator('.mbr-row', { hasText: 'Maria Santos' });
    await expect(mariaRow).toContainText('0% alocado');
    await expect(mariaRow).toContainText('(0h / 10h)');
  });

  test('deve aplicar as cores corretas seguindo as novas faixas de limite', async ({ page }) => {
    // Regras:
    // 1-70%: Amarelo (#f59e0b)
    // 71-100%: Verde (#10b981)
    // >100%: Vermelho (#ef4444)
    
    // Injetamos um estado customizado para testar as faixas
    await page.evaluate(() => {
      const data = window.Store.getSprintCache();
      data.capacity['João Silva'] = { capRest: 10, activity: 'Dev' }; // 10h total
      data.capacity['Maria Santos'] = { capRest: 10, activity: 'QA' };  // 10h total
      data.capacity['Pedro Costa'] = { capRest: 10, activity: 'UX' };  // 10h total
      
      data.tasks = [
        // João: 5h / 10h = 50% (Deve ser AMARELO)
        { id: 9001, assignedTo: 'João Silva', remaining: 5, state: 'Active' },
        // Maria: 8.5h / 10h = 85% (Deve ser VERDE)
        { id: 9002, assignedTo: 'Maria Santos', remaining: 8.5, state: 'Active' },
        // Pedro: 11h / 10h = 110% (Deve ser VERMELHO)
        { id: 9003, assignedTo: 'Pedro Costa', remaining: 11, state: 'Active' }
      ];
      
      // Salva no Store e renderiza
      window.Store.saveSprintCache(data);
      window.Dashboard.render();
    });

    // Validar João (50% -> Amarelo #f59e0b)
    const joaoRow = page.locator('.mbr-row', { hasText: 'João Silva' });
    const joaoBar = joaoRow.locator('.dist-bar-fill');
    await expect(joaoBar).toHaveAttribute('style', /background:\s*#f59e0b/i);

    // Validar Maria (85% -> Verde #10b981)
    const mariaRow = page.locator('.mbr-row', { hasText: 'Maria Santos' });
    const mariaBar = mariaRow.locator('.dist-bar-fill');
    await expect(mariaBar).toHaveAttribute('style', /background:\s*#10b981/i);

    // Validar Pedro (110% -> Vermelho #ef4444)
    const pedroRow = page.locator('.mbr-row', { hasText: 'Pedro Costa' });
    const pedroBar = pedroRow.locator('.dist-bar-fill');
    await expect(pedroBar).toHaveAttribute('style', /background:\s*#ef4444/i);
  });
});
