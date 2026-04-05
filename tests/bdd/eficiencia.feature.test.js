import { jest } from '@jest/globals';
import { EficienciaService } from '../../src/services/eficiencia.js';
import { AzureAPI } from '../../src/core/azure-api.js';

describe('BDD: Módulo Eficiência (Multi-sprint)', () => {
  const mockAllIterations = [
    { path: 'S1', attributes: { finishDate: new Date().toISOString() } },
    { path: 'S2', attributes: { finishDate: new Date(Date.now() - 30 * 86400000).toISOString() } },
    { path: 'S3', attributes: { finishDate: new Date(Date.now() - 60 * 86400000).toISOString() } },
    { path: 'S4', attributes: { finishDate: new Date(Date.now() - 120 * 86400000).toISOString() } }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  /**
   * Scenario: Seleção rápida de 3 meses
   */
  test('Cenário: Seleção rápida de 3 meses filtra iterações corretamente', async () => {
    // Given o time tem sprints dos últimos 6 meses (mockAllIterations contém sprints de 0, 30, 60 e 120 dias atrás)
    // When o usuário solicita cálculo de 3 meses (90 dias)
    const spyFetch = jest.spyOn(AzureAPI, '_fetch').mockResolvedValue({ workItems: [] });
    jest.spyOn(AzureAPI, 'getWorkItemsBatch').mockResolvedValue([]);

    await EficienciaService.calculateMetrics({
      org: 'o', proj: 'p', team: 't', pat: 'px',
      periodMonths: 3,
      allIterations: mockAllIterations,
      currentCapacity: {}
    });

    // Then as sprints com finishDate >= (hoje - 90 dias) são selecionadas (S1, S2, S3)
    // O WIQL deve conter S1, S2 e S3, mas não S4
    const wiqlCall = spyFetch.mock.calls.find(c => c[1]?.body?.includes('SELECT'));
    const query = JSON.parse(wiqlCall[1].body).query;
    
    expect(query).toContain("UNDER 'S1'");
    expect(query).toContain("UNDER 'S2'");
    expect(query).toContain("UNDER 'S3'");
    expect(query).not.toContain("UNDER 'S4'");
  });

  /**
   * Scenario: Cálculo de métricas de eficiência
   */
  test('Cenário: Cálculo de métricas de eficiência (Throughput, Lead/Cycle Time)', async () => {
    // Given 2 sprints selecionadas com itens Done
    const mockItems = [
      { id:1, fields: { 'System.State':'Done', 'System.IterationPath':'S1', 'System.CreatedDate':'2024-01-01', 'Microsoft.VSTS.Common.ClosedDate':'2024-01-11' } }, // LT=10
      { id:2, fields: { 'System.State':'Done', 'System.IterationPath':'S2', 'System.CreatedDate':'2024-01-01', 'Microsoft.VSTS.Common.ClosedDate':'2024-01-06' } }  // LT=5
    ];

    jest.spyOn(AzureAPI, '_fetch').mockResolvedValue({ workItems: [{id:1}, {id:2}] });
    jest.spyOn(AzureAPI, 'getWorkItemsBatch').mockResolvedValue(mockItems);
    jest.spyOn(EficienciaService, 'getWorkItemRevisions').mockResolvedValue([]);

    // When o módulo de eficiência processa
    const result = await EficienciaService.calculateMetrics({
      org: 'o', proj: 'p', team: 't', pat: 'px',
      periodMonths: 3,
      allIterations: mockAllIterations,
      currentCapacity: {}
    });

    // Then: Throughput médio = 1 item/sprint (2 itens / 2 sprints)
    expect(result.avgThroughput).toBe(1);
    // Lead Time médio = 7.5 dias
    expect(result.avgLeadTime).toBe(7.5);
  });

  /**
   * Scenario: Tempo por coluna identifica gargalo
   */
  test('Cenário: Tempo por coluna identifica gargalo no board', async () => {
    // Given itens que passaram mais tempo em uma coluna específica
    const mockItems = [{ id:1, fields: { 'System.State':'Done', 'System.IterationPath':'S1' } }];
    const mockRevisions = [
      { fields: { 'System.BoardColumn': 'Dev', 'System.ChangedDate': '2024-01-01T00:00:00Z' } },
      { fields: { 'System.BoardColumn': 'QA',  'System.ChangedDate': '2024-01-02T00:00:00Z' } }, // Dev = 1d
      { fields: { 'System.BoardColumn': 'Done','System.ChangedDate': '2024-01-10T00:00:00Z' } }  // QA = 8d
    ];

    jest.spyOn(AzureAPI, '_fetch').mockResolvedValue({ workItems: [{id:1}] });
    jest.spyOn(AzureAPI, 'getWorkItemsBatch').mockResolvedValue(mockItems);
    jest.spyOn(EficienciaService, 'getWorkItemRevisions').mockResolvedValue(mockRevisions);

    // When o módulo de eficiência renderiza os dados
    const result = await EficienciaService.calculateMetrics({
      org: 'o', proj: 'p', team: 't', pat: 'px',
      periodMonths: 3,
      allIterations: mockAllIterations,
      currentCapacity: {}
    });

    // Then o gráfico de tempo por coluna mostra "QA" como maior coluna
    expect(result.colTimes['QA'].total / result.colTimes['QA'].count).toBe(8);
    expect(result.colTimes['Dev'].total / result.colTimes['Dev'].count).toBe(1);
  });

  /**
   * Scenario: Eficiência exclui outliers de coluna
   */
  test('Cenário: Eficiência exclui outliers de coluna (> 180 dias)', async () => {
    // Given um item ficou em "Dev" por 200 dias
    const mockItems = [{ id:1, fields: { 'System.State':'Done', 'System.IterationPath':'S1' } }];
    const mockRevisions = [
      { fields: { 'System.BoardColumn': 'Dev', 'System.ChangedDate': '2024-01-01T00:00:00Z' } },
      { fields: { 'System.BoardColumn': 'Done', 'System.ChangedDate': '2024-10-01T00:00:00Z' } } // ~270 dias
    ];

    jest.spyOn(AzureAPI, '_fetch').mockResolvedValue({ workItems: [{id:1}] });
    jest.spyOn(AzureAPI, 'getWorkItemsBatch').mockResolvedValue(mockItems);
    jest.spyOn(EficienciaService, 'getWorkItemRevisions').mockResolvedValue(mockRevisions);

    // When o processador calcula colTimes
    const result = await EficienciaService.calculateMetrics({
      org: 'o', proj: 'p', team: 't', pat: 'px',
      periodMonths: 3,
      allIterations: mockAllIterations,
      currentCapacity: {}
    });

    // Then o delta de 200 dias é excluído (filtro: delta < 180)
    expect(result.colTimes['Dev']).toBeUndefined();
  });
});
