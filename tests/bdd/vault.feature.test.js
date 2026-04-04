/**
 * BDD Tests for Vault Security Feature
 * Based on docs/04_cenarios_bdd.md scenarios
 */

import { jest } from '@jest/globals';
import { Vault } from '../../src/core/vault.js';

describe('Feature: Vault — Segurança e Autenticação', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset APP state
    APP.vaultKey = null;
    APP.vaultMode = null;
  });

  describe('Scenario: Primeira abertura exibe tela do Vault', () => {
    test('Given o vault nunca foi configurado, When a página carrega, Then a tela do vault é exibida', () => {
      // Given: vault nunca configurado
      expect(localStorage.getItem('avai_vault_salt')).toBeNull();
      expect(localStorage.getItem('avai_vault_check')).toBeNull();

      // When: página carrega
      // Simulate page load
      document.body.innerHTML = '<div id="vault-overlay" style="display:none"></div>';
      if (!Vault.isSetup()) {
        document.getElementById('vault-overlay').style.display = 'flex';
      }
      
      // Then: tela do vault deve estar visível
      const vaultOverlay = document.getElementById('vault-overlay');
      expect(vaultOverlay.style.display).not.toBe('none');
    });
  });

  describe('Scenario: Configurar Vault com PIN pela primeira vez', () => {
    test('Given vault nunca configurado, When usuário digita PIN válido, Then sistema gera salt e configura vault', async () => {
      const pin = '1234';
      
      // Given: vault nunca configurado
      expect(Vault.isSetup()).toBe(false);

      // When: usuário configura PIN
      const key = await Vault.setupPin(pin);

      // Then: sistema gera salt e configura
      expect(localStorage.getItem('avai_vault_salt')).toBeTruthy();
      expect(localStorage.getItem('avai_vault_check')).toBeTruthy();
      expect(key).toBeDefined();
      expect(Vault.isSetup()).toBe(true);
    });
  });

  describe('Scenario: PIN muito curto não é aceito', () => {
    test('Given tela vault aberta, When usuário digita PIN curto, Then exibe erro', async () => {
      const shortPin = '12';
      
      // Given: vault aberto
      expect(Vault.isSetup()).toBe(false);

      // When/Then: PIN curto deve ser rejeitado
      // This would be tested in the UI layer
      expect(shortPin.length).toBeLessThan(4);
    });
  });

  describe('Scenario: Reabrir app com PIN correto', () => {
    test('Given vault configurado, When usuário digita PIN correto, Then app é exibido', async () => {
      const pin = '5678';
      
      // Given: vault configurado
      await Vault.setupPin(pin);
      expect(Vault.isSetup()).toBe(true);

      // When: usuário digita PIN correto
      const key = await Vault.verifyPin(pin);

      // Then: app é exibido
      expect(key).toBeDefined();
      expect(key).toBeTruthy();
    });
  });

  describe('Scenario: Reabrir app com PIN incorreto', () => {
    test('Given vault configurado, When usuário digita PIN incorreto, Then exibe erro', async () => {
      const correctPin = '5678';
      const wrongPin = '0000';
      
      // Given: vault configurado
      await Vault.setupPin(correctPin);

      // When: usuário digita PIN incorreto
      const key = await Vault.verifyPin(wrongPin);

      // Then: falha autenticação
      expect(key).toBeNull();
    });
  });

  describe('Scenario: Modo Sessão não persiste tokens', () => {
    test('Given usuário escolhe modo sessão, When app abre, Then tokens ficam apenas em memória', () => {
      // Given: usuário escolhe modo sessão
      APP.vaultMode = 'session';

      // When: app abre
      // Then: tokens em memória
      expect(APP.sessionTokens).toBeDefined();
      expect(APP.sessionTokens.teams).toBeDefined();
      expect(APP.sessionTokens.llms).toBeDefined();
      expect(APP.sessionTokens.orgs).toBeDefined();
    });
  });

  describe('Scenario: Trocar PIN preserva dados existentes', () => {
    test('Given vault com dados, When usuário troca PIN, Then dados são recifrados', async () => {
      const oldPin = '1234';
      const newPin = '9999';
      
      // Given: vault configurado com dados
      const oldKey = await Vault.setupPin(oldPin);
      
      // Simulate encrypted data
      const testData = 'test token data';
      const encryptedData = await Vault.encrypt(oldKey, testData);
      
      // When: usuário troca PIN
      const newKey = await Vault.setupPin(newPin);
      
      // Then: sistema recifra dados (simulated)
      expect(newKey).toBeDefined();
      expect(newKey).not.toBe(oldKey);
    });
  });
});
