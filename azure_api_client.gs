// ============================================================
//  azure_api_client.gs  —  Comunicação com a API do Azure DevOps
// ============================================================

function _authHeader(pat) {
  return { "Authorization": "Basic " + Utilities.base64Encode(":" + pat) };
}

// ── Iterações (Sprints) ───────────────────────────────────────
function getIterations(org, project, team, pat) {
  // ATENÇÃO: o nome do time NÃO deve ser codificado com encodeURIComponent
  // pois isso transforma espaços em %20 e caracteres como '(' em %28,
  // causando 404. A API aceita o nome do time com espaços codificados
  // apenas como %20 — usamos encodeURIComponent só em org e project.
  var encodedTeam = team.split(" ").map(encodeURIComponent).join("%20");

  var url = "https://dev.azure.com/"
    + encodeURIComponent(org) + "/"
    + encodeURIComponent(project) + "/"
    + encodedTeam
    + "/_apis/work/teamsettings/iterations?api-version=7.1";

  Logger.log("getIterations URL: " + url);

  var resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: _authHeader(pat),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error(
      "Erro " + code + " ao buscar Sprints.\n\n" +
      "URL tentada: " + url + "\n\n" +
      "Verifique:\n" +
      "• B3 Organização: " + org + "\n" +
      "• B4 Projeto:     " + project + "\n" +
      "• B6 Time:        " + team + "\n" +
      "• B5 PAT válido e com escopo 'Work Items (Read)'\n\n" +
      "Detalhe: " + resp.getContentText().substring(0, 300)
    );
  }

  var parsed = JSON.parse(resp.getContentText());
  if (!parsed.value || parsed.value.length === 0) {
    throw new Error(
      "API retornou 200 mas sem sprints para o time: " + team + "\n" +
      "Confirme o nome exato do Time no Azure DevOps (sensível a maiúsculas)."
    );
  }
  return parsed.value;
}

// ── Diagnóstico de configuração ───────────────────────────────
// Chame pelo menu para ver exatamente o que está sendo usado nas chamadas
function debugConfig() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var cfg = readConfig(ss);
  if (!cfg) { ui.alert("Aba 'Presentation & Config' não encontrada."); return; }

  var encodedTeam = cfg.team.split(" ").map(encodeURIComponent).join("%20");
  var urlPreview  = "https://dev.azure.com/" +
    encodeURIComponent(cfg.org) + "/" +
    encodeURIComponent(cfg.project) + "/" +
    encodedTeam + "/_apis/work/teamsettings/iterations?api-version=7.1";

  ui.alert(
    "🔍 Configuração atual (Presentation & Config)\n\n" +
    "B3 Organização: [" + cfg.org     + "]\n" +
    "B4 Projeto:     [" + cfg.project + "]\n" +
    "B5 PAT:         [" + (cfg.pat ? cfg.pat.substring(0,6) + "••••••••" : "VAZIO") + "]\n" +
    "B6 Time:        [" + cfg.team    + "]\n\n" +
    "URL que será chamada:\n" + urlPreview + "\n\n" +
    "Se o time estiver errado, use:\n" +
    "AgileViewAI → Selecionar time → Ativar o time correto."
  );
}
// Imprime no Logger o JSON bruto retornado pela API de capacity.
// Use em Extensões > Apps Script > Logger para inspecionar a resposta.
function debugCapacity() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var cfg = readConfig(ss);

  if (!cfg || !cfg.org || !cfg.pat) {
    ui.alert("Configure os campos antes de depurar.");
    return;
  }

  // Busca as iterações para pegar o GUID da sprint ativa
  var iterations = getIterations(cfg.org, cfg.project, cfg.team, cfg.pat);
  var today      = new Date();
  var activeIt   = null;

  iterations.forEach(function(it) {
    if (!it.attributes || !it.attributes.startDate || !it.attributes.finishDate) return;
    var s = new Date(it.attributes.startDate);
    var f = new Date(it.attributes.finishDate);
    if (today >= s && today <= f) activeIt = it;
  });

  if (!activeIt) {
    ui.alert("Nenhuma sprint ativa encontrada.");
    return;
  }

  var iterationId = activeIt.id;
  Logger.log("Sprint ativa: " + activeIt.path + " | ID: " + iterationId);

  var encodedTeam = cfg.team.split(" ").map(encodeURIComponent).join("%20");

  var urls = [
    "https://dev.azure.com/" + encodeURIComponent(cfg.org) + "/" +
      encodeURIComponent(cfg.project) + "/" + encodedTeam +
      "/_apis/work/teamsettings/iterations/" + encodeURIComponent(iterationId) +
      "/capacities?api-version=7.1",

    "https://dev.azure.com/" + encodeURIComponent(cfg.org) + "/" +
      encodeURIComponent(cfg.project) +
      "/_apis/work/teamsettings/iterations/" + encodeURIComponent(iterationId) +
      "/capacities?api-version=7.1",

    "https://dev.azure.com/" + encodeURIComponent(cfg.org) + "/" +
      encodeURIComponent(cfg.project) + "/" + encodedTeam +
      "/_apis/work/teamsettings/iterations/" + encodeURIComponent(iterationId) +
      "/capacities?api-version=6.0"
  ];

  var results = [];
  urls.forEach(function(url, i) {
    var resp = UrlFetchApp.fetch(url, {
      method: "get",
      headers: _authHeader(cfg.pat),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    var body = resp.getContentText().substring(0, 800);
    Logger.log("--- URL " + (i+1) + " | HTTP " + code + " ---");
    Logger.log(body);
    results.push("URL " + (i+1) + " → HTTP " + code + "\n" + body.substring(0, 200));
  });

  ui.alert("Diagnóstico concluído.\n\nVeja o Logger em Extensões > Apps Script.\n\n" +
    results.join("\n\n---\n\n").substring(0, 1200));
}

// ── Capacidade do time para uma sprint específica ─────────────
//
// Endpoint: GET /{org}/{project}/{team}/_apis/work/teamsettings/iterations/{iterationId}/capacities
//
// A API pode retornar em dois formatos dependendo da versão/tenant:
//   Formato A: { "value": [ { teamMember, activities, daysOff }, ... ] }
//   Formato B: { "teamMembers": [...] }   (versões mais antigas)
//   Formato C: array direto [ { teamMember, ... }, ... ]
//
// Esta função tenta todos os formatos e variantes de URL.
function getTeamCapacity(org, project, team, pat, iterationId) {
  var encodedTeam = team.split(" ").map(encodeURIComponent).join("%20");

  var variants = [
    "https://dev.azure.com/" + encodeURIComponent(org) + "/" +
      encodeURIComponent(project) + "/" + encodedTeam +
      "/_apis/work/teamsettings/iterations/" + encodeURIComponent(iterationId) +
      "/capacities?api-version=7.1",

    "https://dev.azure.com/" + encodeURIComponent(org) + "/" +
      encodeURIComponent(project) +
      "/_apis/work/teamsettings/iterations/" + encodeURIComponent(iterationId) +
      "/capacities?api-version=7.1",

    "https://dev.azure.com/" + encodeURIComponent(org) + "/" +
      encodeURIComponent(project) + "/" + encodedTeam +
      "/_apis/work/teamsettings/iterations/" + encodeURIComponent(iterationId) +
      "/capacities?api-version=6.0"
  ];

  for (var v = 0; v < variants.length; v++) {
    var resp = UrlFetchApp.fetch(variants[v], {
      method: "get",
      headers: _authHeader(pat),
      muteHttpExceptions: true
    });

    var code = resp.getResponseCode();
    Logger.log("Capacity variant " + (v+1) + " | HTTP " + code + " | URL: " + variants[v]);

    if (code !== 200) continue;

    var body;
    try {
      body = JSON.parse(resp.getContentText());
    } catch (e) {
      Logger.log("Capacity: JSON parse error: " + e.message);
      continue;
    }

    // Tenta extrair o array de membros em todos os formatos conhecidos
    var members = _extractCapacityMembers(body);
    if (members && members.length > 0) {
      Logger.log("Capacity: encontrados " + members.length + " membros via variante " + (v+1));
      return members;
    }

    // Retornou 200 mas vazio — loga para diagnóstico
    Logger.log("Capacity variante " + (v+1) + " retornou 200 mas sem membros. Body: " +
      resp.getContentText().substring(0, 400));
  }

  Logger.log("Capacity: nenhuma variante retornou dados. Execute debugCapacity() para inspecionar.");
  return [];
}

// ── Extrai o array de membros do payload, qualquer formato ────
//
// Ordem de prioridade baseada no diagnóstico do tenant:
//   1. { "teamMembers": [...] }   ← URLs 1 e 2 deste tenant
//   2. { "count": N, "value": [...] }  ← URL 3 (api-version 6.0)
//   3. Array direto na raiz
//   4. Objeto único
//
function _extractCapacityMembers(body) {
  if (!body) return [];

  var _filter = function(arr) {
    return (Array.isArray(arr) ? arr : []).filter(function(item) {
      return item && item.teamMember && item.teamMember.displayName;
    });
  };

  // Prioridade 1: teamMembers (formato predominante neste tenant)
  if (body.teamMembers && Array.isArray(body.teamMembers) && body.teamMembers.length > 0) {
    var r = _filter(body.teamMembers);
    if (r.length > 0) return r;
  }

  // Prioridade 2: value (api-version 6.0 retorna { count, value })
  if (body.value && Array.isArray(body.value) && body.value.length > 0) {
    var r = _filter(body.value);
    if (r.length > 0) return r;
  }

  // Prioridade 3: array direto
  if (Array.isArray(body)) {
    var r = _filter(body);
    if (r.length > 0) return r;
  }

  // Prioridade 4: objeto único
  if (body.teamMember && body.teamMember.displayName) return [body];

  return [];
}

// ── IDs dos itens via WIQL ────────────────────────────────────
function getWorkItemIds(org, project, pat, sprintPath) {
  var url = "https://dev.azure.com/"
    + encodeURIComponent(org) + "/"
    + encodeURIComponent(project)
    + "/_apis/wit/wiql?api-version=7.1";

  var safePath    = sprintPath.replace(/'/g, "''");
  var safeProject = project.replace(/'/g, "''");

  var query = {
    query:
      "SELECT [System.Id] FROM WorkItems " +
      "WHERE [System.TeamProject] = '" + safeProject + "' " +
      "AND [System.IterationPath] UNDER '" + safePath + "' " +
      "AND [System.State] <> 'Removed' " +
      "ORDER BY [System.Id]"
  };

  var resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: _authHeader(pat),
    payload: JSON.stringify(query),
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() !== 200) {
    Logger.log("WIQL erro: " + resp.getContentText());
    return [];
  }

  var data = JSON.parse(resp.getContentText());
  return data.workItems ? data.workItems.map(function(wi) { return wi.id; }) : [];
}

// ── Detalhes em lote (paginado a cada 200) ────────────────────
function getWorkItemsBatch(org, project, pat, ids) {
  if (!ids || ids.length === 0) return [];

  var all       = [];
  var chunkSize = 200;
  var fields = [
    "System.Id",
    "System.WorkItemType",
    "System.Title",
    "System.State",
    "System.Parent",
    "System.AssignedTo",
    "System.Tags",
    "Microsoft.VSTS.Common.Severity",
    "Microsoft.VSTS.CMMI.Blocked",
    "Microsoft.VSTS.Scheduling.StoryPoints",
    "Microsoft.VSTS.Scheduling.RemainingWork",
    "Microsoft.VSTS.Scheduling.CompletedWork",
    "Microsoft.VSTS.Common.Activity"
  ].join(",");

  for (var i = 0; i < ids.length; i += chunkSize) {
    var chunk = ids.slice(i, i + chunkSize);
    var url   = "https://dev.azure.com/"
      + encodeURIComponent(org) + "/"
      + encodeURIComponent(project)
      + "/_apis/wit/workitems?ids=" + chunk.join(",")
      + "&fields=" + encodeURIComponent(fields)
      + "&api-version=7.1";

    var resp = UrlFetchApp.fetch(url, {
      method: "get",
      headers: _authHeader(pat),
      muteHttpExceptions: true
    });

    if (resp.getResponseCode() === 200) {
      var items = JSON.parse(resp.getContentText()).value;
      if (items) all = all.concat(items);
    } else {
      Logger.log("Batch chunk " + i + " erro: " + resp.getContentText());
    }
  }
  return all;
}

// ── Wrappers de diagnóstico (garantem que as funções existam) ─
// debugRagContext vive no TeamsManager.gs — este wrapper garante
// que o menu encontre a função mesmo se houver problema de ordem
// de carregamento de arquivos no Apps Script.
function debugRagContext() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var rag = getActiveRagContext();

  if (!rag) {
    ui.alert(
      "RAG vazio.\n\n" +
      "Nenhuma entrada ativa encontrada na aba RAG_Context.\n\n" +
      "Cadastre em: AgileViewAI → IA & Configurações → Cadastrar RAG\n" +
      "Certifique-se de que as entradas estão com status 'Ativo'."
    );
    return;
  }

  // Mostra preview no alert e log completo no Logger
  Logger.log("=== RAG Context completo ===\n" + rag);
  ui.alert(
    "✅ Contexto RAG sendo enviado ao LLM\n\n" +
    "Preview (primeiros 800 chars):\n" +
    "─────────────────────────────\n" +
    rag.substring(0, 800) +
    (rag.length > 800 ? "\n\n... (" + (rag.length - 800) + " chars adicionais — veja o Logger completo)" : "") +
    "\n─────────────────────────────\n\n" +
    "Veja o texto completo em: Extensões → Apps Script → Logger"
  );
}
