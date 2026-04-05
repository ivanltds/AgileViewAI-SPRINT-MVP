import { Store } from '../core/store.js';
import { LLMAPI } from '../core/llm-api.js';

export const AGENT_DEFAULTS = {
  a1: `Você é um Agile Master sênior comprometido com a entrega do projeto.
Analise os dados de Sprint, Eficiência e Qualidade fornecidos e gere de 6 a 10 insights.
FORMATO: retorne SOMENTE um array JSON válido, sem markdown externo:
[{"severity":"critical|warning|info|ok","icon":"emoji","title":"Título com emoji","body":"2-3 frases com nomes e números reais."}]

SEVERIDADES:
critical 🚨 — risco real de não entrega; sobrecarga >110% NÃO justificada; bugs críticos sem resolução
warning  ⚠️ — 80-110% individual; bloqueios; fixing sem resolução; lead time alto; bugs High abertos
info     💡 — tendência histórica, oportunidade, padrão identificado nos dados
ok       ✅ — ponto positivo, melhoria observada, conformidade

Cubra: riscos de entrega, capacidade, bloqueios, qualidade e tendências de eficiência.
Use dados dos 3 módulos quando disponíveis. Cite sempre nomes e números reais.
NUNCA sugira redistribuição entre papéis diferentes (Dev ≠ QA ≠ Data Scientist).
CONSOLIDE todos os membros sobrecarregados em 1 único card critical.`,

  a2: `Você é um Agile Master criterioso revisando insights gerados por outro agente.
FORMATO: retorne SOMENTE o array JSON revisado, sem markdown externo.

Ao revisar, você deve:
1. REMOVER itens duplicados ou muito semelhantes — mantenha o mais completo e específico
2. AGRUPAR insights relacionados em um único card mais rico com todos os dados
3. VALIDAR se os números e métricas citados são coerentes entre si
4. CORRIGIR severity se incorreta (não marcar como critical o que é apenas warning)
5. MANTER entre 4 e 7 insights de alta qualidade

Não invente dados novos. Trabalhe apenas com o que foi fornecido.`,

  a3: `Você é um Agile Master comunicativo reescrevendo insights para máximo impacto e clareza.
FORMATO: retorne SOMENTE o array JSON reescrito, sem markdown externo.

Para cada card, aplique o tom adequado à severidade:
- critical 🚨: urgente e direto — destaque o risco e a ação necessária imediatamente
- warning  ⚠️: alerta construtivo com proposta de ação clara
- info     💡: consultivo e orientado a melhoria contínua
- ok       ✅: positivo e encorajador — reconheça o que está funcionando bem

Mantenha a estrutura JSON exata. Body: 2-3 frases claras, acionáveis e com dados específicos do time.
Não altere severity nem icon. Apenas reescreva title e body.`
};

export const InsightsService = {
  async call(provider, token, systemPrompt, userPrompt) {
    return LLMAPI.call(provider, token, systemPrompt, userPrompt);
  },

  async runAgentChain(provider, token, userPrompt, onProgress) {
    const saved = Store.getAgentPrompts();
    const sys1 = saved.a1 || AGENT_DEFAULTS.a1;
    const sys2 = saved.a2 || AGENT_DEFAULTS.a2;
    const sys3base = saved.a3 || AGENT_DEFAULTS.a3;

    const stored = Store.getUserProfile();
    const profileLevel = stored.level || 'neutral';
    const profileInstr = {
      technical: 'PERFIL DO USUÁRIO: Técnico — use linguagem técnica, termos ágeis precisos e métricas sem simplificações.',
      didactic:  'PERFIL DO USUÁRIO: Didático — explique termos técnicos com analogias e exemplos práticos acessíveis.',
      neutral:   'PERFIL DO USUÁRIO: Equilibrado — balance clareza e precisão técnica, evite excesso de jargões.'
    }[profileLevel] || '';
    const sys3 = sys3base + (profileInstr ? `\n\n${profileInstr}` : '');

    onProgress?.('Agente 1 — Gerando insights…', 1);
    const raw1 = await this.call(provider, token, sys1, userPrompt);

    onProgress?.('Agente 2 — Revisando e deduplicando…', 2);
    const raw2 = await this.call(provider, token, sys2,
      `Revise e consolide os seguintes insights gerados:\n${raw1}`);

    onProgress?.('Agente 3 — Reescrevendo com tom adequado…', 3);
    const raw3 = await this.call(provider, token, sys3,
      `Reescreva os seguintes insights com o tom adequado a cada severidade e ao perfil do usuário:\n${raw2}`);

    return raw3;
  },

  async callQA(provider, token, fullPrompt) {
    return LLMAPI.callQA(provider, token, fullPrompt);
  },

  parseJson(raw) {
    return LLMAPI.parseJson(raw);
  },

  buildSystemPrompt() {
    return `Você é um Agile Master sênior fazendo análise integrada de Sprint, Eficiência e Qualidade.
FORMATO: retorne SOMENTE um array JSON válido, sem markdown externo:
[{"severity":"critical|warning|info|ok","icon":"emoji","title":"Título com emoji","body":"2-3 frases com nomes e números reais."}]

Você recebe dados de 3 módulos. Correlacione-os quando relevante:
- Sprint sobrecarregada + lead time alto = risco composto
- Bugs críticos abertos + capacidade no limite = ameaça à entrega
- Throughput caindo + fixing crescendo = problema de qualidade sistêmico

SEVERIDADES:
critical 🚨 — sobrecarga individual >110% NÃO justificada pelo contexto; bugs críticos sem prazo; risco real de não entrega
warning  ⚠️ — 80-110% individual; bloqueios; fixing; lead time acima de 2x o histórico; bugs High abertos
info     💡 — tendência, padrão, oportunidade de melhoria com base nos dados históricos
ok       ✅ — conformidade, ritmo equilibrado, melhora de indicadores

REGRAS IMPORTANTES:
- NUNCA sugerir redistribuição entre papéis diferentes (Back End ≠ QA)
- Sobrecarga >100% = rem > cap de um membro específico
- NÃO gere insight de risco baseado apenas em totais agregados
- Gere 5 a 7 insights cobrindo os 3 módulos. Cite nomes e números reais.
- CONSOLIDE todos os membros sobrecarregados em 1 único card critical.
- Verifique o contexto do time ANTES de gerar critical/warning.
- Se dados de Eficiência ou Qualidade não estiverem disponíveis, foque nos dados da Sprint.`;
  },

  buildUserPrompt(stats, capacity, byActivity, ragContext, tasks, backlog, efData, qualData) {
    const s = stats;
    const memberLines = Object.keys(capacity).map(m => {
      const c = capacity[m], bm = s.byMember?.[m] || { remaining:0, tasksDone:0 };
      const alloc = c.capRest>0 ? Math.round((bm.remaining/c.capRest)*100) : 0;
      return `  ${m} | ${c.activity} | cap=${c.capRest}h | rem=${bm.remaining}h | done=${bm.tasksDone} tasks | alocação=${alloc}%`;
    }).join('\n');

    const actLines = Object.keys(byActivity).map(act => {
      const a = byActivity[act];
      const cd = s.bizDays>0?(a.capRest/s.bizDays).toFixed(1):'0';
      const rd = s.bizDays>0?(a.remaining/s.bizDays).toFixed(1):'0';
      const al = a.capRest>0?Math.round((a.remaining/a.capRest)*100):0;
      return `  ${act} | cap_dia=${cd}h | ritmo_dia=${rd}h | rem_total=${a.remaining}h | membros=${a.members} | alocação=${al}%`;
    }).join('\n');

    const taskLines = (() => {
      if (!tasks?.length) return '';
      const open = tasks.filter(t=>t.state!=='Done').slice(0,60);
      const doneC = tasks.filter(t=>t.state==='Done');
      return `Tasks abertas (${open.length}):\n`+
        open.map(t=>`  [${t.state}] #${t.id} — ${t.title} | resp=${t.assignedTo||'não atribuído'}${t.remaining>0?' | '+t.remaining+'h rem':''}${t.blockStatus&&t.blockStatus!=='CLEAR'?' | ⚠ '+t.blockStatus:''}`).join('\n')+
        `\nTasks concluídas: ${doneC.length}`;
    })();

    const backlogLines = (backlog||[]).slice(0,40).map(b=>{
      const flag = b.blockStatus==='BLOCKED'?' 🚫BLOCKED':b.blockStatus==='FIXING'?' 🔧FIXING':'';
      const noBreak = (b._childCount===0)?' ⚠SEM_QUEBRA':'';
      const est = b.estimativa>0?` | est=${b.estimativa}h`:'';
      const rem = b.childRem>0?` | rem=${b.childRem}h`:'';
      return `  [${b.state}] #${b.id} — ${b.title} | resp=${b.assignedTo||'—'}${est}${rem}${flag}${noBreak}`;
    }).join('\n');

    const overloaded=[], highAlloc=[], lowAlloc=[], idle=[];
    Object.keys(capacity).forEach(m=>{
      const c=capacity[m], bm=s.byMember?.[m]||{remaining:0};
      const pct=c.capRest>0?Math.round((bm.remaining/c.capRest)*100):0;
      const line=`  → ${m} (${c.activity}): alocação=${pct}% (rem=${bm.remaining}h, cap=${c.capRest}h)`;
      if(pct>100) overloaded.push(line); else if(pct>=70) highAlloc.push(line); else if(pct>0) lowAlloc.push(line); else idle.push(line);
    });
    let alertLines = 'ALERTAS POR MEMBRO:\n';
    if(overloaded.length) alertLines+=`🚨 SOBRECARREGADOS (>100%) — CONSOLIDE EM 1 CARD:\n${overloaded.join('\n')}\n`;
    if(highAlloc.length)  alertLines+=`✅ SAUDÁVEL (70-100%):\n${highAlloc.join('\n')}\n`;
    if(lowAlloc.length)   alertLines+=`⚠️ OCIOSOS (<70%):\n${lowAlloc.join('\n')}\n`;
    if(idle.length)       alertLines+=`⚠️ SEM TASKS (0%):\n${idle.join('\n')}\n`;

    const macroInterp = s.totalRem < s.capacityTotal
      ? `FOLGA — remaining (${s.totalRem}h) < capacidade (${s.capacityTotal}h). NÃO há risco de não entrega no agregado.`
      : `ATENÇÃO — remaining (${s.totalRem}h) >= capacidade (${s.capacityTotal}h).`;

    // ── Efficiency section
    let efSection = '';
    if (efData) {
      const ef = efData;
      const recentSprints = (ef.iterLabels || []).slice(-5);
      const sprintRows = recentSprints.map(k => {
        const it = ef.byIter[k] || {};
        const lt = it.leadTimes?.length ? (it.leadTimes.reduce((a,b)=>a+b,0)/it.leadTimes.length).toFixed(1) : '—';
        const ct = it.cycleTimes?.length ? (it.cycleTimes.reduce((a,b)=>a+b,0)/it.cycleTimes.length).toFixed(1) : '—';
        return `  ${k}: ${it.count||0} itens | Lead=${lt}d | Cycle=${ct}d | Velocity=${Math.round(it.velocity||0)}h`;
      }).join('\n');
      const topCols = Object.entries(ef.colTimes||{})
        .map(([col,v]) => ({ col, avg: v.count>0 ? v.total/v.count : 0, count: v.count }))
        .sort((a,b) => b.avg - a.avg)
        .slice(0,5)
        .map(c => `  ${c.col}: ${c.avg.toFixed(1)}d avg (${c.count} amostras)`)
        .join('\n');
      efSection = `\n=== MÓDULO EFICIÊNCIA (${recentSprints.length} sprint(s) analisadas) ===\n`+
        `Throughput médio: ${ef.avgThroughput} itens/sprint | Lead Time médio: ${ef.avgLeadTime}d | Cycle Time médio: ${ef.avgCycleTime}d | Bugs abertos: ${ef.openBugs}\n`+
        `\nPor sprint:\n${sprintRows||'  (sem dados)'}\n`+
        `\nGargalos do board (tempo médio por coluna):\n${topCols||'  (sem dados)'}\n`;
    }

    // ── Quality section
    let qualSection = '';
    if (qualData && qualData.items?.length) {
      const _isDoneQ = s => { const sl=(s||'').toLowerCase(); return sl==='done'||sl==='closed'||sl==='resolved'||sl==='concluído'||sl==='completed'; };
      const qi = qualData.items;
      const qOpen   = qi.filter(i => !_isDoneQ(i.fields['System.State']));
      const qClosed = qi.filter(i =>  _isDoneQ(i.fields['System.State']));
      const qBugs   = qi.filter(i => i.fields['System.WorkItemType']==='Bug');
      const qDef    = qi.filter(i => i.fields['System.WorkItemType']==='Defect');
      const monthAgo = Date.now() - 30*86400000;
      const last30  = qi.filter(i => { const cd=i.fields['System.CreatedDate']; return cd && new Date(cd).getTime()>=monthAgo; }).length;
      const avgResQ = arr => {
        const vals = arr.filter(i=>_isDoneQ(i.fields['System.State'])).map(i=>{
          const cd=i.fields['Microsoft.VSTS.Common.ClosedDate'], cr=i.fields['System.CreatedDate'];
          if(!cd||!cr) return null; const d=Math.round((new Date(cd)-new Date(cr))/86400000); return d>=0?d:null;
        }).filter(v=>v!==null);
        return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
      };
      const sevCt = (arr, s) => arr.filter(i => String(i.fields['Microsoft.VSTS.Common.Severity']||'').startsWith(s+' ')).length;
      const openBySev = `Critical:${sevCt(qOpen,'1')} High:${sevCt(qOpen,'2')} Medium:${sevCt(qOpen,'3')} Low:${sevCt(qOpen,'4')}`;
      const totalRemQ = qOpen.reduce((a,i)=>a+(Number(i.fields['Microsoft.VSTS.Scheduling.RemainingWork'])||0),0);
      const tgo = qualData.tempoGasto || {};
      const top3Q = [...qi].sort((a,b)=>(tgo[b.id]||0)-(tgo[a.id]||0)).slice(0,3)
        .map(i=>`  #${i.id} [${i.fields['System.WorkItemType']}] ${(i.fields['System.Title']||'').substring(0,55)} | tempo=${tgo[i.id]||0}h | sev=${i.fields['Microsoft.VSTS.Common.Severity']||'—'} | state=${i.fields['System.State']||'—'}`).join('\n');
      qualSection = `\n=== MÓDULO QUALIDADE ===\n`+
        `Total: ${qBugs.length} Bugs + ${qDef.length} Defects = ${qi.length} itens\n`+
        `Abertos: ${qOpen.length} | Fechados: ${qClosed.length} | Criados últimos 30 dias: ${last30}\n`+
        `Tempo médio resolução Bug: ${avgResQ(qBugs)===null?'—':avgResQ(qBugs)+'d'} | Defect: ${avgResQ(qDef)===null?'—':avgResQ(qDef)+'d'}\n`+
        `Estimativa total (h gastas): ${qualData.horasGastas!=null?qualData.horasGastas+'h':'—'} | Remaining Work (abertos): ${totalRemQ}h\n`+
        `Severidade dos abertos — ${openBySev}\n`+
        `\nTop 3 por tempo gasto:\n${top3Q||'  (sem dados)'}\n`;
    }

    return `DADOS DA SPRINT:\nDias úteis restantes: ${s.bizDays}\n`+
      `PBIs: total=${s.total} | concluídos=${s.done} (${s.donePct}%) | em_progresso=${s.inProgress} | bloqueados=${s.blocked} | fixing=${s.fixing}\n`+
      `Tasks: abertas=${s.totalTasksOpen} | finalizadas=${s.totalTasksDone}\n\n`+
      `DIAGNÓSTICO MACRO:\n  Remaining total: ${s.totalRem}h | Capacidade total: ${s.capacityTotal}h | Alocação: ${s.allocPct}%\n  ▶ ${macroInterp}\n  ⚠ NÃO gere insight de risco de não entrega baseado apenas nos totais.\n\n`+
      (ragContext?`CONTEXTO DO TIME (leia ANTES dos dados — tem prioridade):\n${'-'.repeat(40)}\n${ragContext}\n${'-'.repeat(40)}\n\n`:'')+
      alertLines+'\n'+
      `Capacidade por MEMBRO:\n${memberLines||'  (sem dados)'}\n\n`+
      `Capacidade por ATIVIDADE:\n${actLines||'  (sem dados)'}\n\n`+
      `Backlog:\n${backlogLines||'  (sem dados)'}\n\n`+
      `Tarefas:\n${taskLines||'  (sem dados)'}\n`+
      efSection+
      qualSection+
      `\nResponda SOMENTE com o JSON array.`;
  }
};

export const InsightsValidator = {
  validate(insights, stats, capacity, ragContext) {
    const s = stats;
    const ragLow = (ragContext||'').toLowerCase();

    // Pre-calc member alloc
    const memberAlloc = {};
    Object.keys(capacity).forEach(m => {
      const c  = capacity[m];
      const bm = s.byMember?.[m] || { remaining:0 };
      const alloc = c.capRest>0 ? Math.round((bm.remaining/c.capRest)*100) : 0;
      memberAlloc[m] = { alloc, cap:c.capRest, rem:bm.remaining, activity:c.activity||'—' };
    });

    const TREATED = ['próxima sprint','proxima sprint','já tratado','ja tratado','alinhado','mapeado','planejado','sendo tratado','está tratando','esta tratando','negociado'];

    let r0Fired = false;
    let validated = insights.map(ins => {
      if (!ins) return null;
      const result = { ...ins };
      const bl = ((ins.body||'')+(ins.title||'')).toLowerCase();

      // R0: rem < cap + no member cited → fix to "folga"
      if (result.severity === 'critical' || result.severity === 'warning') {
        const citaMembro = Object.keys(capacity).some(m => bl.includes(m.split(' ')[0].toLowerCase()));
        if (!citaMembro && s.totalRem < s.capacityTotal) {
          if (!r0Fired) {
            const folga = Math.round(((s.capacityTotal-s.totalRem)/s.capacityTotal)*100);
            result.severity = 'info'; result.icon = 'info';
            result.title = 'Capacidade com folga';
            result.body  = `Remaining total (${s.totalRem}h) < capacidade (${s.capacityTotal}h) — há ${folga}% de folga no agregado. Risco real = sobrecarga individual, não falta de capacidade.`;
            r0Fired = true;
          } else { return null; }
        }
      }

      // R1: critical total/equipe, no member, allocPct < 100 → info
      if (result.severity === 'critical') {
        const mentTot = bl.includes('total')||bl.includes('equipe')||bl.includes('time');
        const mentMem = Object.keys(capacity).some(m => bl.includes(m.split(' ')[0].toLowerCase()));
        if (mentTot && !mentMem && s.allocPct < 100) { result.severity='info'; result.icon='info'; }
      }

      // R2: critical, no one >100% → warning
      if (result.severity === 'critical') {
        const noOneOver = Object.keys(memberAlloc).every(m => memberAlloc[m].alloc <= 100);
        const isBlock = bl.includes('bloqueado')||bl.includes('blocked');
        if (noOneOver && !isBlock) { result.severity='warning'; }
      }

      // R3: RAG treats situation → ok (unless real overload)
      if (result.severity === 'critical' || result.severity === 'warning') {
        const isRealOver = Object.keys(memberAlloc).some(m => {
          const fn=m.split(' ')[0].toLowerCase(), ln=m.split(' ').pop().toLowerCase();
          return (bl.includes(fn)||bl.includes(ln)) && memberAlloc[m].alloc > 100;
        });
        if (!isRealOver) {
          Object.keys(capacity).forEach(m => {
            const fn=m.split(' ')[0].toLowerCase(), ln=m.split(' ').pop().toLowerCase();
            if (bl.includes(fn)||bl.includes(ln)) {
              let idx = ragLow.indexOf(ln); if (idx===-1) idx=ragLow.indexOf(fn);
              if (idx !== -1) {
                const slice = ragLow.substring(Math.max(0,idx-200), idx+200);
                if (TREATED.some(kw=>slice.includes(kw))) { result.severity='ok'; result.icon='ok'; }
              }
            }
          });
        }
      }

      // R5: ok/info + member cited with <70% → warning
      if (result.severity === 'ok' || result.severity === 'info') {
        const idle = [];
        Object.keys(memberAlloc).forEach(m => {
          const fn=m.split(' ')[0].toLowerCase(), ln=m.split(' ').pop().toLowerCase();
          const cited=bl.includes(fn)||bl.includes(ln)||(ins.title||'').toLowerCase().includes(fn);
          if (cited && memberAlloc[m].alloc<70 && memberAlloc[m].cap>0) idle.push(`${m} (${memberAlloc[m].alloc}%)`);
        });
        if (idle.length) {
          result.severity='warning'; result.icon='warning';
          result.body += ` Atenção: ${idle.join(', ')} com alocação abaixo de 70% — verificar tasks não estimadas.`;
        }
      }
      return result;
    });

    // R8: members <70% not covered → inject warning per role
    (() => {
      const idleByRole = {};
      Object.keys(memberAlloc).forEach(m => {
        if (memberAlloc[m].cap<=0 || memberAlloc[m].alloc>=70) return;
        const fn=m.split(' ')[0].toLowerCase(), ln=m.split(' ').pop().toLowerCase();
        const covered = validated.some(ins => {
          if(!ins||ins.severity==='ok') return false;
          const bl=((ins.body||'')+(ins.title||'')).toLowerCase();
          return bl.includes(fn)||bl.includes(ln);
        });
        if (!covered) { const r=memberAlloc[m].activity||'—'; if(!idleByRole[r]) idleByRole[r]=[]; idleByRole[r].push(m); }
      });
      Object.keys(idleByRole).forEach(role => {
        const members=idleByRole[role];
        const det=members.map(m=>`${m} (${memberAlloc[m].alloc}%, rem=${memberAlloc[m].rem}h, cap=${memberAlloc[m].cap}h)`).join(', ');
        const add=`${det} abaixo de 70% em ${role} — verificar tasks não estimadas ou oportunidade de adiantar refinamento.`;
        const rl=role.toLowerCase();
        const ex=validated.find(ins=>ins&&ins.severity!=='ok'&&ins.severity!=='critical'&&((ins.body||'')+(ins.title||'')).toLowerCase().includes(rl.split(' ')[0]));
        if (ex) { ex.body+=' | Também: '+add; ex.severity='warning'; ex.icon='warning'; }
        else validated.push({ severity:'warning',icon:'warning',section:'opportunity',title:`Baixa utilização em ${role}`,body:add });
      });
    })();

    let clean = validated.filter(i=>i!=null);

    // R6: members >100% not mentioned → complement or create critical card
    const omitted=[];
    Object.keys(memberAlloc).forEach(m=>{
      if(memberAlloc[m].alloc<=100) return;
      const fn=m.split(' ')[0].toLowerCase(), ln=m.split(' ').pop().toLowerCase();
      const mentioned=clean.some(ins=>(((ins.body||'')+(ins.title||'')).toLowerCase()).includes(fn)||(((ins.body||'')+(ins.title||'')).toLowerCase()).includes(ln));
      if(!mentioned) omitted.push(m);
    });
    if (omitted.length) {
      const byAct={};
      omitted.forEach(m=>{ const a=memberAlloc[m].activity||'—'; if(!byAct[a]) byAct[a]=[]; byAct[a].push(m); });
      const addedText=Object.keys(byAct).map(a=>a+': '+byAct[a].map(m=>`${m} (${memberAlloc[m].alloc}%, rem=${memberAlloc[m].rem}h, cap=${memberAlloc[m].cap}h)`).join(', ')).join(' | ');
      const overIdx=clean.findIndex(i=>i.severity==='critical');
      if(overIdx!==-1) clean[overIdx].body+=' | Também: '+addedText+'.';
      else clean.unshift({ severity:'critical',icon:'critical',section:'overload',title:'Alertas de Sobrecarga',body:addedText+' — sem membros ociosos no mesmo papel. Negociar escopo com o PO.' });
    }

    // R7: multiple criticals → merge into 1
    const crits=clean.filter(i=>i.severity==='critical');
    if(crits.length>1){
      const merged=crits.map(i=>(i.title||'').trim()+': '+(i.body||'')).join(' | ');
      clean=clean.filter(i=>i.severity!=='critical');
      clean.unshift({ severity:'critical',icon:'critical',section:'overload',title:'Alertas de Sobrecarga',body:merged });
    }

    // Dedup by title
    const seen={};
    return clean.filter(i=>{ const k=(i.title||'').toLowerCase().replace(/\s+/g,' ').trim(); if(seen[k]) return false; seen[k]=true; return true; });
  },

  localFallback(stats, capacity, byActivity) {
    const s=stats; const out=[];
    const over=Object.keys(capacity).filter(m=>{ const bm=s.byMember?.[m]||{remaining:0}; return capacity[m].capRest>0&&(bm.remaining/capacity[m].capRest)>1.1; });
    if(over.length) out.push({ severity:'critical',icon:'critical',title:'Sobrecarga de membros',body:`${over.length} membro(s) acima de 110%: ${over.slice(0,3).join(', ')}${over.length>3?'...':''}. Redistribua tarefas.` });
    if(s.blocked>0) out.push({ severity:'critical',icon:'critical',title:'Bloqueios ativos',body:`${s.blocked} PBI(s) bloqueado(s). Priorize desbloqueio imediato.` });
    if(s.fixing>0)  out.push({ severity:'warning',icon:'warning',title:'Itens em correção',body:`${s.fixing} item(ns) em fixing. Analise a causa raiz.` });
    if(s.allocPct>100) out.push({ severity:'warning',icon:'warning',title:'Capacidade excedida',body:`Demanda (${s.totalRem}h) supera capacidade (${s.capacityTotal}h) em ${s.allocPct-100}%.` });
    else if(s.allocPct<60&&s.allocPct>0) out.push({ severity:'info',icon:'info',title:'Capacidade subutilizada',body:`Apenas ${s.allocPct}% alocado. Há espaço para incluir mais itens.` });
    if(s.donePct>=70) out.push({ severity:'ok',icon:'ok',title:'Ritmo saudável',body:`${s.done} de ${s.total} PBIs concluídos (${s.donePct}%). Caminho certo!` });
    else if(s.done===0&&s.bizDays<3) out.push({ severity:'critical',icon:'critical',title:'Entregas em risco',body:`Nenhum PBI concluído com ${s.bizDays} dias úteis restantes. Revisão urgente.` });
    else out.push({ severity:'info',icon:'info',title:'Progresso da sprint',body:`${s.done} de ${s.total} PBIs concluídos (${s.donePct}%). ${s.totalTasksDone} tasks finalizadas.` });
    return out.slice(0,6);
  }
};
