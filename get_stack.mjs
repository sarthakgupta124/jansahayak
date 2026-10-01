import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => {
    console.log('BROWSER ERROR:', err.message);
    console.log('STACK:', err.stack);
  });
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await browser.close();
})();
