/**
 * AgileViewAI UI Components: Dashboard
 * Orquestrador das abas de Sprint, Eficiência e Qualidade.
 */

import { KPICard } from './kpi-card.js';
import { DataTable } from './data-table.js';
import { InsightsPanel } from './insights-panel.js';
import { ProgressPanel } from './progress-panel.js';
import { Store } from '../../core/store.js';
import { DateUtils } from '../../utils/date.js';
import { Helpers } from '../../utils/helpers.js';

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
    // Escopo inicial: O container principal do dashboard já existe no index.html
    // Aqui gerenciamos as abas e o conteúdo dinâmico.
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
    
    // Atualizar Tabs
    document.querySelectorAll('.mod-tab').forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-mod') === mod);
    });

    this.renderModule();
    this.afterRender();
  },

  /**
   * Renderiza o conteúdo do módulo ativo.
   */
  renderModule() {
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    switch (this.activeMod) {
      case 'sprint':
        content.innerHTML = this.renderSprintView();
        break;
      case 'eficiencia':
        content.innerHTML = this.renderEficienciaView();
        break;
      case 'qualidade':
        content.innerHTML = this.renderQualidadeView();
        break;
      default:
        content.innerHTML = '<p>Módulo não encontrado.</p>';
    }
  },

  renderSprintView() {
    const backlog = Store.getBacklog();
    const insights = Store.getInsights();

    if (!backlog || backlog.length === 0) {
      return `
        <div class="mod-empty">
          <h3>Dados da Sprint</h3>
          <p>Clique em <strong>Sincronizar</strong> para carregar o backlog.</p>
        </div>
      `;
    }

    // Cálculos de KPI Reais
    const done = backlog.filter(i => i.fields['System.State'].toLowerCase().includes('done')).length;
    const blocked = backlog.filter(i => Helpers.blockStatus(i)).length;
    const total = backlog.length;
    const progress = Math.round((done / total) * 100) || 0;

    const kpis = [
      { label: 'Total Itens', value: total, sub: `${done} concluídos`, alert: false },
      { label: 'Em Progresso', value: total - done, sub: `${progress}% concluído`, alert: false },
      { label: 'Bloqueados', value: blocked, sub: 'Itens impedidos', alert: blocked > 0 }
    ];

    // Preparação de Dados para a Tabela
    const rows = backlog.map(item => ({
      ID: item.id,
      Título: item.fields['System.Title'],
      Status: item.fields['System.State'],
      Responsável: item.fields['System.AssignedTo']?.displayName || 'Sem dono',
      StatusClass: Helpers.statusClass(item.fields['System.State'])
    }));

    return `
      <div id="module-sprint">
        ${KPICard.renderGrid(kpis)}
        
        <div id="progress-area"></div>
        
        <div class="bl-table-title" style="padding: 16px 24px 8px; font-weight: 700; color: var(--slate);">Backlog da Sprint</div>
        ${DataTable.render({
          headers: ['ID', 'Título', 'Status', 'Responsável'],
          rows: rows,
          keys: ['ID', 'Título', 'Status', 'Responsável']
        })}

        <div id="insights-area" style="padding: 0 24px 24px;"></div>
      </div>
    `;
  },

  /**
   * Pós-renderização de módulos (para elementos que dependem de injeção no DOM)
   */
  afterRender() {
    if (this.activeMod === 'sprint') {
      const backlog = Store.getBacklog();
      
      const progressArea = document.getElementById('progress-area');
      if (progressArea) {
        ProgressPanel.render(progressArea, backlog, {});
      }
      
      const insightsArea = document.getElementById('insights-area');
      if (insightsArea) {
        InsightsPanel.render(insightsArea, Store.getInsights());
      }
    }

    if (this.activeMod === 'eficiencia') {
      const btnLoadEfi = document.getElementById('btn-load-eficiencia');
      if (btnLoadEfi) {
        btnLoadEfi.onclick = () => this.mockLoadEficiencia();
      }
    }

    if (this.activeMod === 'qualidade') {
      const btnLoadQua = document.getElementById('btn-load-qualidade');
      if (btnLoadQua) {
        btnLoadQua.onclick = () => this.mockLoadQualidade();
      }
    }
  },

  mockLoadEficiencia() {
    const btn = document.getElementById('btn-load-eficiencia');
    if(btn) btn.disabled = true;

    const content = document.getElementById('efi-content');
    content.innerHTML = `
      <div style="background:#fff; border:1px solid var(--border); border-radius:8px; padding:16px;">
        <h4 style="margin-bottom: 12px; color: var(--slate);">Throughput Histórico</h4>
        <canvas id="chart-throughput" height="80"></canvas>
      </div>
    `;

    import('./charts.js').then(({ Charts }) => {
       Charts.bar('chart-throughput', ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Atual'], [12, 19, 15, 17, 14], 'Itens Entregues');
       if(btn) btn.disabled = false;
    });
  },

  mockLoadQualidade() {
    const btn = document.getElementById('btn-load-qualidade');
    if(btn) btn.disabled = true;

    const content = document.getElementById('qua-content');
    content.innerHTML = `
      <div style="background:#fff; border:1px solid var(--border); border-radius:8px; padding:16px;">
        <h4 style="margin-bottom: 12px; color: var(--slate);">Bugs Identificados por Sprint</h4>
        <canvas id="chart-bugs" height="80"></canvas>
      </div>
    `;

    import('./charts.js').then(({ Charts }) => {
       Charts.bar('chart-bugs', ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Atual'], [5, 2, 4, 1, 3], 'Bugs');
       if(btn) btn.disabled = false;
    });
  },

  renderEficienciaView() {
    return `
      <div id="module-eficiencia" style="padding: 16px 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
          <div>
            <h3 style="color: var(--slate); margin-bottom:4px;">Análise de Eficiência</h3>
            <p style="font-size:12px; color:var(--gray);">Métricas calculadas com base nas iterações anteriores.</p>
          </div>
          <button class="btn btn-sm" id="btn-load-eficiencia" style="background:var(--blue); color:#fff; border-radius:4px; padding:8px 16px; border:none; font-weight:600; cursor:pointer;">Calcular Métricas Históricas</button>
        </div>
        
        <div id="efi-content">
          <div class="mod-empty" style="text-align:center; padding:40px; background:#fff; border-radius:8px; border:1px solid var(--border);">
            <p>Clique no botão acima para carregar as métricas de Eficiência e Throughput.</p>
          </div>
        </div>
      </div>
    `;
  },

  renderQualidadeView() {
    return `
      <div id="module-qualidade" style="padding: 16px 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
          <div>
            <h3 style="color: var(--slate); margin-bottom:4px;">Monitoramento de Qualidade</h3>
            <p style="font-size:12px; color:var(--gray);">Densidade de bugs, defeitos e tempo de resolução.</p>
          </div>
          <button class="btn btn-sm" id="btn-load-qualidade" style="background:var(--blue); color:#fff; border-radius:4px; padding:8px 16px; border:none; font-weight:600; cursor:pointer;">Analisar Qualidade</button>
        </div>
        
        <div id="qua-content">
          <div class="mod-empty" style="text-align:center; padding:40px; background:#fff; border-radius:8px; border:1px solid var(--border);">
            <p>Clique no botão acima para iniciar a análise de Qualidade.</p>
          </div>
        </div>
      </div>
    `;
  }
};

