// tests/integration/chat-flow.test.js
import { jest } from '@jest/globals';
import { ChatService } from '../../src/services/chat.js';
import { LLMAPI } from '../../src/core/llm-api.js';
import { Store } from '../../src/core/store.js';

// removido jest.mock para compatibilidade ESM

describe('Integration: Chat Flow', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock manual ESM
        LLMAPI.call = jest.fn();
        Store.getActiveLlm = jest.fn().mockReturnValue({ provider: 'gemini' });
        Store.getActiveLlmToken = jest.fn().mockResolvedValue('fake-gemini-key');
        Store.getUserProfile = jest.fn().mockReturnValue({ level: 'neutral', override: false });
        Store.getActiveTeam = jest.fn().mockReturnValue({ name: 'Team Alpha', id: 'T1', proj: 'P1', org: 'O1', azTeam: 'AzT1' });
        Store.getRagList = jest.fn().mockReturnValue([]);
        Store.getInsightFeedback = jest.fn().mockReturnValue([]);
    });

    test('Should build RAG context and send message with correct system prompt', async () => {
        const question = 'Como está o lead time?';
        const sprintData = { 
            activeSprint: { path: 'Iter1', attributes: { startDate: '2026-01-01' } }, 
            stats: { total: 10, done: 5, totalRem: 20, capacityTotal: 40, allocPct: 50, bizDays: 5, byMember: {} },
            capacity: { 'João': { activity: 'Dev', capRest: 20 } }
        };
        const efData = { avgThroughput: 5, avgLeadTime: 10, avgCycleTime: 8 };
        const qualData = { items: [{ fields: { 'System.State': 'Active' } }] };

        LLMAPI.call.mockResolvedValue('Resposta da IA');

        const result = await ChatService.sendMessage(question, { sprintData, efData, qualData });

        expect(LLMAPI.call).toHaveBeenCalled();
        const [provider, token, sysprompt, usrprompt] = LLMAPI.call.mock.calls[0];

        // Verify context contents
        expect(sysprompt).toContain('[CONTEXTO DO TIME]');
        expect(sysprompt).toContain('Team Alpha');
        expect(sysprompt).toContain('[SPRINT ATIVA: Iter1]');
        expect(sysprompt).toContain('[EFICIÊNCIA]');
        expect(sysprompt).toContain('Lead Time médio: 10d');
        expect(sysprompt).toContain('[QUALIDADE]');
        expect(sysprompt).toContain('Abertos: 1');

        expect(result.response).toBe('Resposta da IA');
    });

    test('Should detect didactic tone and adjust profile prompt', async () => {
        const question = 'Não entendi, o que é Story Point? Pode me dar um exemplo simples?';
        
        LLMAPI.call.mockResolvedValue('Sim, Story Point é...');

        const result = await ChatService.sendMessage(question, { history: [] });

        expect(result.userLevel).toBe('didactic');
        const sysprompt = LLMAPI.call.mock.calls[0][2];
        expect(sysprompt).toContain('PERFIL: Didático');
    });

    test('Should detect technical tone based on keywords', () => {
        const history = [
            { role: 'user', content: 'Qual o lead time p95 do throughput atual?' }
        ];
        const level = ChatService.analyzeUserLevel(history);
        expect(level).toBe('technical');
    });

    test('Should respect manual profile override in Store', async () => {
        Store.getUserProfile.mockReturnValue({ level: 'technical', override: true });

        const result = await ChatService.sendMessage('Explique o que é pobi.', { history: [] });

        expect(result.userLevel).toBe('technical'); // Even if question sounds didactic, override is on
    });
});
