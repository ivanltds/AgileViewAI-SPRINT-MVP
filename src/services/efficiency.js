/**
 * AgileViewAI - Efficiency Service (ESM)
 */

import { AzureAPI } from '../core/azure-api.js';

export const EfficiencyService = {
  async getWorkItemIds(org, proj, iterPaths, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const cond = iterPaths.map(p => `[System.IterationPath] UNDER '${p.replace(/'/g, "''")}'`).join(' OR ');
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g, "''")}' AND [System.WorkItemType] IN ('Product Backlog Item','Bug','Defect') AND (${cond}) AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await AzureAPI._fetch(url, {
      method: 'POST',
      headers: AzureAPI._auth(pat),
      body: JSON.stringify({ query: q })
    });
    return (d.workItems || []).map(w => w.id);
  },

  async getWorkItems(org, proj, ids, pat) {
    if (!ids.length) return [];
    const fields = encodeURIComponent('System.Id,System.WorkItemType,System.State,System.IterationPath,System.CreatedDate,Microsoft.VSTS.Common.ActivatedDate,Microsoft.VSTS.Common.ClosedDate,Microsoft.VSTS.Scheduling.StoryPoints,System.BoardColumn,System.ChangedDate');
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

  async getRevisions(org, proj, id, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems/${id}/revisions?api-version=7.1`;
    try {
      const d = await AzureAPI._fetch(url, { headers: AzureAPI._auth(pat) });
      return d.value || [];
    } catch {
      return [];
    }
  },

  async getTaskIds(org, proj, iterPaths, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const cond = iterPaths.map(p => `[System.IterationPath] UNDER '${p.replace(/'/g, "''")}'`).join(' OR ');
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g, "''")}' AND [System.WorkItemType] = 'Task' AND (${cond}) ORDER BY [System.Id]`;
    try {
      const d = await AzureAPI._fetch(url, {
        method: 'POST',
        headers: AzureAPI._auth(pat),
        body: JSON.stringify({ query: q })
      });
      return (d.workItems || []).map(w => w.id);
    } catch {
      return [];
    }
  },

  async getTasksIterPath(org, proj, ids, pat) {
    if (!ids.length) return {};
    const result = {};
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200).join(',');
      const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems?ids=${chunk}&fields=${encodeURIComponent('System.Id,System.IterationPath')}&api-version=7.1`;
      try {
        const d = await AzureAPI._fetch(url, { headers: AzureAPI._auth(pat) });
        (d.value || []).forEach(it => {
          result[it.id] = it.fields['System.IterationPath'] || '?';
        });
      } catch {}
    }
    return result;
  },

  async getOpenBugsCount(org, proj, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g, "''")}' AND [System.WorkItemType] IN ('Bug','Defect') AND [System.State] NOT IN ('Done','Closed','Resolved','Removed') ORDER BY [System.Id]`;
    try {
      const d = await AzureAPI._fetch(url, {
        method: 'POST',
        headers: AzureAPI._auth(pat),
        body: JSON.stringify({ query: q })
      });
      return (d.workItems || []).length;
    } catch {
      return 0;
    }
  },

  // Processor logic
  _isDone(s) {
    const sl = (s || '').toLowerCase();
    return sl === 'done' || sl === 'closed' || sl === 'resolved';
  },

  _days(d1, d2) {
    return Math.max(0, (new Date(d2) - new Date(d1)) / 86400000);
  },

  async compute(items, org, proj, pat, currentCap) {
    const done = items.filter(i => this._isDone(i.fields['System.State']));

    // Group done items by sprint label
    const byIter = {};
    done.forEach(i => {
      const key = (i.fields['System.IterationPath'] || '?').split('\\').pop();
      if (!byIter[key]) byIter[key] = {
        count: 0,
        points: 0,
        leadTimes: [],
        cycleTimes: []
      };
      byIter[key].count++;
      byIter[key].points += Number(i.fields['Microsoft.VSTS.Scheduling.StoryPoints']) || 0;
      const closed = i.fields['Microsoft.VSTS.Common.ClosedDate'];
      const activated = i.fields['Microsoft.VSTS.Common.ActivatedDate'];
      const created = i.fields['System.CreatedDate'];
      if (closed && created) byIter[key].leadTimes.push(this._days(created, closed));
      if (closed && activated) byIter[key].cycleTimes.push(this._days(activated, closed));
    });
    const iterLabels = Object.keys(byIter).sort();

    // Overall averages
    const allLT = done.filter(i => i.fields['System.CreatedDate'] && i.fields['Microsoft.VSTS.Common.ClosedDate']).map(i => this._days(i.fields['System.CreatedDate'], i.fields['Microsoft.VSTS.Common.ClosedDate']));
    const allCT = done.filter(i => i.fields['Microsoft.VSTS.Common.ActivatedDate'] && i.fields['Microsoft.VSTS.Common.ClosedDate']).map(i => this._days(i.fields['Microsoft.VSTS.Common.ActivatedDate'], i.fields['Microsoft.VSTS.Common.ClosedDate']));
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    // Sprint capacity from current sync
    const capTotal = Object.values(currentCap || {}).reduce((a, c) => a + (c.capTotal || 0), 0);

    // Board column time via revisions
    const _isDoneCol = c => {
      const cl = (c || '').toLowerCase();
      return cl === 'done' || cl === 'closed' || cl === 'resolved' || cl === 'concluído' || cl === 'completed' || cl === 'finalizado' || cl === 'fechado';
    };
    const colTimes = {};
    for (const item of done) {
      const revs = await this.getRevisions(org, proj, item.id, pat);
      for (let i = 0; i < revs.length - 1; i++) {
        const col = revs[i].fields?.['System.BoardColumn'] || revs[i].fields?.['System.State'] || '';
        const t1 = new Date(revs[i].fields?.['System.ChangedDate'] || 0);
        const t2 = new Date(revs[i + 1].fields?.['System.ChangedDate'] || 0);
        const d = (t2 - t1) / 86400000;
        if (col && d > 0 && d < 180 && !_isDoneCol(col)) {
          if (!colTimes[col]) colTimes[col] = { total: 0, count: 0 };
          colTimes[col].total += d;
          colTimes[col].count++;
        }
      }
    }

    return {
      avgThroughput: Math.round(avg([...iterLabels.map(k => byIter[k].count)]) * 10) / 10,
      avgLeadTime: Math.round(avg(allLT) * 10) / 10,
      avgCycleTime: Math.round(avg(allCT) * 10) / 10,
      openBugs: 0,
      capTotal: Math.round(capTotal * 10) / 10,
      iterLabels,
      byIter,
      colTimes
    };
  }
};
