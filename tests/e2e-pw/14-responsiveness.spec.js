import { test, expect } from '@playwright/test';

test.describe('Sprint Module Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test('should stack overview items on mobile', async ({ page }) => {
    // Enable auto-session and mock data
    await page.addInitScript(() => {
      localStorage.setItem('avai_test_auto_session', 'true');
      localStorage.setItem('avai_teams', JSON.stringify([{ id: 'test-team', name: 'Test Team', org: 'test-org', proj: 'test-proj', azTeam: 'test-az', patEnc: 'mock' }]));
      localStorage.setItem('avai_active_team_id', 'test-team');
      
      // Mock some sprint data to ensure containers are not empty
      const mockStats = { donePct: 50, capacityTotal: 100, totalRem: 50, totalTasksOpen: 5, totalTasksDone: 5 };
      const mockSprint = { path: 'Test\\Sprint 1', attributes: { startDate: '2024-01-01', finishDate: '2024-01-15' }, bizDaysLeft: 5 };
      
      // Trigger a direct render if needed or just let the app boot
      window.AVAI_MOCK_DATA = { stats: mockStats, activeSprint: mockSprint, backlog: [{id:1, title:'Task 1', state:'Active'}], tasks: [], capacity: {} };
    });

    await page.goto('/');
    await page.waitForSelector('#panel-dashboard', { state: 'visible' });

    // Wait for cards to be rendered (indicating data is present)
    await page.waitForSelector('.db-card', { state: 'visible' });

    const overviewRow = page.locator('.db-overview-row');
    await expect(overviewRow).toBeVisible();

    // Check if items are stacked vertically
    const children = await overviewRow.locator('> div').all();
    
    if (children.length >= 2) {
      const box1 = await children[0].boundingBox();
      const box2 = await children[1].boundingBox();
      
      console.log(`Box 1 (Progress): y=${box1.y}, h=${box1.height}`);
      console.log(`Box 2 (Members): y=${box2.y}, h=${box2.height}`);

      // Ensure they are not null
      expect(box1).not.toBeNull();
      expect(box2).not.toBeNull();

      // On stacked layout, y2 should be significantly greater than y1
      expect(box2.y).toBeGreaterThan(box1.y + box1.height - 12);
    }
  });

  test('should stack member section items on mobile', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('avai_test_auto_session', 'true');
    });

    await page.goto('/');
    await page.waitForSelector('#panel-dashboard', { state: 'visible' });
    await page.waitForSelector('.mbr-section', { state: 'visible' });

    const mbrSection = page.locator('.mbr-section');
    await expect(mbrSection).toBeVisible();

    const children = await mbrSection.locator('> div').all();
    if (children.length >= 2) {
      const box1 = await children[0].boundingBox();
      const box2 = await children[1].boundingBox();
      
      // Should be stacked
      expect(box2.y).toBeGreaterThan(box1.y + box1.height - 10);
    }
  });

  test('should adjust topbar for mobile', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('avai_test_auto_session', 'true');
    });

    await page.goto('/');
    
    const topbar = page.locator('.db-topbar');
    const display = await topbar.evaluate(el => window.getComputedStyle(el).flexDirection);
    
    // In our new CSS, it should be column on mobile
    expect(display).toBe('column');
  });
});
