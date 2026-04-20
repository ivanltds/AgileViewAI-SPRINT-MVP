import { jest } from '@jest/globals';

/**
 * Integration Test: App Shell and Legacy Renderer Synchronization
 * Verifies that the modular app.js correctly triggers legacy rendering 
 * functions for Teams, LLM, and RAG sections.
 */

describe('App Shell Initialization', () => {
  let appModule;

  beforeEach(async () => {
    // 1. Setup DOM environment
    document.body.innerHTML = `
      <div id="vault-overlay"></div>
      <div id="app" style="display:none">
        <nav id="sidebar"></nav>
        <main id="main-content">
          <section id="panel-dashboard" class="panel"></section>
          <section id="panel-teams" class="panel"></section>
          <section id="panel-llm" class="panel"></section>
          <section id="panel-rag" class="panel"></section>
        </main>
      </div>
      <div id="db-topbar"></div>
      <div id="db-topbar-info"></div>
      <div id="db-no-data"></div>
    `;

    // 2. Mock legacy global renderers
    global.renderTeams = jest.fn();
    global.renderOrgList = jest.fn();
    global.renderLlmList = jest.fn();
    global.renderRagList = jest.fn();
    global.renderDashTeamSel = jest.fn();
    global.runSync = jest.fn();

    // 3. Clear the module cache to ensure fresh import
    jest.resetModules();
    
    // 4. Import the module (using dynamic import for ESM under Jest)
    appModule = await import('../../src/app.js');
  });

  afterEach(() => {
    delete global.renderTeams;
    delete global.renderOrgList;
    delete global.renderLlmList;
    delete global.renderRagList;
    delete global.renderDashTeamSel;
    delete global.runSync;
  });

  test('launchApp should trigger all legacy rendering functions', async () => {
    // 1. Arrange: setup DOM
    const sidebar = document.getElementById('sidebar');
    
    // 2. Act: Call launchApp
    appModule.launchApp();
    
    // 3. Assert
    // Check that all legacy renderers were called
    expect(global.renderTeams).toHaveBeenCalled();
    expect(global.renderOrgList).toHaveBeenCalled();
    expect(global.renderLlmList).toHaveBeenCalled();
    expect(global.renderRagList).toHaveBeenCalled();
    expect(global.renderDashTeamSel).toHaveBeenCalled();
  });

  test('showPanel should toggle active class and update sidebar', async () => {
    const dashboard = document.getElementById('panel-dashboard');
    const teams = document.getElementById('panel-teams');
    
    // Ensure sidebar is initialized first to avoid 'container undefined' error
    appModule.launchApp();
    
    // Now trigger navigation
    appModule.showPanel('teams');
    
    expect(teams.classList.contains('active')).toBe(true);
    expect(dashboard.classList.contains('active')).toBe(false);
  });
});
