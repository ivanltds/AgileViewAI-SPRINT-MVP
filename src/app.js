/**
 * AgileViewAI - Main Entry Point (ESM)
 * Orquestrador da Interface e Fluxo de Dados.
 */

import { VaultUI } from './components/ui/vault.js';
import { Sidebar } from './components/ui/sidebar.js';
import { Toast } from './components/ui/toast.js';
import { Dashboard } from './components/ui/dashboard.js';
import { ChatUI } from './components/ui/chat.js';
import { Store } from './core/store.js';
import { AppState } from './core/app-state.js';
import { SprintService } from './services/sprint.js';
import { EfficiencyService } from './services/efficiency.js';
import { QualityService } from './services/quality.js';
import { LLMService } from './services/llm.js';

// Estado Global da UI
export const UI = {
  panels: ['dashboard', 'teams', 'llm', 'rag', 'settings', 'eficiencia', 'qualidade'],
  activePanel: 'dashboard'
};

/**
 * Inicialização da Aplicação
 */
async function bootstrap() {
  console.log('AgileViewAI: Inicializando aplicação modular...');

  const vaultContainer = document.getElementById('vault-overlay');
  
  // 1. Iniciando o Vault UI
  VaultUI.init(vaultContainer, (mode) => {
    // Callback disparada quando o Vault é desbloqueado
    console.log(`Vault desbloqueado via ${mode}.`);
    launchApp();
  });

  // Exportar funções necessárias para o contexto global (compatibilidade com HTML legado)
  window.showPanel = showPanel;
  window.handleSync = handleSync;
}

/**
 * Lançamento do App após autenticação
 */
export function launchApp() {
  const vaultOverlay = document.getElementById('vault-overlay');
  const appContainer = document.getElementById('app');

  // Efeito de transição suave
  if (vaultOverlay) {
    vaultOverlay.style.opacity = '0';
    setTimeout(() => {
      vaultOverlay.style.display = 'none';
      if (appContainer) {
        appContainer.style.display = 'flex';
        appContainer.style.opacity = '1';
      }
    }, 300);
  }

  // 2. Inicializando a Sidebar
  const sidebarContainer = document.getElementById('sidebar');
  if (sidebarContainer) {
    Sidebar.init(sidebarContainer, (panelId) => {
      showPanel(panelId);
    });
  }

  // 3. Inicializando Mobile Nav
  initMobileNav();

  // 4. Inicializando o Dashboard
  const dashboardContent = document.getElementById('dashboard-content');
  if (dashboardContent) {
    Dashboard.init(dashboardContent);
  }

  // 5. Configurando troca de abas do Dashboard
  initDashboardTabs();

  // 6. Inicializando o Chat Flutuante
  ChatUI.init();

  // 7. Configurando Sincronização
  const syncBtn = document.getElementById('btn-sync');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => handleSync());
  }

  Toast.show('Bem-vindo ao AgileViewAI!', 'ok');
  
  // Renderiza dados iniciais via funções legadas (que agora buscam do Store modular)
  refreshLegacyUI();

  // Carregamento inicial de cache
  loadInitialData();
}

/**
 * Atualiza a UI legada (configurações)
 */
function refreshLegacyUI() {
  if (typeof window.renderTeams === 'function') window.renderTeams();
  if (typeof window.renderOrgList === 'function') window.renderOrgList();
  if (typeof window.renderLlmList === 'function') window.renderLlmList();
  if (typeof window.renderRagList === 'function') window.renderRagList();
  if (typeof window.renderDashTeamSel === 'function') window.renderDashTeamSel();
}

/**
 * Gerenciamento de Troca de Painéis
 */
export function showPanel(panelId) {
  if (!UI.panels.includes(panelId)) return;

  const panels = document.querySelectorAll('.panel');
  panels.forEach(p => {
    p.classList.toggle('active', p.id === `panel-${panelId}`);
  });

  UI.activePanel = panelId;
  console.log(`Navegação: ${panelId}`);
  
  Sidebar.setActive(panelId);
  
  if (panelId === 'dashboard') {
    Dashboard.render();
  }
}

/**
 * Inicialização das Tabs do Dashboard
 */
function initDashboardTabs() {
  const tabs = document.querySelectorAll('.mod-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mod = tab.getAttribute('data-mod');
      Dashboard.setModule(mod);
    });
  });
}

/**
 * Navegação Mobile Bottom Nav
 */
function initMobileNav() {
  const mbnItems = document.querySelectorAll('.mbn-item');
  mbnItems.forEach(item => {
    item.addEventListener('click', () => {
      const panel = item.getAttribute('data-panel');
      mbnItems.forEach(i => i.classList.toggle('active', i === item));
      showPanel(panel);
    });
  });
}

/**
 * Lógica de Sincronização de Dados (Novo SprintService)
 */
async function handleSync() {
  const activeTeam = Store.getActiveTeam();
  if (!activeTeam) {
    Toast.show('Selecione um time nas configurações primeiro.', 'warn');
    showPanel('teams');
    return;
  }

  Toast.show('Sincronizando com Azure DevOps...', 'warn', 30000);
  AppState.syncRunning = true;
  const syncBtn = document.getElementById('btn-sync');
  if (syncBtn) syncBtn.disabled = true;

  try {
    // 1. Sincronização via SprintService
    const data = await SprintService.sync();
    
    // 2. Gerar Insights Automáticos via LLMService
    Toast.show('Gerando insights inteligentes...', 'warn', 15000);
    
    const activeLlm = Store.getActiveLlm();
    if (activeLlm) {
      const token = await Store.getActiveLlmToken();
      if (token) {
        // Prompt simplificado para geração
        const userPrompt = `DADOS DA SPRINT:\n${JSON.stringify(data.stats)}\n\nBACKLOG:\n${JSON.stringify(data.backlog.slice(0,20))}`;
        const insightsRaw = await LLMService.runAgentChain(activeLlm.provider, token, userPrompt);
        try {
          const insights = JSON.parse(insightsRaw);
          Store.setInsights(insights);
        } catch (e) {
          console.warn('Falha ao parsear insights da IA:', e);
        }
      }
    }

    // 3. Atualizar UI
    Dashboard.render();
    Toast.show('Sincronização concluída!', 'ok');
  } catch (error) {
    console.error('Erro na sincronização:', error);
    Toast.show(`Erro: ${error.message}`, 'err');
  } finally {
    AppState.syncRunning = false;
    if (syncBtn) syncBtn.disabled = false;
  }
}

/**
 * Carregamento de dados iniciais do cache
 */
function loadInitialData() {
  const cache = Store.getSprintCache();
  if (cache) {
    AppState.sprintData = cache;
    Dashboard.render();
  }
}

// Iniciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', bootstrap);
