
// ═══════════════════════════════════════════════════════════════════
//  AgileViewAI v2.1  —  Standalone SPA
// ═══════════════════════════════════════════════════════════════════

// ── APP STATE ───────────────────────────────────────────────────────
const APP = {
  vaultKey: null, vaultMode: null,
  sprintData: null, insightCards: [], syncRunning: false,
  allIterations: [],
  eficienciaData: null, efChartMode: { flow:'throughput', time:'lead' },
  qualidadeData: null, qualTipo: 'ambos', qualEstado: 'aberto', qualSeverity: 'todas',
  // Session-mode: in-memory token store (never touches localStorage)
  sessionTokens: { teams:{}, llms:{}, orgs:{} },
  // Floating chat
  chatConvId: null, chatMessages: [],
};

// ── VAULT (AES-256-GCM + PBKDF2) ───────────────────────────────────
const Vault = {
  async deriveKey(pin, saltBuf) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'PBKDF2', salt:saltBuf, iterations:600000, hash:'SHA-256' }, km, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
  },
  async encrypt(key, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
    const buf = new Uint8Array(iv.byteLength + ct.byteLength);
    buf.set(iv, 0); buf.set(new Uint8Array(ct), iv.byteLength);
    return btoa(String.fromCharCode(...buf));
  },
  async decrypt(key, b64) {
    const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const pt  = await crypto.subtle.decrypt({ name:'AES-GCM', iv: buf.slice(0,12) }, key, buf.slice(12));
    return new TextDecoder().decode(pt);
  },
  getSalt() {
    let s = localStorage.getItem('avai_vault_salt');
    if (!s) { const b = crypto.getRandomValues(new Uint8Array(16)); s = btoa(String.fromCharCode(...b)); localStorage.setItem('avai_vault_salt', s); }
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  },
  isSetup() { return !!localStorage.getItem('avai_vault_salt') && !!localStorage.getItem('avai_vault_check'); },
  async setupPin(pin) {
    const key = await this.deriveKey(pin, this.getSalt());
    localStorage.setItem('avai_vault_check', await this.encrypt(key, 'avai_ok'));
    return key;
  },
  async verifyPin(pin) {
    const key = await this.deriveKey(pin, this.getSalt());
    const check = localStorage.getItem('avai_vault_check');
    if (!check) return key;
    try { return (await this.decrypt(key, check)) === 'avai_ok' ? key : null; } catch { return null; }
  },
  async encryptToken(plain) {
    if (!APP.vaultKey) return plain;
    return this.encrypt(APP.vaultKey, plain);
  },
  async decryptToken(cipher) {
    if (!APP.vaultKey) return cipher;
    try { return await this.decrypt(APP.vaultKey, cipher); } catch { return ''; }
  },
  // Re-encrypt all stored tokens with a new key
  async reencryptAll(oldKey, newKey) {
    const teams = Store.getTeams();
    for (const t of teams) {
      if (t.patEnc) { const plain = await this.decrypt(oldKey, t.patEnc); t.patEnc = await this.encrypt(newKey, plain); }
    }
    Store.saveTeams(teams);
    const llms = Store.getLlmList();
    for (const l of llms) {
      if (l.tokenEnc) { const plain = await this.decrypt(oldKey, l.tokenEnc); l.tokenEnc = await this.encrypt(newKey, plain); }
    }
    Store.saveLlmList(llms);
  }
};

// ── STORAGE (localStorage) ──────────────────────────────────────────
const Store = {
  _g(k, d=[]) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  _s(k, v)    { localStorage.setItem(k, JSON.stringify(v)); },
  getTeams()         { return this._g('avai_teams'); },
  saveTeams(v)       { this._s('avai_teams', v); },
  getOrgs()          { return this._g('avai_orgs'); },
  saveOrgs(v)        { this._s('avai_orgs', v); },
  getLlmList()       { return this._g('avai_llm'); },
  saveLlmList(v)     { this._s('avai_llm', v); },
  getRagList()       { return this._g('avai_rag'); },
  saveRagList(v)     { this._s('avai_rag', v); },
  getChatConvs()          { return this._g('avai_chat_convs', []); },
  saveChatConvs(v)         { this._s('avai_chat_convs', v); },
  getInsightFeedback()     { return this._g('avai_insight_fb', []); },
  saveInsightFeedback(v)   { this._s('avai_insight_fb', v); },
  getUserProfile()          { return this._g('avai_user_profile', { level:'neutral', override:false, updatedAt:null }); },
  saveUserProfile(v)        { this._s('avai_user_profile', v); },
  getSprintCache()   { return this._g('avai_sprint_cache', null); },
  saveSprintCache(v) { this._s('avai_sprint_cache', v); },
  getActiveTeamId()  { return localStorage.getItem('avai_active_team') || null; },
  setActiveTeamId(id){ localStorage.setItem('avai_active_team', id); },
  getActiveTeam()    { const id = this.getActiveTeamId(); return id ? this.getTeams().find(t => t.id === id) || null : null; },
  async getActivePat() {
    const t = this.getActiveTeam(); if (!t) return null;
    if (APP.vaultMode === 'session') {
      return APP.sessionTokens.teams[t.id] || (t.orgId && APP.sessionTokens.orgs[t.orgId]) || null;
    }
    if (t.patEnc) return Vault.decryptToken(t.patEnc);
    if (t.orgId) {
      const org = this.getOrgs().find(o => o.id === t.orgId);
      if (org?.patEnc) return Vault.decryptToken(org.patEnc);
    }
    return null;
  },
  getActiveLlm()     { return this.getLlmList().find(l => l.active) || null; },
  async getActiveLlmToken() {
    const l = this.getActiveLlm(); if (!l) return null;
    if (APP.vaultMode === 'session') return APP.sessionTokens.llms[l.id] || null;
    return Vault.decryptToken(l.tokenEnc);
  },
  getActiveRag() {
    const team = this.getActiveTeam();
    const all  = this.getRagList().filter(r => r.active !== false);
    const spec = all.filter(r => r.scope === 'team' && r.teamId === (team ? team.id : null));
    const gen  = all.filter(r => r.scope === 'geral');
    return [...spec, ...gen].map(r => `## ${r.type}\n${r.spec}`).join('\n\n');
  },
  getAgentPrompts()   { return this._g('avai_agent_prompts', {}); },
  saveAgentPrompts(v) { this._s('avai_agent_prompts', v); }
};

// ── AGENT DEFAULT PROMPTS ────────────────────────────────────────────
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

// ── AZURE API CLIENT ────────────────────────────────────────────────
const AzureAPI = {
  async _fetch(url, opts = {}) {
    const resp = await fetch(url, opts);
    if (!resp.ok) { const t = await resp.text(); throw new Error(`HTTP ${resp.status}: ${t.substring(0,200)}`); }
    return resp.json();
  },
  _auth(pat) { return { 'Authorization': 'Basic ' + btoa(':' + pat), 'Content-Type': 'application/json' }; },
  _encTeam(t) { return t.split(' ').map(encodeURIComponent).join('%20'); },

  async getIterations(org, proj, team, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/${this._encTeam(team)}/_apis/work/teamsettings/iterations?api-version=7.1`;
    const d = await this._fetch(url, { headers: this._auth(pat) });
    if (!d.value || !d.value.length) throw new Error(`Nenhuma sprint encontrada para o time "${team}".`);
    return d.value;
  },
  async getTeamCapacity(org, proj, team, iterationId, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/${this._encTeam(team)}/_apis/work/teamsettings/iterations/${encodeURIComponent(iterationId)}/capacities?api-version=7.1`;
    try {
      const d = await this._fetch(url, { headers: this._auth(pat) });
      return d.teamMembers || d.value || (Array.isArray(d) ? d : []);
    } catch { return []; }
  },
  async getWorkItemIds(org, proj, iterationPath, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const safe = iterationPath.replace(/'/g, "''");
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g,"''")}' AND [System.IterationPath] UNDER '${safe}' AND [System.WorkItemType] IN ('Product Backlog Item','Defect','Bug','Task') AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await this._fetch(url, { method:'POST', headers: this._auth(pat), body: JSON.stringify({ query: q }) });
    return (d.workItems || []).map(w => w.id);
  },
  async getWorkItemsBatch(org, proj, ids, pat) {
    if (!ids.length) return [];
    const fields = 'System.Id,System.WorkItemType,System.Title,System.State,System.Parent,System.AssignedTo,System.Tags,System.IterationPath,System.CreatedDate,Custom.Block,Microsoft.VSTS.Common.Severity,Microsoft.VSTS.Common.ClosedDate,Microsoft.VSTS.Scheduling.StoryPoints,Microsoft.VSTS.Scheduling.RemainingWork,Microsoft.VSTS.Scheduling.CompletedWork,Microsoft.VSTS.Common.Activity';
    const all = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i+200).join(',');
      const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems?ids=${chunk}&fields=${encodeURIComponent(fields)}&api-version=7.1`;
      try {
        const d = await this._fetch(url, { headers: this._auth(pat) });
        if (d.value) all.push(...d.value);
      } catch {}
    }
    return all;
  }
};

// ── EFICIÊNCIA API ───────────────────────────────────────────────────
const EficienciaAPI = {
  async getWorkItemIds(org, proj, iterPaths, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const cond = iterPaths.map(p=>`[System.IterationPath] UNDER '${p.replace(/'/g,"''")}'`).join(' OR ');
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g,"''")}' AND [System.WorkItemType] IN ('Product Backlog Item','Bug','Defect') AND (${cond}) AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await AzureAPI._fetch(url, { method:'POST', headers:AzureAPI._auth(pat), body:JSON.stringify({query:q}) });
    return (d.workItems||[]).map(w=>w.id);
  },
  async getWorkItems(org, proj, ids, pat) {
    if (!ids.length) return [];
    const fields = encodeURIComponent('System.Id,System.WorkItemType,System.State,System.IterationPath,System.CreatedDate,Microsoft.VSTS.Common.ActivatedDate,Microsoft.VSTS.Common.ClosedDate,Microsoft.VSTS.Scheduling.StoryPoints,System.BoardColumn,System.ChangedDate');
    const all = [];
    for (let i=0; i<ids.length; i+=200) {
      const chunk = ids.slice(i,i+200).join(',');
      const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems?ids=${chunk}&fields=${fields}&api-version=7.1`;
      try { const d = await AzureAPI._fetch(url,{headers:AzureAPI._auth(pat)}); if(d.value) all.push(...d.value); } catch {}
    }
    return all;
  },
  async getRevisions(org, proj, id, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems/${id}/revisions?api-version=7.1`;
    try { const d = await AzureAPI._fetch(url,{headers:AzureAPI._auth(pat)}); return d.value||[]; } catch { return []; }
  },
  async getTaskIds(org, proj, iterPaths, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const cond = iterPaths.map(p=>`[System.IterationPath] UNDER '${p.replace(/'/g,"''")}'`).join(' OR ');
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g,"''")}' AND [System.WorkItemType] = 'Task' AND (${cond}) ORDER BY [System.Id]`;
    try { const d = await AzureAPI._fetch(url,{method:'POST',headers:AzureAPI._auth(pat),body:JSON.stringify({query:q})}); return (d.workItems||[]).map(w=>w.id); } catch { return []; }
  },
  async getTasksIterPath(org, proj, ids, pat) {
    if (!ids.length) return {};
    const result = {};
    for (let i=0; i<ids.length; i+=200) {
      const chunk = ids.slice(i,i+200).join(',');
      const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems?ids=${chunk}&fields=${encodeURIComponent('System.Id,System.IterationPath')}&api-version=7.1`;
      try { const d = await AzureAPI._fetch(url,{headers:AzureAPI._auth(pat)}); (d.value||[]).forEach(it=>{ result[it.id]=it.fields['System.IterationPath']||'?'; }); } catch {}
    }
    return result;
  },
  async getOpenBugsCount(org, proj, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g,"''")}' AND [System.WorkItemType] IN ('Bug','Defect') AND [System.State] NOT IN ('Done','Closed','Resolved','Removed') ORDER BY [System.Id]`;
    try { const d = await AzureAPI._fetch(url,{method:'POST',headers:AzureAPI._auth(pat),body:JSON.stringify({query:q})}); return (d.workItems||[]).length; } catch { return 0; }
  }
};

// ── SPRINT HISTORY API ────────────────────────────────────────────────
const SprintAPI = {
  async getWorkItemIds(org, proj, iterPaths, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const cond = iterPaths.map(p=>`[System.IterationPath] UNDER '${p.replace(/'/g,"''")}'`).join(' OR ');
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g,"''")}' AND [System.WorkItemType] IN ('Product Backlog Item','Bug','Defect','Task') AND (${cond}) AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await AzureAPI._fetch(url, { method:'POST', headers:AzureAPI._auth(pat), body:JSON.stringify({query:q}) });
    return (d.workItems||[]).map(w=>w.id);
  },
  async getAllBacklogIds(org, proj, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g,"''")}' AND [System.WorkItemType] IN ('Product Backlog Item','Bug','Defect','Task') AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await AzureAPI._fetch(url, { method:'POST', headers:AzureAPI._auth(pat), body:JSON.stringify({query:q}) });
    return (d.workItems||[]).map(w=>w.id);
  }
};

// ── QUALIDADE API ─────────────────────────────────────────────────────
const QualidadeAPI = {
  async getIds(org, proj, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g,"''")}' AND [System.WorkItemType] IN ('Bug','Defect') AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await AzureAPI._fetch(url, {method:'POST',headers:AzureAPI._auth(pat),body:JSON.stringify({query:q})});
    return (d.workItems||[]).map(w=>w.id);
  },
  async getItems(org, proj, ids, pat) {
    if (!ids.length) return [];
    const fields = encodeURIComponent('System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,Microsoft.VSTS.Common.Severity,Microsoft.VSTS.Common.Priority,System.CreatedDate,Microsoft.VSTS.Common.ClosedDate,Microsoft.VSTS.Scheduling.RemainingWork,Microsoft.VSTS.Scheduling.CompletedWork,Microsoft.VSTS.Scheduling.OriginalEstimate');
    const all = [];
    for (let i=0; i<ids.length; i+=200) {
      const chunk = ids.slice(i,i+200).join(',');
      const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems?ids=${chunk}&fields=${fields}&api-version=7.1`;
      try { const d = await AzureAPI._fetch(url,{headers:AzureAPI._auth(pat)}); if(d.value) all.push(...d.value); } catch {}
    }
    return all;
  },
  async getDefectChildTaskIds(org, proj, defectIds, pat) {
    if (!defectIds.length) return {};
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const q = `SELECT [System.Id] FROM WorkItemLinks WHERE [Source].[System.Id] IN (${defectIds.join(',')}) AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' AND [Target].[System.WorkItemType] IN ('Task','Bug') MODE (MustContain)`;
    try {
      const d = await AzureAPI._fetch(url, {method:'POST',headers:AzureAPI._auth(pat),body:JSON.stringify({query:q})});
      const map = {};
      (d.workItemRelations||[]).forEach(r => {
        if (!r.source || !r.target) return;
        const p = String(r.source.id);
        if (!map[p]) map[p] = [];
        map[p].push(r.target.id);
      });
      return map;
    } catch { return {}; }
  }
};

// ── EFICIÊNCIA PROCESSOR ─────────────────────────────────────────────
const EficienciaProcessor = {
  _isDone(s){ const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'; },
  _days(d1,d2){ return Math.max(0,(new Date(d2)-new Date(d1))/86400000); },

  async compute(items, org, proj, pat, currentCap) {
    const done = items.filter(i=>this._isDone(i.fields['System.State']));

    // Group done items by sprint label
    const byIter = {};
    done.forEach(i => {
      const key = (i.fields['System.IterationPath']||'?').split('\\').pop();
      if (!byIter[key]) byIter[key] = { count:0, points:0, leadTimes:[], cycleTimes:[] };
      byIter[key].count++;
      byIter[key].points += Number(i.fields['Microsoft.VSTS.Scheduling.StoryPoints'])||0;
      const closed    = i.fields['Microsoft.VSTS.Common.ClosedDate'];
      const activated = i.fields['Microsoft.VSTS.Common.ActivatedDate'];
      const created   = i.fields['System.CreatedDate'];
      if (closed && created)   byIter[key].leadTimes.push(this._days(created,closed));
      if (closed && activated) byIter[key].cycleTimes.push(this._days(activated,closed));
    });
    const iterLabels = Object.keys(byIter).sort();

    // Overall averages  (Lead = criação→fechamento; Cycle = ativação→fechamento)
    const allLT = done.filter(i=>i.fields['System.CreatedDate']&&i.fields['Microsoft.VSTS.Common.ClosedDate']).map(i=>this._days(i.fields['System.CreatedDate'],i.fields['Microsoft.VSTS.Common.ClosedDate']));
    const allCT = done.filter(i=>i.fields['Microsoft.VSTS.Common.ActivatedDate']&&i.fields['Microsoft.VSTS.Common.ClosedDate']).map(i=>this._days(i.fields['Microsoft.VSTS.Common.ActivatedDate'],i.fields['Microsoft.VSTS.Common.ClosedDate']));
    const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

    // Sprint capacity from current sync
    const capTotal = Object.values(currentCap||{}).reduce((a,c)=>a+(c.capTotal||0),0);
    const avgThroughput = iterLabels.length ? iterLabels.reduce((a,k)=>a+byIter[k].count,0)/iterLabels.length : 0;

    // Board column time via revisions (sample: up to 40 done items)
    const _isDoneCol = c => { const cl=(c||'').toLowerCase(); return cl==='done'||cl==='closed'||cl==='resolved'||cl==='concluído'||cl==='completed'||cl==='finalizado'||cl==='fechado'; };
    const colTimes = {};
    for (const item of done) {
      const revs = await EficienciaAPI.getRevisions(org,proj,item.id,pat);
      for (let i=0; i<revs.length-1; i++) {
        const col = revs[i].fields?.['System.BoardColumn'] || revs[i].fields?.['System.State'] || '';
        const t1  = new Date(revs[i].fields?.['System.ChangedDate']||0);
        const t2  = new Date(revs[i+1].fields?.['System.ChangedDate']||0);
        const d   = (t2-t1)/86400000;
        if (col && d>0 && d<180 && !_isDoneCol(col)) {
          if (!colTimes[col]) colTimes[col]={total:0,count:0};
          colTimes[col].total+=d; colTimes[col].count++;
        }
      }
    }

    return {
      avgThroughput: Math.round(avg([...iterLabels.map(k=>byIter[k].count)])*10)/10,
      avgLeadTime:   Math.round(avg(allLT)*10)/10,
      avgCycleTime:  Math.round(avg(allCT)*10)/10,
      openBugs: 0, capTotal: Math.round(capTotal*10)/10,
      iterLabels, byIter, colTimes
    };
  }
};

// ── SHARED: max remaining work from revisions ────────────────────────
async function _fetchMaxRem(org, proj, ids, pat) {
  const result = {};
  const BATCH = 8;
  for (let i = 0; i < ids.length; i += BATCH) {
    await Promise.all(ids.slice(i, i + BATCH).map(async id => {
      try {
        const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems/${id}/revisions?api-version=7.1`;
        const d   = await AzureAPI._fetch(url, { headers: AzureAPI._auth(pat) });
        let max   = 0;
        (d.value||[]).forEach(r => {
          const v = Number(r.fields?.['Microsoft.VSTS.Scheduling.RemainingWork']||0);
          if (v > max) max = v;
        });
        result[id] = max;
      } catch { result[id] = 0; }
    }));
  }
  return result;
}

// ── DATA PROCESSOR ──────────────────────────────────────────────────
const DataProcessor = {
  _bizDays(startMs, endMs) {
    let n = 0, cur = startMs;
    while (cur <= endMs) { const d = new Date(cur).getUTCDay(); if (d !== 0 && d !== 6) n++; cur += 86400000; }
    return n;
  },
  _blockStatus(item) {
    const f     = item.fields;
    const tags  = String(f['System.Tags']||'').toLowerCase();
    const st    = String(f['System.State']||'').toLowerCase();
    const block = f['Custom.Block'];
    if (block === true || block === 'true' || block === 'True' || tags.includes('blocked') || tags.includes('bloqueado') || tags.includes('block') || st.includes('block')) return 'BLOCKED';
    if (tags.includes('fixing') || tags.includes('correção') || st.includes('fixing') || st.includes('fix ') || st === 'fix' || st.includes('corre') || st.includes('ajuste') || st.includes('reopen')) return 'FIXING';
    return 'CLEAR';
  },
  _dispName(v) { if (!v) return ''; if (typeof v === 'object') return v.displayName||''; return String(v); },
  _parseDaysOff(cap) {
    const year = new Date().getUTCFullYear();
    const out  = [];
    (cap.daysOff || []).forEach(d => {
      const s = new Date(d.start), e = new Date(d.end);
      let cur = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
      const end = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
      while (cur <= end) {
        const dt = new Date(cur), dow = dt.getUTCDay();
        if (dow !== 0 && dow !== 6) out.push(`${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}`);
        cur += 86400000;
      }
    });
    return out;
  },

  async sync() {
    const team = Store.getActiveTeam();
    if (!team) throw new Error('Nenhum time selecionado.');
    const pat = await Store.getActivePat();
    if (!pat) throw new Error('PAT inválido ou vault bloqueado.');
    const { org, proj, azTeam } = team;

    // Sprint ativa
    const iters = await AzureAPI.getIterations(org, proj, azTeam, pat);
    APP.allIterations = iters;
    const now   = Date.now();
    let active  = iters.find(it => {
      const s = it.attributes?.startDate ? new Date(it.attributes.startDate).getTime() : 0;
      // +1 day buffer so the last calendar day is always included regardless of UTC offset
      const e = it.attributes?.finishDate ? new Date(it.attributes.finishDate).getTime() + 86400000 : 0;
      return s <= now && now <= e;
    });
    if (!active) {
      // Fallback: most recently ENDED sprint (largest finishDate that is still in the past)
      const past = iters.filter(it => it.attributes?.finishDate && new Date(it.attributes.finishDate).getTime() < now);
      if (past.length) {
        past.sort((a,b) => new Date(b.attributes.finishDate) - new Date(a.attributes.finishDate));
        active = past[0];
      } else {
        // All sprints are future — pick the next upcoming one
        iters.sort((a,b) => new Date(a.attributes?.startDate||0) - new Date(b.attributes?.startDate||0));
        active = iters[0];
      }
    }
    if (!active) throw new Error('Nenhuma sprint ativa encontrada.');

    const iterPath  = active.path;
    const iterStart = active.attributes?.startDate;
    const iterEnd   = active.attributes?.finishDate;

    // Work items
    const ids   = await AzureAPI.getWorkItemIds(org, proj, iterPath, pat);
    const items = await AzureAPI.getWorkItemsBatch(org, proj, ids, pat);

    const backlog = [], tasks = [];
    items.forEach(item => {
      const type     = item.fields['System.WorkItemType'];
      const parentId = item.fields['System.Parent'];
      const isTask   = type === 'Task' || type === 'Bug';
      const obj = {
        id: item.id, type, title: item.fields['System.Title'],
        state: item.fields['System.State'],
        assignedTo: this._dispName(item.fields['System.AssignedTo']),
        blockStatus: this._blockStatus(item)
      };
      if (isTask) {
        tasks.push({ ...obj, parentId: parentId||null,
          remaining: Number(item.fields['Microsoft.VSTS.Scheduling.RemainingWork'])||0,
          completed: Number(item.fields['Microsoft.VSTS.Scheduling.CompletedWork'])||0,
          activity: item.fields['Microsoft.VSTS.Common.Activity']||'' });
      } else {
        backlog.push({ ...obj,
          severity:     item.fields['Microsoft.VSTS.Common.Severity']||'',
          tags:         item.fields['System.Tags']||'',
          storyPoints:  Number(item.fields['Microsoft.VSTS.Scheduling.StoryPoints'])||0,
          remainingWork:Number(item.fields['Microsoft.VSTS.Scheduling.RemainingWork'])||0 });
      }
    });

    // Max remaining work from revisions → estimated effort per task
    if (tasks.length) {
      const maxRem = await _fetchMaxRem(org, proj, tasks.map(t=>t.id), pat);
      tasks.forEach(t => { t.estimated = maxRem[t.id] ?? t.remaining; });
    } else {
      tasks.forEach(t => { t.estimated = t.remaining; });
    }
    // Estimativa column per backlog item = sum of child task estimates (incl. done)
    const estMap = {}, remMap = {};
    const _isDoneT = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'; };
    tasks.forEach(t => {
      const p = String(t.parentId||'');
      if (!estMap[p]) estMap[p] = 0;
      estMap[p] += t.estimated || 0;
      // childRem: only open tasks
      if (!_isDoneT(t.state)) {
        if (!remMap[p]) remMap[p] = 0;
        remMap[p] += t.remaining || 0;
      }
    });
    backlog.forEach(b => {
      b.estimativa = estMap[String(b.id)] || 0;
      b.childRem   = remMap[String(b.id)] || 0;
    });

    // Capacity
    const capRaw = await AzureAPI.getTeamCapacity(org, proj, azTeam, active.id, pat);
    const now2    = new Date();
    const todayMs = Date.UTC(now2.getUTCFullYear(), now2.getUTCMonth(), now2.getUTCDate());
    const endMs   = iterEnd   ? new Date(iterEnd).getTime()   : todayMs;
    const startMs = iterStart ? new Date(iterStart).getTime() : todayMs;
    const bizDays = this._bizDays(todayMs, endMs);
    const totBizDays = this._bizDays(startMs, endMs);

    const capacity = {};
    capRaw.forEach(c => {
      const name = this._dispName(c.teamMember); if (!name) return;
      const act    = c.activities?.[0]?.name || '';
      const capDay = Number(c.activities?.[0]?.capacityPerDay) || 0;
      const allOff = this._parseDaysOff(c);
      const futureOff = allOff.filter(d => {
        const [dd,mm] = d.split('/').map(Number);
        return Date.UTC(now2.getUTCFullYear(), mm-1, dd) >= todayMs;
      });
      capacity[name] = {
        activity:     act,
        capPerDay:    capDay,
        daysOffStr:   futureOff.join(', ') || '—',
        daysOffTotal: allOff.length,
        capTotal:     Math.round(capDay * Math.max(totBizDays - allOff.length, 0) * 10) / 10,
        capRest:      Math.round(capDay * Math.max(bizDays - futureOff.length, 0) * 10) / 10
      };
    });

    const stats = this._calcStats(backlog, tasks, capacity, bizDays, todayMs);
    const data  = { team, activeSprint:{ path:iterPath, startRaw:iterStart, endRaw:iterEnd, bizDaysLeft:bizDays }, backlog, tasks, capacity, stats, syncedAt: new Date().toISOString() };
    Store.saveSprintCache(data);
    APP.sprintData = data;
    return data;
  },

  _calcStats(backlog, tasks, capacity, bizDays, todayMs) {
    const _isDone = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'; };
    const _isProg = s => { const sl=(s||'').toLowerCase(); return sl.includes('progress')||sl.includes('ativo')||sl.includes('active')||sl.includes('andamento'); };
    const total      = backlog.length;
    const done       = backlog.filter(i => _isDone(i.state)).length;
    const blocked    = backlog.filter(i => i.blockStatus === 'BLOCKED').length;
    const fixing     = backlog.filter(i => i.blockStatus === 'FIXING').length;
    const inProgress = backlog.filter(i => _isProg(i.state) && i.blockStatus === 'CLEAR').length;
    const donePct    = total > 0 ? Math.round((done/total)*100) : 0;
    const totalRem       = tasks.reduce((a,t) => a+(t.remaining||0), 0);
    const totalTasksDone = tasks.filter(t => _isDone(t.state)).length;
    const totalTasksOpen = tasks.filter(t => !_isDone(t.state)).length;
    let capTotal = Object.values(capacity).reduce((a,c) => a+(c.capRest||0), 0);
    if (capTotal === 0 && bizDays > 0) capTotal = bizDays * 6 * Math.max(Object.keys(capacity).length, 1);
    const allocPct = capTotal > 0 ? Math.min(Math.round((totalRem/capTotal)*100), 999) : 0;

    const byMember = {};
    tasks.forEach(t => {
      const m = (t.assignedTo?.trim()) || 'Não atribuído';
      if (!byMember[m]) byMember[m] = { remaining:0, tasksDone:0 };
      if (_isDone(t.state)) byMember[m].tasksDone++;
      else byMember[m].remaining += (t.remaining||0);
    });

    const byActivity = {};
    Object.keys(capacity).forEach(m => {
      const act = capacity[m].activity || 'Não definido';
      if (!byActivity[act]) byActivity[act] = { capRest:0, capTotal:0, remaining:0, members:0 };
      byActivity[act].capRest  += capacity[m].capRest||0;
      byActivity[act].capTotal += capacity[m].capTotal||0;
      byActivity[act].members++;
    });
    tasks.forEach(t => {
      if (_isDone(t.state)) return;
      const m   = t.assignedTo?.trim() || '';
      const cap = m ? capacity[m] : null;
      const act = cap ? (cap.activity||'Não definido') : 'Não definido';
      if (!byActivity[act]) byActivity[act] = { capRest:0, capTotal:0, remaining:0, members:0 };
      byActivity[act].remaining += (t.remaining||0);
    });

    // Day off cards
    const dayOffCards = [];
    if (todayMs) {
      Object.keys(capacity).forEach(m => {
        const str = capacity[m].daysOffStr;
        if (!str || str === '—') return;
        str.split(',').forEach(part => {
          part = part.trim(); if (!part) return;
          const mx = part.match(/^(\d{1,2})\/(\d{1,2})$/);
          if (!mx) return;
          const ts = Date.UTC(new Date().getUTCFullYear(), parseInt(mx[2])-1, parseInt(mx[1]));
          if (ts >= todayMs) dayOffCards.push({ member:m, label:part, dateTs:ts, activity:capacity[m].activity });
        });
      });
      dayOffCards.sort((a,b) => a.dateTs - b.dateTs);
    }

    return { total, done, blocked, fixing, inProgress, donePct, totalRem, totalTasksDone, totalTasksOpen, bizDays, capacityTotal:capTotal, allocPct, byMember, byActivity, dayOffCards };
  }
};

// ── SVG ICON HELPERS ───────────────────────────────────────────────
const ICONS = {
  critical: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  warning:  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  ok:       `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  thumbUp:  `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`,
  thumbDn:  `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>`,
  lock:     `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  bot:      `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v1"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>`,
};
function _insIcon(sev) {
  const m = { critical:{svg:ICONS.critical,c:'var(--red)'}, warning:{svg:ICONS.warning,c:'var(--amber)'}, info:{svg:ICONS.info,c:'var(--blue)'}, ok:{svg:ICONS.ok,c:'var(--green)'} };
  const s = m[sev] || m.info;
  return `<span class="ins-icon" style="color:${s.c}">${s.svg}</span>`;
}

// ── DASHBOARD BUILDER ───────────────────────────────────────────────
const DB = {
  _e(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
  _fmtDate(v) {
    if (!v) return '';
    const M = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const d = new Date(v); if (isNaN(d.getTime())) return String(v);
    return d.getUTCDate() + ' de ' + M[d.getUTCMonth()];
  },
  _itemUrl(t, id) { return `https://dev.azure.com/${encodeURIComponent(t.org)}/${encodeURIComponent(t.proj)}/_workitems/edit/${id}`; },

  render(data) {
    const { team, activeSprint:sp, backlog, tasks, capacity, stats:s } = data;
    const e = this._e.bind(this);
    document.getElementById('db-no-data').style.display = 'none';

    // Topbar — update static bar info, no duplicate div
    const sprintLabel = sp.path.split('\\').pop();
    document.getElementById('db-topbar').innerHTML = '';
    document.getElementById('db-topbar-info').innerHTML =
      `<div style="font-weight:700;font-size:15px;color:var(--slate)">${e(team.proj)}</div>
       <div style="display:flex;align-items:center;gap:8px;margin-top:2px;flex-wrap:wrap">
         <span style="font-size:13px;color:var(--gray)">${e(team.org)} · ${e(team.name)}</span>
         <span style="font-size:13px;font-weight:600;color:var(--slate);display:flex;align-items:center;gap:4px"><span class="sprint-dot"></span>${e(sprintLabel)}</span>
         ${sp.bizDaysLeft>0?`<span class="days-pill">${sp.bizDaysLeft} dia${sp.bizDaysLeft!==1?'s':''} úteis</span>`:'<span class="days-pill ended">Encerrada</span>'}
         <span style="font-size:11px;color:#64748b">${e(this._fmtDate(sp.startRaw))} — ${e(this._fmtDate(sp.endRaw))}</span>
       </div>`;

    // KPIs
    const kpis = [
      {l:'Total',          v:s.total,            sub:'PBIs + Defects',                    al:false,        tip:'Total de PBIs e Defects atribuídos à sprint ativa, em qualquer estado (exceto Removed).'},
      {l:'Concluídos',     v:s.done,             sub:s.donePct+'% do total',              al:false,        tip:'Itens com estado Done, Closed ou Resolved. O percentual é calculado sobre o total da sprint.'},
      {l:'Em progresso',   v:s.inProgress,       sub:'sem bloqueio',                      al:false,        tip:'Itens com estado In Progress ou equivalente que não possuem bloqueio ativo.'},
      {l:'Bloqueados',     v:s.blocked,          sub:'aguardando resolução',              al:s.blocked>0,  tip:'Itens com impedimento ativo (campo ou tag de bloqueio). Precisam de ação externa para avançar.'},
      {l:'Em fixing',      v:s.fixing,           sub:'em correção',                       al:s.fixing>0,   tip:'Itens em fase de correção de um impedimento (tag "fixing"). Estão sendo tratados internamente.'},
      {l:'Demandas aloc.', v:s.allocPct+'%',     sub:`${s.totalRem}h / ${s.capacityTotal}h`, al:s.allocPct>100, tip:'Remaining Work atual das tasks abertas ÷ Capacidade restante da equipe na sprint. Acima de 100% indica sobrecarga.'}
    ];
    const _tip = t => `<span class="kpi-tip"><i class="kpi-tip-icon">i</i><span class="kpi-tip-box">${t}</span></span>`;
    document.getElementById('db-kpis').innerHTML =
      `<div class="kpi-grid">${kpis.map(k=>`<div class="kpi-card${k.al?' alert':''}"><div class="kpi-label">${k.l} ${_tip(k.tip)}</div><div class="kpi-val">${k.v}</div><div class="kpi-sub">${k.sub}</div></div>`).join('')}</div>`;

    // Backlog
    const childMap = {};
    tasks.forEach(t => { const p=String(t.parentId||''); if(!childMap[p]) childMap[p]=[]; childMap[p].push(t); });

    let rows = '';
    backlog.forEach(item => {
      const id = String(item.id), url = this._itemUrl(team, item.id);
      const rc  = item.blockStatus==='BLOCKED'?' row-blocked':item.blockStatus==='FIXING'?' row-fixing':'';
      const tl  = item.type==='Product Backlog Item'?'PBI':item.type==='Defect'?'Defect':item.type;
      const tc  = item.type==='Bug'||item.type==='Defect'?'badge-bug':'badge-pbi';
      let sl, sc;
      if (item.blockStatus==='BLOCKED') { sl='Bloqueado'; sc='s-blocked'; }
      else if (item.blockStatus==='FIXING') { sl='Em fixing'; sc='s-fixing'; }
      else {
        const st=(item.state||'').toLowerCase();
        if (st==='done'||st==='closed'||st==='resolved'||st==='concluído'||st==='completed'||st==='finalizado'||st==='encerrado') { sl=item.state; sc='s-done'; }
        else if (st.includes('progress')||st.includes('ativo')||st==='active'||st.includes('andamento')||st.includes('progresso')||st==='doing'||st==='executando'||st==='em execução'||st==='in progress') { sl=item.state; sc='s-doing'; }
        else if (st.includes('test')||st==='qa'||st.includes('verif')||st.includes('homolog')||st==='in test'||st==='ready'||st.includes('wait')||st.includes('aguard')||st.includes('valid')) { sl=item.state; sc='s-testing'; }
        else if (st==='removed'||st==='removido'||st==='abandonado'||st==='cancelled'||st==='canceled'||st==='descartado') { sl=item.state; sc='s-removed'; }
        else if (st==='design'||st==='análise'||st==='analise'||st.includes('analis')||st==='analysis') { sl=item.state; sc='s-design'; }
        else { sl=e(item.state)||'To Do'; sc='s-todo'; }
      }
      const ch = childMap[id]||[];
      const noTasks = ch.length === 0;
      let progHtml;
      if (noTasks) {
        progHtml = `<span class="no-tasks-warn" title="Nenhuma task ou bug filho foi criado">Não estimado</span>`;
      } else if (item.estimativa === 0) {
        progHtml = `<span class="no-est-warn" title="Tasks existem mas nenhuma possui estimativa de trabalho">Itens não estimados</span>`;
      } else if (item.estimativa > 0) {
        const pct = Math.round(Math.max(0, Math.min(100, (item.estimativa - item.childRem) / item.estimativa * 100)));
        const clr = pct >= 80 ? '#16a34a' : pct >= 40 ? '#3b82f6' : '#f59e0b';
        progHtml = `<div class="bl-prog"><div class="bl-prog-bar"><div class="bl-prog-fill" style="width:${pct}%;background:${clr}"></div></div><div class="bl-prog-lbl">${pct}% · ${item.childRem}h rem</div></div>`;
      } else {
        progHtml = `<span class="bl-prog-lbl" style="color:#94a3b8">—</span>`;
      }
      const execH = (() => {
        const ex = {}; ch.forEach(c=>{if(c.assignedTo?.trim()) ex[c.assignedTo.trim()]=true;});
        return Object.keys(ex).length>0 ? Object.keys(ex).map(n=>`<span class="mav" title="${e(n)}">${n.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()}</span>`).join('') : '<span style="color:#94a3b8">—</span>';
      })();
      rows += `<tr class="bl-row${rc}" onclick="toggleCh('${id}')" style="cursor:pointer">`+
        `<td><span class="xicon" id="ico-${id}">&#9654;</span></td>`+
        `<td><span class="badge ${tc}">${e(tl)}</span></td>`+
        `<td class="id-cell"><a href="${url}" target="_blank" class="az-link">#${id}</a></td>`+
        `<td class="title-cell" style="max-width:280px"><a href="${url}" target="_blank" class="az-link title-link">${e(item.title)}</a></td>`+
        `<td><span class="sb ${sc}">${sl}</span></td>`+
        `<td class="exec-cell">${execH}</td>`+
        `<td class="text-center mono" id="blk-${id}">—</td>`+
        `<td class="text-center" style="padding:4px 8px">${progHtml}</td>`+
        `<td class="text-center mono rem-col">${item.estimativa>0?item.estimativa+'h':'—'}</td>`+
        `<td class="text-center mono">${item.childRem>0?item.childRem+'h':'—'}</td></tr>`;
      {
        const isDoneS = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'; };
        const doing=ch.filter(c=>!isDoneS(c.state)), doneC=ch.filter(c=>isDoneS(c.state));
        const mk=(c,done)=>{
          const cu=this._itemUrl(team,c.id), tl=c.type==='Bug'?'Bug':'Task', tc=c.type==='Bug'?'badge-bug':'badge-task';
          let sc, sl;
          if (done) { sc='s-done'; sl='Concluído'; }
          else if (c.blockStatus==='BLOCKED') { sc='s-blocked'; sl='Bloqueado'; }
          else if (c.blockStatus==='FIXING')  { sc='s-fixing';  sl='Em fixing'; }
          else {
            const cst=(c.state||'').toLowerCase();
            if (cst.includes('test')||cst.includes('verif')||cst==='qa'||cst==='ready'||cst.includes('wait')||cst.includes('aguard')||cst.includes('valid')) { sc='s-testing'; sl=c.state; }
            else if (cst.includes('progress')||cst==='active'||cst.includes('andamento')||cst.includes('progresso')) { sc='s-doing'; sl=c.state; }
            else if (cst==='done'||cst==='closed'||cst==='resolved') { sc='s-done'; sl=c.state; }
            else { sc='s-todo'; sl=e(c.state)||'To Do'; }
          }
          return `<div class="task-card ${done?'tc-done':'tc-doing'}"><div class="tc-head"><span class="badge ${tc} tc-badge">${tl}</span><a href="${cu}" target="_blank" class="az-link" style="font-size:11px">#${c.id}</a></div>`+
            `<div class="tc-title"><a href="${cu}" target="_blank" class="az-link">${e(c.title)}</a></div>`+
            `<div class="tc-foot"><span class="sb ${sc}" style="font-size:10px">${sl}</span>${!done&&c.remaining>0?`<span class="tc-hours">${c.remaining}h rem.</span>`:(c.estimated>0?`<span class="tc-hours" style="opacity:.6">${c.estimated}h est.</span>`:'')}</div>`+
            (c.assignedTo?`<div class="tc-assigned">${e(c.assignedTo)}</div>`:'')+`</div>`;
        };
        rows += `<tr class="children-row" id="cr-${id}" data-item-id="${id}" style="display:none"><td colspan="10" class="children-cell">`+
          `<div class="tl-card"><div class="tl-header" onclick="toggleTimeline(this,${id})">Histórico do Board <span class="tl-chevron">▶</span></div><div class="tl-track" style="display:none"></div></div>`+
          `<div class="children-wrap">`+
          `<div class="children-col"><div class="col-header col-doing">Em andamento (${doing.length})</div><div class="cards-wrap">${doing.map(c=>mk(c,false)).join('')||'<div style="font-size:11px;color:#94a3b8;padding:4px 0;font-style:italic">Nenhuma em andamento</div>'}</div></div>`+
          `<div class="children-col"><div class="col-header col-done">Concluído (${doneC.length})</div><div class="cards-wrap">${doneC.map(c=>mk(c,true)).join('')||'<div style="font-size:11px;color:#94a3b8;padding:4px 0;font-style:italic">Nenhuma concluída</div>'}</div></div>`+
          `</div></td></tr>`;
      }
    });

    const _doneChk = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'; };
    const _progChk = s => { const sl=(s||'').toLowerCase(); return sl.includes('progress')||sl.includes('active')||sl.includes('ativo')||sl.includes('andamento'); };
    const counts = {
      todo:  backlog.filter(i=>!_doneChk(i.state)&&!_progChk(i.state)&&i.blockStatus==='CLEAR').length,
      doing: s.inProgress, done: s.done, blocked: s.blocked, fixing: s.fixing
    };
    document.getElementById('db-backlog').innerHTML =
      `<div class="bl-table-wrap"><table class="bl-table"><thead><tr><th></th><th class="sort-th" onclick="sortTbl(this)">Tipo</th><th class="sort-th" onclick="sortTbl(this)">ID</th><th class="sort-th" onclick="sortTbl(this)">Título</th><th class="sort-th" onclick="sortTbl(this)">Status</th><th class="sort-th" onclick="sortTbl(this)">Executores</th><th class="sort-th text-center" title="Dias que o item ficou bloqueado (tag block/bloqueio ou campo Blocked=Yes)" onclick="sortTbl(this)">Bloq.</th><th class="sort-th" style="text-align:center" title="Progresso baseado em Estimativa vs Remaining atual" onclick="sortTbl(this)">Progresso</th><th class="sort-th" style="text-align:center" title="Soma do maior Remaining Work de todas as tasks (incl. concluídas)" onclick="sortTbl(this)">Estimativa</th><th class="sort-th" style="text-align:center" title="Soma do Remaining Work atual das tasks em aberto" onclick="sortTbl(this)">Rem. atual</th></tr></thead>
      <tbody id="bl-tbody">${rows}</tbody></table></div>`;
    _preloadBlockTimes(backlog.map(i => i.id));

    // Progress panel
    const cpct = s.capacityTotal>0?Math.min(Math.round((s.totalRem/s.capacityTotal)*100),100):0;
    const cclr = s.allocPct>100?'#dc2626':s.allocPct>=70?'#16a34a':'#f59e0b';
    const vbg  = s.allocPct>100?'#fef2f2':'#eff6ff';
    const vclr = s.allocPct>100?'#dc2626':'#1d4ed8';
    const vel  = s.bizDays>0&&s.totalRem>0?(s.totalRem/s.bizDays).toFixed(1)+'h/dia':'—';
    const cap  = s.bizDays>0&&s.capacityTotal>0?(s.capacityTotal/s.bizDays).toFixed(1)+'h/dia':'—';
    const actH = Object.keys(s.byActivity).map(act=>{
      const a=s.byActivity[act], p=a.capRest>0?Math.min(Math.round((a.remaining/a.capRest)*100),100):0;
      const cl=p>100?'#dc2626':p>=70?'#16a34a':'#f59e0b';
      return `<div class="act-row"><span class="act-name">${e(act)}</span>`+
        `<div style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;color:#64748b">${a.members}m ${a.capRest}h</span>`+
        `<div style="width:70px"><div class="pbar-wrap" style="height:6px"><div class="pbar-fill" style="width:${p}%;background:${cl}"></div></div></div>`+
        `<span style="font-size:11px;font-weight:700;min-width:34px;color:${cl}">${p}%</span></div></div>`;
    }).join('');
    const dayH = s.dayOffCards.length===0
      ? '<div class="empty-dayoff">Nenhum day off nos dias restantes</div>'
      : (() => {
          const byD={}; s.dayOffCards.forEach(c=>{if(!byD[c.label])byD[c.label]=[];byD[c.label].push(c);});
          return Object.keys(byD).map(lbl=>`<div class="dayoff-card"><div class="dayoff-date">${e(lbl)}</div>${byD[lbl].map(c=>`<div class="dayoff-member">${e(c.member)} — ${e(c.activity)}</div>`).join('')}</div>`).join('');
        })();

    document.getElementById('db-progress').innerHTML = `
<div class="sec-title" style="margin-top:16px">Progresso</div>
<div class="prog-lbl"><span>Itens concluídos</span><span>${s.done}/${s.total} (${s.donePct}%)</span></div>
<div class="pbar-wrap"><div class="pbar-fill" style="width:${s.donePct}%;background:#16a34a"></div></div>
<div class="prog-lbl" style="margin-top:10px"><span>Capacidade alocada</span><span>${s.allocPct}%</span></div>
<div class="pbar-wrap"><div class="pbar-fill" style="width:${cpct}%;background:${cclr}"></div></div>
<div class="vel-cards">
  <div class="vel-card" style="background:#eff6ff"><div class="vel-label" style="color:#1e40af">Cap. disponível/dia</div><div class="vel-val" style="color:#1d4ed8">${cap}</div><div style="font-size:10px;color:#1e40af">${s.capacityTotal}h total</div></div>
  <div class="vel-card" style="background:${vbg}"><div class="vel-label" style="color:${vclr}">Ritmo necessário/dia</div><div class="vel-val" style="color:${vclr}">${vel}</div><div style="font-size:10px;color:${vclr}">${s.totalRem}h restantes</div></div>
</div>
${Object.keys(s.byActivity).length>0?`<div class="act-panel"><div class="act-toggle" onclick="toggleAct(this)">Ver por atividade <span>▾</span></div><div class="act-content">${actH}</div></div>`:''}
<div class="sec-title">Tarefas</div>
<div class="tasks-summary">
  <div class="tstat"><div class="tstat-val">${s.totalTasksOpen}</div><div style="font-size:10px;color:#64748b">Em aberto</div></div>
  <div class="tstat"><div class="tstat-val" style="color:#16a34a">${s.totalTasksDone}</div><div style="font-size:10px;color:#64748b">Finalizadas</div></div>
</div>
<div class="sec-title">Day offs</div>
<div class="dayoff-cards">${dayH}</div>`;

    // Insights section (async)
    document.getElementById('db-insights').innerHTML = `
      <div class="insights-section">
        <div class="ins-header">
          <div class="ins-title">Insights da IA</div>
          <div class="ins-subtitle">Analisando dados do time...</div>
        </div>
        <div class="ins-grid" id="insights-grid">
          <div class="spinner-wrap" style="grid-column: 1/-1; padding: 40px; text-align: center;">
            <div class="spinner"></div>
            <div style="margin-top: 12px; color: var(--gray); font-size: 13px;">Analisando com IA…</div>
          </div>
        </div>
      </div>`;

    document.getElementById('db-chat').innerHTML = '';

    // Members table (Premium)
    const allM = new Set([...Object.keys(s.byMember), ...Object.keys(capacity)]);
    
    const mRows = [];
    const mRowsAcmp = [];

    [...allM].sort((a,b)=>(s.byMember[b]?.remaining||0)-(s.byMember[a]?.remaining||0)).forEach(m=>{
      const bm=s.byMember[m]||{remaining:0,tasksDone:0};
      const cap2=capacity[m]||null;
      const cr=cap2?cap2.capRest:s.bizDays*6;
      const act=cap2?cap2.activity:'—';
      const doff=cap2?cap2.daysOffStr||'—':'—';
      const rem=bm.remaining;
      const alloc=cr>0?Math.min(Math.round((rem/cr)*100),999):0;
      
      let barClass = '';
      if (alloc > 100) barClass = 'over';
      else if (alloc > 85) barClass = 'warn';

      const ini=m.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
      const acColor = alloc > 100 ? 'var(--red)' : alloc >= 85 ? 'var(--amber)' : 'var(--blue)';
      const avatarColors = ['#1d4ed8','#7c3aed','#059669','#d97706','#dc2626','#0891b2'];
      const bg = avatarColors[m.charCodeAt(0) % avatarColors.length];

      const isAcmp = /scrum master|product owner|tech leader/i.test(act);
      
      if (isAcmp) {
        const acmpHtml = `
          <div style="display:flex; align-items:center; gap:10px; background:#f8fafc; border:1px solid var(--border); border-radius:30px; padding:6px 16px 6px 6px;">
            <div class="dist-avt" style="background:${bg}">${e(ini)}</div>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600; color:var(--slate); font-size:12px; line-height:1.2;">${e(m)}</span>
              <span style="font-size:10px; color:var(--gray);">${e(act)}</span>
            </div>
          </div>
        `;
        mRowsAcmp.push(acmpHtml);
      } else {
        const rowHtml = `<tr>`+
          `<td><div class="dist-avt" style="background:${bg}">${e(ini)}</div></td>`+
          `<td><div class="dist-name">${e(m)}</div><div style="font-size:11px;color:var(--gray)">${e(act)}</div></td>`+
          `<td class="text-center mono" style="font-size:12px;color:var(--slate)">${cr}h${doff&&doff!=='—'?`<div style="font-size:9px;color:var(--gray)">off: ${e(doff)}</div>`:''}</td>`+
          `<td class="text-center mono rem-col" style="font-weight:600">${rem}h</td>`+
          `<td>`+
            `<div class="dist-bar-wrap"><div class="dist-bar ${barClass}" style="width:${Math.min(alloc,100)}%"></div></div>`+
          `</td>`+
          `<td style="text-align:right">`+
            `<span class="dist-pct" style="color:${acColor}">${alloc}%</span>`+
          `</td>`+
          `<td class="text-center mono" style="color:var(--green);font-weight:700">${bm.tasksDone}</td></tr>`;
        mRows.push(rowHtml);
      }
    });

    let membersHtml = `
      <div class="members-section" style="padding: 16px 24px;">`;

    if (mRowsAcmp.length > 0) {
      membersHtml += `
        <h4 style="margin-bottom: 12px; color: var(--slate); font-size: 14px; font-weight: 600;">Acompanhamento da sprint</h4>
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px;">
          ${mRowsAcmp.join('')}
        </div>`;
    }

    membersHtml += `
        <h3 style="margin-bottom: 12px; color: var(--slate); font-size: 15px; font-weight: 700;">Distribuição por Responsável</h3>
        <div class="dist-table-wrap">
          <table class="dist-table">
            <thead>
              <tr>
                <th></th>
                <th>Membro</th>
                <th style="text-align:center">Cap. Rest.</th>
                <th style="text-align:center">Rem. Work</th>
                <th>Alocação</th>
                <th style="text-align:right">% Alocado</th>
                <th style="text-align:center">Tasks ✓</th>
              </tr>
            </thead>
            <tbody>${mRows.join('')}</tbody>
          </table>
        </div>
      </div>`;

    document.getElementById('db-members').innerHTML = membersHtml;
  },

  renderInsightCard(ins) {
    const ST = {
      critical:{ bg:'rgba(220,38,38,.06)',  bd:'rgba(220,38,38,.25)',  tc:'#991b1b' },
      warning: { bg:'rgba(245,158,11,.07)', bd:'rgba(245,158,11,.35)', tc:'#78350f' },
      info:    { bg:'rgba(59,130,246,.06)',  bd:'rgba(59,130,246,.25)', tc:'#1e40af' },
      ok:      { bg:'rgba(22,163,74,.06)',   bd:'rgba(22,163,74,.25)',  tc:'#14532d' }
    };
    const s = ST[ins.severity] || ST.info;
    const e = this._e.bind(this);
    return `<div class="ins-card" style="background:${s.bg};border-color:${s.bd}">
      <div class="ins-head">${_insIcon(ins.severity)}<span class="ins-title2" style="color:${s.tc}">${e(ins.title)}</span><button class="ins-rm" onclick="rmInsight(this)" title="Remover">✕</button></div>
      <p class="ins-body">${e(ins.body)}</p>
      <div class="ins-fb-bar"><span class="ins-fb-hint">Feedback de treinamento</span><button class="ins-fb-btn" onclick="giveInsightFeedback(this,'good')" title="Insight útil">${ICONS.thumbUp}</button><button class="ins-fb-btn" onclick="giveInsightFeedback(this,'bad')" title="Insight ruim">${ICONS.thumbDn}</button></div>
    </div>`;
  },

  renderInsightCards(list) {
    return list.map(i => this.renderInsightCard(i)).join('');
  }
};

// ── LLM ENGINE ──────────────────────────────────────────────────────
const LLM = {
  async call(provider, token, systemPrompt, userPrompt) {
    if (provider === 'claude')  return this._callClaude(token, systemPrompt, userPrompt);
    if (provider === 'openai')  return this._callOpenAI(token, systemPrompt, userPrompt);
    if (provider === 'gemini')  return this._callGemini(token, systemPrompt, userPrompt);
    throw new Error('Provider desconhecido: ' + provider);
  },

  async runAgentChain(provider, token, userPrompt, onProgress) {
    const saved = Store.getAgentPrompts();
    const sys1 = saved.a1 || AGENT_DEFAULTS.a1;
    const sys2 = saved.a2 || AGENT_DEFAULTS.a2;
    const sys3base = saved.a3 || AGENT_DEFAULTS.a3;

    const stored = Store.getUserProfile();
    const profileLevel = stored.level || 'neutral';
    const profileInstr = {
      technical: 'PERFIL DO USUÁRIO: Técnico — use linguagem técnica, termos ágeis precisos e métricas sem simplificações.',
      didactic:  'PERFIL DO USUÁRIO: Didático — explique termos técnicos com analogias e exemplos práticos acessíveis.',
      neutral:   'PERFIL DO USUÁRIO: Equilibrado — balance clareza e precisão técnica, evite excesso de jargões.'
    }[profileLevel] || '';
    const sys3 = sys3base + (profileInstr ? `\n\n${profileInstr}` : '');

    onProgress?.('Agente 1 — Gerando insights…', 1);
    const raw1 = await this.call(provider, token, sys1, userPrompt);

    onProgress?.('Agente 2 — Revisando e deduplicando…', 2);
    const raw2 = await this.call(provider, token, sys2,
      `Revise e consolide os seguintes insights gerados:\n${raw1}`);

    onProgress?.('Agente 3 — Reescrevendo com tom adequado…', 3);
    const raw3 = await this.call(provider, token, sys3,
      `Reescreva os seguintes insights com o tom adequado a cada severidade e ao perfil do usuário:\n${raw2}`);

    return raw3;
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
    const s = clean.indexOf('['), e2 = clean.lastIndexOf(']');
    if (s === -1 || e2 === -1) return [{ severity:'info', icon:'info', title:'Resposta', body: clean.substring(0,400) }];
    try {
      const arr = JSON.parse(clean.substring(s, e2+1));
      if (!Array.isArray(arr) || !arr.length) throw new Error('vazio');
      return arr.map(item => {
        let body = String(item.body||'');
        if (body.includes('Explique em 1 frase') || body.includes('resposta objetiva com dados reais') || body === 'resposta')
          body = 'Não foi possível gerar resposta específica. Reformule a pergunta.';
        return { severity: ['critical','warning','info','ok'].includes(item.severity)?item.severity:'info', icon:String(item.icon||'info'), title:String(item.title||'Resposta'), body };
      });
    } catch { return [{ severity:'info', icon:'info', title:'Resposta', body: clean.replace(/[\[\]{}\"]/g,'').trim().substring(0,400) }]; }
  },

  buildSystemPrompt() {
    return `Você é um Agile Master sênior fazendo análise integrada de Sprint, Eficiência e Qualidade.
FORMATO: retorne SOMENTE um array JSON válido, sem markdown externo:
[{"severity":"critical|warning|info|ok","icon":"emoji","title":"Título com emoji","body":"2-3 frases com nomes e números reais."}]

Você recebe dados de 3 módulos. Correlacione-os quando relevante:
- Sprint sobrecarregada + lead time alto = risco composto
- Bugs críticos abertos + capacidade no limite = ameaça à entrega
- Throughput caindo + fixing crescendo = problema de qualidade sistêmico

SEVERIDADES:
critical 🚨 — sobrecarga individual >110% NÃO justificada pelo contexto; bugs críticos sem prazo; risco real de não entrega
warning  ⚠️ — 80-110% individual; bloqueios; fixing; lead time acima de 2x o histórico; bugs High abertos
info     💡 — tendência, padrão, oportunidade de melhoria com base nos dados históricos
ok       ✅ — conformidade, ritmo equilibrado, melhora de indicadores

REGRAS IMPORTANTES:
- NUNCA sugerir redistribuição entre papéis diferentes (Back End ≠ QA)
- Sobrecarga >100% = rem > cap de um membro específico
- NÃO gere insight de risco baseado apenas em totais agregados
- Gere 5 a 7 insights cobrindo os 3 módulos. Cite nomes e números reais.
- CONSOLIDE todos os membros sobrecarregados em 1 único card critical.
- Verifique o contexto do time ANTES de gerar critical/warning.
- Se dados de Eficiência ou Qualidade não estiverem disponíveis, foque nos dados da Sprint.`;
  },

  buildUserPrompt(stats, capacity, byActivity, ragContext, tasks, backlog, efData, qualData) {
    const s = stats;
    const memberLines = Object.keys(capacity).map(m => {
      const c = capacity[m], bm = s.byMember?.[m] || { remaining:0, tasksDone:0 };
      const alloc = c.capRest>0 ? Math.round((bm.remaining/c.capRest)*100) : 0;
      return `  ${m} | ${c.activity} | cap=${c.capRest}h | rem=${bm.remaining}h | done=${bm.tasksDone} tasks | alocação=${alloc}%`;
    }).join('\n');

    const actLines = Object.keys(byActivity).map(act => {
      const a = byActivity[act];
      const cd = s.bizDays>0?(a.capRest/s.bizDays).toFixed(1):'0';
      const rd = s.bizDays>0?(a.remaining/s.bizDays).toFixed(1):'0';
      const al = a.capRest>0?Math.round((a.remaining/a.capRest)*100):0;
      return `  ${act} | cap_dia=${cd}h | ritmo_dia=${rd}h | rem_total=${a.remaining}h | membros=${a.members} | alocação=${al}%`;
    }).join('\n');

    const taskLines = (() => {
      if (!tasks?.length) return '';
      const open = tasks.filter(t=>t.state!=='Done').slice(0,60);
      const doneC = tasks.filter(t=>t.state==='Done');
      return `Tasks abertas (${open.length}):\n`+
        open.map(t=>`  [${t.state}] #${t.id} — ${t.title} | resp=${t.assignedTo||'não atribuído'}${t.remaining>0?' | '+t.remaining+'h rem':''}${t.blockStatus&&t.blockStatus!=='CLEAR'?' | ⚠ '+t.blockStatus:''}`).join('\n')+
        `\nTasks concluídas: ${doneC.length}`;
    })();

    const backlogLines = (backlog||[]).slice(0,40).map(b=>{
      const flag = b.blockStatus==='BLOCKED'?' 🚫BLOCKED':b.blockStatus==='FIXING'?' 🔧FIXING':'';
      const noBreak = (b._childCount===0)?' ⚠SEM_QUEBRA':'';
      const est = b.estimativa>0?` | est=${b.estimativa}h`:'';
      const rem = b.childRem>0?` | rem=${b.childRem}h`:'';
      return `  [${b.state}] #${b.id} — ${b.title} | resp=${b.assignedTo||'—'}${est}${rem}${flag}${noBreak}`;
    }).join('\n');

    const overloaded=[], highAlloc=[], lowAlloc=[], idle=[];
    Object.keys(capacity).forEach(m=>{
      const c=capacity[m], bm=s.byMember?.[m]||{remaining:0};
      const pct=c.capRest>0?Math.round((bm.remaining/c.capRest)*100):0;
      const line=`  → ${m} (${c.activity}): alocação=${pct}% (rem=${bm.remaining}h, cap=${c.capRest}h)`;
      if(pct>100) overloaded.push(line); else if(pct>=70) highAlloc.push(line); else if(pct>0) lowAlloc.push(line); else idle.push(line);
    });
    let alertLines = 'ALERTAS POR MEMBRO:\n';
    if(overloaded.length) alertLines+=`🚨 SOBRECARREGADOS (>100%) — CONSOLIDE EM 1 CARD:\n${overloaded.join('\n')}\n`;
    if(highAlloc.length)  alertLines+=`✅ SAUDÁVEL (70-100%):\n${highAlloc.join('\n')}\n`;
    if(lowAlloc.length)   alertLines+=`⚠️ OCIOSOS (<70%):\n${lowAlloc.join('\n')}\n`;
    if(idle.length)       alertLines+=`⚠️ SEM TASKS (0%):\n${idle.join('\n')}\n`;

    const macroInterp = s.totalRem < s.capacityTotal
      ? `FOLGA — remaining (${s.totalRem}h) < capacidade (${s.capacityTotal}h). NÃO há risco de não entrega no agregado.`
      : `ATENÇÃO — remaining (${s.totalRem}h) >= capacidade (${s.capacityTotal}h).`;

    // ── Efficiency section
    let efSection = '';
    if (efData) {
      const ef = efData;
      const recentSprints = (ef.iterLabels || []).slice(-5);
      const sprintRows = recentSprints.map(k => {
        const it = ef.byIter[k] || {};
        const lt = it.leadTimes?.length ? (it.leadTimes.reduce((a,b)=>a+b,0)/it.leadTimes.length).toFixed(1) : '—';
        const ct = it.cycleTimes?.length ? (it.cycleTimes.reduce((a,b)=>a+b,0)/it.cycleTimes.length).toFixed(1) : '—';
        return `  ${k}: ${it.count||0} itens | Lead=${lt}d | Cycle=${ct}d | Velocity=${Math.round(it.velocity||0)}h`;
      }).join('\n');
      const topCols = Object.entries(ef.colTimes||{})
        .map(([col,v]) => ({ col, avg: v.count>0 ? v.total/v.count : 0, count: v.count }))
        .sort((a,b) => b.avg - a.avg)
        .slice(0,5)
        .map(c => `  ${c.col}: ${c.avg.toFixed(1)}d avg (${c.count} amostras)`)
        .join('\n');
      efSection = `\n=== MÓDULO EFICIÊNCIA (${recentSprints.length} sprint(s) analisadas) ===\n`+
        `Throughput médio: ${ef.avgThroughput} itens/sprint | Lead Time médio: ${ef.avgLeadTime}d | Cycle Time médio: ${ef.avgCycleTime}d | Bugs abertos: ${ef.openBugs}\n`+
        `\nPor sprint:\n${sprintRows||'  (sem dados)'}\n`+
        `\nGargalos do board (tempo médio por coluna):\n${topCols||'  (sem dados)'}\n`;
    }

    // ── Quality section
    let qualSection = '';
    if (qualData && qualData.items?.length) {
      const _isDoneQ = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'||sl==='concluído'||sl==='completed'; };
      const qi = qualData.items;
      const qOpen   = qi.filter(i => !_isDoneQ(i.fields['System.State']));
      const qClosed = qi.filter(i =>  _isDoneQ(i.fields['System.State']));
      const qBugs   = qi.filter(i => i.fields['System.WorkItemType']==='Bug');
      const qDef    = qi.filter(i => i.fields['System.WorkItemType']==='Defect');
      const monthAgo = Date.now() - 30*86400000;
      const last30  = qi.filter(i => { const cd=i.fields['System.CreatedDate']; return cd && new Date(cd).getTime()>=monthAgo; }).length;
      const avgResQ = arr => {
        const vals = arr.filter(i=>_isDoneQ(i.fields['System.State'])).map(i=>{
          const cd=i.fields['Microsoft.VSTS.Common.ClosedDate'], cr=i.fields['System.CreatedDate'];
          if(!cd||!cr) return null; const d=Math.round((new Date(cd)-new Date(cr))/86400000); return d>=0?d:null;
        }).filter(v=>v!==null);
        return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
      };
      const sevCt = (arr, s) => arr.filter(i => String(i.fields['Microsoft.VSTS.Common.Severity']||'').startsWith(s+' ')).length;
      const openBySev = `Critical:${sevCt(qOpen,'1')} High:${sevCt(qOpen,'2')} Medium:${sevCt(qOpen,'3')} Low:${sevCt(qOpen,'4')}`;
      const totalRemQ = qOpen.reduce((a,i)=>a+(Number(i.fields['Microsoft.VSTS.Scheduling.RemainingWork'])||0),0);
      const tgo = qualData.tempoGasto || {};
      const top3Q = [...qi].sort((a,b)=>(tgo[b.id]||0)-(tgo[a.id]||0)).slice(0,3)
        .map(i=>`  #${i.id} [${i.fields['System.WorkItemType']}] ${(i.fields['System.Title']||'').substring(0,55)} | tempo=${tgo[i.id]||0}h | sev=${i.fields['Microsoft.VSTS.Common.Severity']||'—'} | state=${i.fields['System.State']||'—'}`).join('\n');
      qualSection = `\n=== MÓDULO QUALIDADE ===\n`+
        `Total: ${qBugs.length} Bugs + ${qDef.length} Defects = ${qi.length} itens\n`+
        `Abertos: ${qOpen.length} | Fechados: ${qClosed.length} | Criados últimos 30 dias: ${last30}\n`+
        `Tempo médio resolução Bug: ${avgResQ(qBugs)===null?'—':avgResQ(qBugs)+'d'} | Defect: ${avgResQ(qDef)===null?'—':avgResQ(qDef)+'d'}\n`+
        `Estimativa total (h gastas): ${qualData.horasGastas!=null?qualData.horasGastas+'h':'—'} | Remaining Work (abertos): ${totalRemQ}h\n`+
        `Severidade dos abertos — ${openBySev}\n`+
        `\nTop 3 por tempo gasto:\n${top3Q||'  (sem dados)'}\n`;
    }

    return `DADOS DA SPRINT:\nDias úteis restantes: ${s.bizDays}\n`+
      `PBIs: total=${s.total} | concluídos=${s.done} (${s.donePct}%) | em_progresso=${s.inProgress} | bloqueados=${s.blocked} | fixing=${s.fixing}\n`+
      `Tasks: abertas=${s.totalTasksOpen} | finalizadas=${s.totalTasksDone}\n\n`+
      `DIAGNÓSTICO MACRO:\n  Remaining total: ${s.totalRem}h | Capacidade total: ${s.capacityTotal}h | Alocação: ${s.allocPct}%\n  ▶ ${macroInterp}\n  ⚠ NÃO gere insight de risco de não entrega baseado apenas nos totais.\n\n`+
      (ragContext?`CONTEXTO DO TIME (leia ANTES dos dados — tem prioridade):\n${'-'.repeat(40)}\n${ragContext}\n${'-'.repeat(40)}\n\n`:'')+
      alertLines+'\n'+
      `Capacidade por MEMBRO:\n${memberLines||'  (sem dados)'}\n\n`+
      `Capacidade por ATIVIDADE:\n${actLines||'  (sem dados)'}\n\n`+
      `Backlog:\n${backlogLines||'  (sem dados)'}\n\n`+
      `Tarefas:\n${taskLines||'  (sem dados)'}\n`+
      efSection+
      qualSection+
      `\nResponda SOMENTE com o JSON array.`;
  }
};

// ── INSIGHT VALIDATOR (R0–R8) ────────────────────────────────────────
const Validator = {
  validate(insights, stats, capacity, ragContext) {
    const s = stats;
    const ragLow = (ragContext||'').toLowerCase();

    // Pre-calc member alloc
    const memberAlloc = {};
    Object.keys(capacity).forEach(m => {
      const c  = capacity[m];
      const bm = s.byMember?.[m] || { remaining:0 };
      const alloc = c.capRest>0 ? Math.round((bm.remaining/c.capRest)*100) : 0;
      memberAlloc[m] = { alloc, cap:c.capRest, rem:bm.remaining, activity:c.activity||'—' };
    });

    const TREATED = ['próxima sprint','proxima sprint','já tratado','ja tratado','alinhado','mapeado','planejado','sendo tratado','está tratando','esta tratando','negociado'];

    let r0Fired = false;
    let validated = insights.map(ins => {
      if (!ins) return null;
      const result = { ...ins };
      const bl = ((ins.body||'')+(ins.title||'')).toLowerCase();

      // R0: rem < cap + no member cited → fix to "folga"
      if (result.severity === 'critical' || result.severity === 'warning') {
        const citaMembro = Object.keys(capacity).some(m => bl.includes(m.split(' ')[0].toLowerCase()));
        if (!citaMembro && s.totalRem < s.capacityTotal) {
          if (!r0Fired) {
            const folga = Math.round(((s.capacityTotal-s.totalRem)/s.capacityTotal)*100);
            result.severity = 'info'; result.icon = 'info';
            result.title = 'Capacidade com folga';
            result.body  = `Remaining total (${s.totalRem}h) < capacidade (${s.capacityTotal}h) — há ${folga}% de folga no agregado. Risco real = sobrecarga individual, não falta de capacidade.`;
            r0Fired = true;
          } else { return null; }
        }
      }

      // R1: critical total/equipe, no member, allocPct < 100 → info
      if (result.severity === 'critical') {
        const mentTot = bl.includes('total')||bl.includes('equipe')||bl.includes('time');
        const mentMem = Object.keys(capacity).some(m => bl.includes(m.split(' ')[0].toLowerCase()));
        if (mentTot && !mentMem && s.allocPct < 100) { result.severity='info'; result.icon='info'; }
      }

      // R2: critical, no one >100% → warning
      if (result.severity === 'critical') {
        const noOneOver = Object.keys(memberAlloc).every(m => memberAlloc[m].alloc <= 100);
        const isBlock = bl.includes('bloqueado')||bl.includes('blocked');
        if (noOneOver && !isBlock) { result.severity='warning'; }
      }

      // R3: RAG treats situation → ok (unless real overload)
      if (result.severity === 'critical' || result.severity === 'warning') {
        const isRealOver = Object.keys(memberAlloc).some(m => {
          const fn=m.split(' ')[0].toLowerCase(), ln=m.split(' ').pop().toLowerCase();
          return (bl.includes(fn)||bl.includes(ln)) && memberAlloc[m].alloc > 100;
        });
        if (!isRealOver) {
          Object.keys(capacity).forEach(m => {
            const fn=m.split(' ')[0].toLowerCase(), ln=m.split(' ').pop().toLowerCase();
            if (bl.includes(fn)||bl.includes(ln)) {
              let idx = ragLow.indexOf(ln); if (idx===-1) idx=ragLow.indexOf(fn);
              if (idx !== -1) {
                const slice = ragLow.substring(Math.max(0,idx-200), idx+200);
                if (TREATED.some(kw=>slice.includes(kw))) { result.severity='ok'; result.icon='ok'; }
              }
            }
          });
        }
      }

      // R5: ok/info + member cited with <70% → warning
      if (result.severity === 'ok' || result.severity === 'info') {
        const idle = [];
        Object.keys(memberAlloc).forEach(m => {
          const fn=m.split(' ')[0].toLowerCase(), ln=m.split(' ').pop().toLowerCase();
          const cited=bl.includes(fn)||bl.includes(ln)||(ins.title||'').toLowerCase().includes(fn);
          if (cited && memberAlloc[m].alloc<70 && memberAlloc[m].cap>0) idle.push(`${m} (${memberAlloc[m].alloc}%)`);
        });
        if (idle.length) {
          result.severity='warning'; result.icon='warning';
          result.body += ` Atenção: ${idle.join(', ')} com alocação abaixo de 70% — verificar tasks não estimadas.`;
        }
      }
      return result;
    });

    // R8: members <70% not covered → inject warning per role
    (() => {
      const idleByRole = {};
      Object.keys(memberAlloc).forEach(m => {
        if (memberAlloc[m].cap<=0 || memberAlloc[m].alloc>=70) return;
        const fn=m.split(' ')[0].toLowerCase(), ln=m.split(' ').pop().toLowerCase();
        const covered = validated.some(ins => {
          if(!ins||ins.severity==='ok') return false;
          const bl=((ins.body||'')+(ins.title||'')).toLowerCase();
          return bl.includes(fn)||bl.includes(ln);
        });
        if (!covered) { const r=memberAlloc[m].activity||'—'; if(!idleByRole[r]) idleByRole[r]=[]; idleByRole[r].push(m); }
      });
      Object.keys(idleByRole).forEach(role => {
        const members=idleByRole[role];
        const det=members.map(m=>`${m} (${memberAlloc[m].alloc}%, rem=${memberAlloc[m].rem}h, cap=${memberAlloc[m].cap}h)`).join(', ');
        const add=`${det} abaixo de 70% em ${role} — verificar tasks não estimadas ou oportunidade de adiantar refinamento.`;
        const rl=role.toLowerCase();
        const ex=validated.find(ins=>ins&&ins.severity!=='ok'&&ins.severity!=='critical'&&((ins.body||'')+(ins.title||'')).toLowerCase().includes(rl.split(' ')[0]));
        if (ex) { ex.body+=' | Também: '+add; ex.severity='warning'; ex.icon='warning'; }
        else validated.push({ severity:'warning',icon:'warning',section:'opportunity',title:`Baixa utilização em ${role}`,body:add });
      });
    })();

    let clean = validated.filter(i=>i!=null);

    // R6: members >100% not mentioned → complement or create critical card
    const omitted=[];
    Object.keys(memberAlloc).forEach(m=>{
      if(memberAlloc[m].alloc<=100) return;
      const fn=m.split(' ')[0].toLowerCase(), ln=m.split(' ').pop().toLowerCase();
      const mentioned=clean.some(ins=>(((ins.body||'')+(ins.title||'')).toLowerCase()).includes(fn)||(((ins.body||'')+(ins.title||'')).toLowerCase()).includes(ln));
      if(!mentioned) omitted.push(m);
    });
    if (omitted.length) {
      const byAct={};
      omitted.forEach(m=>{ const a=memberAlloc[m].activity||'—'; if(!byAct[a]) byAct[a]=[]; byAct[a].push(m); });
      const addedText=Object.keys(byAct).map(a=>a+': '+byAct[a].map(m=>`${m} (${memberAlloc[m].alloc}%, rem=${memberAlloc[m].rem}h, cap=${memberAlloc[m].cap}h)`).join(', ')).join(' | ');
      const overIdx=clean.findIndex(i=>i.severity==='critical');
      if(overIdx!==-1) clean[overIdx].body+=' | Também: '+addedText+'.';
      else clean.unshift({ severity:'critical',icon:'critical',section:'overload',title:'Alertas de Sobrecarga',body:addedText+' — sem membros ociosos no mesmo papel. Negociar escopo com o PO.' });
    }

    // R7: multiple criticals → merge into 1
    const crits=clean.filter(i=>i.severity==='critical');
    if(crits.length>1){
      const merged=crits.map(i=>(i.title||'').trim()+': '+(i.body||'')).join(' | ');
      clean=clean.filter(i=>i.severity!=='critical');
      clean.unshift({ severity:'critical',icon:'critical',section:'overload',title:'Alertas de Sobrecarga',body:merged });
    }

    // Dedup by title
    const seen={};
    return clean.filter(i=>{ const k=(i.title||'').toLowerCase().replace(/\s+/g,' ').trim(); if(seen[k]) return false; seen[k]=true; return true; });
  },

  localFallback(stats, capacity, byActivity) {
    const s=stats; const out=[];
    const over=Object.keys(capacity).filter(m=>{ const bm=s.byMember?.[m]||{remaining:0}; return capacity[m].capRest>0&&(bm.remaining/capacity[m].capRest)>1.1; });
    if(over.length) out.push({ severity:'critical',icon:'critical',title:'Sobrecarga de membros',body:`${over.length} membro(s) acima de 110%: ${over.slice(0,3).join(', ')}${over.length>3?'...':''}. Redistribua tarefas.` });
    if(s.blocked>0) out.push({ severity:'critical',icon:'critical',title:'Bloqueios ativos',body:`${s.blocked} PBI(s) bloqueado(s). Priorize desbloqueio imediato.` });
    if(s.fixing>0)  out.push({ severity:'warning',icon:'warning',title:'Itens em correção',body:`${s.fixing} item(ns) em fixing. Analise a causa raiz.` });
    if(s.allocPct>100) out.push({ severity:'warning',icon:'warning',title:'Capacidade excedida',body:`Demanda (${s.totalRem}h) supera capacidade (${s.capacityTotal}h) em ${s.allocPct-100}%.` });
    else if(s.allocPct<60&&s.allocPct>0) out.push({ severity:'info',icon:'info',title:'Capacidade subutilizada',body:`Apenas ${s.allocPct}% alocado. Há espaço para incluir mais itens.` });
    if(s.donePct>=70) out.push({ severity:'ok',icon:'ok',title:'Ritmo saudável',body:`${s.done} de ${s.total} PBIs concluídos (${s.donePct}%). Caminho certo!` });
    else if(s.done===0&&s.bizDays<3) out.push({ severity:'critical',icon:'critical',title:'Entregas em risco',body:`Nenhum PBI concluído com ${s.bizDays} dias úteis restantes. Revisão urgente.` });
    else out.push({ severity:'info',icon:'info',title:'Progresso da sprint',body:`${s.done} de ${s.total} PBIs concluídos (${s.donePct}%). ${s.totalTasksDone} tasks finalizadas.` });
    return out.slice(0,6);
  }
};

// ── TOAST ────────────────────────────────────────────────────────────
function toast(msg, type='', duration=3500) {
  const el = document.createElement('div');
  el.className = 'toast-item' + (type?' '+type:'');
  el.textContent = msg;
  document.getElementById('toast').appendChild(el);
  requestAnimationFrame(() => { requestAnimationFrame(() => el.classList.add('show')); });
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, duration);
}

// ── VAULT UI ─────────────────────────────────────────────────────────
function vaultTab(tab) {
  document.getElementById('tab-pin').classList.toggle('active', tab==='pin');
  document.getElementById('tab-session').classList.toggle('active', tab==='session');
  document.getElementById('vault-pin-area').style.display    = tab==='pin'    ? '' : 'none';
  document.getElementById('vault-session-area').style.display = tab==='session' ? '' : 'none';
  document.getElementById('verr').textContent = '';
}

async function vaultAction() {
  const pin = document.getElementById('vpin').value.trim();
  document.getElementById('verr').textContent = '';
  if (pin.length < 4) { document.getElementById('verr').textContent='PIN deve ter 4 a 8 dígitos.'; return; }
  document.getElementById('vbtn').disabled = true;
  document.getElementById('vbtn').textContent = 'Aguarde…';
  try {
    let key;
    if (!Vault.isSetup()) {
      key = await Vault.setupPin(pin);
      document.getElementById('vsub').textContent = 'Vault criado com sucesso!';
    } else {
      key = await Vault.verifyPin(pin);
      if (!key) { document.getElementById('verr').textContent='PIN incorreto.'; document.getElementById('vbtn').disabled=false; document.getElementById('vbtn').textContent='Entrar'; return; }
    }
    APP.vaultKey  = key;
    APP.vaultMode = 'pin';
    launchApp();
  } catch(e) { document.getElementById('verr').textContent='Erro: '+e.message; }
  document.getElementById('vbtn').disabled = false;
  document.getElementById('vbtn').textContent = 'Entrar';
}

function vaultSessionStart() {
  APP.vaultKey  = null;
  APP.vaultMode = 'session';
  launchApp();
}

function launchApp() {
  document.getElementById('vault-overlay').style.display = 'none';
  document.getElementById('app').style.display = '';
  updateVaultModeDesc();
  checkProxy();
  renderTeams();
  renderOrgList();
  renderLlmList();
  renderRagList();
  renderDashTeamSel();
  const cache = Store.getSprintCache();
  if (cache) {
    APP.sprintData = cache;
    DB.render(cache);
    loadInsights(true);
  } else {
    document.getElementById('db-no-data').style.display = '';
  }
  if (Store.getActiveTeamId()) runSync();
  setTimeout(renderDashTeamSel, 0);
  // Update vault button label on overlay
  if (Vault.isSetup()) {
    document.getElementById('vbtn').textContent = 'Entrar';
    document.getElementById('vsub').textContent = 'Digite seu PIN para desbloquear';
  } else {
    document.getElementById('vbtn').textContent = 'Criar vault';
    document.getElementById('vsub').textContent = 'Crie um PIN para proteger seus tokens';
  }
}

function updateVaultModeDesc() {
  const el = document.getElementById('vault-mode-desc');
  if (el) el.textContent = APP.vaultMode==='pin' ? 'Vault com PIN (tokens cifrados no localStorage)' : 'Sessão apenas (tokens não persistidos)';
}

// ── NAVIGATION ───────────────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mbn-item').forEach(n => n.classList.remove('active'));
  document.getElementById('panel-'+name)?.classList.add('active');
  document.getElementById('nav-'+name)?.classList.add('active');
  document.getElementById('mbn-'+name)?.classList.add('active');
  // Volta ao topo ao trocar de seção
  document.getElementById('main-content')?.scrollTo({top:0, behavior:'instant'});
  if (name === 'dashboard') { renderDashTeamSel(); }
  if (name === 'teams')    { renderTeams(); renderOrgList(); }
  if (name === 'llm')      renderLlmList();
  if (name === 'rag')      { showTrainingTab('contextos'); }
}

function showModule(name) {
  document.querySelectorAll('.mod-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.mod-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('module-'+name)?.classList.add('active');
  document.getElementById('modtab-'+name)?.classList.add('active');
  if (name === 'eficiencia') {
    loadEficienciaFilter();
    if (APP.allIterations?.length && !APP.eficienciaData) runEficiencia();
  }
  if (name === 'qualidade') {
    if (APP.qualidadeData) renderQualidadeCharts(APP.qualidadeData, APP.qualTipo);
    else if (Store.getActiveTeamId()) runQualidade();
  }
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── DASHBOARD TEAM SELECTOR ──────────────────────────────────────────
function renderDashTeamSel() {
  const menu   = document.getElementById('db-team-menu');
  const btnAvt = document.getElementById('db-team-btn-avt');
  const btnNm  = document.getElementById('db-team-btn-name');
  if (!menu) return;
  const teams    = Store.getTeams();
  const activeId = Store.getActiveTeamId();
  const active   = teams.find(t => t.id === activeId);
  const avatarColors = ['#1d4ed8','#7c3aed','#059669','#d97706','#dc2626','#0891b2'];
  // Update button label
  if (active) {
    btnNm.textContent  = active.name;
    btnAvt.textContent = active.name.substring(0,2).toUpperCase();
    btnAvt.style.background = avatarColors[active.name.charCodeAt(0) % avatarColors.length];
  } else {
    btnNm.textContent  = 'Selecione um time';
    btnAvt.textContent = '—';
    btnAvt.style.background = '#475569';
  }
  // Populate menu
  if (!teams.length) {
    menu.innerHTML = '<div class="db-team-empty">Nenhum time cadastrado.<br>Acesse <strong>Times</strong> para criar.</div>';
    return;
  }
  menu.innerHTML = teams.map(t => {
    const ini   = t.name.substring(0,2).toUpperCase();
    const isAct = t.id === activeId;
    const col   = avatarColors[t.name.charCodeAt(0) % avatarColors.length];
    return `<div class="db-tmi${isAct?' active':''}" onclick="onDashTeamChange('${esc(t.id)}')">` +
      `<div class="db-tmi-avt" style="background:${isAct?col:'#f1f5f9'};color:${isAct?'#fff':col}">${ini}</div>` +
      `<div><div class="db-tmi-name">${esc(t.name)}</div><div class="db-tmi-meta">${esc(t.proj||t.org||'')}</div></div>` +
      `${isAct?'<span class="db-tmi-check">✓</span>':''}` +
      `</div>`;
  }).join('');
}

function toggleDashTeamDd() {
  renderDashTeamSel();
  document.getElementById('db-team-menu')?.classList.toggle('open');
}

function onDashTeamChange(id) {
  if (!id) return;
  Store.setActiveTeamId(id);
  document.getElementById('db-team-menu')?.classList.remove('open');
  renderDashTeamSel();
  renderTeams();
  toast('Time ativado! Sincronizando…', 'ok');
  APP.eficienciaData = null;
  APP.qualidadeData  = null;
  runSync();
}

// ── TEAMS ─────────────────────────────────────────────────────────────
function renderTeams() {
  const teams = Store.getTeams();
  const activeId = Store.getActiveTeamId();
  const el = document.getElementById('teams-list');
  if (!teams.length) {
    if (el) el.innerHTML = '<div class="empty-st"><div style="font-size:36px;margin-bottom:10px;opacity:.3"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><h3>Nenhum time cadastrado</h3><p>Clique em "Novo time" para começar.</p></div>';
    renderDashTeamSel();
    return;
  }
  if (!el) { renderDashTeamSel(); return; }
  el.innerHTML = teams.map(t => {
    const ini = t.name.substring(0,2).toUpperCase();
    const isAct = t.id === activeId;
    return `<div class="team-card${isAct?' act':''}">
      <div class="tavatar">${ini}</div>
      <div class="tinfo">
        <div class="tname">${esc(t.name)}</div>
        <div class="tmeta">${esc(t.org)} / ${esc(t.proj)} · <code style="font-size:11px">${esc(t.azTeam)}</code></div>
        ${isAct?'<span class="tbadge">✓ Ativo</span>':''}
      </div>
      <div class="tactions">
        ${!isAct?`<button class="btn btn-blue" style="font-size:12px;padding:5px 12px" onclick="activateTeam('${t.id}')">Ativar</button>`:''}
        <button class="btn" style="font-size:12px;padding:5px 12px" onclick="editTeam('${t.id}')">Editar</button>
        <button class="btn" style="font-size:12px;padding:5px 12px;color:#dc2626" onclick="deleteTeam('${t.id}')">Excluir</button>
      </div>
    </div>`;
  }).join('');
  renderDashTeamSel();
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function onOrgSelChange() {
  const v       = document.getElementById('tf-org-sel').value;
  const newRow  = document.getElementById('tf-new-org-row');
  const patRow  = document.getElementById('tf-pat-row');
  const reuse   = document.getElementById('tf-pat-reuse');
  if (v) {
    newRow.style.display = 'none';
    patRow.style.display = 'none';
    reuse.style.display  = '';
    const org = Store.getOrgs().find(o => o.id === v);
    if (org) document.getElementById('tf-org').value = org.name;
  } else {
    newRow.style.display = '';
    patRow.style.display = '';
    reuse.style.display  = 'none';
    document.getElementById('tf-org').value = '';
  }
}

function openTeamModal(id) {
  document.getElementById('team-modal-title').textContent = id ? 'Editar time' : 'Novo time';
  document.getElementById('tf-id').value   = id || '';
  document.getElementById('tf-name').value = '';
  document.getElementById('tf-proj').value = '';
  document.getElementById('tf-team').value = '';
  document.getElementById('tf-pat').value  = '';
  document.getElementById('tf-org').value  = '';

  const orgSel = document.getElementById('tf-org-sel');
  const orgs   = Store.getOrgs();
  orgSel.innerHTML = '<option value="">+ Nova organização</option>' +
    orgs.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
  orgSel.value = '';
  document.getElementById('tf-new-org-row').style.display = '';
  document.getElementById('tf-pat-row').style.display     = '';
  document.getElementById('tf-pat-reuse').style.display   = 'none';

  if (id) {
    const t = Store.getTeams().find(x => x.id === id);
    if (t) {
      document.getElementById('tf-name').value = t.name;
      document.getElementById('tf-proj').value = t.proj;
      document.getElementById('tf-team').value = t.azTeam;
      if (t.orgId && orgs.find(o => o.id === t.orgId)) {
        orgSel.value = t.orgId;
        onOrgSelChange();
      } else {
        document.getElementById('tf-org').value = t.org || '';
      }
    }
  }
  openModal('modal-team');
}

function editTeam(id) { openTeamModal(id); }

async function saveTeam() {
  const id      = document.getElementById('tf-id').value;
  const name    = document.getElementById('tf-name').value.trim();
  const orgSelV = document.getElementById('tf-org-sel').value;
  const orgName = orgSelV
    ? (Store.getOrgs().find(o => o.id === orgSelV)?.name || '')
    : document.getElementById('tf-org').value.trim();
  const proj    = document.getElementById('tf-proj').value.trim();
  const azTeam  = document.getElementById('tf-team').value.trim();
  const patRaw  = document.getElementById('tf-pat').value.trim();

  if (!name || !orgName || !proj || !azTeam) { toast('Preencha todos os campos obrigatórios.','warn'); return; }
  const teams = Store.getTeams();

  if (id) {
    const idx = teams.findIndex(t => t.id === id);
    if (idx !== -1) {
      teams[idx].name = name; teams[idx].org = orgName; teams[idx].proj = proj; teams[idx].azTeam = azTeam;
      if (orgSelV) {
        teams[idx].orgId = orgSelV; teams[idx].patEnc = '';
      } else if (patRaw) {
        teams[idx].orgId = null;
        if (APP.vaultMode === 'session') APP.sessionTokens.teams[id] = patRaw;
        else teams[idx].patEnc = await Vault.encryptToken(patRaw);
      }
    }
  } else {
    let orgId = orgSelV;
    if (!orgSelV) {
      if (!patRaw) { toast('O PAT é obrigatório para nova organização.','warn'); return; }
      const newOrgId = 'o_'+Date.now();
      const orgs = Store.getOrgs();
      if (APP.vaultMode === 'session') {
        APP.sessionTokens.orgs[newOrgId] = patRaw;
        orgs.push({ id:newOrgId, name:orgName, patEnc:'' });
      } else {
        orgs.push({ id:newOrgId, name:orgName, patEnc: await Vault.encryptToken(patRaw) });
      }
      Store.saveOrgs(orgs);
      orgId = newOrgId;
    }
    const newId = 't_'+Date.now();
    teams.push({ id:newId, name, org:orgName, proj, azTeam, patEnc:'', orgId });
  }
  Store.saveTeams(teams);
  closeModal('modal-team');
  renderTeams();
  renderOrgList();
  toast('Time salvo!','ok');
}

// ── ORG MANAGEMENT ────────────────────────────────────────────────────
function renderOrgList() {
  const el   = document.getElementById('orgs-list');
  if (!el) return;
  const orgs  = Store.getOrgs();
  const teams = Store.getTeams();
  if (!orgs.length) {
    el.innerHTML = '<div style="font-size:12px;color:#94a3b8;padding:8px 0">Nenhuma organização cadastrada. Ao criar um novo time, a organização é salva automaticamente.</div>';
    return;
  }
  el.innerHTML = orgs.map(o => {
    const linked = teams.filter(t => t.orgId === o.id).length;
    return `<div class="team-card">
      <div class="tavatar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
      <div class="tinfo">
        <div class="tname">${esc(o.name)}</div>
        <div class="tmeta">${linked} time${linked!==1?'s':''} vinculado${linked!==1?'s':''}</div>
      </div>
      <div class="tactions">
        <button class="btn" style="font-size:12px;padding:5px 12px" onclick="openOrgModal('${o.id}')">Editar PAT</button>
        <button class="btn" style="font-size:12px;padding:5px 12px;color:#dc2626" onclick="deleteOrg('${o.id}')">Excluir</button>
      </div>
    </div>`;
  }).join('');
}

function openOrgModal(id) {
  document.getElementById('org-modal-title').textContent = id ? 'Editar organização' : 'Nova organização';
  document.getElementById('of-id').value   = id || '';
  document.getElementById('of-name').value = '';
  document.getElementById('of-pat').value  = '';
  if (id) {
    const o = Store.getOrgs().find(x => x.id === id);
    if (o) document.getElementById('of-name').value = o.name;
  }
  openModal('modal-org');
}

async function saveOrg() {
  const id     = document.getElementById('of-id').value;
  const name   = document.getElementById('of-name').value.trim();
  const patRaw = document.getElementById('of-pat').value.trim();
  if (!name) { toast('Informe o nome da organização.','warn'); return; }
  const orgs = Store.getOrgs();
  if (id) {
    const idx = orgs.findIndex(o => o.id === id);
    if (idx !== -1) {
      orgs[idx].name = name;
      if (patRaw) {
        if (APP.vaultMode === 'session') APP.sessionTokens.orgs[id] = patRaw;
        else orgs[idx].patEnc = await Vault.encryptToken(patRaw);
      }
    }
  } else {
    if (!patRaw) { toast('O PAT é obrigatório.','warn'); return; }
    const newId = 'o_'+Date.now();
    if (APP.vaultMode === 'session') {
      APP.sessionTokens.orgs[newId] = patRaw;
      orgs.push({ id:newId, name, patEnc:'' });
    } else {
      orgs.push({ id:newId, name, patEnc: await Vault.encryptToken(patRaw) });
    }
  }
  Store.saveOrgs(orgs);
  closeModal('modal-org');
  renderOrgList();
  toast('Organização salva!','ok');
}

function deleteOrg(id) {
  const linked = Store.getTeams().filter(t => t.orgId === id).length;
  if (linked > 0 && !confirm(`Esta organização tem ${linked} time(s) vinculado(s). Excluir mesmo assim?`)) return;
  Store.saveOrgs(Store.getOrgs().filter(o => o.id !== id));
  renderOrgList();
  toast('Organização excluída.');
}

function deleteTeam(id) {
  if (!confirm('Excluir este time?')) return;
  const teams = Store.getTeams().filter(t=>t.id!==id);
  Store.saveTeams(teams);
  if (Store.getActiveTeamId()===id) { localStorage.removeItem('avai_active_team'); }
  renderTeams();
  toast('Time excluído.');
}

function activateTeam(id) {
  Store.setActiveTeamId(id);
  renderTeams();
  renderDashTeamSel();
  toast('Time ativado!','ok');
}

// ── LLM ──────────────────────────────────────────────────────────────
function renderLlmList() {
  const list = Store.getLlmList();
  const el   = document.getElementById('llm-list');
  const icons = { openai:'<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#10b981"></span>', claude:'<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#8b5cf6"></span>', gemini:'<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3b82f6"></span>' };
  const labels= { openai:'OpenAI (gpt-4o)', claude:'Claude (claude-sonnet-4-5)', gemini:'Gemini (gemini-1.5-pro)' };
  if (!list.length) {
    el.innerHTML = '<div class="empty-st"><div style="margin-bottom:10px;opacity:.3"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg></div><h3>Nenhum token configurado</h3><p>Adicione um token para habilitar os insights de IA.</p></div>';
    return;
  }
  el.innerHTML = list.map(l => `
    <div class="llm-card${l.active?' act':''}">
      <div style="width:40px;text-align:center;display:flex;align-items:center;justify-content:center">${icons[l.provider]||'<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#94a3b8"></span>'}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px">${labels[l.provider]||l.provider}</div>
        <div style="font-size:11px;color:#64748b;font-family:monospace;margin-top:2px">${l.tokenEnc?'••••••••••••':'(sessão)'}${l.active?' · ✓ Ativo':''}</div>
      </div>
      <div style="display:flex;gap:6px">
        ${!l.active?`<button class="btn btn-blue" style="font-size:12px;padding:5px 12px" onclick="activateLlm('${l.id}')">Ativar</button>`:''}
        <button class="btn" style="font-size:12px;padding:5px 12px;color:#dc2626" onclick="deleteLlm('${l.id}')">Excluir</button>
      </div>
    </div>`).join('');
}

function openLlmModal() {
  document.getElementById('lf-provider').value = 'openai';
  document.getElementById('lf-token').value    = '';
  document.getElementById('lf-id').value       = '';
  openModal('modal-llm');
}

async function saveLlm() {
  const provider = document.getElementById('lf-provider').value;
  const tokenRaw = document.getElementById('lf-token').value.trim();
  if (!tokenRaw) { toast('Cole o token.','warn'); return; }
  const list = Store.getLlmList();
  const newLlmId = 'l_'+Date.now();
  let tokenEnc = '';
  if (APP.vaultMode === 'session') { APP.sessionTokens.llms[newLlmId] = tokenRaw; }
  else { tokenEnc = await Vault.encryptToken(tokenRaw); }
  list.push({ id:newLlmId, provider, tokenEnc, active: list.length===0 });
  Store.saveLlmList(list);
  closeModal('modal-llm');
  renderLlmList();
  toast('Token salvo!','ok');
}

function activateLlm(id) {
  const list = Store.getLlmList().map(l=>({...l, active:l.id===id}));
  Store.saveLlmList(list);
  renderLlmList();
  toast('Token LLM ativado!','ok');
}

function deleteLlm(id) {
  if (!confirm('Excluir este token?')) return;
  Store.saveLlmList(Store.getLlmList().filter(l=>l.id!==id));
  renderLlmList();
  toast('Token excluído.');
}

// ── RAG ───────────────────────────────────────────────────────────────
function onRfScopeChange() {
  const v = document.getElementById('rf-scope').value;
  document.getElementById('rf-team-row').style.display = v === 'team' ? '' : 'none';
}

function renderRagList() {
  const list  = Store.getRagList();
  const teams = Store.getTeams();
  const el    = document.getElementById('rag-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="empty-st"><div style="margin-bottom:10px;opacity:.3"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div><h3>Nenhum treinamento cadastrado</h3><p>Adicione contexto para que a IA gere insights mais precisos.</p></div>';
    return;
  }
  el.innerHTML = list.map(r => {
    const teamName = r.scope==='team' && r.teamId
      ? (teams.find(t=>t.id===r.teamId)?.name || 'Time desconhecido')
      : null;
    const scopeLabel = r.scope==='team'
      ? `Por time: ${esc(teamName||'?')}`
      : 'Geral';
    return `<div class="rag-card">
      <span class="rag-chip">${esc(r.type)}</span>
      <div style="flex:1">
        <div style="font-size:10px;color:#64748b;margin-bottom:4px">${scopeLabel}</div>
        <div style="font-size:12px;color:#374151;line-height:1.5">${esc(r.spec.substring(0,200))}${r.spec.length>200?'…':''}</div>
      </div>
      <button class="btn" style="font-size:11px;padding:4px 10px;color:#dc2626;flex-shrink:0" onclick="deleteRag('${r.id}')">✕</button>
    </div>`;
  }).join('');
}

function openRagModal() {
  document.getElementById('rf-id').value    = '';
  document.getElementById('rf-spec').value  = '';
  document.getElementById('rf-scope').value = 'geral';
  document.getElementById('rf-team-row').style.display = 'none';
  document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('sel'));
  document.querySelector('.type-chip').classList.add('sel');

  const teamSel = document.getElementById('rf-team-id');
  const teams   = Store.getTeams();
  teamSel.innerHTML = '<option value="">— selecione um time —</option>' +
    teams.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  teamSel.value = Store.getActiveTeamId() || '';

  openModal('modal-rag');
}

function selRagType(el) {
  document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
}

function saveRag() {
  const spec    = document.getElementById('rf-spec').value.trim();
  if (!spec) { toast('Preencha a especificação.','warn'); return; }
  const sel     = document.querySelector('.type-chip.sel');
  const type    = sel ? sel.dataset.type : 'acordos de time';
  const scope   = document.getElementById('rf-scope').value;
  const teamId  = scope === 'team' ? (document.getElementById('rf-team-id').value || null) : null;
  if (scope === 'team' && !teamId) { toast('Selecione um time.','warn'); return; }
  const list  = Store.getRagList();
  list.push({ id:'r_'+Date.now(), type, spec, scope, teamId });
  Store.saveRagList(list);
  closeModal('modal-rag');
  renderRagList();
  toast('Treinamento salvo!','ok');
}

function deleteRag(id) {
  if (!confirm('Excluir este contexto?')) return;
  Store.saveRagList(Store.getRagList().filter(r=>r.id!==id));
  renderRagList();
  toast('Treinamento excluído.');
}

// ── EFICIÊNCIA UI ─────────────────────────────────────────────────────
function _shortSprintLabel(name) {
  const m = name.match(/sprint\s*(\d+)/i);
  return m ? 'Sprint ' + m[1] : name;
}

function _updateEfSprintGraphCount() {
  const list = document.getElementById('ef-filter-list');
  if (!list) return;
  const total   = list.querySelectorAll('input[type=checkbox]').length;
  const checked = list.querySelectorAll('input[type=checkbox]:checked').length;
  const span    = document.getElementById('ef-sprint-graph-count');
  if (span) span.textContent = checked === total ? `(${total})` : `(${checked}/${total})`;
}

function toggleEfSprintDd() {
  document.getElementById('ef-sprint-graph-dd')?.classList.toggle('open');
}

function loadEficienciaFilter(months) {
  const el = document.getElementById('ef-filter-list');
  if (!el) return;
  const iters = APP.allIterations;
  if (!iters || !iters.length) {
    el.innerHTML = '<span style="font-size:12px;color:#94a3b8">Sincronize um time para carregar as sprints.</span>';
    return;
  }
  const now = Date.now();
  const sorted = [...iters].sort((a,b) => new Date(b.attributes?.finishDate||0) - new Date(a.attributes?.finishDate||0));

  // Current sprint
  const currentSprint = sorted.find(it => {
    const s = it.attributes?.startDate ? new Date(it.attributes.startDate).getTime() : 0;
    const e = it.attributes?.finishDate ? new Date(it.attributes.finishDate).getTime() + 86400000 : 0;
    return s <= now && now <= e;
  });
  const currentPath = currentSprint?.path || '';

  // Past sprints only (finished before now)
  const pastSprints = sorted.filter(it => {
    const e = it.attributes?.finishDate ? new Date(it.attributes.finishDate).getTime() + 86400000 : 0;
    return it.path !== currentPath && e < now;
  });

  // All visible: current first, then past
  const allVisible = [...(currentSprint ? [currentSprint] : []), ...pastSprints];

  let preSelected = new Set();
  if (months) {
    // Period filter: only past sprints within the window
    const cutoff = now - months * 30.44 * 86400000;
    pastSprints
      .filter(it => { const e = it.attributes?.finishDate ? new Date(it.attributes.finishDate).getTime() : 0; return e >= cutoff; })
      .forEach(it => preSelected.add(it.path));
  } else {
    // Default: up to 3 most recent past sprints
    pastSprints.slice(0, 3).forEach(it => preSelected.add(it.path));
  }

  el.innerHTML = allVisible.map(it => {
    const label = it.path.split('\\').pop();
    const short = _shortSprintLabel(label);
    const isCur = it.path === currentPath;
    const chk   = preSelected.has(it.path) ? ' checked' : '';
    return `<label class="ef-bl-dd-item"><input type="checkbox" value="${esc(it.path)}"${chk} onchange="_updateEfSprintGraphCount()"> ${esc(short)}${isCur ? ' <span style="color:#3b82f6;font-size:10px">← atual</span>' : ''}</label>`;
  }).join('');

  _updateEfSprintGraphCount();
  if (months) {
    document.getElementById('ef-sprint-graph-dd')?.classList.remove('open');
  }
}

async function runEficiencia() {
  const team = Store.getActiveTeam();
  if (!team) { toast('Nenhum time ativo.','warn'); return; }
  const pat = await Store.getActivePat();
  if (!pat) { toast('PAT inválido.','warn'); return; }
  const checked = [...(document.getElementById('ef-filter-list')?.querySelectorAll('input[type=checkbox]:checked') || [])].map(c => c.value);
  if (!checked.length) { toast('Selecione pelo menos uma sprint.','warn'); return; }

  const content = document.getElementById('ef-content');
  content.innerHTML = '<div class="spinner-wrap" style="padding:32px"><div class="spinner"></div>Buscando work items das sprints selecionadas…</div>';

  try {
    const [ids, openBugs, taskIds] = await Promise.all([
      EficienciaAPI.getWorkItemIds(team.org, team.proj, checked, pat),
      EficienciaAPI.getOpenBugsCount(team.org, team.proj, pat),
      EficienciaAPI.getTaskIds(team.org, team.proj, checked, pat)
    ]);
    const [items, taskIterPaths] = await Promise.all([
      EficienciaAPI.getWorkItems(team.org, team.proj, ids, pat),
      EficienciaAPI.getTasksIterPath(team.org, team.proj, taskIds, pat)
    ]);
    content.innerHTML = '<div class="spinner-wrap" style="padding:32px"><div class="spinner"></div>Analisando revisões (coluna + velocity)…</div>';
    const [result, taskMaxRem] = await Promise.all([
      EficienciaProcessor.compute(items, team.org, team.proj, pat, APP.sprintData?.capacity || {}),
      _fetchMaxRem(team.org, team.proj, taskIds, pat)
    ]);
    // Build velocity per sprint from task max remaining work
    taskIds.forEach(id => {
      const label = (taskIterPaths[id]||'?').split('\\').pop();
      if (!result.byIter[label]) result.byIter[label] = { count:0, points:0, leadTimes:[], cycleTimes:[], velocity:0 };
      result.byIter[label].velocity = (result.byIter[label].velocity||0) + (taskMaxRem[id]||0);
    });
    result.iterLabels = [...new Set([...result.iterLabels, ...Object.keys(result.byIter)])].sort();
    result.openBugs = openBugs;
    APP.eficienciaData = result;
    content.innerHTML = '<div class="ef-kpi-wrap"><div id="ef-kpis" class="ef-kpi-grid"></div></div><div id="ef-charts" class="ef-charts-grid"></div>';
    renderEficienciaKPIs(result);
    renderEficienciaCharts(result);
    runEficienciaBacklogTable(team, pat, checked);
  } catch(e) {
    content.innerHTML = `<div class="mod-empty"><div class="mod-empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>Erro ao calcular</h3><p>${esc(e.message)}</p></div>`;
    toast('Erro: '+e.message,'err');
  }
}

function renderEficienciaKPIs(r) {
  const el = document.getElementById('ef-kpis');
  if (!el) return;
  const kpis = [
    { l:'Vazão Média',          v: r.avgThroughput,    sub:'itens concluídos/sprint',    icon:'', tip:'Média de itens concluídos por sprint nas sprints selecionadas. Mede a produtividade histórica da equipe.' },
    { l:'Lead Time Médio',      v: r.avgLeadTime+'d',  sub:'criação → fechamento',        icon:'', tip:'Média de dias entre a criação e o fechamento de um item. Inclui todo o tempo de espera e execução.' },
    { l:'Cycle Time Médio',     v: r.avgCycleTime+'d', sub:'ativação → fechamento',       icon:'', tip:'Média de dias entre a ativação (In Progress) e o fechamento. Mede a eficiência real da execução.' },
    { l:'Bugs/Defeitos Abertos',v: r.openBugs,         sub:'todos (ignora filtro sprint)', icon:'', alert: r.openBugs > 0, tip:'Contagem global de Bugs e Defects em aberto no projeto, independente do filtro de sprint selecionado.' },
    { l:'Capacidade Sprint',    v: r.capTotal+'h',     sub:'horas totais (sprint atual)', icon:'', tip:'Soma das horas disponíveis da equipe na sprint atual, descontando folgas e dias não úteis cadastrados.' },
  ];
  const _etip = t => `<span class="kpi-tip"><i class="kpi-tip-icon">i</i><span class="kpi-tip-box">${t}</span></span>`;
  el.innerHTML = kpis.map(k => `
    <div class="ef-kpi-card${k.alert?' kpi-card alert':''}">
      <div class="ef-kpi-label">${k.icon?k.icon+' ':''}${k.l} ${_etip(k.tip)}</div>
      <div class="ef-kpi-val">${k.v}</div>
      <div class="ef-kpi-sub">${k.sub}</div>
    </div>`).join('');
}

const EF_CHARTS = {};
function _efDestroyChart(id) { if (EF_CHARTS[id]) { EF_CHARTS[id].destroy(); delete EF_CHARTS[id]; } }

function renderEficienciaCharts(r) {
  const el = document.getElementById('ef-charts');
  if (!el) return;
  el.innerHTML = `
    <div class="ef-chart-card ef-chart-card-full">
      <div class="ef-chart-hdr">
        <span class="ef-chart-title">Tempo médio em cada coluna do board</span>
      </div>
      <div style="position:relative;height:200px"><canvas id="ef-chart-col"></canvas></div>
    </div>
    <div class="ef-chart-card ef-chart-card-full">
      <div class="ef-chart-hdr">
        <span class="ef-chart-title">Vazão / Velocity por Sprint</span>
        <div class="ef-toggle">
          <button class="ef-toggle-btn active" id="ef-t-throughput" onclick="switchEfChart('flow','throughput')">Vazão</button>
          <button class="ef-toggle-btn"        id="ef-t-velocity"   onclick="switchEfChart('flow','velocity')">Velocity</button>
        </div>
      </div>
      <div style="position:relative;height:220px"><canvas id="ef-chart-flow"></canvas></div>
    </div>
    <div class="ef-chart-card ef-chart-card-full">
      <div class="ef-chart-hdr">
        <span class="ef-chart-title">Tempo de entrega por Sprint</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <div class="ef-toggle">
            <button class="ef-toggle-btn active" id="ef-t-lead"  onclick="switchEfChart('time','lead')">Lead Time</button>
            <button class="ef-toggle-btn"        id="ef-t-cycle" onclick="switchEfChart('time','cycle')">Cycle Time</button>
          </div>
          <div class="ef-toggle">
            <button class="ef-toggle-btn active" id="ef-t-avg"      onclick="switchEfTimeView('avg')">Tempo médio</button>
            <button class="ef-toggle-btn"        id="ef-t-percentil" onclick="switchEfTimeView('percentil')">Percentis</button>
          </div>
        </div>
      </div>
      <div style="position:relative;height:220px"><canvas id="ef-chart-time"></canvas></div>
      <div class="ef-pct-card" id="ef-pct-card" style="display:none">
        <div class="ef-pct-answer" id="ef-pct-answer">—</div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:10px">
          <input type="range" class="ef-pct-slider" id="ef-pct-slider" min="50" max="99" value="85" oninput="efUpdatePctCard(this.value)">
          <span id="ef-pct-label" style="font-size:13px;font-weight:700;color:#1d4ed8;min-width:36px">85%</span>
        </div>
      </div>
    </div>`;

  APP.efChartMode = { flow:'throughput', time:'lead', timeView:'avg' };

  // Board column time — vertical bars
  const colKeys = Object.keys(r.colTimes).sort((a,b) =>
    (r.colTimes[b].total/r.colTimes[b].count) - (r.colTimes[a].total/r.colTimes[a].count));
  _efDestroyChart('ef-chart-col');
  if (colKeys.length) {
    EF_CHARTS['ef-chart-col'] = new Chart(document.getElementById('ef-chart-col'), {
      type: 'bar',
      data: { labels: colKeys, datasets: [{ label:'Dias médios', data: colKeys.map(k=>+(r.colTimes[k].total/r.colTimes[k].count).toFixed(1)), backgroundColor:'#3b82f6', borderRadius:4 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, title:{display:true,text:'dias'} }, x:{ ticks:{maxRotation:35,minRotation:0} } } }
    });
  } else {
    document.getElementById('ef-chart-col').insertAdjacentHTML('afterend','<div style="color:#94a3b8;font-size:12px;text-align:center;padding:10px">Campo BoardColumn não disponível nas revisões.</div>');
  }

  _efDrawFlowChart(r);
  _efDrawTimeChart(r);
}

function _efDrawFlowChart(r) {
  _efDestroyChart('ef-chart-flow');
  const ctx = document.getElementById('ef-chart-flow');
  if (!ctx) return;
  const mode = APP.efChartMode.flow;
  const label = mode==='throughput' ? 'Itens entregues' : 'Velocity (h — max rem. tasks)';
  const data  = r.iterLabels.map(k => mode==='throughput' ? r.byIter[k].count : Math.round((r.byIter[k].velocity||0)*10)/10);
  EF_CHARTS['ef-chart-flow'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: r.iterLabels, datasets: [{ label, data, backgroundColor:'#6366f1', borderRadius:4 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{ beginAtZero:true, title:{display:true,text: mode==='throughput'?'itens':'horas'} } } }
  });
}

function _efDrawTimeChart(r) {
  _efDestroyChart('ef-chart-time');
  const ctx = document.getElementById('ef-chart-time');
  if (!ctx) return;
  const mode = APP.efChartMode.time;
  const view = APP.efChartMode.timeView || 'avg';
  const getTimes = k => mode === 'lead' ? r.byIter[k].leadTimes : r.byIter[k].cycleTimes;
  const _avg = arr => arr.length ? +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : null;
  const _pct = (arr, p) => { const s=[...arr].sort((a,b)=>a-b); return s.length ? +(s[Math.min(Math.ceil(p/100*s.length)-1,s.length-1)]).toFixed(1) : null; };
  let datasets;
  if (view === 'avg') {
    const col = mode==='lead' ? '#f59e0b' : '#10b981';
    const bg  = mode==='lead' ? 'rgba(245,158,11,.1)' : 'rgba(16,185,129,.1)';
    datasets = [{ label: mode==='lead'?'Lead Time (dias)':'Cycle Time (dias)', data: r.iterLabels.map(k => _avg(getTimes(k))), borderColor:col, backgroundColor:bg, tension:0.3, fill:true, pointRadius:4, spanGaps:true }];
  } else {
    datasets = [
      { label:'P50', data: r.iterLabels.map(k => _pct(getTimes(k),50)), borderColor:'#10b981', backgroundColor:'transparent', tension:0.3, pointRadius:4, spanGaps:true, borderDash:[] },
      { label:'P80', data: r.iterLabels.map(k => _pct(getTimes(k),80)), borderColor:'#f59e0b', backgroundColor:'transparent', tension:0.3, pointRadius:4, spanGaps:true, borderDash:[5,3] },
      { label:'P95', data: r.iterLabels.map(k => _pct(getTimes(k),95)), borderColor:'#ef4444', backgroundColor:'transparent', tension:0.3, pointRadius:4, spanGaps:true, borderDash:[2,3] },
    ];
  }
  EF_CHARTS['ef-chart-time'] = new Chart(ctx, {
    type: 'line',
    data: { labels: r.iterLabels, datasets },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display: view==='percentil' } }, scales:{ y:{ beginAtZero:true, title:{display:true,text:'dias'} } } }
  });
  const card = document.getElementById('ef-pct-card');
  if (card) {
    card.style.display = view === 'percentil' ? '' : 'none';
    if (view === 'percentil') efUpdatePctCard(document.getElementById('ef-pct-slider')?.value || 85);
  }
}

function switchEfChart(type, mode) {
  APP.efChartMode[type] = mode;
  if (type === 'flow') {
    document.getElementById('ef-t-throughput')?.classList.toggle('active', mode==='throughput');
    document.getElementById('ef-t-velocity')?.classList.toggle('active',   mode==='velocity');
    if (APP.eficienciaData) _efDrawFlowChart(APP.eficienciaData);
  } else {
    document.getElementById('ef-t-lead')?.classList.toggle('active',  mode==='lead');
    document.getElementById('ef-t-cycle')?.classList.toggle('active', mode==='cycle');
    if (APP.eficienciaData) _efDrawTimeChart(APP.eficienciaData);
  }
}

function switchEfTimeView(view) {
  APP.efChartMode.timeView = view;
  document.getElementById('ef-t-avg')?.classList.toggle('active',      view==='avg');
  document.getElementById('ef-t-percentil')?.classList.toggle('active', view==='percentil');
  if (APP.eficienciaData) _efDrawTimeChart(APP.eficienciaData);
}

function efUpdatePctCard(pct) {
  pct = parseInt(pct);
  const lbl = document.getElementById('ef-pct-label');
  if (lbl) lbl.textContent = pct + '%';
  const r = APP.eficienciaData;
  if (!r) return;
  const mode = APP.efChartMode.time;
  const all  = r.iterLabels.flatMap(k => mode === 'lead' ? r.byIter[k].leadTimes : r.byIter[k].cycleTimes);
  const sorted = [...all].sort((a,b) => a-b);
  const val  = sorted.length ? sorted[Math.min(Math.ceil(pct/100*sorted.length)-1, sorted.length-1)] : null;
  const ans  = document.getElementById('ef-pct-answer');
  if (ans) ans.textContent = val !== null
    ? `${pct}% das demandas são entregues em até ${Math.round(val)} dias (${mode==='lead'?'Lead Time':'Cycle Time'})`
    : 'Dados insuficientes para calcular.';
}

// ── QUALIDADE UI ──────────────────────────────────────────────────────
const QUAL_CHARTS = {};
function _qualDestroy(id) { if (QUAL_CHARTS[id]) { QUAL_CHARTS[id].destroy(); delete QUAL_CHARTS[id]; } }

async function runQualidade() {
  const team = Store.getActiveTeam();
  if (!team) { toast('Nenhum time ativo.','warn'); return; }
  const pat = await Store.getActivePat();
  if (!pat) { toast('PAT inválido.','warn'); return; }
  const content = document.getElementById('qual-content');
  content.innerHTML = '<div class="spinner-wrap" style="padding:32px"><div class="spinner"></div>Buscando Bugs e Defeitos…</div>';
  try {
    const ids   = await QualidadeAPI.getIds(team.org, team.proj, pat);
    const items = await QualidadeAPI.getItems(team.org, team.proj, ids, pat);
    APP.qualidadeData = items;
    APP.qualHorasGastas = null; // reset while computing

    const bugIds    = items.filter(i=>i.fields['System.WorkItemType']==='Bug').map(i=>i.id);
    const defectIds = items.filter(i=>i.fields['System.WorkItemType']==='Defect').map(i=>i.id);

    content.innerHTML = '<div class="spinner-wrap" style="padding:32px"><div class="spinner"></div>Calculando estimativas por revisões…</div>';

    const [bugMaxRem, defectChildMap] = await Promise.all([
      _fetchMaxRem(team.org, team.proj, bugIds, pat),
      QualidadeAPI.getDefectChildTaskIds(team.org, team.proj, defectIds, pat)
    ]);

    const allChildIds = [...new Set(Object.values(defectChildMap).flat())];
    const taskMaxRem  = await _fetchMaxRem(team.org, team.proj, allChildIds, pat);

    const tempoGasto = {};
    bugIds.forEach(id => { tempoGasto[id] = bugMaxRem[id] || 0; });
    defectIds.forEach(defId => {
      const tasks = defectChildMap[String(defId)] || [];
      tempoGasto[defId] = Math.round(tasks.reduce((b,tid) => b + (taskMaxRem[tid]||0), 0) * 10) / 10;
    });
    APP.qualTempoGasto  = tempoGasto;
    const bugTotal    = bugIds.reduce((a,id) => a + (tempoGasto[id]||0), 0);
    const defectTotal = defectIds.reduce((a,id) => a + (tempoGasto[id]||0), 0);
    APP.qualHorasGastas = Math.round((bugTotal + defectTotal) * 10) / 10;

    renderQualidadeCharts(items);
  } catch(e) {
    content.innerHTML = `<div class="mod-empty"><div class="mod-empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><h3>Erro</h3><p>${esc(e.message)}</p></div>`;
    toast('Erro: '+e.message,'err');
  }
}

function switchQualTipo(tipo) {
  APP.qualTipo = tipo;
  const el = document.getElementById('qs-tipo');
  if (el) el.value = tipo;
  if (APP.qualidadeData) renderQualidadeCharts(APP.qualidadeData);
}

function switchQualEstado(estado) {
  APP.qualEstado = estado;
  const el = document.getElementById('qs-estado');
  if (el) el.value = estado;
  if (APP.qualidadeData) renderQualidadeCharts(APP.qualidadeData);
}

function switchQualSeverity(sev) {
  APP.qualSeverity = sev;
  const el = document.getElementById('qs-sev');
  if (el) el.value = sev;
  if (APP.qualidadeData) renderQualidadeCharts(APP.qualidadeData);
}

function renderQualidadeCharts(allItems) {
  const tipo   = APP.qualTipo   || 'ambos';
  const estado = APP.qualEstado !== undefined ? APP.qualEstado : 'todos';

  const _isDone = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'||sl==='concluído'||sl==='completed'; };

  // ── KPIs always computed from all loaded data (global project scope) ──
  const bugs    = allItems.filter(i => i.fields['System.WorkItemType']==='Bug');
  const defects = allItems.filter(i => i.fields['System.WorkItemType']==='Defect');
  const openAll = allItems.filter(i => !_isDone(i.fields['System.State']));
  const doneAll = allItems.filter(i =>  _isDone(i.fields['System.State']));

  const avgResDays = arr => {
    const vals = arr.filter(i=>_isDone(i.fields['System.State'])).map(i=>{
      const cd=i.fields['Microsoft.VSTS.Common.ClosedDate'], cr=i.fields['System.CreatedDate'];
      if(!cd||!cr) return null;
      const d=Math.round((new Date(cd)-new Date(cr))/86400000);
      return d>=0?d:null;
    }).filter(v=>v!==null);
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
  };

  const fmtDays = v => v===null?'—':v===1?'1 dia':`${v} dias`;
  const totalRem   = allItems.reduce((a,i)=>a+(Number(i.fields['Microsoft.VSTS.Scheduling.RemainingWork'])||0),0);
  const horasGastas = APP.qualHorasGastas !== null && APP.qualHorasGastas !== undefined ? APP.qualHorasGastas : null;
  const avgBug    = avgResDays(bugs);
  const avgDefect = avgResDays(defects);
  const monthAgo  = Date.now() - 30*86400000;
  const abertosUltimoMes = allItems.filter(i => { const cd=i.fields['System.CreatedDate']; return cd && new Date(cd).getTime()>=monthAgo; }).length;

  const _qtip = t => `<span class="kpi-tip"><i class="kpi-tip-icon">i</i><span class="kpi-tip-box">${t}</span></span>`;
  const kpiHtml = `<div class="qual-kpi-wrap"><div class="qual-kpi-row">
    <div class="qkpi"><div class="qkpi-lbl">🟥 Abertos ${_qtip('Total de Bugs e Defeitos com estado diferente de Done/Closed/Resolved no projeto inteiro, independente do filtro aplicado.')}</div><div class="qkpi-val">${openAll.length}</div><div class="qkpi-sub">Bugs + Defeitos</div></div>
    <div class="qkpi"><div class="qkpi-lbl">🟩 Fechados ${_qtip('Total de Bugs e Defeitos com estado Done, Closed ou Resolved.')}</div><div class="qkpi-val">${doneAll.length}</div><div class="qkpi-sub">Done / Closed</div></div>
    <div class="qkpi"><div class="qkpi-lbl">📅 Último mês ${_qtip('Itens criados nos últimos 30 dias, independente do estado atual. Indica o ritmo de entrada de defeitos.')}</div><div class="qkpi-val" style="color:#dc2626">${abertosUltimoMes}</div><div class="qkpi-sub">últimos 30 dias</div></div>
    <div class="qkpi"><div class="qkpi-lbl">⏱ Res. médio Bug ${_qtip('Média de dias entre a criação e o fechamento dos Bugs resolvidos. Calculado apenas sobre itens com estado Done/Closed.')}</div><div class="qkpi-val" style="font-size:18px">${fmtDays(avgBug)}</div><div class="qkpi-sub">criação → fechamento</div></div>
    <div class="qkpi"><div class="qkpi-lbl">⏱ Res. médio Defect ${_qtip('Média de dias entre a criação e o fechamento dos Defeitos resolvidos. Calculado apenas sobre itens com estado Done/Closed.')}</div><div class="qkpi-val" style="font-size:18px">${fmtDays(avgDefect)}</div><div class="qkpi-sub">criação → fechamento</div></div>
    <div class="qkpi"><div class="qkpi-lbl">⏳ Remaining Work ${_qtip('Soma do campo Remaining Work de todos os Bugs e Defeitos em aberto. Representa o esforço restante declarado nas tasks.')}</div><div class="qkpi-val">${totalRem>0?totalRem+'h':'—'}</div><div class="qkpi-sub">bugs+defeitos abertos</div></div>
    <div class="qkpi"><div class="qkpi-lbl">✅ Estimativa Total ${_qtip('Soma do maior Remaining Work já registrado em revisões (esforço máximo histórico) de Bugs diretos e tasks filhas de Defects. Representa o volume total estimado.')}</div><div class="qkpi-val">${horasGastas!==null?horasGastas+'h':'—'}</div><div class="qkpi-sub">Σ max rem. histórico</div></div>
  </div></div>`;

  const sev = APP.qualSeverity || 'todas';

  // ── Filter items for charts and table ──
  let items = tipo==='ambos' ? allItems : allItems.filter(i => i.fields['System.WorkItemType']===tipo);
  if (estado==='aberto')  items = items.filter(i => !_isDone(i.fields['System.State']));
  if (estado==='fechado') items = items.filter(i =>  _isDone(i.fields['System.State']));
  if (sev !== 'todas') items = items.filter(i => String(i.fields['Microsoft.VSTS.Common.Severity']||'').startsWith(sev+' '));

  const total = items.length;

  // ── Inline filter bar (rendered between charts and table) ──
  const filterBarHtml = `<div class="qual-inline-filter">
    <div class="qual-filter-group"><label class="qual-filter-label">Tipo</label><select class="qual-select" onchange="switchQualTipo(this.value)"><option value="ambos" ${tipo==='ambos'?'selected':''}>Bugs + Defeitos</option><option value="Bug" ${tipo==='Bug'?'selected':''}>🐛 Bugs</option><option value="Defect" ${tipo==='Defect'?'selected':''}>⚠️ Defeitos</option></select></div>
    <div class="qual-filter-group"><label class="qual-filter-label">Estado</label><select class="qual-select" onchange="switchQualEstado(this.value)"><option value="aberto" ${estado==='aberto'?'selected':''}>Em aberto</option><option value="fechado" ${estado==='fechado'?'selected':''}>Fechados</option><option value="todos" ${estado==='todos'?'selected':''}>Todos</option></select></div>
    <div class="qual-filter-group"><label class="qual-filter-label">Severidade</label><select class="qual-select" onchange="switchQualSeverity(this.value)"><option value="todas" ${sev==='todas'?'selected':''}>Todas</option><option value="1" ${sev==='1'?'selected':''}>🔴 Critical</option><option value="2" ${sev==='2'?'selected':''}>🟠 High</option><option value="3" ${sev==='3'?'selected':''}>🟡 Medium</option><option value="4" ${sev==='4'?'selected':''}>🟢 Low</option></select></div>
    <span style="margin-left:auto;align-self:center;font-size:12px;color:#64748b">${total} item${total!==1?'s':''} encontrado${total!==1?'s':''}</span>
  </div>`;

  const content = document.getElementById('qual-content');

  if (!items.length) {
    content.innerHTML = kpiHtml + filterBarHtml + '<div class="mod-empty" style="padding:24px"><div class="mod-empty-icon">🔍</div><h3>Nenhum item</h3><p>Nenhum Bug ou Defeito encontrado com o filtro atual.</p></div>';
    return;
  }

  // ── Azure color helpers (used for table rows and charts) ──
  const sevColor   = s => { const sl=(s||'').toLowerCase(); if(sl.includes('critical')||sl.startsWith('1 '))return'#cc0000'; if(sl.includes('high')||sl.startsWith('2 '))return'#e05300'; if(sl.includes('medium')||sl.startsWith('3 '))return'#f0b400'; if(sl.includes('low')||sl.startsWith('4 '))return'#57a300'; return'#94a3b8'; };
  const priColor   = s => { const v=String(s||''); if(v==='1')return'#cc0000'; if(v==='2')return'#e05300'; if(v==='3')return'#f0b400'; if(v==='4')return'#57a300'; return'#94a3b8'; };
  const stateColor = s => { const sl=(s||'').toLowerCase(); if(sl==='done'||sl==='closed'||sl==='resolved'||sl==='concíuío'||sl==='completed')return'#16a34a'; if(sl.includes('progress')||sl==='active'||sl.includes('andamento')||sl.includes('progresso'))return'#3b82f6'; if(sl.includes('test')||sl.includes('qa')||sl.includes('verif')||sl.includes('homolog')||sl==='ready'||sl.includes('wait')||sl.includes('aguard')||sl.includes('valid'))return'#f59e0b'; if(sl==='removed'||sl==='abandonado'||sl==='cancelled'||sl==='canceled')return'#dc2626'; if(sl==='design'||sl.includes('analis'))return'#8b5cf6'; return'#94a3b8'; };
  const _stateClass= s => { const sl=(s||'').toLowerCase(); if(sl==='done'||sl==='closed'||sl==='resolved'||sl==='concíuío'||sl==='completed') return 's-done'; if(sl.includes('progress')||sl==='active'||sl.includes('andamento')||sl.includes('progresso')) return 's-doing'; if(sl.includes('test')||sl.includes('qa')||sl.includes('verif')||sl.includes('homolog')||sl==='ready'||sl.includes('wait')||sl.includes('aguard')||sl.includes('valid')) return 's-testing'; return 's-todo'; };

  // ── Items table (uses filtered items) ──
  const tgo = APP.qualTempoGasto || {};
  const esc2 = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const tblRows = items.slice().sort((a,b) => (tgo[b.id]||0)-(tgo[a.id]||0)).map(i => {
    const tipo2    = i.fields['System.WorkItemType'];
    const tc2      = tipo2==='Bug'?'badge-bug':'badge-pbi';
    const estFmt   = tgo[i.id] > 0 ? tgo[i.id]+'h' : '—';
    const rem      = i.fields['Microsoft.VSTS.Scheduling.RemainingWork'];
    const remFmt   = rem > 0 ? rem+'h' : '—';
    const sev2     = i.fields['Microsoft.VSTS.Common.Severity'] || '—';
    const pri      = String(i.fields['Microsoft.VSTS.Common.Priority'] || '—');
    const stateStr = i.fields['System.State'] || '';
    const sc       = _stateClass(stateStr);
    const at       = i.fields['System.AssignedTo'];
    const atName   = typeof at === 'object' ? (at?.displayName || '') : (at || '');
    const execH    = atName ? `<span class="mav" title="${esc2(atName)}">${atName.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()}</span>` : '<span style="color:#94a3b8">—</span>';
    const estVal   = tgo[i.id] || 0;
    const progHtml = estVal === 0
      ? `<span class="no-tasks-warn" title="Sem estimativa histórica">Não estimado</span>`
      : (() => {
          const pct = Math.round(Math.max(0, Math.min(100, (estVal - (rem||0)) / estVal * 100)));
          const clr = pct >= 80 ? '#16a34a' : pct >= 40 ? '#3b82f6' : '#f59e0b';
          return `<div class="bl-prog"><div class="bl-prog-bar"><div class="bl-prog-fill" style="width:${pct}%;background:${clr}"></div></div><div class="bl-prog-lbl">${pct}% · ${rem||0}h rem</div></div>`;
        })();
    const createdDate = i.fields['System.CreatedDate'];
    const closedDate  = i.fields['Microsoft.VSTS.Common.ClosedDate'];
    const isDoneItem  = _isDone(stateStr);
    let tempoDias = null;
    if (createdDate) {
      const end = isDoneItem && closedDate ? new Date(closedDate) : new Date();
      tempoDias = Math.round((end - new Date(createdDate)) / 86400000);
    }
    const tempoHtml = tempoDias === null
      ? '<span style="color:#94a3b8">—</span>'
      : isDoneItem
        ? `${tempoDias} dias`
        : `<span style="color:${tempoDias>30?'#dc2626':tempoDias>14?'#f59e0b':'#374151'}">${tempoDias} dias ↑</span>`;
    const url2     = `https://dev.azure.com/${encodeURIComponent(Store.getActiveTeam()?.org||'')}/${encodeURIComponent(Store.getActiveTeam()?.proj||'')}/_workitems/edit/${i.id}`;
    return (
      `<tr class="qual-parent-row" onclick="toggleCh('q${i.id}')" style="cursor:pointer">` +
      `<td><span class="xicon" id="ico-q${i.id}">&#9654;</span></td>` +
      `<td><span class="badge ${tc2}">${esc2(tipo2)}</span></td>` +
      `<td><a href="${url2}" target="_blank" class="az-link">${i.id}</a></td>` +
      `<td style="max-width:260px"><a href="${url2}" target="_blank" class="az-link">${esc2(i.fields['System.Title']||'')}</a></td>` +
      `<td><span class="sb ${sc}">${esc2(stateStr)}</span></td>` +
      `<td class="exec-cell">${execH}</td>` +
      `<td class="text-center mono">${tempoHtml}</td>` +
      `<td class="text-center mono" id="blk-${i.id}">—</td>` +
      `<td class="text-center" style="padding:4px 8px">${progHtml}</td>` +
      `<td class="text-center mono">${estFmt}</td>` +
      `<td class="text-center mono">${remFmt}</td>` +
      `<td><span style="display:inline-flex;align-items:center;gap:5px"><span style="color:${sevColor(sev2)};font-size:14px;line-height:1">●</span>${esc2(sev2)}</span></td>` +
      `<td><span style="display:inline-flex;align-items:center;gap:5px"><span style="color:${priColor(pri)};font-size:14px;line-height:1">●</span>${pri}</span></td>` +
      `</tr>` +
      `<tr class="qual-child-row" id="cr-q${i.id}" data-item-id="${i.id}" style="display:none"><td colspan="13" class="children-cell"><div class=\"tl-card\"><div class=\"tl-header\" onclick=\"toggleTimeline(this,${i.id})\">📋 Histórico do Board <span class=\"tl-chevron\">▶</span></div><div class=\"tl-track\" style=\"display:none\"></div></div></td></tr>`
    );
  }).join('');
  const tblHtml = `<div class="qual-tbl-wrap"><table class="qual-tbl"><thead><tr><th style="width:20px"></th><th class="sort-th" onclick="sortTbl(this)">Tipo</th><th class="sort-th" onclick="sortTbl(this)">ID</th><th class="sort-th" onclick="sortTbl(this)">Nome</th><th class="sort-th" onclick="sortTbl(this)">Status</th><th class="sort-th" onclick="sortTbl(this)">Executor</th><th class="sort-th text-center" title="Itens fechados: dias entre criação e fechamento. Itens abertos: dias desde a criação. ↑ = ainda em aberto." onclick="sortTbl(this)">Tempo Correção</th><th class="sort-th text-center" title="Dias que o item ficou bloqueado (tag block/bloqueio ou campo Blocked=Yes)" onclick="sortTbl(this)">Bloq.</th><th class="sort-th" style="text-align:center" title="Progresso baseado em Estimativa vs Remaining atual" onclick="sortTbl(this)">Progresso</th><th class="sort-th text-center" title="Bug: max RemainingWork histórico via revisões. Defect: soma max rem. das tasks filhas — mesmo critério da tabela de Sprint." onclick="sortTbl(this)">Estimativa</th><th class="sort-th text-center" title="Microsoft.VSTS.Scheduling.RemainingWork" onclick="sortTbl(this)">Remaining Work</th><th class="sort-th" onclick="sortTbl(this)">Severidade</th><th class="sort-th" onclick="sortTbl(this)">Prioridade</th></tr></thead><tbody>${tblRows}</tbody></table></div>`;

  content.innerHTML = kpiHtml + `<div class="qual-charts-3">
    <div class="qual-chart-wrap"><div class="qual-chart-title">🔴 Por Severity</div><div style="position:relative;height:220px"><canvas id="qc-sev"></canvas></div></div>
    <div class="qual-chart-wrap"><div class="qual-chart-title">🎯 Por Priority</div><div style="position:relative;height:220px"><canvas id="qc-pri"></canvas></div></div>
    <div class="qual-chart-wrap"><div class="qual-chart-title">📋 Por State</div><div style="position:relative;height:220px"><canvas id="qc-state"></canvas></div></div>
  </div>` + filterBarHtml + tblHtml;
  _preloadBlockTimes(items.map(i => i.id));

  const count = (arr, key) => { const map={}; arr.forEach(i=>{const v=i.fields[key]||'Não definido'; map[v]=(map[v]||0)+1;}); return map; };

  const mkPie = (id, data, colorFn) => {
    const labels = Object.keys(data).sort();
    const vals   = labels.map(l=>data[l]);
    const colors = labels.map(l=>colorFn(l));
    _qualDestroy(id);
    QUAL_CHARTS[id] = new Chart(document.getElementById(id), {
      type: 'pie',
      data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 2 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{size:11}, boxWidth:12, padding:8 } } } }
    });
  };

  mkPie('qc-sev',   count(items, 'Microsoft.VSTS.Common.Severity'),  sevColor);
  mkPie('qc-pri',   count(items, 'Microsoft.VSTS.Common.Priority'),   priColor);
  mkPie('qc-state', count(items, 'System.State'),                     stateColor);
  document.getElementById('qual-llm-section').style.display = '';
}

// ── SPRINT HISTORY (now in Eficiência) ───────────────────────────────

function _renderHistoryTable(backlog, tasks, team) {
  const e2 = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const childMap = {};
  tasks.forEach(t => { const p=String(t.parentId||''); if(!childMap[p]) childMap[p]=[]; childMap[p].push(t); });

  const _stBadge = state => {
    const sl=(state||'').toLowerCase(), se=e2(state)||'To Do';
    if(sl==='done'||sl==='closed'||sl==='resolved'||sl==='concluído'||sl==='completed'||sl==='finalizado') return ['s-done',se];
    if(sl.includes('progress')||sl==='active'||sl.includes('andamento')||sl==='doing'||sl==='in progress') return ['s-doing',se];
    if(sl.includes('test')||sl==='qa'||sl==='ready'||sl.includes('wait')||sl.includes('aguard')||sl.includes('valid')) return ['s-testing',se];
    if(sl==='removed'||sl==='cancelled'||sl==='canceled') return ['s-removed',se];
    if(sl==='design'||sl.includes('analis')) return ['s-design',se];
    return ['s-todo',se];
  };

  let rows = '';
  backlog.forEach(item => {
    const hid = 'h'+String(item.id);
    const url = `https://dev.azure.com/${encodeURIComponent(team.org)}/${encodeURIComponent(team.proj)}/_workitems/edit/${item.id}`;
    const tl  = item.type==='Product Backlog Item'?'PBI':item.type==='Defect'?'Defect':item.type;
    const tc  = (item.type==='Bug'||item.type==='Defect')?'badge-bug':'badge-pbi';
    let [sc, sl] = item.blockStatus==='BLOCKED' ? ['s-blocked','Bloqueado'] : item.blockStatus==='FIXING' ? ['s-fixing','Em fixing'] : _stBadge(item.state);

    const ch     = childMap[String(item.id)] || [];
    const noTasks = ch.length === 0;
    let progHtml;
    if (noTasks) {
      progHtml = `<span class="no-tasks-warn">N\u00e3o estimado</span>`;
    } else if (item.estimativa === 0) {
      progHtml = `<span class="no-est-warn">Itens n\u00e3o estimados</span>`;
    } else {
      const pct = Math.round(Math.max(0, Math.min(100, (item.estimativa - item.childRem) / item.estimativa * 100)));
      const clr = pct >= 80 ? '#16a34a' : pct >= 40 ? '#3b82f6' : '#f59e0b';
      progHtml = `<div class="bl-prog"><div class="bl-prog-bar"><div class="bl-prog-fill" style="width:${pct}%;background:${clr}"></div></div><div class="bl-prog-lbl">${pct}% \u00b7 ${item.childRem}h rem</div></div>`;
    }

    const execH = (() => {
      const ex={};
      ch.forEach(c=>{if(c.assignedTo?.trim()) ex[c.assignedTo.trim()]=true;});
      return Object.keys(ex).length ? Object.keys(ex).map(n=>`<span class="mav" title="${e2(n)}">${n.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()}</span>`).join('') : '<span style="color:#94a3b8">\u2014</span>';
    })();

    const _isDoneEf = s => { const sl2=(s||'').toLowerCase(); return sl2==='done'||sl2==='closed'||sl2==='resolved'||sl2==='concluído'||sl2==='completed'||sl2==='finalizado'||sl2==='fechado'; };
    let tempoDias = null;
    if (item.createdDate) {
      const done2 = _isDoneEf(item.state);
      const end2  = done2 && item.closedDate ? new Date(item.closedDate) : new Date();
      tempoDias   = Math.round((end2 - new Date(item.createdDate)) / 86400000);
    }
    const tempoImplHtml = tempoDias === null
      ? '<span style="color:#94a3b8">\u2014</span>'
      : _isDoneEf(item.state)
        ? `${tempoDias} dias`
        : `<span style="color:${tempoDias>30?'#dc2626':tempoDias>14?'#f59e0b':'#374151'}">${tempoDias} dias \u2191</span>`;

    rows += `<tr class="bl-row" onclick="toggleCh('${hid}')" style="cursor:pointer">`+
      `<td><span class="xicon" id="ico-${hid}">&#9654;</span></td>`+
      `<td><span class="badge ${tc}">${e2(tl)}</span></td>`+
      `<td class="id-cell"><a href="${url}" target="_blank" class="az-link">#${item.id}</a></td>`+
      `<td class="title-cell" style="max-width:280px"><a href="${url}" target="_blank" class="az-link title-link">${e2(item.title)}</a></td>`+
      `<td><span class="sb ${sc}">${sl}</span></td>`+
      `<td class="exec-cell">${execH}</td>`+
      `<td class="text-center mono">${tempoImplHtml}</td>`+
      `<td class="text-center mono" id="blk-${item.id}">—</td>`+
      `<td class="text-center" style="padding:4px 8px">${progHtml}</td>`+
      `<td class="text-center mono rem-col">${item.estimativa>0?item.estimativa+'h':'\u2014'}</td>`+
      `<td class="text-center mono">${item.childRem>0?item.childRem+'h':'\u2014'}</td></tr>`;

    {
      const isDoneS = s => { const sl2=(s||'').toLowerCase(); return sl2==='done'||sl2==='closed'||sl2==='resolved'; };
      const doing=ch.filter(c=>!isDoneS(c.state)), doneC=ch.filter(c=>isDoneS(c.state));
      const mkCard=(c,done)=>{
        const cu=`https://dev.azure.com/${encodeURIComponent(team.org)}/${encodeURIComponent(team.proj)}/_workitems/edit/${c.id}`;
        const tl2=c.type==='Bug'?'Bug':'Task', tc2=c.type==='Bug'?'badge-bug':'badge-task';
        const [sc2,sl2] = done?['s-done','Conclu\u00eddo']:_stBadge(c.state);
        return `<div class="task-card ${done?'tc-done':'tc-doing'}"><div class="tc-head"><span class="badge ${tc2} tc-badge">${tl2}</span><a href="${cu}" target="_blank" class="az-link" style="font-size:11px">#${c.id}</a></div>`+
          `<div class="tc-title"><a href="${cu}" target="_blank" class="az-link">${e2(c.title)}</a></div>`+
          `<div class="tc-foot"><span class="sb ${sc2}" style="font-size:10px">${sl2}</span>${!done&&c.remaining>0?`<span class="tc-hours">${c.remaining}h rem.</span>`:done&&c.estimated>0?`<span class="tc-hours" style="opacity:.6">${c.estimated}h est.</span>`:''}</div>`+
          (c.assignedTo?`<div class="tc-assigned">${e2(c.assignedTo)}</div>`:'')+`</div>`;
      };
      rows += `<tr class="children-row" id="cr-${hid}" data-item-id="${item.id}" style="display:none"><td colspan="11" class="children-cell">`+
        `<div class="tl-card"><div class="tl-header" onclick="toggleTimeline(this,${item.id})">📋 Histórico do Board <span class="tl-chevron">▶</span></div><div class="tl-track" style="display:none"></div></div>`+
        `<div class="children-wrap">`+
        `<div class="children-col"><div class="col-header col-doing">Em andamento (${doing.length})</div><div class="cards-wrap">${doing.map(c=>mkCard(c,false)).join('')||'<div style="font-size:11px;color:#94a3b8;padding:4px 0;font-style:italic">Nenhuma em andamento</div>'}</div></div>`+
        `<div class="children-col"><div class="col-header col-done">Conclu\u00eddo (${doneC.length})</div><div class="cards-wrap">${doneC.map(c=>mkCard(c,true)).join('')||'<div style="font-size:11px;color:#94a3b8;padding:4px 0;font-style:italic">Nenhuma conclu\u00edda</div>'}</div></div>`+
        `</div></td></tr>`;
    }
  });

  if (!rows) return '<div class="mod-empty" style="padding:24px"><h3>Nenhum item encontrado</h3></div>';

  const noEstCount  = backlog.filter(b => childMap[String(b.id)] && childMap[String(b.id)].length && b.estimativa===0).length;
  const noTaskCount = backlog.filter(b => !childMap[String(b.id)]?.length).length;
  const warningBanner = (noTaskCount||noEstCount) ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#c2410c">` +
    (noTaskCount?`⚠️ <strong>${noTaskCount}</strong> ite${noTaskCount===1?'m':'ns'} sem tasks (Não estimado). `:'') +
    (noEstCount?`⚠️ <strong>${noEstCount}</strong> ite${noEstCount===1?'m':'ns'} com tasks mas sem estimativa.`:'') +
    `</div>` : '';

  return warningBanner +
    `<div class="bl-table-wrap"><table class="bl-table"><thead><tr><th></th><th class="sort-th" onclick="sortTbl(this)">Tipo</th><th class="sort-th" onclick="sortTbl(this)">ID</th><th class="sort-th" onclick="sortTbl(this)">T\u00edtulo</th><th class="sort-th" onclick="sortTbl(this)">Status</th><th class="sort-th" onclick="sortTbl(this)">Executores</th><th class="sort-th text-center" title="Itens fechados: dias entre cria\u00e7\u00e3o e fechamento. Itens abertos: dias desde a cria\u00e7\u00e3o. \u2191 = ainda em aberto." onclick="sortTbl(this)">Tempo Impl.</th><th class="sort-th text-center" title="Dias que o item ficou bloqueado (tag block/bloqueio ou campo Blocked=Yes)" onclick="sortTbl(this)">Bloq.</th><th class="sort-th" style="text-align:center" onclick="sortTbl(this)">Progresso</th><th class="sort-th" style="text-align:center" onclick="sortTbl(this)">Estimativa</th><th class="sort-th" style="text-align:center" onclick="sortTbl(this)">Rem. atual</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function runEficienciaBacklogTable(team, pat, checked) {
  const section = document.getElementById('ef-backlog-section');
  const el      = document.getElementById('ef-backlog-content');
  if (!section || !el) return;
  section.style.display = '';
  el.innerHTML = '<div class="spinner-wrap" style="padding:24px"><div class="spinner"></div>Carregando todos os work items…</div>';

  try {
    const ids   = await SprintAPI.getAllBacklogIds(team.org, team.proj, pat);
    const items = await AzureAPI.getWorkItemsBatch(team.org, team.proj, ids, pat);

    const backlog = [], tasks = [];
    items.forEach(item => {
      const type     = item.fields['System.WorkItemType'];
      const parentId = item.fields['System.Parent'];
      const isTask   = type === 'Task' || (type === 'Bug' && !!parentId);
      const obj = {
        id: item.id, type, title: item.fields['System.Title'],
        state: item.fields['System.State'],
        assignedTo: DataProcessor._dispName(item.fields['System.AssignedTo']),
        sprint: (item.fields['System.IterationPath']||'').split('\\').pop(),
        blockStatus: DataProcessor._blockStatus(item),
        createdDate: item.fields['System.CreatedDate'] || null,
        closedDate:  item.fields['Microsoft.VSTS.Common.ClosedDate'] || null
      };
      if (isTask) {
        tasks.push({ ...obj, parentId: parentId||null,
          remaining: Number(item.fields['Microsoft.VSTS.Scheduling.RemainingWork'])||0,
          completed: Number(item.fields['Microsoft.VSTS.Scheduling.CompletedWork'])||0 });
      } else {
        backlog.push({ ...obj, storyPoints: Number(item.fields['Microsoft.VSTS.Scheduling.StoryPoints'])||0 });
      }
    });

    if (tasks.length) {
      const maxRem = await _fetchMaxRem(team.org, team.proj, tasks.map(t => t.id), pat);
      tasks.forEach(t => { t.estimated = maxRem[t.id] ?? t.remaining; });
    } else {
      tasks.forEach(t => { t.estimated = t.remaining; });
    }

    const estMap = {}, remMap = {};
    const _isDoneT = s => { const sl = (s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'; };
    tasks.forEach(t => {
      const p = String(t.parentId||'');
      if (!estMap[p]) estMap[p] = 0; estMap[p] += t.estimated||0;
      if (!_isDoneT(t.state)) { if (!remMap[p]) remMap[p] = 0; remMap[p] += t.remaining||0; }
    });
    backlog.forEach(b => { b.estimativa = estMap[String(b.id)]||0; b.childRem = remMap[String(b.id)]||0; });

    APP.efBacklogRaw = { backlog, tasks, team };
    buildEfBacklogFilters(backlog);
    applyEfBacklogFilters();
  } catch(err) {
    el.innerHTML = `<div style="color:#dc2626;padding:12px;font-size:13px">\u26a0\ufe0f Erro: ${esc(err.message)}</div>`;
  }
}

// ── EFICIÊNCIA BACKLOG FILTERS ────────────────────────────────────────
const _efIsDone = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'||sl==='concluído'||sl==='completed'||sl==='finalizado'||sl==='fechado'; };

function buildEfBacklogFilters(backlog) {
  const statuses = [...new Set(backlog.map(b => b.state).filter(Boolean))].sort();
  const execs    = [...new Set(backlog.map(b => b.assignedTo||'—'))].sort();
  const sprints  = [...new Set(backlog.map(b => b.sprint).filter(Boolean))].sort();

  const sList = document.getElementById('efbl-status-list');
  if (sList) sList.innerHTML = statuses.map(s =>
    `<label class="ef-bl-dd-item"><input type="checkbox" value="${esc(s)}" onchange="updateEfDdCount('status');applyEfBacklogFilters()"> ${esc(s)}</label>`
  ).join('');

  const eList = document.getElementById('efbl-exec-list');
  if (eList) eList.innerHTML = execs.map(ex =>
    `<label class="ef-bl-dd-item"><input type="checkbox" value="${esc(ex)}" onchange="updateEfDdCount('exec');applyEfBacklogFilters()"> ${esc(ex)}</label>`
  ).join('');

  const spList = document.getElementById('efbl-sprint-list');
  if (spList) spList.innerHTML = sprints.map(s =>
    `<label class="ef-bl-dd-item"><input type="checkbox" value="${esc(s)}" onchange="updateEfDdCount('sprint');applyEfBacklogFilters()"> ${_shortSprintLabel(s)}</label>`
  ).join('');

  const allSt = document.getElementById('efbl-status-all');
  if (allSt) allSt.checked = false;
  const allEx = document.getElementById('efbl-exec-all');
  if (allEx) allEx.checked = false;
  const allSp = document.getElementById('efbl-sprint-all');
  if (allSp) allSp.checked = false;

  updateEfDdCount('status');
  updateEfDdCount('exec');
  updateEfDdCount('sprint');
}

function updateEfDdCount(type) {
  const map = {
    status: ['efbl-status-list', 'efbl-status-count', 'efbl-status-all'],
    exec:   ['efbl-exec-list',   'efbl-exec-count',   'efbl-exec-all'],
    sprint: ['efbl-sprint-list', 'efbl-sprint-count', 'efbl-sprint-all']
  };
  const [listId, spanId, allId] = map[type] || [];
  if (!listId) return;
  const list = document.getElementById(listId);
  if (!list) return;
  const total   = list.querySelectorAll('input').length;
  const checked = list.querySelectorAll('input:checked').length;
  const span    = document.getElementById(spanId);
  if (span) span.textContent = checked === total ? `(${total})` : `(${checked}/${total})`;
  const allCb = document.getElementById(allId);
  if (allCb) allCb.checked = (checked === total && total > 0);
}

function toggleEfDd(type) {
  const ids = ['efbl-status-dd', 'efbl-exec-dd', 'efbl-sprint-dd'];
  const map = { status: 'efbl-status-dd', exec: 'efbl-exec-dd', sprint: 'efbl-sprint-dd' };
  const target = map[type];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('open', id === target && !el.classList.contains('open'));
  });
}

function toggleEfDdAll(type) {
  const map = {
    status: ['efbl-status-list', 'efbl-status-all'],
    exec:   ['efbl-exec-list',   'efbl-exec-all'],
    sprint: ['efbl-sprint-list', 'efbl-sprint-all']
  };
  const [listId, allId] = map[type] || [];
  if (!listId) return;
  const checked = document.getElementById(allId)?.checked ?? false;
  document.getElementById(listId)?.querySelectorAll('input').forEach(cb => { cb.checked = checked; });
  updateEfDdCount(type);
  applyEfBacklogFilters();
}

function applyEfBacklogFilters() {
  const raw = APP.efBacklogRaw;
  if (!raw) return;
  const titleQ = (document.getElementById('efbl-title')?.value || '').toLowerCase().trim();
  const idQ    = (document.getElementById('efbl-id')?.value    || '').toLowerCase().trim();
  const selSt  = [...(document.getElementById('efbl-status-list')?.querySelectorAll('input:checked') || [])].map(c => c.value);
  const selEx  = [...(document.getElementById('efbl-exec-list')?.querySelectorAll('input:checked')   || [])].map(c => c.value);
  const selSp  = [...(document.getElementById('efbl-sprint-list')?.querySelectorAll('input:checked') || [])].map(c => c.value);

  const filtered = raw.backlog.filter(b => {
    if (titleQ && !b.title.toLowerCase().includes(titleQ))        return false;
    if (idQ    && !String(b.id).includes(idQ))                    return false;
    if (selSt.length && !selSt.includes(b.state))                 return false;
    if (selEx.length && !selEx.includes(b.assignedTo||'—'))       return false;
    if (selSp.length && !selSp.includes(b.sprint||''))            return false;
    return true;
  });

  document.getElementById('ef-backlog-content').innerHTML =
    _renderHistoryTable(filtered, raw.tasks, raw.team);
  _preloadBlockTimes(filtered.map(i => i.id));
}

// KPI tooltip: fixed positioning to escape stacking contexts
document.addEventListener('mouseover', e => {
  const icon = e.target.closest('.kpi-tip-icon');
  if (!icon) return;
  const box = icon.closest('.kpi-tip')?.querySelector('.kpi-tip-box');
  if (!box) return;
  box.style.display = 'block';
  box.style.top = '-999px'; box.style.left = '-999px';
  const bh = box.offsetHeight;
  const r  = icon.getBoundingClientRect();
  let left = r.left + r.width / 2 - 115;
  left = Math.max(8, Math.min(left, window.innerWidth - 238));
  let top = r.top - bh - 10;
  if (top < 8) top = r.bottom + 10;
  box.style.left = left + 'px';
  box.style.top  = top  + 'px';
});
document.addEventListener('mouseout', e => {
  if (!e.target.closest('.kpi-tip-icon')) return;
  const box = e.target.closest('.kpi-tip')?.querySelector('.kpi-tip-box');
  if (box) box.style.display = 'none';
});

// Close dropdowns when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('#db-team-dd')) {
    document.getElementById('db-team-menu')?.classList.remove('open');
  }
  if (!e.target.closest('.ef-bl-dd-wrap') && !e.target.closest('#ef-sprint-graph-wrap')) {
    document.querySelectorAll('.ef-bl-dd.open').forEach(d => d.classList.remove('open'));
    document.getElementById('ef-sprint-graph-dd')?.classList.remove('open');
  }
});

// ── QUALIDADE LLM ─────────────────────────────────────────────────────
function _buildQualSysPrompt() {
  return `Você é um engenheiro de qualidade sênior analisando bugs e defeitos de um projeto de software.
FORMATO: retorne SOMENTE um array JSON válido, sem markdown externo:
[{"severity":"critical|warning|info|ok","icon":"emoji","title":"Título com emoji","body":"2-3 frases com dados reais."}]

DEFINIÇÕES DOS KPIs:
- Abertos: bugs/defeitos com estado diferente de Done/Closed/Resolved
- Fechados: bugs/defeitos com estado Done/Closed/Resolved
- Abertos último mês: itens criados nos últimos 30 dias
- Tempo médio de resolução: média de (ClosedDate - CreatedDate) em dias para itens fechados
- Remaining Work: soma do campo RemainingWork dos itens abertos
- Estimativa Total: soma do maior RemainingWork já registrado nas revisões (bugs=próprio item, defeitos=tasks filhas)
- Tempo Gasto por item: para bugs = max(RemainingWork histórico); para defeitos = soma do max(RemainingWork) das tasks filhas

SEVERIDADES:
critical 🚨 — volume alto de criticos/highs abertos, tempo de resolução muito alto, estimativa sem controle
warning  ⚠️ — tendência de crescimento, itens sem prioridade definida, defeitos sem quebra de tasks
info     💡 — padrão observado, distribuição por severity/priority, oportunidade de melhoria
ok       ✅ — indicadores dentro do esperado, redução de abertos, bom tempo de resolução

REGRAS:
- Gere 4 a 6 insights. Cite sempre números reais dos dados fornecidos.
- Use o contexto do time (RAG) para enriquecer a análise.
- Priorize itens Critical e High abertos.`;
}

function _buildQualUserPrompt(allItems, horasGastas, rag) {
  const _isDone = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'||sl==='concluído'||sl==='completed'; };
  const bugs    = allItems.filter(i => i.fields['System.WorkItemType']==='Bug');
  const defects = allItems.filter(i => i.fields['System.WorkItemType']==='Defect');
  const openAll = allItems.filter(i => !_isDone(i.fields['System.State']));
  const monthAgo = Date.now() - 30*86400000;
  const abertosMes = allItems.filter(i => { const cd=i.fields['System.CreatedDate']; return cd && new Date(cd).getTime()>=monthAgo; }).length;

  const avgRes = arr => {
    const vals = arr.filter(i=>_isDone(i.fields['System.State'])).map(i=>{
      const cd=i.fields['Microsoft.VSTS.Common.ClosedDate'], cr=i.fields['System.CreatedDate'];
      if(!cd||!cr) return null;
      const d=Math.round((new Date(cd)-new Date(cr))/86400000);
      return d>=0?d:null;
    }).filter(v=>v!==null);
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
  };

  const countBy = (arr, field) => {
    const m={};
    arr.forEach(i=>{ const v=i.fields[field]||'Não definido'; m[v]=(m[v]||0)+1; });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ${v}`).join(', ');
  };

  const totalRem = allItems.reduce((a,i)=>a+(Number(i.fields['Microsoft.VSTS.Scheduling.RemainingWork'])||0),0);
  const tgo = APP.qualTempoGasto || {};
  const top5 = [...allItems].sort((a,b)=>(tgo[b.id]||0)-(tgo[a.id]||0)).slice(0,5)
    .map(i=>`  #${i.id} [${i.fields['System.WorkItemType']}] ${(i.fields['System.Title']||'').substring(0,60)} | tempo=${tgo[i.id]||0}h | sev=${i.fields['Microsoft.VSTS.Common.Severity']||'—'} | state=${i.fields['System.State']||'—'}`).join('\n');

  return `=== CONTEXTO DO TIME ===\n${rag||'Nenhum contexto cadastrado.'}\n\n` +
    `=== KPIs DE QUALIDADE ===\n` +
    `Total de itens carregados: ${allItems.length} (${bugs.length} Bugs, ${defects.length} Defeitos)\n` +
    `Abertos: ${openAll.length} | Fechados: ${allItems.length - openAll.length}\n` +
    `Abertos último mês (30 dias): ${abertosMes}\n` +
    `Tempo médio resolução Bug: ${avgRes(bugs)===null?'—':avgRes(bugs)+' dias'}\n` +
    `Tempo médio resolução Defect: ${avgRes(defects)===null?'—':avgRes(defects)+' dias'}\n` +
    `Remaining Work total (abertos): ${totalRem}h\n` +
    `Estimativa Total (max rem histórico): ${horasGastas!==null?horasGastas+'h':'não calculado'}\n\n` +
    `Distribuição por Severity (todos): ${countBy(allItems,'Microsoft.VSTS.Common.Severity')}\n` +
    `Distribuição por Priority (todos): ${countBy(allItems,'Microsoft.VSTS.Common.Priority')}\n` +
    `Distribuição por State (todos): ${countBy(allItems,'System.State')}\n\n` +
    `Top 5 itens por tempo gasto:\n${top5}\n\n` +
    `Gere insights de qualidade baseados nesses dados.`;
}

async function runQualidadeLLM() {
  const llmConf = Store.getActiveLlm();
  if (!llmConf) { toast('Configure um LLM em Configurações → Tokens LLM.','warn'); return; }
  const el = document.getElementById('qual-llm-output');
  el.innerHTML = '<div class="spinner-wrap" style="padding:16px"><div class="spinner"></div>Analisando qualidade com IA…</div>';
  try {
    const token = await Store.getActiveLlmToken();
    if (!token) throw new Error('Token LLM não encontrado.');
    const rag = Store.getActiveRag();
    const sys = _buildQualSysPrompt();
    const usr = _buildQualUserPrompt(APP.qualidadeData || [], APP.qualHorasGastas, rag);
    const raw  = await LLM.call(llmConf.provider, token, sys, usr);
    const ins  = LLM.parseJson(raw);
    APP.insightCards = ins;
    el.innerHTML = `<div class="insights-grid">${DB.renderInsightCards(ins)}</div>`;
  } catch(e) {
    el.innerHTML = `<div style="color:#dc2626;padding:12px;font-size:13px">Erro: ${esc(e.message)}</div>`;
    toast('Erro LLM: '+e.message,'err');
  }
}

// ── SYNC & DASHBOARD ACTIONS ──────────────────────────────────────────
async function runSync() {
  if (APP.syncRunning) return;
  APP.syncRunning = true;
  const team = Store.getActiveTeam();
  if (!team) { toast('Nenhum time ativo. Vá em Times e ative um.','warn'); APP.syncRunning=false; return; }
  const topbar = document.getElementById('db-topbar');
  if (topbar.firstChild) topbar.insertAdjacentHTML('afterbegin','<div style="height:3px;background:linear-gradient(90deg,transparent,#60a5fa,transparent);background-size:200% 100%;animation:loading 1.5s infinite;margin-bottom:8px"></div>');
  toast('Sincronizando…');
  try {
    const data = await DataProcessor.sync();
    APP.insightCards = [];
    DB.render(data);
    loadInsights(false);
    toast(`Sprint "${data.activeSprint.path.split('\\').pop()}" sincronizada!`,'ok');
  } catch(e) {
    toast('Erro na sincronização: '+e.message,'err',6000);
    console.error(e);
  }
  APP.syncRunning = false;
}

async function loadInsights(fromCache) {
  const grid = document.getElementById('insights-grid');
  if (!grid) return;
  const data = APP.sprintData;
  if (!data) { console.warn('[Insights] APP.sprintData não definido'); return; }
  const { stats, capacity, tasks, backlog } = data;
  const rag = Store.getActiveRag();

  if (fromCache && APP.insightCards.length) {
    grid.innerHTML = DB.renderInsightCards(APP.insightCards);
    return;
  }

  const llmConf = Store.getActiveLlm();
  if (!llmConf) {
    console.warn('[Insights] Nenhum token LLM ativo — configure em IA & Tokens.');
    const fb = Validator.localFallback(stats, capacity, stats.byActivity);
    APP.insightCards = fb;
    grid.innerHTML = DB.renderInsightCards(APP.insightCards);
    return;
  }

  const _setSpinner = msg => { grid.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div>${msg}</div>`; };
  _setSpinner('Agente 1 — Gerando insights…');
  try {
    const token = await Store.getActiveLlmToken();
    if (!token) throw new Error('Token LLM indisponível — verifique se o vault está desbloqueado e o token salvo.');
    const feedbackCtx = buildFeedbackContext() + buildUserLevelContext();
    const qualData = APP.qualidadeData ? { items: APP.qualidadeData, tempoGasto: APP.qualTempoGasto || {}, horasGastas: APP.qualHorasGastas } : null;
    const usr = LLM.buildUserPrompt(stats, capacity, stats.byActivity, rag, tasks, backlog, APP.eficienciaData || null, qualData)
              + (feedbackCtx ? `\n\n${feedbackCtx}` : '');
    console.log('[Insights] Iniciando chain 3 agentes — provider:', llmConf.provider, '| efData:', !!APP.eficienciaData, '| qualData:', !!qualData);
    const raw   = await LLM.runAgentChain(llmConf.provider, token, usr, (msg) => _setSpinner(msg));
    const parsed= LLM.parseJson(raw);
    const valid = Validator.validate(parsed, stats, capacity, rag);
    APP.insightCards = valid;
    grid.innerHTML = DB.renderInsightCards(APP.insightCards);
  } catch(e) {
    console.error('[Insights] Erro LLM:', e);
    const fb = Validator.localFallback(stats, capacity, stats.byActivity);
    APP.insightCards = fb;
    grid.innerHTML = DB.renderInsightCards(APP.insightCards);
    toast('IA indisponível: ' + e.message, 'warn', 6000);
  }
}

function clearInsights() {
  APP.insightCards = [];
  const grid = document.getElementById('insights-grid');
  if (grid) grid.innerHTML = '';
}

function rmInsight(btn) {
  const card = btn.closest('.ins-card');
  const title = card.querySelector('.ins-title2')?.textContent || '';
  APP.insightCards = APP.insightCards.filter(i => i.title !== title);
  card.remove();
}

function giveInsightFeedback(btn, rating) {
  const card  = btn.closest('.ins-card');
  const title = card.querySelector('.ins-title2')?.textContent || '';
  const ins   = APP.insightCards.find(i => i.title === title);
  if (!ins) return;
  const team   = Store.getActiveTeam();
  const sprint = APP.sprintData?.activeSprint?.path?.split('\\').pop() || '';
  const entry  = {
    id: 'fb_' + Date.now(),
    rating,
    insight: { severity: ins.severity, icon: ins.icon, title: ins.title, body: ins.body },
    teamId:   team?.id   || null,
    teamName: team?.name || null,
    sprint,
    timestamp: Date.now()
  };
  const all = Store.getInsightFeedback();
  const kept = all.filter(f => !(f.insight.title === ins.title && f.teamId === entry.teamId));
  kept.push(entry);
  Store.saveInsightFeedback(kept);
  card.querySelectorAll('.ins-fb-btn').forEach(b => b.classList.remove('voted-good','voted-bad'));
  btn.classList.add(rating === 'good' ? 'voted-good' : 'voted-bad');
  toast(rating === 'good' ? 'Feedback positivo registrado!' : 'Feedback negativo registrado!', 'ok', 2000);
}

function buildUserLevelContext() {
  return '';
}

function buildFeedbackContext() {
  const team = Store.getActiveTeam();
  const all  = Store.getInsightFeedback()
    .filter(f => !team || !f.teamId || f.teamId === team.id)
    .slice(-40);
  if (!all.length) return '';
  const good = all.filter(f => f.rating === 'good');
  const bad  = all.filter(f => f.rating === 'bad');
  let ctx = '\n\nFEEDBACK DE TREINAMENTO DO USUÁRIO (calibre os próximos insights com base nisto):\n';
  if (good.length) {
    ctx += '✅ EXEMPLOS APROVADOS — gere insights semelhantes a estes:\n' +
      good.map(f => `  [${f.insight.severity}] ${f.insight.title} — ${f.insight.body.substring(0,120)}`).join('\n') + '\n';
  }
  if (bad.length) {
    ctx += '❌ EXEMPLOS REPROVADOS — evite este tipo de insight:\n' +
      bad.map(f => `  [${f.insight.severity}] ${f.insight.title} — ${f.insight.body.substring(0,120)}`).join('\n') + '\n';
  }
  return ctx;
}

function _fmtBlockTime(ms, startMs) {
  const h = ms / 3600000;
  if (h <= 8) return Math.round(h)+'h';
  if (h < 24 && startMs) {
    const tod = new Date(); tod.setHours(0,0,0,0);
    const yes = new Date(tod); yes.setDate(tod.getDate()-1);
    const sd  = new Date(startMs); sd.setHours(0,0,0,0);
    if (sd.getTime()===tod.getTime()) return 'hoje';
    if (sd.getTime()===yes.getTime()) return 'ontem';
  }
  return Math.round(ms/86400000)+'d';
}

async function _preloadBlockTimes(ids) {
  const team = Store.getActiveTeam();
  const pat  = await Store.getActivePat();
  if (!team || !pat) return;
  await Promise.all(ids.map(async id => {
    try {
      const revs   = await EficienciaAPI.getRevisions(team.org, team.proj, String(id), pat);
      const result = _buildColumnTimeline(revs);
      if (result.totalBlockMs > 0) {
        const blkEl = document.getElementById('blk-'+id);
        if (blkEl) blkEl.innerHTML = `<span style="color:#dc2626;font-weight:700">${_fmtBlockTime(result.totalBlockMs, result.totalBlockStartMs)}</span>`;
      }
    } catch {}
  }));
}

function _buildColumnTimeline(revs) {
  if (!revs || !revs.length) return { html: '<div class="tl-loading">Sem histórico disponível.</div>', totalBlockDays: 0 };
  const steps = [];
  let prevCol = '', prevDate = null;
  for (const rev of revs) {
    const f   = rev.fields || {};
    const col = f['System.BoardColumn'] || f['System.State'] || '';
    const at  = f['System.ChangedDate'];
    const by  = f['System.ChangedBy'];
    const who = typeof by === 'object' ? (by?.displayName || '') : String(by || '');
    if (!col) continue;
    if (col !== prevCol) {
      if (prevCol && prevDate && at && steps.length) {
        const endDt = new Date(at);
        steps[steps.length - 1].days = Math.max(0, Math.round((endDt - new Date(prevDate)) / 86400000));
        steps[steps.length - 1].endDate = endDt;
      }
      steps.push({ col, startDate: at, enteredBy: who, days: null, isCurrent: false, endDate: null, blockMs: 0, blockStartMs: null });
      prevCol = col; prevDate = at;
    }
  }
  if (steps.length) {
    const last = steps[steps.length - 1];
    if (last.days === null) {
      const now = new Date();
      last.days = last.startDate ? Math.round((now - new Date(last.startDate)) / 86400000) : null;
      last.endDate = now;
      last.isCurrent = true;
    }
  }
  if (!steps.length) return { html: '<div class="tl-loading">Sem mudanças de coluna registradas.</div>', totalBlockDays: 0 };

  const blockIntervals = [];
  let blockStart = null;
  for (const rev of revs) {
    const f = rev.fields || {};
    const b = f['Custom.Block'];
    const tags2 = String(f['System.Tags'] || '').toLowerCase();
    const isBlocked = b === true || b === 'true' || b === 'True' ||
      tags2.includes('blocked') || tags2.includes('bloqueado') || tags2.includes('block');
    const at = f['System.ChangedDate'];
    if (isBlocked && blockStart === null) { blockStart = at; }
    else if (!isBlocked && blockStart !== null) { blockIntervals.push({ start: new Date(blockStart), end: new Date(at) }); blockStart = null; }
  }
  if (blockStart !== null) blockIntervals.push({ start: new Date(blockStart), end: new Date() });

  for (const step of steps) {
    if (!step.startDate || !step.endDate) continue;
    const sS = new Date(step.startDate).getTime(), sE = step.endDate.getTime();
    let bms = 0, bsms = null;
    for (const iv of blockIntervals) {
      const os = Math.max(iv.start.getTime(), sS), oe = Math.min(iv.end.getTime(), sE);
      if (oe > os) { bms += (oe - os); if (bsms === null) bsms = os; }
    }
    step.blockMs = bms; step.blockStartMs = bsms;
  }
  const totalBlockMs = blockIntervals.reduce((s, iv) => s + (iv.end.getTime() - iv.start.getTime()), 0);
  const totalBlockStartMs = blockIntervals.length ? blockIntervals[0].start.getTime() : null;

  const fmtD  = d => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'}); };
  const short = n => { if (!n) return '—'; const p = n.trim().split(' '); return p.length > 1 ? p[0]+' '+p[p.length-1][0]+'.' : n; };
  const trunc = c => c.length > 22 ? c.slice(0,20)+'…' : c;
  const html  = steps.map((s, i) => {
    const alert = s.days !== null && s.days > 15;
    return `<div class="tl-step${s.isCurrent ? ' tl-current' : ''}">`+
      `<div class="tl-col-name" title="${s.col}">${trunc(s.col)}</div>`+
      `<div class="tl-days${alert ? ' tl-alert' : ''}">${s.days !== null ? s.days+'d' : '—'}</div>`+
      `<div class="tl-who" title="${s.enteredBy}">${short(s.enteredBy)}</div>`+
      `<div class="tl-date">${fmtD(s.startDate)}</div>`+
      (s.blockMs > 0 ? `<div class="tl-block">${ICONS.lock} ${_fmtBlockTime(s.blockMs, s.blockStartMs)}</div>` : '')+
      `</div>${i < steps.length - 1 ? '<div class="tl-arrow">›</div>' : ''}`;
  }).join('');
  return { html, totalBlockMs, totalBlockStartMs };
}

function toggleCh(id) {
  const row = document.getElementById('cr-'+id);
  const ico = document.getElementById('ico-'+id);
  if (!row) return;
  const open = row.style.display !== 'none';
  row.style.display = open ? 'none' : '';
  if (ico) ico.classList.toggle('expanded', !open);
}

async function toggleTimeline(btn, itemId) {
  const card  = btn.closest('.tl-card');
  const track = card.querySelector('.tl-track');
  const chev  = btn.querySelector('.tl-chevron');
  if (!card.dataset.tlLoaded) {
    if (chev) chev.textContent = '⏳';
    const team = Store.getActiveTeam();
    const pat  = await Store.getActivePat();
    try {
      const revs = await EficienciaAPI.getRevisions(team.org, team.proj, String(itemId), pat);
      const result = _buildColumnTimeline(revs);
      track.innerHTML = result.html;
      if (result.totalBlockMs > 0) {
        const blkEl = document.getElementById('blk-'+itemId);
        if (blkEl) blkEl.innerHTML = `<span style="color:#dc2626;font-weight:700">${_fmtBlockTime(result.totalBlockMs, result.totalBlockStartMs)}</span>`;
      }
    } catch {
      track.innerHTML = '<div class="tl-loading">Histórico indisponível.</div>';
    }
    card.dataset.tlLoaded = '1';
    track.style.display = '';
    if (chev) chev.textContent = '▼';
    return;
  }
  const open = track.style.display !== 'none';
  track.style.display = open ? 'none' : '';
  if (chev) chev.textContent = open ? '▶' : '▼';
}

function sortTbl(th) {
  const table = th.closest('table');
  const tbody = table.querySelector('tbody');
  const ths   = Array.from(th.closest('tr').querySelectorAll('th'));
  const col   = ths.indexOf(th);
  const isAsc = th.dataset.sort !== 'asc';
  ths.forEach(t => { delete t.dataset.sort; t.classList.remove('th-sort-asc','th-sort-desc'); });
  th.dataset.sort = isAsc ? 'asc' : 'desc';
  th.classList.add(isAsc ? 'th-sort-asc' : 'th-sort-desc');
  const val = td => {
    if (!td) return '';
    const txt = td.textContent.trim();
    const num = parseFloat(txt);
    return isNaN(num) ? txt.toLowerCase() : num;
  };
  const cmp = (a, b) => {
    const va = val(a), vb = val(b);
    if (typeof va === 'number' && typeof vb === 'number') return isAsc ? va - vb : vb - va;
    return isAsc ? String(va).localeCompare(String(vb),'pt',{numeric:true}) : String(vb).localeCompare(String(va),'pt',{numeric:true});
  };
  if (table.classList.contains('bl-table') || table.classList.contains('qual-tbl')) {
    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const groups = [];
    allRows.forEach(r => {
      if (r.classList.contains('bl-row') || r.classList.contains('qual-parent-row')) groups.push({p:r, c:null});
      else if ((r.classList.contains('children-row') || r.classList.contains('qual-child-row')) && groups.length) groups[groups.length-1].c = r;
    });
    groups.sort((a,b) => cmp(a.p.querySelectorAll('td')[col], b.p.querySelectorAll('td')[col]));
    groups.forEach(g => { tbody.appendChild(g.p); if (g.c) tbody.appendChild(g.c); });
  } else {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a,b) => cmp(a.querySelectorAll('td')[col], b.querySelectorAll('td')[col]));
    rows.forEach(r => tbody.appendChild(r));
  }
}

function filterBL(btn, type) {
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const data = APP.sprintData;
  if (!data) return;
  const tbody = document.getElementById('bl-tbody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr.bl-row');
  rows.forEach(row => {
    if (type==='all') { row.style.display=''; return; }
    const statEl = row.querySelector('.sb');
    const statText = statEl ? statEl.textContent.toLowerCase() : '';
    const cls = row.className;
    let show = false;
    if      (type==='done')    show = statText.includes('concluído');
    else if (type==='doing')   show = statText.includes('em progresso');
    else if (type==='blocked') show = cls.includes('row-blocked');
    else if (type==='fixing')  show = cls.includes('row-fixing');
    else if (type==='todo')    show = statText.includes('to do')||statText===''||statEl?.classList.contains('s-todo');
    row.style.display = show ? '' : 'none';
    // Also hide children
    const id = row.id?.replace('','') || '';
    const m = row.getAttribute('onclick')?.match(/'([^']+)'/);
    if (m) { const cr=document.getElementById('cr-'+m[1]); if(cr) cr.style.display='none'; }
  });
}

function toggleAct(btn) {
  const content = btn.nextElementSibling;
  content.classList.toggle('open');
  btn.querySelector('span').textContent = content.classList.contains('open') ? '▴' : '▾';
}

// ── FLOATING CHAT ───────────────────────────────────────────────
function fcTogglePanel() {
  const panel = document.getElementById('fc-panel');
  const isOpen = panel.style.display === 'flex';
  if (isOpen) {
    panel.style.display = 'none';
  } else {
    panel.style.display = 'flex';
    fcInitPanel();
  }
}

function fcInitPanel() {
  const convs = Store.getChatConvs();
  if (APP.chatConvId && convs.find(c => c.id === APP.chatConvId)) {
    fcRenderMessages();
  } else if (convs.length) {
    fcLoadConv(convs[convs.length - 1].id);
  } else {
    fcNewConv();
  }
  fcRenderSidebar();
}

function fcNewConv() {
  const id   = 'conv_' + Date.now();
  const conv = { id, title: 'Nova conversa', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  const convs = Store.getChatConvs();
  convs.push(conv);
  Store.saveChatConvs(convs);
  APP.chatConvId  = id;
  APP.chatMessages = [];
  document.getElementById('fc-title').textContent = 'Nova conversa';
  document.getElementById('fc-messages').innerHTML = fcWelcomeHtml();
  document.getElementById('fc-sidebar')?.classList.add('collapsed');
  fcRenderSidebar();
}

function fcLoadConv(id) {
  const conv = Store.getChatConvs().find(c => c.id === id);
  if (!conv) return;
  APP.chatConvId   = id;
  APP.chatMessages = [...conv.messages];
  document.getElementById('fc-title').textContent = conv.title;
  fcRenderMessages();
  document.getElementById('fc-sidebar')?.classList.add('collapsed');
  fcRenderSidebar();
}

function fcRenderMessages() {
  const msgsEl = document.getElementById('fc-messages');
  if (!APP.chatMessages.length) { msgsEl.innerHTML = fcWelcomeHtml(); return; }
  msgsEl.innerHTML = APP.chatMessages.map(m => fcBubbleHtml(m.role, m.content)).join('');
  requestAnimationFrame(() => { msgsEl.scrollTop = msgsEl.scrollHeight; });
}

function fcWelcomeHtml() {
  const team = Store.getActiveTeam();
  const teamName = team ? esc(team.name) : 'nenhum time ativo';
  return `<div class="fc-welcome"><div class="fc-welcome-icon">${ICONS.bot}</div><strong>AgileViewAI</strong><p style="margin-top:6px">Time ativo: <strong>${teamName}</strong></p><p style="margin-top:6px;font-size:12px">Pergunte sobre sprint, qualidade, eficiência ou qualquer aspecto do time.</p></div>`;
}

function _mdToHtml(md) {
  md = md.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  const blocks = [], icodes = [];
  md = md.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) => { blocks.push(c.trim()); return '\x02B'+(blocks.length-1)+'\x03'; });
  md = md.replace(/`([^`\n]+)`/g, (_, c) => { icodes.push(c); return '\x02I'+(icodes.length-1)+'\x03'; });
  const _e = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inl = t => _e(t)
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>')
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g,'<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" class="md-a">$1</a>')
    .replace(/\x02I(\d+)\x03/g, (_,i) => `<code class="md-ic">${_e(icodes[+i])}</code>`);
  const out = []; let ul=false, ol=false;
  const cls = () => { if(ul){out.push('</ul>');ul=false;} if(ol){out.push('</ol>');ol=false;} };
  for (const line of md.split('\n')) {
    let m;
    if (/^\x02B\d+\x03$/.test(line))              { cls(); out.push(line); continue; }
    if ((m=line.match(/^(#{1,3})\s+(.*)/)))          { cls(); const t=['h3','h4','h5'][m[1].length-1]||'h5'; out.push(`<${t} class="md-h">${inl(m[2])}</${t}>`); continue; }
    if (/^[-*]{3,}\s*$/.test(line))                 { cls(); out.push('<hr class="md-hr">'); continue; }
    if ((m=line.match(/^[-*+]\s+(.*)/)))             { if(ol){out.push('</ol>');ol=false;} if(!ul){out.push('<ul class="md-ul">');ul=true;} out.push(`<li>${inl(m[1])}</li>`); continue; }
    if ((m=line.match(/^\d+\.\s+(.*)/)))            { if(ul){out.push('</ul>');ul=false;} if(!ol){out.push('<ol class="md-ol">');ol=true;} out.push(`<li>${inl(m[1])}</li>`); continue; }
    if (!line.trim())                                { cls(); out.push('<div style="height:5px"></div>'); continue; }
    cls(); out.push(`<p class="md-p">${inl(line)}</p>`);
  }
  cls();
  return out.join('').replace(/\x02B(\d+)\x03/g, (_,i) => `<pre class="md-pre"><code>${_e(blocks[+i])}</code></pre>`);
}

function fcBubbleHtml(role, content) {
  return role === 'user'
    ? `<div class="fc-msg-user">${esc(content).replace(/\n/g,'<br>')}</div>`
    : `<div class="fc-msg-ai">${_mdToHtml(content)}</div>`;
}

function fcRenderSidebar() {
  const el = document.getElementById('fc-conv-list');
  if (!el) return;
  const convs = [...Store.getChatConvs()].reverse();
  const activeId = APP.chatConvId;
  const newBtn = `<button class="fc-conv-new" onclick="fcNewConv()">+ Nova conversa</button>`;
  if (!convs.length) {
    el.innerHTML = newBtn + '<div style="padding:12px;font-size:12px;color:#94a3b8;text-align:center">Nenhuma conversa</div>';
    return;
  }
  el.innerHTML = newBtn + convs.map(c => {
    const isAct = c.id === activeId;
    const dt = new Date(c.updatedAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    return `<div class="fc-conv-item${isAct?' active':''}" onclick="fcLoadConv('${c.id}')">`+
      `<div class="fc-conv-item-body"><div class="fc-conv-item-title">${esc(c.title)}</div><div class="fc-conv-item-date">${dt} · ${Math.floor(c.messages.length/2)} msgs</div></div>`+
      `<button class="fc-conv-del" onclick="fcDeleteConv('${c.id}',event)" title="Excluir">×</button></div>`;
  }).join('');
}

function fcToggleSidebar() {
  document.getElementById('fc-sidebar')?.classList.toggle('collapsed');
}

function fcKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fcSend(); }
}

function fcDeleteConv(id, event) {
  event?.stopPropagation();
  const convs = Store.getChatConvs().filter(c => c.id !== id);
  Store.saveChatConvs(convs);
  if (APP.chatConvId === id) {
    APP.chatConvId   = null;
    APP.chatMessages = [];
    if (convs.length) fcLoadConv(convs[convs.length - 1].id);
    else fcNewConv();
  }
  fcRenderSidebar();
  renderRagConvList();
}

function fcBuildContext() {
  const parts = [];
  const team  = Store.getActiveTeam();
  // 1. Team context (highest priority)
  if (team) {
    parts.push(`[CONTEXTO DO TIME]\nTime: ${team.name}\nProjeto: ${team.proj}\nOrganização: ${team.org}\nAzure Team: ${team.azTeam}`);
  }
  // 2. General RAG
  const ragList = Store.getRagList().filter(r => r.active !== false);
  const generalRag = ragList.filter(r => r.scope === 'geral');
  if (generalRag.length) parts.push('[CONTEXTO GERAL]\n' + generalRag.map(r => `## ${r.type}\n${r.spec}`).join('\n\n'));
  // 3. Data: sprint, efficiency, quality
  if (APP.sprintData) {
    const d=APP.sprintData, sp=d.activeSprint, s=d.stats;
    const label=sp.path.split('\\').pop();
    const blocked=d.backlog.filter(i=>(i.state||'').toLowerCase().includes('block')||(i.state||'').toLowerCase().includes('bloq')).length;
    const fixing=d.backlog.filter(i=>(i.state||'').toLowerCase().includes('fix')).length;
    const memberLines=Object.keys(d.capacity).map(m=>{
      const c=d.capacity[m],bm=s.byMember?.[m]||{remaining:0};
      const alloc=c.capRest>0?Math.round((bm.remaining/c.capRest)*100):0;
      return `  ${m} | ${c.activity} | cap=${c.capRest}h | rem=${bm.remaining}h | alocação=${alloc}%`;
    }).join('\n');
    parts.push(`[SPRINT ATIVA: ${label}]\nInício: ${sp.attributes?.startDate?.slice(0,10)||'?'} | Fim: ${sp.attributes?.finishDate?.slice(0,10)||'?'}\nDias úteis restantes: ${s.bizDays} | Dias passados: ${s.daysLeft}\nBacklog: ${d.backlog.length} itens | Concluídos: ${s.donePct}% | Bloqueados: ${blocked} | Fixing: ${fixing}\nCapacidade: ${s.capacityTotal}h | Restante: ${s.totalRem}h | Alocação: ${s.allocPct}%\nPor membro:\n${memberLines}`);
  }
  if (APP.eficienciaData) {
    const ef = APP.eficienciaData;
    const _pct = (arr, p) => {
      if (!arr || !arr.length) return null;
      const s = [...arr].sort((a,b)=>a-b);
      return Math.round(s[Math.min(Math.ceil(p/100*s.length)-1, s.length-1)]*10)/10;
    };
    const _avg = arr => arr && arr.length ? +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : null;
    const allLT = ef.iterLabels.flatMap(k => ef.byIter[k]?.leadTimes  || []);
    const allCT = ef.iterLabels.flatMap(k => ef.byIter[k]?.cycleTimes || []);
    const fmtPct = (arr) => arr.length
      ? `P50=${_pct(arr,50)}d | P80=${_pct(arr,80)}d | P95=${_pct(arr,95)}d`
      : '(sem dados suficientes)';
    const sprintLines = ef.iterLabels.map(k => {
      const it = ef.byIter[k] || {};
      const avgLT = _avg(it.leadTimes);  const p80LT = _pct(it.leadTimes,80);
      const avgCT = _avg(it.cycleTimes); const p80CT = _pct(it.cycleTimes,80);
      return `  ${k}: itens=${it.count||0} | velocity=${Math.round(it.velocity||0)}h`+
        (avgLT!=null?` | lead_avg=${avgLT}d (P80=${p80LT}d)`:'') +
        (avgCT!=null?` | cycle_avg=${avgCT}d (P80=${p80CT}d)`:'');
    }).join('\n');
    const colLines = Object.keys(ef.colTimes||{}).length
      ? Object.keys(ef.colTimes)
          .sort((a,b)=>(ef.colTimes[b].total/ef.colTimes[b].count)-(ef.colTimes[a].total/ef.colTimes[a].count))
          .map(c=>`  ${c}: ${(ef.colTimes[c].total/ef.colTimes[c].count).toFixed(1)}d avg (${ef.colTimes[c].count} amostras)`)
          .join('\n')
      : '  (campo BoardColumn não disponível)';
    parts.push(
      `[EFICIÊNCIA — ${ef.iterLabels.length} sprint(s) analisada(s)]\n`+
      `Velocity média: ${ef.avgThroughput} itens/sprint\n`+
      `Lead Time médio: ${ef.avgLeadTime}d (criação→fechamento) | ${fmtPct(allLT)}\n`+
      `Cycle Time médio: ${ef.avgCycleTime}d (ativação→fechamento) | ${fmtPct(allCT)}\n`+
      `Bugs/defeitos abertos: ${ef.openBugs}\n`+
      `\nPor sprint:\n${sprintLines||'  (sem dados)'}\n`+
      `\nTempo médio por coluna do board:\n${colLines}`
    );
  }
  if (APP.qualidadeData) {
    const items = Array.isArray(APP.qualidadeData) ? APP.qualidadeData : [];
    const total  = items.length;
    const _isDoneQ = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'||sl==='completed'||sl==='fechado'||sl==='finalizado'; };
    const open   = items.filter(i => !_isDoneQ(i.fields?.['System.State']));
    const closed = items.filter(i =>  _isDoneQ(i.fields?.['System.State']));
    const _group = key => {
      const m = {};
      items.forEach(i => { const v = i.fields?.[key]||'Não definido'; m[v]=(m[v]||0)+1; });
      return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${k}: ${v}`).join('\n');
    };
    const avgDays = (() => {
      const resolved = items.filter(i => _isDoneQ(i.fields?.['System.State']) && i.fields?.['Microsoft.VSTS.Common.ClosedDate'] && i.fields?.['System.CreatedDate']);
      if (!resolved.length) return null;
      const sum = resolved.reduce((a,i) => a + (new Date(i.fields['Microsoft.VSTS.Common.ClosedDate']) - new Date(i.fields['System.CreatedDate']))/86400000, 0);
      return (sum/resolved.length).toFixed(1);
    })();
    parts.push(
      `[QUALIDADE]\nTotal: ${total} | Abertos: ${open.length} | Fechados: ${closed.length}`+
      (avgDays!=null?` | Tempo médio resolução: ${avgDays}d`:'')+
      `\nPor severidade:\n${_group('Microsoft.VSTS.Common.Severity')}`+
      `\nPor prioridade:\n${_group('Microsoft.VSTS.Common.Priority')}`+
      `\nPor estado:\n${_group('System.State')}`
    );
  }
  // 4. Team-specific RAG (agent training)
  if (team) {
    const teamRag = ragList.filter(r => r.scope === 'team' && r.teamId === team.id);
    if (teamRag.length) parts.push('[TREINAMENTO DO TIME]\n' + teamRag.map(r => `## ${r.type}\n${r.spec}`).join('\n\n'));
  }
  // 5. Insight feedback examples
  const fbCtx = buildFeedbackContext();
  if (fbCtx) parts.push(fbCtx);
  return parts.join('\n\n');
}

async function fcSend() {
  const textarea = document.getElementById('fc-textarea');
  const question = textarea?.value.trim();
  if (!question) return;
  const llmConf = Store.getActiveLlm();
  if (!llmConf) { toast('Nenhum token LLM configurado.','warn'); return; }
  textarea.value = ''; textarea.style.height = 'auto';
  if (!APP.chatConvId) fcNewConv();
  const msgsEl = document.getElementById('fc-messages');
  msgsEl.querySelector('.fc-welcome')?.remove();
  msgsEl.insertAdjacentHTML('beforeend', fcBubbleHtml('user', question));
  const thinkEl = document.createElement('div');
  thinkEl.className = 'fc-msg-ai';
  thinkEl.innerHTML = '<div class="spinner-wrap" style="padding:0"><div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Pensando…</div>';
  msgsEl.appendChild(thinkEl);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  const sendBtn = document.getElementById('fc-send-btn');
  if (sendBtn) sendBtn.disabled = true;
  const systemPrompt = `Você é AgileViewAI, um assistente ágil sênior especializado em Scrum e Azure DevOps.\n\nPRIORIDADE DE CONTEXTO (obedecer esta ordem):\n1. Contexto do time ativo\n2. Contexto geral configurado\n3. Dados atuais (sprint / eficiência / qualidade)\n4. Treinamento do agente\n5. Criatividade baseada nos dados\n\n${fcBuildContext()}\n\nResposta em português. Seja objetivo e cite dados reais. Temperatura 0.2 — prefira respostas baseadas nos dados.${buildUserLevelContext()}`;
  const apiMessages = APP.chatMessages.map(m => ({ role: m.role, content: m.content }));
  try {
    const token = await Store.getActiveLlmToken();
    const provider = llmConf.provider;
    let resp = '';
    if (provider === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{'Content-Type':'application/json','x-api-key':token,'anthropic-version':'2023-06-01'},
        body: JSON.stringify({ model:'claude-sonnet-4-5', max_tokens:1200, temperature:0.2, system:systemPrompt,
          messages:[...apiMessages,{role:'user',content:question}] })
      });
      if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).substring(0,200)}`);
      resp = (await r.json()).content?.[0]?.text || '';
    } else if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({ model:'gpt-4o', max_tokens:1200, temperature:0.2,
          messages:[{role:'system',content:systemPrompt},...apiMessages,{role:'user',content:question}] })
      });
      if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).substring(0,200)}`);
      resp = (await r.json()).choices?.[0]?.message?.content || '';
    } else if (provider === 'gemini') {
      const contents = [...apiMessages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),{role:'user',parts:[{text:question}]}];
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${token}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ systemInstruction:{parts:[{text:systemPrompt}]}, contents, generationConfig:{maxOutputTokens:1200,temperature:0.2} })
      });
      if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).substring(0,200)}`);
      resp = (await r.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else throw new Error('Provider desconhecido: '+provider);
    thinkEl.innerHTML = _mdToHtml(resp);
    const userMsg = {role:'user',    content:question, timestamp:Date.now()};
    const aiMsg   = {role:'assistant',content:resp,     timestamp:Date.now()};
    APP.chatMessages.push(userMsg, aiMsg);
    const convs = Store.getChatConvs();
    const idx   = convs.findIndex(c => c.id === APP.chatConvId);
    if (idx >= 0) {
      convs[idx].messages  = APP.chatMessages;
      convs[idx].updatedAt = Date.now();
      if (convs[idx].title === 'Nova conversa') {
        convs[idx].title = question.length > 52 ? question.substring(0,52)+'…' : question;
        document.getElementById('fc-title').textContent = convs[idx].title;
      }
      Store.saveChatConvs(convs);
    }
    fcRenderSidebar();
  } catch(e) {
    thinkEl.innerHTML = `<em style="color:#dc2626">Erro: ${esc(e.message)}</em>`;
  }
  if (sendBtn) sendBtn.disabled = false;
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function renderRagConvList() { renderConversasTab(); }

// \u2500\u2500 TRAINING MANAGEMENT TABS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function showTrainingTab(name) {
  document.querySelectorAll('.train-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.train-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('ttab-'+name)?.classList.add('active');
  document.getElementById('tt-'+name)?.classList.add('active');
  if (name === 'contextos')  renderRagList();
  if (name === 'feedback')   renderFeedbackTab();
  if (name === 'conversas')  renderConversasTab();
  if (name === 'agentes')    renderAgentesTab();
}

// ── FEEDBACK TAB ────────────────────────────────────────────────────
function renderFeedbackTab() {
  const el = document.getElementById('tt-feedback-content');
  if (!el) return;
  const all  = Store.getInsightFeedback();
  const good = all.filter(f => f.rating === 'good');
  const bad  = all.filter(f => f.rating === 'bad');
  if (!all.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px 0;color:#94a3b8;font-size:13px">
      <div style="margin-bottom:10px;opacity:.3"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></div>
      Nenhum feedback ainda.<br>Avalie os insights no dashboard.</div>`;
    return;
  }
  const team = Store.getActiveTeam();
  const sprint = APP.sprintData?.activeSprint?.path?.split('\\').pop() || '\u2014';
  el.innerHTML = `
  <div class="fb-stat-row">
    <div class="fb-stat"><div class="fb-stat-num" style="color:#16a34a">${good.length}</div><div class="fb-stat-lbl">Aprovados</div></div>
    <div class="fb-stat"><div class="fb-stat-num" style="color:#dc2626">${bad.length}</div><div class="fb-stat-lbl">Reprovados</div></div>
    <div class="fb-stat"><div class="fb-stat-num">${all.length}</div><div class="fb-stat-lbl">Total feedbacks</div></div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:14px">
    <button class="btn" style="font-size:12px" onclick="exportFeedback()">Exportar</button>
    <button class="btn-red" style="font-size:12px;padding:4px 12px;border-radius:6px" onclick="clearFeedback()">Limpar tudo</button>
  </div>
  <div>` + [...all].reverse().map(f => {
    const dt  = new Date(f.timestamp).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
    const isG = f.rating === 'good';
    const sevColor = {critical:'#dc2626',warning:'#d97706',info:'#1d4ed8',ok:'#16a34a'}[f.insight.severity] || '#475569';
    return `<div class="fb-entry">
      <div class="fb-entry-badge" style="color:${isG?'#16a34a':'#dc2626'}"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 2h-4c-1.1 0-2 .9-2 2v18l4-4h14c1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H6"/><path d="M6 12h6v2H6z"/><path d="M6 18h12v-2H6z"/></svg></div>
      <div class="fb-entry-info">
        <div class="fb-entry-title">${esc(f.insight.title)}</div>
        <div class="fb-entry-body">${esc(f.insight.body)}</div>
        <div class="fb-entry-meta">
          <span style="color:${sevColor};font-weight:600">${f.insight.severity}</span>
          &nbsp;\u00b7&nbsp;${f.teamName||'\u2014'}&nbsp;\u00b7&nbsp;Sprint: ${esc(f.sprint||'\u2014')}&nbsp;\u00b7&nbsp;${dt}
        </div>
      </div>
      <button class="ins-rm" style="margin-top:2px" onclick="deleteFeedback('${f.id}')" title="Remover">\u2715</button>
    </div>`;
  }).join('') + '</div>';
}

function levelIcon(l) {
  if (l === 'technical') return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
  if (l === 'didactic')  return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
}

function renderConversasTab() {
  const el = document.getElementById('tt-conversas-content');
  if (!el) return;
  const inferred = analyzeUserLevel();
  const stored   = Store.getUserProfile();
  const active   = stored.override ? stored : inferred;
  const convs    = [...Store.getChatConvs()].reverse();
  const levelBadgeClass = active.level;
  const LABELS = { technical:'Técnico', didactic:'Didático', neutral:'Equilibrado' };
  const DESCS  = {
    technical:'O assistente usar\u00e1 linguagem t\u00e9cnica com termos \u00e1geis e m\u00e9tricas precisas.',
    didactic: 'O assistente explicar\u00e1 conceitos de forma did\u00e1tica, com exemplos e analogias.',
    neutral:  'O assistente usará linguagem equilibrada, balanceando termos técnicos e clareza sem excesso de jargões.'
  };
  const tagLine = inferred.msgCount < 3
    ? `<span class="ul-signal">Menos de 3 perguntas analisadas</span>`
    : `<span class="ul-signal">${inferred.msgCount} mensagens analisadas</span>`+
      `<span class="ul-signal">T\u00e9cnicos: ${inferred.techScore||0}</span>`+
      `<span class="ul-signal">Did\u00e1ticos: ${inferred.didScore||0}</span>`;
  el.innerHTML = `
  <div class="ul-profile-box">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">PERFIL INFERIDO</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="ul-badge ${levelBadgeClass}">${levelIcon(active.level)} ${LABELS[active.level]}</span>
          ${stored.override ? '<span style="font-size:11px;color:#94a3b8;font-style:italic">definido manualmente</span>' : '<span style="font-size:11px;color:#94a3b8;font-style:italic">inferido automaticamente</span>'}
        </div>
        <p style="font-size:12px;color:#475569;margin-top:8px">${DESCS[active.level]}</p>
      </div>
    </div>
    <div class="ul-signals">${tagLine}</div>
    <div class="ul-override-row">
      <span style="font-size:11px;color:#64748b;font-weight:600">Definir manualmente:</span>
      <button class="btn-sm${active.level==='technical'?' bp':''}" onclick="setUserLevelOverride('technical')">T\u00e9cnico</button>
      <button class="btn-sm${active.level==='neutral'?' bp':''}" onclick="setUserLevelOverride('neutral')">Equilibrado</button>
      <button class="btn-sm${active.level==='didactic'?' bp':''}" onclick="setUserLevelOverride('didactic')">Did\u00e1tico</button>
      ${stored.override ? '<button class="btn-sm" onclick="resetUserLevelOverride()" style="margin-left:auto">Reinfrir</button>' : ''}
    </div>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
    <div style="font-size:13px;font-weight:700;color:#1e293b">Conversas (${convs.length})</div>
    <div style="display:flex;gap:8px">
      <button class="btn" style="font-size:12px" onclick="exportConversations()">Exportar</button>
    </div>
  </div>` + (convs.length ? convs.map(c => {
    const dt  = new Date(c.createdAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
    const cnt = Math.floor(c.messages.length/2);
    const userMsgs = c.messages.filter(m => m.role === 'user');
    const techHits = userMsgs.reduce((n,m)=>n+TECH_TERMS.filter(t=>m.content.toLowerCase().includes(t)).length,0);
    const didHits  = userMsgs.reduce((n,m)=>n+DIDACTIC_SIGNALS.filter(d=>m.content.toLowerCase().includes(d)).length,0);
    const tag = techHits > didHits ? '<span class="ul-signal" style="background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8">t\u00e9cnico</span>'
              : didHits > techHits ? '<span class="ul-signal" style="background:#fefce8;border-color:#fde047;color:#92400e">did\u00e1tico</span>'
              : '';
    return `<div class="conv-card">
      <div style="margin-top:2px;opacity:.5"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></div>
      <div class="conv-card-info">
        <div class="conv-card-title">${esc(c.title)}</div>
        <div class="conv-card-meta">${dt} \u00b7 ${cnt} pergunta${cnt!==1?'s':''} ${tag}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;margin-top:2px">
        <button class="btn-sm" style="font-size:11px" onclick="fcOpenConvFromRag('${c.id}')">Abrir</button>
        <button class="btn-sm br" style="font-size:11px" onclick="fcDeleteConvFromRag('${c.id}',event)">Excluir</button>
      </div>
    </div>`;
  }).join('') : '<div style="text-align:center;padding:32px 0;color:#94a3b8;font-size:13px">Nenhuma conversa ainda.<br>Use o bot\u00e3o de chat para come\u00e7ar.</div>');
}

function renderAgentesTab() {
  const el = document.getElementById('tt-agentes-content');
  if (!el) return;
  const saved = Store.getAgentPrompts();
  const agents = [
    { id:'a1', label:'Agente 1 — Gerador', icon:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
      desc:'Recebe todos os dados (Sprint, Efici\u00eancia, Qualidade) e gera a lista inicial de insights.' },
    { id:'a2', label:'Agente 2 — Revisor', icon:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      desc:'Recebe a sa\u00edda do Agente 1. Remove duplicatas, agrupa itens relacionados e valida m\u00e9tricas.' },
    { id:'a3', label:'Agente 3 — Redator', icon:'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      desc:'Recebe a sa\u00edda do Agente 2. Reescreve cada card com o tom adequado \u00e0 severidade e ao perfil.' }
  ];
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div style="color:#64748b;font-size:13px">Cada agente recebe a saída do anterior. Edite os prompts para personalizar cada etapa.</div>
      <div style="display:flex;gap:8px">
        <button class="btn" style="font-size:12px" onclick="exportAgentPrompts()">Exportar</button>
        <button class="btn btn-blue" style="font-size:12px" onclick="importAgentPrompts()">Importar</button>
      </div>
    </div>
    ${agents.map(a => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-weight:700;font-size:14px">${a.icon} ${a.label}</div>
        <button class="btn" style="font-size:11px;padding:4px 10px" onclick="resetAgentPrompt('${a.id}')">Restaurar padr\u00e3o</button>
      </div>
      <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">${a.desc}</div>
      <textarea id="agent-ta-${a.id}"
        style="width:100%;box-sizing:border-box;min-height:180px;font-size:12px;font-family:monospace;padding:10px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;line-height:1.5"
        oninput="saveAgentPrompt('${a.id}', this.value)"
      >${(saved[a.id] ?? AGENT_DEFAULTS[a.id]).replace(/</g,'&lt;')}</textarea>
    </div>`).join('')}
  `;
}

function fcDeleteConvFromRag(id, event) {
  event?.stopPropagation();
  const convs = Store.getChatConvs().filter(c => c.id !== id);
  Store.saveChatConvs(convs);
  if (APP.chatConvId === id) {
    APP.chatConvId = null; APP.chatMessages = [];
    if (convs.length) fcLoadConv(convs[convs.length-1].id);
  }
  fcRenderSidebar();
  renderConversasTab();
  const inferred = analyzeUserLevel();
  if (!Store.getUserProfile().override) Store.saveUserProfile({ level:inferred.level, override:false, updatedAt:Date.now() });
}

// \u2500 USER LEVEL CONTEXT for AI prompts \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function buildUserLevelContext() {
  const inferred = analyzeUserLevel();
  const stored   = Store.getUserProfile();
  const profile  = stored.override ? stored : inferred;
  if (profile.level === 'technical') {
    return '\n\nPERFIL DO USUÁRIO: Técnico. Use terminologia ágil precisa (velocity, throughput, lead time, cycle time, etc.), cite números e métricas sem simplificar. Pode usar jargão de Scrum/Kanban/DevOps livremente.';
  }
  if (profile.level === 'didactic') {
    return '\n\nPERFIL DO USUÁRIO: Iniciante/Didático. Explique cada conceito ao mencioná-lo, use analogias e exemplos simples, evite jargão sem explicação. Seja encorajador e passo a passo.';
  }
  return '\n\nPERFIL DO USUÁRIO: Neutro. Use linguagem equilibrada: mencione termos técnicos com breve explicação quando necessário.';
}

function fcOpenConvFromRag(id) {
  showPanel('dashboard');
  const panel = document.getElementById('fc-panel');
  panel.style.display = 'flex';
  fcLoadConv(id);
}

function exportConversations() {
  const convs = Store.getChatConvs();
  if (!convs.length) { toast('Nenhuma conversa para exportar.','warn'); return; }
  const payload = { version:1, exportedAt:new Date().toISOString(), conversations:convs };
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'agileviewai_conversas_'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); URL.revokeObjectURL(a.href);
  toast('Conversas exportadas!','ok');
}

// ── SETTINGS ──────────────────────────────────────────────────────────
function changeVaultMode() {
  const cur = APP.vaultMode;
  const msg = cur==='pin'
    ? 'Mudar para modo sessão? Os tokens criptografados serão removidos do localStorage.'
    : 'Mudar para modo PIN? Você precisará criar um novo PIN.';
  if (!confirm(msg)) return;
  if (cur==='pin') {
    ['avai_vault_salt','avai_vault_check'].forEach(k=>localStorage.removeItem(k));
    Store.getTeams().forEach(t=>t.patEnc=''); Store.getLlmList().forEach(l=>l.tokenEnc='');
    toast('Modo sessão ativado. Insira os tokens novamente.','warn');
    APP.vaultKey=null; APP.vaultMode='session';
  } else {
    APP.vaultKey=null; APP.vaultMode='pin';
    localStorage.removeItem('avai_vault_check');
    toast('Modo PIN ativado. Será pedido na próxima abertura.','ok');
  }
  updateVaultModeDesc();
}

function changePinModal() {
  if (APP.vaultMode!=='pin') { toast('Somente disponível no modo PIN.','warn'); return; }
  document.getElementById('pin-modal-title').textContent='Alterar PIN';
  document.getElementById('pin-cur').value=''; document.getElementById('pin-new').value=''; document.getElementById('pin-conf').value='';
  document.getElementById('pin-err').textContent='';
  document.getElementById('pin-cur-row').style.display='';
  openModal('modal-pin');
}

async function savePinChange() {
  const cur  = document.getElementById('pin-cur').value.trim();
  const nw   = document.getElementById('pin-new').value.trim();
  const conf = document.getElementById('pin-conf').value.trim();
  const errEl= document.getElementById('pin-err');
  errEl.textContent='';
  if (nw.length<4) { errEl.textContent='Novo PIN deve ter 4 a 8 dígitos.'; return; }
  if (nw!==conf)   { errEl.textContent='PINs não coincidem.'; return; }
  const oldKey = await Vault.verifyPin(cur);
  if (!oldKey) { errEl.textContent='PIN atual incorreto.'; return; }
  const newKey = await Vault.setupPin(nw);
  await Vault.reencryptAll(oldKey, newKey);
  APP.vaultKey = newKey;
  closeModal('modal-pin');
  toast('PIN alterado com sucesso!','ok');
}

function clearVault() {
  if (!confirm('Remover todos os tokens do localStorage?')) return;
  ['avai_vault_salt','avai_vault_check'].forEach(k=>localStorage.removeItem(k));
  const teams = Store.getTeams().map(t=>({...t,patEnc:''}));
  const llms  = Store.getLlmList().map(l=>({...l,tokenEnc:''}));
  Store.saveTeams(teams); Store.saveLlmList(llms);
  APP.vaultKey=null;
  toast('Vault limpo. Insira os tokens novamente.','warn');
}

function clearAll() {
  if (!confirm('Apagar TODOS os dados? Isso não pode ser desfeito.')) return;
  localStorage.clear();
  toast('Dados apagados.','warn');
  setTimeout(()=>location.reload(), 1000);
}

function exportConfig() {
  const payload = {
    version: 3,
    exportedAt: new Date().toISOString(),
    teams:         Store.getTeams().map(t=>({...t, patEnc:'(removido por segurança)'})),
    orgs:          Store.getOrgs().map(o=>({...o, patEnc:'(removido por segurança)'})),
    llm:           Store.getLlmList().map(l=>({...l, tokenEnc:'(removido por segurança)'})),
    rag:           Store.getRagList(),
    conversations: Store.getChatConvs(),
    insightFeedback: Store.getInsightFeedback(),
    userProfile:   Store.getUserProfile()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'agileviewai_config_'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); URL.revokeObjectURL(a.href);
  toast('Configurações exportadas!','ok');
}

function importConfig() { document.getElementById('import-file').click(); }

function handleImport(e) {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      if (d.teams)          { Store.saveTeams(d.teams.map(t=>({...t,patEnc:''}))); renderTeams(); }
      if (d.orgs)           { Store.saveOrgs(d.orgs.map(o=>({...o,patEnc:''}))); }
      if (d.llm)            { Store.saveLlmList(d.llm.map(l=>({...l,tokenEnc:''}))); renderLlmList(); }
      if (d.rag)            { Store.saveRagList(d.rag); renderRagList(); }
      if (d.conversations)  { Store.saveChatConvs(d.conversations); }
      if (d.insightFeedback){ Store.saveInsightFeedback(d.insightFeedback); }
      if (d.userProfile)    { Store.saveUserProfile(d.userProfile); }
      toast('Configurações importadas! Insira os tokens novamente.','ok');
    } catch { toast('Arquivo JSON inválido.','err'); }
  };
  reader.readAsText(f);
  e.target.value='';
}

// ── DOWNLOAD DASHBOARD HTML ───────────────────────────────────────────
function downloadDashboardHtml() {
  const spData   = APP.sprintData;
  const efData   = APP.eficienciaData;
  const qualData = APP.qualidadeData;
  if (!spData && !efData && !qualData) { toast('Sem dados para exportar. Carregue pelo menos um módulo.','warn'); return; }

  const team = Store.getActiveTeam();
  const _e   = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const _avg = arr => arr && arr.length ? +(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : null;
  const _pct = (arr,p) => { if(!arr||!arr.length) return null; const s=[...arr].sort((a,b)=>a-b); return Math.round(s[Math.min(Math.ceil(p/100*s.length)-1,s.length-1)]*10)/10; };
  const _fmtP = (arr,p) => { const v=_pct(arr,p); return v!==null?v+'d':'—'; };
  const projUrl = `https://dev.azure.com/${encodeURIComponent(team?.org||'')}/${encodeURIComponent(team?.proj||'')}`;

  const css = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;font-size:13px;padding:20px}h2{font-size:15px;font-weight:700;margin:0 0 12px;color:#1e293b;border-left:4px solid #3b82f6;padding-left:10px}h3{font-size:12px;font-weight:600;margin:16px 0 7px;color:#475569;text-transform:uppercase;letter-spacing:.4px}.rpt-header{background:#1e293b;color:#fff;padding:14px 24px;border-radius:10px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}.rpt-header strong{font-size:15px}.rpt-header span{font-size:11px;color:#94a3b8}.section{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 22px;margin-bottom:18px}.kpi-row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;min-width:120px}.kpi-lbl{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}.kpi-val{font-size:20px;font-weight:700;line-height:1.2}.kpi-sub{font-size:10px;color:#94a3b8;margin-top:2px}.kpi.alert{background:#fef2f2;border-color:#fca5a5}.kpi.alert .kpi-val{color:#dc2626}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}th{background:#f1f5f9;padding:7px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;white-space:nowrap}td{padding:6px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}tr:last-child td{border-bottom:none}tr:hover td{background:#fafafa}.badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap}.badge-bug{background:#fef2f2;color:#dc2626}.badge-pbi{background:#eff6ff;color:#2563eb}.sb{font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;white-space:nowrap}.s-done{background:#dcfce7;color:#16a34a}.s-doing{background:#dbeafe;color:#1d4ed8}.s-testing{background:#fef9c3;color:#854d0e}.s-todo{background:#f1f5f9;color:#64748b}.tc{text-align:center}a{color:#2563eb;text-decoration:none}.empty{color:#94a3b8;font-style:italic;padding:10px 0;text-align:center}@media print{body{padding:0}.rpt-header{border-radius:0}}`;

  // ── SPRINT ─────────────────────────────────────────────────────────────────
  let sprintHtml = '';
  if (spData) {
    const sp    = spData.activeSprint;
    const s     = spData.stats || {};
    const bl    = spData.backlog || [];
    const tasks = spData.tasks   || [];
    const cap   = spData.capacity || {};
    const spLabel = sp.path.split('\\').pop();
    const kpis = [
      {l:'Concluídos',    v:s.done||0,        sub:'itens done'},
      {l:'Em progresso',  v:s.inProgress||0,  sub:'in progress'},
      {l:'Bloqueados',    v:s.blocked||0,      sub:'bloqueados', al:(s.blocked||0)>0},
      {l:'Em fixing',     v:s.fixing||0,       sub:'em correção', al:(s.fixing||0)>0},
      {l:'Alocação',      v:(s.allocPct||0)+'%', sub:`${s.totalRem||0}h / ${s.capacityTotal||0}h`, al:(s.allocPct||0)>100},
    ];
    const kpiH = kpis.map(k=>`<div class="kpi${k.al?' alert':''}"><div class="kpi-lbl">${_e(k.l)}</div><div class="kpi-val">${_e(String(k.v))}</div><div class="kpi-sub">${_e(k.sub)}</div></div>`).join('');
    const scOf = st => { const sl=(st||'').toLowerCase(); if(sl.includes('concluí')||sl==='done'||sl==='closed'||sl==='resolved')return 's-done'; if(sl.includes('progresso')||sl==='active'||sl.includes('progress'))return 's-doing'; if(sl.includes('test')||sl.includes('valid'))return 's-testing'; return 's-todo'; };
    const blRows = bl.map(item => {
      const ch  = tasks.filter(t=>t.parentId===item.id);
      const pct = item.estimativa > 0 ? Math.round(Math.max(0,Math.min(100,(item.estimativa-(item.childRem||0))/item.estimativa*100))) : null;
      return `<tr>
        <td><span class="badge badge-pbi">${_e(item.type||'PBI')}</span></td>
        <td><a href="${projUrl}/_workitems/edit/${item.id}" target="_blank">${item.id}</a></td>
        <td style="max-width:280px">${_e(item.title||'')}</td>
        <td><span class="sb ${scOf(item.state)}">${_e(item.state||'')}</span></td>
        <td>${_e(item.assignedTo||'—')}</td>
        <td class="tc">${_e(item.sprint||'—')}</td>
        <td class="tc">${item.estimativa>0?item.estimativa+'h':'—'}</td>
        <td class="tc">${(item.childRem||0)>0?item.childRem+'h':'—'}</td>
        <td class="tc">${pct!==null?pct+'%':'—'}</td>
        <td class="tc">${ch.length}</td>
      </tr>`;
    }).join('');
    const memRows = Object.entries(cap).filter(([,v])=>(v.capacity||0)>0).map(([name,v])=>`<tr><td>${_e(name)}</td><td class="tc">${v.capacity}h</td><td class="tc">${v.daysOff||0}</td></tr>`).join('');
    sprintHtml = `<div class="section"><h2>Sprint: ${_e(spLabel)}</h2>
      <div class="kpi-row">${kpiH}</div>
      <h3>Backlog — ${bl.length} itens</h3>
      <table><thead><tr><th>Tipo</th><th>ID</th><th>Nome</th><th>Status</th><th>Responsável</th><th class="tc">Sprint</th><th class="tc">Estimativa</th><th class="tc">Rem.</th><th class="tc">Progresso</th><th class="tc">Tasks</th></tr></thead>
      <tbody>${blRows||`<tr><td colspan="10" class="empty">Nenhum item</td></tr>`}</tbody></table>
      ${memRows?`<h3>Capacidade do Time</h3><table><thead><tr><th>Membro</th><th class="tc">Capacidade</th><th class="tc">Folgas</th></tr></thead><tbody>${memRows}</tbody></table>`:''}
    </div>`;
  }

  // ── EFICIÊNCIA ─────────────────────────────────────────────────────────────
  let efHtml = '';
  if (efData) {
    const allLT = efData.iterLabels.flatMap(k=>efData.byIter[k]?.leadTimes||[]);
    const allCT = efData.iterLabels.flatMap(k=>efData.byIter[k]?.cycleTimes||[]);
    const efKpis = [
      {l:'Lead Time médio',   v:(efData.avgLeadTime||'—')+'d',    sub:'criação→fechamento'},
      {l:'Cycle Time médio',  v:(efData.avgCycleTime||'—')+'d',   sub:'ativação→fechamento'},
      {l:'Velocity média',    v:(efData.avgThroughput||0)+' itens',sub:'itens/sprint'},
      {l:'Bugs abertos',      v:efData.openBugs||0,               sub:'todo o projeto', al:(efData.openBugs||0)>0},
      {l:'Lead P50/P80/P95',  v:`${_fmtP(allLT,50)} / ${_fmtP(allLT,80)} / ${_fmtP(allLT,95)}`, sub:'lead time percentis'},
      {l:'Cycle P50/P80/P95', v:`${_fmtP(allCT,50)} / ${_fmtP(allCT,80)} / ${_fmtP(allCT,95)}`, sub:'cycle time percentis'},
    ];
    const efKpiH = efKpis.map(k=>`<div class="kpi${k.al?' alert':''}"><div class="kpi-lbl">${_e(k.l)}</div><div class="kpi-val" style="font-size:${String(k.v).length>10?'13':'20'}px">${_e(String(k.v))}</div><div class="kpi-sub">${_e(k.sub)}</div></div>`).join('');
    const spRows = efData.iterLabels.map(k => {
      const it = efData.byIter[k]||{};
      const avgLT = _avg(it.leadTimes), avgCT = _avg(it.cycleTimes);
      return `<tr><td>${_e(k)}</td><td class="tc">${it.count||0}</td><td class="tc">${Math.round(it.velocity||0)}h</td>
        <td class="tc">${avgLT!==null?avgLT+'d':'—'}</td><td class="tc">${_fmtP(it.leadTimes,80)}</td><td class="tc">${_fmtP(it.leadTimes,95)}</td>
        <td class="tc">${avgCT!==null?avgCT+'d':'—'}</td><td class="tc">${_fmtP(it.cycleTimes,80)}</td><td class="tc">${_fmtP(it.cycleTimes,95)}</td></tr>`;
    }).join('');
    const colRows = Object.keys(efData.colTimes||{}).length
      ? Object.keys(efData.colTimes).sort((a,b)=>(efData.colTimes[b].total/efData.colTimes[b].count)-(efData.colTimes[a].total/efData.colTimes[a].count))
          .map(c=>`<tr><td>${_e(c)}</td><td class="tc">${(efData.colTimes[c].total/efData.colTimes[c].count).toFixed(1)}d</td><td class="tc">${efData.colTimes[c].count}</td></tr>`).join('')
      : `<tr><td colspan="3" class="empty">Dados de coluna não disponíveis</td></tr>`;
    const chartImgs = ['ef-chart-flow','ef-chart-time'].map(id=>{const c=document.getElementById(id);try{return c?`<img src="${c.toDataURL()}" style="max-width:48%;border-radius:6px;border:1px solid #e2e8f0">`:'';}catch{return '';}}).join(' ');
    efHtml = `<div class="section"><h2>Eficiência — ${efData.iterLabels.length} sprint(s)</h2>
      <div class="kpi-row">${efKpiH}</div>
      ${chartImgs?`<div style="margin-bottom:14px">${chartImgs}</div>`:''}
      <h3>Por Sprint</h3>
      <table><thead><tr><th>Sprint</th><th class="tc">Itens</th><th class="tc">Velocity</th><th class="tc">Lead Avg</th><th class="tc">Lead P80</th><th class="tc">Lead P95</th><th class="tc">Cycle Avg</th><th class="tc">Cycle P80</th><th class="tc">Cycle P95</th></tr></thead>
      <tbody>${spRows||`<tr><td colspan="9" class="empty">Sem dados</td></tr>`}</tbody></table>
      <h3>Tempo médio por coluna do board</h3>
      <table><thead><tr><th>Coluna</th><th class="tc">Tempo Médio</th><th class="tc">Amostras</th></tr></thead>
      <tbody>${colRows}</tbody></table>
    </div>`;
  }

  // ── QUALIDADE ──────────────────────────────────────────────────────────────
  let qualHtml = '';
  if (qualData && qualData.length) {
    const _isDone = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'||sl==='completed'; };
    const _scQ    = s => { const sl=(s||'').toLowerCase(); if(sl==='done'||sl==='closed'||sl==='resolved'||sl==='completed')return 's-done'; if(sl.includes('progress')||sl==='active')return 's-doing'; if(sl.includes('test')||sl.includes('qa'))return 's-testing'; return 's-todo'; };
    const sevClr  = s => { const sl=(s||'').toLowerCase(); if(sl.includes('critical')||sl.startsWith('1 '))return'#cc0000'; if(sl.includes('high')||sl.startsWith('2 '))return'#e05300'; if(sl.includes('medium')||sl.startsWith('3 '))return'#f0b400'; if(sl.includes('low')||sl.startsWith('4 '))return'#57a300'; return'#94a3b8'; };
    const priClr  = s => { const v=String(s||''); if(v==='1')return'#cc0000'; if(v==='2')return'#e05300'; if(v==='3')return'#f0b400'; if(v==='4')return'#57a300'; return'#94a3b8'; };
    const bugs    = qualData.filter(i=>i.fields['System.WorkItemType']==='Bug');
    const defects = qualData.filter(i=>i.fields['System.WorkItemType']==='Defect');
    const openAll = qualData.filter(i=>!_isDone(i.fields['System.State']));
    const doneAll = qualData.filter(i=> _isDone(i.fields['System.State']));
    const monthAgo= Date.now()-30*86400000;
    const lastMo  = qualData.filter(i=>{const cd=i.fields['System.CreatedDate'];return cd&&new Date(cd).getTime()>=monthAgo;});
    const avgDays = arr => { const vals=arr.filter(i=>_isDone(i.fields['System.State'])).map(i=>{const cd=i.fields['Microsoft.VSTS.Common.ClosedDate'],cr=i.fields['System.CreatedDate'];if(!cd||!cr)return null;const d=Math.round((new Date(cd)-new Date(cr))/86400000);return d>=0?d:null;}).filter(v=>v!==null); return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null; };
    const avgBug  = avgDays(bugs), avgDef = avgDays(defects);
    const totalRem= qualData.reduce((a,i)=>a+(Number(i.fields['Microsoft.VSTS.Scheduling.RemainingWork'])||0),0);
    const tgo     = APP.qualTempoGasto||{};
    const qKpis   = [
      {l:'Abertos',          v:openAll.length,                       sub:'Bugs+Defeitos', al:openAll.length>0},
      {l:'Fechados',         v:doneAll.length,                       sub:'Done/Closed'},
      {l:'Último mês',       v:lastMo.length,                        sub:'criados (30d)', al:lastMo.length>0},
      {l:'Res. médio Bug',   v:avgBug!==null?avgBug+'d':'—',         sub:'criação→fechamento'},
      {l:'Res. médio Defect',v:avgDef!==null?avgDef+'d':'—',         sub:'criação→fechamento'},
      {l:'Remaining Work',   v:totalRem>0?totalRem+'h':'—',          sub:'bugs+defeitos abertos'},
    ];
    const qKpiH = qKpis.map(k=>`<div class="kpi${k.al?' alert':''}"><div class="kpi-lbl">${_e(k.l)}</div><div class="kpi-val">${_e(String(k.v))}</div><div class="kpi-sub">${_e(k.sub)}</div></div>`).join('');
    const qRows = [...qualData].sort((a,b)=>(tgo[b.id]||0)-(tgo[a.id]||0)).map(i => {
      const tipo2=i.fields['System.WorkItemType'], st=i.fields['System.State']||'', at=i.fields['System.AssignedTo'];
      const atName=typeof at==='object'?(at?.displayName||''):(at||'');
      const sev2=i.fields['Microsoft.VSTS.Common.Severity']||'—', pri=String(i.fields['Microsoft.VSTS.Common.Priority']||'—');
      const rem=Number(i.fields['Microsoft.VSTS.Scheduling.RemainingWork'])||0, est=tgo[i.id]||0;
      const cr=i.fields['System.CreatedDate'], cl=i.fields['Microsoft.VSTS.Common.ClosedDate'], done=_isDone(st);
      const dias=cr?Math.round(((done&&cl?new Date(cl):new Date())-new Date(cr))/86400000):null;
      const diasStr=dias===null?'—':dias+(done?' dias':' dias ↑');
      const diasClr=!done&&dias>30?'#dc2626':!done&&dias>14?'#f59e0b':'inherit';
      return `<tr>
        <td><span class="badge ${tipo2==='Bug'?'badge-bug':'badge-pbi'}">${_e(tipo2)}</span></td>
        <td><a href="${projUrl}/_workitems/edit/${i.id}" target="_blank">${i.id}</a></td>
        <td style="max-width:260px">${_e(i.fields['System.Title']||'')}</td>
        <td><span class="sb ${_scQ(st)}">${_e(st)}</span></td>
        <td>${_e(atName||'—')}</td>
        <td class="tc" style="color:${diasClr}">${diasStr}</td>
        <td class="tc">${est>0?est+'h':'—'}</td>
        <td class="tc">${rem>0?rem+'h':'—'}</td>
        <td><span style="color:${sevClr(sev2)};font-weight:600">● ${_e(sev2)}</span></td>
        <td><span style="color:${priClr(pri)};font-weight:600">● ${pri}</span></td>
      </tr>`;
    }).join('');
    qualHtml = `<div class="section"><h2>Qualidade — ${qualData.length} itens</h2>
      <div class="kpi-row">${qKpiH}</div>
      <h3>Bugs e Defeitos — ${qualData.length} itens</h3>
      <table><thead><tr><th>Tipo</th><th>ID</th><th>Nome</th><th>Status</th><th>Responsável</th><th class="tc">Tempo Correção</th><th class="tc">Estimativa</th><th class="tc">Rem. Work</th><th>Severidade</th><th>Prioridade</th></tr></thead>
      <tbody>${qRows||`<tr><td colspan="10" class="empty">Nenhum item</td></tr>`}</tbody></table>
    </div>`;
  }

  // ── Assemble ───────────────────────────────────────────────────────────────
  const spLabel2 = spData?spData.activeSprint.path.split('\\').pop():'';
  const teamName = team?`${_e(team.proj)} — ${_e(team.name)}`:'AgileViewAI';
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>AgileViewAI — Relatório${spLabel2?' — '+spLabel2:''}</title>
<style>${css}</style></head><body>
<div class="rpt-header">
  <div><strong>${teamName}</strong>${spLabel2?`<div style="font-size:12px;color:#94a3b8;margin-top:2px">Sprint: ${_e(spLabel2)}</div>`:''}</div>
  <span>Exportado em ${new Date().toLocaleString('pt-BR')}</span>
</div>
${sprintHtml}${efHtml}${qualHtml}
${!sprintHtml&&!efHtml&&!qualHtml?'<div class="section"><p class="empty">Nenhum módulo com dados disponíveis.</p></div>':''}
</body></html>`;

  const fileName = `agileviewai_relatorio_${(spLabel2||'completo').replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().slice(0,10)}.html`;
  const blob = new Blob([html],{type:'text/html;charset=utf-8'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = fileName;
  a.click(); URL.revokeObjectURL(a.href);
  toast('Relatório completo exportado!','ok');
}

// ── INIT ──────────────────────────────────────────────────────────────
function init() {
  // Show correct vault UI
  if (Vault.isSetup()) {
    document.getElementById('vsub').textContent = 'Digite seu PIN para desbloquear';
    document.getElementById('vbtn').textContent = 'Desbloquear';
  } else {
    document.getElementById('vsub').textContent = 'Defina um PIN para cifrar seus tokens';
    document.getElementById('vbtn').textContent = 'Criar vault';
  }
  // Focus PIN input
  setTimeout(()=>document.getElementById('vpin')?.focus(), 100);
}

// DO NOT BOOT TWICE
