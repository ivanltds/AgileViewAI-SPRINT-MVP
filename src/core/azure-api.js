// src/core/azure-api.js

/**
 * AzureAPI - Módulo Core para interações com Azure DevOps
 * Isolado do monolito original, mantém a assinatura de métodos idêntica.
 */

export const AzureAPI = {
  async _fetch(url, opts = {}) {
    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${t.substring(0, 200)}`);
    }
    return resp.json();
  },
  
  _auth(pat) {
    // btoa is available in browser environments. 
    // In node/JSDOM for unit tests, global.btoa might need polyfill if not present, but JSDOM provides it.
    return { 
      'Authorization': 'Basic ' + globalThis.btoa(':' + pat), 
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
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g,"''")}' AND [System.IterationPath] UNDER '${safe}' AND [System.WorkItemType] IN ('Product Backlog Item','Defect','Bug','Task') AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await this._fetch(url, { method: 'POST', headers: this._auth(pat), body: JSON.stringify({ query: q }) });
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
