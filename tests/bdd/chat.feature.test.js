import { jest } from '@jest/globals';
import { ChatService } from '../../src/services/chat.js';
import { Store } from '../../src/core/store.js';
import { LLMAPI } from '../../src/core/llm-api.js';

describe('BDD: Chat IA Flutuante', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    global.fetch = jest.fn();
    
    // Default mocks for Store
    jest.spyOn(Store, 'getActiveLlm').mockReturnValue({ id: 'llm1', provider: 'openai' });
    jest.spyOn(Store, 'getActiveLlmToken').mockResolvedValue('fake-token');
    jest.spyOn(Store, 'getUserProfile').mockReturnValue({ level: 'neutral', override: false });
    jest.spyOn(Store, 'getRagList').mockReturnValue([]);
    jest.spyOn(Store, 'getActiveTeam').mockReturnValue({ name: 'Time Alpha', proj: 'Projeto X', org: 'Org', azTeam: 'Alpha' });
  });

  // Feature: Chat de perguntas livres com IA
  
  /**
   * Scenario: Resposta renderiza Markdown corretamente
   */
  test('Cenário: Resposta renderiza Markdown corretamente', () => {
    // Given
    const aiResponse = '**Crítico**: A sprint está com atraso.';
    
    // When
    const html = ChatService.formatMessage(aiResponse);
    
    // Then
    expect(html).toContain('<strong>Crítico</strong>');
    expect(html).toContain('A sprint está com atraso.');
  });

  /**
   * Scenario: LLM responde com dados reais do time (RAG Context)
   */
  test('Cenário: LLM responde com dados reais do time', async () => {
    // Given o time tem 2 membros e dados de sprint
    const sprintData = {
      activeSprint: { path: 'Sprint 10', attributes: {} },
      stats: { bizDays: 5, allocPct: 85, total: 20, done: 5, blocked: 2, byMember: {} },
      capacity: { 
        'Ana QA': { activity: 'QA', capRest: 40 },
        'Bob Dev': { activity: 'Dev', capRest: 40 }
      }
    };
    
    const callSpy = jest.spyOn(LLMAPI, 'call').mockResolvedValue('OK');

    // When o usuário pergunta "Quantos membros no time?"
    await ChatService.sendMessage('Quantos membros no time?', { sprintData });

    // Then o prompt enviado ao LLM deve conter os dados reais
    const systemPrompt = callSpy.mock.calls[0][2];
    expect(systemPrompt).toContain('Time: Time Alpha');
    expect(systemPrompt).toContain('Ana QA (QA)');
    expect(systemPrompt).toContain('Bob Dev (Dev)');
    expect(systemPrompt).toContain('Alocação total: 85%');
  });

  /**
   * Scenario: Inferência de nível do usuário (Técnico)
   */
  test('Cenário: Pergunta técnica altera o tom do prompt para Técnico', async () => {
    // Given
    const history = [
      { role: 'user', content: 'Olá' },
      { role: 'assistant', content: 'Olá, como posso ajudar?' }
    ];
    const question = 'Qual o nosso throughput e lead time p80?';
    
    const callSpy = jest.spyOn(LLMAPI, 'call').mockResolvedValue('Resp');

    // When
    const result = await ChatService.sendMessage(question, { history });

    // Then
    expect(result.userLevel).toBe('technical');
    const systemPrompt = callSpy.mock.calls[0][2];
    expect(systemPrompt).toContain('PERFIL: Técnico');
    expect(systemPrompt).toContain('use termos precisos');
  });

  /**
   * Scenario: Inferência de nível do usuário (Didático)
   */
  test('Cenário: Pergunta simples altera o tom do prompt para Didático', async () => {
    // Given
    const question = 'Pode me explicar o que é WIP com um exemplo simples?';
    const callSpy = jest.spyOn(LLMAPI, 'call').mockResolvedValue('Resp');

    // When
    const result = await ChatService.sendMessage(question);

    // Then
    expect(result.userLevel).toBe('didactic');
    const systemPrompt = callSpy.mock.calls[0][2];
    expect(systemPrompt).toContain('PERFIL: Didático');
    expect(systemPrompt).toContain('explique termos ágeis com analogias');
  });

  /**
   * Scenario: Contexto RAG Geral é incluído
   */
  test('Cenário: Contexto RAG Geral é injetado no prompt', async () => {
    // Given
    jest.spyOn(Store, 'getRagList').mockReturnValue([
      { type: 'Processo', spec: 'Nossas dailies são às 9h.', scope: 'geral', active: true }
    ]);
    const callSpy = jest.spyOn(LLMAPI, 'call').mockResolvedValue('OK');

    // When
    await ChatService.sendMessage('Alguma regra de processo?');

    // Then
    const systemPrompt = callSpy.mock.calls[0][2];
    expect(systemPrompt).toContain('Nossas dailies são às 9h.');
    expect(systemPrompt).toContain('[CONTEXTO GERAL]');
  });

  /**
   * Scenario: Feedback do usuário calibra o prompt
   */
  test('Cenário: Feedback negativo de insights anteriores é enviado como contra-exemplo', async () => {
    // Given
    jest.spyOn(Store, 'getInsightFeedback').mockReturnValue([
      { rating: 'bad', insight: { title: 'Insight Ruim' } }
    ]);
    const callSpy = jest.spyOn(LLMAPI, 'call').mockResolvedValue('OK');

    // When
    await ChatService.sendMessage('Dê uma dica.');

    // Then
    const systemPrompt = callSpy.mock.calls[0][2];
    expect(systemPrompt).toContain('[FEEDBACK DO USUÁRIO]');
    expect(systemPrompt).toContain('[bad] Insight Ruim');
  });
});
