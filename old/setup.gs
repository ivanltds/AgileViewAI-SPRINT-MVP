// ============================================================
//  setup.gs  —  Criação e validação de todas as abas
// ============================================================

var SHEET_CONFIG = {
  "Presentation & Config": null,
  "Sprint_Info": [
    "Caminho da Sprint","Início","Fim","Sprint Ativa?","Dias Úteis Restantes"
  ],
  "Raw_Backlog_Data": [
    "ID","Tipo","Título","Status","Severidade","Bloqueio",
    "Responsável","Story Points","Tags","Remaining Work (h)"
  ],
  "Raw_Task_Data": [
    "ID","Parent ID","Tipo","Título","Status",
    "Horas Restantes","Horas Concluídas","Responsável","Atividade","Bloqueio"
  ],
  "Raw_Capacity_Data": [
    "Membro","Atividade","Cap. por Dia (h)","Days Off (datas)",
    "Total Days Off Sprint","Cap. Total Sprint (h)","Cap. Restante (h)"
  ]
};

var CONFIG_LABELS = [
  ["Campo",               "Valor"],
  ["",                    ""],
  ["Organização",         ""],
  ["Projeto",             ""],
  ["PAT (Token)",         ""],
  ["Nome do Time",        ""],
  ["",                    ""],
  ["Última Sincronização","Nunca"],
  ["Status",              "Aguardando configuração"]
];

// ── Ponto de entrada principal ────────────────────────────────
function setupSpreadsheet() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var log = [];

  // Abas de dados do Azure
  log.push(_setupConfigSheet(ss));
  Object.keys(SHEET_CONFIG).forEach(function(name) {
    if (name === "Presentation & Config") return;
    log.push(_ensureSheet(ss, name, SHEET_CONFIG[name]));
  });

  // Abas de times — definidas em teams_manager.gs
  try { _ensureTeamsSheets(ss); log.push("• 'Teams' e 'Organizations': ok"); }
  catch(e) { log.push("• Times: " + e.message); }

  // Abas de IA — definidas em llm_manager.gs / rag_manager.gs
  try { _ensureLlmSheet(ss); log.push("• 'LLM_Config': ok"); }
  catch(e) { log.push("• LLM: " + e.message); }

  try { _ensureRagSheet(ss); log.push("• 'RAG_Context': ok"); }
  catch(e) { log.push("• RAG: " + e.message); }

  ui.alert(
    "✅ AgileViewAI — Setup concluído!\n\n" +
    log.join("\n") +
    "\n\nPróximos passos:\n" +
    "1. 👥 Selecionar time → cadastre seus times\n" +
    "2. 🤖 IA & Configurações → adicione um token LLM\n" +
    "3. 📚 IA & Configurações → cadastre contexto RAG (opcional)\n" +
    "4. 🔄 Sync → sincronize a sprint ativa"
  );
}

// ── Aba Presentation & Config ─────────────────────────────────
function _setupConfigSheet(ss) {
  var sheetName = "Presentation & Config";
  var sheet     = ss.getSheetByName(sheetName);
  var action    = sheet ? "validada" : "criada";
  if (!sheet) sheet = ss.insertSheet(sheetName, 0);

  CONFIG_LABELS.forEach(function(row, i) {
    var r = i + 1;
    if (sheet.getRange(r, 1).getValue() !== row[0]) sheet.getRange(r, 1).setValue(row[0]);
    if (row[1] !== "" && sheet.getRange(r, 2).getValue() === "") sheet.getRange(r, 2).setValue(row[1]);
  });

  sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#1a73e8").setFontColor("white");
  sheet.getRange("A3:A9").setFontWeight("bold");
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 350);
  sheet.getRange("B5").setNumberFormat("@");

  return "• '" + sheetName + "': " + action;
}

// ── Cria / valida aba de dados ────────────────────────────────
function _ensureSheet(ss, name, expectedHeaders) {
  var sheet  = ss.getSheetByName(name);
  var action = sheet ? "validada" : "criada";
  if (!sheet) sheet = ss.insertSheet(name);
  _validateAndFixHeaders(sheet, expectedHeaders);
  return "• '" + name + "': " + action;
}

// ── Verifica / corrige cabeçalhos ─────────────────────────────
function _validateAndFixHeaders(sheet, expectedHeaders) {
  var currentHeaders = [];
  if (sheet.getLastColumn() > 0) {
    currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn())
                         .getValues()[0]
                         .map(function(v) { return v.toString().trim(); });
  }

  var needsUpdate = currentHeaders.length !== expectedHeaders.length;
  if (!needsUpdate) {
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (currentHeaders[i] !== expectedHeaders[i]) { needsUpdate = true; break; }
    }
  }

  if (needsUpdate) {
    sheet.getRange(1, 1, 1, Math.max(expectedHeaders.length, sheet.getLastColumn() || 1))
         .clearContent();
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    sheet.getRange(1, 1, 1, expectedHeaders.length)
         .setFontWeight("bold").setBackground("#1a73e8").setFontColor("white");
  }

  sheet.setFrozenRows(1);
  for (var c = 1; c <= expectedHeaders.length; c++) sheet.autoResizeColumn(c);
}

// ── Utilitários usados pelo data_processor ────────────────────
function clearSheetData(sheet) {
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).clearContent();
}

function setConfigStatus(ss, status) {
  var config = ss.getSheetByName("Presentation & Config");
  if (!config) return;
  config.getRange("B9").setValue(status);
  config.getRange("B8").setValue(
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss")
  );
}

function readConfig(ss) {
  var config = ss.getSheetByName("Presentation & Config");
  if (!config) return null;
  return {
    org:     config.getRange("B3").getValue().toString().trim(),
    project: config.getRange("B4").getValue().toString().trim(),
    pat:     config.getRange("B5").getValue().toString().trim(),
    team:    config.getRange("B6").getValue().toString().trim()
  };
}
