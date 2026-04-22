// @ts-check
import { test, expect } from '@playwright/test';

test.describe('01 — Vault Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('deve exibir o overlay do vault na primeira carga', async ({ page }) => {
    const vault = page.locator('#vault-overlay');
    await expect(vault).toBeVisible();
    // App deve estar escondido
    const app = page.locator('#app');
    await expect(app).toBeHidden();
  });

  test('deve ter tabs PIN e Sessão', async ({ page }) => {
    await expect(page.locator('#tab-pin')).toBeVisible();
    await expect(page.locator('#tab-session')).toBeVisible();
    await expect(page.locator('#tab-pin')).toHaveClass(/active/);
  });

  test('PIN tab: deve mostrar input de PIN e botão Entrar', async ({ page }) => {
    await expect(page.locator('#vpin')).toBeVisible();
    await expect(page.locator('#vbtn')).toBeVisible();
    await expect(page.locator('#vbtn')).toHaveText('Criar vault');
  });

  test('Sessão: deve permitir continuar sem PIN', async ({ page }) => {
    await page.click('#tab-session');
    await expect(page.locator('#vault-session-area')).toBeVisible();
    const btn = page.locator('text=Continuar sem salvar tokens');
    await expect(btn).toBeVisible();
    await btn.click();
    // App deve aparecer
    await page.waitForSelector('#app', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#app')).toBeVisible();
    // Vault overlay deve sumir
    await expect(page.locator('#vault-overlay')).toBeHidden();
  });

  test('PIN: criar novo PIN e desbloquear', async ({ page }) => {
    const pinInput = page.locator('#vpin');
    await pinInput.fill('1234');
    await page.click('#vbtn');
    // Deve criar e desbloquear — app aparece
    await page.waitForSelector('#app', { state: 'visible', timeout: 5000 });
    await expect(page.locator('#app')).toBeVisible();
  });

  test('PIN: erro com PIN muito curto', async ({ page }) => {
    const pinInput = page.locator('#vpin');
    await pinInput.fill('12'); // menos de 4 dígitos
    await page.click('#vbtn');
    // Deve mostrar erro
    const err = page.locator('#verr');
    await expect(err).not.toBeEmpty();
  });
});
