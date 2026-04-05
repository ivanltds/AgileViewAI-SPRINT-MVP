import { jest } from '@jest/globals';
import { InsightsService, InsightsValidator, AGENT_DEFAULTS } from '../../../src/services/insights.js';
import { Store } from '../../../src/core/store.js';

describe('InsightsService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('parseJson()', () => {
    it('deve extrair um array JSON válido de uma string com markdown (happy path)', () => {
      const raw = 'Aqui estão os insights:\n```json\n[{"severity":"warning","icon":"⚠️","title":"Alerta","body":"Teste de body"}]\n```';
      const result = InsightsService.parseJson(raw);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('warning');
    });

    it('deve retornar default (info) se a resposta não puder ser parseada (caso de erro)', () => {
      const raw = 'Resposta em texto sem JSON';
      const result = InsightsService.parseJson(raw);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('info');
      expect(result[0].body).toContain('Resposta em texto sem JSON');
    });

    it('deve extrair fallback se o array estiver vazio (caso de borda)', () => {
      const result = InsightsService.parseJson('```json\n[]\n```');
      expect(result[0].severity).toBe('info');
    });
  });

  describe('buildUserPrompt()', () => {
    it('deve construir string de contexto RAG contendo Eficiência e Qualidade', () => {
      const stats = { bizDays: 5, total: 10, done: 5, donePct: 50, inProgress: 2, blocked: 0, fixing: 0, totalTasksOpen: 8, totalTasksDone: 10, totalRem: 20, capacityTotal: 40, allocPct: 50, byMember: {} };
      const capacity = { 'Ana QA': { activity: 'QA', capRest: 20 } };
      const byActivity = { 'QA': { capRest: 20, remaining: 10, members: 1 } };
      
      const prompt = InsightsService.buildUserPrompt(stats, capacity, byActivity, 'RAG TEST', [], [], null, null);
      expect(prompt).toContain('Dias úteis restantes: 5');
      expect(prompt).toContain('RAG TEST');
    });
  });

  describe('call()', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('deve chamar _callOpenAI para provider openai e tratar os dados', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Mock response' } }] })
      });
      const result = await InsightsService.call('openai', 'tok', 'sys', 'usr');
      expect(result).toBe('Mock response');
      expect(global.fetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.any(Object));
    });

    it('deve lançar erro se o provider for desconhecido', async () => {
      await expect(InsightsService.call('unknown', 'tok', 'sys', 'usr')).rejects.toThrow('Provider desconhecido');
    });
  });
});

describe('InsightsValidator', () => {
  describe('validate()', () => {
    it('Regra R0: deve rebaixar critical/warning para info se agregado tem folga e membro não é citado', () => {
      const insights = [{ severity: 'critical', title: 'Risco Genérico', body: 'Sprint atrasada.' }];
      const stats = { totalRem: 30, capacityTotal: 100 }; // folga
      const capacity = { 'João Dev': { capRest: 100, activity: 'Dev' } };
      
      const result = InsightsValidator.validate(insights, stats, capacity, '');
      expect(result[0].severity).toBe('info');
      expect(result[0].title).toBe('Capacidade com folga');
    });

    it('Regra R2: deve rebaixar critical para warning se ninguém está acima de 100% de alocação', () => {
      const insights = [{ severity: 'critical', title: 'Alerta da Silva', body: 'Alerta dev' }];
      const stats = { byMember: { 'João Dev': { remaining: 50 } } }; 
      const capacity = { 'João Dev': { capRest: 100, activity: 'Dev' } }; // 50% alocado
      
      const result = InsightsValidator.validate(insights, stats, capacity, '');
      expect(result[0].severity).toBe('warning');
    });

    it('Regra R5: deve alertar warning se card for info/ok para membro ocioso (<70%)', () => {
      const insights = [{ severity: 'ok', title: 'Bom trabalho João', body: 'Tudo lindo João.' }];
      const stats = { byMember: { 'João': { remaining: 10 } } };
      const capacity = { 'João': { capRest: 100, activity: 'Dev' } }; // alocado 10%
      
      const result = InsightsValidator.validate(insights, stats, capacity, '');
      expect(result[0].severity).toBe('warning');
      expect(result[0].body).toContain('abaixo de 70%');
    });

    it('Regra R6: deve injetar alerta critical se membro estiver sobrecarregado (>100%) mas não for mencionado', () => {
      const insights = [{ severity: 'info', title: 'Random', body: 'Random text.' }];
      const stats = { byMember: { 'Maria': { remaining: 150 } } }; 
      const capacity = { 'Maria': { capRest: 100, activity: 'Dev' } }; // 150% alocada
      
      const result = InsightsValidator.validate(insights, stats, capacity, '');
      // Expect R6 to have prepended a critical insight
      expect(result[0].severity).toBe('critical');
      expect(result[0].section).toBe('overload');
      expect(result[0].body).toContain('Maria');
    });
  });

  describe('localFallback()', () => {
    it('deve gerar critical fallback se existem bloqueios (happy path para bloqueios)', () => {
      const stats = { blocked: 2, fixing: 0, allocPct: 50, bizDays: 5, totalRem: 20, capacityTotal: 40 };
      const capacity = {};
      const result = InsightsValidator.localFallback(stats, capacity, {});
      const blockedInsight = result.find(r => r.title === 'Bloqueios ativos');
      expect(blockedInsight.severity).toBe('critical');
    });

    it('deve gerar alerta de sobrecarga no fallback', () => {
      const stats = { byMember: { 'Jose': { remaining: 120 } } };
      const capacity = { 'Jose': { capRest: 100 } };
      const result = InsightsValidator.localFallback(stats, capacity, {});
      const overInsight = result.find(r => r.title === 'Sobrecarga de membros');
      expect(overInsight.severity).toBe('critical');
    });
  });
});
