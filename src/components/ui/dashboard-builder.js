/**
 * AgileViewAI - Dashboard Builder (ESM)
 * Responsável por gerar o HTML premium do Dashboard compatível com E2E.
 */

import { ICONS, getSeverityIcon } from '../../utils/icons.js';

export const DashboardBuilder = {
  _e(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  render(data) {
    if (!data) return;
    const isLoading = !data.stats || Object.keys(data.stats).length === 0;
    
    this.renderTopbar(data, isLoading);
    this.renderKpis(data, isLoading);
    this.renderBacklog(data, isLoading);
    this.renderProgress(data, isLoading);
    this.renderInsights(data, isLoading);
    this.renderMembers(data, isLoading);
    
    // Bridge for globally-called functions (compatibility)
    window.toggleCh = (id) => this.toggleCh(id);
    window.toggleTimeline = (btn, id) => this.toggleTimeline(btn, id);
    window.DashboardBuilderInstance = this;
  },

  toggleCh(id) {
    const row = document.getElementById('cr-' + id);
    const ico = document.getElementById('ico-' + id);
    if (!row) return;

    const isExpanded = row.classList.contains('expanded');
    
    if (isExpanded) {
      // Inicia fechamento (remover classe primeiro para animação)
      row.classList.remove('expanded');
      setTimeout(() => { if (!row.classList.contains('expanded')) row.style.display = 'none'; }, 300);
    } else {
      // Inicia abertura (display primeiro, depois classe para animação)
      row.style.display = '';
      // Force reflow
      row.offsetHeight;
      row.classList.add('expanded');
    }

    if (ico) {
      ico.classList.toggle('expanded', !isExpanded);
      ico.innerHTML = !isExpanded ? '▼' : '▶';
    }
  },

  renderTopbar(data, isLoading) {
    const { team, activeSprint: sp } = data;
    const e = this._e.bind(this);
    const el = document.getElementById('db-topbar-info');
    if (!el) return;
    
    if (isLoading) {
      el.innerHTML = `
        <div class="db-proj-name" style="font-weight:700;font-size:15px">${e(team.proj)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:2px;opacity:0.6">
          <span style="font-size:13px;color:#64748b">${e(team.org)} · ${e(team.name)}</span>
          <span style="font-size:13px;display:flex;align-items:center;gap:8px">
            <div class="spinner-small"></div>
            <span>Sincronizando...</span>
          </span>
        </div>
      `;
      return;
    }
    const sprintLabel = (sp?.path || 'Sprint\\Atual').split('\\').pop();
    
    el.innerHTML = `
      <div class="db-proj-name" style="font-weight:700;font-size:15px">${e(team.proj)}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
        <span style="font-size:13px;color:#64748b">${e(team.org)} · ${e(team.name)}</span>
        <span style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:4px">
          <span class="sprint-dot"></span>
          <span class="db-sprint-name">${e(sprintLabel)}</span>
        </span>
        ${(sp?.bizDaysLeft || 0) > 0 ? `<span class="days-pill">${sp.bizDaysLeft} dias</span>` : ''}
        ${data.syncedAt ? `<span style="font-size:11px;color:#94a3b8;margin-left:8px">Sincronizado: ${new Date(data.syncedAt).toLocaleString()}</span>` : ''}
      </div>
    `;

    // Sincroniza o dropdown legado (botão de avatar e menu)
    if (window.renderDashTeamSel) {
      window.renderDashTeamSel();
    }
  },

  renderKpis(data, isLoading) {
    const { stats: s } = data;
    const el = document.getElementById('db-kpis');
    if (!el) return;

    if (isLoading) {
      el.innerHTML = `<div class="kpi-grid">${[1,2,3,4,5,6,7].map(() => `
        <div class="kpi-card loading-skeleton" style="height:80px;display:flex;flex-direction:column;justify-content:center;align-items:center;">
          <div class="spinner-small" style="opacity:0.3"></div>
        </div>`).join('')}</div>`;
      return;
    }
    const kpis = [
      { l: 'Capacidade', v: (s.capacityTotal || 0) + 'h', tip: 'Carga horária total disponível' },
      { l: 'Total', v: s.total || 0, tip: 'Total de itens' },
      { l: 'Concluídos', v: s.done || 0, tip: 'Itens fechados' },
      { l: 'Progresso', v: (s.donePct || 0) + '%', tip: 'Percentual de entrega' },
      { l: 'Bloqueados', v: s.blocked || 0, al: (s.blocked || 0) > 0, tip: 'Itens impedidos' },
      { l: 'Bug fixing', v: s.fixing || 0, al: (s.fixing || 0) > 0, tip: 'Correções em andamento' },
      { l: 'Alocação', v: (s.allocPct || 0) + '%', al: (s.allocPct || 0) > 100, tip: 'Carga vs Disponibilidade' }
    ];
    el.innerHTML = `<div class="kpi-grid">${kpis.map(k => `
      <div class="kpi-card${k.al ? ' alert' : ''}">
        <div class="kpi-label">${k.l} <span class="kpi-tip"><i class="kpi-tip-icon">i</i><span class="kpi-tip-box">${k.tip}</span></span></div>
        <div class="kpi-val">${k.v}</div>
        <div class="kpi-sub">status da sprint</div>
      </div>`).join('')}</div>`;
  },

  renderBacklog(data, isLoading, isSortResult = false) {
    const { backlog, team } = data;
    const el = document.getElementById('db-backlog');
    if (!el) return;

    if (isLoading) {
      el.innerHTML = `
        <div class="mod-panel-header">
           <div style="display:flex;align-items:center;gap:10px">
             <h2 style="margin:0;font-size:18px">📌 Sprints backlog</h2>
             <div class="spinner-small" style="opacity:0.5"></div>
           </div>
        </div>
        <div style="padding:40px;text-align:center;color:#64748b;font-size:13px">Sincronizando itens do Azure...</div>
      `;
      return;
    }
    
    const e = this._e.bind(this);
    
    // Preservar o backlog original para ordenação data-driven
    // Sempre resetamos ao receber novos dados reais (não vindo de um sort)
    if (!isSortResult) {
      this._fullItems = [...backlog];
    }
    
    // Armazenamento para lazy loading
    this._lazyData = {
      items: [...this._fullItems],
      team,
      data,
      offset: 0,
      batchSize: 20
    };

    const initialItems = this._lazyData.items.splice(0, this._lazyData.batchSize);
    this._lazyData.offset = initialItems.length;
    
    let rows = initialItems.map(item => this._renderItemRow(item, team, data)).join('');


    el.innerHTML = `
      <div class="db-card">
        <div class="db-card-hdr">Backlog da Sprint (${this._fullItems.length})</div>
        <table class="bl-table">
          <thead><tr><th class="sort-th" onclick="DashboardBuilderInstance.sortBacklog(this)">Tipo</th><th class="sort-th" onclick="DashboardBuilderInstance.sortBacklog(this)">ID</th><th class="sort-th" onclick="DashboardBuilderInstance.sortBacklog(this)">Título</th><th class="sort-th" onclick="DashboardBuilderInstance.sortBacklog(this)">Status</th><th>Executores</th><th>Block</th><th class="sort-th" onclick="DashboardBuilderInstance.sortBacklog(this)">Progresso</th></tr></thead>
          <tbody id="bl-tbody">${rows}${this._lazyData.items.length > 0 ? '<tr id="bl-sentinel"><td colspan="7" style="height:20px;text-align:center;font-size:10px;color:#94a3b8;opacity:0.5">Carregando mais...</td></tr>' : ''}</tbody>
        </table>
      </div>`;

    if (this._lazyData.items.length > 0) {
      this._setupLazyObserver('bl-sentinel', 'bl-tbody');
    }
  },

  sortBacklog(th) {
    if (!this._fullItems) return;
    
    const ths = Array.from(th.closest('tr').querySelectorAll('th'));
    const colIdx = ths.indexOf(th);
    const isAsc = th.dataset.sort !== 'asc';
    
    ths.forEach(t => { delete t.dataset.sort; t.classList.remove('th-sort-asc', 'th-sort-desc'); });
    th.dataset.sort = isAsc ? 'asc' : 'desc';
    th.classList.add(isAsc ? 'th-sort-asc' : 'th-sort-desc');

    const props = ['type', 'id', 'title', 'state', '', '', 'prog'];
    const prop = props[colIdx];
    if (!prop) return;

    this._fullItems.sort((a, b) => {
      let va, vb;
      if (prop === 'prog') {
        va = a.estimativa > 0 ? (a.estimativa - a.childRem) / a.estimativa : 0;
        vb = b.estimativa > 0 ? (b.estimativa - b.childRem) / b.estimativa : 0;
      } else {
        va = a[prop];
        vb = b[prop];
      }
      
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();

      if (va < vb) return isAsc ? -1 : 1;
      if (va > vb) return isAsc ? 1 : -1;
      return 0;
    });

    // Atualizar o backlog no objeto de dados antes de re-renderizar
    const data = this._lazyData.data;
    data.backlog = [...this._fullItems];
    
    // Re-renderizar do topo informando que é resultado de sort
    this.renderBacklog(data, false, true);
  },

  _renderItemRow(item, team, data) {
    const e = this._e.bind(this);
    const id = String(item.id);
    const rc = item.blockStatus === 'BLOCKED' ? ' row-blocked' : item.blockStatus === 'FIXING' ? ' row-fixing' : '';
    const prog = item.estimativa > 0 ? Math.round(((item.estimativa - item.childRem) / item.estimativa) * 100) : 0;
    const azUrl = `https://dev.azure.com/${team.org}/${team.proj}/_workitems/edit/${id}`;
    const noTasks = (item.estimativa === 0 && item.state !== 'Closed') ? `<span class="no-tasks-warn">Não estimado</span>` : '';
    const sc = item.blockStatus === 'BLOCKED' ? 's-blocked' : (item.blockStatus === 'FIXING' ? 's-fixing' : (item.state === 'Closed' ? 's-done' : (item.state === 'Active' ? 's-doing' : 's-todo')));

    return `
      <tr class="bl-row${rc}" onclick="toggleCh('${id}')" style="cursor:pointer">
        <td>
          <span class="xicon" id="ico-${id}">▶</span>
          <span class="badge ${item.type==='Defect'?'badge-bug':'badge-pbi'}">${item.type==='Defect'?'Defect':'PBI'}</span>
        </td>
        <td><a href="${azUrl}" target="_blank" class="az-link">#${id}</a></td>
        <td class="title-cell">${e(item.title)} ${noTasks}</td>
        <td><span class="sb ${sc}">${e(item.state)}</span></td>
        <td class="exec-cell"><div class="avatar">U</div></td>
        <td class="text-center mono" id="blk-${id}">—</td>
        <td>
          <div style="width:60px">
            <div class="bl-prog-wrap" style="height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden">
              <div class="bl-prog-fill" style="width:${prog}%;height:100%;background:var(--blue)"></div>
            </div>
            <div class="bl-prog-lbl" style="font-size:9px;margin-top:2px">${prog}%</div>
          </div>
        </td>
      </tr>
      <tr class="children-row" id="cr-${id}" style="display:none">
        <td colspan="7">
          <div class="exp-wrapper">
            <div class="tl-subtle-wrap" style="margin-bottom:14px">
              <div class="tl-header-subtle" onclick="toggleTimeline(this,'${id}')" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;font-weight:600;color:#64748b;padding:4px 8px;border-radius:4px;background:#f1f5f9;transition:all 0.2s">
                <span>Board History</span> <span class="tl-chevron" style="font-size:9px">▶</span>
              </div>
              <div class="tl-track" style="padding:12px;font-size:11px;overflow-x:auto;align-items:center;gap:8px"></div>
            </div>
            <div class="exp-content">
              ${this._renderChildTasks(id, data)}
            </div>
          </div>
        </td>
      </tr>`;
  },

  _setupLazyObserver(sentinelId, tbodyId) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        this._appendBatch(sentinelId, tbodyId, observer);
      }
    }, { threshold: 0.1 });

    const sentinel = document.getElementById(sentinelId);
    if (sentinel) observer.observe(sentinel);
  },

  _appendBatch(sentinelId, tbodyId, observer) {
    const { items, team, data, batchSize } = this._lazyData;
    if (items.length === 0) {
      observer.disconnect();
      const s = document.getElementById(sentinelId);
      if (s) s.remove();
      return;
    }

    const nextBatch = items.splice(0, batchSize);
    const tbody = document.getElementById(tbodyId);
    const sentinel = document.getElementById(sentinelId);

    if (tbody && sentinel) {
      const temp = document.createElement('tbody');
      temp.innerHTML = nextBatch.map(item => this._renderItemRow(item, team, data)).join('');
      
      while (temp.firstChild) {
        tbody.insertBefore(temp.firstChild, sentinel);
      }

      if (items.length === 0) {
        observer.disconnect();
        sentinel.remove();
      }
    }
  },

  renderProgress(data, isLoading) {
    const el = document.getElementById('db-progress');
    if (!el) return;

    if (isLoading) {
      el.innerHTML = `
        <div class="mod-panel-header"><h2 style="margin:0;font-size:18px">🚀 Progresso</h2></div>
        <div style="padding:40px;text-align:center;color:#64748b;font-size:13px">Calculando velocity...</div>
      `;
      return;
    }

    const { stats: s } = data;
    const e = this._e.bind(this);
    
    const dayOffHtml = (s.dayOffCards || []).slice(0, 3).map(c => `
      <div class="dayoff-card">
        <div class="dayoff-date">${c.label}</div>
        <div class="dayoff-member">${e(c.member)} (${e(c.activity)})</div>
      </div>
    `).join('') || '<div class="empty-dayoff">Nenhum day-off programado</div>';

    el.innerHTML = `
      <div class="db-card">
        <div class="db-card-hdr">Progresso e Capacidade</div>
        <div style="padding:20px">
          <div class="prog-lbl">
            <span>Concluído</span>
            <span>${s.donePct}%</span>
          </div>
          <div class="pbar-wrap">
            <div class="pbar-fill" style="width:${s.donePct}%"></div>
          </div>
          
          <div class="vel-cards">
            <div class="vel-card">
              <div class="vel-label">Restante</div>
              <div class="vel-val">${s.totalRem}h</div>
            </div>
            <div class="vel-card">
              <div class="vel-label">Capacidade</div>
              <div class="vel-val">${s.capacityTotal}h</div>
            </div>
          </div>

          <div class="tasks-summary">
            <div class="tstat">
              <div class="vel-label">Em aberto</div>
              <div class="tstat-val">${s.totalTasksOpen}</div>
            </div>
            <div class="tstat">
              <div class="vel-label">Finalizadas</div>
              <div class="tstat-val">${s.totalTasksDone}</div>
            </div>
          </div>

          <div class="db-card-hdr" style="margin-top:20px;padding:0;font-size:11px;border:none">Próximos Day-offs</div>
          <div class="dayoff-cards">
            ${dayOffHtml}
          </div>
        </div>
      </div>`;
  },

  renderInsights(data, isLoading) {
    const el = document.getElementById('db-insights');
    if (!el) return;

    if (isLoading) {
      el.innerHTML = `<div style="padding:20px;text-align:center;opacity:0.5"><div class="spinner-small" style="margin:auto"></div></div>`;
      return;
    }
    el.innerHTML = `<div class="db-card"><div class="db-card-hdr">Insights</div><div class="insights-grid" style="padding:15px"><div class="ins-card">Analise IA</div></div></div>`;
  },

  _getMemberStats(name, data) {
    const tasks = data.tasks || [];
    const info = (data.capacity || {})[name] || { capRest: 0 };
    // Alinhado com a propriedade 'remaining' vinda do legado
    const allocated = tasks.filter(t => t.assignedTo === name).reduce((acc, t) => acc + (t.remaining || 0), 0);
    const total = (info.capRest || 0); // Capacidade restante total para o cálculo de alocação
    const pct = total > 0 ? Math.round((allocated / total) * 100) : 0;
    let color = 'var(--blue)'; // Default
    if (pct > 100) color = '#ef4444'; // Red
    else if (pct > 70) color = '#10b981'; // Green
    else color = '#f59e0b'; // Yellow (1-70)
    return { allocated, total, pct, color };
  },

  renderMembers(data, isLoading) {
    const el = document.getElementById('db-members');
    if (!el) return;

    if (isLoading) {
      el.innerHTML = `<div style="padding:15px;text-align:center;opacity:0.3"><div class="spinner-small" style="margin:auto"></div></div>`;
      return;
    }
    const { stats, backlog, tasks } = data;
    const e = this._e.bind(this);
    let rows = '', track = '';
    Object.entries(data.capacity || {}).forEach(([n, i]) => {
      const ms = this._getMemberStats(n, data);
      const isAcmp = /scrum master|product owner|tech leader|po|tech lead/i.test(i.activity);
      
      if (!isAcmp) {
        rows += `
          <tr class="mbr-row">
            <td><div style="font-weight:600">${e(n)}</div></td>
            <td><span style="color:#64748b;font-size:12px">${e(i.activity)}</span></td>
            <td>
              <div class="dist-bar-wrap">
                <div class="dist-bar-fill" style="width:${Math.min(ms.pct, 100)}%; background:${ms.color}"></div>
              </div>
              <div style="font-size:10px;margin-top:4px;color:#94a3b8">${ms.pct}% alocado (${ms.allocated}h / ${ms.total}h)</div>
            </td>
            <td style="font-weight:500;text-align:right">${i.capRest}h rest.</td>
          </tr>`;
      }
      
      if (isAcmp) track += `
        <div class="atrack">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${e(n)}</strong>
            <span class="badge badge-pbi" style="font-size:9px">${e(i.activity)}</span>
          </div>
        </div>`;
    });
    el.innerHTML = `
      <div class="mbr-section">
        <div class="db-card mbr-main">
          <div class="db-card-hdr">Membros</div>
          <table class="mbr-table">
            <thead>
              <tr><th>Membro</th><th>Papel</th><th>Carga de Trabalho</th><th style="text-align:right">Disponível</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="db-card mbr-side">
          <div class="db-card-hdr">Acompanhamento</div>
          <div class="tracking-list" style="padding:15px">${track}</div>
        </div>
      </div>`;
  },

  _renderChildTasks(parentId, data) {
    const tasks = (data.tasks || []).filter(t => String(t.parentId) === String(parentId));
    if (!tasks.length) return `<div style="font-size:12px;color:#94a3b8;font-style:italic">Nenhuma subtarefa encontrada.</div>`;
    
    const e = this._e.bind(this);
    const doing = tasks.filter(t => !['Closed', 'Done', 'Removed'].includes(t.state));
    const done = tasks.filter(t => ['Closed', 'Done'].includes(t.state));

    const renderCol = (title, list, cls) => `
      <div class="children-col">
        <div class="col-header ${cls}">${title} (${list.length})</div>
        <div class="cards-wrap">
          ${list.map(t => {
            const status = (t.state || '').toLowerCase();
            const sCls = status.includes('closed') || status.includes('done') ? 's-done' :
                        (status.includes('active') || status.includes('doing') || status.includes('progress') ? 's-doing' :
                        (status.includes('block') || status.includes('impediment') ? 's-blocked' : 
                        (status.includes('test') ? 's-fixing' : 's-todo')));
            
            return `
            <div class="task-card">
              <div class="tc-title">${e(t.title)}</div>
              <div class="tc-foot">
                <span class="sb ${sCls}">${e(t.state)}</span>
                <span class="tc-assigned">${e(t.assignedTo)}</span>
                <span class="tc-hours">${t.remaining}h</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;

    return `
      <div class="children-wrap">
        ${renderCol('Em andamento', doing, 'col-doing')}
        ${renderCol('Concluído', done, 'col-done')}
      </div>`;
  },

  async toggleTimeline(btn, itemId) {
    const wrap = btn.closest('.tl-subtle-wrap, .tl-card');
    if (!wrap) return;
    const track = wrap.querySelector('.tl-track');
    const chev = btn.querySelector('.tl-chevron');
    
    if (!wrap.dataset.tlLoaded) {
      if (chev) chev.textContent = '⏳';
      try {
        const team = window.Store.getActiveTeam();
        const pat = await window.Store.getActivePat();
        const revs = await window.legacy_EficienciaAPI.getRevisions(team.org, team.proj, String(itemId), pat);
        const result = this._buildColumnTimeline(revs);
        
        track.innerHTML = result.html;
        track.classList.add('open');
        
        if (result.totalBlockMs > 0) {
          const blkEl = document.getElementById('blk-' + itemId);
          if (blkEl) blkEl.innerHTML = `<span style="color:#dc2626;font-weight:700">${this._fmtBlockTime(result.totalBlockMs, result.totalBlockStartMs)}</span>`;
        }
      } catch (err) {
        console.error('Board History Error:', err);
        track.innerHTML = `<div style="padding:15px;color:#991b1b;font-size:11px;background:#fef2f2;border-radius:6px;width:100%">
          <strong>Histórico indisponível:</strong> O Azure DevOps retornou um erro (verifique seu PAT).
        </div>`;
      }
      wrap.dataset.tlLoaded = '1';
      track.classList.add('open');
      if (chev) chev.textContent = '▼';
      return;
    }
    
    const isOpen = track.classList.toggle('open');
    if (chev) chev.textContent = isOpen ? '▼' : '▶';
  },

  _fmtBlockTime(ms, startMs) {
    const h = ms / 3600000;
    if (h <= 8) return Math.round(h) + 'h';
    if (h < 24 && startMs) {
      const tod = new Date(); tod.setHours(0, 0, 0, 0);
      const yes = new Date(tod); yes.setDate(tod.getDate() - 1);
      const sd = new Date(startMs); sd.setHours(0, 0, 0, 0);
      if (sd.getTime() === tod.getTime()) return 'hoje';
      if (sd.getTime() === yes.getTime()) return 'ontem';
    }
    return Math.round(ms / 86400000) + 'd';
  },

  _buildColumnTimeline(revs) {
    if (!revs || !revs.length) return { html: '<div class="tl-loading">Sem histórico.</div>', totalBlockMs: 0 };
    const steps = [];
    let prevCol = '', prevDate = null;

    revs.forEach(rev => {
      const f = rev.fields || {};
      const col = f['System.BoardColumn'] || f['System.State'] || '';
      const at = f['System.ChangedDate'];
      const by = f['System.ChangedBy'];
      const who = typeof by === 'object' ? (by?.displayName || '') : String(by || '');
      if (!col) return;
      if (col !== prevCol) {
        if (prevCol && prevDate && at && steps.length) {
          const endDt = new Date(at);
          steps[steps.length - 1].days = Math.max(0, Math.round((endDt - new Date(prevDate)) / 86400000));
          steps[steps.length - 1].endDate = endDt;
        }
        steps.push({ col, startDate: at, enteredBy: who, days: null, isCurrent: false, endDate: null, blockMs: 0, blockStartMs: null });
        prevCol = col; prevDate = at;
      }
    });

    if (steps.length) {
      const last = steps[steps.length - 1];
      if (last.days === null) {
        const now = new Date();
        last.days = last.startDate ? Math.round((now - new Date(last.startDate)) / 86400000) : null;
        last.endDate = now;
        last.isCurrent = true;
      }
    }

    const blockIntervals = [];
    let blockStart = null;
    revs.forEach(rev => {
      const f = rev.fields || {};
      const b1 = f['Custom.Block'];
      const b2 = f['Custom.Blocked'];
      const b3 = f['Microsoft.VSTS.CMMI.Blocked'];
      const tags = String(f['System.Tags'] || '').toLowerCase();
      
      const isBlocked = (b1 === true || b1 === 'true' || b1 === 'True' || b1 === 'Yes') ||
                        (b2 === true || b2 === 'true' || b2 === 'True' || b2 === 'Yes') ||
                        (b3 === true || b3 === 'true' || b3 === 'True' || b3 === 'Yes') ||
                        tags.includes('blocked') || tags.includes('bloqueado') || tags.includes('block');
      
      const at = f['System.ChangedDate'];
      if (isBlocked && blockStart === null) { blockStart = at; }
      else if (!isBlocked && blockStart !== null) { blockIntervals.push({ start: new Date(blockStart), end: new Date(at) }); blockStart = null; }
    });
    if (blockStart !== null) blockIntervals.push({ start: new Date(blockStart), end: new Date() });

    steps.forEach(step => {
      if (!step.startDate || !step.endDate) return;
      const sS = new Date(step.startDate).getTime(), sE = step.endDate.getTime();
      blockIntervals.forEach(iv => {
        const os = Math.max(iv.start.getTime(), sS), oe = Math.min(iv.end.getTime(), sE);
        if (oe > os) { step.blockMs += (oe - os); if (step.blockStartMs === null) step.blockStartMs = os; }
      });
    });

    const totalBlockMs = blockIntervals.reduce((s, iv) => s + (iv.end.getTime() - iv.start.getTime()), 0);
    const totalBlockStartMs = blockIntervals.length ? blockIntervals[0].start.getTime() : null;

    const fmtD = d => { if (!d) return ''; const dt = new Date(d); return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
    const html = steps.map((s, i) => {
      return `<div class="tl-step${s.isCurrent ? ' tl-current' : ''}">
        <div class="tl-col-name">${s.col}</div>
        <div class="tl-days">${s.days !== null ? s.days + 'd' : '—'}</div>
        <div class="tl-date">${fmtD(s.startDate)}</div>
        ${s.blockMs > 0 ? `<div class="tl-block" style="color:#ef4444;font-size:9px;display:flex;align-items:center;justify-content:center;gap:3px">${ICONS.lock} <span>${this._fmtBlockTime(s.blockMs, s.blockStartMs)}</span></div>` : ''}
      </div>${i < steps.length - 1 ? '<div class="tl-arrow">›</div>' : ''}`;
    }).join('');

    return { html, totalBlockMs, totalBlockStartMs };
  }
};

