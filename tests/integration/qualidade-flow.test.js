// tests/integration/qualidade-flow.test.js
import { jest } from '@jest/globals';
import { QualidadeService } from '../../src/services/qualidade.js';
import { AzureAPI } from '../../src/core/azure-api.js';

// jest.mock removido
describe('Integration: Qualidade Flow', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        AzureAPI.getRevisions = jest.fn();
        AzureAPI._fetch = jest.fn();
        AzureAPI.getWorkItemsBatch = jest.fn();
    });

    test('Should execute full quality data flow correctly', async () => {
        // GIVEN
        const params = { org: 'test-org', proj: 'test-proj', pat: 'test-pat' };
        
        // Mock Item IDs (Bug 1, Defect 2)
        AzureAPI._fetch.mockImplementation((url, opts) => {
            if (opts.body.includes('SELECT [System.Id] FROM WorkItems')) {
                return Promise.resolve({ workItems: [{ id: 1 }, { id: 2 }] });
            }
            if (opts.body.includes('SELECT [System.Id] FROM WorkItemLinks')) {
                return Promise.resolve({ 
                    workItemRelations: [
                        { source: { id: 2 }, target: { id: 201 } }
                    ] 
                });
            }
            return Promise.resolve({});
        });

        // Mock Items Batch
        AzureAPI.getWorkItemsBatch.mockResolvedValue([
            { id: 1, fields: { 'System.WorkItemType': 'Bug', 'System.State': 'Active', 'Microsoft.VSTS.Scheduling.RemainingWork': 5 } },
            { id: 2, fields: { 'System.WorkItemType': 'Defect', 'System.State': 'Done', 'Microsoft.VSTS.Scheduling.RemainingWork': 0 } }
        ]);

        // Mock Revisions
        AzureAPI.getRevisions.mockImplementation((org, proj, id) => {
            if (id === 1) return Promise.resolve([{ fields: { 'Microsoft.VSTS.Scheduling.RemainingWork': 7 } }]);
            if (id === 201) return Promise.resolve([{ fields: { 'Microsoft.VSTS.Scheduling.RemainingWork': 10 } }]);
            return Promise.resolve([]);
        });

        // WHEN
        const rawData = await QualidadeService.fetchQualityData(params);
        const result = QualidadeService.calculateMetrics(rawData.items, rawData.tempoGasto, rawData.totalHorasGastas);

        // THEN
        expect(result.kpis.open).toBe(1);
        expect(result.kpis.closed).toBe(1);
        expect(result.kpis.totalRemaining).toBe(5);
        expect(result.kpis.totalEstimated).toBe(17); // Bug (7) + Defect Child (10)
        expect(result.items.length).toBe(2);
    });
});
