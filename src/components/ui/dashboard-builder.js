/**
 * AgileViewAI - Dashboard Builder (ESM)
 */

import { ICONS, getSeverityIcon } from '../../utils/icons.js';

export const DashboardBuilder = {
  _e(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  _fmtDate(v) {
    if (!v) return '';
    const M = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.getUTCDate() + ' de ' + M[d.getUTCMonth()];
  },
  _itemUrl(t, id) {
    return `https://dev.azure.com/${encodeURIComponent(t.org)}/${encodeURIComponent(t.proj)}/_workitems/edit/${id}`;
  },

  /**
   * Renderiza os dados da Sprint nos sub-containers apropriados.
   * Não deve sobrescrever o innerHTML de dashboard-content para não apagar os painéis das outras abas.
   */
  render(data) {
    const { team, activeSprint: sp, backlog, tasks, stats: s } = data;
    const e = this._e.bind(this);
    
    // Topbar Info
    const topbarInfoEl = document.getElementById('db-topbar-info');
    if (topbarInfoEl) {
      const sprintLabel = sp.path.split('\\').pop();
      topbarInfoEl.innerHTML =
        `<div style="font-weight:700;font-size:15px;color:var(--slate)">${e(team.proj)}</div>
         <div style="display:flex;align-items:center;gap:8px;margin-top:2px;flex-wrap:wrap">
           <span style="font-size:13px;color:var(--gray)">${e(team.org)} · ${e(team.name)}</span>
           <span style="font-size:13px;font-weight:600;color:var(--slate);display:flex;align-items:center;gap:4px"><span class="sprint-dot"></span>${e(sprintLabel)}</span>
           ${sp.bizDaysLeft > 0 ? `<span class="days-pill">${sp.bizDaysLeft} dia${sp.bizDaysLeft !== 1 ? 's' : ''} úteis</span>` : '<span class="days-pill ended">Encerrada</span>'}
           <span style="font-size:11px;color:#64748b">${e(this._fmtDate(sp.startRaw))} — ${e(this._fmtDate(sp.endRaw))}</span>
         </div>`;
    }

    // KPIs
    const kpisEl = document.getElementById('db-kpis');
    if (kpisEl) {
      const kpis = [
        { l: 'Total', v: s.total, sub: 'itens no backlog', al: false, tip: 'Total de PBIs e Defects.' },
        { l: 'Concluídos', v: s.done, sub: `${s.done} concluídos`, al: false, tip: 'Itens com estado final.' },
        { l: 'Progresso', v: s.donePct + '%', sub: `${s.donePct}% concluído`, al: false, tip: 'Percentual de entrega.' },
        { l: 'Bloqueados', v: s.blocked, sub: s.blocked > 0 ? 'impedimentos ativos' : 'sem bloqueios', al: s.blocked > 0, tip: 'Itens com impedimento.' },
        { l: 'Em fixing', v: s.fixing, sub: 'correções ativas', al: s.fixing > 0, tip: 'Itens em fase de correção.' },
        { l: 'Alocação', v: s.allocPct + '%', sub: `${s.totalRem}h / ${s.capacityTotal}h`, al: s.allocPct > 100, tip: 'Remaining vs Capacidade.' }
      ];
      
      const _tip = t => `<span class="kpi-tip"><i class="kpi-tip-icon">i</i><span class="kpi-tip-box">${t}</span></span>`;
      kpisEl.innerHTML =
        `<div class="kpi-grid">${kpis.map(k => `<div class="kpi-card${k.al ? ' alert' : ''}"><div class="kpi-label">${k.l} ${_tip(k.tip)}</div><div class="kpi-val">${k.v}</div><div class="kpi-sub">${k.sub}</div></div>`).join('')}</div>`;
    }

    // Backlog Rendering
    const backlogEl = document.getElementById('db-backlog');
    if (backlogEl) {
      const childMap = {};
      tasks.forEach(t => {
        const p = String(t.parentId || '');
        if (!childMap[p]) childMap[p] = [];
        childMap[p].push(t);
      });

      let rows = '';
      backlog.forEach(item => {
        const id = String(item.id);
        const rc = item.blockStatus === 'BLOCKED' ? ' row-blocked' : item.blockStatus === 'FIXING' ? ' row-fixing' : '';
        const tl = item.type === 'Product Backlog Item' ? 'PBI' : item.type === 'Defect' ? 'Defect' : item.type;
        const tc = item.type === 'Bug' || item.type === 'Defect' ? 'badge-bug' : 'badge-pbi';
        
        let sl, sc;
        const st = (item.state || '').toLowerCase();
        if (item.blockStatus === 'BLOCKED') { sl = 'Bloqueado'; sc = 's-blocked'; }
        else if (item.blockStatus === 'FIXING') { sl = 'Em fixing'; sc = 's-fixing'; }
        else if (['done', 'closed', 'resolved'].includes(st)) { sl = item.state; sc = 's-done'; }
        else if (['active', 'in progress', 'doing'].some(s => st.includes(s))) { sl = item.state; sc = 's-doing'; }
        else { sl = e(item.state) || 'To Do'; sc = 's-todo'; }

        let progHtml = item.estimativa > 0 
          ? `<div class="bl-prog"><div class="bl-prog-bar"><div class="bl-prog-fill" style="width:${Math.round((item.estimativa-item.childRem)/item.estimativa*100)}%"></div></div></div>`
          : '—';

        rows += `<tr class="bl-row${rc}" onclick="toggleCh('${id}')">` +
          `<td><span class="xicon" id="ico-${id}">▶</span></td>` +
          `<td><span class="badge ${tc}">${e(tl)}</span></td>` +
          `<td>#${id}</td>` +
          `<td class="title-cell">${e(item.title)}</td>` +
          `<td><span class="sb ${sc}">${sl}</span></td>` +
          `<td>—</td>` +
          `<td>—</td>` +
          `<td>${progHtml}</td>` +
          `<td>${item.estimativa}h</td>` +
          `<td>${item.childRem}h</td></tr>`;
      });

      backlogEl.innerHTML = `<table class="bl-table"><thead><tr><th></th><th>Tipo</th><th>ID</th><th>Título</th><th>Status</th><th>Executores</th><th>Bloq.</th><th>Progresso</th><th>Est.</th><th>Rem.</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
  },

  renderInsightCard(ins) {
    const e = this._e.bind(this);
    return `<div class="ins-card">
      <div class="ins-head">${getSeverityIcon(ins.severity)}<span class="ins-title2">${e(ins.title)}</span></div>
      <p class="ins-body">${e(ins.body)}</p>
    </div>`;
  }
};
