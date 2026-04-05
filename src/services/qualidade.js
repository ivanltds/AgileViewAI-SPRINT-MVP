// src/services/qualidade.js

/**
 * QualidadeService - Módulo para análise de Bugs e Defeitos.
 * Refatorado do monolito original AgileViewAI para arquitetura modular ESM.
 */

import { AzureAPI } from '../core/azure-api.js';

export class QualidadeService {
  /**
   * Verifica se um estado é considerado "concluído".
   */
  static _isDone(s) {
    const sl = (s || '').toLowerCase();
    return ['done', 'closed', 'resolved', 'concluído', 'completed', 'finalizado', 'fechado'].includes(sl);
  }

  /**
   * Busca todos os IDs de Bugs e Defeitos do projeto (exceto os removidos).
   */
  static async getQualityItemIds(org, proj, pat) {
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const q = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${proj.replace(/'/g, "''")}' AND [System.WorkItemType] IN ('Bug','Defect') AND [System.State] <> 'Removed' ORDER BY [System.Id]`;
    const d = await AzureAPI._fetch(url, { method: 'POST', headers: AzureAPI._auth(pat), body: JSON.stringify({ query: q }) });
    return (d.workItems || []).map(w => w.id);
  }

  /**
   * Busca as tasks/bugs filhas de um conjunto de Defeitos (Hierarquia).
   */
  static async getDefectChildTaskIds(org, proj, defectIds, pat) {
    if (!defectIds.length) return {};
    const url = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(proj)}/_apis/wit/wiql?api-version=7.1`;
    const q = `SELECT [System.Id] FROM WorkItemLinks WHERE [Source].[System.Id] IN (${defectIds.join(',')}) AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward' AND [Target].[System.WorkItemType] IN ('Task','Bug') MODE (MustContain)`;
    
    try {
      const d = await AzureAPI._fetch(url, { method: 'POST', headers: AzureAPI._auth(pat), body: JSON.stringify({ query: q }) });
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

  /**
   * Calcula o valor máximo de Remaining Work registrado no histórico de revisões.
   * Utilizado para estimar o esforço total "máximo" de um item.
   */
  static async _fetchMaxRemBatch(org, proj, ids, pat) {
    const result = {};
    const BATCH = 8;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      await Promise.all(chunk.map(async id => {
        try {
          const revs = await AzureAPI.getRevisions(org, proj, id, pat);
          let max = 0;
          revs.forEach(r => {
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
  }

  /**
   * Busca dados completos de qualidade e calcula estimativas de esforço.
   */
  static async fetchQualityData({ org, proj, pat }) {
    const ids = await this.getQualityItemIds(org, proj, pat);
    const items = await AzureAPI.getWorkItemsBatch(org, proj, ids, pat);

    const bugIds = items.filter(i => i.fields['System.WorkItemType'] === 'Bug').map(i => i.id);
    const defectIds = items.filter(i => i.fields['System.WorkItemType'] === 'Defect').map(i => i.id);

    // 1. Buscar relações de defeitos e estimar bugs diretos
    const [bugMaxRem, defectChildMap] = await Promise.all([
      this._fetchMaxRemBatch(org, proj, bugIds, pat),
      this.getDefectChildTaskIds(org, proj, defectIds, pat)
    ]);

    // 2. Buscar estimativas das tasks filhas dos Defeitos
    const allChildIds = [...new Set(Object.values(defectChildMap).flat())];
    const taskMaxRem = await this._fetchMaxRemBatch(org, proj, allChildIds, pat);

    // 3. Consolidar tempo gasto per item
    const tempoGasto = {};
    bugIds.forEach(id => {
      tempoGasto[id] = bugMaxRem[id] || 0;
    });
    defectIds.forEach(defId => {
      const children = defectChildMap[String(defId)] || [];
      tempoGasto[defId] = Math.round(children.reduce((acc, tid) => acc + (taskMaxRem[tid] || 0), 0) * 10) / 10;
    });

    const totalHorasGastas = Math.round(Object.values(tempoGasto).reduce((a, b) => a + b, 0) * 10) / 10;

    return { items, tempoGasto, totalHorasGastas };
  }

  /**
   * Calcula métricas e KPIs baseados nos itens carregados.
   */
  static calculateMetrics(items, tempoGasto, totalHorasGastas) {
    const openAll = items.filter(i => !this._isDone(i.fields['System.State']));
    const doneAll = items.filter(i => this._isDone(i.fields['System.State']));

    const monthAgo = Date.now() - 30 * 86400000;
    const itemsLastMonth = items.filter(i => {
      const created = i.fields['System.CreatedDate'];
      return created && new Date(created).getTime() >= monthAgo;
    });

    const avgResDays = (filteredItems) => {
      const resolved = filteredItems.filter(i => this._isDone(i.fields['System.State']));
      const values = resolved.map(i => {
        const closed = i.fields['Microsoft.VSTS.Common.ClosedDate'];
        const created = i.fields['System.CreatedDate'];
        if (!closed || !created) return null;
        const d = Math.round((new Date(closed) - new Date(created)) / 86400000);
        return d >= 0 ? d : null;
      }).filter(v => v !== null);
      
      return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
    };

    const bugs = items.filter(i => i.fields['System.WorkItemType'] === 'Bug');
    const defects = items.filter(i => i.fields['System.WorkItemType'] === 'Defect');

    return {
      kpis: {
        open: openAll.length,
        closed: doneAll.length,
        lastMonth: itemsLastMonth.length,
        avgBug: avgResDays(bugs),
        avgDefect: avgResDays(defects),
        totalRemaining: Math.round(items.reduce((a, i) => a + (Number(i.fields['Microsoft.VSTS.Scheduling.RemainingWork']) || 0), 0) * 10) / 10,
        totalEstimated: totalHorasGastas
      },
      items,
      tempoGasto
    };
  }

  /**
   * Prepara dados para gráficos de pizza.
   */
  static getChartData(items) {
    const counts = (key) => {
      const map = {};
      items.forEach(i => {
        const v = i.fields[key] || 'Não definido';
        map[v] = (map[v] || 0) + 1;
      });
      return map;
    };

    return {
      severity: counts('Microsoft.VSTS.Common.Severity'),
      priority: counts('Microsoft.VSTS.Common.Priority'),
      state: counts('System.State')
    };
  }
}
