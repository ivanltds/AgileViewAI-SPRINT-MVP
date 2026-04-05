import { KPICard } from '../../src/components/ui/kpi-card.js';
import { DataTable } from '../../src/components/ui/data-table.js';

describe('UI Components: KPI Card & Data Table', () => {

  describe('KPICard', () => {
    it('deve renderizar um card individual com layout correto', () => {
      const html = KPICard.render({ label: 'Total Itens', value: 10, sub: '5 concluídos', alert: false });
      expect(html).toContain('Total Itens');
      expect(html).toContain('10');
      expect(html).toContain('5 concluídos');
      expect(html).not.toContain('color: var(--red)'); // Sem alerta
    });

    it('deve aplicar estilo de alerta se prop alert for true', () => {
      const html = KPICard.render({ label: 'Bloqueados', value: 2, sub: 'Impedidos', alert: true });
      expect(html).toContain('kpi-card alert');
    });

    it('deve renderizar um grid com múltiplos cards', () => {
      const kpis = [
        { label: 'K1', value: 1, sub: 'S1', alert: false },
        { label: 'K2', value: 2, sub: 'S2', alert: true }
      ];
      const html = KPICard.renderGrid(kpis);
      expect(html).toContain('kpi-grid');
      expect(html).toContain('K1');
      expect(html).toContain('K2');
      expect(html).toContain('kpi-card alert'); // Card 2 tem alerta
    });
  });

  describe('DataTable', () => {
    it('deve renderizar uma tabela vazia sem erros', () => {
      const html = DataTable.render({ headers: ['ID'], rows: [], keys: ['ID'] });
      expect(html).toContain('<tbody></tbody>');
    });

    it('deve renderizar a tabela com cabeçalhos ordenáveis e as linhas mapeadas', () => {
      const config = {
        headers: ['ID', 'Status'],
        rows: [
          { ID: '100', Status: 'Done' },
          { ID: '101', Status: 'To Do' }
        ],
        keys: ['ID', 'Status']
      };
      const html = DataTable.render(config);
      
      // Cabeçalhos
      expect(html).toContain('ID</th>');
      expect(html).toContain('Status</th>');
      expect(html).toContain('DataTable.sort(this)');
      
      // Linhas / Dados
      expect(html).toContain('100');
      expect(html).toContain('101');
    });
  });

});
