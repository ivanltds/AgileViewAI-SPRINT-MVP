/**
 * AgileViewAI UI Components: KPI Card
 * Exibe métricas de forma visual e intuitiva.
 */

export const KPICard = {
  /**
   * Renderiza um cartão de KPI.
   * @param {Object} props - Propriedades do cartão.
   * @param {string} props.label - Título da métrica (ex: "Concluídos").
   * @param {string|number} props.value - Valor principal.
   * @param {string} [props.sub] - Texto de apoio ou detalhamento.
   * @param {boolean} [props.alert] - Se true, aplica estilo de erro/alerta.
   * @returns {string} - HTML string do componente.
   */
  render({ label, value, sub = '', alert = false }) {
    return `
      <div class="kpi-card ${alert ? 'alert' : ''}">
        <div class="kpi-label">${label}</div>
        <div class="kpi-val">${value}</div>
        ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
      </div>
    `;
  },

  /**
   * Renderiza uma grade de cartões.
   * @param {Array<Object>} cards - Lista de objetos de configuração de cards.
   * @returns {string} - HTML string da grade.
   */
  renderGrid(cards) {
    return `
      <div class="kpi-grid">
        ${cards.map(c => this.render(c)).join('')}
      </div>
    `;
  }
};
