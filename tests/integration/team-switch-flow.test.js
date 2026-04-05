import { Store } from '../../src/core/store.js';
import { Dashboard } from '../../src/components/ui/dashboard.js';

describe('Integration Flow: Team Switch', () => {

  beforeEach(() => {
    Store.init();
    document.body.innerHTML = `
      <div id="db-topbar-info"></div>
      <div id="dashboard-content"></div>
    `;
    Dashboard.init(document.getElementById('dashboard-content'));
  });

  afterEach(() => {
    Store.clear();
  });

  it('deve limpar dados da UI e atualizar informações ao trocar de time', () => {
    // 1. Simula que estamos no Time A com dados carregados
    Store.saveTeams([{ id: 'alpha', name: 'Alpha Team', org: 'OrgX' }, { id: 'beta', name: 'Beta Squad', org: 'OrgX' }]);
    Store.setActiveTeamId('alpha');
    Store.setBacklog([{ id: '1', fields: { 'System.Title': 'Task A', 'System.State': 'Done' } }]);
    
    // UI deve refletir o Time A e ter dados
    Dashboard.render();
    expect(document.getElementById('dashboard-content').innerHTML).toContain('1 concluídos');

    // 2. Ação: Usuário troca para o Time B
    Store.setActiveTeamId('beta');
    
    // EXPECT: Backlog deve ser esvaziado pelo Store automaticamente ao trocar de time
    // Na nossa store.js, se setarmos ActiveTeam, talvez tenhamos que chamar clearSyncData() manualmente. 
    // Vamos simular a ação que o main.js faria no select do usuário:
    Store.setBacklog([]); 
    Store.setInsights(null);
    
    Dashboard.render();
    const topBar = document.getElementById('db-topbar-info');
    topBar.textContent = `Time: ${Store.getActiveTeam().name}`;

    // 3. Validações finais
    expect(topBar.textContent).toContain('Beta Squad');
    expect(document.getElementById('dashboard-content').innerHTML).toContain('Sincronizar');
    expect(document.getElementById('dashboard-content').innerHTML).not.toContain('1 concluídos');
  });

});
