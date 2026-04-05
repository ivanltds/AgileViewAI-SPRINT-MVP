/**
 * AgileViewAI Utils: Helpers
 * Funções auxiliares para formatação e mapeamento de UI.
 */

export const Helpers = {
  /**
   * Formata horas para exibição (ex: 8.5 -> "8,5h").
   */
  formatHours(h) {
    if (h === undefined || h === null) return '—';
    const val = typeof h === 'string' ? parseFloat(h) : h;
    return val.toLocaleString('pt-BR') + 'h';
  },

  /**
   * Gera iniciais de um nome (ex: "Ivan Lourenço" -> "IL").
   */
  initials(name) {
    if (!name) return '??';
    return name.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  },

  /**
   * Retorna a classe CSS correspondente ao estado do item.
   */
  statusClass(state) {
    if (!state) return '';
    const s = state.toLowerCase().replace(/\s/g, '');
    if (s.includes('done') || s.includes('concl') || s.includes('closed') || s.includes('resolv')) return 's-done';
    if (s.includes('prog') || s.includes('doing') || s.includes('activ')) return 's-doing';
    if (s.includes('todo') || s.includes('backlog') || s.includes('new')) return 's-todo';
    return 's-other';
  },

  /**
   * Verifica se um item está bloqueado.
   * @param {Object} item - Item do Azure DevOps.
   */
  blockStatus(item) {
    if (!item) return false;
    const fields = item.fields || {};
    
    // Campo padrão de bloqueio
    if (fields['Microsoft.VSTS.CMMI.Blocked'] === 'Yes' || fields['Custom.Blocked'] === 'Yes') return true;
    
    // Tags comuns
    const tags = fields['System.Tags'] || '';
    if (tags.toLowerCase().includes('bloqueado')) return true;
    
    return false;
  }
};
