const { chromium } = require('playwright');
(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://example.com');
    await page.screenshot({ path: 'test.png' });
    await browser.close();
    console.log('Success!');
  } catch (e) {
    console.error(e);
  }
})();
