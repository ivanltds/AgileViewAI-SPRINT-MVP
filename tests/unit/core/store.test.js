import { jest } from '@jest/globals';
import { Store } from '../../../src/core/store.js';

describe('Store Module (src/core/store.js)', () => {
  beforeEach(() => {
    localStorage.clear();
    global.APP = { vaultMode: null, sessionTokens: { teams: {}, orgs: {}, llms: {} } };
    global.Vault = {
      decryptToken: jest.fn(t => Promise.resolve('decrypted-' + t))
    };
  });

  describe('Basic operations (_g, _s)', () => {
    it('deve retornar default array se nao encontrar nada', () => {
      expect(Store._g('non_existent')).toEqual([]);
    });

    it('deve retornar default especifico se fornecido', () => {
      expect(Store._g('non_existent', { a: 1 })).toEqual({ a: 1 });
    });

    it('deve lidar com JSON invalido graciosamente', () => {
      localStorage.setItem('bad_json', '}{');
      expect(Store._g('bad_json', 'default')).toBe('default');
    });

    it('deve salvar e carregar dados corretamente', () => {
      Store._s('test_key', { obj: 123 });
      expect(Store._g('test_key')).toEqual({ obj: 123 });
    });
  });

  describe('Getters and Setters of Entities', () => {
    it('Teams', () => {
      const teams = [{ id: 't1' }];
      Store.saveTeams(teams);
      expect(Store.getTeams()).toEqual(teams);
    });

    it('Orgs', () => {
      const orgs = [{ id: 'o1' }];
      Store.saveOrgs(orgs);
      expect(Store.getOrgs()).toEqual(orgs);
    });

    it('LlmList', () => {
      const llms = [{ id: 'l1' }];
      Store.saveLlmList(llms);
      expect(Store.getLlmList()).toEqual(llms);
    });

    it('RagList', () => {
      const rags = [{ id: 'r1' }];
      Store.saveRagList(rags);
      expect(Store.getRagList()).toEqual(rags);
    });

    it('ChatConvs', () => {
      Store.saveChatConvs([{ id: 'c1' }]);
      expect(Store.getChatConvs()).toEqual([{ id: 'c1' }]);
    });

    it('InsightFeedback', () => {
      Store.saveInsightFeedback([{ id: 'i1' }]);
      expect(Store.getInsightFeedback()).toEqual([{ id: 'i1' }]);
    });

    it('UserProfile', () => {
      expect(Store.getUserProfile().level).toBe('neutral'); // default
      Store.saveUserProfile({ level: 'master' });
      expect(Store.getUserProfile().level).toBe('master');
    });

    it('SprintCache', () => {
      expect(Store.getSprintCache()).toBeNull();
      Store.saveSprintCache({ data: 'cache' });
      expect(Store.getSprintCache()).toEqual({ data: 'cache' });
    });

    it('AgentPrompts', () => {
      Store.saveAgentPrompts({ a1: 'prompt' });
      expect(Store.getAgentPrompts()).toEqual({ a1: 'prompt' });
    });

    it('ActiveTeamId', () => {
      expect(Store.getActiveTeamId()).toBeNull();
      Store.setActiveTeamId('t99');
      expect(Store.getActiveTeamId()).toBe('t99');
    });
  });

  describe('getActiveTeam()', () => {
    it('retorna null se nenhum id selecionado', () => {
      expect(Store.getActiveTeam()).toBeNull();
    });

    it('retorna o time instanciado se id for valido', () => {
      Store.saveTeams([{ id: 't1', name: 'Time 1' }, { id: 't2', name: 'Time 2' }]);
      Store.setActiveTeamId('t2');
      expect(Store.getActiveTeam().name).toBe('Time 2');
    });
  });

  describe('getActivePat()', () => {
    beforeEach(() => {
      Store.saveOrgs([{ id: 'o1', patEnc: 'org-pat' }]);
      Store.saveTeams([
        { id: 't1', patEnc: 't1-pat' },
        { id: 't2', orgId: 'o1' },
        { id: 't3' }
      ]);
    });

    it('se sessao, tenta do memory token: team priority, then org', async () => {
      global.APP.vaultMode = 'session';
      global.APP.sessionTokens.teams['t1'] = 'mem-pat-t1';
      global.APP.sessionTokens.orgs['o1'] = 'mem-pat-o1';

      Store.setActiveTeamId('t1');
      expect(await Store.getActivePat()).toBe('mem-pat-t1');

      Store.setActiveTeamId('t2');
      expect(await Store.getActivePat()).toBe('mem-pat-o1');
    });

    it('se local, decriptografa do team primeiro usando Vault global', async () => {
      global.APP.vaultMode = 'local';
      Store.setActiveTeamId('t1');
      const val = await Store.getActivePat();
      expect(val).toBe('decrypted-t1-pat');
    });

    it('se local e team nao tem PAT, busca da Org', async () => {
      global.APP.vaultMode = 'local';
      Store.setActiveTeamId('t2');
      const val = await Store.getActivePat();
      expect(val).toBe('decrypted-org-pat');
    });

    it('se local e nao ha PAT e nem Org com PAT, retorna null', async () => {
      global.APP.vaultMode = 'local';
      Store.setActiveTeamId('t3');
      expect(await Store.getActivePat()).toBeNull();
    });

    it('retorna null com graciosidade se APP.VaultMode estiver desconhecido faltando Vault', async () => {
      global.Vault = null;
      Store.setActiveTeamId('t1');
      expect(await Store.getActivePat()).toBeNull();
    });
  });

  describe('getActiveLlm() e getActiveLlmToken()', () => {
    it('getActiveLlm', () => {
      Store.saveLlmList([{ id: 'llm1', active: false }, { id: 'llm2', active: true }]);
      expect(Store.getActiveLlm().id).toBe('llm2');
    });

    it('getActiveLlmToken in session mode', async () => {
      global.APP.vaultMode = 'session';
      global.APP.sessionTokens.llms['llm2'] = 'memory-llm-tok';
      Store.saveLlmList([{ id: 'llm2', active: true }]);
      
      expect(await Store.getActiveLlmToken()).toBe('memory-llm-tok');
    });

    it('getActiveLlmToken in local mode', async () => {
      global.APP.vaultMode = 'local';
      Store.saveLlmList([{ id: 'llm2', active: true, tokenEnc: 'enc-tok' }]);
      expect(await Store.getActiveLlmToken()).toBe('decrypted-enc-tok');
    });
  });

  describe('getActiveRag()', () => {
    it('retorna RAGs gerais e RAGs especificos do time combinados como Markdown', () => {
      Store.saveTeams([{ id: 't1' }, { id: 't2' }]);
      Store.setActiveTeamId('t1');

      Store.saveRagList([
        { scope: 'geral', type: 'Geral 1', spec: 'Conteudo G1' },
        { scope: 'team', teamId: 't1', type: 'Espec 1', spec: 'Conteudo E1' },
        { scope: 'team', teamId: 't2', type: 'Espec 2', spec: 'Nao deve aparecer' },
        { scope: 'geral', type: 'Desativado', spec: '...', active: false }
      ]);

      const rag = Store.getActiveRag();
      expect(rag).toContain('Conteudo G1');
      expect(rag).toContain('Conteudo E1');
      expect(rag).not.toContain('Nao deve aparecer');
      expect(rag).not.toContain('Desativado');

      // Check MD structure
      expect(rag).toBe('## Espec 1\nConteudo E1\n\n## Geral 1\nConteudo G1');
    });
  });
});
