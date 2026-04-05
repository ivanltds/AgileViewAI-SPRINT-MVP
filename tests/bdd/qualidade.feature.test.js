// tests/bdd/qualidade.feature.test.js
import { jest } from '@jest/globals';
import { QualidadeService } from '../../src/services/qualidade.js';
import { AzureAPI } from '../../src/core/azure-api.js';

// jest.mock Removido para suportar ESM

describe('Feature: Análise de Qualidade', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        AzureAPI.getWorkItemsBatch = jest.fn();
        AzureAPI._fetch = jest.fn();
        AzureAPI.getRevisions = jest.fn();
    });

    test('Cenário: Cálculo de tempo médio de resolução para Bugs', async () => {
        // GIVEN
        const now = new Date();
        const items = [
            { 
                id: 1, 
                fields: { 
                    'System.WorkItemType': 'Bug',
                    'System.State': 'Done',
                    'System.CreatedDate': new Date(now - 10 * 86400000).toISOString(),
                    'Microsoft.VSTS.Common.ClosedDate': new Date(now - 8 * 86400000).toISOString()
                } 
            },
            { 
                id: 2, 
                fields: { 
                    'System.WorkItemType': 'Bug',
                    'System.State': 'Closed',
                    'System.CreatedDate': new Date(now - 5 * 86400000).toISOString(),
                    'Microsoft.VSTS.Common.ClosedDate': new Date(now - 1 * 86400000).toISOString()
                } 
            }
        ];

        // WHEN
        const metrics = QualidadeService.calculateMetrics(items, {}, 0);

        // THEN
        // Item 1: 10-8 = 2 days
        // Item 2: 5-1 = 4 days
        // Avg: (2 + 4) / 2 = 3 days
        expect(metrics.kpis.avgBug).toBe(3);
    });

    test('Cenário: Identificação de bugs por severidade', async () => {
        // GIVEN
        const items = [
            { id: 1, fields: { 'System.WorkItemType': 'Bug', 'Microsoft.VSTS.Common.Severity': '1 - Critical' } },
            { id: 2, fields: { 'System.WorkItemType': 'Bug', 'Microsoft.VSTS.Common.Severity': '2 - High' } },
            { id: 3, fields: { 'System.WorkItemType': 'Bug', 'Microsoft.VSTS.Common.Severity': '1 - Critical' } }
        ];

        // WHEN
        const chartData = QualidadeService.getChartData(items);

        // THEN
        expect(chartData.severity['1 - Critical']).toBe(2);
        expect(chartData.severity['2 - High']).toBe(1);
    });

    test('Cenário: Somatório de esforço estimado para Defeitos (tasks filhas)', async () => {
        // GIVEN
        const org = 'org', proj = 'proj', pat = 'pat';
        
        // Items: One Defect
        AzureAPI.getWorkItemsBatch.mockResolvedValue([
            { id: 10, fields: { 'System.WorkItemType': 'Defect' } }
        ]);
        
        // WIQL mocks
        AzureAPI._fetch.mockImplementation((url, opts) => {
            if (opts.body.includes('SELECT [System.Id] FROM WorkItems')) {
                return Promise.resolve({ workItems: [{ id: 10 }] });
            }
            if (opts.body.includes('SELECT [System.Id] FROM WorkItemLinks')) {
                return Promise.resolve({ 
                    workItemRelations: [
                        { source: { id: 10 }, target: { id: 101 } },
                        { source: { id: 10 }, target: { id: 102 } }
                    ] 
                });
            }
            return Promise.resolve({});
        });

        // Revision mocks: Task 101 (max 4h), Task 102 (max 6h)
        AzureAPI.getRevisions.mockImplementation((org, proj, id) => {
            if (id === 101) return Promise.resolve([{ fields: { 'Microsoft.VSTS.Scheduling.RemainingWork': 4 } }]);
            if (id === 102) return Promise.resolve([{ fields: { 'Microsoft.VSTS.Scheduling.RemainingWork': 6 } }]);
            return Promise.resolve([]);
        });

        // WHEN
        const data = await QualidadeService.fetchQualityData({ org, proj, pat });
        const metrics = QualidadeService.calculateMetrics(data.items, data.tempoGasto, data.totalHorasGastas);

        // THEN
        expect(data.tempoGasto[10]).toBe(10);
        expect(metrics.kpis.totalEstimated).toBe(10);
    });
});
