/**
 * AgileViewAI - Azure DevOps API Client (ESM)
 */

export const AzureAPI = {
  async _fetch(url, opts = {}) {
    const headers = {
      'Accept': 'application/json',
      ...(opts.headers || {})
    };
    const resp = await fetch(url, { ...opts, headers });
    
    if (!resp.ok) {
      const t = await resp.text();
      const msg = `HTTP ${resp.status}: ${t.substring(0, 200)}`;
      console.error(`[AzureAPI] Fetch failed for ${url}:`, msg);
      throw new Error(msg);
    }

    const contentType = resp.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await resp.text();
      console.error(`[AzureAPI] Unexpected non-JSON response from ${url}. Content-Type: ${contentType}`, text.substring(0, 500));
      throw new Error(`Resposta inesperada do servidor (HTML em vez de JSON). Verifique sua conexão ou tokens.`);
    }

    try {
      return await resp.json();
    } catch (e) {
      console.error(`[AzureAPI] JSON parse error for ${url}:`, e);
      throw new Error(`Erro ao processar dados do servidor. Resposta malformada.`);
    }
  },

  _auth(pat) {
    const safePat = typeof pat === 'string' ? pat.trim() : '';
    console.log(`[AzureAPI] Diagnostic: PAT Type: ${typeof pat}, Length: ${safePat.length}, FirstChar: ${safePat[0]||'?'}`);
    
    if (!safePat || safePat === '[object Promise]') {
      console.warn('[AzureAPI] Warning: Invalid PAT format detected. Ensure vault is unlocked and token is decrypted.');
    }

    return {
      'Authorization': 'Basic ' + btoa(':' + safePat),
      'Content-Type': 'application/json'
    };
  },

  _encTeam(t) {
    return t.split(' ').map(encodeURIComponent).join('%20');
  },

  async getIterations(org, proj, team, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/${this._encTeam(team)}/_apis/work/teamsettings/iterations?api-version=7.1`;
    const d = await this._fetch(url, { headers: this._auth(pat) });
    if (!d.value || !d.value.length) {
      throw new Error(`Nenhuma sprint encontrada para o time "${team}".`);
    }
    return d.value;
  },

  async getTeamCapacity(org, proj, team, iterationId, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/${this._encTeam(team)}/_apis/work/teamsettings/iterations/${encodeURIComponent(iterationId)}/capacities?api-version=7.1`;
    try {
      const d = await this._fetch(url, { headers: this._auth(pat) });
      return d.teamMembers || d.value || (Array.isArray(d) ? d : []);
    } catch {
      return [];
    }
  },

  async getWorkItemIds(org, proj, iterationPath, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const safe = iterationPath.replace(/'/g, "''");
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g, "''")}' AND [System.IterationPath] UNDER '${safe}' AND [System.WorkItemType] IN ('Product Backlog Item','Defect','Bug','Task') AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await this._fetch(url, {
      method: 'POST',
      headers: this._auth(pat),
      body: JSON.stringify({ query: q })
    });
    return (d.workItems || []).map(w => w.id);
  },

  async getWorkItemsBatch(org, proj, ids, pat) {
    if (!ids.length) return [];
    const fields = 'System.Id,System.WorkItemType,System.Title,System.State,System.Parent,System.AssignedTo,System.Tags,System.IterationPath,System.CreatedDate,Custom.Block,Microsoft.VSTS.Common.Severity,Microsoft.VSTS.Common.ClosedDate,Microsoft.VSTS.Scheduling.StoryPoints,Microsoft.VSTS.Scheduling.RemainingWork,Microsoft.VSTS.Scheduling.CompletedWork,Microsoft.VSTS.Common.Activity';
    const all = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200).join(',');
      const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems?ids=${chunk}&fields=${encodeURIComponent(fields)}&api-version=7.1`;
      try {
        const d = await this._fetch(url, { headers: this._auth(pat) });
        if (d.value) all.push(...d.value);
      } catch {}
    }
    return all;
  }
};
