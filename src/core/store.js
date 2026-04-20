/**
 * AgileViewAI - Store Core (ESM)
 * Responsável pela persistência (localStorage) e gerenciamento de estado persistente.
 */

import { AppState } from './app-state.js';
import { Vault } from './vault.js';

const RealStore = {
  _g(k, d = []) {
    try { 
      return JSON.parse(localStorage.getItem(k)) ?? d; 
    } catch { 
      return d; 
    }
  },
  _s(k, v) { 
    localStorage.setItem(k, JSON.stringify(v)); 
  },
  
  init() {},
  clear() { localStorage.clear(); },
  
  getTeams() { return this._g('avai_teams'); },
  saveTeams(v) { this._s('avai_teams', v); },
  
  getOrgs() { return this._g('avai_orgs'); },
  saveOrgs(v) { this._s('avai_orgs', v); },
  
  getLlmList() { return this._g('avai_llm'); },
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
  setActiveTeamId(id) { localStorage.setItem('avai_active_team', id); },
  
  getActiveTeam() { 
    const id = this.getActiveTeamId(); 
    return id ? this.getTeams().find(t => t.id === id) || null : null; 
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
      const dec = await Vault.decryptToken(t.patEnc);
      return dec === t.patEnc ? null : dec; // Se retornou o mesmo, não decriptou
    }
    if (t.orgId) {
      const org = this.getOrgs().find(o => o.id === t.orgId);
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

// Exporta um Proxy que prefere o Mock Global se existir (para testes Jest)
export const Store = new Proxy(RealStore, {
  get(target, prop) {
    if (globalThis.Store !== undefined && globalThis.Store !== null && globalThis.Store[prop] !== undefined) {
      return globalThis.Store[prop];
    }
    return target[prop];
  }
});
