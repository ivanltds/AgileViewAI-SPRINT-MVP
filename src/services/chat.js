// src/services/chat.js
import { Store } from '../core/store.js';
import { LLMAPI } from '../core/llm-api.js';
import { Markdown } from '../utils/markdown.js';

const TECH_TERMS = [
  'story point', 'lead time', 'cycle time', 'throughput', 'velocity', 'wip', 
  'backlog', 'sprint', 'p50', 'p80', 'p95', 'desvio padrão', 'capacidade',
  'alocação', 'overhead', 'refinamento', 'débito técnico', 'endpoint', 'api', 'payload'
];

const DIDACTIC_SIGNALS = [
  'o que é', 'como funciona', 'não entendi', 'pode explicar', 'explicação', 
  'me explique', 'explique', 'simples', 'analogia', 'exemplo simples', 'exemplo prático', 'mais básico',
  'não conheço', 'o que significa', 'ajuda com o termo'
];

export const ChatService = {
  /**
   * Constrói o contexto RAG para o chat.
   */
  buildContext(sprintData, efData, qualData, recentFeedback = []) {
    const parts = [];
    const team = Store.getActiveTeam();

    // 1. Contexto do Time
    if (team) {
      parts.push(`[CONTEXTO DO TIME]\nTime: ${team.name}\nProjeto: ${team.proj}\nOrganização: ${team.org}\nEquipe Azure: ${team.azTeam}`);
    }

    // 2. RAG Geral e Específico
    const ragList = Store.getRagList().filter(r => r.active !== false);
    const generalRag = ragList.filter(r => r.scope === 'geral');
    if (generalRag.length) {
      parts.push('[CONTEXTO GERAL]\n' + generalRag.map(r => `## ${r.type}\n${r.spec}`).join('\n\n'));
    }
    if (team) {
      const teamRag = ragList.filter(r => r.scope === 'team' && r.teamId === team.id);
      if (teamRag.length) {
        parts.push('[TREINAMENTO DO TIME]\n' + teamRag.map(r => `## ${r.type}\n${r.spec}`).join('\n\n'));
      }
    }

    // 3. Dados da Sprint
    if (sprintData) {
      const { stats: s, activeSprint: sp, capacity: cap } = sprintData;
      const label = sp.path.split('\\').pop();
      const memberLines = Object.keys(cap).map(m => {
        const c = cap[m], bm = s.byMember?.[m] || { remaining: 0 };
        const alloc = c.capRest > 0 ? Math.round((bm.remaining / c.capRest) * 100) : 0;
        return `  ${m} (${c.activity}) | cap=${c.capRest}h | rem=${bm.remaining}h | alocação=${alloc}%`;
      }).join('\n');

      parts.push(`[SPRINT ATIVA: ${label}]\n` +
        `Início: ${sp.attributes?.startDate?.slice(0, 10) || '?'} | Fim: ${sp.attributes?.finishDate?.slice(0, 10) || '?'}\n` +
        `Dias úteis restantes: ${s.bizDays} | Alocação total: ${s.allocPct}%\n` +
        `PBIs: total=${s.total} | concluídos=${s.done} | bloqueados=${s.blocked}\n` +
        `Membros:\n${memberLines}`);
    }

    // 4. Dados de Eficiência
    if (efData) {
      parts.push(`[EFICIÊNCIA]\nThroughput médio: ${efData.avgThroughput} itens/sprint\nLead Time médio: ${efData.avgLeadTime}d | Cycle Time médio: ${efData.avgCycleTime}d`);
    }

    // 5. Dados de Qualidade
    if (qualData) {
      const q = qualData;
      const open = q.items?.filter(i => !['Done', 'Closed', 'Resolved'].includes(i.fields?.['System.State'])).length || 0;
      parts.push(`[QUALIDADE]\nTotal de Bugs/Defects: ${q.items?.length || 0} | Abertos: ${open}`);
    }

    // 6. Feedback Recente
    if (recentFeedback && recentFeedback.length) {
      parts.push('[FEEDBACK DO USUÁRIO]\n' + recentFeedback.slice(-10).map(f => `- [${f.rating}] ${f.insight.title}`).join('\n'));
    }

    return parts.join('\n\n');
  },

  /**
   * Analisa o nível do usuário com base no histórico recente.
   */
  analyzeUserLevel(messages) {
    const userMsgs = messages.filter(m => m.role === 'user');
    if (!userMsgs.length) return 'neutral';

    let techHits = 0;
    let didHits = 0;

    userMsgs.forEach(m => {
      const content = (m.content || '').toLowerCase();
      TECH_TERMS.forEach(t => { if (content.includes(t)) techHits++; });
      DIDACTIC_SIGNALS.forEach(d => { if (content.includes(d)) didHits++; });
    });

    if (techHits > didHits) return 'technical';
    if (didHits > techHits) return 'didactic';
    return 'neutral';
  },

  /**
   * Envia uma mensagem para o LLM.
   */
  async sendMessage(question, options = {}) {
    const { 
      convId, 
      history = [], 
      sprintData, 
      efData, 
      qualData, 
      ragContext, // Override if needed
      onThink = () => {} 
    } = options;

    const llmConf = Store.getActiveLlm();
    if (!llmConf) throw new Error('Nenhum token LLM configurado.');

    const token = await Store.getActiveLlmToken();
    if (!token) throw new Error('Token LLM indisponível (Vault bloqueado?).');

    // 1. Determina o nível do usuário (Inferência ou Override no Profile)
    const storedProfile = Store.getUserProfile();
    let userLevel = 'neutral';
    
    if (storedProfile.override) {
      userLevel = storedProfile.level;
    } else {
      userLevel = this.analyzeUserLevel([...history, { role: 'user', content: question }]);
    }

    const levelInstr = {
      technical: 'PERFIL: Técnico — use termos precisos (Lead Time, WIP, etc) e vá direto ao ponto.',
      didactic:  'PERFIL: Didático — explique termos ágeis com analogias e seja mais detalhista na clareza.',
      neutral:   'PERFIL: Equilibrado — balance clareza e precisão técnica.'
    }[userLevel];

    // 2. Constrói o System Prompt
    const context = ragContext || this.buildContext(sprintData, efData, qualData, Store.getInsightFeedback());
    const systemPrompt = `Você é AgileViewAI, um Agile Master sênior. 
Responda em português de forma objetiva, citando dados reais quando fornecidos. 
${levelInstr}

${context}`;

    onThink(true);

    try {
      const apiMessages = history.map(m => ({ role: m.role, content: m.content }));
      const response = await LLMAPI.call(llmConf.provider, token, systemPrompt, question);
      
      const userMsg = { role: 'user', content: question, timestamp: Date.now() };
      const aiMsg = { role: 'assistant', content: response, timestamp: Date.now() };
      
      onThink(false);
      return { response, userMsg, aiMsg, userLevel };
    } catch (e) {
      onThink(false);
      throw e;
    }
  },

  /**
   * Formata a mensagem Markdown para HTML.
   */
  formatMessage(content) {
    return Markdown.render(content);
  }
};
