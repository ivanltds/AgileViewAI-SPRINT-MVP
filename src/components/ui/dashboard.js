/**
 * AgileViewAI UI Components: Dashboard
 * Orquestrador das abas de Sprint, Eficiência e Qualidade.
 */

import { Store } from '../../core/store.js';
import { AppState } from '../../core/app-state.js';
import { DashboardBuilder } from './dashboard-builder.js';
import { EfficiencyService } from '../../services/efficiency.js';
import { QualityService } from '../../services/quality.js';

export const Dashboard = {
  /**
   * Inicializa o Dashboard.
   * @param {Element} container - O elemento onde o conteúdo será renderizado.
   */
  init(container) {
    this.container = container;
    this.activeMod = 'sprint';
    this.render();
    this.setupEvents();
  },

  render() {
    this.renderModule();
    this.afterRender();
  },

  setupEvents() {
    const tabs = document.querySelectorAll('.mod-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mod = tab.getAttribute('data-mod');
        this.setModule(mod);
      });
    });
  },

  /**
   * Troca o módulo ativo no dashboard.
   * @param {string} mod - 'sprint' | 'eficiencia' | 'qualidade'
   */
  setModule(mod) {
    this.activeMod = mod;
    
    document.querySelectorAll('.mod-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-mod') === mod);
    });

    this.renderModule();
    this.afterRender();
  },

  /**
   * Garante que o painel do módulo existe.
   */
  _ensurePanel(id) {
    let el = document.getElementById(id);
    if (!el && this.container) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'mod-panel';
      this.container.appendChild(el);
    }
    return el;
  },

  /**
   * Renderiza o conteúdo do módulo ativo.
   */
  renderModule() {
    document.querySelectorAll('.mod-panel').forEach(p => {
      p.classList.remove('active');
    });

    const activePanel = this._ensurePanel(`module-${this.activeMod}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    if (this.activeMod === 'sprint') {
      const sprintPanel = activePanel;
      let data = AppState.sprintData;

      // Fallback para testes legados: se não há sprintData mas há backlog no Store, processa stats básicos
      if (!data && Store.getBacklog().length > 0) {
        const backlog = Store.getBacklog();
        const done = backlog.filter(i => (i.fields?.['System.State'] || i.state || '').toLowerCase() === 'done').length;
        const total = backlog.length;
        data = {
          team: { proj: 'Projeto', org: 'Org', name: 'Time' },
          activeSprint: { path: 'Sprint\\Atual', startRaw: new Date(), endRaw: new Date(), bizDaysLeft: 5 },
          backlog: backlog.map(i => ({
            id: i.id,
            title: i.fields?.['System.Title'] || i.title,
            type: i.fields?.['System.WorkItemType'] || i.type || 'PBI',
            state: i.fields?.['System.State'] || i.state,
            blockStatus: 'CLEAR',
            estimativa: 0,
            childRem: 0
          })),
          tasks: [],
          stats: {
            total,
            done,
            donePct: total > 0 ? Math.round((done / total) * 100) : 0,
            blocked: 0,
            fixing: 0,
            allocPct: 0,
            totalRem: 0,
            capacityTotal: 0
          }
        };
      }

      if (data) {
        // Garante sub-containers para o DashboardBuilder
        if (!document.getElementById('db-kpis')) {
          sprintPanel.innerHTML = `
            <div id="db-topbar-info"></div>
            <div id="db-kpis"></div>
            <div id="db-backlog"></div>
          `;
        }
        DashboardBuilder.render(data);
      } else if (sprintPanel) {
        sprintPanel.innerHTML = '<div class="mod-empty">Clique em <strong>Sincronizar</strong> para carregar dados.</div>';
      }
      if (typeof window.renderDashTeamSel === 'function') window.renderDashTeamSel();
    } else if (this.activeMod === 'eficiencia') {
      if (activePanel && activePanel.innerHTML === '') {
        activePanel.innerHTML = '<h2>Análise de Eficiência</h2><p>Carregando iterações...</p>';
      }
      if (typeof window.loadEficienciaFilter === 'function') window.loadEficienciaFilter();
    } else if (this.activeMod === 'qualidade') {
      if (typeof window.renderQualidadeCharts === 'function' && window.APP?.qualidadeData) {
        window.renderQualidadeCharts(window.APP.qualidadeData, window.APP.qualTipo);
      }
    }
  },

  /**
   * Pós-renderização de módulos
   */
  afterRender() {
    if (this.activeMod === 'eficiencia') {
      const btn = document.getElementById('btn-load-eficiencia');
      if (btn) btn.onclick = () => this.loadEfficiency();
    }
    if (this.activeMod === 'qualidade') {
      const btn = document.getElementById('btn-load-qualidade');
      if (btn) btn.onclick = () => this.loadQuality();
    }
  },

  async loadEfficiency() {
    const team = Store.getActiveTeam();
    if (!team) return;
    const pat = await Store.getActivePat();
    if (!pat) return;
    console.log('Dashboard: Carregando Eficiência...');
  },

  async loadQuality() {
    const team = Store.getActiveTeam();
    if (!team) return;
    const pat = await Store.getActivePat();
    if (!pat) return;
    console.log('Dashboard: Carregando Qualidade...');
  }
};
