# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 14-responsiveness.spec.js >> Sprint Module Responsiveness >> should stack overview items on mobile
- Location: tests\e2e-pw\14-responsiveness.spec.js:6:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.db-card') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - text: Dashboard Times IA & Tokens Treinamento Configurações
    - main [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - generic [ref=e6]: Nenhuma sprint carregada
          - generic [ref=e7]:
            - button "— Selecione um time ▾" [ref=e9] [cursor=pointer]:
              - generic [ref=e10]: —
              - generic [ref=e11]: Selecione um time
              - generic [ref=e12]: ▾
            - button "↺ Sincronizar" [ref=e13] [cursor=pointer]
            - button "↓ HTML" [ref=e14] [cursor=pointer]
        - generic [ref=e15]:
          - generic [ref=e16] [cursor=pointer]: Sprint
          - generic [ref=e17] [cursor=pointer]: Eficiência
          - generic [ref=e18] [cursor=pointer]: Qualidade
        - generic [ref=e21]:
          - generic [ref=e22]: ⚠️
          - heading "Nenhum time ativo" [level=3] [ref=e23]
          - paragraph [ref=e24]: Selecione um time no menu superior ou na aba Times.
  - button "Assistente IA" [ref=e25] [cursor=pointer]:
    - img [ref=e27]
  - navigation "Navegação principal" [ref=e29]:
    - generic [ref=e30]:
      - button "Dashboard" [ref=e31] [cursor=pointer]:
        - img [ref=e33]
        - generic [ref=e34]: Dashboard
      - button "Times" [ref=e35] [cursor=pointer]:
        - img [ref=e37]
        - generic [ref=e42]: Times
      - button "IA e Tokens" [ref=e43] [cursor=pointer]:
        - img [ref=e45]
        - generic [ref=e48]: IA
      - button "Treinamento" [ref=e49] [cursor=pointer]:
        - img [ref=e51]
        - generic [ref=e54]: Treino
      - button "Configurações" [ref=e55] [cursor=pointer]:
        - img [ref=e57]
        - generic [ref=e60]: Config
  - button "💬" [ref=e61] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Sprint Module Responsiveness', () => {
  4  |   test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size
  5  | 
  6  |   test('should stack overview items on mobile', async ({ page }) => {
  7  |     // Enable auto-session and mock data
  8  |     await page.addInitScript(() => {
  9  |       localStorage.setItem('avai_test_auto_session', 'true');
  10 |       localStorage.setItem('avai_teams', JSON.stringify([{ id: 'test-team', name: 'Test Team', org: 'test-org', proj: 'test-proj', azTeam: 'test-az', patEnc: 'mock' }]));
  11 |       localStorage.setItem('avai_active_team_id', 'test-team');
  12 |       
  13 |       // Mock some sprint data to ensure containers are not empty
  14 |       const mockStats = { donePct: 50, capacityTotal: 100, totalRem: 50, totalTasksOpen: 5, totalTasksDone: 5 };
  15 |       const mockSprint = { path: 'Test\\Sprint 1', attributes: { startDate: '2024-01-01', finishDate: '2024-01-15' }, bizDaysLeft: 5 };
  16 |       
  17 |       // Trigger a direct render if needed or just let the app boot
  18 |       window.AVAI_MOCK_DATA = { stats: mockStats, activeSprint: mockSprint, backlog: [{id:1, title:'Task 1', state:'Active'}], tasks: [], capacity: {} };
  19 |     });
  20 | 
  21 |     await page.goto('/');
  22 |     await page.waitForSelector('#panel-dashboard', { state: 'visible' });
  23 | 
  24 |     // Wait for cards to be rendered (indicating data is present)
> 25 |     await page.waitForSelector('.db-card', { state: 'visible' });
     |                ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  26 | 
  27 |     const overviewRow = page.locator('.db-overview-row');
  28 |     await expect(overviewRow).toBeVisible();
  29 | 
  30 |     // Check if items are stacked vertically
  31 |     const children = await overviewRow.locator('> div').all();
  32 |     
  33 |     if (children.length >= 2) {
  34 |       const box1 = await children[0].boundingBox();
  35 |       const box2 = await children[1].boundingBox();
  36 |       
  37 |       console.log(`Box 1 (Progress): y=${box1.y}, h=${box1.height}`);
  38 |       console.log(`Box 2 (Members): y=${box2.y}, h=${box2.height}`);
  39 | 
  40 |       // Ensure they are not null
  41 |       expect(box1).not.toBeNull();
  42 |       expect(box2).not.toBeNull();
  43 | 
  44 |       // On stacked layout, y2 should be significantly greater than y1
  45 |       expect(box2.y).toBeGreaterThan(box1.y + box1.height - 12);
  46 |     }
  47 |   });
  48 | 
  49 |   test('should stack member section items on mobile', async ({ page }) => {
  50 |     await page.addInitScript(() => {
  51 |       localStorage.setItem('avai_test_auto_session', 'true');
  52 |     });
  53 | 
  54 |     await page.goto('/');
  55 |     await page.waitForSelector('#panel-dashboard', { state: 'visible' });
  56 |     await page.waitForSelector('.mbr-section', { state: 'visible' });
  57 | 
  58 |     const mbrSection = page.locator('.mbr-section');
  59 |     await expect(mbrSection).toBeVisible();
  60 | 
  61 |     const children = await mbrSection.locator('> div').all();
  62 |     if (children.length >= 2) {
  63 |       const box1 = await children[0].boundingBox();
  64 |       const box2 = await children[1].boundingBox();
  65 |       
  66 |       // Should be stacked
  67 |       expect(box2.y).toBeGreaterThan(box1.y + box1.height - 10);
  68 |     }
  69 |   });
  70 | 
  71 |   test('should adjust topbar for mobile', async ({ page }) => {
  72 |     await page.addInitScript(() => {
  73 |       localStorage.setItem('avai_test_auto_session', 'true');
  74 |     });
  75 | 
  76 |     await page.goto('/');
  77 |     
  78 |     const topbar = page.locator('.db-topbar');
  79 |     const display = await topbar.evaluate(el => window.getComputedStyle(el).flexDirection);
  80 |     
  81 |     // In our new CSS, it should be column on mobile
  82 |     expect(display).toBe('column');
  83 |   });
  84 | });
  85 | 
```