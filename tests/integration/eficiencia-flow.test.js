import { jest } from '@jest/globals';
import { EficienciaService } from '../../src/services/eficiencia.js';
import { Store } from '../../src/core/store.js';
import { AzureAPI } from '../../src/core/azure-api.js';

describe('Integration: Eficiência Module Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    global.fetch = jest.fn();
    
    // Configura o Store com um time e org de teste
    const mockOrg = { id: 'org-1', name: 'Minha Org', patEnc: 'enc-pat' };
    const mockTeam = { id: 'team-1', name: 'Meu Time', orgId: 'org-1', proj: 'MeuProj', azTeam: 'MeuAzTeam' };
    
    jest.spyOn(Store, 'getOrgs').mockReturnValue([mockOrg]);
    jest.spyOn(Store, 'getTeams').mockReturnValue([mockTeam]);
    jest.spyOn(Store, 'getActiveTeamId').mockReturnValue('team-1');
  });

  test('Deve processar o fluxo completo de cálculo de eficiência para o time ativo', async () => {
    // 1. Mock das iterações do time
    const mockIterations = [
      { path: 'Iter 1', attributes: { finishDate: new Date().toISOString() } },
      { path: 'Iter 2', attributes: { finishDate: new Date(Date.now() - 30 * 86400000).toISOString() } }
    ];
    
    // 2. Mock dos Work Items vinculados às iterações
    const mockWorkItems = [
      { 
        id: 101, 
        fields: { 
          'System.State': 'Done', 
          'System.IterationPath': 'Iter 1',
          'System.CreatedDate': '2024-01-01',
          'Microsoft.VSTS.Common.ClosedDate': '2024-01-05'
        } 
      },
      { 
        id: 102, 
        fields: { 
          'System.State': 'Done', 
          'System.IterationPath': 'Iter 2',
          'System.CreatedDate': '2024-01-01',
          'Microsoft.VSTS.Common.ClosedDate': '2024-01-11'
        } 
      }
    ];

    // Spy nas chamadas da API
    const spyFetch = jest.spyOn(AzureAPI, '_fetch').mockImplementation(async (url) => {
       if (url.includes('wiql')) return { workItems: [{id: 101}, {id: 102}] };
       if (url.includes('revisions')) return { value: [] };
       return { value: [] };
    });
    
    jest.spyOn(AzureAPI, 'getWorkItemsBatch').mockResolvedValue(mockWorkItems);

    // 3. Execução do serviço usando dados do Store
    const activeTeam = Store.getTeams().find(t => t.id === Store.getActiveTeamId());
    
    const result = await EficienciaService.calculateMetrics({
      org: activeTeam.org,
      proj: activeTeam.proj,
      team: activeTeam.azTeam,
      pat: 'fake-pat',
      periodMonths: 3,
      allIterations: mockIterations,
      currentCapacity: {}
    });

    // 4. Verificações de Integração
    expect(result.avgThroughput).toBe(1); // 2 itens / 2 iteracoes
    expect(result.avgLeadTime).toBe(7);    // (4d + 10d) / 2 = 7d
    expect(result.iterLabels).toContain('Iter 1');
    expect(result.iterLabels).toContain('Iter 2');
    
    // Verifica se a API de WIQL foi chamada com a query correta (múltiplas iterações via OR)
    const wiqlCall = spyFetch.mock.calls.find(c => c[1]?.body?.includes('SELECT'));
    expect(wiqlCall[1].body).toContain('Iter 1');
    expect(wiqlCall[1].body).toContain('Iter 2');
  });
});
