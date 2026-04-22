// @ts-check
import { test, expect } from '@playwright/test';
import { goToApp } from './helpers.js';

test.describe('03 — Teams CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.click('#nav-teams');
    await page.waitForSelector('#panel-teams.active', { timeout: 5000 });
  });

  test('deve mostrar botão "+ Novo time"', async ({ page }) => {
    const btn = page.locator('text=+ Novo time');
    await expect(btn).toBeVisible();
  });

  test('deve abrir modal ao clicar em Novo time', async ({ page }) => {
    await page.click('text=+ Novo time');
    await expect(page.locator('#modal-team')).toHaveClass(/open/);
    await expect(page.locator('#team-modal-title')).toHaveText('Novo time');
  });

  test('deve criar um novo time', async ({ page }) => {
    await page.click('text=+ Novo time');
    await page.fill('#tf-name', 'Time Backend');
    await page.fill('#tf-org', 'MinhaOrg');
    await page.fill('#tf-proj', 'MeuProjeto');
    await page.fill('#tf-team', 'Time de Backend');
    await page.fill('#tf-pat', 'fake-pat-token-12345');
    await page.click('#modal-team .btn-blue');

    // Modal deve fechar
    await expect(page.locator('#modal-team')).not.toHaveClass(/open/);
    // Time deve aparecer na lista
    await expect(page.locator('#teams-list')).toContainText('Time Backend');
  });

  test('deve ativar um time e mudar para Dashboard', async ({ page }) => {
    // Primeiro criar time
    await page.click('text=+ Novo time');
    await page.fill('#tf-name', 'Time Teste');
    await page.fill('#tf-org', 'Org Teste');
    await page.fill('#tf-proj', 'Proj Teste');
    await page.fill('#tf-team', 'Time Teste Azure');
    await page.fill('#tf-pat', 'fake-token');
    await page.click('#modal-team .btn-blue');
    await page.waitForTimeout(500);

    // Ativar o time
    const activateBtn = page.locator('.team-card').filter({ hasText: 'Time Teste' }).locator('text=Ativar');
    await activateBtn.click();

    // O sistema agora navega para o Dashboard automaticamente
    await page.waitForSelector('#panel-dashboard.active', { timeout: 5000 });
    
    // E o time no topbar deve ser o "Time Teste" (com timeout extendido para sync)
    const teamName = page.locator('#db-team-btn-name');
    await expect(teamName).toHaveText('Time Teste', { timeout: 10000 });
  });

  test('deve deletar um time', async ({ page }) => {
    // Criar time
    await page.click('text=+ Novo time');
    await page.fill('#tf-name', 'Time Deletar');
    await page.fill('#tf-org', 'Org Del');
    await page.fill('#tf-proj', 'Proj Del');
    await page.fill('#tf-team', 'Time Del Azure');
    await page.fill('#tf-pat', 'fake');
    await page.click('#modal-team .btn-blue');
    await page.waitForTimeout(500);

    // Verificar que aparece
    await expect(page.locator('#teams-list')).toContainText('Time Deletar');

    // Clicar em Excluir (com confirmação)
    page.on('dialog', dialog => dialog.accept());
    const deleteBtn = page.locator('.team-card').filter({ hasText: 'Time Deletar' }).locator('text=Excluir');
    await deleteBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('#teams-list')).not.toContainText('Time Deletar');
  });
});

test.describe('03b — Organizações CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.click('#nav-teams');
  });

  test('deve mostrar botão "+ Nova organização"', async ({ page }) => {
    const btn = page.locator('text=+ Nova organização');
    await expect(btn.first()).toBeVisible();
  });

  test('deve criar organização', async ({ page }) => {
    await page.click('button:has-text("+ Nova organização")');
    await page.fill('#of-name', 'MegaCorp');
    await page.fill('#of-pat', 'org-pat-123');
    await page.click('#modal-org .btn-blue');
    
    await expect(page.locator('#modal-org')).not.toHaveClass(/open/);
    await expect(page.locator('#orgs-list')).toContainText('MegaCorp');
  });
});
