// src/core/store.js

/**
 * Store - Módulo de persistência (localStorage)
 *
 * Durante a transição, este módulo acessa globalThis.APP e globalThis.Vault
 * Quando a migração estiver concluída para ESModules, passaremos as dependências
 * via injeção/import.
 */

export const Store = {
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
  
  getActiveTeamId() { 
    return localStorage.getItem('avai_active_team') || null; 
  },
  setActiveTeamId(id) { 
    localStorage.setItem('avai_active_team', id); 
  },
  
  getActiveTeam() { 
    const id = this.getActiveTeamId(); 
    return id ? this.getTeams().find(t => t.id === id) || null : null; 
  },
  
  async getActivePat() {
    const t = this.getActiveTeam(); 
    if (!t) return null;
    
    if (globalThis.APP && globalThis.APP.vaultMode === 'session') {
      return globalThis.APP.sessionTokens.teams[t.id] || (t.orgId && globalThis.APP.sessionTokens.orgs[t.orgId]) || null;
    }
    
    if (!globalThis.Vault) return null;

    if (t.patEnc) return globalThis.Vault.decryptToken(t.patEnc);
    if (t.orgId) {
      const org = this.getOrgs().find(o => o.id === t.orgId);
      if (org?.patEnc) return globalThis.Vault.decryptToken(org.patEnc);
    }
    return null;
  },
  
  getActiveLlm() { 
    return this.getLlmList().find(l => l.active) || null; 
  },
  
  async getActiveLlmToken() {
    const l = this.getActiveLlm(); 
    if (!l) return null;
    
    if (globalThis.APP && globalThis.APP.vaultMode === 'session') {
      return globalThis.APP.sessionTokens.llms[l.id] || null;
    }
    
    if (!globalThis.Vault) return null;
    return globalThis.Vault.decryptToken(l.tokenEnc);
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
