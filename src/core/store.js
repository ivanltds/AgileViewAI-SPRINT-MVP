/**
 * AgileViewAI - Store Core (ESM)
 * Responsável pela persistência (localStorage) e gerenciamento de estado persistente.
 */

import { AppState } from './app-state.js';
import { Vault } from './vault.js';

const RealStore = {
  data: {},
  _mem: {},
  _listeners: {},

  _optimizeSprintData(data) {
    if (!data) return data;
    const clean = JSON.parse(JSON.stringify(data)); // Deep clone
    if (clean.backlog) {
      clean.backlog = clean.backlog.map(i => {
        const { _raw, metadata, _links, ...rest } = i;
        return rest;
      });
    }
    if (clean.tasks) {
      clean.tasks = clean.tasks.map(t => {
        const { _raw, metadata, _links, ...rest } = t;
        return rest;
      });
    }
    return clean;
  },

  _g(k, d = []) {
    // Preferência para a versão em memória se ela existir (mais recente em caso de erro de cota)
    if (this._mem[k] !== undefined) return this._mem[k];
    
    try { 
      const v = localStorage.getItem(k);
      return (v !== null) ? JSON.parse(v) : d; 
    } catch { 
      return d; 
    }
  },
  _s(k, v) { 
    let finalValue = v;
    if (k === 'avai_sprint_cache') {
      finalValue = this._optimizeSprintData(v);
    }

    try {
      localStorage.setItem(k, JSON.stringify(finalValue)); 
    } catch (e) {
      console.warn(`[Store] Failed to save "${k}" to localStorage:`, e.name);
      
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        // Tentativa de limpeza suave para liberar espaço
        console.info('[Store] Quota exceeded. Attempting soft cleanup...');
        localStorage.removeItem('avai_insights');
        localStorage.removeItem('avai_backlog');
        
        try {
          localStorage.setItem(k, JSON.stringify(finalValue));
          console.info(`[Store] Retried saving "${k}" after cleanup: SUCCESS`);
        } catch (e2) {
          console.error(`[Store] Still failing to save "${k}" to localStorage. Falling back to memory.`);
          this._mem[k] = finalValue;
        }
      } else {
        this._mem[k] = finalValue;
      }
    }
    
    this._emit('update', { key: k, value: finalValue });
    this._emit(`update:${k}`, finalValue);
  },

  on(ev, cb) {
    if (!this._listeners[ev]) this._listeners[ev] = [];
    this._listeners[ev].push(cb);
  },

  off(ev, cb) {
    if (!this._listeners[ev]) return;
    this._listeners[ev] = this._listeners[ev].filter(l => l !== cb);
  },

  _emit(ev, data) {
    if (!this._listeners[ev]) return;
    this._listeners[ev].forEach(cb => {
      try { cb(data); } catch (e) { console.error(`[Store] Error in listener for ${ev}:`, e); }
    });
  },
  
  init() {},
  clear() { 
    localStorage.clear(); 
    this._mem = {};
  },
  clearMemory() {
    this._mem = {};
  },
  
  getStorageStatus() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        total += localStorage.getItem(k).length * 2; // UTF-16
    }
    return {
        usedBytes: total,
        usedKB: Math.round(total / 1024),
        memKeys: Object.keys(this._mem),
        quotaLimit: '5MB (est.)'
    };
  },
  getTeams() { 
    const t = this._g('avai_teams'); 
    return Array.isArray(t) ? t : [];
  },
  saveTeams(v) { this._s('avai_teams', v); },
  
  getOrgs() { 
    const o = this._g('avai_orgs');
    return Array.isArray(o) ? o : [];
  },
  saveOrgs(v) { this._s('avai_orgs', v); },
  
  getLlmList() { 
    const l = this._g('avai_llm');
    return Array.isArray(l) ? l : [];
  },
  saveLlmList(v) { this._s('avai_llm', v); },
  
  getRagList() { return this._g('avai_rag'); },
  saveRagList(v) { this._s('avai_rag', v); },
  
  getChatConvs() { return this._g('avai_chat_convs', []); },
  saveChatConvs(v) { this._s('avai_chat_convs', v); },
  
  getInsightFeedback() { return this._g('avai_insight_fb', []); },
  saveInsightFeedback(v) { this._s('avai_insight_fb', v); },
  
  getUserProfile() { 
    return this._g('avai_user_profile', { level: 'neutral', override: false, updatedAt: null }); 
  },
  saveUserProfile(v) { this._s('avai_user_profile', v); },
  
  getSprintCache() { return this._g('avai_sprint_cache', null); },
  saveSprintCache(v) { this._s('avai_sprint_cache', v); },
  
  getBacklog() { return this._g('avai_backlog', []); },
  setBacklog(v) { this._s('avai_backlog', v); },
  
  getInsights() { return this._g('avai_insights', null); },
  setInsights(v) { this._s('avai_insights', v); },
  
  getActiveTeamId() { return localStorage.getItem('avai_active_team') || null; },
  setActiveTeamId(id) { 
    const current = localStorage.getItem('avai_active_team');
    if (current !== id) {
      localStorage.setItem('avai_active_team', id);
      // Limpeza atômica de cache para evitar vazamento de dados entre times
      localStorage.removeItem('avai_sprint_cache');
      localStorage.removeItem('avai_backlog');
      localStorage.removeItem('avai_insights');
      
      // Notifica os componentes ESM imediatamente
      this._emit('update:avai_sprint_cache', null);
      console.log(`[Store] Active team changed to ${id}. Caches cleared.`);
    }
  },
  
  getActiveTeam() { 
    const id = this.getActiveTeamId(); 
    const teams = this.getTeams();
    if (!id || !Array.isArray(teams)) return null;
    return teams.find(t => t.id === id) || null; 
  },
  
  async getActivePat() {
    const t = this.getActiveTeam(); 
    if (!t) return null;
    
    // Se o Vault foi explicitamente removido (testes), falha graciosamente
    if (globalThis.Vault === null) return null;

    const mode = AppState.vaultMode;
    const tokens = AppState.sessionTokens;
    if (mode === 'session' && tokens) {
      return tokens.teams[t.id] || (t.orgId && tokens.orgs[t.orgId]) || null;
    }
    if (t.patEnc) {
      if (mode === 'session' || t.patEnc.startsWith('mock-')) return t.patEnc;
      try {
        const dec = await Vault.decryptToken(t.patEnc);
        return dec === t.patEnc ? null : dec;
      } catch (e) {
        console.warn('[Store] Decryption failed, returning null', e);
        return null;
      }
    }
    if (t.orgId || t.org) {
      let org = this.getOrgs().find(o => String(o.id) === String(t.orgId));
      if (!org && t.org) {
        org = this.getOrgs().find(o => o.name === t.org);
        if (org) console.info(`[Store] Fallback found for team "${t.name}" via org name "${t.org}"`);
      }
      if (org?.patEnc) {
        const dec = await Vault.decryptToken(org.patEnc);
        return dec === org.patEnc ? null : dec;
      }
    }
    return null;
  },
  
  getActiveLlm() { return this.getLlmList().find(l => l.active) || null; },
  
  async getActiveLlmToken() {
    const l = this.getActiveLlm(); 
    if (!l) return null;
    
    if (globalThis.Vault === null) return null;

    const mode = AppState.vaultMode;
    const tokens = AppState.sessionTokens;
    if (mode === 'session' && tokens) return tokens.llms[l.id] || null;
    
    const dec = await Vault.decryptToken(l.tokenEnc);
    return dec === l.tokenEnc ? null : dec;
  },
  
  getActiveRag() {
    const team = this.getActiveTeam();
    const all  = this.getRagList().filter(r => r.active !== false);
    const spec = all.filter(r => r.scope === 'team' && r.teamId === (team ? team.id : null));
    const gen  = all.filter(r => r.scope === 'geral');
    return [...spec, ...gen].map(r => `## ${r.type}\n${r.spec}`).join('\n\n');
  },
  
  getAgentPrompts() { return this._g('avai_agent_prompts', {}); },
  saveAgentPrompts(v) { this._s('avai_agent_prompts', v); }
};

// Exporta o Store modular como a única fonte de verdade
export const Store = RealStore;

// Ponte agressiva para substituir o Store legado no window
if (typeof window !== 'undefined') {
  window.Store = RealStore;
  console.log('[Store] Modular store has taken control of window.Store');
}
