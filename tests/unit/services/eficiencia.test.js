import { jest } from '@jest/globals';
import { EficienciaService } from '../../../src/services/eficiencia.js';
import { AzureAPI } from '../../../src/core/azure-api.js';

describe('EficienciaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('_days()', () => {
    it('deve calcular corretamente a diferença em dias', () => {
      const d1 = '2024-01-01T10:00:00Z';
      const d2 = '2024-01-05T10:00:00Z';
      expect(EficienciaService._days(d1, d2)).toBe(4);
    });

    it('deve retornar 0 se a data fim for anterior à de início', () => {
      const d1 = '2024-01-05T10:00:00Z';
      const d2 = '2024-01-01T10:00:00Z';
      expect(EficienciaService._days(d1, d2)).toBe(0);
    });

    it('deve retornar 0 se uma das datas for nula', () => {
      expect(EficienciaService._days(null, '2024-01-01')).toBe(0);
      expect(EficienciaService._days('2024-01-01', null)).toBe(0);
    });
  });

  describe('_isDone()', () => {
    it('deve reconhecer estados de conclusão (case insensitive)', () => {
      expect(EficienciaService._isDone('Done')).toBe(true);
      expect(EficienciaService._isDone('closed')).toBe(true);
      expect(EficienciaService._isDone('Concluído')).toBe(true);
      expect(EficienciaService._isDone('New')).toBe(false);
      expect(EficienciaService._isDone('In Progress')).toBe(false);
    });
  });

  describe('calculateMetrics()', () => {
    const mockParams = {
      org: 'my-org',
      proj: 'my-proj',
      team: 'my-team',
      pat: 'fake-pat',
      periodMonths: 3,
      allIterations: [
        { path: 'Project\\Sprint 1', attributes: { finishDate: new Date().toISOString() } },
        { path: 'Project\\Sprint 2', attributes: { finishDate: new Date(Date.now() - 30 * 86400000).toISOString() } }
      ],
      currentCapacity: { 'João': { capTotal: 40 } }
    };

    it('deve retornar métricas zeradas se não houver iterações no período', async () => {
      const params = { ...mockParams, periodMonths: 0, allIterations: [] };
      const result = await EficienciaService.calculateMetrics(params);
      expect(result.avgThroughput).toBe(0);
      expect(result.iterLabels).toHaveLength(0);
    });

    it('deve calcular médias de throughput, lead e cycle time corretamente', async () => {
      const mockWorkItems = [
        {
          id: 1,
          fields: {
            'System.State': 'Done',
            'System.IterationPath': 'Project\\Sprint 1',
            'System.CreatedDate': '2024-01-01T00:00:00Z',
            'Microsoft.VSTS.Common.ActivatedDate': '2024-01-02T00:00:00Z',
            'Microsoft.VSTS.Common.ClosedDate': '2024-01-05T00:00:00Z',
            'Microsoft.VSTS.Scheduling.StoryPoints': 5
          }
        },
        {
          id: 2,
          fields: {
            'System.State': 'Done',
            'System.IterationPath': 'Project\\Sprint 1',
            'System.CreatedDate': '2024-01-01T00:00:00Z',
            'Microsoft.VSTS.Common.ActivatedDate': '2024-01-01T12:00:00Z',
            'Microsoft.VSTS.Common.ClosedDate': '2024-01-03T00:00:00Z',
            'Microsoft.VSTS.Scheduling.StoryPoints': 3
          }
        }
      ];

      // Mock AzureAPI
      jest.spyOn(AzureAPI, '_fetch').mockResolvedValue({ workItems: [{ id: 1 }, { id: 2 }] });
      jest.spyOn(AzureAPI, 'getWorkItemsBatch').mockResolvedValue(mockWorkItems);
      jest.spyOn(EficienciaService, 'getWorkItemRevisions').mockResolvedValue([]);

      const result = await EficienciaService.calculateMetrics(mockParams);

      // 2 itens em 1 sprint -> throughput = 2
      expect(result.avgThroughput).toBe(2);
      // Lead time médio: (4d + 2d) / 2 = 3d
      expect(result.avgLeadTime).toBe(3);
      // Cycle time médio: (3d + 1.5d) / 2 = 2.25 -> 2.3 (round 1 decimal)
      expect(result.avgCycleTime).toBe(2.3);
      expect(result.capTotal).toBe(40);
    });

    it('deve filtrar outliers de 180 dias no cálculo por coluna', async () => {
      const mockWorkItems = [
        {
          id: 1,
          fields: {
            'System.State': 'Done',
            'System.IterationPath': 'Project\\Sprint 1',
            'System.CreatedDate': '2024-01-01T00:00:00Z',
            'Microsoft.VSTS.Common.ClosedDate': '2024-01-10T00:00:00Z'
          }
        }
      ];

      const mockRevisions = [
        { fields: { 'System.BoardColumn': 'Dev', 'System.ChangedDate': '2024-01-01T00:00:00Z' } },
        { fields: { 'System.BoardColumn': 'QA', 'System.ChangedDate': '2024-01-02T00:00:00Z' } }, // Dev = 1 dia
        { fields: { 'System.BoardColumn': 'Done', 'System.ChangedDate': '2024-07-30T00:00:00Z' } } // QA = ~210 dias (outlier!)
      ];

      jest.spyOn(AzureAPI, '_fetch').mockResolvedValue({ workItems: [{ id: 1 }] });
      jest.spyOn(AzureAPI, 'getWorkItemsBatch').mockResolvedValue(mockWorkItems);
      jest.spyOn(EficienciaService, 'getWorkItemRevisions').mockResolvedValue(mockRevisions);

      const result = await EficienciaService.calculateMetrics(mockParams);

      expect(result.colTimes['Dev']).toBeDefined();
      expect(result.colTimes['Dev'].total).toBe(1);
      expect(result.colTimes['QA']).toBeUndefined(); // Outlier filtered out
    });
  });
});
