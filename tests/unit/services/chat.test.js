import { jest } from '@jest/globals';
import { ChatService } from '../../../src/services/chat.js';
import { Store } from '../../../src/core/store.js';
import { LLMAPI } from '../../../src/core/llm-api.js';

describe('ChatService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('analyzeUserLevel()', () => {
    it('deve identificar nível técnico se houver termos como "throughput" ou "lead time"', () => {
      const messages = [
        { role: 'user', content: 'Qual é o nosso throughput atual?' }
      ];
      const level = ChatService.analyzeUserLevel(messages);
      expect(level).toBe('technical');
    });

    it('deve identificar nível didático se o usuário pedir explicações simples', () => {
      const messages = [
        { role: 'user', content: 'O que significa story point? Pode me dar um exemplo simples?' }
      ];
      const level = ChatService.analyzeUserLevel(messages);
      expect(level).toBe('didactic');
    });

    it('deve retornar neutro se não houver sinais claros ou se houver equilíbrio', () => {
      const messages = [
        { role: 'user', content: 'Olá, como vai?' }
      ];
      const level = ChatService.analyzeUserLevel(messages);
      expect(level).toBe('neutral');
    });

    it('deve considerar todo o histórico de mensagens', () => {
      const messages = [
        { role: 'user', content: 'Explica de forma simples' },
        { role: 'assistant', content: 'Claro...' },
        { role: 'user', content: 'E o p50?' }
      ];
      // techHits: 1 ('p50'), didHits: 1 ('simples') -> neutral.
      const level = ChatService.analyzeUserLevel(messages);
      expect(level).toBe('neutral');
    });
  });

  describe('buildContext()', () => {
    it('deve incluir dados da sprint no contexto', () => {
      const sprintData = {
        activeSprint: { path: 'Iteração\\Sprint 1', attributes: {} },
        stats: { bizDays: 3, allocPct: 90, total: 10, done: 2, blocked: 1, byMember: {} },
        capacity: { 'João': { activity: 'Dev', capRest: 10 } }
      };
      const context = ChatService.buildContext(sprintData);
      expect(context).toContain('SPRINT ATIVA: Sprint 1');
      expect(context).toContain('Alocação total: 90%');
      expect(context).toContain('João (Dev)');
    });

    it('deve incluir dados de eficiência e qualidade se fornecidos', () => {
      const efData = { avgThroughput: 5.5, avgLeadTime: 12, avgCycleTime: 8 };
      const qualData = { items: [ { fields: { 'System.State': 'New' } } ] };
      const context = ChatService.buildContext(null, efData, qualData);
      expect(context).toContain('EFICIÊNCIA');
      expect(context).toContain('Throughput médio: 5.5');
      expect(context).toContain('QUALIDADE');
      expect(context).toContain('Abertos: 1');
    });
  });

  describe('formatMessage()', () => {
    it('deve renderizar negrito e itálico corretamente', () => {
      const raw = 'Texto **negrito** e *itálico*.';
      const html = ChatService.formatMessage(raw);
      expect(html).toContain('<strong>negrito</strong>');
      expect(html).toContain('<em>itálico</em>');
    });

    it('deve renderizar código em linha', () => {
      const raw = 'Use o comando `git status`.';
      const html = ChatService.formatMessage(raw);
      expect(html).toContain('<code class="md-code">git status</code>');
    });
  });

  describe('sendMessage()', () => {
    it('deve chamar LLMAPI e retornar resposta formatada', async () => {
      // Mock Store
      jest.spyOn(Store, 'getActiveLlm').mockReturnValue({ id: 'llm1', provider: 'openai' });
      jest.spyOn(Store, 'getActiveLlmToken').mockResolvedValue('fake-token');
      jest.spyOn(Store, 'getUserProfile').mockReturnValue({ level: 'neutral', override: false });

      // Mock LLMAPI
      const mockResponse = 'Essa é a resposta da IA.';
      jest.spyOn(LLMAPI, 'call').mockResolvedValue(mockResponse);

      const result = await ChatService.sendMessage('Pergunta teste', { history: [] });
      
      expect(result.response).toBe(mockResponse);
      expect(result.userMsg.content).toBe('Pergunta teste');
      expect(LLMAPI.call).toHaveBeenCalledWith('openai', 'fake-token', expect.any(String), 'Pergunta teste');
    });

    it('deve respeitar override de perfil do usuário', async () => {
      jest.spyOn(Store, 'getActiveLlm').mockReturnValue({ id: 'llm1', provider: 'openai' });
      jest.spyOn(Store, 'getActiveLlmToken').mockResolvedValue('fake-token');
      jest.spyOn(Store, 'getUserProfile').mockReturnValue({ level: 'technical', override: true });
      
      const callSpy = jest.spyOn(LLMAPI, 'call').mockResolvedValue('Resp');

      await ChatService.sendMessage('Pergunta');
      
      const systemPrompt = callSpy.mock.calls[0][2];
      expect(systemPrompt).toContain('PERFIL: Técnico');
    });
  });
});
