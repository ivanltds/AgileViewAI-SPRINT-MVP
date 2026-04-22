/**
 * AgileViewAI - Main Entry Point (ESM)
 */

import './styles/index.css';
import { VaultUI } from './components/vault-ui.js';
import { NavigationUI } from './components/navigation-ui.js';
import { Dashboard } from './components/ui/dashboard.js';
import { DashboardBuilder } from './components/ui/dashboard-builder.js';
import { InsightsPanel } from './components/ui/insights-panel.js';
import { ProgressPanel } from './components/ui/progress-panel.js';
import { TrainingUI } from './components/ui/training-ui.js';
import { ChatUI } from './components/ui/chat.js';

// Core modules needed by legacy.js in hybrid mode
import { AppState } from './core/app-state.js';
import { Vault } from './core/vault.js';
import { Store } from './core/store.js';
import { AzureAPI } from './core/azure-api.js';

// Bridge to global scope for legacy compatibility
window.Vault = Vault;
window.Store = Store;
window.AzureAPI = AzureAPI;
window.Dashboard = Dashboard;
window.DashboardBuilder = DashboardBuilder;
window.InsightsPanel = InsightsPanel;
window.ProgressPanel = ProgressPanel;
window.VaultUI = VaultUI;
window.TrainingUI = TrainingUI;
window.ChatUI = ChatUI;

class AppOrchestrator {
  static bootstrap() {
    console.log('[App] Bootstrapping ESM components...');
    console.log('[App] LocalStorage Check:', { 
      auto: localStorage.getItem('avai_test_auto_session'),
      cache: !!localStorage.getItem('avai_sprint_cache')
    });
    VaultUI.init();
    NavigationUI.init();
    // Apenas inicializa se necessário ou se não houver listener pendente
    if (!window.TrainingUI.initialized) {
      TrainingUI.init();
      window.TrainingUI.initialized = true;
    }
    ChatUI.init();
    
    // Inicializa o Dashboard ESM
    const dashboardPanel = document.getElementById('panel-dashboard');
    if (dashboardPanel) {
      Dashboard.init(dashboardPanel);
    }

    // Auto-session for E2E Tests stability
    if (localStorage.getItem('avai_test_auto_session') === 'true') {
      window.AVAI_VAULT_KEY = 'e2e-test-key';
      console.log('[App] E2E Auto-session: Preset window.AVAI_VAULT_KEY');
    }
  }
}

// Global Event Listeners (Active as soon as ESM loads)
document.addEventListener('vault-unlocked', (e) => {
  console.log('[App] Vault unlocked! Beast Sync starting...');
  
  const mode = e.detail.mode;
  const key = e.detail.key;

  // 1. Forçar visibilidade
  const overlay = document.getElementById('vault-overlay');
  const appDiv = document.getElementById('app');
  if (overlay) overlay.style.display = 'none';
  if (appDiv) appDiv.style.display = 'flex';

  // 2. Sincronização agressiva com o objeto global legado e AppState
  AppState.vaultKey = key;
  if (window.APP) {
    window.APP.vaultMode = mode;
    window.APP.vaultKey = key;
    window.AVAI_VAULT_KEY = key; // Ponte global absoluta
    
    // Puxar os dados do Store AGORA
    if (window.Store) {
      const cache = window.Store.getSprintCache();
      if (cache) {
        window.APP.sprintData = cache;
        console.log('[App] Data synced to window.APP.sprintData');
      }
    }
  }
  
  console.log('[App] Vault key synced to window.AVAI_VAULT_KEY');

  // 3. Disparar launchApp legado
  if (window.launchApp) {
    console.log('[App] Triggering legacy launchApp...');
    window.launchApp();
  }
});

document.addEventListener('nav-changed', (e) => {
  const panelId = e.detail.panel; // Sincronizado com NavigationUI.js
  console.log('[App] Nav changed to:', panelId);
  if (panelId === 'dashboard') {
    Dashboard.render();
  }
});

// START
console.log('[App] Module loaded, starting bootstrap...');
AppOrchestrator.bootstrap();

// Event Guard logic
window.AVAI_READY = true;
if (window.AVAI_EVENTS && window.AVAI_EVENTS.length > 0) {
  console.log(`[App] Processing ${window.AVAI_EVENTS.length} queued events...`);
  window.AVAI_EVENTS.forEach(ev => {
    document.dispatchEvent(new CustomEvent('vault-unlocked', { detail: ev.detail }));
  });
  window.AVAI_EVENTS = [];
}
