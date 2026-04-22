import { DashboardBuilder } from '../../src/components/ui/dashboard-builder.js';

describe('Dashboard Interactions: Lazy Loading & Sorting', () => {
  let mockData;

  beforeEach(() => {
    // Mock do DOM necessário para o DashboardBuilder
    document.body.innerHTML = '<div id="db-backlog"></div>';
    
    // Mock de dados com 50 itens (mais que o lote de 20)
    mockData = {
      team: 'Alpha',
      backlog: Array.from({ length: 50 }, (_, i) => ({
        id: 1000 + i,
        title: `Task ${String(50 - i).padStart(2, '0')}`, // Títulos 50 -> 01 para testar sort
        type: i % 2 === 0 ? 'Feature' : 'Bug',
        state: 'Doing',
        estimativa: 10,
        childRem: 5
      }))
    };
    
    // Resetar o estado do DashboardBuilder para cada teste
    DashboardBuilder._fullItems = null;
    DashboardBuilder._lazyData = null;
    if (window.DashboardBuilderInstance) delete window.DashboardBuilderInstance;
    window.DashboardBuilderInstance = DashboardBuilder;

    // Mock do IntersectionObserver (não disponível no JSDOM)
    global.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  test('deve renderizar inicialmente apenas o primeiro lote de 20 itens (Lazy Loading)', () => {
    DashboardBuilder.renderBacklog(mockData, false);
    
    const tbody = document.getElementById('bl-tbody');
    const rows = tbody.querySelectorAll('.bl-row'); // Contar apenas linhas principais
    
    expect(rows.length).toBe(20);
    expect(DashboardBuilder._fullItems.length).toBe(50);
  });

  test('deve ordenar o backlog completo por Título (Data-Driven Sorting)', () => {
    DashboardBuilder.renderBacklog(mockData, false);
    
    const th = document.createElement('th');
    th.textContent = 'Título';
    const tr = document.createElement('tr');
    tr.appendChild(document.createElement('th')); 
    tr.appendChild(document.createElement('th')); 
    tr.appendChild(th); 
    
    DashboardBuilder.sortBacklog(th);
    
    const firstTitle = document.querySelector('#bl-tbody .bl-row td:nth-child(3)').textContent.trim();
    expect(firstTitle).toBe('Task 01'); 
  });

  test('deve ordenar IDs numericamente e não como string', () => {
    mockData.backlog[0].id = 9999;
    DashboardBuilder.renderBacklog(mockData, false);
    
    const thId = document.createElement('th');
    thId.textContent = 'ID';
    const tr = document.createElement('tr');
    tr.appendChild(document.createElement('th')); 
    tr.appendChild(thId); 
    
    DashboardBuilder.sortBacklog(thId);
    
    const cell = document.querySelector('#bl-tbody .bl-row td:nth-child(2)');
    const text = cell ? cell.textContent.trim() : 'NULL';
    
    const firstId = parseInt(text.replace('#', ''));
    expect(firstId).toBe(1001); 
  });

  test('não deve sobrescrever _fullItems se a renderização for fruto de um sort (isSortResult)', () => {
    DashboardBuilder.renderBacklog(mockData, false);
    const originalItemsCount = DashboardBuilder._fullItems.length;
    
    // Chamar render novamente simulando um sort com um subconjunto
    DashboardBuilder.renderBacklog({ backlog: [], team: 'Alpha' }, false, true);
    
    expect(DashboardBuilder._fullItems.length).toBe(originalItemsCount);
  });
});
