/**
 * AgileViewAI - Quality Service (ESM)
 */

import { AzureAPI } from '../core/azure-api.js';

export const QualityService = {
  async getIds(org, proj, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g, "''")}' AND [System.WorkItemType] IN ('Bug','Defect') AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await AzureAPI._fetch(url, {
      method: 'POST',
      headers: AzureAPI._auth(pat),
      body: JSON.stringify({ query: q })
    });
    return (d.workItems || []).map(w => w.id);
  },

  async getItems(org, proj, ids, pat) {
    if (!ids.length) return [];
    const fields = encodeURIComponent('System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,Microsoft.VSTS.Common.Severity,Microsoft.VSTS.Common.Priority,System.CreatedDate,Microsoft.VSTS.Common.ClosedDate,Microsoft.VSTS.Scheduling.RemainingWork,Microsoft.VSTS.Scheduling.CompletedWork,Microsoft.VSTS.Scheduling.OriginalEstimate');
    const all = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200).join(',');
      const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems?ids=${chunk}&fields=${fields}&api-version=7.1`;
      try {
        const d = await AzureAPI._fetch(url, { headers: AzureAPI._auth(pat) });
        if (d.value) all.push(...d.value);
      } catch {}
    }
    return all;
  },

  async getDefectChildTaskIds(org, proj, defectIds, pat) {
    if (!defectIds.length) return {};
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const q = `SELECT [System.Id] FROM WorkItemLinks WHERE [Source].[System.Id] IN (${defectIds.join(',')}) AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' AND [Target].[System.WorkItemType] IN ('Task','Bug') MODE (MustContain)`;
    try {
      const d = await AzureAPI._fetch(url, {
        method: 'POST',
        headers: AzureAPI._auth(pat),
        body: JSON.stringify({ query: q })
      });
      const map = {};
      (d.workItemRelations || []).forEach(r => {
        if (!r.source || !r.target) return;
        const p = String(r.source.id);
        if (!map[p]) map[p] = [];
        map[p].push(r.target.id);
      });
      return map;
    } catch {
      return {};
    }
  }
};
