// ============================================================
//  teams_manager.gs  —  Gerenciamento de Times e Organizações
//
//  Aba "Teams":        ID | Nome | Organização | Projeto | Team Azure | PAT | Ativo? | Última Sync
//  Aba "Organizations": Organização | PAT | Adicionada em
// ============================================================

var TEAMS_SHEET = "Teams";
var ORGS_SHEET  = "Organizations";

// ── Abre a tela HTML de gerenciamento ───────────────────────
function openTeamsManager() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  _ensureTeamsSheets(ss);

  var teams    = _readAllTeams(ss);
  var orgs     = _readAllOrgs(ss);
  var activeId = "";
  teams.forEach(function(t) { if (t.active === "SIM") activeId = t.id; });

  var html = HtmlService
    .createHtmlOutput(_buildTeamsHtml(teams, orgs, activeId))
    .setTitle("Gerenciar Times")
    .setWidth(820)
    .setHeight(660);

  SpreadsheetApp.getUi().showModalDialog(html, "⚙️ Gerenciar Times");
}

// ── Garante abas de times e orgs ────────────────────────────
function _ensureTeamsSheets(ss) {
  var teamHeaders = ["ID","Nome do Time","Organização","Projeto","Team (Azure)","PAT","Ativo?","Última Sync"];
  var orgHeaders  = ["Organização","PAT","Adicionada em"];

  var ts = ss.getSheetByName(TEAMS_SHEET);
  if (!ts) {
    ts = ss.insertSheet(TEAMS_SHEET);
    ts.getRange(1,1,1,teamHeaders.length).setValues([teamHeaders])
      .setFontWeight("bold").setBackground("#1a73e8").setFontColor("white");
    ts.setFrozenRows(1);
    [60,180,140,200,200,10,70,140].forEach(function(w,i){ ts.setColumnWidth(i+1,w); });
    ts.getRange("F:F").setNumberFormat("@");
  }

  var os = ss.getSheetByName(ORGS_SHEET);
  if (!os) {
    os = ss.insertSheet(ORGS_SHEET);
    os.getRange(1,1,1,orgHeaders.length).setValues([orgHeaders])
      .setFontWeight("bold").setBackground("#1a73e8").setFontColor("white");
    os.setFrozenRows(1);
    os.setColumnWidth(1,200); os.setColumnWidth(2,320); os.setColumnWidth(3,140);
    os.getRange("B:B").setNumberFormat("@");

    // Migra org+PAT da aba legada Presentation & Config
    var cfg = ss.getSheetByName("Presentation & Config");
    if (cfg) {
      var org = cfg.getRange("B3").getValue().toString().trim();
      var pat = cfg.getRange("B5").getValue().toString().trim();
      if (org && pat) {
        os.appendRow([org, pat,
          Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")]);
      }
    }
  }
}

// ── Lê times ────────────────────────────────────────────────
function _readAllTeams(ss) {
  var sheet = ss.getSheetByName(TEAMS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues()
    .filter(function(r){ return r[0]; })
    .map(function(r){
      return { id:String(r[0]), name:String(r[1]), org:String(r[2]),
               project:String(r[3]), team:String(r[4]), pat:String(r[5]),
               active:String(r[6]), lastSync:r[7] ? String(r[7]) : "" };
    });
}

// ── Lê organizações ─────────────────────────────────────────
function _readAllOrgs(ss) {
  var sheet = ss.getSheetByName(ORGS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues()
    .filter(function(r){ return r[0]; })
    .map(function(r){ return { org:String(r[0]).trim(), pat:String(r[1]).trim() }; });
}

// ── Salva um time (chamado via google.script.run) ────────────
function saveTeam(payload) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  _ensureTeamsSheets(ss);
  var sheet = ss.getSheetByName(TEAMS_SHEET);
  var orgs  = ss.getSheetByName(ORGS_SHEET);

  var id      = String(payload.id      || "").trim();
  var name    = String(payload.name    || "").trim();
  var org     = String(payload.org     || "").trim();
  var project = String(payload.project || "").trim();
  var team    = String(payload.team    || "").trim();
  var pat     = String(payload.pat     || "").trim();
  var isNew   = payload.isNewOrg === true || payload.isNewOrg === "true";

  if (!name || !org || !project || !team) {
    return { ok:false, msg:"Preencha todos os campos obrigatórios." };
  }

  // Gerencia o PAT da organização
  var orgRows = orgs.getLastRow() > 1
    ? orgs.getRange(2,1,orgs.getLastRow()-1,2).getValues() : [];

  if (isNew) {
    if (!pat) return { ok:false, msg:"Informe o PAT para a nova organização." };
    var exists = false;
    for (var i = 0; i < orgRows.length; i++) {
      if (String(orgRows[i][0]).trim().toLowerCase() === org.toLowerCase()) {
        orgs.getRange(i+2,2).setValue(pat); // atualiza PAT
        exists = true; break;
      }
    }
    if (!exists) {
      orgs.appendRow([org, pat,
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")]);
    }
  } else {
    // Busca PAT da org existente
    pat = "";
    for (var j = 0; j < orgRows.length; j++) {
      if (String(orgRows[j][0]).trim().toLowerCase() === org.toLowerCase()) {
        pat = String(orgRows[j][1]).trim(); break;
      }
    }
    if (!pat) return { ok:false, msg:"Organização '"+org+"' não tem PAT. Cadastre como nova organização." };
  }

  // Edição ou inserção
  if (id) {
    var allRows = sheet.getLastRow() > 1
      ? sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues() : [];
    var found = false;
    for (var k = 0; k < allRows.length; k++) {
      if (String(allRows[k][0]) === id) {
        sheet.getRange(k+2,1,1,8).setValues([[
          id, name, org, project, team, pat, allRows[k][6], allRows[k][7]
        ]]);
        found = true; break;
      }
    }
    if (!found) return { ok:false, msg:"Time com ID "+id+" não encontrado." };
  } else {
    var newId = String(Date.now()); // timestamp como ID único
    sheet.appendRow([newId, name, org, project, team, pat, "NÃO", ""]);
  }

  return { ok:true, msg:"Time salvo com sucesso!" };
}

// ── Deleta um time ───────────────────────────────────────────
function deleteTeam(id) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TEAMS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return { ok:false, msg:"Nenhum time." };
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i+2);
      return { ok:true, msg:"Time removido." };
    }
  }
  return { ok:false, msg:"Time não encontrado." };
}

// ── Ativa um time ────────────────────────────────────────────
function activateTeam(id) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TEAMS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return { ok:false, msg:"Nenhum time." };

  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues();
  rows.forEach(function(r,i){
    sheet.getRange(i+2,7).setValue(String(r[0]) === String(id) ? "SIM" : "NÃO");
  });

  // Sincroniza com aba legada Presentation & Config
  var activated = null;
  rows.forEach(function(r){ if (String(r[0]) === String(id)) activated = r; });
  if (activated) {
    var cfg = ss.getSheetByName("Presentation & Config");
    if (cfg) {
      cfg.getRange("B3").setValue(activated[2]); // org
      cfg.getRange("B4").setValue(activated[3]); // project
      cfg.getRange("B5").setValue(activated[5]); // pat
      cfg.getRange("B6").setValue(activated[4]); // team
    }
  }
  return { ok:true, msg:"Time ativado!" };
}

// ── Busca um time por ID (para edição no form) ───────────────
function getTeamById(id) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var teams = _readAllTeams(ss);
  var found = null;
  teams.forEach(function(t){ if (t.id === String(id)) found = t; });
  return found;
}

// ── Retorna lista de orgs para o select do formulário ────────
function getOrgsForForm() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  _ensureTeamsSheets(ss);
  return _readAllOrgs(ss).map(function(o){ return o.org; });
}

// ── Retorna HTML das linhas da tabela (para reload parcial) ──
function getTeamsTableHtml() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var teams = _readAllTeams(ss);
  if (teams.length === 0) {
    return '<tr><td colspan="4" class="empty-row">Nenhum time cadastrado ainda</td></tr>';
  }
  var rows = "";
  teams.forEach(function(t) {
    var active = t.active === "SIM";
    rows +=
      '<tr class="team-row'+(active?" active-row":"")+'">' +
        '<td>' +
          '<div class="t-name">'+_escT(t.name)+(active?' <span class="active-badge">Ativo</span>':'')+'</div>' +
          '<div class="t-meta">'+_escT(t.org)+' / '+_escT(t.project)+'</div>' +
        '</td>' +
        '<td class="t-team">'+_escT(t.team)+'</td>' +
        '<td class="t-actions">' +
          (!active ? '<button class="btn-act" onclick=\'activateTeam("'+_escT(t.id)+'")\'> Ativar</button>' : '') +
          '<button class="btn-edt" onclick=\'editTeam("'+_escT(t.id)+'")\'> Editar</button>' +
          '<button class="btn-del" onclick=\'delTeam("'+_escT(t.id)+'")\'> Remover</button>' +
        '</td>' +
      '</tr>';
  });
  return rows;
}

// ── Builder HTML ─────────────────────────────────────────────
function _buildTeamsHtml(teams, orgs, activeId) {
  var orgNames = orgs.map(function(o){ return o.org; });

  var orgOptions = orgNames.map(function(o){
    return '<option value="'+_escT(o)+'">'+_escT(o)+'</option>';
  }).join("") + '<option value="__new__">+ Nova organização...</option>';

  var tableRows = getTeamsTableHtml();

  return '<html lang="pt-BR"><head><meta charset="UTF-8">' +
  '<style>' +
  '@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap");' +
  '*{box-sizing:border-box;margin:0;padding:0}' +
  'html,body{font-family:"DM Sans",sans-serif;font-size:13px;color:#111827;background:#f0f2f5;height:100%;overflow:hidden}' +

  // Layout raiz: painel esquerdo + direito
  '.root{display:grid;grid-template-columns:1fr 340px;height:100vh;gap:0}' +

  // Painel esquerdo — lista de times
  '.left{display:flex;flex-direction:column;background:#f0f2f5;overflow:hidden}' +
  '.left-head{background:#0d1b2a;padding:14px 18px;display:flex;align-items:center;justify-content:space-between}' +
  '.left-title{color:white;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}' +
  '.left-title svg{width:16px;height:16px;fill:white}' +
  '.btn-new{font-size:12px;font-weight:500;padding:6px 14px;border-radius:7px;border:none;background:#1a73e8;color:white;cursor:pointer;font-family:"DM Sans",sans-serif}' +
  '.btn-new:hover{background:#1557b0}' +
  '.teams-list{flex:1;overflow-y:auto;padding:12px}' +

  // Cards de time
  '.team-card{background:white;border-radius:10px;border:1px solid #e5e7eb;padding:14px 16px;margin-bottom:8px;transition:border-color .15s}' +
  '.team-card:hover{border-color:#93c5fd}' +
  '.team-card.active-card{border-color:#1a73e8;border-width:2px;background:#f8fbff}' +
  '.tc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px}' +
  '.tc-name{font-size:13px;font-weight:600;color:#111827;line-height:1.3}' +
  '.active-badge{display:inline-flex;align-items:center;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:#dcfce7;color:#15803d;border:1px solid #86efac;white-space:nowrap}' +
  '.tc-detail{font-size:11px;color:#6b7280;font-family:"DM Mono",monospace;margin-bottom:10px}' +
  '.tc-row{display:flex;gap:4px;flex-wrap:wrap}' +
  '.tc-pill{font-size:10px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:5px;padding:2px 8px;color:#374151;font-family:"DM Mono",monospace}' +
  '.tc-pill.org{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}' +
  '.tc-actions{display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0}' +
  '.btn-act{font-size:11px;padding:4px 12px;border-radius:6px;border:none;background:#1a73e8;color:white;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:500}' +
  '.btn-act:hover{background:#1557b0}' +
  '.btn-edt{font-size:11px;padding:4px 12px;border-radius:6px;border:1px solid #e5e7eb;background:white;color:#374151;cursor:pointer;font-family:"DM Sans",sans-serif}' +
  '.btn-edt:hover{background:#f9fafb}' +
  '.btn-del{font-size:11px;padding:4px 12px;border-radius:6px;border:1px solid #fecaca;background:#fff5f5;color:#dc2626;cursor:pointer;font-family:"DM Sans",sans-serif}' +
  '.btn-del:hover{background:#fee2e2}' +
  '.empty-list{text-align:center;color:#9ca3af;padding:40px 20px;font-style:italic;font-size:12px}' +

  // Painel direito — formulário
  '.right{background:white;border-left:1px solid #e5e7eb;display:flex;flex-direction:column;overflow:hidden}' +
  '.right-head{background:#f9fafb;padding:14px 18px;border-bottom:1px solid #f0f0f0}' +
  '.right-title{font-size:14px;font-weight:600;color:#111827}' +
  '.right-sub{font-size:11px;color:#6b7280;margin-top:2px}' +
  '.form-body{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:14px}' +

  // Campos do formulário
  '.field{display:flex;flex-direction:column;gap:5px}' +
  '.field label{font-size:11px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.04em}' +
  '.field input,.field select{padding:8px 10px;border:1px solid #e5e7eb;border-radius:7px;font-size:13px;font-family:"DM Sans",sans-serif;color:#111827;background:white;transition:border-color .15s}' +
  '.field input:focus,.field select:focus{outline:none;border-color:#1a73e8;box-shadow:0 0 0 3px rgba(26,115,232,.1)}' +
  '.field-note{font-size:10px;color:#6b7280;line-height:1.45}' +
  '.field-note.warn{color:#d97706}' +
  '.new-org-block{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px}' +
  '.new-org-block label{font-size:11px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:.04em}' +
  '.new-org-block input{padding:8px 10px;border:1px solid #fde68a;border-radius:7px;font-size:13px;font-family:"DM Sans",sans-serif;background:#fffde7}' +
  '.new-org-block input:focus{outline:none;border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.15)}' +
  '.divider{height:1px;background:#f0f0f0;margin:2px 0}' +

  // Rodapé do form
  '.form-foot{padding:12px 18px;border-top:1px solid #f0f0f0;display:flex;gap:8px;justify-content:flex-end;background:#fafafa}' +
  '.btn-cancel{font-size:12px;padding:7px 16px;border-radius:7px;border:1px solid #e5e7eb;background:white;color:#6b7280;cursor:pointer;font-family:"DM Sans",sans-serif}' +
  '.btn-save{font-size:12px;padding:7px 16px;border-radius:7px;border:none;background:#1a73e8;color:white;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:500}' +
  '.btn-save:hover{background:#1557b0}' +
  '.btn-cancel:hover{background:#f9fafb}' +

  // Toast
  '.toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%) translateY(20px);background:#111827;color:white;font-size:12px;padding:8px 18px;border-radius:8px;opacity:0;transition:all .25s;pointer-events:none;z-index:999;white-space:nowrap}' +
  '.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
  '.toast.ok{background:#15803d}.toast.err{background:#dc2626}' +
  '</style></head><body>' +

  '<div class="root">' +

  // ── Esquerdo: lista ───────────────────────────────────────
  '<div class="left">' +
    '<div class="left-head">' +
      '<div class="left-title">' +
        '<svg viewBox="0 0 24 24"><path d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z"/></svg>' +
        'Times cadastrados' +
      '</div>' +
      '<button class="btn-new" onclick="newForm()">+ Novo time</button>' +
    '</div>' +
    '<div class="teams-list" id="teams-list">' +
      _buildTeamCards(teams, activeId) +
    '</div>' +
  '</div>' +

  // ── Direito: formulário ───────────────────────────────────
  '<div class="right">' +
    '<div class="right-head">' +
      '<div class="right-title" id="form-title">Novo time</div>' +
      '<div class="right-sub" id="form-sub">Preencha os dados do time para sincronização</div>' +
    '</div>' +

    '<div class="form-body">' +
      '<input type="hidden" id="f-id">' +

      '<div class="field">' +
        '<label>Nome de exibição *</label>' +
        '<input type="text" id="f-name" placeholder="Ex: Time de Backend MPRS">' +
      '</div>' +

      '<div class="divider"></div>' +

      '<div class="field">' +
        '<label>Organização *</label>' +
        '<select id="f-org" onchange="onOrgChange()">' +
          '<option value="">— Selecione ou crie nova —</option>' +
          orgOptions +
        '</select>' +
      '</div>' +

      // Bloco de nova organização (oculto por padrão)
      '<div class="new-org-block" id="new-org-block" style="display:none">' +
        '<label>Nova organização</label>' +
        '<input type="text" id="f-org-new" placeholder="Ex: minha-empresa">' +
        '<label style="margin-top:4px">PAT — Personal Access Token *</label>' +
        '<input type="password" id="f-pat" placeholder="Cole o token aqui">' +
        '<span class="field-note warn">O PAT é compartilhado por todos os times desta org. Escopos: Work Items (Read) e Project and Team (Read).</span>' +
      '</div>' +

      '<div class="divider"></div>' +

      '<div class="field">' +
        '<label>Projeto *</label>' +
        '<input type="text" id="f-project" placeholder="Ex: MPRS-Transcritor_Pesquisa_Enderecos">' +
      '</div>' +

      '<div class="field">' +
        '<label>Team (Azure DevOps) *</label>' +
        '<input type="text" id="f-team" placeholder="Ex: MPRS-Transcritor_Pesquisa_Enderecos Team">' +
        '<span class="field-note">Geralmente é o nome do projeto + " Team". Visível na URL do Azure Boards.</span>' +
      '</div>' +

    '</div>' +

    '<div class="form-foot">' +
      '<button class="btn-cancel" onclick="newForm()">Limpar</button>' +
      '<button class="btn-save" onclick="submitForm()">Salvar time</button>' +
    '</div>' +
  '</div>' +

  '</div>' + // .root

  '<div class="toast" id="toast"></div>' +

  '<script>' +
  'var _orgs=' + JSON.stringify(orgNames) + ';' +

  // Mostra/oculta bloco de nova org
  'function onOrgChange(){' +
    'var sel=document.getElementById("f-org");' +
    'var blk=document.getElementById("new-org-block");' +
    'blk.style.display=sel.value==="__new__"?"flex":"none";' +
    'if(sel.value==="__new__")blk.style.flexDirection="column";' +
  '}' +

  // Limpa formulário para novo time
  'function newForm(){' +
    'document.getElementById("f-id").value="";' +
    'document.getElementById("f-name").value="";' +
    'document.getElementById("f-org").value="";' +
    'document.getElementById("f-org-new").value="";' +
    'document.getElementById("f-pat").value="";' +
    'document.getElementById("f-project").value="";' +
    'document.getElementById("f-team").value="";' +
    'document.getElementById("new-org-block").style.display="none";' +
    'document.getElementById("form-title").textContent="Novo time";' +
    'document.getElementById("form-sub").textContent="Preencha os dados do time para sincronização";' +
  '}' +

  // Carrega dados para edição
  'function editTeam(id){' +
    'google.script.run' +
      '.withSuccessHandler(function(t){' +
        'if(!t){showToast("Time não encontrado","err");return;}' +
        'document.getElementById("f-id").value=t.id;' +
        'document.getElementById("f-name").value=t.name;' +
        'var sel=document.getElementById("f-org");' +
        'var hasOrg=Array.from(sel.options).some(function(o){return o.value===t.org;});' +
        'if(!hasOrg){' +
          'var opt=document.createElement("option");' +
          'opt.value=t.org;opt.textContent=t.org;' +
          'sel.insertBefore(opt,sel.querySelector("[value=__new__]"));' +
        '}' +
        'sel.value=t.org;' +
        'document.getElementById("new-org-block").style.display="none";' +
        'document.getElementById("f-project").value=t.project;' +
        'document.getElementById("f-team").value=t.team;' +
        'document.getElementById("form-title").textContent="Editar: "+t.name;' +
        'document.getElementById("form-sub").textContent="Org: "+t.org;' +
      '})' +
      '.getTeamById(id);' +
  '}' +

  // Ativa time
  'function activateTeam(id){' +
    'google.script.run' +
      '.withSuccessHandler(function(r){' +
        'if(r.ok){showToast(r.msg,"ok");reloadCards();}' +
        'else showToast(r.msg,"err");' +
      '})' +
      '.activateTeam(id);' +
  '}' +

  // Deleta time
  'function delTeam(id){' +
    'if(!confirm("Remover este time? Esta ação não pode ser desfeita."))return;' +
    'google.script.run' +
      '.withSuccessHandler(function(r){' +
        'if(r.ok){showToast(r.msg,"ok");newForm();reloadCards();}' +
        'else showToast(r.msg,"err");' +
      '})' +
      '.deleteTeam(id);' +
  '}' +

  // Submete formulário
  'function submitForm(){' +
    'var sel=document.getElementById("f-org");' +
    'var isNew=sel.value==="__new__";' +
    'var org=isNew?document.getElementById("f-org-new").value.trim():sel.value;' +
    'var payload={' +
      'id:document.getElementById("f-id").value,' +
      'name:document.getElementById("f-name").value.trim(),' +
      'org:org,' +
      'project:document.getElementById("f-project").value.trim(),' +
      'team:document.getElementById("f-team").value.trim(),' +
      'pat:document.getElementById("f-pat").value.trim(),' +
      'isNewOrg:isNew' +
    '};' +
    'if(!payload.name||!payload.org||!payload.project||!payload.team){' +
      'showToast("Preencha todos os campos obrigatórios","err");return;' +
    '}' +
    'document.querySelector(".btn-save").textContent="Salvando...";' +
    'google.script.run' +
      '.withSuccessHandler(function(r){' +
        'document.querySelector(".btn-save").textContent="Salvar time";' +
        'if(r.ok){showToast(r.msg,"ok");newForm();reloadCards();}' +
        'else showToast(r.msg,"err");' +
      '})' +
      '.saveTeam(payload);' +
  '}' +

  // Recarrega os cards da lista
  'function reloadCards(){' +
    'google.script.run' +
      '.withSuccessHandler(function(html){' +
        'document.getElementById("teams-list").innerHTML=html;' +
      '})' +
      '.getTeamsCardsHtml();' +
  '}' +

  // Toast
  'function showToast(msg,type){' +
    'var t=document.getElementById("toast");' +
    't.textContent=msg;t.className="toast "+type+" show";' +
    'setTimeout(function(){t.classList.remove("show");},2800);' +
  '}' +
  '<\/script></body></html>';
}

// ── Gera HTML dos cards da lista ─────────────────────────────
function _buildTeamCards(teams, activeId) {
  if (!teams || teams.length === 0) {
    return '<div class="empty-list">Nenhum time cadastrado.<br>Clique em "+ Novo time" para começar.</div>';
  }
  return teams.map(function(t) {
    var active = t.active === "SIM" || t.id === activeId;
    return '<div class="team-card'+(active?" active-card":"")+'" id="tc-'+_escT(t.id)+'">' +
      '<div class="tc-top">' +
        '<div class="tc-name">'+_escT(t.name)+(active?' <span class="active-badge">Ativo</span>':'')+'</div>' +
      '</div>' +
      '<div class="tc-detail">'+_escT(t.org)+' / '+_escT(t.project)+'</div>' +
      '<div class="tc-row">' +
        '<span class="tc-pill org">'+_escT(t.org)+'</span>' +
        '<span class="tc-pill">'+_escT(t.team)+'</span>' +
      '</div>' +
      '<div class="tc-actions">' +
        (!active ? '<button class="btn-act" onclick=\'activateTeam("'+_escT(t.id)+'")\'>Ativar</button>' : '') +
        '<button class="btn-edt" onclick=\'editTeam("'+_escT(t.id)+'")\'>Editar</button>' +
        '<button class="btn-del" onclick=\'delTeam("'+_escT(t.id)+'")\'>Remover</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

// ── getTeamsCardsHtml — para reload via script.run ───────────
function getTeamsCardsHtml() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var teams = _readAllTeams(ss);
  var activeId = "";
  teams.forEach(function(t){ if (t.active === "SIM") activeId = t.id; });
  return _buildTeamCards(teams, activeId);
}

function _escT(str) {
  return String(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
// ============================================================
//  llm_manager.gs  —  Cadastro e seleção de tokens de LLM
//
//  Aba "LLM_Config":
//    Provider | Token | Ativo? | Cadastrado em
//  Providers suportados: claude | openai | gemini
// ============================================================

var LLM_SHEET = "LLM_Config";

// ── Garante a aba ────────────────────────────────────────────
function _ensureLlmSheet(ss) {
  var sh = ss.getSheetByName(LLM_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LLM_SHEET);
    var hdr = ["Provider","Token","Ativo?","Cadastrado em"];
    sh.getRange(1,1,1,hdr.length).setValues([hdr])
      .setFontWeight("bold").setBackground("#1a73e8").setFontColor("white");
    sh.setFrozenRows(1);
    sh.getRange("B:B").setNumberFormat("@");
    [120,340,80,160].forEach(function(w,i){ sh.setColumnWidth(i+1,w); });
  }
  return sh;
}

// ── Lê todos os LLMs ─────────────────────────────────────────
function _readAllLlms(ss) {
  var sh = ss.getSheetByName(LLM_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,4).getValues()
    .filter(function(r){ return r[0]; })
    .map(function(r){
      return { provider:String(r[0]).trim(), token:String(r[1]).trim(),
               active:String(r[2]).trim(), added:String(r[3]) };
    });
}

// ── Retorna o LLM ativo + token (usado pelo insights) ────────
function getActiveLlm() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  _ensureLlmSheet(ss);
  var llms = _readAllLlms(ss);
  var active = null;
  llms.forEach(function(l){ if (l.active === "SIM") active = l; });
  return active; // null se nenhum ativo
}

// ── Salva / atualiza um LLM (chamado via google.script.run) ──
function saveLlm(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = _ensureLlmSheet(ss);
  var provider = String(payload.provider || "").trim().toLowerCase();
  var token    = String(payload.token    || "").trim();

  if (!provider || !token) return { ok:false, msg:"Provider e Token são obrigatórios." };

  var valid = ["claude","openai","gemini"];
  if (valid.indexOf(provider) === -1)
    return { ok:false, msg:"Provider inválido. Use: claude, openai ou gemini." };

  // Atualiza se já existe, senão insere
  var rows = sh.getLastRow() > 1
    ? sh.getRange(2,1,sh.getLastRow()-1,4).getValues() : [];
  var found = false;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === provider) {
      sh.getRange(i+2,2).setValue(token);
      found = true; break;
    }
  }
  if (!found) {
    sh.appendRow([provider, token, "NÃO",
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")]);
  }
  return { ok:true, msg:"Token de " + provider + " salvo!" };
}

// ── Ativa um LLM ─────────────────────────────────────────────
function activateLlm(provider) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = _ensureLlmSheet(ss);
  if (sh.getLastRow() < 2) return { ok:false, msg:"Nenhum LLM cadastrado." };
  var rows = sh.getRange(2,1,sh.getLastRow()-1,4).getValues();
  var found = false;
  rows.forEach(function(r,i){
    var isThis = String(r[0]).trim().toLowerCase() === String(provider).trim().toLowerCase();
    sh.getRange(i+2,3).setValue(isThis ? "SIM" : "NÃO");
    if (isThis) found = true;
  });
  if (!found) return { ok:false, msg:"Provider não encontrado." };
  return { ok:true, msg:String(provider) + " ativado como LLM padrão!" };
}

// ── Remove um LLM ────────────────────────────────────────────
function deleteLlm(provider) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = _ensureLlmSheet(ss);
  if (sh.getLastRow() < 2) return { ok:false, msg:"Nenhum LLM." };
  var rows = sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === String(provider).trim().toLowerCase()) {
      sh.deleteRow(i+2);
      return { ok:true, msg:"Token removido." };
    }
  }
  return { ok:false, msg:"Provider não encontrado." };
}

// ── Retorna HTML dos cards para reload ───────────────────────
function getLlmCardsHtml() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var llms = _readAllLlms(ss);
  return _buildLlmCards(llms);
}

// ── Abre a tela HTML ─────────────────────────────────────────
function openLlmManager() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  _ensureLlmSheet(ss);
  var llms = _readAllLlms(ss);

  var html = HtmlService
    .createHtmlOutput(_buildLlmHtml(llms))
    .setTitle("Configurar LLMs")
    .setWidth(680)
    .setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, "🤖 Tokens de LLM");
}

// ── Builder HTML ─────────────────────────────────────────────
function _buildLlmHtml(llms) {
  var PROVIDERS = [
    { id:"claude",  label:"Claude (Anthropic)", icon:"🟣",
      hint:"Modelo: claude-sonnet-4-5  ·  Escopos: nenhum adicional" },
    { id:"openai",  label:"OpenAI (GPT-4o)",   icon:"🟢",
      hint:"Modelo: gpt-4o  ·  Crie em platform.openai.com" },
    { id:"gemini",  label:"Gemini (Google)",   icon:"🔵",
      hint:"Modelo: gemini-1.5-pro  ·  Crie em aistudio.google.com" }
  ];

  var cards = _buildLlmCards(llms);

  return '<html lang="pt-BR"><head><meta charset="UTF-8">' +
  '<style>' +
  '@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap");' +
  '*{box-sizing:border-box;margin:0;padding:0}' +
  'html,body{font-family:"DM Sans",sans-serif;font-size:13px;color:#111827;background:#f0f2f5;height:100%;overflow:hidden}' +
  '.root{display:grid;grid-template-columns:1fr 300px;height:100vh}' +
  '.left{display:flex;flex-direction:column;overflow:hidden;background:#f0f2f5}' +
  '.head{background:#0d1b2a;padding:14px 18px;display:flex;align-items:center;gap:10px}' +
  '.head-title{color:white;font-size:14px;font-weight:600}' +
  '.head-sub{color:rgba(255,255,255,.45);font-size:11px}' +
  '.list{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}' +
  '.llm-card{background:white;border-radius:10px;border:1px solid #e5e7eb;padding:14px 16px}' +
  '.llm-card.active-card{border-color:#1a73e8;border-width:2px;background:#f8fbff}' +
  '.lc-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}' +
  '.lc-icon{font-size:20px}' +
  '.lc-name{font-size:13px;font-weight:600;color:#111827}' +
  '.active-badge{font-size:10px;font-weight:600;padding:2px 9px;border-radius:20px;background:#dcfce7;color:#15803d;border:1px solid #86efac}' +
  '.lc-token{font-size:11px;color:#9ca3af;font-family:"DM Mono",monospace;margin-bottom:8px}' +
  '.lc-actions{display:flex;gap:6px}' +
  '.btn-act{font-size:11px;padding:4px 12px;border-radius:6px;border:none;background:#1a73e8;color:white;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:500}' +
  '.btn-act:hover{background:#1557b0}' +
  '.btn-del{font-size:11px;padding:4px 12px;border-radius:6px;border:1px solid #fecaca;background:#fff5f5;color:#dc2626;cursor:pointer;font-family:"DM Sans",sans-serif}' +
  '.btn-del:hover{background:#fee2e2}' +
  '.empty-list{text-align:center;color:#9ca3af;padding:40px;font-style:italic;font-size:12px}' +
  '.right{background:white;border-left:1px solid #e5e7eb;display:flex;flex-direction:column;overflow:hidden}' +
  '.rhead{background:#f9fafb;padding:14px 18px;border-bottom:1px solid #f0f0f0}' +
  '.rhead-title{font-size:14px;font-weight:600;color:#111827}' +
  '.rhead-sub{font-size:11px;color:#6b7280;margin-top:2px}' +
  '.form{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:14px}' +
  '.field{display:flex;flex-direction:column;gap:5px}' +
  '.field label{font-size:11px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.04em}' +
  '.field select,.field input{padding:8px 10px;border:1px solid #e5e7eb;border-radius:7px;font-size:13px;font-family:"DM Sans",sans-serif;color:#111827;background:white}' +
  '.field select:focus,.field input:focus{outline:none;border-color:#1a73e8;box-shadow:0 0 0 3px rgba(26,115,232,.1)}' +
  '.provider-hint{font-size:10px;color:#6b7280;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:7px 10px;line-height:1.5;display:none}' +
  '.provider-hint.show{display:block}' +
  '.foot{padding:12px 18px;border-top:1px solid #f0f0f0;display:flex;justify-content:flex-end;gap:8px;background:#fafafa}' +
  '.btn-save{font-size:12px;padding:7px 16px;border-radius:7px;border:none;background:#1a73e8;color:white;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:500}' +
  '.btn-save:hover{background:#1557b0}' +
  '.toast{position:fixed;bottom:14px;left:50%;transform:translateX(-50%) translateY(20px);background:#111827;color:white;font-size:12px;padding:7px 18px;border-radius:8px;opacity:0;transition:all .25s;pointer-events:none;z-index:999;white-space:nowrap}' +
  '.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
  '.toast.ok{background:#15803d}.toast.err{background:#dc2626}' +
  '</style></head><body>' +
  '<div class="root">' +

  '<div class="left">' +
    '<div class="head"><div>' +
      '<div class="head-title">🤖 Tokens de LLM</div>' +
      '<div class="head-sub">Geração de insights no dashboard</div>' +
    '</div></div>' +
    '<div class="list" id="llm-list">'+cards+'</div>' +
  '</div>' +

  '<div class="right">' +
    '<div class="rhead">' +
      '<div class="rhead-title">Cadastrar token</div>' +
      '<div class="rhead-sub">O token ficará armazenado na aba LLM_Config</div>' +
    '</div>' +
    '<div class="form">' +
      '<div class="field">' +
        '<label>Provider *</label>' +
        '<select id="f-provider" onchange="onProvChange()">' +
          '<option value="">— Selecione —</option>' +
          PROVIDERS.map(function(p){
            return '<option value="'+p.id+'">'+p.icon+' '+p.label+'</option>';
          }).join("") +
        '</select>' +
      '</div>' +
      PROVIDERS.map(function(p){
        return '<div class="provider-hint" id="hint-'+p.id+'">'+p.hint+'</div>';
      }).join("") +
      '<div class="field">' +
        '<label>Token / API Key *</label>' +
        '<input type="password" id="f-token" placeholder="Cole o token aqui">' +
      '</div>' +
    '</div>' +
    '<div class="foot">' +
      '<button class="btn-save" onclick="submitLlm()">Salvar token</button>' +
    '</div>' +
  '</div>' +

  '</div>' +
  '<div class="toast" id="toast"></div>' +

  '<script>' +
  'function onProvChange(){' +
    'var v=document.getElementById("f-provider").value;' +
    'document.querySelectorAll(".provider-hint").forEach(function(el){el.classList.remove("show");});' +
    'if(v){var h=document.getElementById("hint-"+v);if(h)h.classList.add("show");}' +
  '}' +
  'function activateLlm(p){' +
    'google.script.run.withSuccessHandler(function(r){' +
      'showToast(r.msg,r.ok?"ok":"err");if(r.ok)reload();' +
    '}).activateLlm(p);' +
  '}' +
  'function deleteLlm(p){' +
    'if(!confirm("Remover token de "+p+"?"))return;' +
    'google.script.run.withSuccessHandler(function(r){' +
      'showToast(r.msg,r.ok?"ok":"err");if(r.ok)reload();' +
    '}).deleteLlm(p);' +
  '}' +
  'function submitLlm(){' +
    'var prov=document.getElementById("f-provider").value;' +
    'var tok=document.getElementById("f-token").value.trim();' +
    'if(!prov||!tok){showToast("Preencha provider e token","err");return;}' +
    'document.querySelector(".btn-save").textContent="Salvando...";' +
    'google.script.run.withSuccessHandler(function(r){' +
      'document.querySelector(".btn-save").textContent="Salvar token";' +
      'showToast(r.msg,r.ok?"ok":"err");' +
      'if(r.ok){document.getElementById("f-token").value="";reload();}' +
    '}).saveLlm({provider:prov,token:tok});' +
  '}' +
  'function reload(){' +
    'google.script.run.withSuccessHandler(function(h){' +
      'document.getElementById("llm-list").innerHTML=h;' +
    '}).getLlmCardsHtml();' +
  '}' +
  'function showToast(msg,type){' +
    'var t=document.getElementById("toast");' +
    't.textContent=msg;t.className="toast "+type+" show";' +
    'setTimeout(function(){t.classList.remove("show");},2800);' +
  '}' +
  '<\/script></body></html>';
}

function _buildLlmCards(llms) {
  var ICONS = { claude:"🟣", openai:"🟢", gemini:"🔵" };
  var LABELS = { claude:"Claude (Anthropic)", openai:"OpenAI (GPT-4o)", gemini:"Gemini (Google)" };
  if (!llms || llms.length === 0)
    return '<div class="empty-list">Nenhum token cadastrado.<br>Adicione um provider ao lado.</div>';
  return llms.map(function(l) {
    var active = l.active === "SIM";
    var ico    = ICONS[l.provider]  || "⚙️";
    var lbl    = LABELS[l.provider] || l.provider;
    var masked = l.token.length > 8
      ? l.token.substring(0,4) + "••••••••" + l.token.slice(-4)
      : "••••••••";
    return '<div class="llm-card'+(active?" active-card":"")+'">' +
      '<div class="lc-top">' +
        '<span class="lc-icon">'+ico+'</span>' +
        '<span class="lc-name">'+_escL(lbl)+'</span>' +
        (active?'<span class="active-badge">Ativo</span>':'') +
      '</div>' +
      '<div class="lc-token">'+masked+'</div>' +
      '<div class="lc-actions">' +
        (!active?'<button class="btn-act" onclick=\'activateLlm("'+l.provider+'")\'>Ativar</button>':'') +
        '<button class="btn-del" onclick=\'deleteLlm("'+l.provider+'")\'>Remover</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

function _escL(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
// ============================================================
//  RAG Manager  —  Contextos de treinamento por escopo
//
//  Aba "RAG_Context":
//    ID | Escopo | Time ID | Tipo de Contexto | Especificação | Ativo? | Criado em
//
//  Escopo "geral"  → aplicado a todos os times
//  Escopo "time"   → aplicado apenas ao time ativo no momento
// ============================================================

var RAG_SHEET = "RAG_Context";

// ── Garante a aba com nova estrutura de colunas ───────────────
function _ensureRagSheet(ss) {
  var sh = ss.getSheetByName(RAG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(RAG_SHEET);
    var hdr = ["ID","Escopo","Time ID","Tipo de Contexto","Especificação","Ativo?","Criado em"];
    sh.getRange(1,1,1,hdr.length).setValues([hdr])
      .setFontWeight("bold").setBackground("#1a73e8").setFontColor("white");
    sh.setFrozenRows(1);
    sh.getRange("A:A").setNumberFormat("@");
    [80,80,120,200,480,70,140].forEach(function(w,i){ sh.setColumnWidth(i+1,w); });
    sh.setRowHeight(1,32);
  } else {
    // Migração: se a aba existir com 5 colunas (formato antigo), adiciona as novas
    var lastCol = sh.getLastColumn();
    if (lastCol === 5) {
      // Insere colunas Escopo e Time ID no início (após ID)
      sh.insertColumnAfter(1);
      sh.insertColumnAfter(2);
      sh.getRange(1,2).setValue("Escopo");
      sh.getRange(1,3).setValue("Time ID");
      // Marca entradas existentes como escopo geral
      if (sh.getLastRow() > 1) {
        sh.getRange(2,2,sh.getLastRow()-1,1).setValue("geral");
        sh.getRange(2,3,sh.getLastRow()-1,1).setValue("");
      }
    }
  }
  return sh;
}

// ── Lê todas as entradas (7 colunas) ─────────────────────────
function _readAllRag(ss) {
  var sh = ss.getSheetByName(RAG_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,7).getValues()
    .filter(function(r){ return r[0]; })
    .map(function(r){
      return {
        id:      String(r[0]).trim(),
        scope:   String(r[1]).trim() || "geral",   // "geral" | "time"
        teamId:  String(r[2]).trim(),               // ID do time ou ""
        type:    String(r[3]).trim(),
        spec:    String(r[4]).trim(),
        active:  String(r[5]).trim(),
        created: String(r[6])
      };
    });
}

// ── Retorna contexto ativo para o prompt ─────────────────────
// Mescla: contexto geral (todos ativos) + contexto do time ativo
// Cada seção claramente rotulada para o LLM diferenciar.
function getActiveRagContext() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  _ensureRagSheet(ss);
  var entries = _readAllRag(ss).filter(function(e){ return e.active === "SIM"; });
  if (entries.length === 0) return "";

  // Descobre o time ativo
  var activeTeamId   = "";
  var activeTeamName = "";
  var teams = _readAllTeams(ss);
  teams.forEach(function(t){
    if (t.active === "SIM") { activeTeamId = t.id; activeTeamName = t.name; }
  });

  Logger.log("RAG: time ativo id=" + activeTeamId + " nome=" + activeTeamName);
  Logger.log("RAG: entradas ativas=" + entries.length);
  entries.forEach(function(e){
    Logger.log("  entrada id=" + e.id + " scope=" + e.scope + " teamId=" + e.teamId + " type=" + e.type);
  });

  var gerais  = entries.filter(function(e){ return e.scope === "geral"; });

  // Tenta match exato por ID primeiro
  var especif = entries.filter(function(e){
    return e.scope === "time" && e.teamId === activeTeamId;
  });

  // Fallback: se não achou por ID mas há entradas de time,
  // inclui TODAS as entradas de escopo "time" ativas
  // (útil quando o teamId não foi gravado corretamente na migração)
  if (especif.length === 0) {
    var allTeamScoped = entries.filter(function(e){ return e.scope === "time"; });
    if (allTeamScoped.length > 0) {
      Logger.log("RAG: nenhum match por teamId, usando todas as " + allTeamScoped.length + " entradas de scope=time");
      especif = allTeamScoped;
    }
  }

  Logger.log("RAG: gerais=" + gerais.length + " específicos=" + especif.length);

  var sections = [];

  // Específico do time PRIMEIRO — mais alta prioridade
  if (especif.length > 0) {
    sections.push(
      "## Contexto Específico do Time: " + (activeTeamName || activeTeamId || "time ativo") + "\n" +
      especif.map(function(e){ return "### " + e.type + "\n" + e.spec; }).join("\n\n")
    );
  }

  if (gerais.length > 0) {
    sections.push(
      "## Contexto Geral (aplicável a todos os times)\n" +
      gerais.map(function(e){ return "### " + e.type + "\n" + e.spec; }).join("\n\n")
    );
  }

  return sections.join("\n\n---\n\n");
}

// ── Debug: mostra no alert o que está sendo enviado ao LLM ───
// Chame pelo menu para verificar se o contexto RAG está correto
function debugRagContext() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var rag = getActiveRagContext();

  if (!rag) {
    ui.alert("RAG vazio.\n\nNenhuma entrada ativa encontrada na aba RAG_Context.\n" +
             "Cadastre contextos em: AgileViewAI → IA & Configurações → Cadastrar RAG.");
    return;
  }

  // Mostra os primeiros 800 chars para não estourar o alert
  ui.alert(
    "✅ Contexto RAG que será enviado ao LLM:\n\n" +
    rag.substring(0, 800) +
    (rag.length > 800 ? "\n\n... (" + rag.length + " chars total)" : "")
  );
}

// ── Salva entrada (nova ou edição) ────────────────────────────
function saveRagEntry(payload) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sh     = _ensureRagSheet(ss);
  var id     = String(payload.id     || "").trim();
  var scope  = String(payload.scope  || "geral").trim();
  var teamId = String(payload.teamId || "").trim();
  var type   = String(payload.type   || "").trim();
  var spec   = String(payload.spec   || "").trim();

  if (!type || !spec) return { ok:false, msg:"Tipo e Especificação são obrigatórios." };
  if (type.length > 100) return { ok:false, msg:"Tipo muito longo (máx 100 chars)." };
  if (scope === "time" && !teamId) return { ok:false, msg:"Selecione um time para escopo específico." };

  if (id) {
    var rows = sh.getLastRow() > 1 ? sh.getRange(2,1,sh.getLastRow()-1,7).getValues() : [];
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === id) {
        sh.getRange(i+2,2).setValue(scope);
        sh.getRange(i+2,3).setValue(scope === "geral" ? "" : teamId);
        sh.getRange(i+2,4).setValue(type);
        sh.getRange(i+2,5).setValue(spec);
        return { ok:true, msg:"Contexto atualizado!" };
      }
    }
    return { ok:false, msg:"Entrada não encontrada." };
  } else {
    var newId = "rag_" + String(Date.now());
    sh.appendRow([newId, scope, scope === "geral" ? "" : teamId, type, spec, "SIM",
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")]);
    return { ok:true, msg:"Contexto cadastrado!" };
  }
}

// ── Alterna ativo/inativo ─────────────────────────────────────
function toggleRagEntry(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = _ensureRagSheet(ss);
  if (sh.getLastRow() < 2) return { ok:false, msg:"Nenhuma entrada." };
  var rows = sh.getRange(2,1,sh.getLastRow()-1,7).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(id).trim()) {
      var newVal = String(rows[i][5]).trim() === "SIM" ? "NÃO" : "SIM";
      sh.getRange(i+2,6).setValue(newVal);
      return { ok:true, active:newVal };
    }
  }
  return { ok:false, msg:"Não encontrado." };
}

// ── Remove entrada ─────────────────────────────────────────────
function deleteRagEntry(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = _ensureRagSheet(ss);
  if (sh.getLastRow() < 2) return { ok:false, msg:"Nenhuma entrada." };
  var rows = sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(id).trim()) {
      sh.deleteRow(i+2);
      return { ok:true, msg:"Entrada removida." };
    }
  }
  return { ok:false, msg:"Não encontrada." };
}

// ── Retorna entrada por ID ─────────────────────────────────────
function getRagEntryById(id) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var entries = _readAllRag(ss);
  var found   = null;
  entries.forEach(function(e){ if (e.id === String(id)) found = e; });
  return found;
}

// ── HTML dos cards (para reload) ──────────────────────────────
function getRagCardsHtml() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var entries = _readAllRag(ss);
  var teams   = _readAllTeams(ss);
  return _buildRagCards(entries, teams);
}

// ── Abre a tela HTML ──────────────────────────────────────────
function openRagManager() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  _ensureRagSheet(ss);
  var entries = _readAllRag(ss);
  var teams   = _readAllTeams(ss);
  var html = HtmlService
    .createHtmlOutput(_buildRagHtml(entries, teams))
    .setTitle("RAG — Contexto de Treinamento")
    .setWidth(980)
    .setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, "📚 RAG / Treinamento da IA");
}

// ── Builder HTML ──────────────────────────────────────────────
function _buildRagHtml(entries, teams) {
  var cards = _buildRagCards(entries, teams);

  // Options de time para o select
  var teamOptions = '<option value="">— Selecione o time —</option>' +
    teams.map(function(t){
      return '<option value="'+_escR(t.id)+'"'+(t.active==="SIM"?' selected':'')+'>'+
             (t.active==="SIM"?"★ ":"")+_escR(t.name)+'</option>';
    }).join("");

  // Nomes dos times para lookup no JS
  var teamNamesJson = JSON.stringify(
    teams.reduce(function(acc,t){ acc[t.id]=t.name; return acc; }, {})
  );

  return '<html lang="pt-BR"><head><meta charset="UTF-8">' +
  '<style>' +
  '@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap");' +
  '*{box-sizing:border-box;margin:0;padding:0}' +
  'html,body{font-family:"DM Sans",sans-serif;font-size:13px;color:#111827;background:#f0f2f5;height:100%;overflow:hidden}' +
  '.root{display:grid;grid-template-columns:1fr 400px;height:100vh}' +

  // Lista
  '.left{display:flex;flex-direction:column;overflow:hidden}' +
  '.lhead{background:#0d1b2a;padding:14px 18px;display:flex;align-items:center;justify-content:space-between}' +
  '.lhead-info .title{color:white;font-size:14px;font-weight:600}' +
  '.lhead-info .sub{color:rgba(255,255,255,.4);font-size:11px;margin-top:2px}' +
  '.btn-new{font-size:12px;padding:6px 14px;border-radius:7px;border:none;background:#1a73e8;color:white;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:500}' +
  '.btn-new:hover{background:#1557b0}' +

  // Filtros de escopo
  '.scope-tabs{display:flex;gap:6px;padding:10px 12px;background:#f9fafb;border-bottom:1px solid #e5e7eb}' +
  '.stab{font-size:11px;padding:4px 12px;border-radius:20px;border:1px solid #e5e7eb;background:white;color:#6b7280;cursor:pointer;font-family:"DM Sans",sans-serif}' +
  '.stab.active{background:#1d4ed8;color:white;border-color:#1d4ed8}' +
  '.stab.geral-active{background:#15803d;color:white;border-color:#15803d}' +

  '.list{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}' +

  // Cards
  '.rag-card{background:white;border-radius:10px;padding:14px 16px;border:1px solid #e5e7eb}' +
  '.rag-card.inactive{opacity:.55;border-style:dashed}' +
  '.rag-card.scope-geral{border-left:3px solid #15803d}' +
  '.rag-card.scope-time{border-left:3px solid #1d4ed8}' +
  '.rc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px}' +
  '.rc-type{font-size:13px;font-weight:600;color:#111827}' +
  '.rc-scope-badge{font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;text-transform:uppercase;letter-spacing:.04em}' +
  '.sb-geral{background:#dcfce7;color:#15803d;border:1px solid #86efac}' +
  '.sb-time{background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd}' +
  '.rc-team-name{font-size:10px;color:#6b7280;margin-bottom:4px;font-style:italic}' +
  '.rc-spec{font-size:11px;color:#6b7280;line-height:1.5;margin-bottom:10px;max-height:48px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}' +
  '.rc-foot{display:flex;align-items:center;gap:6px;padding-top:8px;border-top:1px solid #f0f0f0}' +
  '.rc-toggle{font-size:10px;font-weight:500;padding:2px 9px;border-radius:20px;cursor:pointer;border:none;font-family:"DM Sans",sans-serif}' +
  '.rc-toggle.on{background:#dcfce7;color:#15803d;border:1px solid #86efac}' +
  '.rc-toggle.off{background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db}' +
  '.btn-edit{font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid #e5e7eb;background:white;color:#374151;cursor:pointer;font-family:"DM Sans",sans-serif}' +
  '.btn-edit:hover{background:#f9fafb}' +
  '.btn-del{font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid #fecaca;background:#fff5f5;color:#dc2626;cursor:pointer;font-family:"DM Sans",sans-serif}' +
  '.btn-del:hover{background:#fee2e2}' +
  '.empty-list{text-align:center;color:#9ca3af;padding:40px;font-style:italic;font-size:12px}' +

  // Formulário
  '.right{background:white;border-left:1px solid #e5e7eb;display:flex;flex-direction:column;overflow:hidden}' +
  '.rhead{background:#f9fafb;padding:14px 18px;border-bottom:1px solid #f0f0f0}' +
  '.rhead-title{font-size:14px;font-weight:600;color:#111827}' +
  '.rhead-sub{font-size:11px;color:#6b7280;margin-top:2px}' +
  '.form{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:13px}' +
  '.field{display:flex;flex-direction:column;gap:5px}' +
  '.field label{font-size:11px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.04em}' +
  '.field input,.field select{padding:8px 10px;border:1px solid #e5e7eb;border-radius:7px;font-size:13px;font-family:"DM Sans",sans-serif;color:#111827;background:white}' +
  '.field input:focus,.field select:focus{outline:none;border-color:#1a73e8;box-shadow:0 0 0 3px rgba(26,115,232,.1)}' +
  '.field textarea{padding:9px 10px;border:1px solid #e5e7eb;border-radius:7px;font-size:12px;font-family:"DM Sans",sans-serif;color:#111827;background:white;resize:vertical;min-height:160px;line-height:1.55}' +
  '.field textarea:focus{outline:none;border-color:#1a73e8;box-shadow:0 0 0 3px rgba(26,115,232,.1)}' +
  '.field-note{font-size:10px;color:#6b7280;line-height:1.45}' +

  // Scope selector pills
  '.scope-sel{display:flex;gap:8px}' +
  '.scope-pill{flex:1;padding:8px 12px;border-radius:8px;border:1.5px solid #e5e7eb;cursor:pointer;text-align:center;transition:all .15s;background:white}' +
  '.scope-pill.selected-geral{border-color:#15803d;background:#f0fdf4}' +
  '.scope-pill.selected-time{border-color:#1d4ed8;background:#eff6ff}' +
  '.scope-pill-icon{font-size:16px;display:block;margin-bottom:3px}' +
  '.scope-pill-label{font-size:11px;font-weight:600;color:#374151}' +
  '.scope-pill-sub{font-size:10px;color:#9ca3af}' +
  '.team-select-block{display:none}' +

  '.type-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}' +
  '.chip{font-size:11px;padding:3px 9px;border-radius:20px;background:#f3f4f6;border:1px solid #e5e7eb;color:#374151;cursor:pointer}' +
  '.chip:hover{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}' +

  '.foot{padding:12px 18px;border-top:1px solid #f0f0f0;display:flex;gap:8px;justify-content:flex-end;background:#fafafa}' +
  '.btn-cancel{font-size:12px;padding:7px 14px;border-radius:7px;border:1px solid #e5e7eb;background:white;color:#6b7280;cursor:pointer;font-family:"DM Sans",sans-serif}' +
  '.btn-save{font-size:12px;padding:7px 14px;border-radius:7px;border:none;background:#1a73e8;color:white;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:500}' +
  '.btn-save:hover{background:#1557b0}' +
  '.toast{position:fixed;bottom:14px;left:50%;transform:translateX(-50%) translateY(20px);background:#111827;color:white;font-size:12px;padding:7px 18px;border-radius:8px;opacity:0;transition:all .25s;pointer-events:none;z-index:999;white-space:nowrap}' +
  '.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
  '.toast.ok{background:#15803d}.toast.err{background:#dc2626}' +
  '</style></head><body>' +

  '<div class="root">' +

  // ── Lista ──────────────────────────────────────────────────
  '<div class="left">' +
    '<div class="lhead">' +
      '<div class="lhead-info">' +
        '<div class="title">📚 Contextos de Treinamento</div>' +
        '<div class="sub">Geral (todos os times) + Específico por time</div>' +
      '</div>' +
      '<button class="btn-new" onclick="newForm()">+ Novo</button>' +
    '</div>' +
    '<div class="scope-tabs">' +
      '<button class="stab active" onclick="filterScope(\'all\',this)">Todos</button>' +
      '<button class="stab" onclick="filterScope(\'geral\',this)">🌐 Geral</button>' +
      '<button class="stab" onclick="filterScope(\'time\',this)">👥 Por time</button>' +
    '</div>' +
    '<div class="list" id="rag-list">'+cards+'</div>' +
  '</div>' +

  // ── Formulário ─────────────────────────────────────────────
  '<div class="right">' +
    '<div class="rhead">' +
      '<div class="rhead-title" id="form-title">Novo contexto</div>' +
      '<div class="rhead-sub" id="form-sub">Geral ou específico de um time</div>' +
    '</div>' +
    '<div class="form">' +
      '<input type="hidden" id="f-id">' +

      // Seletor de escopo visual
      '<div class="field">' +
        '<label>Escopo *</label>' +
        '<div class="scope-sel">' +
          '<div class="scope-pill selected-geral" id="pill-geral" onclick="selectScope(\'geral\')">' +
            '<span class="scope-pill-icon">🌐</span>' +
            '<div class="scope-pill-label">Geral</div>' +
            '<div class="scope-pill-sub">Todos os times</div>' +
          '</div>' +
          '<div class="scope-pill" id="pill-time" onclick="selectScope(\'time\')">' +
            '<span class="scope-pill-icon">👥</span>' +
            '<div class="scope-pill-label">Por time</div>' +
            '<div class="scope-pill-sub">Específico</div>' +
          '</div>' +
        '</div>' +
        '<input type="hidden" id="f-scope" value="geral">' +
      '</div>' +

      // Select de time (aparece só quando escopo = time)
      '<div class="field team-select-block" id="team-select-block">' +
        '<label>Time *</label>' +
        '<select id="f-team-id">'+teamOptions+'</select>' +
        '<span class="field-note">O contexto será usado apenas quando este time estiver ativo.</span>' +
      '</div>' +

      '<div class="field">' +
        '<label>Tipo de contexto *</label>' +
        '<input type="text" id="f-type" placeholder="Ex: Processo de trabalho do time">' +
        '<div class="type-chips">' +
          ['Processo de trabalho','Definição de Done','Critérios de priorização',
           'Regras de capacidade','Acordos do time','Histórico de sprints',
           'Riscos conhecidos','Dependências externas','SLA do time','Tech stack'].map(function(c){
            return '<span class="chip" onclick="setChip(this)">'+c+'</span>';
          }).join("") +
        '</div>' +
      '</div>' +

      '<div class="field">' +
        '<label>Especificação *</label>' +
        '<textarea id="f-spec" placeholder="Descreva com detalhes. Quanto mais preciso, melhores os insights da IA.&#10;&#10;Exemplo: O time trabalha com sprints de 2 semanas. Capacidade padrão: 6h/dia..."></textarea>' +
        '<span class="field-note">Injetado diretamente no prompt enviado ao LLM.</span>' +
      '</div>' +
    '</div>' +
    '<div class="foot">' +
      '<button class="btn-cancel" onclick="newForm()">Limpar</button>' +
      '<button class="btn-save" onclick="submitForm()">Salvar contexto</button>' +
    '</div>' +
  '</div>' +

  '</div>' +
  '<div class="toast" id="toast"></div>' +

  '<script>' +
  'var _teamNames='+teamNamesJson+';' +
  'var _currentScope="all";' +

  'function selectScope(s){' +
    'document.getElementById("f-scope").value=s;' +
    'document.getElementById("pill-geral").className="scope-pill"+(s==="geral"?" selected-geral":"");' +
    'document.getElementById("pill-time").className="scope-pill"+(s==="time"?" selected-time":"");' +
    'document.getElementById("team-select-block").style.display=s==="time"?"flex":"none";' +
    'if(s==="time")document.getElementById("team-select-block").style.flexDirection="column";' +
  '}' +

  'function filterScope(s,btn){' +
    '_currentScope=s;' +
    'document.querySelectorAll(".stab").forEach(function(b){b.classList.remove("active","geral-active");});' +
    'btn.classList.add(s==="geral"?"geral-active":"active");' +
    'document.querySelectorAll(".rag-card").forEach(function(card){' +
      'if(s==="all"){card.style.display="";}' +
      'else{card.style.display=card.dataset.scope===s?"":"none";}' +
    '});' +
  '}' +

  'function setChip(el){document.getElementById("f-type").value=el.textContent;}' +

  'function newForm(){' +
    'document.getElementById("f-id").value="";' +
    'document.getElementById("f-type").value="";' +
    'document.getElementById("f-spec").value="";' +
    'selectScope("geral");' +
    'document.getElementById("form-title").textContent="Novo contexto";' +
    'document.getElementById("form-sub").textContent="Geral ou específico de um time";' +
  '}' +

  'function editEntry(id){' +
    'google.script.run.withSuccessHandler(function(e){' +
      'if(!e){showToast("Não encontrado","err");return;}' +
      'document.getElementById("f-id").value=e.id;' +
      'document.getElementById("f-type").value=e.type;' +
      'document.getElementById("f-spec").value=e.spec;' +
      'selectScope(e.scope);' +
      'if(e.teamId){' +
        'var sel=document.getElementById("f-team-id");' +
        'sel.value=e.teamId;' +
      '}' +
      'document.getElementById("form-title").textContent="Editar: "+e.type;' +
      'document.getElementById("form-sub").textContent=(e.scope==="geral"?"🌐 Geral":"👥 "+(_teamNames[e.teamId]||e.teamId));' +
    '}).getRagEntryById(id);' +
  '}' +

  'function toggleEntry(id){' +
    'google.script.run.withSuccessHandler(function(r){' +
      'showToast(r.ok?(r.active==="SIM"?"Ativado!":"Desativado!"):"Erro","");' +
      'if(r.ok)reload();' +
    '}).toggleRagEntry(id);' +
  '}' +

  'function deleteEntry(id){' +
    'if(!confirm("Remover este contexto?"))return;' +
    'google.script.run.withSuccessHandler(function(r){' +
      'showToast(r.msg,r.ok?"ok":"err");if(r.ok){newForm();reload();}' +
    '}).deleteRagEntry(id);' +
  '}' +

  'function submitForm(){' +
    'var id=document.getElementById("f-id").value;' +
    'var scope=document.getElementById("f-scope").value;' +
    'var teamId=scope==="time"?document.getElementById("f-team-id").value:"";' +
    'var type=document.getElementById("f-type").value.trim();' +
    'var spec=document.getElementById("f-spec").value.trim();' +
    'if(!type||!spec){showToast("Preencha tipo e especificação","err");return;}' +
    'if(scope==="time"&&!teamId){showToast("Selecione um time","err");return;}' +
    'document.querySelector(".btn-save").textContent="Salvando...";' +
    'google.script.run.withSuccessHandler(function(r){' +
      'document.querySelector(".btn-save").textContent="Salvar contexto";' +
      'showToast(r.msg,r.ok?"ok":"err");' +
      'if(r.ok){newForm();reload();}' +
    '}).saveRagEntry({id:id,scope:scope,teamId:teamId,type:type,spec:spec});' +
  '}' +

  'function reload(){' +
    'google.script.run.withSuccessHandler(function(h){' +
      'document.getElementById("rag-list").innerHTML=h;' +
      'filterScope(_currentScope,document.querySelector(".stab.active,.stab.geral-active"));' +
    '}).getRagCardsHtml();' +
  '}' +

  'function showToast(msg,type){' +
    'var t=document.getElementById("toast");' +
    't.textContent=msg;t.className="toast "+(type||"")+" show";' +
    'setTimeout(function(){t.classList.remove("show");},2800);' +
  '}' +
  '<\/script></body></html>';
}

// ── Builder dos cards ─────────────────────────────────────────
function _buildRagCards(entries, teams) {
  if (!entries || entries.length === 0)
    return '<div class="empty-list">Nenhum contexto cadastrado.<br>Clique em "+ Novo" para começar.</div>';

  // Mapa de ID → nome do time
  var teamNames = {};
  if (teams) teams.forEach(function(t){ teamNames[t.id] = t.name; });

  return entries.map(function(e) {
    var isActive = e.active === "SIM";
    var isGeral  = e.scope !== "time";
    var scopeLabel = isGeral ? "🌐 Geral" : "👥 Time";
    var scopeBadge = isGeral ? "sb-geral" : "sb-time";
    var teamName   = !isGeral && e.teamId ? (teamNames[e.teamId] || e.teamId) : "";

    return '<div class="rag-card scope-'+(isGeral?"geral":"time")+(isActive?"":" inactive")+'" '+
           'data-scope="'+(isGeral?"geral":"time")+'" id="rc-'+_escR(e.id)+'">' +
      '<div class="rc-top">' +
        '<div class="rc-type">'+_escR(e.type)+'</div>' +
        '<span class="rc-scope-badge '+scopeBadge+'">'+scopeLabel+'</span>' +
      '</div>' +
      (teamName ? '<div class="rc-team-name">'+_escR(teamName)+'</div>' : '') +
      '<div class="rc-spec">'+_escR(e.spec)+'</div>' +
      '<div class="rc-foot">' +
        '<button class="rc-toggle '+(isActive?"on":"off")+'" onclick=\'toggleEntry("'+_escR(e.id)+'")\'>'+(isActive?"● Ativo":"○ Inativo")+'</button>' +
        '<button class="btn-edit" onclick=\'editEntry("'+_escR(e.id)+'")\'>Editar</button>' +
        '<button class="btn-del" onclick=\'deleteEntry("'+_escR(e.id)+'")\'>Remover</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

function _escR(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
// ============================================================

