const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_ERROR:', error));
  
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    console.log('Page loaded successfully.');
    
    const typeLaunchApp = await page.evaluate(() => typeof window.launchApp);
    console.log('typeof window.launchApp:', typeLaunchApp);
    
    await page.click('#tab-session');
    await page.click('#vbtn-session');
    await page.waitForTimeout(1000);
    
    const appVisible = await page.evaluate(() => document.getElementById('app').style.display);
    console.log('App style.display:', appVisible);
  } catch (e) {
    console.log('Error:', e);
  }
  
  await browser.close();
})();
