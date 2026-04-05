/**
 * AgileViewAI UI Components: Insights Panel
 * Exibe diagnósticos e recomendações da IA.
 */

import { InsightsService } from '../../services/insights.js';

export const InsightsPanel = {
  /**
   * Renderiza a seção de insights no container fornecido.
   * @param {Element} container - O elemento de destino.
   * @param {Array<Object>} insights - Lista de insights brutos.
   */
  render(container, insights = []) {
    if (!insights || insights.length === 0) {
      container.innerHTML = `
        <div class="insights-section">
          <div class="ins-header"><div class="ins-title">Insights da IA</div></div>
          <p style="font-size: 13px; color: var(--gray);">Clique em sincronizar para gerar novos insights.</p>
        </div>
      `;
      return;
    }

    const cardsHtml = insights.map(ins => this.renderCard(ins)).join('');

    container.innerHTML = `
      <div class="insights-section" id="insights-container">
        <div class="ins-header">
          <div class="ins-title">Insights da IA</div>
          <div class="ins-subtitle" style="font-size: 11px; color: var(--gray);">${insights.length} observações encontradas</div>
        </div>
        <div class="ins-grid">
           ${cardsHtml}
        </div>
      </div>
    `;
  },

  /**
   * Renderiza um card individual de insight.
   */
  renderCard(ins) {
    const severityMap = {
      critical: { icon: '🚨', border: '#dc2626', bg: '#fef2f2' },
      warning: { icon: '⚠️', border: '#d97706', bg: '#fffbeb' },
      info: { icon: 'ℹ️', border: '#1d4ed8', bg: '#eff6ff' },
      ok: { icon: '✅', border: '#16a34a', bg: '#f0fdf4' }
    };

    const style = severityMap[ins.severity] || severityMap.info;

    return `
      <div class="ins-card" style="border-left: 4px solid ${style.border}; background: ${style.bg};">
        <div class="ins-head">
          <span class="ins-icon">${style.icon}</span>
          <span class="ins-title2">${ins.title}</span>
          <button class="ins-rm" title="Remover">×</button>
        </div>
        <div class="ins-body">${ins.body}</div>
        <div class="ins-fb-bar">
          <div class="ins-fb-hint">Este insight foi útil?</div>
          <button class="ins-fb-btn" onclick="Toast.show('Obrigado pelo feedback!')">👍</button>
          <button class="ins-fb-btn">👎</button>
        </div>
      </div>
    `;
  }
};
