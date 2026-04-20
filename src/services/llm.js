/**
 * AgileViewAI - LLM Service (ESM)
 */

import { Store } from '../core/store.js';

export const LLMService = {
  async call(provider, token, systemPrompt, userPrompt) {
    if (provider === 'claude') return this._callClaude(token, systemPrompt, userPrompt);
    if (provider === 'openai') return this._callOpenAI(token, systemPrompt, userPrompt);
    if (provider === 'gemini') return this._callGemini(token, systemPrompt, userPrompt);
    throw new Error('Provider desconhecido: ' + provider);
  },

  async _callClaude(token, systemPrompt, userPrompt) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': token,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1500,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Claude ${r.status}: ${t.substring(0, 200)}`);
    }
    const d = await r.json();
    return d.content?.[0]?.text || '';
  },

  async _callOpenAI(token, systemPrompt, userPrompt) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`OpenAI ${r.status}: ${t.substring(0, 200)}`);
    }
    const d = await r.json();
    return d.choices?.[0]?.message?.content || '';
  },

  async _callGemini(token, systemPrompt, userPrompt) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `SYSTEM_PROMPT: ${systemPrompt}\n\nUSER_PROMPT: ${userPrompt}` }]
        }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.1 }
      })
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Gemini ${r.status}: ${t.substring(0, 200)}`);
    }
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },

  async runAgentChain(provider, token, userPrompt, onProgress) {
    const AGENT_DEFAULTS = {
      a1: `Você é um Agile Master sênior comprometido com a entrega do projeto.
Analise os dados de Sprint, Eficiência e Qualidade fornecidos e gere de 6 a 10 insights.
FORMATO: retorne SOMENTE um array JSON válido, sem markdown externo:
[{"severity":"critical|warning|info|ok","icon":"emoji","title":"Título com emoji","body":"2-3 frases com nomes e números reais."}]

SEVERIDADES:
critical 🚨 — risco real de não entrega; sobrecarga >110% NÃO justificada; bugs críticos sem resolução
warning  ⚠️ — 80-110% individual; bloqueios; fixing sem resolução; lead time alto; bugs High abertos
info     💡 — tendência histórica, oportunidade, padrão identificado nos dados
ok       ✅ — ponto positivo, melhoria observada, conformidade

Cubra: riscos de entrega, capacidade, bloqueios, qualidade e tendências de eficiência.
Use dados dos 3 módulos quando disponíveis. Cite sempre nomes e números reais.
NUNCA sugira redistribuição entre papéis diferentes (Dev ≠ QA ≠ Data Scientist).
CONSOLIDE todos os membros sobrecarregados em 1 único card critical.`,

      a2: `Você é um Agile Master criterioso revisando insights gerados por outro agente.
FORMATO: retorne SOMENTE o array JSON revisado, sem markdown externo.

Ao revisar, você deve:
1. REMOVER itens duplicados ou muito semelhantes — mantenha o mais completo e específico
2. AGRUPAR insights relacionados em um único card mais rico com todos os dados
3. VALIDAR se os números e métricas citados são coerentes entre si
4. CORRIGIR severity se incorreta (não marcar como critical o que é apenas warning)
5. MANTER entre 4 e 7 insights de alta qualidade

Não invente dados novos. Trabalhe apenas com o que foi fornecido.`,

      a3: `Você é um Agile Master comunicativo reescrevendo insights para máximo impacto e clareza.
FORMATO: retorne SOMENTE o array JSON reescrito, sem markdown externo.

Para cada card, aplique o tom adequado à severidade:
- critical 🚨: urgente e direto — destaque o risco e a ação necessária imediatamente
- warning  ⚠️: alerta construtivo com proposta de ação clara
- info     💡: consultivo e orientado a melhoria contínua
- ok       ✅: positivo e encorajador — reconheça o que está funcionando bem

Mantenha a estrutura JSON exata. Body: 2-3 frases claras, acionáveis e com dados específicos do time.
Não altere severity nem icon. Apenas reescreva title e body.`
    };

    const saved = Store.getAgentPrompts();
    const sys1 = saved.a1 || AGENT_DEFAULTS.a1;
    const sys2 = saved.a2 || AGENT_DEFAULTS.a2;
    const sys3base = saved.a3 || AGENT_DEFAULTS.a3;

    const stored = Store.getUserProfile();
    const profileLevel = stored.level || 'neutral';
    const profileInstr = {
      technical: 'PERFIL DO USUÁRIO: Técnico — use linguagem técnica, termos ágeis precisos e métricas sem simplificações.',
      didactic: 'PERFIL DO USUÁRIO: Didático — explique termos técnicos com analogias e exemplos práticos acessíveis.',
      neutral: 'PERFIL DO USUÁRIO: Equilibrado — balance clareza e precisão técnica, evite excesso de jargões.'
    }[profileLevel] || '';
    const sys3 = sys3base + (profileInstr ? `\n\n${profileInstr}` : '');

    onProgress?.('Agente 1 — Gerando insights…', 1);
    const raw1 = await this.call(provider, token, sys1, userPrompt);

    onProgress?.('Agente 2 — Revisando e deduplicando…', 2);
    const raw2 = await this.call(provider, token, sys2, `Revise e consolide os seguintes insights gerados:\n${raw1}`);

    onProgress?.('Agente 3 — Reescrevendo com tom adequado…', 3);
    const raw3 = await this.call(provider, token, sys3, `Reescreva os seguintes insights com o tom adequado a cada severidade e ao perfil do usuário:\n${raw2}`);

    return raw3;
  }
};
