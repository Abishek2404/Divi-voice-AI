import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  
  await page.goto('http://localhost:3000/');

  // Click the Divi activation button
  const button = page.locator('button').filter({ hasText: 'Tap to Wake Divi' });
  await button.click();

  // Wait for it to receive an audio response
  await page.waitForFunction(() => {
    return (window as any).receivedAudio === true;
  }, { timeout: 30000 }).catch(e => console.log('Timeout waiting for audio'));

  console.log('done');
  await browser.close();
})();
