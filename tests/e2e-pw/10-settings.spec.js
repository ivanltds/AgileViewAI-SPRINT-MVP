// @ts-check
import { test, expect } from '@playwright/test';
import { goToApp, setupFullApp } from './helpers.js';

test.describe('10 — Settings', () => {
  test.beforeEach(async ({ page }) => {
    await goToApp(page);
    await page.click('#nav-settings');
  });

  test('painel de configurações deve estar visível', async ({ page }) => {
    await expect(page.locator('#panel-settings')).toHaveClass(/active/);
    await expect(page.locator('text=Configurações')).toBeVisible();
  });

  test('deve ter seção Vault', async ({ page }) => {
    await expect(page.locator('#panel-settings')).toContainText('Vault');
    await expect(page.locator('#panel-settings')).toContainText('Modo de armazenamento');
  });

  test('deve ter seção Dados', async ({ page }) => {
    await expect(page.locator('#panel-settings')).toContainText('Dados');
    await expect(page.locator('#panel-settings')).toContainText('Exportar configurações');
    await expect(page.locator('#panel-settings')).toContainText('Importar configurações');
    await expect(page.locator('#panel-settings')).toContainText('Apagar tudo');
  });

  test('botão Exportar JSON deve estar visível', async ({ page }) => {
    const btn = page.locator('text=Exportar JSON');
    await expect(btn).toBeVisible();
  });

  test('botão Importar JSON deve estar visível', async ({ page }) => {
    const btn = page.locator('text=Importar JSON');
    await expect(btn).toBeVisible();
  });

  test('botão Limpar vault deve estar visível', async ({ page }) => {
    const btn = page.locator('text=Limpar vault');
    await expect(btn).toBeVisible();
  });

  test('botão Apagar tudo deve estar visível', async ({ page }) => {
    const btn = page.locator('text=Apagar tudo');
    await expect(btn).toBeVisible();
  });

  test('botão Alterar PIN deve estar visível', async ({ page }) => {
    const btn = page.locator('text=Alterar PIN').first();
    await expect(btn).toBeVisible();
  });

  test('vault mode desc deve mostrar o modo atual', async ({ page }) => {
    const desc = page.locator('#vault-mode-desc');
    await expect(desc).toBeVisible();
    const text = await desc.textContent();
    // Deve mostrar "sessão" ou "PIN" ou "—"
    expect(text.length).toBeGreaterThan(0);
  });
});

test.describe('11 — Download Dashboard HTML', () => {
  test.beforeEach(async ({ page }) => {
    await setupFullApp(page);
    await page.waitForTimeout(1000);
  });

  test('botão de download HTML deve estar visível', async ({ page }) => {
    const btn = page.locator('text=↓ HTML');
    await expect(btn).toBeVisible();
  });

  test('botão de sincronizar deve estar visível', async ({ page }) => {
    const btn = page.locator('text=↺ Sincronizar');
    await expect(btn).toBeVisible();
  });
});
