import { chromium } from 'playwright';
chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }).then(async (b) => {
  const context = await b.newContext({
      permissions: ['microphone'],
  });
  const page = await context.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);
  
  await page.evaluate(async () => {
     try {
       const btn = document.getElementById('btn-connection-toggle');
       if (btn) btn.click();
     } catch (e) {
       console.error(e);
     }
  });

  await page.waitForTimeout(5000);
  console.log('done');
  await b.close();
}).catch(console.error);
