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
import { AzureAPI } from './core/azure-api.js';
import { InsightsService } from './services/insights.js';
import { EficienciaService } from './services/eficiencia.js';
import { QualidadeService } from './services/qualidade.js';

// Estado Global da UI
const UI = {
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
}

/**
 * Lançamento do App após autenticação
 */
function launchApp() {
  const vaultOverlay = document.getElementById('vault-overlay');
  const appContainer = document.getElementById('app');

  // Efeito de transição suave
  vaultOverlay.style.opacity = '0';
  setTimeout(() => {
    vaultOverlay.style.display = 'none';
    appContainer.style.display = 'flex';
    appContainer.style.opacity = '1';
  }, 300);

  // 2. Inicializando a Sidebar
  const sidebarContainer = document.getElementById('sidebar');
  Sidebar.init(sidebarContainer, (panelId) => {
    showPanel(panelId);
  });

  // 3. Inicializando Mobile Nav (se existir)
  initMobileNav();

  // 4. Inicializando o Dashboard (Módulo Padrão)
  const dashboardContent = document.getElementById('dashboard-content');
  if (dashboardContent) {
    Dashboard.init(dashboardContent);
  }

  // 5. Configurando troca de abas do Dashboard (Mod-Tabs)
  initDashboardTabs();

  // 6. Inicializando o Chat Flutuante
  ChatUI.init();

  // 7. Configurando Sincronização
  const syncBtn = document.getElementById('btn-sync');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => handleSync());
  }

  Toast.show('Bem-vindo ao AgileViewAI!', 'ok');
  
  // Carregamento inicial (ex: carregar times)
  loadInitialData();
}

/**
 * Gerenciamento de Troca de Painéis
 */
function showPanel(panelId) {
  if (!UI.panels.includes(panelId)) return;

  const panels = document.querySelectorAll('.panel');
  panels.forEach(p => {
    p.classList.toggle('active', p.id === `panel-${panelId}`);
  });

  UI.activePanel = panelId;
  console.log(`Navegação: ${panelId}`);
  
  // Notificar Sidebar se a troca foi disparada por outro lugar (ex: mobile nav)
  Sidebar.setActive(panelId);
  
  // Se voltou para o dashboard, garantir o estado correto (opcional)
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
      
      // Update visual state of mobile buttons
      mbnItems.forEach(i => i.classList.toggle('active', i === item));
      
      showPanel(panel);
    });
  });
}

/**
 * Lógica de Sincronização de Dados
 */
async function handleSync() {
  const activeTeam = Store.getActiveTeam();
  if (!activeTeam) {
    Toast.show('Selecione um time nas configurações primeiro.', 'warn');
    showPanel('teams');
    return;
  }

  Toast.show('Sincronizando com Azure DevOps...', 'warn', 10000);
  const syncBtn = document.getElementById('btn-sync');
  if (syncBtn) syncBtn.disabled = true;

  try {
    // 1. Buscar Backlog e Configurações da Iteração
    const backlog = await AzureAPI.getBacklog(activeTeam.org, activeTeam.project, activeTeam.team, activeTeam.iteration);
    
    // 2. Armazenar no Store
    Store.setBacklog(backlog);
    
    // 3. Gerar Insights Automáticos via IA
    Toast.show('Gerando insights inteligentes...', 'warn', 5000);
    const insights = await InsightsService.generate(backlog);
    Store.setInsights(insights);

    // 4. Atualizar UI
    Dashboard.render();
    Dashboard.afterRender();
    Toast.show('Dados sincronizados com sucesso!', 'ok');
  } catch (error) {
    console.error('Erro na sincronização:', error);
    Toast.show('Erro ao sincronizar. Verifique seus tokens.', 'err');
  } finally {
    if (syncBtn) syncBtn.disabled = false;
  }
}

/**
 * Carregamento de dados iniciais
 */
function loadInitialData() {
  const activeTeam = Store.getActiveTeam();
  if (activeTeam) {
    const infoEl = document.getElementById('db-topbar-info');
    if (infoEl) infoEl.textContent = `Time: ${activeTeam.name} | Org: ${activeTeam.org}`;
    
    // Se já existem dados no store, renderizar
    if (Store.getBacklog().length > 0) {
      Dashboard.render();
      Dashboard.afterRender();
    }
  }
}

// Iniciar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', bootstrap);
