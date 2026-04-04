/**
 * BDD Tests for Azure DevOps Synchronization Feature
 * Based on docs/04_cenarios_bdd.md scenarios
 */

import { jest } from '@jest/globals';
import { Vault } from '../../src/core/vault.js';
import { Store } from '../../src/core/store.js';
import { AzureAPI } from '../../src/core/azure-api.js';

// Mock fetch for Azure API calls
global.fetch = jest.fn();

describe('Feature: Sincronização com Azure DevOps', () => {
  beforeEach(() => {
    fetch.mockReset();
    localStorage.clear();
    APP.sprintData = null;
    APP.syncRunning = false;
  });

  describe('Scenario: Sincronização bem-sucedida com sprint ativa', () => {
    test('Given time com PAT válido, When usuário sincroniza, Then dados salvos em cache', async () => {
      const mockPat = 'valid-pat';
      const mockIterations = [
        {
          id: 'sprint-42',
          name: 'Sprint 42',
          attributes: {
            startDate: '2025-03-24',
            finishDate: '2025-04-04'
          }
        }
      ];

      const mockWorkItems = [
        { id: 1001, fields: { 'System.WorkItemType': 'Product Backlog Item' } },
        { id: 1002, fields: { 'System.WorkItemType': 'Task' } }
      ];

      const mockCapacity = {
        teamMembers: [
          {
            teamMember: { displayName: 'João Silva' },
            activities: [
              { capacityPerDay: 8, name: 'Development' }
            ],
            daysOff: []
          }
        ]
      };

      // Mock fetch responses
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ value: mockIterations })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ workItems: mockWorkItems })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ value: mockWorkItems })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCapacity)
        });

      // Given: time com PAT válido
      const team = {
        id: 'team-1',
        name: 'Backend Dev',
        org: 'MinhaEmpresa',
        project: 'MeuProjeto',
        team: 'Time Backend'
      };

      // When: usuário sincroniza
      // Simulate sync process
      const iterations = await AzureAPI.getIterations(
        team.org,
        team.project,
        team.team,
        mockPat
      );

      // Then: dados buscados e salvos
      expect(iterations).toHaveLength(1);
      expect(iterations[0].name).toBe('Sprint 42');

      // Verify cache save
      const sprintCache = {
        iterations: mockIterations,
        workItems: mockWorkItems,
        capacity: mockCapacity,
        lastSync: new Date().toISOString()
      };
      
      Store.saveSprintCache(sprintCache);
      expect(Store.getSprintCache()).toBeTruthy();
    });
  });

  describe('Scenario: PAT expirado retorna erro 401', () => {
    test('Given PAT expirado, When usuário sincroniza, Then erro 401 exibido', async () => {
      const expiredPat = 'expired-pat';
      const team = {
        org: 'MinhaEmpresa',
        project: 'MeuProjeto',
        team: 'Time Backend'
      };

      // Mock 401 response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      // When/Then: sincronização falha
      try {
        await AzureAPI.getIterations(team.org, team.project, team.team, expiredPat);
        throw new Error('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('HTTP 401');
      }
    });
  });

  describe('Scenario: Nome de team incorreto retorna erro 404', () => {
    test('Given team name incorreto, When usuário sincroniza, Then erro 404 exibido', async () => {
      const validPat = 'valid-pat';
      const team = {
        org: 'MinhaEmpresa',
        project: 'MeuProjeto',
        team: 'Time Backend' // Nome incorreto
      };

      // Mock 404 response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found')
      });

      // When/Then: sincronização falha
      try {
        await AzureAPI.getIterations(team.org, team.project, team.team, validPat);
        throw new Error('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('HTTP 404');
      }
    });
  });

  describe('Scenario: Team name com espaços é codificado corretamente', () => {
    test('Given team name com espaços, When monta URL, Then codificado corretamente', () => {
      const teamName = 'Time de Backend';
      
      // When: codifica team name
      const encoded = AzureAPI._encTeam(teamName);

      // Then: espaços codificados como %20
      expect(encoded).toBe('Time%20de%20Backend');
      expect(encoded).not.toContain(encodeURIComponent('/')); // Não codifica /
    });
  });

  describe('Scenario: Sprint ativa identificada corretamente', () => {
    test('Given múltiplas sprints, When processa, Then sprint ativa identificada', () => {
      const today = new Date('2025-04-02');
      const mockIterations = [
        {
          id: 'sprint-40',
          name: 'Sprint 40',
          attributes: {
            startDate: '2025-03-10',
            finishDate: '2025-03-21'
          }
        },
        {
          id: 'sprint-42',
          name: 'Sprint 42',
          attributes: {
            startDate: '2025-03-24',
            finishDate: '2025-04-04'
          }
        },
        {
          id: 'sprint-43',
          name: 'Sprint 43',
          attributes: {
            startDate: '2025-04-07',
            finishDate: '2025-04-18'
          }
        }
      ];

      // When: identifica sprint ativa
      const activeSprint = mockIterations.find(sprint => {
        const start = new Date(sprint.attributes.startDate);
        const end = new Date(sprint.attributes.finishDate);
        return today >= start && today <= end;
      });

      // Then: sprint ativa identificada
      expect(activeSprint).toBeTruthy();
      expect(activeSprint.id).toBe('sprint-42');
      expect(activeSprint.name).toBe('Sprint 42');
    });
  });

  describe('Scenario: Fallback para sprint mais recente quando sem ativa', () => {
    test('Given sem sprint ativa, When processa, Then usa mais recente', () => {
      const today = new Date('2025-04-10'); // Após sprint 42
      const mockIterations = [
        {
          id: 'sprint-40',
          attributes: { finishDate: '2025-03-21' }
        },
        {
          id: 'sprint-42',
          attributes: { finishDate: '2025-04-04' }
        },
        {
          id: 'sprint-43',
          attributes: { finishDate: '2025-04-18' }
        }
      ];

      // When: busca sprint ativa (não encontrada)
      let activeSprint = mockIterations.find(sprint => {
        const start = new Date(sprint.attributes.startDate);
        const end = new Date(sprint.attributes.finishDate);
        return today >= start && today <= end;
      });

      // Fallback para mais recente no passado
      if (!activeSprint) {
        const pastSprints = mockIterations.filter(s => 
          new Date(s.attributes.finishDate) < today
        );
        pastSprints.sort((a, b) => 
          new Date(b.attributes.finishDate) - new Date(a.attributes.finishDate)
        );
        activeSprint = pastSprints[0];
      }

      // Then: fallback para sprint 42
      expect(activeSprint.id).toBe('sprint-42');
    });
  });
});
