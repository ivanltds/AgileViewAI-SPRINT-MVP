/**
 * AgileViewAI UI Components: Charts
 * Wrapper para Chart.js (Carregado globalmente via CDN no index.html).
 */

export const Charts = {
  /**
   * Renderiza um gráfico básico.
   * @param {string} canvasId - ID do elemento <canvas>.
   * @param {Object} config - Configuração completa do Chart.js.
   */
  render(canvasId, config) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    
    // Destruir instância anterior se existir
    const existing = window.Chart.getChart(ctx);
    if (existing) existing.destroy();

    return new window.Chart(ctx, config);
  },

  /**
   * Template para gráfico de barras (Sprint Progress).
   */
  bar(canvasId, labels, data, label = 'Progresso') {
    return this.render(canvasId, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: data,
          backgroundColor: '#257DD9',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
};
