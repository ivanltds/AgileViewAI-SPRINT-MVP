/**
 * AgileViewAI Utils: Date
 * Cálculos e formatação de datas (business days).
 */

export const DateUtils = {
  /**
   * Calcula dias úteis (seg-sex) entre hoje e a data de fim.
   * @param {string|Date} finishDate - Data de encerramento da sprint.
   */
  bizDaysLeft(finishDate) {
    if (!finishDate) return 0;
    const end = new Date(finishDate);
    const start = new Date();
    
    let count = 0;
    let cur = new Date(start.getTime());

    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  },

  /**
   * Formata data para "dd/mm" ou "dd/mm/aaaa".
   */
  formatDate(date, full = false) {
    if (!date) return '—';
    const d = new Date(date);
    // Forçamos UTC pois o Azure DevOps pode devolver T00:00:00Z dependendo da query
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    if (full) return `${day}/${month}/${d.getUTCFullYear()}`;
    return `${day}/${month}`;
  },

  /**
   * Verifica se uma data é no final de semana.
   */
  isWeekend(date) {
    const d = new Date(date);
    return d.getDay() === 0 || d.getDay() === 6;
  }
};
