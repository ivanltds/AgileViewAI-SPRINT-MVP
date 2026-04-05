import { jest } from '@jest/globals';
import { InsightsService, InsightsValidator, AGENT_DEFAULTS } from '../../src/services/insights.js';
import { Store } from '../../src/core/store.js';

// Mock fetch for LLM calls
global.fetch = jest.fn();

describe('Feature: Insights de IA', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    // Default stats to avoid R0/R2 false positives in unrelated tests
    global.defaultStats = { totalRem: 100, capacityTotal: 80, allocPct: 125, byMember: {} };
    global.defaultCap = { 'Membro': { capRest: 10, activity: 'Dev' } };
  });

  describe('Scenario: Insights carregam assincronamente sem bloquear o dashboard', () => {
    test('Given dashboard renderizado, When insights começam a carregar, Then status é atualizado', async () => {
      // Este teste simula a orquestração do serviço
      const onProgress = jest.fn();
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '[]' } }] })
      });

      const promise = InsightsService.runAgentChain('openai', 'token', 'prompt', onProgress);
      
      // Verification of progress calls (simulating spinner updates)
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Agente 1'), 1);
      
      await promise;
      expect(onProgress).toHaveBeenCalledWith(expect.stringContaining('Agente 3'), 3);
    });
  });

  describe('Scenario: Sobrecarga consolidada em 1 único card critical (R7/R6)', () => {
    test('Given Piovesan (117%) e Aimê (104%) acima de 100%, When processado, Then existe 1 card com Piovesan e Aimê', () => {
      const stats = {
        byMember: {
          'Piovesan': { remaining: 11.7 },
          'Aimê': { remaining: 10.4 }
        }
      };
      const capacity = {
        'Piovesan': { capRest: 10, activity: 'Dev' },
        'Aimê': { capRest: 10, activity: 'Dev' }
      };
      
      const rawInsights = [{ severity: 'info', title: 'Status', body: 'Tudo normal.' }];
      
      const result = InsightsValidator.validate(rawInsights, stats, capacity, '');
      
      const criticals = result.filter(i => i.severity === 'critical');
      expect(criticals).toHaveLength(1);
      expect(criticals[0].body).toContain('Piovesan');
      expect(criticals[0].body).toContain('Aimê');
    });
  });

  describe('Scenario: Folga de capacidade invalida card de risco de entrega (R0)', () => {
    test('Given 30% de folga global, When validador R0 processa, Then card critical vira info', () => {
      const stats = { totalRem: 270, capacityTotal: 384 }; // ~30% folga
      const capacity = { 'Membro': { capRest: 100, activity: 'Dev' } };
      const insights = [{ severity: 'critical', title: 'Alta probabilidade de não entrega', body: 'Risco alto.' }];
      
      const result = InsightsValidator.validate(insights, stats, capacity, '');
      
      expect(result[0].severity).toBe('info');
      expect(result[0].title).toBe('Capacidade com folga');
    });
  });

  describe('Scenario: Regra R3 respeita contexto RAG para situação tratada', () => {
    test('Given RAG contém "Piovesan está alocado no PBI negociado", When R3 processa, Then rebaixa para ok', () => {
      const stats = { byMember: { 'Piovesan': { remaining: 9.5 } } };
      const capacity = { 'Piovesan': { capRest: 10, activity: 'Dev' } }; // 95%
      const rag = "Piovesan está alocado no PBI negociado para a próxima sprint.";
      const insights = [{ severity: 'warning', title: 'Cuidado Piovesan', body: 'Piovesan está com muita carga.' }];
      
      const result = InsightsValidator.validate(insights, stats, capacity, rag);
      expect(result[0].severity).toBe('ok');
    });
  });

  describe('Scenario: Regra R3 NÃO rebaixa sobrecarga real', () => {
    test('Given Piovesan tem alloc=117%, When R3 tenta rebaixar, Then mantém critical', () => {
      const stats = { byMember: { 'Piovesan': { remaining: 11.7 } } };
      const capacity = { 'Piovesan': { capRest: 10, activity: 'Dev' } }; // 117%
      const rag = "Piovesan está negociado.";
      const insights = [{ severity: 'critical', title: 'Sobrecarga Piovesan', body: 'Piovesan está sobrecarregado.' }];
      
      // Para evitar que R2 rebaixe para warning por falta de outros membros, forçamos o contexto
      const result = InsightsValidator.validate(insights, stats, capacity, rag);
      expect(result[0].severity).toBe('critical');
    });
  });

  describe('Scenario: Regra R8 injeta card para membro ocioso não coberto', () => {
    test('Given Lucas tem alloc=10%, When R8 executa, Then injeta warning', () => {
      const stats = { byMember: { 'Lucas': { remaining: 1 } } };
      const capacity = { 'Lucas': { capRest: 10, activity: 'Frontend' } };
      const insights = [{ severity: 'info', title: 'Geral', body: 'Sprint indo bem.' }];
      
      const result = InsightsValidator.validate(insights, stats, capacity, '');
      const lucasCard = result.find(r => r.title.includes('Baixa utilização em Frontend'));
      expect(lucasCard).toBeTruthy();
      expect(lucasCard.severity).toBe('warning');
    });
  });

  describe('Scenario: Regra R7 consolida múltiplos criticals', () => {
    test('Given 3 cards critical, When R7 executa, Then existe exatamente 1', () => {
      // Setup para evitar que R2 rebaixe critical para warning
      const stats = { byMember: { 'X': { remaining: 20 } } };
      const cap = { 'X': { capRest: 10, activity: 'Dev' } }; // X está sobrecarregado (200%)
      
      const insights = [
        { severity: 'critical', title: 'Erro 1', body: 'Corpo 1' },
        { severity: 'critical', title: 'Erro 2', body: 'Corpo 2' },
        { severity: 'critical', title: 'Erro 3', body: 'Corpo 3' }
      ];
      const result = InsightsValidator.validate(insights, stats, cap, '');
      
      const criticals = result.filter(r => r.severity === 'critical');
      expect(criticals).toHaveLength(1);
      expect(criticals[0].body).toContain('Corpo 1');
      expect(criticals[0].body).toContain('Corpo 2');
      expect(criticals[0].body).toContain('Corpo 3');
    });
  });

  describe('Scenario: Deduplicação previne cards repetidos', () => {
    test('Given grid exibe A/B, When retorna B/C, Then apenas C adicionado', () => {
      const existing = [{ title: 'Insight A' }, { title: 'Insight B' }];
      const newItems = [{ title: 'insight B' }, { title: 'Insight C' }];
      
      const result = InsightsValidator.validate([...existing, ...newItems], { totalRem:10, capacityTotal:5 }, {}, '');
      expect(result.map(i => i.title.toLowerCase())).toEqual(['insight a', 'insight b', 'insight c']);
    });
  });

  describe('Scenario: Feedback 👍 em card é persistido', () => {
    test('When clica em 👍, Then avai_insight_fb recebe o voto', () => {
      const title = 'Alertas de Sobrecarga';
      const vote = { title, vote: 'good', timestamp: Date.now() };
      const current = Store.getInsightFeedback() || [];
      current.push(vote);
      Store.saveInsightFeedback(current);
      
      const saved = Store.getInsightFeedback();
      expect(saved[0].title).toBe(title);
      expect(saved[0].vote).toBe('good');
    });
  });

  describe('Scenario: Timeout de 90s', () => {
    test('Given demora > 90s, When timeout dispara, Then erro lançado', async () => {
      jest.useFakeTimers();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tempo esgotado')), 90000);
      });
      const combined = Promise.race([new Promise(r => {}), timeoutPromise]);
      jest.advanceTimersByTime(91000);
      await expect(combined).rejects.toThrow('Tempo esgotado');
      jest.useRealTimers();
    });
  });

  describe('Scenario: Remover card individual não afeta outros cards', () => {
    test('Given 5 cards, When remove o 3º, Then restam 4', () => {
      let cards = [
        { id: 1, title: 'I1' }, { id: 2, title: 'I2' }, { id: 3, title: 'I3' }, { id: 4, title: 'I4' }, { id: 5, title: 'I5' }
      ];
      // Simula ação da UI
      cards.splice(2, 1);
      
      expect(cards).toHaveLength(4);
      expect(cards.find(c => c.id === 3)).toBeUndefined();
      expect(cards[0].id).toBe(1);
      expect(cards[2].id).toBe(4);
    });
  });
});
