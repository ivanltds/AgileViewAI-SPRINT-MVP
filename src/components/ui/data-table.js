/**
 * AgileViewAI UI Components: Data Table
 * Tabelas flexíveis com suporte a ordenação automática.
 */

export const DataTable = {
  /**
   * Renderiza uma tabela de dados completa.
   * @param {Object} props - Propriedades da tabela.
   * @param {Array<string>} props.headers - Lista de cabeçalhos.
   * @param {Array<Object>} props.rows - Lista de linhas (cada linha é um objeto).
   * @param {Array<string>} props.keys - Chaves dos objetos para mapear nas colunas.
   * @returns {string} - HTML string da tabela.
   */
  render({ headers, rows, keys, className = 'bl-table' }) {
    const headHtml = headers.map(h => `<th class="sort-th" onclick="DataTable.sort(this)">${h}</th>`).join('');
    
    const rowsHtml = rows.map(row => {
      const cells = keys.map(k => `<td>${row[k] !== undefined ? row[k] : '—'}</td>`).join('');
      return `<tr class="bl-row">${cells}</tr>`;
    }).join('');

    return `
      <div class="${className}-wrap">
        <table class="${className}">
          <thead><tr>${headHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  },

  /**
   * Lógica de ordenação (inspirada no monolito original).
   * @param {HTMLElement} th - O elemento <th> clicado.
   */
  sort(th) {
    const table = th.closest('table');
    const tbody = table.querySelector('tbody');
    const ths   = Array.from(th.closest('tr').querySelectorAll('th'));
    const col   = ths.indexOf(th);
    const isAsc = th.dataset.sort !== 'asc';

    // Limpar estados anteriores
    ths.forEach(t => {
      delete t.dataset.sort;
      t.classList.remove('th-sort-asc', 'th-sort-desc');
    });

    // Definir novo estado
    th.dataset.sort = isAsc ? 'asc' : 'desc';
    th.classList.add(isAsc ? 'th-sort-asc' : 'th-sort-desc');

    const getValue = td => {
      if (!td) return '';
      const txt = td.textContent.trim();
      const num = parseFloat(txt.replace(/[^\d.-]/g, ''));
      return isNaN(num) ? txt.toLowerCase() : num;
    };

    const compare = (a, b) => {
      const va = getValue(a.querySelectorAll('td')[col]);
      const vb = getValue(b.querySelectorAll('td')[col]);
      
      if (typeof va === 'number' && typeof vb === 'number') {
        return isAsc ? va - vb : vb - va;
      }
      return isAsc 
        ? String(va).localeCompare(String(vb), 'pt', { numeric: true }) 
        : String(vb).localeCompare(String(va), 'pt', { numeric: true });
    };

    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort(compare);
    
    // Re-inserir as linhas ordenadas
    rows.forEach(r => tbody.appendChild(r));
  }
};

// Tornar global para os eventos inline (onclick no HTML gerado)
window.DataTable = DataTable;
