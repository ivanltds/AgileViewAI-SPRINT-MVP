// src/core/llm-api.js

/**
 * Módulo Core para chamadas diretas às APIs de LLM.
 * Centraliza a lógica de fetch e autenticação para diferentes providers.
 */
export const LLMAPI = {
  async call(provider, token, systemPrompt, userPrompt) {
    if (provider === 'claude')  return this._callClaude(token, systemPrompt, userPrompt);
    if (provider === 'openai')  return this._callOpenAI(token, systemPrompt, userPrompt);
    if (provider === 'gemini')  return this._callGemini(token, systemPrompt, userPrompt);
    throw new Error('Provider desconhecido: ' + provider);
  },

  async callQA(provider, token, fullPrompt) {
    if (provider === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{'Content-Type':'application/json','x-api-key':token,'anthropic-version':'2023-06-01'},
        body: JSON.stringify({ model:'claude-sonnet-4-5', max_tokens:800, temperature:0.1, messages:[{role:'user',content:fullPrompt}] })
      });
      if (!r.ok) throw new Error(`Claude QA ${r.status}: ${(await r.text()).substring(0,200)}`);
      const d = await r.json(); return d.content?.[0]?.text || '';
    }
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({ model:'gpt-4o', max_tokens:800, temperature:0.1, response_format:{type:'json_object'}, messages:[{role:'user',content:fullPrompt}] })
      });
      if (!r.ok) throw new Error(`OpenAI QA ${r.status}: ${(await r.text()).substring(0,200)}`);
      const d = await r.json(); return d.choices?.[0]?.message?.content || '';
    }
    if (provider === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${token}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{parts:[{text:fullPrompt}]}], generationConfig:{maxOutputTokens:800,temperature:0.1,responseMimeType:'application/json'} })
      });
      if (!r.ok) throw new Error(`Gemini QA ${r.status}: ${(await r.text()).substring(0,200)}`);
      const d = await r.json(); return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    throw new Error('Provider desconhecido: ' + provider);
  },

  async _callClaude(token, sys, usr) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json','x-api-key':token,'anthropic-version':'2023-06-01'},
      body: JSON.stringify({ model:'claude-sonnet-4-5', max_tokens:1400, temperature:0.2, system:sys, messages:[{role:'user',content:usr}] })
    });
    if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).substring(0,200)}`);
    const d = await r.json(); return d.content?.[0]?.text || '';
  },

  async _callOpenAI(token, sys, usr) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({ model:'gpt-4o', max_tokens:1400, temperature:0.2, messages:[{role:'system',content:sys},{role:'user',content:usr}] })
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).substring(0,200)}`);
    const d = await r.json(); return d.choices?.[0]?.message?.content || '';
  },

  async _callGemini(token, sys, usr) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${token}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ systemInstruction:{parts:[{text:sys}]}, contents:[{parts:[{text:usr}]}], generationConfig:{maxOutputTokens:1400,temperature:0.2} })
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).substring(0,200)}`);
    const d = await r.json(); return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },

  parseJson(raw) {
    if (!raw) throw new Error('LLM retornou resposta vazia.');
    let clean = raw.replace(/```json/gi,'').replace(/```/g,'').trim();
    const s = clean.indexOf('['), e = clean.lastIndexOf(']');
    if (s === -1 || e === -1) return [{ severity:'info', icon:'info', title:'Resposta', body: clean.substring(0,400) }];
    try {
      const arr = JSON.parse(clean.substring(s, e+1));
      if (!Array.isArray(arr) || !arr.length) throw new Error('vazio');
      return arr.map(item => {
        let body = String(item.body||'');
        if (body.includes('Explique em 1 frase') || body.includes('resposta objetiva com dados reais') || body === 'resposta')
          body = 'Não foi possível gerar resposta específica. Reformule a pergunta.';
        return { 
          severity: ['critical','warning','info','ok'].includes(item.severity) ? item.severity : 'info', 
          icon: String(item.icon||'info'), 
          title: String(item.title||'Resposta'), 
          body 
        };
      });
    } catch { 
      return [{ severity:'info', icon:'info', title:'Resposta', body: clean.replace(/[\[\]{}\"]/g,'').trim().substring(0,400) }]; 
    }
  }
};
