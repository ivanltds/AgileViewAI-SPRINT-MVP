//  insights_engine.gs  —  Geração de insights via LLM
//
//  Função pública: generateInsights(stats, capacity, byActivity)
//  Retorna array de { severity, icon, title, body }
//  severity: "critical" | "warning" | "info" | "ok"
// ============================================================

// ── Cores por severidade ─────────────────────────────────────
var SEVERITY_STYLES = {
  critical: { bg:"#fff1f2", border:"#fecdd3", titleColor:"#be123c" },
  warning:  { bg:"#fffbeb", border:"#fde68a", titleColor:"#92400e" },
  info:     { bg:"#eff6ff", border:"#bfdbfe", titleColor:"#1e40af" },
  ok:       { bg:"#f0fdf4", border:"#bbf7d0", titleColor:"#14532d" }
};

// ── Sistema de prompts separados ─────────────────────────────
// SYSTEM PROMPT: instruções fixas, imutáveis, alta prioridade
// USER PROMPT: dados variáveis da sprint atual
function _buildSystemPrompt() {
  return (
    "Você é um Agile Master sênior responsável por analisar a saúde da sprint e a capacidade do time de desenvolvimento.\n" +
    "Sua análise deve ser pragmática, baseada em dados reais e respeitar as especialidades técnicas de cada membro.\n\n" +

    "## REGRAS INVIOLÁVEIS DE ANÁLISE\n\n" +

    "### 1. LIMITES DE ALOCAÇÃO\n" +
    "- Sobrecarga (risco de atraso): % alocado ACIMA de 100%\n" +
    "- Alocação saudável: entre 70% e 100%\n" +
    "- Ociosidade / baixa utilização: ABAIXO de 70%\n\n" +

    "### 2. REGRA DE OURO — SKILL MATCHING\n" +
    "- NUNCA sugira transferir tarefas entre membros de papéis (Atividade) diferentes.\n" +
    "- Developer Front End NÃO pode assumir tasks de Back End, Data Science ou Quality Analyst, e vice-versa.\n" +
    "- Redistribuição só é solução válida se houver outro membro com a MESMA Atividade com ociosidade (<70%).\n" +
    "- Se não há membro ocioso no mesmo papel, a solução é negociação de escopo, não redistribuição.\n\n" +

    "### 3. DIAS OFF E AUSÊNCIAS\n" +
    "- Verifique a cap. restante de cada membro. Se houver 'off: DD/MM', destaque como risco de capacidade do papel.\n" +
    "- Calcule o impacto real: se o membro sobrecarregado tem day off, o risco é ainda maior.\n\n" +

    "### 4. CONTEXTO DO TIME — PRIORIDADE MÁXIMA\n" +
    "- O contexto específico do time sobrepõe qualquer análise genérica.\n" +
    "- Se o contexto menciona que uma situação está tratada/alinhada, gere insight 'ok', não alerta.\n" +
    "- Respeite acordos documentados no contexto mesmo que os números pareçam indicar problema.\n\n" +

    "### 5. ANÁLISE POR MEMBRO — NUNCA POR TOTAIS\n" +
    "- Sobrecarga e ociosidade são INDIVIDUAIS. Nunca compare soma de rem vs soma de cap.\n" +
    "- Se rem_total < cap_total, isso indica folga no agregado — não é risco de entrega.\n\n" +

    "## FORMATO DE SAÍDA OBRIGATÓRIO\n" +
    "Retorne SOMENTE um array JSON. Sem markdown, sem texto fora do JSON.\n" +
    "Agrupe os insights nas seguintes seções — use o campo 'section' para identificar:\n" +
    '[{"severity":"critical|warning|info|ok","section":"overload|opportunity|risk|conformity","icon":"emoji","title":"Título com emoji","body":"2-3 frases. Citar membro, papel, % alocado, rem e cap reais. Se redistribuição, só sugerir se houver membro OCIOSO do MESMO papel."}]\n\n' +

    "## SEVERIDADES\n" +
    "- critical 🚨: alocação >100% sem justificativa no contexto do time\n" +
    "- warning  ⚠️: alocação <70% (ociosidade), day off com impacto, fixing/bloqueio ativo\n" +
    "- info     💡: folga agregada, oportunidade de otimização, observação de padrão\n" +
    "- ok       ✅: alocação 70-100%, situação tratada pelo contexto, conformidade\n\n" +

    "## ESTRUTURA DE SAÍDA ESPERADA\n" +
    "1. 🚨 Alerta de Sobrecarga — EXATAMENTE 1 card consolidando TODOS os membros >100% de TODOS os papéis\n" +
    "   Formato do body: liste cada membro com papel, %, rem e cap. Agrupe por papel dentro do mesmo body.\n" +
    "   Se não há membros >100%, omita este card.\n" +
    "2. 💡 Oportunidades de Otimização — ociosidade por papel (<70%), respeitando skill matching\n" +
    "3. ⚠️ Riscos e Ausências — days off com impacto na capacidade\n" +
    "4. ✅ Conformidade — papéis com alocação saudável (70-100%)\n\n" +

    "## EXEMPLOS CORRETOS\n" +
    '[\n' +
    '  {"severity":"critical","section":"overload","icon":"🚨","title":"🚨 Alertas de Sobrecarga",\n' +
    '   "body":"Back End: Vinicius Piovesan (117%, rem=56h, cap=48h) — sem outro Back End ocioso, negociar escopo com PO. | Data Science: Aimê Gomes (104%, rem=50h, cap=48h) e Anísio Pereira (104%, rem=50h, cap=48h) — sem Data Scientist ocioso para redistribuição, priorizar backlog."},\n' +
    '  {"severity":"warning","section":"opportunity","icon":"💡","title":"💡 Baixa utilização em Front End",\n' +
    '   "body":"Lucas Maia (10%, rem=5h, cap=48h) e Lucas Seguessi (35%, rem=17h, cap=48h) abaixo de 70%. Há 74h ociosas em Front End — verificar tasks não estimadas ou adiantar refinamento."},\n' +
    '  {"severity":"ok","section":"conformity","icon":"✅","title":"✅ QA em acompanhamento",\n' +
    '   "body":"Karen Souza (54%) abaixo do ideal. Conforme contexto, atuará em refinamentos — monitorar alocação no Azure."}\n' +
    ']\n\n' +

    "## CHECKLIST ANTES DE RETORNAR\n" +
    "□ Todos os membros >100% estão em UM ÚNICO card de sobrecarga? → Se não, consolide.\n" +
    "□ Todas as sugestões de redistribuição respeitam skill matching (mesmo papel)?\n" +
    "□ Membros <70% identificados por papel com sugestão válida?\n" +
    "□ Days off com impacto destacados?\n" +
    "□ Algum critical/warning contradiz o contexto do time? → Rebaixe para ok.\n" +
    "□ Algum insight compara totais agregados? → Reescreva por membro.\n" +
    "Somente após esta checagem, retorne o JSON."
  );
}

// ── Ponto de entrada: chamado pelo dashboard (síncrono, legado) ─
function generateInsights(stats, capacity, byActivity, tasks, backlog) {
  var llm = getActiveLlm();
  var rag = getActiveRagContext();
  var insights;
  if (llm && llm.token) {
    try {
      insights = _callLlm(llm, stats, capacity, byActivity, rag, tasks, backlog);
    } catch (e) {
      Logger.log("LLM error: " + e.message);
      insights = _localInsights(stats, capacity, byActivity);
      insights.unshift({ severity:"warning", icon:"⚠️", title:"⚠️ LLM indisponível",
        body:"Não foi possível conectar ao " + llm.provider + ". Análise local em uso. Erro: " + e.message.substring(0,120) });
    }
  } else {
    insights = _localInsights(stats, capacity, byActivity);
  }
  return _renderInsightCards(insights);
}

// ── Função assíncrona: recebe payload codificado em base64 ────
function callLlmWithData(payloadB64) {
  try {
    var llm = getActiveLlm();
    if (!llm || !llm.token) {
      return _renderInsightCards([{
        severity: "warning", icon: "⚠️", title: "⚠️ LLM não configurado",
        body: "Cadastre um token em: AgileViewAI → IA & Configurações → Configurar tokens de LLM."
      }]);
    }

    var rag = getActiveRagContext();

    // Decodifica payload — se não vier, lê da planilha como fallback
    var stats, capacity, byActivity, tasks, backlog;
    if (payloadB64) {
      try {
        var json    = Utilities.base64Decode(payloadB64, Utilities.Charset.UTF_8);
        var payload = JSON.parse(json);
        stats      = payload.stats;
        capacity   = payload.capacity;
        byActivity = payload.byActivity;
        tasks      = payload.tasks   || [];
        backlog    = payload.backlog || [];
      } catch(decErr) {
        Logger.log("callLlmWithData: payload decode falhou, lendo planilha. " + decErr.message);
        payloadB64 = null;
      }
    }
    if (!payloadB64) {
      var ss   = SpreadsheetApp.getActiveSpreadsheet();
      var data = _collectDashboardData(ss, readConfig(ss));
      stats      = data.stats;
      capacity   = data.capacity;
      byActivity = data.stats.byActivity || {};
      tasks      = data.tasks  || [];
      backlog    = data.backlog || [];
    }

    var insights = _callLlm(llm, stats, capacity, byActivity, rag, tasks, backlog);
    insights = _validateInsights(insights, stats, capacity, rag);
    return _renderInsightCards(insights);

  } catch(e) {
    Logger.log("callLlmWithData error: " + e.message + "\n" + e.stack);
    return _renderInsightCards([{
      severity: "warning", icon: "⚠️", title: "⚠️ Erro ao gerar insights",
      body: e.message.substring(0, 300)
    }]);
  }
}

// ── Validação determinística — zero LLM, zero alucinação ─────
// Aplica regras fixas em código sobre os insights gerados.
// Só rebaixa severidade quando a regra é violada com certeza.
function _validateInsights(insights, stats, capacity, ragContext) {
  if (!insights || insights.length === 0) return insights;

  // Pré-computa alocação real por membro
  var memberAlloc = {};
  Object.keys(capacity).forEach(function(m) {
    var c   = capacity[m];
    var bm  = stats.byMember && stats.byMember[m] ? stats.byMember[m] : { remaining: 0 };
    var pct = c.capRest > 0 ? Math.round((bm.remaining / c.capRest) * 100) : 0;
    memberAlloc[m] = { alloc: pct, cap: c.capRest, rem: bm.remaining, activity: c.activity || "" };
  });

  // Extrai nomes mencionados no contexto do time (para checar se situação está tratada)
  var ragLower = ragContext ? ragContext.toLowerCase() : "";
  var regra0Fired = false; // Regra 0 só dispara uma vez

  var validated = insights.map(function(ins) {
    var bodyLow = (ins.body || "").toLowerCase();
    var result  = { severity: ins.severity, icon: ins.icon, title: ins.title, body: ins.body };

    // ── REGRA 0: verificação matemática pura — executa PRIMEIRO, só uma vez ──────
    // rem < cap = não há risco de entrega no agregado. Qualquer insight critical/warning
    // sem citar membro específico é matematicamente errado. Sobrescreve título e body.
    if (!regra0Fired && (result.severity === "critical" || result.severity === "warning")) {
      var citaMembroR0 = Object.keys(capacity).some(function(m) {
        return bodyLow.indexOf(m.split(" ")[0].toLowerCase()) !== -1;
      });
      if (!citaMembroR0 && stats.totalRem < stats.capacityTotal) {
        var folga0 = Math.round(((stats.capacityTotal - stats.totalRem) / stats.capacityTotal) * 100);
        result.severity = "info";
        result.icon     = "💡";
        result.title    = "💡 Capacidade com folga";
        result.body     = "O remaining total (" + stats.totalRem + "h) é menor que a capacidade " +
          "disponível (" + stats.capacityTotal + "h) — há " + folga0 + "% de folga. " +
          "Não há risco de não entrega no agregado. Verifique se há trabalho não estimado " +
          "ou considere adiantar itens da próxima sprint.";
        regra0Fired = true;
        Logger.log("R0 CORRIGIU (rem=" + stats.totalRem + " < cap=" + stats.capacityTotal + "): " + ins.title);
        return result;
      }
    } else if (regra0Fired && (result.severity === "critical" || result.severity === "warning")) {
      // Regra 0 já disparou — se este insight também não cita membro e é sobre totais, descarta
      var citaMembroR0b = Object.keys(capacity).some(function(m) {
        return bodyLow.indexOf(m.split(" ")[0].toLowerCase()) !== -1;
      });
      if (!citaMembroR0b && stats.totalRem < stats.capacityTotal) {
        Logger.log("R0 DESCARTOU duplicata de capacidade com folga: " + ins.title);
        return null; // marcado para remoção
      }
    }

    // ── REGRA 1: critical por comparação de totais sem membro, allocPct < 100% ───
    if (result.severity === "critical") {
      var mentionsTotal  = (bodyLow.indexOf("total") !== -1 || bodyLow.indexOf("equipe") !== -1 || bodyLow.indexOf("time") !== -1);
      var mentionsMember = Object.keys(capacity).some(function(m) {
        return bodyLow.indexOf(m.split(" ")[0].toLowerCase()) !== -1;
      });
      if (mentionsTotal && !mentionsMember && stats.allocPct < 100) {
        result.severity = "info";
        result.icon     = "📊";
        Logger.log("R1 rebaixou para info (totais sem membro, allocPct<100%): " + ins.title);
      }
    }

    // ── REGRA 2: critical sem nenhum membro >100% nos dados ─────────────────────
    if (result.severity === "critical") {
      var foundOverloaded = Object.keys(memberAlloc).some(function(m) {
        return bodyLow.indexOf(m.split(" ")[0].toLowerCase()) !== -1 && memberAlloc[m].alloc > 100;
      });
      var nooneOver100 = Object.keys(memberAlloc).every(function(m) { return memberAlloc[m].alloc <= 100; });
      if (nooneOver100 && !foundOverloaded && bodyLow.indexOf("bloqueado") === -1 && bodyLow.indexOf("blocked") === -1) {
        result.severity = "warning";
        Logger.log("R2 rebaixou critical → warning (nenhum membro >100%): " + ins.title);
      }
    }

    // ── REGRA 3: RAG trata a situação — mas NUNCA rebaixa sobrecarga individual ───
    if (result.severity === "critical" || result.severity === "warning") {
      var isRealOverload = Object.keys(memberAlloc).some(function(m) {
        var fn = m.split(" ")[0].toLowerCase();
        var ln = m.split(" ").pop().toLowerCase();
        return (bodyLow.indexOf(fn) !== -1 || bodyLow.indexOf(ln) !== -1) && memberAlloc[m].alloc > 100;
      });      if (!isRealOverload) {
        var TREATED = ["próxima sprint","proxima sprint","já tratado","ja tratado",
                       "alinhado","mapeado","planejado","sendo tratado",
                       "está tratando","esta tratando","negociado"];
        Object.keys(capacity).forEach(function(m) {
          var fn = m.split(" ")[0].toLowerCase();
          var ln = m.split(" ").pop().toLowerCase();
          if (bodyLow.indexOf(fn) !== -1 || bodyLow.indexOf(ln) !== -1) {
            var ragIdx = ragLower.indexOf(ln);
            if (ragIdx === -1) ragIdx = ragLower.indexOf(fn);
            if (ragIdx !== -1) {
              var slice = ragLower.substring(Math.max(0, ragIdx-200), ragIdx+200);
              if (TREATED.some(function(kw){ return slice.indexOf(kw) !== -1; })) {
                result.severity = "ok";
                result.icon     = "✅";
                Logger.log("R3 → ok (RAG trata situação de " + m + "): " + ins.title);
              }
            }
          }
        });
      } else {
        Logger.log("R3 MANTEVE " + result.severity + " (sobrecarga individual >100%): " + ins.title);
      }
    }

    // ── REGRA 5: ok/info citando membro com alocação <70% → warning ─────────────
    // Não depende de palavras-chave: checa diretamente se o membro citado está ocioso.
    if (result.severity === "ok" || result.severity === "info") {
      var idleInCard = [];
      Object.keys(memberAlloc).forEach(function(m) {
        var fn = m.split(" ")[0].toLowerCase();
        var ln = m.split(" ").pop().toLowerCase();
        var citado = bodyLow.indexOf(fn) !== -1 || bodyLow.indexOf(ln) !== -1 ||
                     (ins.title || "").toLowerCase().indexOf(fn) !== -1;
        if (citado && memberAlloc[m].alloc < 70 && memberAlloc[m].cap > 0) {
          idleInCard.push(m + " (" + memberAlloc[m].alloc + "%)");
        }
      });
      if (idleInCard.length > 0) {
        result.severity = "warning";
        result.icon     = "⚠️";
        result.body     = result.body +
          " Atenção: " + idleInCard.join(", ") + " com alocação abaixo de 70% — " +
          "verificar tasks não estimadas ou work oculto no mesmo papel.";
        Logger.log("R5 → warning (membro <70% no card): " + idleInCard.join(", "));
      }
    }

    return result;
  });

  // ── REGRA 8: membros <70% não cobertos em NENHUM warning ─────────────────────
  // Roda após o map. Agrupa ociosos por papel e injeta/atualiza card de warning.
  // Independe de palavras-chave — usa os dados diretamente.
  (function() {
    var idleByRole = {};
    Object.keys(memberAlloc).forEach(function(m) {
      if (memberAlloc[m].cap <= 0 || memberAlloc[m].alloc >= 70) return;
      // Verifica se este membro já está coberto em algum card warning/info
      var fn = m.split(" ")[0].toLowerCase();
      var ln = m.split(" ").pop().toLowerCase();
      var covered = validated.some(function(ins) {
        if (!ins || ins.severity === "ok") return false;
        var bl = ((ins.body || "") + (ins.title || "")).toLowerCase();
        return bl.indexOf(fn) !== -1 || bl.indexOf(ln) !== -1;
      });
      if (!covered) {
        var role = memberAlloc[m].activity || "—";
        if (!idleByRole[role]) idleByRole[role] = [];
        idleByRole[role].push(m);
      }
    });

    if (Object.keys(idleByRole).length === 0) return;

    // Para cada papel com ociosos não cobertos, tenta encontrar card existente do papel
    Object.keys(idleByRole).forEach(function(role) {
      var members  = idleByRole[role];
      var roleLow  = role.toLowerCase();
      var details  = members.map(function(m) {
        return m + " (" + memberAlloc[m].alloc + "%, rem=" + memberAlloc[m].rem + "h, cap=" + memberAlloc[m].cap + "h)";
      }).join(", ");
      var addition = details + " abaixo de 70% em " + role +
                     " — verificar tasks não estimadas ou oportunidade de adiantar refinamento.";

      // Procura card existente que mencione o papel
      var existing = null;
      validated.forEach(function(ins) {
        if (!ins || ins.severity === "ok" || ins.severity === "critical") return;
        var bl = ((ins.body || "") + (ins.title || "")).toLowerCase();
        if (bl.indexOf(roleLow) !== -1 || bl.indexOf(role.split(" ")[0].toLowerCase()) !== -1) {
          existing = ins;
        }
      });

      if (existing) {
        existing.body     = existing.body + " | Também: " + addition;
        existing.severity = "warning";
        existing.icon     = "⚠️";
        Logger.log("R8 complementou card existente para " + role + ": " + details);
      } else {
        validated.push({
          severity: "warning", icon: "⚠️", section: "opportunity",
          title:    "⚠️ Baixa utilização em " + role,
          body:     addition
        });
        Logger.log("R8 injetou card para " + role + ": " + details);
      }
    });
  })();

  // ── REGRA 6: consolida sobrecarga em 1 card + complementa omitidos ───────────
  var validatedClean = validated.filter(function(ins){ return ins !== null && ins !== undefined; });

  // Encontra o índice do card de sobrecarga existente (section=overload ou critical sem membro)
  var overloadIdx = -1;
  validatedClean.forEach(function(ins, i) {
    if (ins.severity === "critical" && overloadIdx === -1) overloadIdx = i;
  });

  // Detecta membros >100% omitidos em TODOS os cards
  var omitted = [];
  Object.keys(memberAlloc).forEach(function(m) {
    if (memberAlloc[m].alloc <= 100) return;
    var fn = m.split(" ")[0].toLowerCase();
    var ln = m.split(" ").pop().toLowerCase();
    var mentioned = validatedClean.some(function(ins) {
      var bl = (ins.body || "").toLowerCase() + (ins.title || "").toLowerCase();
      return bl.indexOf(fn) !== -1 || bl.indexOf(ln) !== -1;
    });
    if (!mentioned) omitted.push(m);
  });

  if (omitted.length > 0) {
    // Agrupa omitidos por papel para o texto
    var byAct = {};
    omitted.forEach(function(m) {
      var act = memberAlloc[m].activity || (capacity[m] ? capacity[m].activity : "—");
      if (!byAct[act]) byAct[act] = [];
      byAct[act].push(m);
    });
    var addedText = Object.keys(byAct).map(function(act) {
      return act + ": " + byAct[act].map(function(m) {
        return m + " (" + memberAlloc[m].alloc + "%, rem=" + memberAlloc[m].rem + "h, cap=" + memberAlloc[m].cap + "h)";
      }).join(", ");
    }).join(" | ");

    if (overloadIdx !== -1) {
      // Complementa o card de sobrecarga existente
      validatedClean[overloadIdx].body = validatedClean[overloadIdx].body +
        " | Também: " + addedText + ".";
      Logger.log("R6 complementou card existente com: " + addedText);
    } else {
      // Nenhum card de sobrecarga — cria 1 único card consolidado
      validatedClean.unshift({
        severity: "critical", icon: "🚨", section: "overload",
        title:    "🚨 Alertas de Sobrecarga",
        body:     addedText + " — sem membros ociosos no mesmo papel para redistribuição. Negociar escopo com o PO."
      });
      Logger.log("R6 criou card consolidado: " + addedText);
    }
  }

  // ── REGRA 7: consolida múltiplos cards critical em 1 único ───────────────────
  // Se o LLM gerou mais de 1 card critical (ignorou a instrução de consolidar),
  // mescla todos em 1 card com o body concatenado por " | ".
  var criticals = validatedClean.filter(function(ins){ return ins.severity === "critical"; });
  if (criticals.length > 1) {
    var mergedBody = criticals.map(function(ins) {
      // Extrai o contexto do título (ex: "Sobrecarga em Back End" → "Back End")
      var label = (ins.title || "").replace(/🚨\s*/g, "").trim();
      return label + ": " + (ins.body || "");
    }).join(" | ");

    // Remove todos os criticals e insere 1 consolidado no início
    validatedClean = validatedClean.filter(function(ins){ return ins.severity !== "critical"; });
    validatedClean.unshift({
      severity: "critical", icon: "🚨", section: "overload",
      title:    "🚨 Alertas de Sobrecarga",
      body:     mergedBody
    });
    Logger.log("R7 consolidou " + criticals.length + " cards críticos em 1.");
  }

  // ── DEDUPLICAÇÃO: remove títulos repetidos ────────────────────────────────────
  var seen  = {};
  var dedup = [];
  validatedClean.forEach(function(ins) {
    var key = (ins.title || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen[key]) { seen[key] = true; dedup.push(ins); }
    else { Logger.log("Dedup removeu: " + ins.title); }
  });
  return dedup;
}

// ── Pergunta livre ao LLM ─────────────────────────────────────
function askQuestionWithData(question) {
  if (!question || typeof question !== "string" || !question.trim()) {
    return _renderInsightCards([{ severity:"info", icon:"💡",
      title:"💡 Pergunta vazia",
      body:"Digite uma pergunta antes de enviar." }]);
  }
  try {
    var llm = getActiveLlm();
    if (!llm || !llm.token) {
      return _renderInsightCards([{ severity:"warning", icon:"⚠️",
        title:"⚠️ LLM não configurado",
        body:"Cadastre um token em: AgileViewAI → IA & Configurações." }]);
    }

    // Lê dados frescos da planilha — evita problema de payload corrompido no HTML
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var cfg  = readConfig(ss);
    var data = _collectDashboardData(ss, cfg);

    if (!data.activeSprint) {
      return _renderInsightCards([{ severity:"warning", icon:"⚠️",
        title:"⚠️ Sem sprint ativa",
        body:"Faça uma sincronização antes de usar o chat." }]);
    }

    var rag      = getActiveRagContext();
    var stats    = data.stats;
    var capacity = data.capacity;
    var byAct    = stats.byActivity || {};

    var roleCount = {};
    Object.keys(capacity).forEach(function(m) {
      var r = capacity[m].activity || "—";
      roleCount[r] = (roleCount[r] || 0) + 1;
    });
    var roleCountLine = Object.keys(roleCount).map(function(r){
      return r + ": " + roleCount[r];
    }).join(" | ");

    var kpiLines =
      "PBIs: total=" + stats.total + " | concluídos=" + stats.done + " (" + stats.donePct + "%)" +
      " | em_progresso=" + stats.inProgress + " | bloqueados=" + stats.blocked + " | fixing=" + stats.fixing + "\n" +
      "Tasks: abertas=" + stats.totalTasksOpen + " | finalizadas=" + stats.totalTasksDone + "\n" +
      "Remaining total: " + stats.totalRem + "h | Capacidade total: " + stats.capacityTotal + "h\n" +
      "Alocação geral: " + stats.allocPct + "% | Dias úteis restantes: " + stats.bizDays;

    var actLines = Object.keys(byAct).map(function(act) {
      var a = byAct[act];
      var alloc = a.capRest > 0 ? Math.round((a.remaining / a.capRest) * 100) : 0;
      return act + ": " + a.members + " membro(s) | cap=" + a.capRest + "h | rem=" + a.remaining + "h | " + alloc + "%";
    }).join("\n");

    var memberLines = Object.keys(capacity).map(function(m) {
      var c  = capacity[m];
      var bm = stats.byMember && stats.byMember[m] ? stats.byMember[m] : { remaining:0, tasksDone:0 };
      var alloc  = c.capRest > 0 ? Math.round((bm.remaining / c.capRest) * 100) : 0;
      var status = alloc > 100 ? "SOBRECARREGADO" : alloc < 70 ? "OCIOSO" : "SAUDAVEL";
      return m + " | " + c.activity + " | cap=" + c.capRest + "h | rem=" + bm.remaining +
             "h | " + alloc + "% (" + status + ") | tasks_done=" + bm.tasksDone +
             (c.daysOffStr && c.daysOffStr !== "—" ? " | off=" + c.daysOffStr : "");
    }).join("\n");

    var macroInterp = stats.totalRem < stats.capacityTotal
      ? "FOLGA — remaining (" + stats.totalRem + "h) < capacidade (" + stats.capacityTotal +
        "h). NÃO há risco de não entrega no agregado. Risco real = sobrecarga individual."
      : "ATENÇÃO — remaining (" + stats.totalRem + "h) >= capacidade (" + stats.capacityTotal + "h).";

    var fullPrompt =
      "Você é um Agile Master. Analise os dados abaixo e responda a pergunta.\n\n" +
      "FORMATO OBRIGATÓRIO — responda SOMENTE com este JSON (1 objeto em array):\n" +
      '[{"severity":"info","icon":"💡","title":"titulo direto","body":"resposta em ate 3 frases com dados reais"}]\n\n' +
      "severity pode ser: info, ok, warning, critical\n\n" +
      "⚠️ INTERPRETAÇÃO DE CAPACIDADE (leia antes de responder):\n" +
      macroInterp + "\n\n" +
      "=== COMPOSIÇÃO DO TIME POR PAPEL ===\n" + roleCountLine + "\n\n" +
      "=== KPIs DA SPRINT ===\n" + kpiLines + "\n\n" +
      "=== ALOCAÇÃO POR TIPO DE ATIVIDADE ===\n" + (actLines || "(sem dados)") + "\n\n" +
      "=== ALOCAÇÃO INDIVIDUAL ===\n" + memberLines + "\n\n" +
      (rag ? "=== CONTEXTO DO TIME ===\n" + rag + "\n\n" : "") +
      "=== PERGUNTA ===\n" + String(question).trim() + "\n\n" +
      "Responda agora com o JSON array:";

    var raw        = _callLlmQA(llm, fullPrompt);
    var normalized = raw.trim();
    if (normalized.charAt(0) === '{') normalized = '[' + normalized + ']';
    var insights = _parseInsightJson(normalized);
    var ins = insights[0];

    // Aplica Regra 0: se rem < cap e o card diz "risco" sem citar membro → corrige
    if (ins && (ins.severity === "critical" || ins.severity === "warning")) {
      var bl = ((ins.body || "") + (ins.title || "")).toLowerCase();
      var citaMembro = Object.keys(capacity).some(function(m) {
        return bl.indexOf(m.split(" ")[0].toLowerCase()) !== -1;
      });
      if (!citaMembro && stats.totalRem < stats.capacityTotal) {
        var folga = Math.round(((stats.capacityTotal - stats.totalRem) / stats.capacityTotal) * 100);
        ins.severity = "info";
        ins.icon     = "💡";
        ins.body     = ins.body + " (Nota: remaining=" + stats.totalRem + "h < capacidade=" +
                       stats.capacityTotal + "h — há " + folga + "% de folga no agregado. " +
                       "O risco real é a sobrecarga individual, não falta de capacidade total.)";
      }
    }

    return _renderInsightCards([ins]);

  } catch(e) {
    Logger.log("askQuestionWithData ERRO: " + e.message + "\n" + (e.stack||""));
    return _renderInsightCards([{
      severity: "warning", icon: "⚠️",
      title:    "⚠️ Erro ao responder",
      body:     e.message ? e.message.substring(0, 300) : "Erro desconhecido. Veja o Logger."
    }]);
  }
}



// ── Legado: fetchInsightsAsync (mantido por compatibilidade) ─
function fetchInsightsAsync() {
  try {
    var ss   = SpreadsheetApp.getActiveSpreadsheet();
    var cfg  = readConfig(ss);
    var data = _collectDashboardData(ss, cfg);
    if (!data.activeSprint) return '<div class="insight-error">Nenhuma sprint ativa.</div>';
    return generateInsights(data.stats, data.capacity, data.stats.byActivity, data.tasks, data.backlog);
  } catch(e) {
    return '<div class="insight-error">Erro: ' + e.message.substring(0,200) + '</div>';
  }
}

// ── Chamada ao LLM com system + user separados ────────────────
function _callLlm(llm, stats, capacity, byActivity, ragContext, tasks, backlog) {
  var systemPrompt = _buildSystemPrompt();
  var userPrompt   = _buildUserPrompt(stats, capacity, byActivity, ragContext, tasks, backlog);
  var raw = _callLlmRaw(llm, systemPrompt, userPrompt);
  return _parseInsightJson(raw);
}

// ── Executor de chamada baixo nível (system + user) ───────────
function _callLlmRaw(llm, systemPrompt, userPrompt) {
  if (llm.provider === "claude")  return _callClaude(llm.token,  systemPrompt, userPrompt);
  if (llm.provider === "openai")  return _callOpenAI(llm.token,  systemPrompt, userPrompt);
  if (llm.provider === "gemini")  return _callGemini(llm.token,  systemPrompt, userPrompt);
  throw new Error("Provider desconhecido: " + llm.provider);
}

// ── Chamada dedicada ao Q&A — força JSON e usa mensagem única ─
function _callLlmQA(llm, fullPrompt) {
  if (llm.provider === "claude") {
    var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post", contentType: "application/json",
      headers: { "x-api-key": llm.token, "anthropic-version": "2023-06-01" },
      payload: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        temperature: 0.1,
        messages: [{ role: "user", content: fullPrompt }]
      }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200)
      throw new Error("Claude QA HTTP " + resp.getResponseCode() + ": " + resp.getContentText().substring(0,200));
    var d = JSON.parse(resp.getContentText());
    return d.content && d.content[0] ? d.content[0].text : "";
  }
  if (llm.provider === "openai") {
    var resp = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
      method: "post", contentType: "application/json",
      headers: { "Authorization": "Bearer " + llm.token },
      payload: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 800,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: fullPrompt }]
      }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200)
      throw new Error("OpenAI QA HTTP " + resp.getResponseCode() + ": " + resp.getContentText().substring(0,200));
    var d = JSON.parse(resp.getContentText());
    return d.choices && d.choices[0] ? d.choices[0].message.content : "";
  }
  if (llm.provider === "gemini") {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=" + llm.token;
    var resp = UrlFetchApp.fetch(url, {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200)
      throw new Error("Gemini QA HTTP " + resp.getResponseCode() + ": " + resp.getContentText().substring(0,200));
    var d = JSON.parse(resp.getContentText());
    try { return d.candidates[0].content.parts[0].text; } catch(e) { return ""; }
  }
  throw new Error("Provider desconhecido: " + llm.provider);
}

// ── Claude — system prompt nativo ────────────────────────────
function _callClaude(token, systemPrompt, userPrompt) {
  var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post", contentType: "application/json",
    headers: { "x-api-key": token, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1400,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200)
    throw new Error("Claude HTTP " + resp.getResponseCode() + ": " + resp.getContentText().substring(0,200));
  var data = JSON.parse(resp.getContentText());
  return data.content && data.content[0] ? data.content[0].text : "";
}

// ── OpenAI — system como primeira mensagem ────────────────────
function _callOpenAI(token, systemPrompt, userPrompt) {
  var resp = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
    method: "post", contentType: "application/json",
    headers: { "Authorization": "Bearer " + token },
    payload: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1400,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   }
      ]
    }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200)
    throw new Error("OpenAI HTTP " + resp.getResponseCode() + ": " + resp.getContentText().substring(0,200));
  var data = JSON.parse(resp.getContentText());
  return data.choices && data.choices[0] ? data.choices[0].message.content : "";
}

// ── Gemini — system via systemInstruction ────────────────────
function _callGemini(token, systemPrompt, userPrompt) {
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=" + token;
  var resp = UrlFetchApp.fetch(url, {
    method: "post", contentType: "application/json",
    payload: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 1400, temperature: 0.2 }
    }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200)
    throw new Error("Gemini HTTP " + resp.getResponseCode() + ": " + resp.getContentText().substring(0,200));
  var data = JSON.parse(resp.getContentText());
  try { return data.candidates[0].content.parts[0].text; } catch(e) { return ""; }
}

// ── Monta o prompt do usuário (dados variáveis da sprint) ─────
function _buildUserPrompt(stats, capacity, byActivity, ragContext, tasks, backlog) {
  var s = stats;

  // Log para diagnóstico — veja em Apps Script > Executar > Logger
  Logger.log("_buildUserPrompt: ragContext length=" + (ragContext ? ragContext.length : 0));
  if (ragContext) Logger.log("_buildUserPrompt: ragContext preview=\n" + ragContext.substring(0, 400));

  // ── Capacidade por membro ──────────────────────────────────
  var memberLines = Object.keys(capacity).map(function(m) {
    var c  = capacity[m];
    var bm = s.byMember && s.byMember[m] ? s.byMember[m] : { remaining:0, tasksDone:0 };
    var alloc = c.capRest > 0 ? Math.round((bm.remaining / c.capRest) * 100) : 0;
    return "  " + m + " | " + c.activity +
           " | cap=" + c.capRest + "h | rem=" + bm.remaining + "h" +
           " | done=" + bm.tasksDone + " tasks | alocação=" + alloc + "%";
  }).join("\n");

  // ── Capacidade por tipo de atuação ─────────────────────────
  var actLines = Object.keys(byActivity).map(function(act) {
    var a      = byActivity[act];
    var capDay = s.bizDays > 0 ? (a.capRest   / s.bizDays).toFixed(1) : "0";
    var rytDay = s.bizDays > 0 ? (a.remaining / s.bizDays).toFixed(1) : "0";
    var alloc  = a.capRest > 0 ? Math.round((a.remaining / a.capRest) * 100) : 0;
    return "  " + act + " | cap_dia=" + capDay + "h | ritmo_dia=" + rytDay +
           "h | rem_total=" + a.remaining + "h | membros=" + a.members + " | alocação=" + alloc + "%";
  }).join("\n");

  // ── Tasks abertas com responsável ─────────────────────────
  var taskLines = "";
  if (tasks && tasks.length > 0) {
    var openTasks = tasks.filter(function(t){ return t.state !== "Done"; }).slice(0, 60);
    var doneTasks = tasks.filter(function(t){ return t.state === "Done"; });
    taskLines =
      "Tasks abertas (" + openTasks.length + "):\n" +
      openTasks.map(function(t) {
        return "  [" + t.state + "] #" + t.id + " — " + t.title +
               " | resp=" + (t.assignedTo || "não atribuído") +
               (t.remaining > 0 ? " | " + t.remaining + "h rem" : "") +
               (t.blockStatus && t.blockStatus !== "CLEAR" ? " | ⚠ " + t.blockStatus : "");
      }).join("\n") +
      "\nTasks concluídas: " + doneTasks.length;
  }

  // ── Backlog ─────────────────────────────────────────────────
  var backlogLines = "";
  if (backlog && backlog.length > 0) {
    backlogLines = backlog.slice(0, 40).map(function(b) {
      var flag = b.blockStatus === "BLOCKED" ? " 🚫BLOCKED"
               : b.blockStatus === "FIXING"  ? " 🔧FIXING" : "";
      return "  [" + b.state + "] #" + b.id + " — " + b.title +
             " | resp=" + (b.assignedTo || "—") +
             (b.remainingWork > 0 ? " | " + b.remainingWork + "h" : "") + flag;
    }).join("\n");
  }

  // ── Prompt ─────────────────────────────────────────────────
  var prompt =
    "Você é um Agile Coach sênior analisando uma sprint ativa.\n\n" +

    "====== INSTRUÇÕES DE PRIORIDADE (SIGA RIGOROSAMENTE) ======\n" +
    "Sua análise DEVE seguir esta ordem, sem exceção:\n\n" +
    "PRIORIDADE 1 — CONTEXTO DO TIME:\n" +
    "O bloco '## Contexto Específico do Time' abaixo contém acordos, decisões e\n" +
    "situações já tratadas pelo time. ANTES de gerar qualquer insight crítico ou\n" +
    "de atenção, verifique se o contexto do time já explica ou justifica a situação.\n" +
    "Se o contexto mencionar que um item, pessoa ou risco já está sendo tratado,\n" +
    "gere um insight 'ok' reconhecendo isso — NÃO gere 'critical' ou 'warning'.\n\n" +
    "PRIORIDADE 2 — DADOS NUMÉRICOS:\n" +
    "Analise capacidade INDIVIDUALMENTE por membro (não compare totais agregados).\n" +
    "Sobrecarga = rem > cap de uma pessoa específica. >110% = critical, 80-110% = warning.\n" +
    "Ignore a comparação 'remaining total vs capacidade total' — ela é enganosa.\n\n" +
    "PRIORIDADE 3 — CONTEXTO GERAL:\n" +
    "Use como complemento. Nunca sobreponha o contexto geral ao contexto do time.\n\n" +
    "PRIORIDADE 4 — CRIATIVIDADE:\n" +
    "Apenas após aplicar 1, 2 e 3.\n" +
    "=============================================================\n\n" +

    "FORMATO — retorne SOMENTE o array JSON abaixo, sem markdown externo:\n" +
    '[{"severity":"critical|warning|info|ok","icon":"emoji","title":"Título com emoji","body":"2-3 frases com nomes e números reais."}]\n\n' +

    "SEVERIDADES:\n" +
    "critical 🚨 — sobrecarga individual >110% NÃO justificada pelo contexto do time\n" +
    "warning  ⚠️ — 80-110% individual, bloqueio ou fixing sem resolução visível\n" +
    "info     💡 — oportunidade, padrão observado, dica baseada nos dados\n" +
    "ok       ✅ — conformidade com contexto do time, ritmo equilibrado\n\n" +
    "Gere 4 a 6 insights. Cite sempre nomes e números reais.\n\n" +

    "=============================================================\n\n" +

    // ── CONTEXTO DO TIME (injetado diretamente, sem split) ───
    // getActiveRagContext() já formata com headers ## que o LLM lê nativamente.
    // NÃO fazemos split — injetamos o texto completo para evitar perda de dados.
    (ragContext
      ? "CONTEXTO DO TIME E GERAL (leia antes dos dados):\n" +
        "---------------------------------------------\n" +
        ragContext + "\n" +
        "---------------------------------------------\n\n"
      : "CONTEXTO DO TIME: (não cadastrado — analise só pelos dados numéricos)\n\n") +

    "=============================================================\n\n" +

    "DADOS DA SPRINT:\n" +
    "Dias úteis restantes: " + s.bizDays + "\n" +
    "PBIs: total=" + s.total + " | concluídos=" + s.done + " (" + s.donePct + "%)" +
    " | em_progresso=" + s.inProgress + " | bloqueados=" + s.blocked + " | fixing=" + s.fixing + "\n" +
    "Tasks: abertas=" + s.totalTasksOpen + " | finalizadas=" + s.totalTasksDone + "\n\n" +

    // Interpretação pré-calculada — elimina ambiguidade sobre rem vs cap total
    "DIAGNÓSTICO MACRO DE CAPACIDADE (leia antes de analisar membros):\n" +
    "  Remaining work total: " + s.totalRem + "h\n" +
    "  Capacidade total disponível: " + s.capacityTotal + "h\n" +
    "  Alocação geral: " + s.allocPct + "%\n" +
    "  ▶ INTERPRETAÇÃO: " + (
      s.allocPct > 110
        ? "RISCO REAL — demanda supera capacidade. Foco em redistribuição ou corte de escopo."
        : s.allocPct > 100
        ? "ATENÇÃO — demanda levemente acima da capacidade. Monitorar membros individuais."
        : s.allocPct > 80
        ? "SAUDÁVEL — demanda dentro da capacidade com margem pequena."
        : s.allocPct > 0
        ? "FOLGA — capacidade sobrando (" + (100 - s.allocPct) + "% ociosa). Verificar se há trabalho não estimado ou oportunidade de adiantar próxima sprint."
        : "SEM DADOS — capacity não cadastrada no Azure."
    ) + "\n" +
    "  ⚠ NÃO gere insight de 'risco de não entrega' baseado apenas nos totais acima.\n" +
    "    Use a análise individual por membro abaixo para identificar sobrecarga real.\n\n" +

    "Capacidade e remaining por MEMBRO:\n" +
    (memberLines || "  (sem dados de capacity cadastrados no Azure)") + "\n\n" +

    // Alertas pré-calculados — força o LLM a cobrir TODOS os membros com desvio
    (function() {
      var overloaded = [], highAlloc = [], lowAlloc = [], idle = [];
      Object.keys(capacity).forEach(function(m) {
        var c    = capacity[m];
        var bm   = s.byMember && s.byMember[m] ? s.byMember[m] : { remaining: 0 };
        var pct  = c.capRest > 0 ? Math.round((bm.remaining / c.capRest) * 100) : 0;
        var line = "  → " + m + " (" + c.activity + "): alocação=" + pct + "% (rem=" + bm.remaining + "h, cap=" + c.capRest + "h)";
        if (pct > 100)       overloaded.push(line);
        else if (pct >= 70)  highAlloc.push(line);
        else if (pct > 0)    lowAlloc.push(line);
        else                 idle.push(line);
      });
      var lines = "ALERTAS POR MEMBRO — BASE PARA OS CARDS:\n";
      if (overloaded.length > 0) lines += "🚨 SOBRECARREGADOS (>100%) — CONSOLIDE TODOS EM 1 ÚNICO CARD 'Alertas de Sobrecarga':\n" + overloaded.join("\n") + "\n";
      if (highAlloc.length > 0)  lines += "✅ ALOCAÇÃO SAUDÁVEL (70-100%):\n" + highAlloc.join("\n") + "\n";
      if (lowAlloc.length > 0)   lines += "⚠️ OCIOSOS (<70%) — gere warning agrupado por papel:\n" + lowAlloc.join("\n") + "\n";
      if (idle.length > 0)       lines += "⚠️ SEM TASKS (0%):\n" + idle.join("\n") + "\n";
      return lines + "\n";
    })() +

    "Capacidade por TIPO DE ATUAÇÃO:\n" +
    (actLines || "  (sem dados)") + "\n\n" +

    "Backlog (PBIs e Defects):\n" +
    (backlogLines || "  (sem dados)") + "\n\n" +

    "Tarefas:\n" +
    (taskLines || "  (sem dados)") + "\n\n" +

    "=============================================================\n" +
    "Gere os insights agora. Responda SOMENTE com o JSON array.";

  Logger.log("_buildUserPrompt: prompt length=" + prompt.length);
  return prompt;
}

// ── Parseia JSON retornado pelo LLM ───────────────────────────
function _parseInsightJson(raw) {
  if (!raw) throw new Error("LLM retornou resposta vazia.");

  // Remove possíveis blocos markdown
  var clean = raw.replace(/```json/gi,"").replace(/```/g,"").trim();

  // Tenta encontrar JSON array
  var start = clean.indexOf("[");
  var end   = clean.lastIndexOf("]");

  // Se não há JSON — o LLM respondeu em texto puro (ex: "Não há dados suficientes")
  // Converte em card de info em vez de lançar erro
  if (start === -1 || end === -1) {
    Logger.log("_parseInsightJson: sem JSON, convertendo texto puro em card. Raw: " + clean.substring(0,200));
    return [{
      severity: "info",
      icon:     "💡",
      title:    "💡 Resposta",
      body:     clean.substring(0, 400)
    }];
  }

  try {
    var arr = JSON.parse(clean.substring(start, end+1));
    if (!Array.isArray(arr) || arr.length === 0) throw new Error("vazio");
    return arr.map(function(item) {
      var body = String(item.body || "");
      // Detecta se o LLM copiou o placeholder do exemplo em vez de responder
      var isPlaceholder = body.indexOf("Explique em 1 frase") !== -1 ||
                          body.indexOf("resposta objetiva com dados reais") !== -1 ||
                          body === "resposta";
      if (isPlaceholder) {
        body = "Não foi possível gerar uma resposta específica. Tente reformular a pergunta com mais detalhes.";
      }
      return {
        severity: ["critical","warning","info","ok"].indexOf(item.severity) !== -1 ? item.severity : "info",
        icon:     String(item.icon  || "💡"),
        title:    String(item.title || "Resposta"),
        body:     body
      };
    });
  } catch(e) {
    // JSON malformado — tenta retornar o texto como card
    Logger.log("_parseInsightJson: JSON malformado, usando texto. Erro: " + e.message);
    return [{
      severity: "info",
      icon:     "💡",
      title:    "💡 Resposta",
      body:     clean.replace(/[\[\]{}\"]/g, "").trim().substring(0, 400)
    }];
  }
}

// ── Lógica local (sem LLM) ────────────────────────────────────
function _localInsights(stats, capacity, byActivity) {
  var s = stats;
  var insights = [];

  // 1. Sobrecarga de membros
  var overloaded = Object.keys(capacity).filter(function(m) {
    var bm  = s.byMember && s.byMember[m] ? s.byMember[m] : { remaining:0 };
    var cap = capacity[m];
    return cap.capRest > 0 && (bm.remaining / cap.capRest) > 1.1;
  });
  if (overloaded.length > 0) {
    insights.push({ severity:"critical", icon:"🚨", title:"Sobrecarga de membros",
      body: overloaded.length + " membro(s) com alocação acima de 110%: " +
            overloaded.slice(0,3).join(", ") + (overloaded.length > 3 ? "..." : "") +
            ". Redistribua tarefas para evitar atraso na sprint." });
  }

  // 2. Bloqueios
  if (s.blocked > 0) {
    insights.push({ severity:"critical", icon:"🚧", title:"Bloqueios ativos",
      body: s.blocked + " PBI(s) bloqueado(s). Cada dia sem resolução reduz a capacidade real da sprint. Priorize desbloqueio imediato." });
  }

  // 3. Fixing
  if (s.fixing > 0) {
    insights.push({ severity:"warning", icon:"⚠️", title:"Itens em correção",
      body: s.fixing + " item(ns) em estado de fixing. Isso indica retrabalho. " +
            "Analise a causa raiz para evitar recorrência nas próximas sprints." });
  }

  // 4. Alocação geral
  if (s.allocPct > 100) {
    insights.push({ severity:"warning", icon:"⚠️", title:"Capacidade excedida",
      body: "A demanda total (" + s.totalRem + "h) supera a capacidade restante (" + s.capacityTotal + "h) em " +
            (s.allocPct - 100) + "%. Considere mover itens de backlog para a próxima sprint." });
  } else if (s.allocPct < 60 && s.allocPct > 0) {
    insights.push({ severity:"info", icon:"💡", title:"Capacidade subutilizada",
      body: "Apenas " + s.allocPct + "% da capacidade está alocada. Há espaço para incluir mais itens ou reduzir a sprint." });
  }

  // 5. Ritmo de entrega
  var donePct = s.donePct;
  var daysElapsed = s.bizDays > 0 ? (1 - (s.bizDays / (s.bizDays + 1))) * 100 : 50;
  if (donePct >= 70) {
    insights.push({ severity:"ok", icon:"📈", title:"Ritmo de entrega saudável",
      body: s.done + " de " + s.total + " PBIs concluídos (" + donePct + "%). O time está no caminho certo para finalizar a sprint no prazo." });
  } else if (s.done === 0 && s.bizDays < 3) {
    insights.push({ severity:"critical", icon:"🚨", title:"Entregas em risco",
      body: "Nenhum PBI concluído com apenas " + s.bizDays + " dias úteis restantes. Revisão urgente do escopo é necessária." });
  } else {
    insights.push({ severity:"info", icon:"📊", title:"Progresso da sprint",
      body: s.done + " de " + s.total + " PBIs concluídos (" + donePct + "%). " +
            s.totalTasksDone + " tasks finalizadas. Mantenha o ritmo para garantir a entrega." });
  }

  // 6. Tasks sem estimativa
  var tasksNoEstimate = 0;
  if (s.totalTasksOpen > 0 && s.totalRem === 0) {
    tasksNoEstimate = s.totalTasksOpen;
  }
  if (tasksNoEstimate > 0) {
    insights.push({ severity:"warning", icon:"🔍", title:"Tasks sem estimativa",
      body: tasksNoEstimate + " task(s) abertas com Remaining Work = 0h. Isso distorce os cálculos de capacidade. Atualize as estimativas." });
  }

  // 7. Boa distribuição por atividade
  var actKeys = Object.keys(byActivity);
  if (actKeys.length > 0) {
    var allBalanced = actKeys.every(function(act) {
      var a = byActivity[act];
      return a.capRest > 0 && (a.remaining / a.capRest) <= 1.0;
    });
    if (allBalanced && insights.filter(function(i){return i.severity==="critical";}).length === 0) {
      insights.push({ severity:"ok", icon:"✅", title:"Distribuição equilibrada",
        body: "Todas as áreas de atuação (" + actKeys.join(", ") + ") estão dentro da capacidade disponível. Boa organização do trabalho!" });
    }
  }

  return insights.slice(0, 6);
}

// ── Renderiza cards HTML ──────────────────────────────────────
function _renderInsightCards(insights) {
  if (!insights || insights.length === 0) return '<div style="color:#9ca3af;font-size:12px;font-style:italic;padding:8px">Nenhum insight gerado.</div>';
  return insights.map(function(ins) {
    var style = SEVERITY_STYLES[ins.severity] || SEVERITY_STYLES.info;
    return '<div class="insight-card" style="background:'+style.bg+';border-color:'+style.border+'">' +
      '<div class="insight-head">' +
        '<span class="insight-icon">'+ins.icon+'</span>' +
        '<span class="insight-title" style="color:'+style.titleColor+'">'+_escI(ins.title)+'</span>' +
        '<button class="insight-remove" onclick="removeInsight(this)" title="Remover insight">✕</button>' +
      '</div>' +
      '<p class="insight-body">'+_escI(ins.body)+'</p>' +
    '</div>';
  }).join("");
}

function _escI(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
// ============================================================
//  dashboard.gs  —  Painel HTML gerado a partir dos dados
//
//  Regras HtmlService:  SEM <!DOCTYPE html>
//                       onclick usa aspas SIMPLES internamente
// ============================================================

function openDashboard() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var cfg = readConfig(ss);
  if (!cfg || !cfg.org) { ui.alert("⚠️ Configure e sincronize primeiro."); return; }
  var data = _collectDashboardData(ss, cfg);
  if (!data.activeSprint) { ui.alert("⚠️ Nenhuma sprint ativa. Sincronize primeiro."); return; }
  var html = HtmlService
    .createHtmlOutput(_buildDashboardHtml(data, cfg))
    .setTitle("Sprint Dashboard — " + cfg.project)
    .setWidth(1200)
    .setHeight(860);
  ui.showModalDialog(html, "📊 Sprint Dashboard");
}

// ── URL Azure Boards ─────────────────────────────────────────
function _itemUrl(cfg, id) {
  return "https://dev.azure.com/" + encodeURIComponent(cfg.org) + "/" +
         encodeURIComponent(cfg.project) + "/_workitems/edit/" + id;
}

// ── Formata data como "19 de março" (pt-BR, UTC-safe) ────────
function _fmtDatePtBR(val) {
  if (!val) return "";
  var months = ["janeiro","fevereiro","março","abril","maio","junho",
                "julho","agosto","setembro","outubro","novembro","dezembro"];
  var str = String(val).trim();
  var ptMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ptMatch) return parseInt(ptMatch[1],10) + " de " + months[parseInt(ptMatch[2],10)-1];
  if (val instanceof Date && !isNaN(val.getTime()))
    return val.getUTCDate() + " de " + months[val.getUTCMonth()];
  var d = new Date(str);
  if (!isNaN(d.getTime())) return d.getUTCDate() + " de " + months[d.getUTCMonth()];
  return str;
}

// ── Formata data ISO como "19 de março" ──────────────────────
function _fmtIsoDatePtBR(isoStr) {
  if (!isoStr) return "";
  var months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.getUTCDate() + "/" + months[d.getUTCMonth()];
}

// ── Coleta dados de todas as abas ────────────────────────────
function _collectDashboardData(ss, cfg) {
  var data = { activeSprint: null, backlog: [], tasks: [], capacity: {}, stats: {} };

  // Sprint_Info
  var spSh = ss.getSheetByName("Sprint_Info");
  if (spSh && spSh.getLastRow() > 1) {
    var sRows = spSh.getRange(2, 1, spSh.getLastRow()-1, 5).getValues();
    sRows.forEach(function(r) {
      if (r[3] === "SIM") {
        data.activeSprint = { path: r[0], startRaw: r[1], endRaw: r[2], bizDaysLeft: parseInt(r[4])||0 };
      }
    });
  }

  // Raw_Backlog_Data (10 cols)
  var blSh = ss.getSheetByName("Raw_Backlog_Data");
  if (blSh && blSh.getLastRow() > 1) {
    blSh.getRange(2,1,blSh.getLastRow()-1,10).getValues().forEach(function(r) {
      if (!r[0]) return;
      data.backlog.push({ id:r[0], type:r[1], title:r[2], state:r[3], severity:r[4],
        blockStatus:r[5], assignedTo:r[6], storyPoints:r[7]||0, tags:r[8], remainingWork:r[9]||0 });
    });
  }

  // Raw_Task_Data (10 cols)
  var tkSh = ss.getSheetByName("Raw_Task_Data");
  if (tkSh && tkSh.getLastRow() > 1) {
    tkSh.getRange(2,1,tkSh.getLastRow()-1,10).getValues().forEach(function(r) {
      if (!r[0]) return;
      data.tasks.push({ id:r[0], parentId:r[1], type:r[2], title:r[3], state:r[4],
        remaining:r[5]||0, completed:r[6]||0, assignedTo:r[7], activity:r[8], blockStatus:r[9] });
    });
  }

  // Raw_Capacity_Data (7 cols)
  // 0=Membro,1=Atividade,2=Cap/dia,3=DaysOff(str),4=TotalDaysOff,5=CapTotal,6=CapRest
  var capSh = ss.getSheetByName("Raw_Capacity_Data");
  if (capSh && capSh.getLastRow() > 1) {
    capSh.getRange(2,1,capSh.getLastRow()-1,7).getValues().forEach(function(r) {
      if (!r[0]) return;
      // r[3] pode vir como Date, número ou string dependendo de como o Sheets
      // interpretou a célula — forçamos String para garantir que .split funcione.
      var rawDaysOff = r[3];
      var daysOffStr = "";
      if (rawDaysOff instanceof Date) {
        // Sheets leu como data — converte de volta para dd/MM
        daysOffStr = rawDaysOff.getDate() + "/" + _padZ(rawDaysOff.getMonth()+1);
      } else if (rawDaysOff !== null && rawDaysOff !== undefined && rawDaysOff !== "") {
        daysOffStr = String(rawDaysOff);
      }
      data.capacity[String(r[0])] = {
        activity:     r[1] ? String(r[1]) : "",
        capPerDay:    Number(r[2]) || 0,
        daysOffStr:   daysOffStr,
        daysOffTotal: Number(r[4]) || 0,
        capTotal:     Number(r[5]) || 0,
        capRest:      Number(r[6]) || 0
      };
    });
  }

  // ── KPIs ──────────────────────────────────────────────────
  var total      = data.backlog.length;
  var done       = data.backlog.filter(function(i){ return i.state==="Done"; }).length;
  var blocked    = data.backlog.filter(function(i){ return i.blockStatus==="BLOCKED"; }).length;
  var fixing     = data.backlog.filter(function(i){ return i.blockStatus==="FIXING"; }).length;
  var inProgress = data.backlog.filter(function(i){ return i.state==="In Progress"&&i.blockStatus==="CLEAR"; }).length;
  var donePct    = total>0 ? Math.round((done/total)*100) : 0;

  var totalRem       = data.tasks.reduce(function(a,t){ return a+(t.remaining||0); },0);
  var totalTasksDone = data.tasks.filter(function(t){ return t.state==="Done"; }).length;
  var totalTasksOpen = data.tasks.filter(function(t){ return t.state!=="Done"; }).length;

  // Capacidade total restante da sprint = soma das capRest individuais
  var capacityTotal = 0;
  Object.keys(data.capacity).forEach(function(m) { capacityTotal += data.capacity[m].capRest || 0; });
  // Fallback se não houver capacity cadastrada
  var bizDays = data.activeSprint ? data.activeSprint.bizDaysLeft : 0;
  if (capacityTotal === 0 && bizDays > 0) {
    var memberCount = Math.max(Object.keys(data.capacity).length || 1, 1);
    capacityTotal   = bizDays * 6 * memberCount;
  }
  var allocPct = capacityTotal > 0 ? Math.min(Math.round((totalRem/capacityTotal)*100), 999) : 0;

  // Distribuição por membro — baseada nas tasks/bugs filhos + capacity real
  var byMember = {};
  data.tasks.forEach(function(t) {
    var m = (t.assignedTo && String(t.assignedTo).trim()) || "Não atribuído";
    if (!byMember[m]) byMember[m] = { remaining:0, tasksDone:0, tasksOpen:0 };
    if (t.state==="Done") { byMember[m].tasksDone++; }
    else { byMember[m].remaining += (t.remaining||0); byMember[m].tasksOpen++; }
  });

  // Coleta day offs futuros — normaliza para meia-noite UTC para comparação correta
  var dayOffCards = [];
  var nowUTC      = new Date();
  // Meia-noite UTC de hoje — qualquer day off >= este timestamp é futuro/atual
  var todayMidnightUTC = Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate());

  Object.keys(data.capacity).forEach(function(m) {
    var cap = data.capacity[m];
    var str = cap.daysOffStr;
    if (!str || typeof str !== "string" || str.trim() === "") return;
    str.split(",").forEach(function(part) {
      part = part.trim();
      if (!part) return;
      var rangeMatch  = part.match(/^(\d{1,2})\/(\d{1,2})[–\-](\d{1,2})\/(\d{1,2})$/);
      var singleMatch = part.match(/^(\d{1,2})\/(\d{1,2})$/);
      var year = nowUTC.getUTCFullYear();
      if (rangeMatch) {
        var dStart = Date.UTC(year, parseInt(rangeMatch[2])-1, parseInt(rangeMatch[1]));
        var dEnd   = Date.UTC(year, parseInt(rangeMatch[4])-1, parseInt(rangeMatch[3]));
        var cur    = dStart;
        while (cur <= dEnd) {
          if (cur >= todayMidnightUTC) {
            var d = new Date(cur);
            dayOffCards.push({ member: m, dateTs: cur,
              label: _padZ(d.getUTCDate()) + "/" + _padZ(d.getUTCMonth()+1),
              activity: cap.activity });
          }
          cur += 86400000; // +1 dia em ms
        }
      } else if (singleMatch) {
        var ts = Date.UTC(year, parseInt(singleMatch[2])-1, parseInt(singleMatch[1]));
        if (ts >= todayMidnightUTC) {
          dayOffCards.push({ member: m, dateTs: ts,
            label: _padZ(parseInt(singleMatch[1])) + "/" + _padZ(parseInt(singleMatch[2])),
            activity: cap.activity });
        }
      }
    });
  });
  dayOffCards.sort(function(a,b){ return a.dateTs - b.dateTs; });

  // Agrega capacidade e remaining por tipo de atividade (para o "Ver mais")
  var byActivity = {};
  Object.keys(data.capacity).forEach(function(m) {
    var cap = data.capacity[m];
    var act = cap.activity || "Não definido";
    if (!byActivity[act]) byActivity[act] = { capRest: 0, capTotal: 0, remaining: 0, members: 0 };
    byActivity[act].capRest  += cap.capRest  || 0;
    byActivity[act].capTotal += cap.capTotal || 0;
    byActivity[act].members++;
  });
  // Soma remaining por atividade usando tasks
  data.tasks.forEach(function(t) {
    if (t.state === "Done") return;
    var m   = (t.assignedTo && String(t.assignedTo).trim()) || "";
    var cap = m ? data.capacity[m] : null;
    var act = cap ? (cap.activity || "Não definido") : "Não definido";
    if (!byActivity[act]) byActivity[act] = { capRest: 0, capTotal: 0, remaining: 0, members: 0 };
    byActivity[act].remaining += (t.remaining || 0);
  });

  data.stats = {
    total:total, done:done, blocked:blocked, fixing:fixing,
    inProgress:inProgress, donePct:donePct,
    totalRem:totalRem, totalTasksDone:totalTasksDone, totalTasksOpen:totalTasksOpen,
    bizDays:bizDays, capacityTotal:capacityTotal, allocPct:allocPct,
    byMember:byMember, dayOffCards:dayOffCards, byActivity:byActivity
  };

  return data;
}

function _padZ(n) { return n < 10 ? "0"+n : String(n); }

// ── Builder HTML ──────────────────────────────────────────────
function _buildDashboardHtml(data, cfg) {
  var s  = data.stats;
  var sp = data.activeSprint;
  var sprintLabel = sp ? sp.path.split("\\").pop() : "—";
  var startStr    = sp ? _fmtDatePtBR(sp.startRaw) : "";
  var endStr      = sp ? _fmtDatePtBR(sp.endRaw)   : "";

  var capBarPct   = s.capacityTotal>0 ? Math.min(Math.round((s.totalRem/s.capacityTotal)*100),100) : 0;
  var capBarColor = s.allocPct>100 ? "#dc2626" : s.allocPct>80 ? "#f59e0b" : "#1d4ed8";
  var velBg       = s.allocPct>100 ? "#fef2f2" : "#eff6ff";
  var velColor    = s.allocPct>100 ? "#dc2626" : "#1d4ed8";
  var velVal      = s.bizDays>0 && s.totalRem>0
    ? (s.totalRem/s.bizDays).toFixed(1)+"h/dia útil" : "Tudo zerado";

  // Mapa parent → filhos
  var childrenMap = {};
  data.tasks.forEach(function(t) {
    var pid = String(t.parentId);
    if (!childrenMap[pid]) childrenMap[pid] = [];
    childrenMap[pid].push(t);
  });

  // ── Linhas do backlog ─────────────────────────────────────
  var backlogRows = "";
  data.backlog.forEach(function(item) {
    var id = String(item.id), itemUrl = _itemUrl(cfg, item.id);
    var rowCls = item.blockStatus==="BLOCKED" ? " row-blocked" : item.blockStatus==="FIXING" ? " row-fixing" : "";
    var typeLabel = item.type==="Product Backlog Item" ? "PBI" : item.type==="Defect" ? "Defect" : item.type;
    var typeCls   = (item.type==="Bug"||item.type==="Defect") ? "badge-bug" : "badge-pbi";
    var stateLabel, stateCls;
    if      (item.blockStatus==="BLOCKED") { stateLabel="Bloqueado";    stateCls="s-blocked"; }
    else if (item.blockStatus==="FIXING")  { stateLabel="Em fixing";    stateCls="s-fixing";  }
    else if (item.state==="Done")          { stateLabel="Concluído";    stateCls="s-done";    }
    else if (item.state==="In Progress")   { stateLabel="Em progresso"; stateCls="s-doing";   }
    else                                   { stateLabel=_esc(item.state)||"To Do"; stateCls="s-todo"; }

    var children = childrenMap[id]||[], hasChildren = children.length>0;
    var execSet  = {};
    children.forEach(function(c){ if(c.assignedTo&&String(c.assignedTo).trim()) execSet[String(c.assignedTo).trim()]=true; });
    var execHtml = Object.keys(execSet).length>0
      ? Object.keys(execSet).map(function(n){
          var ini=n.split(" ").slice(0,2).map(function(w){return w[0]||"";}).join("").toUpperCase();
          return '<span class="mini-av" title="'+_esc(n)+'">'+_esc(ini)+'</span>';
        }).join("")
      : '<span class="text-muted">—</span>';

    var onclickAttr = hasChildren ? ' onclick=\'toggleChildren("'+id+'")\' style=\'cursor:pointer\'' : "";
    var expandIcon  = hasChildren ? '<span class="expand-icon" id="ico-'+id+'">&#9654;</span>'
                                  : '<span class="expand-icon no-expand"></span>';

    backlogRows +=
      '<tr class="bl-row'+rowCls+'"'+onclickAttr+'>' +
        '<td>'+expandIcon+'</td>' +
        '<td><span class="badge '+typeCls+'">'+_esc(typeLabel)+'</span></td>' +
        '<td class="id-cell"><a href="'+itemUrl+'" target="_blank" class="az-link">#'+id+'</a></td>' +
        '<td class="title-cell"><a href="'+itemUrl+'" target="_blank" class="az-link title-link">'+_esc(item.title)+'</a></td>' +
        '<td><span class="sbadge '+stateCls+'">'+stateLabel+'</span></td>' +
        '<td class="exec-cell">'+execHtml+'</td>' +
        '<td class="text-center mono">'+(item.storyPoints>0?item.storyPoints:"—")+'</td>' +
        '<td class="text-center mono rem-col">'+(item.remainingWork>0?item.remainingWork+"h":"—")+'</td>' +
      '</tr>';

    if (hasChildren) {
      var doing = children.filter(function(c){return c.state!=="Done";});
      var doneC = children.filter(function(c){return c.state==="Done";});
      var mkCard = function(c, isDone) {
        var tUrl=_itemUrl(cfg,c.id), tLbl=c.type==="Bug"?"Bug":"Task", tCls=c.type==="Bug"?"badge-bug":"badge-task";
        var sCls=isDone?"s-done":c.blockStatus==="BLOCKED"?"s-blocked":c.blockStatus==="FIXING"?"s-fixing":"s-doing";
        var sLbl=isDone?"Concluído":c.blockStatus==="BLOCKED"?"Bloqueado":c.blockStatus==="FIXING"?"Em fixing":_esc(c.state)||"To Do";
        return '<div class="task-card '+(isDone?"tc-done":"tc-doing")+'">' +
          '<div class="tc-head"><span class="badge '+tCls+' tc-badge">'+tLbl+'</span>' +
          '<a href="'+tUrl+'" target="_blank" class="az-link tc-id">#'+c.id+'</a></div>' +
          '<div class="tc-title"><a href="'+tUrl+'" target="_blank" class="az-link">'+_esc(c.title)+'</a></div>' +
          '<div class="tc-foot"><span class="sbadge '+sCls+' tc-sbadge">'+sLbl+'</span>' +
          (!isDone&&c.remaining>0?'<span class="tc-hours">'+c.remaining+'h</span>':'')+
          '</div>'+(c.assignedTo?'<div class="tc-assigned">'+_esc(c.assignedTo)+'</div>':'')+
        '</div>';
      };
      backlogRows +=
        '<tr class="children-row" id="cr-'+id+'" style="display:none">' +
          '<td colspan="8" class="children-cell">' +
            '<div class="children-wrap">' +
              '<div class="children-col">' +
                '<div class="col-header col-doing">Em andamento ('+doing.length+')</div>' +
                '<div class="cards-wrap">'+(doing.map(function(c){return mkCard(c,false);}).join("")||'<div class="empty-col">Nenhuma em andamento</div>')+'</div>' +
              '</div>' +
              '<div class="children-col">' +
                '<div class="col-header col-done">Concluído ('+doneC.length+')</div>' +
                '<div class="cards-wrap">'+(doneC.map(function(c){return mkCard(c,true);}).join("")||'<div class="empty-col">Nenhuma concluída</div>')+'</div>' +
              '</div>' +
            '</div>' +
          '</td>' +
        '</tr>';
    }
  });

  // ── Tabela de membros ─────────────────────────────────────
  // Agrega: capacidade real da aba Capacity + remaining das tasks
  var allMembers = {};
  Object.keys(s.byMember).forEach(function(m){ allMembers[m]=true; });
  Object.keys(data.capacity).forEach(function(m){ allMembers[m]=true; });

  var memberRows = "";
  Object.keys(allMembers)
    .sort(function(a,b){ return (s.byMember[b]?s.byMember[b].remaining:0) - (s.byMember[a]?s.byMember[a].remaining:0); })
    .forEach(function(m) {
      var bm   = s.byMember[m]     || { remaining:0, tasksDone:0, tasksOpen:0 };
      var cap  = data.capacity[m]  || null;
      var capRest = cap ? cap.capRest : s.bizDays*6;
      var actName = cap ? cap.activity : "—";
      var daysOff = cap ? cap.daysOffStr || "—" : "—";
      var rem     = bm.remaining;
      var alloc   = capRest>0 ? Math.min(Math.round((rem/capRest)*100),999) : 0;
      var aColor  = alloc>100 ? "#dc2626" : alloc>80 ? "#d97706" : "#16a34a";
      var barPct  = Math.min(alloc,100);
      var barClr  = alloc>100 ? "#dc2626" : alloc>80 ? "#f59e0b" : "#16a34a";
      var ini     = m.split(" ").slice(0,2).map(function(w){return w[0]||"";}).join("").toUpperCase();
      memberRows +=
        '<tr>' +
          '<td><div class="avatar">'+_esc(ini)+'</div></td>' +
          '<td><div class="member-name">'+_esc(m)+'</div><div class="member-role">'+_esc(actName)+'</div></td>' +
          '<td class="text-center mono cap-cell">'+capRest+'h' + (daysOff&&daysOff!=="—"?'<div class="daysoff-hint">off: '+_esc(daysOff)+'</div>':'') + '</td>' +
          '<td class="text-center mono rem-col">'+rem+'h</td>' +
          '<td><div style="display:flex;align-items:center;gap:7px">' +
            '<div class="alloc-track"><div class="alloc-fill" style="width:'+barPct+'%;background:'+barClr+'"></div></div>' +
            '<span class="mono" style="font-size:11px;font-weight:600;color:'+aColor+'">'+alloc+'%</span>' +
          '</div></td>' +
          '<td class="text-center mono" style="color:#15803d;font-weight:500">'+bm.tasksDone+'</td>' +
        '</tr>';
    });

  // ── Cards de day off ──────────────────────────────────────
  var dayOffHtml = "";
  if (s.dayOffCards.length === 0) {
    dayOffHtml = '<div class="empty-dayoff">Nenhum day off agendado para os dias restantes da sprint</div>';
  } else {
    // Agrupa por data
    var byDate = {};
    s.dayOffCards.forEach(function(c) {
      if (!byDate[c.label]) byDate[c.label] = [];
      byDate[c.label].push(c);
    });
    Object.keys(byDate).forEach(function(dateLabel) {
      var members = byDate[dateLabel];
      dayOffHtml +=
        '<div class="dayoff-card">' +
          '<div class="dayoff-date"><span class="dayoff-date-icon">🏖</span>'+_esc(dateLabel)+'</div>' +
          members.map(function(c) {
            var ini = c.member.split(" ").slice(0,2).map(function(w){return w[0]||"";}).join("").toUpperCase();
            return '<div class="dayoff-member">' +
              '<span class="dayoff-av">'+_esc(ini)+'</span>' +
              '<span class="dayoff-name">'+_esc(c.member.split(" ")[0])+'</span>' +
            '</div>';
          }).join("") +
        '</div>';
    });
  }

  // ── Insights — assíncrono ─────────────────────────────────
  var llmBadge = (function() {
    var a = getActiveLlm();
    return a ? a.provider.charAt(0).toUpperCase() + a.provider.slice(1) : "análise local";
  })();

  // Serializa apenas os dados necessários para o LLM (não toda a planilha)
  // Limita tasks e backlog para evitar payload muito grande
  // Payload mínimo para o LLM — só o que é necessário para os insights
  var minPayload = {
    stats: {
      total: s.total, done: s.done, donePct: s.donePct,
      blocked: s.blocked, fixing: s.fixing, inProgress: s.inProgress,
      totalRem: s.totalRem, totalTasksOpen: s.totalTasksOpen,
      totalTasksDone: s.totalTasksDone, capacityTotal: s.capacityTotal,
      allocPct: s.allocPct, bizDays: s.bizDays,
      byMember: s.byMember, byActivity: s.byActivity
    },
    capacity: (function() {
      var cap = {};
      Object.keys(data.capacity).forEach(function(m) {
        var c = data.capacity[m];
        cap[m] = { activity: c.activity, capRest: c.capRest, capTotal: c.capTotal,
                   daysOffStr: c.daysOffStr || "" };
      });
      return cap;
    })(),
    byActivity: s.byActivity,
    tasks: data.tasks.slice(0, 50).map(function(t){
      return { state: t.state, remaining: t.remaining||0,
               assignedTo: String(t.assignedTo||""), blockStatus: t.blockStatus||"" };
    }),
    backlog: data.backlog.slice(0, 30).map(function(b){
      return { state: b.state, blockStatus: b.blockStatus||"",
               assignedTo: String(b.assignedTo||""), remainingWork: b.remainingWork||0 };
    })
  };
  var insightPayloadB64 = Utilities.base64Encode(JSON.stringify(minPayload));
  return '<html lang="pt-BR"><head><meta charset="UTF-8">' +
  '<style>' +
  '@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap");' +
  '*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%;overflow-y:auto}' +
  'body{font-family:"DM Sans",sans-serif;background:#f0f2f5;color:#111827;font-size:14px}' +
  '.topbar{background:#0d1b2a;padding:10px 22px;display:flex;align-items:center;justify-content:space-between}' +
  '.tl{display:flex;align-items:center;gap:10px}' +
  '.logo{width:28px;height:28px;background:#1a73e8;border-radius:7px;display:flex;align-items:center;justify-content:center}' +
  '.logo svg{width:15px;height:15px;fill:white}' +
  '.proj{color:white;font-size:14px;font-weight:500}.org{color:rgba(255,255,255,.4);font-size:12px;margin-left:2px}' +
  '.sprint-block{display:flex;flex-direction:column;align-items:flex-end;gap:2px}' +
  '.sprint-row1{display:flex;align-items:center;gap:8px}' +
  '.sdot{width:6px;height:6px;border-radius:50%;background:#22c55e;animation:blink 2s infinite;flex-shrink:0}' +
  '.sprint-name{color:rgba(255,255,255,.9);font-size:13px;font-weight:500}' +
  '.days-pill{background:#14532d;border:1px solid #166534;color:#4ade80;font-size:11px;padding:2px 9px;border-radius:20px;font-weight:500}' +
  '.sprint-dates{color:rgba(255,255,255,.4);font-size:11px;font-family:"DM Mono",monospace}' +
  '@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}' +
  '.main{padding:14px 22px;max-width:1160px;margin:0 auto}' +
  '.sec-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin:0 0 10px}' +
  '.kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:14px}' +
  '.kpi{background:white;border-radius:10px;padding:12px 14px;border:1px solid #e5e7eb}' +
  '.kpi-label{font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;font-weight:500}' +
  '.kpi-val{font-size:22px;font-weight:600;line-height:1;color:#111827}.kpi-sub{font-size:10px;color:#9ca3af;margin-top:4px}' +
  '.kpi-val.green{color:#16a34a}.kpi-val.red{color:#dc2626}.kpi-val.yellow{color:#d97706}.kpi-val.blue{color:#1d4ed8}' +
  '.kpi-alert{background:#fef2f2!important;border-color:#fecaca!important}.kpi-alert .kpi-val{color:#dc2626}.kpi-alert .kpi-label{color:#b91c1c}.kpi-alert .kpi-sub{color:#ef4444}' +
  '.layout{display:grid;grid-template-columns:1fr 300px;gap:14px;margin-bottom:14px}' +
  '.panel{background:white;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden}' +
  '.ph{padding:10px 14px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between}' +
  '.pt{font-size:13px;font-weight:500;color:#111827}.pc{font-size:11px;color:#6b7280;background:#f3f4f6;padding:2px 8px;border-radius:12px}' +
  '.ftabs{display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid #f0f0f0;flex-wrap:wrap}' +
  '.ftab{font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid #e5e7eb;background:white;color:#6b7280;cursor:pointer;font-family:"DM Sans",sans-serif;white-space:nowrap}' +
  '.ftab.active{background:#1d4ed8;color:white;border-color:#1d4ed8}' +
  '.tbl-wrap{overflow-y:auto;max-height:400px}' +
  'table{width:100%;border-collapse:collapse}' +
  'th{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;padding:7px 10px;text-align:left;border-bottom:1px solid #f0f0f0;background:#fafafa;position:sticky;top:0;z-index:2}' +
  'td{padding:7px 10px;border-bottom:1px solid #f9fafb;font-size:12px;color:#374151;vertical-align:middle}' +
  'tr:last-child>td{border-bottom:none}.bl-row:hover>td{background:#f8fafc}' +
  '.row-blocked td{background:#fff1f2!important}.row-blocked:hover td{background:#ffe4e6!important}' +
  '.row-fixing td{background:#fffbeb!important}.row-fixing:hover td{background:#fef3c7!important}' +
  '.expand-icon{display:inline-block;width:14px;font-size:9px;color:#9ca3af;transition:transform .2s;text-align:center;user-select:none}' +
  '.expand-icon.open{transform:rotate(90deg)}.no-expand{visibility:hidden}' +
  '.az-link{color:inherit;text-decoration:none}.az-link:hover{text-decoration:underline;color:#1d4ed8}' +
  '.title-link{color:#111827}.title-link:hover{color:#1d4ed8}' +
  '.tc-id{font-size:10px;font-family:"DM Mono",monospace;color:#9ca3af}.tc-id:hover{color:#1d4ed8}' +
  '.children-cell{padding:0!important;border:none!important;background:#f8fafc!important}' +
  '.children-wrap{display:grid;grid-template-columns:1fr 1fr;border-top:2px solid #e0e7ff;border-bottom:1px solid #e5e7eb}' +
  '.children-col{padding:12px 14px;border-right:1px solid #e5e7eb}.children-col:last-child{border-right:none}' +
  '.col-header{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid #e5e7eb}' +
  '.col-doing{color:#1d4ed8}.col-done{color:#15803d}' +
  '.cards-wrap{display:flex;flex-direction:column;gap:6px}' +
  '.empty-col{font-size:11px;color:#9ca3af;padding:5px 0;font-style:italic}' +
  '.task-card{border-radius:7px;padding:8px 10px;border:1px solid}' +
  '.tc-doing{background:#eff6ff;border-color:#bfdbfe}.tc-done{background:#f0fdf4;border-color:#bbf7d0;opacity:.85}' +
  '.tc-head{display:flex;align-items:center;gap:5px;margin-bottom:3px}' +
  '.tc-title{font-size:11px;color:#111827;font-weight:500;margin-bottom:4px;line-height:1.35}' +
  '.tc-title a,.tc-title a:visited{color:#111827}.tc-title a:hover{color:#1d4ed8}' +
  '.tc-foot{display:flex;align-items:center;justify-content:space-between}' +
  '.tc-hours{font-size:10px;font-family:"DM Mono",monospace;color:#6b7280}' +
  '.tc-assigned{font-size:10px;color:#9ca3af;margin-top:3px}' +
  '.tc-badge{font-size:9px!important;padding:1px 4px!important}.tc-sbadge{font-size:10px!important;padding:1px 6px!important}' +
  '.badge{font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;white-space:nowrap}' +
  '.badge-pbi{background:#eff6ff;color:#1d4ed8}.badge-bug{background:#fef2f2;color:#b91c1c}' +
  '.badge-task{background:#f0fdf4;color:#15803d}.badge-defect{background:#fff7ed;color:#c2410c}' +
  '.sbadge{font-size:10px;font-weight:500;padding:2px 8px;border-radius:20px;white-space:nowrap}' +
  '.s-done{background:#f0fdf4;color:#15803d}.s-doing{background:#eff6ff;color:#1d4ed8}' +
  '.s-todo{background:#f3f4f6;color:#374151}.s-blocked{background:#fef2f2;color:#b91c1c}.s-fixing{background:#fffbeb;color:#92400e}' +
  '.exec-cell{white-space:nowrap}' +
  '.mini-av{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-size:9px;font-weight:600;margin-right:2px;cursor:default;border:1.5px solid white}' +
  '.text-muted{color:#9ca3af;font-size:11px}' +
  '.text-center{text-align:center}.mono{font-family:"DM Mono",monospace}' +
  '.id-cell{font-family:"DM Mono",monospace;font-size:11px;color:#9ca3af}' +
  '.title-cell{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.rem-col{color:#1d4ed8;font-family:"DM Mono",monospace;font-size:11px}' +

  '.burn-wrap{padding:14px;display:flex;flex-direction:column;gap:12px}' +
  '.b-label{display:flex;justify-content:space-between;font-size:11px;color:#6b7280;margin-bottom:4px}' +
  '.b-track{background:#f3f4f6;border-radius:4px;height:8px;overflow:hidden}' +
  '.b-fill{height:100%;border-radius:4px;transition:width .5s ease}' +
  '.bg-green{background:#16a34a}.bg-blue{background:#1d4ed8}' +

  // 2-card rhythm grid
  '.rhythm-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
  '.rhythm-card{border-radius:9px;padding:10px 12px;border:1px solid;text-align:center}' +
  '.rhythm-label{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}' +
  '.rhythm-val{font-size:22px;font-weight:600;font-family:"DM Mono",monospace;line-height:1;margin-bottom:3px}' +
  '.rhythm-sub{font-size:9px;opacity:.8}' +

  // Ver mais button + panel
  '.ver-mais-btn{width:100%;margin-top:6px;padding:5px 0;font-size:11px;font-weight:500;color:#6b7280;background:none;border:none;border-top:1px dashed #e5e7eb;cursor:pointer;font-family:"DM Sans",sans-serif;text-align:center;transition:color .15s}' +
  '.ver-mais-btn:hover{color:#1d4ed8}' +
  '.ver-mais-panel{margin-top:6px;display:flex;flex-direction:column;gap:5px}' +
  '.act-row{background:#f9fafb;border:1px solid #f0f0f0;border-radius:7px;padding:7px 10px}' +
  '.act-name{font-size:10px;font-weight:600;color:#374151;margin-bottom:5px;text-transform:uppercase;letter-spacing:.03em}' +
  '.act-stats{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:6px;align-items:center}' +
  '.act-stat-item{display:flex;flex-direction:column;gap:1px}' +
  '.act-stat-label{font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em}' +
  '.act-stat-val{font-size:13px;font-weight:600;font-family:"DM Mono",monospace}' +
  '.act-bar-wrap{display:flex;align-items:center;gap:6px}' +
  '.act-bar-track{flex:1;height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden}' +
  '.act-bar-fill{height:100%;border-radius:3px;transition:width .4s}' +

  // Section mini label (above tasks + day offs)
  '.section-mini-label{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#9ca3af;margin-bottom:7px}' +

  // Tasks stat — em aberto agora é cinza, finalizadas verde
  '.tasks-split{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
  '.task-stat{border-radius:8px;padding:10px 12px;text-align:center;border:1px solid}' +
  '.task-stat-val{font-size:22px;font-weight:600;font-family:"DM Mono",monospace;line-height:1}' +
  '.task-stat-label{font-size:9px;margin-top:3px;text-transform:uppercase;letter-spacing:.05em;font-weight:600}' +
  '.ts-open{background:#f3f4f6;border-color:#d1d5db}.ts-open .task-stat-val{color:#374151}.ts-open .task-stat-label{color:#6b7280}' +
  '.ts-done{background:#f0fdf4;border-color:#bbf7d0}.ts-done .task-stat-val{color:#15803d}.ts-done .task-stat-label{color:#15803d}' +

  // Day off cards — mais chamativos: fundo amarelo-âmbar com ícone
  '.dayoff-section{}' +
  '.dayoff-scroll{display:flex;flex-wrap:wrap;gap:7px;padding:2px 0}' +
  '.dayoff-card{background:#fffbeb;border:1.5px solid #f59e0b;border-radius:9px;padding:8px 11px;min-width:80px;box-shadow:0 1px 4px rgba(245,158,11,.15)}' +
  '.dayoff-date{font-size:12px;font-weight:700;color:#92400e;font-family:"DM Mono",monospace;margin-bottom:6px;display:flex;align-items:center;gap:4px}' +
  '.dayoff-date-icon{font-size:11px}' +
  '.dayoff-member{display:flex;align-items:center;gap:5px;margin-top:3px}' +
  '.dayoff-name{font-size:11px;color:#78350f;font-weight:500}' +
  '.dayoff-av{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#fde68a;color:#92400e;font-size:8px;font-weight:700;flex-shrink:0}' +
  '.empty-dayoff{font-size:11px;color:#9ca3af;font-style:italic;padding:4px 0}' +
  '.empty-dayoff{font-size:11px;color:#9ca3af;font-style:italic;padding:4px 0}' +

  // Tabela membros
  '.avatar{width:26px;height:26px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
  '.member-name{font-size:12px;font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.member-role{font-size:10px;color:#9ca3af;margin-top:1px}' +
  '.cap-cell{vertical-align:middle}.daysoff-hint{font-size:10px;color:#d97706;margin-top:2px}' +
  '.alloc-track{display:inline-block;width:64px;height:6px;background:#f3f4f6;border-radius:3px;vertical-align:middle}' +
  '.alloc-fill{height:100%;border-radius:3px}' +

  // Insights styles
  '.insights-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px}' +
  '.insight-card{border-radius:9px;padding:12px 14px;border:1px solid;position:relative}' +
  '.insight-head{display:flex;align-items:center;gap:7px;margin-bottom:5px}' +
  '.insight-icon{font-size:14px;flex-shrink:0}.insight-title{font-size:12px;font-weight:600;flex:1}' +
  '.insight-remove{margin-left:auto;background:none;border:none;cursor:pointer;font-size:11px;color:#9ca3af;padding:0 2px;line-height:1;border-radius:3px;flex-shrink:0}' +
  '.insight-remove:hover{color:#dc2626;background:rgba(220,38,38,.08)}' +
  '.insight-body{font-size:11px;color:#374151;line-height:1.55}' +
  '.insight-error{font-size:11px;color:#dc2626;padding:8px;font-style:italic}' +
  // Loading skeleton
  '.insights-loading{padding:24px;display:flex;flex-direction:column;align-items:center;gap:10px}' +
  '.loading-spinner{width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#1d4ed8;border-radius:50%;animation:spin .8s linear infinite}' +
  '@keyframes spin{to{transform:rotate(360deg)}}' +
  '.loading-text{font-size:12px;color:#6b7280;font-style:italic}' +
  // Footer controls
  '.insights-footer{padding:10px 14px;border-top:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}' +
  '.ai-badge{display:flex;align-items:center;gap:5px;font-size:10px;color:#6b7280;font-style:italic}' +
  '.ai-dot{width:5px;height:5px;border-radius:50%;background:#a855f7;animation:blink 2s infinite}' +
  '.insights-actions{display:flex;gap:6px;flex-wrap:wrap}' +
  '.btn-insight-action{font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid #e5e7eb;background:white;color:#374151;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:500;display:flex;align-items:center;gap:5px}' +
  '.btn-insight-action:hover{background:#f9fafb;border-color:#93c5fd;color:#1d4ed8}' +
  '.btn-insight-action.loading{opacity:.6;cursor:wait}' +
  '.btn-insight-action.danger{border-color:#fecaca;color:#dc2626}' +
  '.btn-insight-action.danger:hover{background:#fff5f5;border-color:#f87171}' +
  '.btn-download{position:fixed;bottom:20px;right:20px;z-index:100;display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:22px;border:none;background:#0d1b2a;color:white;font-size:12px;font-weight:500;font-family:"DM Sans",sans-serif;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.25);transition:background .15s}' +
  '.btn-download:hover{background:#1a73e8}' +
  // Pergunta livre
  '.question-panel{padding:12px 14px;border-top:1px solid #f0f0f0;display:none}' +
  '.question-panel.open{display:block}' +
  '.question-input-row{display:flex;gap:8px;margin-bottom:8px}' +
  '.question-input{flex:1;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;font-family:"DM Sans",sans-serif;color:#111827}' +
  '.question-input:focus{outline:none;border-color:#1a73e8;box-shadow:0 0 0 3px rgba(26,115,232,.1)}' +
  '.btn-ask{padding:8px 16px;border-radius:8px;border:none;background:#1a73e8;color:white;font-size:12px;font-family:"DM Sans",sans-serif;font-weight:500;cursor:pointer;white-space:nowrap}' +
  '.btn-ask:hover{background:#1557b0}' +
  '.btn-ask:disabled{opacity:.5;cursor:wait}' +
  '.question-note{font-size:10px;color:#9ca3af}' +
  // Cards de resposta de perguntas
  '.answers-list{display:flex;flex-direction:column;gap:8px;margin-top:4px}' +
  '.answer-card{border-radius:9px;padding:11px 13px;border:1px solid #e0e7ff;background:#f5f7ff}' +
  '.answer-q{font-size:10px;font-weight:600;color:#4338ca;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}' +
  '.answer-body{font-size:11px;color:#374151;line-height:1.55}' +
  '.answer-loading{font-size:11px;color:#6b7280;font-style:italic;padding:6px 0;display:flex;align-items:center;gap:6px}' +
  '</style></head><body>' +

  // ── Topbar ───────────────────────────────────────────────
  '<div class="topbar"><div class="tl">' +
    '<div class="logo"><svg viewBox="0 0 24 24"><path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zm0 9h7v7h-7v-7zM4 13h7v7H4v-7z"/></svg></div>' +
    '<span class="proj">'+_esc(cfg.project)+'</span>' +
    '<span class="org">/ '+_esc(cfg.org)+'</span>' +
  '</div>' +
  '<div class="sprint-block">' +
    '<div class="sprint-row1">' +
      '<div class="sdot"></div>' +
      '<span class="sprint-name">'+_esc(sprintLabel)+'</span>' +
      (sp.bizDaysLeft>0
        ? '<span class="days-pill">'+sp.bizDaysLeft+' dia'+(sp.bizDaysLeft!==1?'s úteis':' útil')+'</span>'
        : '<span class="days-pill" style="background:#7f1d1d;border-color:#991b1b;color:#fca5a5">Encerrada</span>') +
    '</div>' +
    '<span class="sprint-dates">'+_esc(startStr)+' até '+_esc(endStr)+'</span>' +
  '</div></div>' +

  // Botões flutuantes de download
  '<div style="position:fixed;bottom:20px;right:20px;z-index:100;display:flex;flex-direction:column;gap:8px;align-items:flex-end">' +
    '<button class="btn-download" onclick="downloadPDF(this)" title="Baixar como PDF">📄 Baixar PDF</button>' +
    '<button class="btn-download" style="background:#374151" onclick="downloadDashboard()" title="Baixar como HTML">⬇ Baixar HTML</button>' +
  '</div>' +

  '<div class="main">' +

  // ── KPIs ─────────────────────────────────────────────────
  '<p class="sec-label" style="margin-top:4px">Visão geral da sprint</p>' +
  '<div class="kpi-grid">' +
    _kpi("Total",s.total,"","PBIs + defects") +
    _kpi("Concluídos",s.done,"green",s.donePct+"% do total") +
    _kpi("Em progresso",s.inProgress,"blue","em andamento") +
    _kpi("Bloqueados",s.blocked,s.blocked>0?"kpi-alert":"","aguardam desbloqueio") +
    _kpi("Em fixing",s.fixing,s.fixing>0?"kpi-alert":"","correção/ajuste") +
    _kpi("Demandas alocadas",s.allocPct+"%",s.allocPct>100?"red":s.allocPct>80?"yellow":"green",
         s.totalRem+"h rem. / "+s.capacityTotal+"h cap.") +
  '</div>' +

  // ── Backlog + Progresso ───────────────────────────────────
  '<div class="layout">' +

    '<div class="panel">' +
      '<div class="ph"><span class="pt">Backlog da Sprint</span><span class="pc" id="bl-count">'+data.backlog.length+' itens</span></div>' +
      '<div class="ftabs">' +
        '<button class="ftab active" onclick="filterBL(\'all\',this)">Todos</button>' +
        '<button class="ftab" onclick="filterBL(\'todo\',this)">To Do</button>' +
        '<button class="ftab" onclick="filterBL(\'doing\',this)">Em progresso</button>' +
        '<button class="ftab" onclick="filterBL(\'done\',this)">Concluído</button>' +
        '<button class="ftab" onclick="filterBL(\'blocked\',this)">Bloqueados</button>' +
        '<button class="ftab" onclick="filterBL(\'fixing\',this)">Fixing</button>' +
      '</div>' +
      '<div class="tbl-wrap"><table>' +
        '<thead><tr><th style="width:18px"></th><th>Tipo</th><th>ID</th><th>Título</th><th>Status</th>' +
        '<th>Executores</th><th class="text-center">SP</th><th class="text-center">Rem.</th></tr></thead>' +
        '<tbody id="bl-tbody">'+backlogRows+'</tbody></table></div>' +
    '</div>' +

    '<div class="panel">' +
      '<div class="ph"><span class="pt">Progresso</span></div>' +
      '<div class="burn-wrap">' +

        // Itens de backlog concluídos
        '<div><div class="b-label"><span>Itens de backlog concluídos</span><span>'+s.done+' / '+s.total+'</span></div>' +
        '<div class="b-track"><div class="b-fill bg-green" style="width:'+Math.min(s.donePct,100)+'%"></div></div></div>' +

        // Capacidade alocada
        '<div><div class="b-label"><span>Capacidade alocada</span><span>'+s.totalRem+'h / '+s.capacityTotal+'h</span></div>' +
        '<div class="b-track"><div class="b-fill" style="width:'+capBarPct+'%;background:'+capBarColor+'"></div></div></div>' +

        // 2 cards: Capacidade/dia vs Ritmo necessário + "Ver mais" por atividade
        (function() {
          var capDay  = s.bizDays > 0 ? (s.capacityTotal / s.bizDays).toFixed(1) : "—";
          var rytDay  = s.bizDays > 0 && s.totalRem > 0 ? (s.totalRem / s.bizDays).toFixed(1) : "0";
          var capDayN = parseFloat(capDay) || 0;
          var rytDayN = parseFloat(rytDay) || 0;
          var rytColor, rytBg, rytBorder;
          if (rytDayN > capDayN)                              { rytColor="#dc2626"; rytBg="#fef2f2"; rytBorder="#fecaca"; }
          else if (capDayN > 0 && rytDayN/capDayN > 0.8)     { rytColor="#d97706"; rytBg="#fffbeb"; rytBorder="#fde68a"; }
          else                                                 { rytColor="#1d4ed8"; rytBg="#eff6ff"; rytBorder="#bfdbfe"; }

          // Linhas do "Ver mais" — por tipo de atividade
          var actRows = "";
          Object.keys(s.byActivity).sort().forEach(function(act) {
            var a       = s.byActivity[act];
            var aCapDay = s.bizDays > 0 ? (a.capRest / s.bizDays).toFixed(1) : "—";
            var aRytDay = s.bizDays > 0 && a.remaining > 0 ? (a.remaining / s.bizDays).toFixed(1) : "0";
            var aCN     = parseFloat(aCapDay) || 0;
            var aRN     = parseFloat(aRytDay) || 0;
            var aAllocPct = a.capRest > 0 ? Math.min(Math.round((a.remaining/a.capRest)*100),999) : 0;
            var aColor  = aRN > aCN ? "#dc2626" : aCN > 0 && aRN/aCN > 0.8 ? "#d97706" : "#15803d";
            var barPct  = Math.min(aAllocPct, 100);
            var barClr  = aRN > aCN ? "#dc2626" : aCN > 0 && aRN/aCN > 0.8 ? "#f59e0b" : "#16a34a";
            actRows +=
              '<div class="act-row">' +
                '<div class="act-name">'+_esc(act)+'</div>' +
                '<div class="act-stats">' +
                  '<div class="act-stat-item">' +
                    '<span class="act-stat-label">Cap/dia</span>' +
                    '<span class="act-stat-val" style="color:#15803d">'+aCapDay+'h</span>' +
                  '</div>' +
                  '<div class="act-stat-item">' +
                    '<span class="act-stat-label">Ritmo/dia</span>' +
                    '<span class="act-stat-val" style="color:'+aColor+'">'+aRytDay+'h</span>' +
                  '</div>' +
                  '<div class="act-stat-item act-bar-wrap">' +
                    '<div class="act-bar-track"><div class="act-bar-fill" style="width:'+barPct+'%;background:'+barClr+'"></div></div>' +
                    '<span class="act-stat-val" style="color:'+aColor+'">'+aAllocPct+'%</span>' +
                  '</div>' +
                '</div>' +
              '</div>';
          });

          return '<div class="rhythm-grid">' +
            '<div class="rhythm-card" style="background:#f0fdf4;border-color:#bbf7d0">' +
              '<div class="rhythm-label" style="color:#15803d">Cap. disponível/dia</div>' +
              '<div class="rhythm-val" style="color:#15803d">'+capDay+'h</div>' +
              '<div class="rhythm-sub" style="color:#16a34a">'+s.memberCount+' membro(s) · '+s.bizDays+'d úteis</div>' +
            '</div>' +
            '<div class="rhythm-card" style="background:'+rytBg+';border-color:'+rytBorder+'">' +
              '<div class="rhythm-label" style="color:'+rytColor+'">Ritmo necessário/dia</div>' +
              '<div class="rhythm-val" style="color:'+rytColor+'">'+rytDay+'h</div>' +
              '<div class="rhythm-sub" style="color:'+rytColor+'">'+s.totalRem+'h restantes</div>' +
            '</div>' +
          '</div>' +
          '<button class="ver-mais-btn" onclick="toggleVerMais()" id="vm-btn">Ver por atividade ▾</button>' +
          '<div class="ver-mais-panel" id="vm-panel" style="display:none">' +
            actRows +
          '</div>';
        })() +

        // Tasks — legenda + cards lado a lado
        '<div>' +
          '<div class="section-mini-label">Tarefas da sprint</div>' +
          '<div class="tasks-split">' +
            '<div class="task-stat ts-open">' +
              '<div class="task-stat-val">'+s.totalTasksOpen+'</div>' +
              '<div class="task-stat-label">Em aberto</div>' +
            '</div>' +
            '<div class="task-stat ts-done">' +
              '<div class="task-stat-val">'+s.totalTasksDone+'</div>' +
              '<div class="task-stat-label">Finalizadas</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Day offs
        '<div class="dayoff-section">' +
          '<div class="section-mini-label">Day offs restantes na sprint</div>' +
          '<div class="dayoff-scroll">'+dayOffHtml+'</div>' +
        '</div>' +

      '</div>' +
    '</div>' +

  '</div>' + // .layout

  // ── Insights ─────────────────────────────────────────────
  '<p class="sec-label">Insights de IA</p>' +
  '<div class="panel" style="margin-bottom:14px">' +
    // Loading inicial — substituído via JS quando insights chegarem
    '<div id="insights-loading" class="insights-loading">' +
      '<div class="loading-spinner"></div>' +
      '<div class="loading-text">Consultando ' + _esc(llmBadge) + ' e analisando a sprint...</div>' +
    '</div>' +
    // Grid de insights — populado assincronamente
    '<div id="insights-grid" class="insights-grid" style="display:none"></div>' +
    // Painel de pergunta livre
    '<div class="question-panel" id="question-panel">' +
      '<div class="question-input-row">' +
        '<input type="text" class="question-input" id="question-input" ' +
          'placeholder="Ex: Quem tem mais risco de não entregar? Qual a saúde do QA?">' +
        '<button class="btn-ask" id="btn-ask" onclick="sendQuestion()">Perguntar</button>' +
      '</div>' +
      '<div class="question-note">Cada pergunta gera um novo card de resposta abaixo</div>' +
      '<div class="answers-list" id="answers-list"></div>' +
    '</div>' +
    // Footer com controles
    '<div class="insights-footer">' +
      '<div class="ai-badge"><div class="ai-dot"></div>Gerado por ' + _esc(llmBadge) + ' · temperatura 0.2</div>' +
      '<div class="insights-actions">' +
        '<button class="btn-insight-action" id="btn-refresh" onclick="refreshInsights(this)">' +
          '↻ Mais insights' +
        '</button>' +
        '<button class="btn-insight-action danger" onclick="clearInsights()">' +
          '✕ Limpar insights' +
        '</button>' +
        '<button class="btn-insight-action" id="btn-ask-toggle" onclick="toggleQuestion()">' +
          '💬 Fazer pergunta' +
        '</button>' +
      '</div>' +
    '</div>' +
  '</div>' +

  // ── Distribuição por responsável ─────────────────────────
  '<p class="sec-label">Distribuição por responsável</p>' +
  '<div class="panel" style="margin-bottom:20px"><div class="tbl-wrap">' +
    '<table><thead><tr><th></th><th>Membro / Atividade</th>' +
    '<th class="text-center">Cap. restante</th>' +
    '<th class="text-center">Rem. work</th>' +
    '<th>% Alocado</th>' +
    '<th class="text-center">Tasks finalizadas</th>' +
    '</tr></thead><tbody>'+memberRows+'</tbody></table></div></div>' +

  '</div>' + // .main

  // ── JS da tabela de backlog ───────────────────────────────
  '<script>' +
  'var blMeta='+JSON.stringify(data.backlog.map(function(b){return{state:b.state,bs:b.blockStatus,id:String(b.id)};}))+';' +
  'var allBLRows;' +
  'function getRows(){if(!allBLRows)allBLRows=Array.from(document.querySelectorAll("#bl-tbody tr.bl-row"));return allBLRows;}' +
  'var _pb64="' + insightPayloadB64 + '";' +
  'var _insightTimer=null;' +
  'function _startInsightTimeout(cb){_insightTimer=setTimeout(function(){_insightTimer=null;cb();},90000);}' +
  'function _clearInsightTimeout(){if(_insightTimer){clearTimeout(_insightTimer);_insightTimer=null;}}' +
  'function loadInsights(){' +
    'var ld=document.getElementById("insights-loading");' +
    '_startInsightTimeout(function(){' +
      'ld.innerHTML="<div class=\\"insight-error\\">⏱ Tempo esgotado. Clique em ↻ para tentar novamente.</div>";' +
    '});' +
    'google.script.run' +
      '.withSuccessHandler(function(html){' +
        '_clearInsightTimeout();' +
        'ld.style.display="none";' +
        'var grid=document.getElementById("insights-grid");' +
        'grid.innerHTML=html;grid.style.display="grid";' +
      '})' +
      '.withFailureHandler(function(e){' +
        '_clearInsightTimeout();' +
        'ld.innerHTML="<div class=\\"insight-error\\">❌ "+(e&&e.message?e.message:"falha")+"</div>";' +
      '})' +
      '.callLlmWithData(_pb64);' +
  '}' +
  'function refreshInsights(btn){' +
    'if(btn){btn.classList.add("loading");btn.textContent="Gerando...";}' +
    'var spinEl=document.createElement("div");' +
    'spinEl.className="insights-loading";spinEl.style.cssText="padding:10px;";' +
    'spinEl.innerHTML="<div class=\\"loading-spinner\\"></div><div class=\\"loading-text\\">Buscando mais insights...</div>";' +
    'var grid=document.getElementById("insights-grid");' +
    'grid.parentNode.insertBefore(spinEl,grid);' +
    '_startInsightTimeout(function(){' +
      'if(spinEl.parentNode)spinEl.parentNode.removeChild(spinEl);' +
      'if(btn){btn.classList.remove("loading");btn.textContent="↻ Mais insights";}' +
    '});' +
    'google.script.run' +
      '.withSuccessHandler(function(html){' +
        '_clearInsightTimeout();' +
        'if(spinEl.parentNode)spinEl.parentNode.removeChild(spinEl);' +
        'var existingTitles=Array.from(grid.querySelectorAll(".insight-title")).map(function(el){return el.textContent.trim().toLowerCase();});' +
        'var tmp=document.createElement("div");tmp.innerHTML=html;' +
        'var newCards=Array.from(tmp.querySelectorAll(".insight-card"));' +
        'var added=0;' +
        'newCards.forEach(function(card){' +
          'var t=card.querySelector(".insight-title");' +
          'var title=t?t.textContent.trim().toLowerCase():"";' +
          'if(!existingTitles.includes(title)){grid.appendChild(card);existingTitles.push(title);added++;}' +
        '});' +
        'grid.style.display="grid";' +
        'if(btn){btn.classList.remove("loading");btn.textContent="↻ Mais insights"+(added>0?" (+"+added+")":"");}' +
        'if(added>0)grid.lastElementChild.scrollIntoView({behavior:"smooth",block:"nearest"});' +
      '})' +
      '.withFailureHandler(function(e){' +
        '_clearInsightTimeout();' +
        'if(spinEl.parentNode)spinEl.parentNode.removeChild(spinEl);' +
        'if(btn){btn.classList.remove("loading");btn.textContent="↻ Mais insights";}' +
      '})' +
      '.callLlmWithData(_pb64);' +
  '}' +
  'function toggleQuestion(){' +
    'var panel=document.getElementById("question-panel");' +
    'var btn=document.getElementById("btn-ask-toggle");' +
    'var isOpen=panel.classList.contains("open");' +
    'panel.classList.toggle("open");' +
    'btn.textContent=isOpen?"\ud83d\udcac Fazer pergunta":"\u2715 Fechar perguntas";' +
    'if(!isOpen)document.getElementById("question-input").focus();' +
  '}' +
  'function sendQuestion(){' +
    'var input=document.getElementById("question-input");' +
    'var q=input.value.trim();if(!q)return;' +
    'var list=document.getElementById("answers-list");' +
    'var askBtn=document.getElementById("btn-ask");' +
    'if(askBtn.disabled)return;' +
    'var ph=document.createElement("div");' +
    'ph.className="answer-loading";' +
    'ph.innerHTML="<div class=\\"loading-spinner\\" style=\\"width:14px;height:14px;border-width:2px\\"></div> Consultando LLM...";' +
    'list.appendChild(ph);ph.scrollIntoView({behavior:"smooth",block:"end"});' +
    'askBtn.disabled=true;input.disabled=true;' +
    'var qSnap=q;input.value="";' +
    // Timeout de 60s para desbloquear UI
    'var qtimer=setTimeout(function(){' +
      'askBtn.disabled=false;input.disabled=false;' +
      'ph.innerHTML="<span style=\\"color:#d97706\\">⏱ Tempo esgotado. Tente novamente.</span>";' +
    '},60000);' +
    'google.script.run' +
      '.withSuccessHandler(function(html){' +
        'clearTimeout(qtimer);' +
        'askBtn.disabled=false;input.disabled=false;input.focus();' +
        'var card=document.createElement("div");' +
        'card.className="answer-card";' +
        'card.innerHTML="<div class=\\"answer-q\\">❓ "+qSnap+"</div>"+html;' +
        'list.replaceChild(card,ph);' +
        'card.scrollIntoView({behavior:"smooth",block:"nearest"});' +
      '})' +
      '.withFailureHandler(function(e){' +
        'clearTimeout(qtimer);' +
        'askBtn.disabled=false;input.disabled=false;' +
        'ph.innerHTML="<span style=\\"color:#dc2626\\">❌ "+(e&&e.message?e.message:"falha")+"</span>";' +
      '})' +
      '.askQuestionWithData(qSnap);' +
  '}' +
  'document.addEventListener("DOMContentLoaded",function(){' +
    'loadInsights();' +
    'var inp=document.getElementById("question-input");' +
    'if(inp)inp.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey)sendQuestion();});' +
  '});' +
  'function filterBL(f,btn){' +
    'var rows=getRows();' +
    'document.querySelectorAll(".ftab").forEach(function(b){b.classList.remove("active")});btn.classList.add("active");' +
    'var count=0;' +
    'rows.forEach(function(row,i){' +
      'var d=blMeta[i];' +
      'var show=f==="all"||(f==="blocked"&&d.bs==="BLOCKED")||(f==="fixing"&&d.bs==="FIXING")' +
        '||(f==="done"&&d.state==="Done"&&d.bs==="CLEAR")||(f==="doing"&&d.state==="In Progress"&&d.bs==="CLEAR")' +
        '||(f==="todo"&&d.state!=="Done"&&d.state!=="In Progress"&&d.bs==="CLEAR");' +
      'row.style.display=show?"":"none";' +
      'if(!show){var cr=document.getElementById("cr-"+d.id);var ico=document.getElementById("ico-"+d.id);' +
        'if(cr)cr.style.display="none";if(ico)ico.classList.remove("open");}' +
      'if(show)count++;' +
    '});document.getElementById("bl-count").textContent=count+" itens";' +
  '}' +
  'function removeInsight(btn){' +
    'var card=btn.closest(".insight-card");' +
    'if(card)card.remove();' +
  '}' +
  'function clearInsights(){' +
    'var grid=document.getElementById("insights-grid");' +
    'if(grid){grid.innerHTML="";grid.style.display="none";}' +
    'var al=document.getElementById("answers-list");' +
    'if(al)al.innerHTML="";' +
  '}' +
  'function downloadPDF(btn){' +
    'var orig=btn.textContent;' +
    'btn.textContent="⏳ Gerando PDF...";btn.disabled=true;' +
    'google.script.run' +
      '.withSuccessHandler(function(url){' +
        'btn.textContent=orig;btn.disabled=false;' +
        'if(url){var a=document.createElement("a");a.href=url;a.target="_blank";document.body.appendChild(a);a.click();a.remove();}' +
      '})' +
      '.withFailureHandler(function(e){' +
        'btn.textContent=orig;btn.disabled=false;' +
        'alert("Erro ao gerar PDF: "+(e&&e.message?e.message:"falha"));' +
      '})' +
      '.generateDashboardPDF();' +
  '}' +
  'function downloadDashboard(){' +
    'var btn=event&&event.target?event.target:null;' +
    'if(btn){var orig=btn.textContent;btn.textContent="⏳ Gerando...";btn.disabled=true;}' +
    'google.script.run' +
      '.withSuccessHandler(function(html){' +
        'if(btn){btn.textContent=orig;btn.disabled=false;}' +
        'var blob=new Blob([html],{type:"text/html;charset=utf-8"});' +
        'var url=URL.createObjectURL(blob);' +
        'var a=document.createElement("a");' +
        'a.href=url;a.download="dashboard-sprint.html";' +
        'document.body.appendChild(a);a.click();' +
        'setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);' +
      '})' +
      '.withFailureHandler(function(e){' +
        'if(btn){btn.textContent=orig;btn.disabled=false;}' +
        'alert("Erro: "+(e&&e.message?e.message:"falha"));' +
      '})' +
      '.getDashboardHtml();' +
  '}' +
  'function toggleVerMais(){' +
    'var p=document.getElementById("vm-panel");' +
    'var b=document.getElementById("vm-btn");' +
    'if(!p)return;' +
    'var open=p.style.display==="none"||p.style.display==="";' +
    'p.style.display=open?"block":"none";' +
    'b.textContent=open?"Ocultar ▴":"Ver por atividade ▾";' +
  '}' +
  'function toggleChildren(id){' +
    'var cr=document.getElementById("cr-"+id);var ico=document.getElementById("ico-"+id);if(!cr)return;' +
    'var hidden=cr.style.display===""||cr.style.display==="none";' +
    'cr.style.display=hidden?"table-row":"none";' +
    'if(ico){hidden?ico.classList.add("open"):ico.classList.remove("open");}' +
  '}' +
  '<\/script></body></html>';
}

// ── Helpers ───────────────────────────────────────────────────
function _kpi(label, value, colorCls, sub) {
  var isAlert   = colorCls === "kpi-alert";
  var cardCls   = isAlert ? ' kpi-alert' : '';
  var valCls    = (!isAlert && colorCls) ? ' '+colorCls : '';
  return '<div class="kpi'+cardCls+'">' +
    '<div class="kpi-label">'+label+'</div>' +
    '<div class="kpi-val'+valCls+'">'+value+'</div>' +
    '<div class="kpi-sub">'+sub+'</div>' +
  '</div>';
}


function _esc(str) {
  return String(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// ── Retorna HTML standalone do dashboard (para download) ─────
function getDashboardHtml() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var cfg  = readConfig(ss);
  var data = _collectDashboardData(ss, cfg);
  var html = _buildDashboardHtml(data, cfg);

  // 1. Gera insights server-side
  var insightsHtml = "";
  try {
    var llm = getActiveLlm();
    if (llm && llm.token) {
      var rag      = getActiveRagContext();
      var stats    = data.stats;
      var capacity = data.capacity;
      var byAct    = stats.byActivity || {};
      var insights = _callLlm(llm, stats, capacity, byAct, rag, data.tasks, data.backlog);
      insights     = _validateInsights(insights, stats, capacity, rag);
      insightsHtml = _renderInsightCards(insights);
    }
  } catch(e) {
    insightsHtml = '<div style="color:#9ca3af;font-size:12px;padding:8px">Insights: ' + e.message.substring(0,80) + '</div>';
  }

  // 2. Substituições usando indexOf para evitar problemas com regex em string minificada

  // Substitui spinner+grid vazio pelo grid com insights
  var loadingStart = html.indexOf('<div id="insights-loading"');
  var gridStart    = html.indexOf('<div id="insights-grid"');
  // Encontra o fechamento do div vazio do grid (style="display:none"></div>)
  var gridDivEnd   = html.indexOf('></div>', gridStart);
  var gridEnd      = gridDivEnd !== -1 ? gridDivEnd + 7 : -1; // 7 = len('></div>')
  if (loadingStart !== -1 && gridEnd > loadingStart) {
    html = html.substring(0, loadingStart) +
           '<div id="insights-grid" class="insights-grid" style="display:grid">' + insightsHtml + '</div>' +
           html.substring(gridEnd);
  }

  // Remove painel de perguntas
  var qStart = html.indexOf('<div class="question-panel"');
  var qEnd   = html.indexOf('<div class="insights-footer"');
  if (qStart !== -1 && qEnd > qStart) {
    html = html.substring(0, qStart) + html.substring(qEnd);
  }

  // Remove footer com botões interativos (Mais insights, Limpar, Fazer pergunta)
  var fStart = html.indexOf('<div class="insights-footer">');
  var fEnd   = html.indexOf('</div></div></div>', fStart);
  if (fStart !== -1 && fEnd !== -1) {
    html = html.substring(0, fStart) + html.substring(fEnd + 18); // 18 = len('</div></div></div>')
  }

  // Remove botões de download flutuantes
  var dlStart = html.indexOf('<div style="position:fixed;bottom:20px;right:20px');
  var dlEnd   = html.indexOf('<div class="main">');
  if (dlStart !== -1 && dlEnd > dlStart) {
    html = html.substring(0, dlStart) + html.substring(dlEnd);
  }

  // Remove botão X dos cards
  html = html.split('<button class="insight-remove"').join('<button class="insight-remove-hidden" style="display:none"');

  // 3. Substitui script por versão offline
  var blMetaJson = JSON.stringify(data.backlog.map(function(b){
    return {state: b.state, bs: b.blockStatus, id: String(b.id)};
  }));
  var scriptStart = html.indexOf('<script>');
  var scriptEnd   = html.indexOf('</script>') + 9;
  if (scriptStart !== -1 && scriptEnd > scriptStart) {
    var standaloneScript =
      // CSS de impressão — elimina scroll, expande tudo, formata para papel
      '<style media="print">' +
        '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
        'html,body{height:auto!important;overflow:visible!important}' +
        '.tbl-wrap{overflow:visible!important;max-height:none!important}' +
        '.children-row{display:table-row!important}' +  // expande todos os filhos
        '.ver-mais-panel{display:block!important}' +     // expande "ver por atividade"
        '.question-panel,.insights-footer,.btn-download,' +
        '.expand-icon,.ftabs,.ph span.pc{display:none!important}' +
        'table{page-break-inside:auto}' +
        'tr{page-break-inside:avoid;page-break-after:auto}' +
        '.panel{page-break-inside:avoid;overflow:visible!important}' +
        '.layout{grid-template-columns:1fr!important}' + // coluna única no papel
        '.insights-grid{grid-template-columns:1fr!important}' +
        '@page{margin:15mm}' +
      '</style>' +
      '<script>' +
      'var blMeta=' + blMetaJson + ';' +
      'var allBLRows;' +
      'function getRows(){if(!allBLRows)allBLRows=Array.from(document.querySelectorAll(\'#bl-tbody tr.bl-row\'));return allBLRows;}' +
      'function filterBL(f,btn){' +
        'var rows=getRows();' +
        'document.querySelectorAll(\'.ftab\').forEach(function(b){b.classList.remove(\'active\')});btn.classList.add(\'active\');' +
        'var count=0;' +
        'rows.forEach(function(row,i){' +
          'var d=blMeta[i];if(!d){row.style.display=\'\';count++;return;}' +
          'var show=f===\'all\'||(f===\'blocked\'&&d.bs===\'BLOCKED\')||(f===\'fixing\'&&d.bs===\'FIXING\')' +
            '||(f===\'done\'&&d.state===\'Done\'&&d.bs===\'CLEAR\')||(f===\'doing\'&&d.state===\'In Progress\'&&d.bs===\'CLEAR\')' +
            '||(f===\'todo\'&&d.state!==\'Done\'&&d.state!==\'In Progress\'&&d.bs===\'CLEAR\');' +
          'row.style.display=show?\'\':\'none\';if(show)count++;' +
        '});' +
        'var cnt=document.getElementById(\'bl-count\');if(cnt)cnt.textContent=count+\' itens\';' +
      '}' +
      'function toggleChildren(id){var cr=document.getElementById(\'cr-\'+id);var ico=document.getElementById(\'ico-\'+id);if(!cr)return;var hidden=cr.style.display===\'\'||cr.style.display===\'none\';cr.style.display=hidden?\'table-row\':\'none\';if(ico){hidden?ico.classList.add(\'open\'):ico.classList.remove(\'open\');}}' +
      'function toggleVerMais(){var p=document.getElementById(\'vm-panel\');var b=document.getElementById(\'vm-btn\');if(!p)return;var open=p.style.display===\'none\'||p.style.display===\'\';p.style.display=open?\'block\':\'none\';b.textContent=open?\'Ocultar \u25b4\':\'Ver por atividade \u25be\';}' +
      // Auto-expande tudo antes de imprimir
      'window.addEventListener(\'beforeprint\',function(){' +
        'document.querySelectorAll(\'.children-row\').forEach(function(r){r.style.display=\'table-row\';});' +
        'document.querySelectorAll(\'.expand-icon\').forEach(function(i){i.classList.add(\'open\');});' +
        'var vm=document.getElementById(\'vm-panel\');if(vm)vm.style.display=\'block\';' +
      '});' +
      '</script>';
    html = html.substring(0, scriptStart) + standaloneScript + html.substring(scriptEnd);
  }

  return html;
}

function generateDashboardPDF() {
  try {
    var html     = getDashboardHtml();
    var fileName = "AgileViewAI_Dashboard_" +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm");

    var htmlFile = DriveApp.createFile(fileName + ".html", html, MimeType.HTML);
    var pdfBlob  = htmlFile.getAs(MimeType.PDF).setName(fileName + ".pdf");
    var pdfFile  = DriveApp.createFile(pdfBlob);
    htmlFile.setTrashed(true);

    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://drive.google.com/uc?export=download&id=" + pdfFile.getId();

  } catch(e) {
    Logger.log("generateDashboardPDF error: " + e.message);
    throw new Error("Não foi possível gerar o PDF: " + e.message);
  }
}
