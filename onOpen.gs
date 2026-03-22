// ============================================================
//  onOpen.gs  —  Menu AgileViewAI
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("AgileViewAI")
    .addItem("⚙️  Setup",             "setupSpreadsheet")
    .addSeparator()
    .addItem("👥  Selecionar time",   "openTeamsManager")
    .addSeparator()
    .addItem("🔄  Sync",              "startSync")
    .addSeparator()
    .addItem("📊  Abrir Dash",        "openDashboard")
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu("🤖  IA & Configurações")
      .addItem("Configurar tokens de LLM",          "openLlmManager")
      .addItem("Cadastrar RAG / Treinamento",        "openRagManager")
      .addSeparator()
      .addItem("🔍 Ver contexto RAG enviado ao LLM", "debugRagContext")
      .addItem("🔍 Ver configuração e URL do Azure", "debugConfig")
    )
    .addToUi();
}
