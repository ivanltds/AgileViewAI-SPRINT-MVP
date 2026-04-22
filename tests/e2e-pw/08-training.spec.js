// @ts-check
import { test, expect } from '@playwright/test';
import { setupFullApp } from './helpers.js';

test.describe('08 — Training / RAG', () => {
  test.beforeEach(async ({ page }) => {
    await setupFullApp(page);
    await page.click('#nav-rag');
    // Esperar o painel principal estar ativo e visível
    await page.waitForSelector('#panel-rag.active', { timeout: 10000 });
  });

  test('painel de treinamento deve estar visível', async ({ page }) => {
    await expect(page.locator('#panel-rag')).toHaveClass(/active/);
    await expect(page.locator('h2:has-text("Gestão de Treinamento")')).toBeVisible();
  });

  test('deve ter 4 tabs de treinamento', async ({ page }) => {
    await expect(page.locator('#ttab-contextos')).toBeVisible();
    await expect(page.locator('#ttab-feedback')).toBeVisible();
    await expect(page.locator('#ttab-conversas')).toBeVisible();
    await expect(page.locator('#ttab-agentes')).toBeVisible();
  });

  test('tab contextos deve estar ativa por padrão', async ({ page }) => {
    await expect(page.locator('#ttab-contextos')).toHaveClass(/active/);
    await expect(page.locator('#tt-contextos')).toHaveClass(/active/);
  });

  test('deve ter botão "+ Novo contexto"', async ({ page }) => {
    const contextPanel = page.locator('#tt-contextos');
    await expect(contextPanel).toBeVisible();
    
    // Usar seletor mais flexível para o botão
    const btn = contextPanel.locator('button', { hasText: 'Novo contexto' });
    await expect(btn).toBeVisible();
  });

  test('deve abrir modal de treinamento', async ({ page }) => {
    const btn = page.locator('#tt-contextos').locator('button', { hasText: 'Novo contexto' });
    await btn.click();
    await expect(page.locator('#modal-rag')).toHaveClass(/open/);
  });

  test('deve criar um novo contexto RAG', async ({ page }) => {
    const btn = page.locator('#tt-contextos').locator('button', { hasText: 'Novo contexto' });
    await btn.click();
    
    await page.fill('#rf-spec', 'Sprint de 2 semanas com daily às 9h');
    await page.click('#modal-rag .btn-blue');
    
    await expect(page.locator('#modal-rag')).not.toHaveClass(/open/);
    await expect(page.locator('#rag-list')).toContainText('Sprint de 2 semanas');
  });

  test('trocar para tab de Feedback deve mostrar perfil de conhecimento', async ({ page }) => {
    const tab = page.locator('#ttab-feedback');
    await tab.click();
    await expect(tab).toHaveClass(/active/);
    
    const fbPanel = page.locator('#tt-feedback');
    await expect(fbPanel).toHaveClass(/active/);
    
    // Verificar se o container de conteúdo foi preenchido
    const content = fbPanel.locator('#tt-feedback-content');
    await expect(content).toBeVisible({ timeout: 10000 });
    
    // Deve conter o box de perfil (renderizado pelo TrainingUI.js)
    await expect(content).toContainText(/Perfil de Conhecimento/i);
    await expect(content.locator('.badge')).toBeVisible();
  });

  test('trocar para tab de Conversas deve listar conversas mockadas', async ({ page }) => {
    await page.click('#ttab-conversas');
    const convPanel = page.locator('#tt-conversas');
    await expect(convPanel).toHaveClass(/active/);
    
    // Verificar se o card da conversa mockada apareceu (injetada no helpers.js)
    const convCard = convPanel.locator('.conv-card');
    await expect(convCard.first()).toBeVisible({ timeout: 5000 });
    await expect(convCard.first()).toContainText('Mock Chat');
  });
});
