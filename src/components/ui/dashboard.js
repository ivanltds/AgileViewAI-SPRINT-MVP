/**
 * AgileViewAI - Dashboard Component (ESM)
 */

import { AppState } from '../../core/app-state.js';
import { Store } from '../../core/store.js';
import { DashboardBuilder } from './dashboard-builder.js';

export const Dashboard = {
  init(container) {
    this.container = container;
    this.activeMod = 'sprint';
    
    console.log('[Dashboard] Initializing...');
    this.render();
    this.setupEvents();

    // Reage instantaneamente a novas sincronizações de dados
    Store.on('update:avai_sprint_cache', () => {
      console.log('[Dashboard] Sprint cache updated, re-rendering...');
      this.render();
    });
  },

  render() {
    this.renderModule();
  },

  setupEvents() {
    // Eventos de troca de abas (Sprint/Historico/etc)
    document.querySelectorAll('.mod-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mod-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeMod = tab.dataset.mod;
        this.render();
      });
    });
  },

  renderModule() {
    console.log('[Dashboard] Rendering module:', this.activeMod);
    const cache = Store.getSprintCache();
    
    // 1. Mostrar/Esconder os painéis via classe 'active'
    document.querySelectorAll('.mod-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('module-' + this.activeMod);
    if (panel) panel.classList.add('active');

    // 2. Lógica específica por módulo
    if (this.activeMod === 'sprint') {
      const activeTeam = Store.getActiveTeam();
      const isLoading = !cache || !cache.team || !cache.stats || Object.keys(cache.stats).length === 0;
      
      if (isLoading) {
        if (activeTeam) {
          DashboardBuilder.render({ team: activeTeam, stats: {} });
        } else {
          // If no active team, show a refined empty state
          // We check for db-no-data to avoid overwriting if legacy wants to show it
          const elNoData = document.getElementById('db-no-data');
          if (elNoData) {
            elNoData.style.display = '';
            // Hide other dynamic parts
            ['db-kpis', 'db-progress', 'db-members', 'db-backlog', 'db-insights'].forEach(id => {
              const el = document.getElementById(id);
              if (el) el.innerHTML = '';
            });
          } else {
            panel.innerHTML = '<div class="mod-empty"><div class="mod-empty-icon">⚠️</div><h3>Nenhum time ativo</h3><p>Selecione um time no menu superior ou na aba Times.</p></div>';
          }
        }
        return;
      }

      // Merge active team into cache data to ensure Topbar is up-to-date
      // even if cache belongs to previous team
      const mergedData = { ...cache, team: activeTeam || cache.team };
      DashboardBuilder.render(mergedData);
    } else if (this.activeMod === 'eficiencia') {
      if (window.runEficiencia) window.runEficiencia();
    } else if (this.activeMod === 'qualidade') {
      if (window.runQualidade) window.runQualidade();
    }
  }
};
