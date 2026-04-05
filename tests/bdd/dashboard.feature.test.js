/**
 * Feature: Dashboard
 * Garante que os componentes de dados se comportem corretamente diante das ações do usuário
 */

import { Dashboard } from '../../src/components/ui/dashboard.js';
import { Store } from '../../src/core/store.js';

describe('Feature: Dashboard Visualisation', () => {

  beforeEach(() => {
    // Setup DOm para o Dashboard
    document.body.innerHTML = `
      <div id="dashboard-content"></div>
      <button class="mod-tab" data-mod="sprint">Sprint</button>
      <button class="mod-tab" data-mod="eficiencia">Eficiencia</button>
    `;
    Dashboard.init(document.getElementById('dashboard-content'));
  });

  describe('Scenario: Usuário vê painel vazio ao iniciar sem sincronização', () => {
    it('deve exibir state vazio inicial', () => {
      Store.setBacklog([]); // Simula store vazio
      Dashboard.render();
      const content = document.getElementById('dashboard-content').innerHTML;
      expect(content).toContain('Clique em <strong>Sincronizar</strong>');
    });
  });

  describe('Scenario: Usuário carrega backlog da sprint', () => {
    it('deve calcular KPIs e tabelas de acordo com os tickets', () => {
      const fakeBacklog = [
        { id: '1', fields: { 'System.Title': 'T1', 'System.State': 'Done' } },
        { id: '2', fields: { 'System.Title': 'T2', 'System.State': 'To Do' } }
      ];
      Store.setBacklog(fakeBacklog);
      Dashboard.render();

      const html = document.getElementById('dashboard-content').innerHTML;
      // 1 concluído de 2
      expect(html).toContain('1 concluídos');
      expect(html).toContain('50% concluído');
    });
  });

  describe('Scenario: Navegação entre abas de indicadores', () => {
    it('deve chavear para a aba de eficiência quando clicada', () => {
      Dashboard.setModule('eficiencia');
      const html = document.getElementById('dashboard-content').innerHTML;
      expect(html).toContain('Análise de Eficiência');
    });
  });

});
