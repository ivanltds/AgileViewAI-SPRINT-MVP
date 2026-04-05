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
    if (!backlog || backlog.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Calcula os totais baseados nos itens do backlog (Original Estimate vs Completed Work / Remaining)
    let totalEstimate = 0;
    let totalRemaining = 0;
    const memberStats = {};

    backlog.forEach(item => {
      const f = item.fields || {};
      const est = f['Microsoft.VSTS.Scheduling.OriginalEstimate'] || 0;
      const rem = f['Microsoft.VSTS.Scheduling.RemainingWork'] || 0;
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
        <div style="margin-bottom: 16px;">
          <h3 style="margin-bottom: 8px; color: var(--slate);">Progresso da Sprint</h3>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--gray); margin-bottom:4px;">
            <span>${progressPct}% Concluído</span>
            <span>${Helpers.formatHours(totalRemaining)} restantes de ${Helpers.formatHours(totalEstimate)}</span>
          </div>
          <div style="background:var(--border); height:8px; border-radius:4px; overflow:hidden;">
            <div style="background:var(--blue); width:${progressPct}%; height:100%; transition:width 0.3s;"></div>
          </div>
        </div>

        <h4 style="margin-bottom: 12px; color: var(--slate); font-size:14px;">Alocação de Membros</h4>
        <div class="members-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
    `;

    // Renderiza cada membro
    Object.values(memberStats).forEach(m => {
      if (m.estimate === 0 && m.name === 'Não Atribuído') return;
      
      const mDone = m.estimate - m.remaining;
      const mPct = m.estimate > 0 ? Math.round((mDone / m.estimate) * 100) : 0;
      const initials = Helpers.initials(m.name);
      
      // Cor de alerta se remaining for > capacity alocada (simplificado aqui para visual)
      const barColor = mPct > 100 ? 'var(--red)' : 'var(--blue)';

      html += `
        <div class="member-card" style="border:1px solid var(--border); border-radius:8px; padding:12px; display:flex; gap:12px; align-items:center; background:#fff;">
          <div style="width:36px; height:36px; border-radius:50%; background:var(--blue-l); color:var(--blue-d); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px;">
            ${initials}
          </div>
          <div style="flex:1;">
            <div style="font-size:13px; font-weight:600; color:var(--slate); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${m.name}">${m.name}</div>
            <div style="font-size:11px; color:var(--gray); margin-bottom:4px;">${Helpers.formatHours(m.remaining)} rest. / ${Helpers.formatHours(m.estimate)} cap.</div>
            <div style="background:var(--border); height:4px; border-radius:2px; overflow:hidden;">
              <div style="background:${barColor}; width:${Math.min(mPct, 100)}%; height:100%;"></div>
            </div>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  }
};
