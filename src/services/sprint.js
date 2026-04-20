/**
 * AgileViewAI - Sprint Service (ESM)
 */

import { AzureAPI } from '../core/azure-api.js';
import { Store } from '../core/store.js';
import { AppState } from '../core/app-state.js';

export const SprintService = {
  async getWorkItemIds(org, proj, iterPaths, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const cond = iterPaths.map(p => `[System.IterationPath] UNDER '${p.replace(/'/g, "''")}'`).join(' OR ');
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g, "''")}' AND [System.WorkItemType] IN ('Product Backlog Item','Bug','Defect','Task') AND (${cond}) AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await AzureAPI._fetch(url, {
      method: 'POST',
      headers: AzureAPI._auth(pat),
      body: JSON.stringify({ query: q })
    });
    return (d.workItems || []).map(w => w.id);
  },

  async getAllBacklogIds(org, proj, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g, "''")}' AND [System.WorkItemType] IN ('Product Backlog Item','Bug','Defect','Task') AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await AzureAPI._fetch(url, {
      method: 'POST',
      headers: AzureAPI._auth(pat),
      body: JSON.stringify({ query: q })
    });
    return (d.workItems || []).map(w => w.id);
  },

  async fetchMaxRem(org, proj, ids, pat) {
    const result = {};
    const BATCH = 8;
    for (let i = 0; i < ids.length; i += BATCH) {
      await Promise.all(ids.slice(i, i + BATCH).map(async id => {
        try {
          const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems/${id}/revisions?api-version=7.1`;
          const d = await AzureAPI._fetch(url, { headers: AzureAPI._auth(pat) });
          let max = 0;
          (d.value || []).forEach(r => {
            const v = Number(r.fields?.['Microsoft.VSTS.Scheduling.RemainingWork'] || 0);
            if (v > max) max = v;
          });
          result[id] = max;
        } catch {
          result[id] = 0;
        }
      }));
    }
    return result;
  },

  _bizDays(startMs, endMs) {
    let n = 0, cur = startMs;
    while (cur <= endMs) {
      const d = new Date(cur).getUTCDay();
      if (d !== 0 && d !== 6) n++;
      cur += 86400000;
    }
    return n;
  },

  _blockStatus(item) {
    const f = item.fields;
    const tags = String(f['System.Tags'] || '').toLowerCase();
    const st = String(f['System.State'] || '').toLowerCase();
    const block = f['Custom.Block'];
    if (block === true || block === 'true' || block === 'True' || tags.includes('blocked') || tags.includes('bloqueado') || tags.includes('block') || st.includes('block')) return 'BLOCKED';
    if (tags.includes('fixing') || tags.includes('correção') || st.includes('fixing') || st.includes('fix ') || st === 'fix' || st.includes('corre') || st.includes('ajuste') || st.includes('reopen')) return 'FIXING';
    return 'CLEAR';
  },

  _dispName(v) {
    if (!v) return '';
    if (typeof v === 'object') return v.displayName || '';
    return String(v);
  },

  _parseDaysOff(cap) {
    const out = [];
    (cap.daysOff || []).forEach(d => {
      const s = new Date(d.start), e = new Date(d.end);
      let cur = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
      const end = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
      while (cur <= end) {
        const dt = new Date(cur), dow = dt.getUTCDay();
        if (dow !== 0 && dow !== 6) out.push(`${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`);
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

    const iters = await AzureAPI.getIterations(org, proj, azTeam, pat);
    AppState.allIterations = iters;
    const now = Date.now();
    let active = iters.find(it => {
      const s = it.attributes?.startDate ? new Date(it.attributes.startDate).getTime() : 0;
      const e = it.attributes?.finishDate ? new Date(it.attributes.finishDate).getTime() + 86400000 : 0;
      return s <= now && now <= e;
    });
    if (!active) {
      const past = iters.filter(it => it.attributes?.finishDate && new Date(it.attributes.finishDate).getTime() < now);
      if (past.length) {
        past.sort((a, b) => new Date(b.attributes.finishDate) - new Date(a.attributes.finishDate));
        active = past[0];
      } else {
        iters.sort((a, b) => new Date(a.attributes?.startDate || 0) - new Date(b.attributes?.startDate || 0));
        active = iters[0];
      }
    }
    if (!active) throw new Error('Nenhuma sprint ativa encontrada.');

    const iterPath = active.path;
    const iterStart = active.attributes?.startDate;
    const iterEnd = active.attributes?.finishDate;

    const ids = await AzureAPI.getWorkItemIds(org, proj, iterPath, pat);
    const items = await AzureAPI.getWorkItemsBatch(org, proj, ids, pat);

    const backlog = [], tasks = [];
    items.forEach(item => {
      const type = item.fields['System.WorkItemType'];
      const parentId = item.fields['System.Parent'];
      const isTask = type === 'Task' || type === 'Bug';
      const obj = {
        id: item.id,
        type,
        title: item.fields['System.Title'],
        state: item.fields['System.State'],
        assignedTo: this._dispName(item.fields['System.AssignedTo']),
        blockStatus: this._blockStatus(item)
      };
      if (isTask) {
        tasks.push({
          ...obj,
          parentId: parentId || null,
          remaining: Number(item.fields['Microsoft.VSTS.Scheduling.RemainingWork']) || 0,
          completed: Number(item.fields['Microsoft.VSTS.Scheduling.CompletedWork']) || 0,
          activity: item.fields['Microsoft.VSTS.Common.Activity'] || ''
        });
      } else {
        backlog.push({
          ...obj,
          severity: item.fields['Microsoft.VSTS.Common.Severity'] || '',
          tags: item.fields['System.Tags'] || '',
          storyPoints: Number(item.fields['Microsoft.VSTS.Scheduling.StoryPoints']) || 0,
          remainingWork: Number(item.fields['Microsoft.VSTS.Scheduling.RemainingWork']) || 0
        });
      }
    });

    if (tasks.length) {
      const maxRem = await this.fetchMaxRem(org, proj, tasks.map(t => t.id), pat);
      tasks.forEach(t => { t.estimated = maxRem[t.id] ?? t.remaining; });
    } else {
      tasks.forEach(t => { t.estimated = t.remaining; });
    }

    const estMap = {}, remMap = {};
    const _isDoneT = s => {
      const sl = (s || '').toLowerCase();
      return sl === 'done' || sl === 'closed' || sl === 'resolved';
    };
    tasks.forEach(t => {
      const p = String(t.parentId || '');
      if (!estMap[p]) estMap[p] = 0;
      estMap[p] += t.estimated || 0;
      if (!_isDoneT(t.state)) {
        if (!remMap[p]) remMap[p] = 0;
        remMap[p] += t.remaining || 0;
      }
    });
    backlog.forEach(b => {
      b.estimativa = estMap[String(b.id)] || 0;
      b.childRem = remMap[String(b.id)] || 0;
    });

    const capRaw = await AzureAPI.getTeamCapacity(org, proj, azTeam, active.id, pat);
    const now2 = new Date();
    const todayMs = Date.UTC(now2.getUTCFullYear(), now2.getUTCMonth(), now2.getUTCDate());
    const endMs = iterEnd ? new Date(iterEnd).getTime() : todayMs;
    const startMs = iterStart ? new Date(iterStart).getTime() : todayMs;
    const bizDays = this._bizDays(todayMs, endMs);
    const totBizDays = this._bizDays(startMs, endMs);

    const capacity = {};
    capRaw.forEach(c => {
      const name = this._dispName(c.teamMember);
      if (!name) return;
      const act = c.activities?.[0]?.name || '';
      const capDay = Number(c.activities?.[0]?.capacityPerDay) || 0;
      const allOff = this._parseDaysOff(c);
      const futureOff = allOff.filter(d => {
        const [dd, mm] = d.split('/').map(Number);
        return Date.UTC(now2.getUTCFullYear(), mm - 1, dd) >= todayMs;
      });
      capacity[name] = {
        activity: act,
        capPerDay: capDay,
        daysOffStr: futureOff.join(', ') || '—',
        daysOffTotal: allOff.length,
        capTotal: Math.round(capDay * Math.max(totBizDays - allOff.length, 0) * 10) / 10,
        capRest: Math.round(capDay * Math.max(bizDays - futureOff.length, 0) * 10) / 10
      };
    });

    const stats = this._calcStats(backlog, tasks, capacity, bizDays, todayMs);
    const data = {
      team,
      activeSprint: { path: iterPath, startRaw: iterStart, endRaw: iterEnd, bizDaysLeft: bizDays },
      backlog,
      tasks,
      capacity,
      stats,
      syncedAt: new Date().toISOString()
    };
    Store.saveSprintCache(data);
    AppState.sprintData = data;
    return data;
  },

  _calcStats(backlog, tasks, capacity, bizDays, todayMs) {
    const _isDone = s => {
      const sl = (s || '').toLowerCase();
      return sl === 'done' || sl === 'closed' || sl === 'resolved';
    };
    const _isProg = s => {
      const sl = (s || '').toLowerCase();
      return sl.includes('progress') || sl.includes('ativo') || sl.includes('active') || sl.includes('andamento');
    };
    const total = backlog.length;
    const done = backlog.filter(i => _isDone(i.state)).length;
    const blocked = backlog.filter(i => i.blockStatus === 'BLOCKED').length;
    const fixing = backlog.filter(i => i.blockStatus === 'FIXING').length;
    const inProgress = backlog.filter(i => _isProg(i.state) && i.blockStatus === 'CLEAR').length;
    const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
    const totalRem = tasks.reduce((a, t) => a + (t.remaining || 0), 0);
    const totalTasksDone = tasks.filter(t => _isDone(t.state)).length;
    const totalTasksOpen = tasks.filter(t => !_isDone(t.state)).length;
    let capTotal = Object.values(capacity).reduce((a, c) => a + (c.capRest || 0), 0);
    if (capTotal === 0 && bizDays > 0) capTotal = bizDays * 6 * Math.max(Object.keys(capacity).length, 1);
    const allocPct = capTotal > 0 ? Math.min(Math.round((totalRem / capTotal) * 100), 999) : 0;

    const byMember = {};
    tasks.forEach(t => {
      const m = (t.assignedTo?.trim()) || 'Não atribuído';
      if (!byMember[m]) byMember[m] = { remaining: 0, tasksDone: 0 };
      if (_isDone(t.state)) byMember[m].tasksDone++;
      else byMember[m].remaining += (t.remaining || 0);
    });

    const byActivity = {};
    Object.keys(capacity).forEach(m => {
      const act = capacity[m].activity || 'Não definido';
      if (!byActivity[act]) byActivity[act] = { capRest: 0, capTotal: 0, remaining: 0, members: 0 };
      byActivity[act].capRest += capacity[m].capRest || 0;
      byActivity[act].capTotal += capacity[m].capTotal || 0;
      byActivity[act].members++;
    });
    tasks.forEach(t => {
      if (_isDone(t.state)) return;
      const m = t.assignedTo?.trim() || '';
      const cap = m ? capacity[m] : null;
      const act = cap ? (cap.activity || 'Não definido') : 'Não definido';
      if (!byActivity[act]) byActivity[act] = { capRest: 0, capTotal: 0, remaining: 0, members: 0 };
      byActivity[act].remaining += (t.remaining || 0);
    });

    const dayOffCards = [];
    if (todayMs) {
      Object.keys(capacity).forEach(m => {
        const str = capacity[m].daysOffStr;
        if (!str || str === '—') return;
        str.split(',').forEach(part => {
          part = part.trim();
          if (!part) return;
          const mx = part.match(/^(\d{1,2})\/(\d{1,2})$/);
          if (!mx) return;
          const ts = Date.UTC(new Date().getUTCFullYear(), parseInt(mx[2]) - 1, parseInt(mx[1]));
          if (ts >= todayMs) dayOffCards.push({ member: m, label: part, dateTs: ts, activity: capacity[m].activity });
        });
      });
      dayOffCards.sort((a, b) => a.dateTs - b.dateTs);
    }

    return { total, done, blocked, fixing, inProgress, donePct, totalRem, totalTasksDone, totalTasksOpen, bizDays, capacityTotal: capTotal, allocPct, byMember, byActivity, dayOffCards };
  }
};
