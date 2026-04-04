/**
 * Test Setup for AgileViewAI BDD Tests
 * Configures global test environment and mocks
 */

import { jest } from '@jest/globals';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key(index) {
      return Object.keys(store)[index] || null;
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

import { webcrypto } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

Object.defineProperty(global, 'crypto', {
  value: webcrypto
});

Object.defineProperty(global, 'TextEncoder', { value: TextEncoder });
Object.defineProperty(global, 'TextDecoder', { value: TextDecoder });

// Mock DOM elements
document.body.innerHTML = `
  <div id="vault-overlay" style="display:none">
    <div class="vbox">
      <input type="text" id="vault-pin" class="vinput" />
      <button id="vault-submit" class="vbtn">Entrar</button>
      <div id="vault-error" class="verr"></div>
    </div>
  </div>
  <div id="app" style="display:none">
    <div id="sidebar"></div>
    <div id="main-content"></div>
  </div>
`;

// Global APP state mock
global.APP = {
  vaultKey: null,
  vaultMode: null,
  sprintData: null,
  insightCards: [],
  syncRunning: false,
  allIterations: [],
  eficienciaData: null,
  efChartMode: { flow: 'throughput', time: 'lead' },
  qualidadeData: null,
  qualTipo: 'ambos',
  qualEstado: 'aberto',
  qualSeverity: 'todas',
  sessionTokens: { teams: {}, llms: {}, orgs: {} },
  chatConvId: null,
  chatMessages: []
};

// Mock Vault module removido, agora os testes importarão a versão real.

// Mock Store removido para utilização do SUT autêntico instanciado do source code.

// Mock AzureAPI removido para utilização do módulo autêntico.

// Setup Vault Mocks removidos para utilização do SUT autêntico.

// Global test utilities
global.testUtils = {
  createMockTeam: (overrides = {}) => ({
    id: 'team-' + Date.now(),
    name: 'Test Team',
    team: 'TestTeam',
    project: 'TestProject',
    orgId: 'org-1',
    ...overrides
  }),
  
  createMockOrg: (overrides = {}) => ({
    id: 'org-' + Date.now(),
    name: 'Test Organization',
    patEnc: 'encrypted-pat',
    ...overrides
  }),
  
  createMockSprintData: (overrides = {}) => ({
    iterations: [],
    workItems: [],
    capacity: { teamMembers: [] },
    lastSync: new Date().toISOString(),
    ...overrides
  })
};
