import { test, expect } from '@playwright/test';

test.describe('Global Scope Sanity Check', () => {
  test('should have all legacy globals defined on window', async ({ page }) => {
    // Enable auto-session for testing convenience
    await page.addInitScript(() => {
      localStorage.setItem('avai_test_auto_session', 'true');
    });

    await page.goto('/');

    // Check entry-point functions reported as missing
    const missingGlobals = await page.evaluate(() => {
      const required = [
        'openOrgModal',
        'openTeamModal',
        'handleImport',
        'handleSync',
        'showPanel',
        'APP',
        'Vault',
        'Store'
      ];
      return required.filter(name => typeof window[name] === 'undefined');
    });

    expect(missingGlobals, `Missing globals: ${missingGlobals.join(', ')}`).toHaveLength(0);

    // Verify types
    const types = await page.evaluate(() => {
      return {
        openOrgModal: typeof window.openOrgModal,
        APP: typeof window.APP,
        Vault: typeof window.Vault
      };
    });

    expect(types.openOrgModal).toBe('function');
    expect(types.APP).toBe('object');
    expect(types.Vault).toBe('object');
  });

  test('should not throw ReferenceError when clicking legacy UI buttons', async ({ page }) => {
    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.addInitScript(() => {
      localStorage.setItem('avai_test_auto_session', 'true');
    });

    await page.goto('/');
    
    // Wait for App to be ready
    await page.waitForSelector('#app', { state: 'visible' });

    // Navigate to Teams
    await page.click('#nav-teams');
    
    // Click "Novo Time" (triggers openTeamModal)
    await page.click('button:has-text("+ Novo time")');
    
    // Verify modal is open
    await expect(page.locator('#modal-team')).toHaveClass(/open/);

    // Close modal
    await page.click('#modal-team .mclose');
    await expect(page.locator('#modal-team')).not.toHaveClass(/open/);

    // Check for ReferenceErrors in collected console messages
    const refErrors = consoleErrors.filter(err => err.includes('ReferenceError'));
    expect(refErrors, `Detected ReferenceErrors: ${refErrors.join(', ')}`).toHaveLength(0);
  });
});
