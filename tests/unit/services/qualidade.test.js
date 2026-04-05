// tests/unit/services/qualidade.test.js
import { jest } from '@jest/globals';
import { QualidadeService } from '../../../src/services/qualidade.js';
import { AzureAPI } from '../../../src/core/azure-api.js';

// jest.mock removido
describe('QualidadeService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    beforeEach(() => {
        AzureAPI.getRevisions = jest.fn();
        AzureAPI._fetch = jest.fn();
        AzureAPI.getWorkItemsBatch = jest.fn();
    });

    test('_isDone should identify completed states', () => {
        expect(QualidadeService._isDone('Done')).toBe(true);
        expect(QualidadeService._isDone('Closed')).toBe(true);
        expect(QualidadeService._isDone('Resolved')).toBe(true);
        expect(QualidadeService._isDone('In Progress')).toBe(false);
        expect(QualidadeService._isDone(null)).toBe(false);
    });

    test('calculateMetrics should compute KPIs correctly', () => {
        const now = Date.now();
        const items = [
            { 
                id: 1, 
                fields: { 
                    'System.WorkItemType': 'Bug',
                    'System.State': 'Done',
                    'System.CreatedDate': new Date(now - 10 * 86400000).toISOString(),
                    'Microsoft.VSTS.Common.ClosedDate': new Date(now - 5 * 86400000).toISOString(),
                    'Microsoft.VSTS.Scheduling.RemainingWork': 0
                } 
            },
            { 
                id: 2, 
                fields: { 
                    'System.WorkItemType': 'Bug',
                    'System.State': 'Active',
                    'System.CreatedDate': new Date(now - 2 * 86400000).toISOString(),
                    'Microsoft.VSTS.Scheduling.RemainingWork': 10
                } 
            },
            { 
                id: 3, 
                fields: { 
                    'System.WorkItemType': 'Defect',
                    'System.State': 'Closed',
                    'System.CreatedDate': new Date(now - 40 * 86400000).toISOString(),
                    'Microsoft.VSTS.Common.ClosedDate': new Date(now - 38 * 86400000).toISOString(),
                    'Microsoft.VSTS.Scheduling.RemainingWork': 0
                } 
            }
        ];

        const tempoGasto = { 1: 5, 2: 10, 3: 15 };
        const totalHorasGastas = 30;

        const result = QualidadeService.calculateMetrics(items, tempoGasto, totalHorasGastas);

        expect(result.kpis.open).toBe(1);
        expect(result.kpis.closed).toBe(2);
        expect(result.kpis.lastMonth).toBe(2); // Item 1 and 2
        expect(result.kpis.avgBug).toBe(5); // (10-5) = 5 days
        expect(result.kpis.avgDefect).toBe(2); // (40-38) = 2 days
        expect(result.kpis.totalRemaining).toBe(10);
        expect(result.kpis.totalEstimated).toBe(30);
    });

    test('_fetchMaxRemBatch should return max historical remaining work', async () => {
        const org = 'org', proj = 'proj', pat = 'pat';
        AzureAPI.getRevisions.mockResolvedValue([
            { fields: { 'Microsoft.VSTS.Scheduling.RemainingWork': 2 } },
            { fields: { 'Microsoft.VSTS.Scheduling.RemainingWork': 8 } },
            { fields: { 'Microsoft.VSTS.Scheduling.RemainingWork': 4 } }
        ]);

        const result = await QualidadeService._fetchMaxRemBatch(org, proj, [123], pat);
        expect(result[123]).toBe(8);
        expect(AzureAPI.getRevisions).toHaveBeenCalledWith(org, proj, 123, pat);
    });

    test('fetchQualityData should consolidate child task effort for Defects', async () => {
        const org = 'org', proj = 'proj', pat = 'pat';
        
        // Mock Item IDs
        AzureAPI._fetch.mockResolvedValueOnce({ workItems: [{ id: 1 }, { id: 10 }] }); // getQualityItemIds
        
        // Mock Items Batch
        AzureAPI.getWorkItemsBatch.mockResolvedValue([
            { id: 1, fields: { 'System.WorkItemType': 'Bug' } },
            { id: 10, fields: { 'System.WorkItemType': 'Defect' } }
        ]);

        // Mock Child Tasks
        AzureAPI._fetch.mockResolvedValueOnce({ 
            workItemRelations: [
                { source: { id: 10 }, target: { id: 101 } },
                { source: { id: 10 }, target: { id: 102 } }
            ] 
        });

        // Mock Revisions
        AzureAPI.getRevisions.mockImplementation((org, proj, id) => {
            if (id === 1) return Promise.resolve([{ fields: { 'Microsoft.VSTS.Scheduling.RemainingWork': 5 } }]);
            if (id === 101) return Promise.resolve([{ fields: { 'Microsoft.VSTS.Scheduling.RemainingWork': 3 } }]);
            if (id === 102) return Promise.resolve([{ fields: { 'Microsoft.VSTS.Scheduling.RemainingWork': 4 } }]);
            return Promise.resolve([]);
        });

        const result = await QualidadeService.fetchQualityData({ org, proj, pat });

        expect(result.tempoGasto[1]).toBe(5); // Bug
        expect(result.tempoGasto[10]).toBe(7); // Defect (3 + 4)
        expect(result.totalHorasGastas).toBe(12);
    });
});
