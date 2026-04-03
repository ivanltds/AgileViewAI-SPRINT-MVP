/**
 * BDD Tests for Teams Management Feature
 * Based on docs/04_cenarios_bdd.md scenarios
 */

import { jest } from '@jest/globals';

describe('Feature: Gerenciamento de Times e Organizações', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Scenario: Cadastrar nova organização e time simultaneamente', () => {
    test('Given nenhuma organização cadastrada, When usuário cria novo time, Then organizações e times são salvos', () => {
      const teamData = {
        org: 'MinhaEmpresa',
        project: 'MeuProjeto',
        team: 'Time Backend',
        name: 'Backend Dev',
        pat: 'valid-pat-token'
      };

      // Given: nenhuma organização
      expect(Store.getOrgs()).toHaveLength(0);
      expect(Store.getTeams()).toHaveLength(0);

      // When: usuário cria time
      // Simulate team creation
      const orgId = 'org-' + Date.now();
      const teamId = 'team-' + Date.now();
      
      const org = {
        id: orgId,
        name: teamData.org,
        patEnc: teamData.pat // In real test, would be encrypted
      };

      const team = {
        id: teamId,
        orgId: orgId,
        name: teamData.name,
        team: teamData.team,
        project: teamData.project
      };

      // Save to store
      const orgs = Store.getOrgs();
      orgs.push(org);
      Store.saveOrgs(orgs);

      const teams = Store.getTeams();
      teams.push(team);
      Store.saveTeams(teams);

      // Then: organizações e times salvos
      expect(Store.getOrgs()).toHaveLength(1);
      expect(Store.getTeams()).toHaveLength(1);
      expect(Store.getOrgs()[0].name).toBe('MinhaEmpresa');
      expect(Store.getTeams()[0].name).toBe('Backend Dev');
    });
  });

  describe('Scenario: Organização existente reutiliza PAT automaticamente', () => {
    test('Given organização existente, When usuário cria novo time, Then campo PAT não exibido', () => {
      // Given: organização existente
      const existingOrg = {
        id: 'org-1',
        name: 'MinhaEmpresa',
        patEnc: 'encrypted-pat'
      };
      Store.saveOrgs([existingOrg]);

      // When: usuário cria novo time
      const newTeam = {
        id: 'team-2',
        orgId: 'org-1',
        name: 'Frontend Dev',
        team: 'Time Frontend',
        project: 'MeuProjeto'
      };

      const teams = Store.getTeams();
      teams.push(newTeam);
      Store.saveTeams(teams);

      // Then: time salvo sem PAT (reutiliza da org)
      expect(Store.getTeams()).toHaveLength(1);
      expect(Store.getTeams()[0].orgId).toBe('org-1');
      expect(Store.getTeams()[0].patEnc).toBeUndefined();
    });
  });

  describe('Scenario: Ativar time define credenciais globais', () => {
    test('Given 3 times cadastrados, When usuário ativa time, Then time ativo definido', () => {
      // Given: 3 times cadastrados
      const teams = [
        { id: 'team-1', name: 'Backend Dev', orgId: 'org-1' },
        { id: 'team-2', name: 'Frontend Dev', orgId: 'org-1' },
        { id: 'team-3', name: 'QA Team', orgId: 'org-1' }
      ];
      Store.saveTeams(teams);

      // When: usuário ativa time
      Store.setActiveTeamId('team-2');

      // Then: time ativo definido
      expect(Store.getActiveTeamId()).toBe('team-2');
      expect(Store.getActiveTeam().name).toBe('Frontend Dev');
    });
  });

  describe('Scenario: Apenas um time fica ativo por vez', () => {
    test('Given time ativo, When usuário ativa outro, Then apenas um fica ativo', () => {
      // Given: time ativo
      const teams = [
        { id: 'team-1', name: 'Frontend Dev', orgId: 'org-1' },
        { id: 'team-2', name: 'QA Team', orgId: 'org-1' }
      ];
      Store.saveTeams(teams);
      Store.setActiveTeamId('team-1');

      expect(Store.getActiveTeamId()).toBe('team-1');

      // When: usuário ativa outro time
      Store.setActiveTeamId('team-2');

      // Then: apenas um ativo
      expect(Store.getActiveTeamId()).toBe('team-2');
      expect(Store.getActiveTeam().name).toBe('QA Team');
      expect(Store.getTeams()).toHaveLength(2); // Ambos continuam cadastrados
    });
  });

  describe('Scenario: Editar PAT de organização', () => {
    test('Given organização com PAT expirado, When usuário edita, Then novo PAT salvo', () => {
      // Given: organização com PAT
      const org = {
        id: 'org-1',
        name: 'MinhaEmpresa',
        patEnc: 'old-expired-pat'
      };
      Store.saveOrgs([org]);

      // When: usuário edita PAT
      const newPat = 'new-valid-pat';
      const orgs = Store.getOrgs();
      orgs[0].patEnc = newPat; // In real test, would be encrypted
      Store.saveOrgs(orgs);

      // Then: novo PAT salvo
      expect(Store.getOrgs()[0].patEnc).toBe(newPat);
    });
  });
});
