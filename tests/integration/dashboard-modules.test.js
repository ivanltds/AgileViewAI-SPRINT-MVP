import { jest } from '@jest/globals';

/**
 * Integration Test: Dashboard Module Switching
 * Verifies that the modular Dashboard.js correctly manages the visibility
 * of the Sprint, Eficiência, and Qualidade modules.
 */

describe('Dashboard Module Switching', () => {
  let dashboardModule;

  beforeEach(async () => {
    // 1. Setup DOM environment reflecting index.html structure
    document.body.innerHTML = `
      <div id="dashboard-content">
        <div class="mod-tabs">
          <div class="mod-tab active" data-mod="sprint">Sprint</div>
          <div class="mod-tab" data-mod="eficiencia">Eficiência</div>
          <div class="mod-tab" data-mod="qualidade">Qualidade</div>
        </div>
        <div class="mod-panel active" id="module-sprint">Sprint Content</div>
        <div class="mod-panel" id="module-eficiencia">Eficiência Content</div>
        <div class="mod-panel" id="module-qualidade">Qualidade Content</div>
      </div>
    `;

    // 2. Mock legacy global functions that might be called
    global.renderDashTeamSel = jest.fn();
    global.loadEficienciaFilter = jest.fn();
    global.renderQualidadeCharts = jest.fn();

    // 3. Clear module cache
    jest.resetModules();
    
    // 4. Import the module
    dashboardModule = (await import('../../src/components/ui/dashboard.js')).Dashboard;
    
    // 5. Initialize
    dashboardModule.init(document.getElementById('dashboard-content'));
  });

  afterEach(() => {
    delete global.renderDashTeamSel;
    delete global.loadEficienciaFilter;
    delete global.renderQualidadeCharts;
  });

  test('should show Efficiency and hide Sprint when Eficiência tab is clicked', () => {
    const sprintPanel = document.getElementById('module-sprint');
    const efiPanel = document.getElementById('module-eficiencia');
    const efiTab = document.querySelector('[data-mod="eficiencia"]');

    // Act
    dashboardModule.setModule('eficiencia');

    // Assert
    expect(efiPanel.classList.contains('active')).toBe(true);
    expect(sprintPanel.classList.contains('active')).toBe(false);
    expect(efiTab.classList.contains('active')).toBe(true);
    expect(global.loadEficienciaFilter).toHaveBeenCalled();
  });

  test('should show Quality and hide others when Qualidade tab is clicked', () => {
    const sprintPanel = document.getElementById('module-sprint');
    const quaPanel = document.getElementById('module-qualidade');
    const quaTab = document.querySelector('[data-mod="qualidade"]');

    // Act
    dashboardModule.setModule('qualidade');

    // Assert
    expect(quaPanel.classList.contains('active')).toBe(true);
    expect(sprintPanel.classList.contains('active')).toBe(false);
    expect(quaTab.classList.contains('active')).toBe(true);
  });
});
