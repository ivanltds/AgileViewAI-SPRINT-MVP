/**
 * AgileViewAI - Playwright E2E Helpers (ULTIMATE STABILITY)
 */

export async function setupFullApp(page) {
  const teamId = 't_alpha';
  const team = { id: teamId, name: 'Time Alpha', org: 'TestOrg', proj: 'TestProj', azTeam: 'Time Alpha' };
  const activeSprint = { 
    id: 's_10', name: 'Sprint 10', path: 'TestProj\\Sprint 10', 
    attributes: { startDate: '2026-04-01', finishDate: '2026-04-30' },
    startRaw: '2026-04-01', endRaw: '2026-04-30', bizDaysLeft: 5 
  };
  
  const backlog = [
    { id: 1001, title: 'Story A', state: 'Active', type: 'Product Backlog Item', estimativa: 8, childRem: 4, fields: { 'System.AssignedTo': { displayName: 'João Silva' }, 'System.State': 'Active', 'System.WorkItemType': 'Product Backlog Item' } },
    { id: 1002, title: 'Bug B', type: 'Defect', state: 'Closed', area: 'IA', estimativa: 3, childRem: 0, blockStatus: '', fields: { 'System.AssignedTo': { displayName: 'Maria Santos' }, 'System.State': 'Closed', 'System.WorkItemType': 'Microsoft.VSTS.Scheduling.RemainingWork' } },
    { id: 1003, title: 'Blocked C', state: 'Active', type: 'Product Backlog Item', blockStatus: 'BLOCKED', estimativa: 5, childRem: 5, fields: { 'System.AssignedTo': { displayName: 'Pedro Costa' }, 'System.State': 'Active', 'System.WorkItemType': 'Product Backlog Item' } },
    { id: 1004, title: 'Fixing D', state: 'Active', type: 'Product Backlog Item', blockStatus: 'FIXING', estimativa: 5, childRem: 2, fields: { 'System.AssignedTo': { displayName: 'João Silva' }, 'System.State': 'Active', 'System.WorkItemType': 'Product Backlog Item' } },
    { id: 1005, title: 'Story E', state: 'New', type: 'Product Backlog Item', estimativa: 0, childRem: 0, fields: { 'System.AssignedTo': { displayName: 'Maria Santos' }, 'System.State': 'New', 'System.WorkItemType': 'Product Backlog Item' } }
  ];

  const stats = { 
    total: 5, done: 1, blocked: 1, fixing: 1, inProgress: 1, donePct: 20,
    allocPct: 110, totalRem: 30, capacityTotal: 20 
  };

  const sprintData = { 
    team, activeSprint, backlog, tasks: [
      { id: 2001, parentId: 1001, title: 'Task 1', state: 'In Progress', remaining: 4, assignedTo: 'João Silva' },
      { id: 2002, parentId: 1001, title: 'Task 2', state: 'Done', remaining: 0, assignedTo: 'João Silva' }
    ], 
    capacity: { 
      'João Silva': { capRest: 20, activity: 'Desenvolvedor' },
      'Maria Santos': { capRest: 10, activity: 'QA' },
      'Pedro Costa': { capRest: 5, activity: 'UX' },
      'Carlos Mendes': { capRest: 5, activity: 'Scrum Master' },
      'Ana Lima': { capRest: 0, activity: 'PO' }
    }, 
    stats, syncedAt: new Date().toISOString() 
  };

  // 1. INTERCEPTAÇÃO DE REDE INTELIGENTE
  await page.route('https://dev.azure.com/**', async route => {
    const url = route.request().url();
    // Iterations
    if (url.includes('/iterations')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [activeSprint] }) });
    } 
    // Capacity
    else if (url.includes('/capacity')) {
      const capArray = Object.entries(sprintData.capacity).map(([name, info]) => ({
        teamMember: { displayName: name }, activities: [{ name: info.activity, capacityPerDay: 8 }]
      }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: capArray }) });
    }
    // WorkItems / Backlog — exclui /revisions (gerenciado por testes específicos)
    else if ((url.includes('/wiql') || url.includes('/workitems')) && !url.includes('/revisions')) {
      // Mock simplificado do Azure para Wiql/Batch
      const wiqlResp = { workItemRelations: backlog.map(b => ({ target: { id: b.id } })) };
      const batchResp = { value: backlog.map(b => ({ id: b.id, fields: b.fields })) };
      const body = url.includes('/wiql') ? wiqlResp : batchResp;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    // Revisões — retornar vazio por padrão (testes específicos podem sobrescrever)
    else if (url.includes('/revisions')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [] }) });
    }
    else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [] }) });
    }
  });

  // 2. INJEÇÃO PRÉ-LOAD
  await page.addInitScript(({ data }) => {
    localStorage.clear();
    localStorage.setItem('avai_sprint_cache', JSON.stringify(data));
    localStorage.setItem('avai_active_team', 't_alpha');
    localStorage.setItem('avai_orgs', JSON.stringify([{ id: 'o_test', name: 'TestOrg', patEnc: 'mock-pat' }]));
    localStorage.setItem('avai_teams', JSON.stringify([
      { id: 't_alpha', name: 'Time Alpha', orgId: 'o_test', org: 'TestOrg', proj: 'TestProj', azTeam: 'Time Alpha' },
      { id: 'team-beta', name: 'Time Beta', orgId: 'o_test', org: 'TestOrg', proj: 'BetaProj', azTeam: 'Time Beta' }
    ]));
    localStorage.setItem('avai_chat_convs', JSON.stringify([
      { id: 'c_mock', title: 'Mock Chat', messages: [{role:'user', content:'Hello'}], createdAt: new Date().toISOString() }
    ]));
    localStorage.setItem('avai_test_auto_session', 'true');
    // Simular Vault já configurado e desbloqueado para o E2E
    localStorage.setItem('avai_vault_salt', 'bW9jay1zYWx0'); // btoa('mock-salt')
    localStorage.setItem('avai_vault_check', 'bW9jay1vaw=='); // btoa('mock-ok')
    
    // Injeção direta na memória para evitar race conditions
    if (!window.AppState) window.AppState = { sessionTokens: { teams: {}, orgs: {}, llms: {} }, vaultMode: 'session' };
    const teams = [
      { id: 't_alpha', name: 'Time Alpha', orgId: 'o_test', org: 'TestOrg', proj: 'TestProj', azTeam: 'Time Alpha', patEnc: 'mock-pat' },
      { id: 'team-beta', name: 'Time Beta', orgId: 'o_test', org: 'TestOrg', proj: 'BetaProj', azTeam: 'Time Beta', patEnc: 'mock-pat' }
    ];
    teams.forEach(t => { window.AppState.sessionTokens.teams[t.id] = 'mock-token'; });
    
    window.console.warn = () => {};
  }, { data: sprintData });

  // 3. CARREGAMENTO E ATUALIZAÇÃO ATÔMICA
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.Store && window.Dashboard && window.APP, { timeout: 15000 });
  
  await page.evaluate(({ data }) => {
    console.log('E2E: Injetando dados pós-load...');
    if (window.Store) window.Store.saveSprintCache(data);
    if (window.APP) { 
      window.APP.sprintData = data; 
      window.APP.activeTeam = data.team; 
    }
    if (window.Dashboard) {
      console.log('E2E: Forçando renderização do Dashboard...');
      window.Dashboard.render();
    }
  }, { data: sprintData });

  await page.waitForSelector('.bl-row', { timeout: 15000 });
}

export async function goToApp(page) { await setupFullApp(page); }
export async function setupSession(page) {
  await page.goto('/');
  await page.click('#tab-pin'); // Garantir que está no PIN
  await page.click('#tab-session');
  await page.click('#vbtn-session');
  await page.waitForSelector('#app', { state: 'visible' });
}
