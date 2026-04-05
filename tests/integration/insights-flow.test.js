// tests/integration/insights-flow.test.js
import { jest } from '@jest/globals';
import { InsightsService } from '../../src/services/insights.js';
import { LLMAPI } from '../../src/core/llm-api.js';
import { Store } from '../../src/core/store.js';

// jest.mock removido
describe('Integration: Insights Flow', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        LLMAPI.call = jest.fn();
        Store.getAgentPrompts = jest.fn().mockReturnValue({});
        Store.getUserProfile = jest.fn().mockReturnValue({ level: 'technical' });
    });

    test('Should execute full 3-agent chain (a1 -> a2 -> a3)', async () => {
        const provider = 'openai';
        const token = 'fake-token';
        const userPrompt = 'Dados da Sprint...';
        const onProgress = jest.fn();

        // Agent 1: Generation
        LLMAPI.call.mockResolvedValueOnce('[{"title": "Initial", "body": "Body 1"}]');
        // Agent 2: Revision
        LLMAPI.call.mockResolvedValueOnce('[{"title": "Revised", "body": "Body 2"}]');
        // Agent 3: Rewriting
        LLMAPI.call.mockResolvedValueOnce('[{"title": "Final", "body": "Body 3"}]');

        const result = await InsightsService.runAgentChain(provider, token, userPrompt, onProgress);

        expect(LLMAPI.call).toHaveBeenCalledTimes(3);
        expect(onProgress).toHaveBeenCalledTimes(3);
        expect(result).toBe('[{"title": "Final", "body": "Body 3"}]');

        // Verify the 3rd call used the technical profile context
        const sys3 = LLMAPI.call.mock.calls[2][2];
        expect(sys3).toContain('PERFIL DO USUÁRIO: Técnico');
    });

    test('Should respect custom agent prompts from Store', async () => {
        Store.getAgentPrompts.mockReturnValue({ a1: 'Custom Agent 1 Prompt' });
        
        LLMAPI.call.mockResolvedValue('[]');

        await InsightsService.runAgentChain('gemini', 'tok', 'usr', () => {});

        expect(LLMAPI.call).toHaveBeenCalledWith(
            'gemini', 
            'tok', 
            'Custom Agent 1 Prompt', 
            'usr'
        );
    });

    test('Should handle LLM errors in the middle of the chain', async () => {
        LLMAPI.call.mockRejectedValueOnce(new Error('LLM Down'));

        await expect(InsightsService.runAgentChain('openai', 'tok', 'usr'))
            .rejects.toThrow('LLM Down');
            
        expect(LLMAPI.call).toHaveBeenCalledTimes(1);
    });
});
