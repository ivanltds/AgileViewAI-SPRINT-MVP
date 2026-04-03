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

// Mock crypto API for Vault tests
const cryptoMock = {
  subtle: {
    importKey: jest.fn(),
    deriveKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn()
  },
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  })
};

Object.defineProperty(global, 'crypto', {
  value: cryptoMock
});

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

// Mock Vault module
global.Vault = {
  deriveKey: jest.fn(),
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  getSalt: jest.fn(),
  isSetup: jest.fn(),
  setupPin: jest.fn(),
  verifyPin: jest.fn(),
  encryptToken: jest.fn(),
  decryptToken: jest.fn(),
  reencryptAll: jest.fn()
};

// Mock Store module
global.Store = {
  _g: jest.fn(),
  _s: jest.fn(),
  getTeams: jest.fn(),
  saveTeams: jest.fn(),
  getOrgs: jest.fn(),
  saveOrgs: jest.fn(),
  getLlmList: jest.fn(),
  saveLlmList: jest.fn(),
  getRagList: jest.fn(),
  saveRagList: jest.fn(),
  getChatConvs: jest.fn(),
  saveChatConvs: jest.fn(),
  getInsightFeedback: jest.fn(),
  saveInsightFeedback: jest.fn(),
  getUserProfile: jest.fn(),
  saveUserProfile: jest.fn(),
  getSprintCache: jest.fn(),
  saveSprintCache: jest.fn(),
  getActiveTeamId: jest.fn(),
  setActiveTeamId: jest.fn(),
  getActiveTeam: jest.fn(),
  getActivePat: jest.fn(),
  getActiveLlm: jest.fn(),
  getActiveLlmToken: jest.fn(),
  getActiveRag: jest.fn(),
  getAgentPrompts: jest.fn(),
  saveAgentPrompts: jest.fn()
};

// Mock AzureAPI module
global.AzureAPI = {
  _fetch: jest.fn(),
  _auth: jest.fn(),
  _encTeam: jest.fn(),
  getIterations: jest.fn(),
  getTeamCapacity: jest.fn(),
  getWorkItemIds: jest.fn()
};

// Setup default implementations
Store._g.mockImplementation((key, defaultValue = []) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
});

Store._s.mockImplementation((key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
});

Store.getTeams.mockImplementation(() => Store._g('avai_teams', []));
Store.saveTeams.mockImplementation((teams) => Store._s('avai_teams', teams));
Store.getOrgs.mockImplementation(() => Store._g('avai_orgs', []));
Store.saveOrgs.mockImplementation((orgs) => Store._s('avai_orgs', orgs));
Store.getSprintCache.mockImplementation(() => Store._g('avai_sprint_cache', null));
Store.saveSprintCache.mockImplementation((cache) => Store._s('avai_sprint_cache', cache));
Store.getActiveTeamId.mockImplementation(() => localStorage.getItem('avai_active_team') || null);
Store.setActiveTeamId.mockImplementation((id) => localStorage.setItem('avai_active_team', id));
Store.getActiveTeam.mockImplementation(() => {
  const id = Store.getActiveTeamId();
  const teams = Store.getTeams();
  return id ? teams.find(t => t.id === id) || null : null;
});

AzureAPI._encTeam.mockImplementation((team) => {
  return team.split(' ').map(encodeURIComponent).join('%20');
});

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
