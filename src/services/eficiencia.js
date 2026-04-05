// src/services/eficiencia.js

/**
 * EficienciaService - Módulo para análise de throughput, lead/cycle time e board efficiency.
 * Refatorado do monolito original AgileViewAI para arquitetura modular ESM.
 * 
 * Mantém 100% de paridade funcional com a lógica legada.
 */

import { AzureAPI } from '../core/azure-api.js';

export class EficienciaService {
  /**
   * Utilitário para cálculo de dias entre duas datas.
   */
  static _days(d1, d2) {
    if (!d1 || !d2) return 0;
    return Math.max(0, (new Date(d2) - new Date(d1)) / 86400000);
  }

  /**
   * Verifica se um estado é considerado "concluído".
   */
  static _isDone(s) {
    const sl = (s || '').toLowerCase();
    return ['done', 'closed', 'resolved', 'concluído', 'completed', 'finalizado', 'fechado'].includes(sl);
  }

  /**
   * Busca revisões de um work item para análise de board.
   */
  static async getWorkItemRevisions(org, proj, id, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/workitems/${id}/revisions?api-version=7.1`;
    try {
      const d = await AzureAPI._fetch(url, { headers: AzureAPI._auth(pat) });
      return d.value || [];
    } catch {
      return [];
    }
  }

  /**
   * Calcula métricas de eficiência baseadas num período histórico.
   * 
   * @param {Object} params 
   * @param {string} params.org
   * @param {string} params.proj
   * @param {string} params.team
   * @param {string} params.pat
   * @param {number} params.periodMonths - 3, 6 ou 12
   * @param {Object} params.allIterations - Lista completa de iterações do time
   * @param {Object} params.currentCapacity - Capacidade da sprint atual (para o KPI consolidado)
   */
  static async calculateMetrics({ org, proj, team, pat, periodMonths, allIterations, currentCapacity }) {
    // 1. Filtrar iterações pelo período solicitado
    const now = new Date();
    const startDate = new Date();
    startDate.setMonth(now.getMonth() - periodMonths);

    const filteredIters = allIterations.filter(it => {
      const itDate = it.attributes?.finishDate ? new Date(it.attributes.finishDate) : null;
      return itDate && itDate >= startDate && itDate <= now;
    });

    if (filteredIters.length === 0) {
      return {
        avgThroughput: 0,
        avgLeadTime: 0,
        avgCycleTime: 0,
        iterLabels: [],
        byIter: {},
        colTimes: {}
      };
    }

    const iterPaths = filteredIters.map(it => it.path);

    // 2. Buscar Work Items das iterações filtradas (PBIs, Bugs, Defects)
    // Nota: Usamos WIQL para buscar em múltiplas iterações via OR iterations
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const cond = iterPaths.map(p => `[System.IterationPath] UNDER '${p.replace(/'/g, "''")}'`).join(' OR ');
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g, "''")}' AND [System.WorkItemType] IN ('Product Backlog Item','Bug','Defect') AND (${cond}) AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    
    const wiqlResult = await AzureAPI._fetch(url, { 
      method: 'POST', 
      headers: AzureAPI._auth(pat), 
      body: JSON.stringify({ query: q }) 
    });
    
    const ids = (wiqlResult.workItems || []).map(w => w.id);
    const items = await AzureAPI.getWorkItemsBatch(org, proj, ids, pat);

    // 3. Processar métricas
    const doneItems = items.filter(i => this._isDone(i.fields['System.State']));
    const byIter = {};

    doneItems.forEach(i => {
      const key = (i.fields['System.IterationPath'] || '?').split('\\').pop();
      if (!byIter[key]) {
        byIter[key] = { count: 0, points: 0, leadTimes: [], cycleTimes: [] };
      }
      
      byIter[key].count++;
      byIter[key].points += Number(i.fields['Microsoft.VSTS.Scheduling.StoryPoints']) || 0;
      
      const closed = i.fields['Microsoft.VSTS.Common.ClosedDate'];
      const activated = i.fields['Microsoft.VSTS.Common.ActivatedDate'];
      const created = i.fields['System.CreatedDate'];
      
      if (closed && created) byIter[key].leadTimes.push(this._days(created, closed));
      if (closed && activated) byIter[key].cycleTimes.push(this._days(activated, closed));
    });

    const iterLabels = Object.keys(byIter).sort();

    // Médias globais
    const allLT = doneItems
      .filter(i => i.fields['System.CreatedDate'] && i.fields['Microsoft.VSTS.Common.ClosedDate'])
      .map(i => this._days(i.fields['System.CreatedDate'], i.fields['Microsoft.VSTS.Common.ClosedDate']));
    
    const allCT = doneItems
      .filter(i => i.fields['Microsoft.VSTS.Common.ActivatedDate'] && i.fields['Microsoft.VSTS.Common.ClosedDate'])
      .map(i => this._days(i.fields['Microsoft.VSTS.Common.ActivatedDate'], i.fields['Microsoft.VSTS.Common.ClosedDate']));

    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    // 4. Board Column Time via Revisions (Regra de outlier: < 180 dias)
    const colTimes = {};
    for (const item of doneItems) {
      const revs = await this.getWorkItemRevisions(org, proj, item.id, pat);
      for (let i = 0; i < revs.length - 1; i++) {
        const col = revs[i].fields?.['System.BoardColumn'] || revs[i].fields?.['System.State'] || '';
        const t1 = new Date(revs[i].fields?.['System.ChangedDate'] || 0);
        const t2 = new Date(revs[i + 1].fields?.['System.ChangedDate'] || 0);
        const d = (t2 - t1) / 86400000;
        
        // Regra de parity: d > 0 && d < 180 && !_isDone(col)
        if (col && d > 0 && d < 180 && !this._isDone(col)) {
          if (!colTimes[col]) colTimes[col] = { total: 0, count: 0 };
          colTimes[col].total += d;
          colTimes[col].count++;
        }
      }
    }

    return {
      avgThroughput: Math.round(avg(iterLabels.map(k => byIter[k].count)) * 10) / 10,
      avgLeadTime: Math.round(avg(allLT) * 10) / 10,
      avgCycleTime: Math.round(avg(allCT) * 10) / 10,
      openBugs: 0, // Reservado conforme monolith
      capTotal: Math.round(Object.values(currentCapacity || {}).reduce((a, c) => a + (c.capTotal || 0), 0) * 10) / 10,
      iterLabels,
      byIter,
      colTimes
    };
  }
}
