// ============================================================
//  data_processor.gs  —  Orquestração da sincronização
// ============================================================

// ── Garante abas necessárias para o sync (sem cross-file deps) ─
function _ensureSyncSheets(ss) {
  var needed = {
    "Presentation & Config": null,
    "Sprint_Info":        ["Caminho da Sprint","Início","Fim","Sprint Ativa?","Dias Úteis Restantes"],
    "Raw_Backlog_Data":   ["ID","Tipo","Título","Status","Severidade","Bloqueio","Responsável","Story Points","Tags","Remaining Work (h)"],
    "Raw_Task_Data":      ["ID","Parent ID","Tipo","Título","Status","Horas Restantes","Horas Concluídas","Responsável","Atividade","Bloqueio"],
    "Raw_Capacity_Data":  ["Membro","Atividade","Cap. por Dia (h)","Days Off (datas)","Total Days Off Sprint","Cap. Total Sprint (h)","Cap. Restante (h)"]
  };
  Object.keys(needed).forEach(function(name) {
    var headers = needed[name];
    var sheet   = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      if (headers) {
        sheet.getRange(1,1,1,headers.length).setValues([headers])
             .setFontWeight("bold").setBackground("#1a73e8").setFontColor("white");
        sheet.setFrozenRows(1);
      }
    }
  });
}

// ── Conta dias úteis entre hoje e fim da sprint (UTC-safe) ───
// Inclui o dia atual (mesmo comportamento do Azure DevOps).
function _countBusinessDays(startDate, endDate) {
  var count = 0;
  var cur   = new Date(startDate);
  cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate()));
  var end = new Date(endDate);
  end = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  // Não avança mais o cursor — inclui o dia de início (hoje) na contagem
  while (cur <= end) {
    var dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

// ── Conta dias úteis de day off no intervalo [from, end] ─────
// from: Date (hoje UTC), end: Date (fim da sprint UTC)
// daysOffArr: array de { start: "2025-03-19T00:00:00Z", end: "..." }
function _countFutureDaysOff(daysOffArr, fromDate, endDate) {
  var count = 0;
  if (!daysOffArr || daysOffArr.length === 0) return count;

  var from = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  var end  = new Date(Date.UTC(endDate.getUTCFullYear(),  endDate.getUTCMonth(),  endDate.getUTCDate()));

  daysOffArr.forEach(function(off) {
    if (!off.start) return;
    var offStart = new Date(off.start);
    offStart = new Date(Date.UTC(offStart.getUTCFullYear(), offStart.getUTCMonth(), offStart.getUTCDate()));
    var offEnd   = off.end ? new Date(off.end) : new Date(offStart);
    offEnd   = new Date(Date.UTC(offEnd.getUTCFullYear(), offEnd.getUTCMonth(), offEnd.getUTCDate()));

    var cur = new Date(offStart);
    while (cur <= offEnd) {
      var dow = cur.getUTCDay();
      if (dow !== 0 && dow !== 6 && cur >= from && cur <= end) count++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  });
  return count;
}

// ── Formata datas de day off para string legível ──────────────
function _fmtDaysOff(daysOffArr, tz) {
  if (!daysOffArr || daysOffArr.length === 0) return "";
  return daysOffArr.map(function(off) {
    if (!off.start) return "";
    var s = Utilities.formatDate(new Date(off.start), tz, "dd/MM");
    if (off.end && off.end !== off.start) {
      var e = Utilities.formatDate(new Date(off.end), tz, "dd/MM");
      return s + "–" + e;
    }
    return s;
  }).filter(Boolean).join(", ");
}

// ── Resolve estado de bloqueio/fixing ────────────────────────
function _resolveBlockStatus(fields) {
  if (fields["Microsoft.VSTS.CMMI.Blocked"] === "Yes") return "BLOCKED";
  var st = (fields["System.State"] || "").toLowerCase();
  if (st.indexOf("block") !== -1) return "BLOCKED";
  if (st.indexOf("fixing") !== -1 || st.indexOf("fix ") !== -1 || st === "fix" ||
      st.indexOf("corre") !== -1  || st.indexOf("ajuste") !== -1 || st.indexOf("reopen") !== -1)
    return "FIXING";
  return "CLEAR";
}

// ── Ponto de entrada ─────────────────────────────────────────
function startSync() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // Garante apenas as abas que o sync precisa (sem depender de outros arquivos)
  _ensureSyncSheets(ss);

  var cfg = readConfig(ss);
  if (!cfg) { ui.alert("❌ Aba 'Presentation & Config' não encontrada."); return; }

  cfg = _promptMissingFields(ss, ui, cfg);
  if (!cfg) return;

  var confirm = ui.alert(
    "🚀 Iniciar Sincronização",
    "• Organização: " + cfg.org     + "\n" +
    "• Projeto:     " + cfg.project + "\n" +
    "• Time:        " + cfg.team    + "\n" +
    "• PAT:         " + cfg.pat.substring(0, 6) + "••••••••\n\nDeseja continuar?",
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  setConfigStatus(ss, "⏳ Sincronizando...");

  try {
    _runSync(ss, ui, cfg);
  } catch (e) {
    setConfigStatus(ss, "❌ Erro: " + e.message.substring(0, 100));
    ui.alert("❌ Erro na Sincronização:\n\n" + e.message);
    Logger.log(e.stack);
  }
}

// ── Solicita campos vazios ────────────────────────────────────
function _promptMissingFields(ss, ui, cfg) {
  var config = ss.getSheetByName("Presentation & Config");
  var fields = [
    { key: "org",     cell: "B3", label: "Nome da Organização (B3)"   },
    { key: "project", cell: "B4", label: "Nome do Projeto (B4)"        },
    { key: "pat",     cell: "B5", label: "PAT (Token de Acesso) (B5)"  },
    { key: "team",    cell: "B6", label: "Nome do Time (B6)"           }
  ];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (!cfg[f.key]) {
      var res = ui.prompt("Campo obrigatório vazio",
        "'" + f.label + "' está vazio. Digite o valor:", ui.ButtonSet.OK_CANCEL);
      if (res.getSelectedButton() !== ui.Button.OK) { ui.alert("Cancelado."); return null; }
      var val = res.getResponseText().trim();
      if (!val) { ui.alert("Valor vazio. Cancelado."); return null; }
      cfg[f.key] = val;
      config.getRange(f.cell).setValue(val);
    }
  }
  return cfg;
}

// ── Sincronização principal ───────────────────────────────────
function _runSync(ss, ui, cfg) {
  var org = cfg.org, project = cfg.project, pat = cfg.pat, team = cfg.team;
  var tz  = Session.getScriptTimeZone();

  // 1. Sprints ────────────────────────────────────────────────
  var iterations       = getIterations(org, project, team, pat);
  var sprintRows       = [];
  var activeSprintPath = "";
  var activeSprintEnd  = null;
  var activeIterationId = "";
  var today = new Date(); today.setHours(0, 0, 0, 0);

  iterations.forEach(function(it) {
    var start  = it.attributes && it.attributes.startDate  ? new Date(it.attributes.startDate)  : null;
    var finish = it.attributes && it.attributes.finishDate ? new Date(it.attributes.finishDate) : null;
    var status  = "NÃO";
    var bizLeft = "";

    if (start && finish) {
      var s        = new Date(Date.UTC(start.getUTCFullYear(),  start.getUTCMonth(),  start.getUTCDate()));
      var f        = new Date(Date.UTC(finish.getUTCFullYear(), finish.getUTCMonth(), finish.getUTCDate()));
      var todayUTC = new Date(Date.UTC(today.getFullYear(),     today.getMonth(),     today.getDate()));
      if (todayUTC >= s && todayUTC <= f) {
        status            = "SIM";
        activeSprintPath  = it.path;
        activeSprintEnd   = finish;
        activeIterationId = it.id;
        bizLeft           = _countBusinessDays(today, finish);
      }
    }
    sprintRows.push([
      it.path,
      start  ? Utilities.formatDate(start,  "UTC", "dd/MM/yyyy") : "",
      finish ? Utilities.formatDate(finish, "UTC", "dd/MM/yyyy") : "",
      status,
      bizLeft
    ]);
  });

  _writeToSheet(ss, "Sprint_Info", sprintRows);

  if (!activeSprintPath) {
    throw new Error("Nenhuma Sprint ativa para hoje (" +
      Utilities.formatDate(today, tz, "dd/MM/yyyy") + ").");
  }

  // 2. Capacidade do time ─────────────────────────────────────
  var capacityRaw  = getTeamCapacity(org, project, team, pat, activeIterationId);
  var capacityRows = [];
  // Map: memberName → { capPerDay, daysOffFuture, capRestante, activity }
  var capacityMap  = {};

  var bizDaysTotal = activeSprintEnd ? _countBusinessDays(
    new Date(iterations.filter(function(it){ return it.id === activeIterationId; })[0].attributes.startDate),
    activeSprintEnd
  ) : 0;
  var bizDaysLeft  = activeSprintEnd ? _countBusinessDays(today, activeSprintEnd) : 0;

  capacityRaw.forEach(function(entry) {
    if (!entry.teamMember) return;
    var name       = entry.teamMember.displayName || "";
    var daysOffArr = entry.daysOff || [];
    var activities = entry.activities || [];

    // Pega a primeira atividade (geralmente só tem uma, mas pode ter várias)
    var actName  = activities.length > 0 ? (activities[0].name || "Não definido") : "Não definido";
    var capDay   = activities.length > 0 ? (activities[0].capacityPerDay || 0) : 0;

    // Days off totais na sprint
    var daysOffTotal = _countFutureDaysOff(daysOffArr,
      new Date(iterations.filter(function(it){ return it.id === activeIterationId; })[0].attributes.startDate),
      activeSprintEnd || today
    );

    // Days off restantes a partir de hoje
    var daysOffFuture = _countFutureDaysOff(daysOffArr, today, activeSprintEnd || today);

    // Capacidade total da sprint = (bizDaysTotal - daysOffTotal) × capDay
    var capTotal = Math.max(bizDaysTotal - daysOffTotal, 0) * capDay;

    // Capacidade restante = (bizDaysLeft - daysOffFuture) × capDay
    var capRest  = Math.max(bizDaysLeft - daysOffFuture, 0) * capDay;

    // Datas de day off para exibição
    var daysOffStr = _fmtDaysOff(daysOffArr, tz);

    capacityRows.push([
      name, actName, capDay, daysOffStr,
      daysOffTotal, capTotal, capRest
    ]);

    // Armazena para uso no dashboard
    capacityMap[name] = {
      activity:     actName,
      capPerDay:    capDay,
      daysOffFuture: daysOffFuture,
      daysOffTotal: daysOffTotal,
      daysOffArr:   daysOffArr,   // array bruto para dashboard
      capTotal:     capTotal,
      capRest:      capRest
    };
  });

  _writeToSheet(ss, "Raw_Capacity_Data", capacityRows);

  // 3. IDs dos itens ──────────────────────────────────────────
  var ids = getWorkItemIds(org, project, pat, activeSprintPath);
  if (ids.length === 0) {
    setConfigStatus(ss, "⚠️ Sprint ativa sem itens");
    ui.alert("⚠️ Sprint ativa sem itens.\nCaminho: " + activeSprintPath);
    return;
  }

  // 4. Detalhes e separação ───────────────────────────────────
  var workItems   = getWorkItemsBatch(org, project, pat, ids);
  var backlogData = [];
  var taskData    = [];

  workItems.forEach(function(wi) {
    if (!wi || !wi.fields) return;
    var f    = wi.fields;
    var type = f["System.WorkItemType"] || "";

    var assignedTo = "";
    if (f["System.AssignedTo"]) {
      assignedTo = typeof f["System.AssignedTo"] === "object"
        ? (f["System.AssignedTo"].displayName || "")
        : String(f["System.AssignedTo"]);
    }

    var blockStatus = _resolveBlockStatus(f);
    var parentId    = f["System.Parent"] || "";

    var isBacklogLevel = type === "Product Backlog Item" || type === "Defect" || (type === "Bug" && !parentId);
    var isChildLevel   = type === "Task" || (type === "Bug" && !!parentId);

    if (isBacklogLevel) {
      backlogData.push([
        wi.id, type, f["System.Title"] || "", f["System.State"] || "",
        f["Microsoft.VSTS.Common.Severity"] || "N/A", blockStatus, assignedTo,
        f["Microsoft.VSTS.Scheduling.StoryPoints"] || 0, f["System.Tags"] || "", 0
      ]);
    } else if (isChildLevel) {
      taskData.push([
        wi.id, parentId, type, f["System.Title"] || "", f["System.State"] || "",
        f["Microsoft.VSTS.Scheduling.RemainingWork"] || 0,
        f["Microsoft.VSTS.Scheduling.CompletedWork"]  || 0,
        assignedTo, f["Microsoft.VSTS.Common.Activity"] || "", blockStatus
      ]);
    }
  });

  // 5. Soma remaining work por parent ─────────────────────────
  var remByParent = {};
  taskData.forEach(function(t) {
    var pid = t[1];
    if (!pid) return;
    remByParent[pid] = (remByParent[pid] || 0) + (t[5] || 0);
  });
  backlogData.forEach(function(row) { row[9] = remByParent[row[0]] || 0; });

  _writeToSheet(ss, "Raw_Backlog_Data", backlogData);
  _writeToSheet(ss, "Raw_Task_Data",    taskData);

  setConfigStatus(ss, "✅ Sincronizado com sucesso");

  var bloqueados = backlogData.filter(function(r){ return r[5] === "BLOCKED"; }).length;
  var fixing     = backlogData.filter(function(r){ return r[5] === "FIXING";  }).length;
  var concluidos = backlogData.filter(function(r){ return r[3] === "Done";    }).length;
  var horasRest  = taskData.reduce(function(a,r){ return a + (r[5] || 0); }, 0);

  ui.alert(
    "✅ Sincronização concluída!\n\n" +
    "Sprint: " + activeSprintPath + "\n" +
    "Dias úteis restantes: " + bizDaysLeft + "\n\n" +
    "Capacidade cadastrada: " + capacityRows.length + " membros\n" +
    "Backlog: " + backlogData.length + " itens\n" +
    "• Concluídos: " + concluidos + "  • Bloqueados: " + bloqueados + "  • Fixing: " + fixing + "\n" +
    "Filhos (Tasks + Bugs): " + taskData.length + " itens · " + horasRest + "h restantes\n\n" +
    "Abrindo o Dashboard..."
  );

  // Abre o dashboard automaticamente após a sincronização
  openDashboard();
}

// ── Escreve dados mantendo cabeçalhos ─────────────────────────
function _writeToSheet(ss, name, data) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Aba '" + name + "' não encontrada. Rode 'Configurar Planilha' primeiro.");
  clearSheetData(sheet);
  if (data && data.length > 0) {
    sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
    for (var i = 0; i < data.length; i++) {
      sheet.getRange(i + 2, 1, 1, data[0].length)
           .setBackground(i % 2 === 0 ? "#ffffff" : "#f8f9fa");
    }
  }
}
