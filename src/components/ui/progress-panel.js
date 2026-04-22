/**
 * AgileViewAI UI Components: Progress Panel
 * Exibe o progresso geral da sprint e alocação de membros.
 */

import { Helpers } from '../../utils/helpers.js';

export const ProgressPanel = {
  /**
   * Renderiza o painel de progresso no container.
   * @param {Element} container - O elemento de destino.
   * @param {Array<Object>} backlog - Lista de itens.
   * @param {Object} capacityInfo - Informações de capacidade da iteração.
   */
  render(container, backlog, capacityInfo) {
    if (!container) return;
    if (!backlog || backlog.length === 0) {
      container.innerHTML = '';
      return;
    }

    const _cap = capacityInfo || {};

    // Calcula os totais baseados nos itens do backlog (Original Estimate vs Completed Work / Remaining)
    let totalEstimate = 0;
    let totalRemaining = 0;
    const memberStats = {};

    backlog.forEach(item => {
      const f = item.fields || {};
      const est = f['Microsoft.VSTS.Scheduling.OriginalEstimate'] || item.estimativa || 0;
      const rem = f['Microsoft.VSTS.Scheduling.RemainingWork'] || item.childRem || 0;
      const assigned = f['System.AssignedTo'] ? f['System.AssignedTo'].displayName : 'Não Atribuído';
      
      totalEstimate += est;
      totalRemaining += rem;

      if (!memberStats[assigned]) {
        memberStats[assigned] = { estimate: 0, remaining: 0, name: assigned };
      }
      memberStats[assigned].estimate += est;
      memberStats[assigned].remaining += rem;
    });

    const totalDone = totalEstimate - totalRemaining;
    const progressPct = totalEstimate > 0 ? Math.round((totalDone / totalEstimate) * 100) : 0;

    let html = `
      <div class="progress-section" style="padding: 16px 24px;">
        <div style="margin-bottom: 24px;">
          <h3 style="margin-bottom: 8px; color: var(--slate); font-size: 15px; font-weight: 700;">Progresso da Sprint</h3>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--gray); margin-bottom:6px;">
            <span style="font-weight:600; color:var(--blue);">${progressPct}% Concluído</span>
            <span>${Helpers.formatHours(totalRemaining)} restantes de ${Helpers.formatHours(totalEstimate)}</span>
          </div>
          <div style="background:#e2e8f0; height:10px; border-radius:5px; overflow:hidden;">
            <div style="background:linear-gradient(90deg, var(--blue), #60a5fa); width:${progressPct}%; height:100%; transition:width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
          </div>
        </div>

        <h3 style="margin-bottom: 12px; color: var(--slate); font-size: 15px; font-weight: 700;">Distribuição por Responsável</h3>
        <div class="dist-table-wrap">
          <table class="dist-table">
            <thead>
              <tr>
                <th>Membro</th>
                <th style="text-align:center">Cap. Rest.</th>
                <th style="text-align:center">Rem. Work</th>
                <th>Alocação</th>
                <th style="text-align:right">% Alocado</th>
              </tr>
            </thead>
            <tbody>
    `;

    const avatarColors = ['#1d4ed8','#7c3aed','#059669','#d97706','#dc2626','#0891b2'];
    
    let rowsTeam = '';
    let rowsAcmp = '';

    // Renderiza cada membro
    Object.values(memberStats).forEach(m => {
      if (m.estimate === 0 && m.name === 'Não Atribuído') return;
      
      const capM = _cap[m.name] || {};
      const capRest = capM.capRest || 0;
      const mPct = capRest > 0 ? Math.round((m.remaining / capRest) * 100) : (m.estimate > 0 ? Math.round((m.remaining / m.estimate) * 100) : 0);
      
      const initials = Helpers.initials(m.name);
      const color = avatarColors[Math.abs(m.name.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)) % avatarColors.length];
      const act = capM.activity || 'Desenvolvedor';
      
      let barClass = '';
      if (mPct > 100) barClass = 'over';
      else if (mPct > 85) barClass = 'warn';
      const acColor = mPct > 100 ? 'var(--red)' : mPct >= 85 ? 'var(--amber)' : 'var(--blue)';

      const rowHtml = `
        <tr>
          <td>
            <div class="dist-name">
              <div class="dist-avt" style="background:${color}">${initials}</div>
              <span>${m.name}</span>
            </div>
            <div style="font-size:11px;color:var(--gray)">${act}</div>
          </td>
          <td class="text-center mono" style="font-size:12px;color:var(--slate)">
            ${Helpers.formatHours(capRest)}h
          </td>
          <td class="text-center mono rem-col" style="font-weight:600">
            ${Helpers.formatHours(m.remaining)}h
          </td>
          <td>
            <div class="dist-bar-wrap">
              <div class="dist-bar ${barClass}" style="width:${Math.min(mPct, 100)}%;"></div>
            </div>
          </td>
          <td style="text-align:right">
            <span class="dist-pct" style="color:${acColor}">${mPct}%</span>
          </td>
        </tr>
      `;

      const isAcmp = /scrum master|product owner|tech leader/i.test(act);
      if (isAcmp) {
        rowsAcmp += `
          <div style="display:flex; align-items:center; gap:10px; background:#f8fafc; border:1px solid var(--border); border-radius:30px; padding:6px 16px 6px 6px;">
            <div class="dist-avt" style="background:${color}">${initials}</div>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600; color:var(--slate); font-size:12px; line-height:1.2;">${m.name}</span>
              <span style="font-size:10px; color:var(--gray);">${act}</span>
            </div>
          </div>
        `;
      } else {
        rowsTeam += rowHtml;
      }
    });

    if (rowsAcmp.length > 0) {
      let acmpSection = `
        <h4 style="margin-bottom: 12px; color: var(--slate); font-size: 14px; font-weight: 600;">Acompanhamento da sprint</h4>
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px;">
          ${rowsAcmp}
        </div>
      `;
      html = html.replace('Distribuição por Responsável</h3>', 'Distribuição por Responsável</h3>' + acmpSection);
    }

    html += rowsTeam;
    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }
};
